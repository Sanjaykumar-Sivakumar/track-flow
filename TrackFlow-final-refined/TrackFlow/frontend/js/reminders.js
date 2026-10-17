/**
 * TrackFlow - Reminder & Notification Engine
 * Manages foreground notifications, Service Worker notifications, quiet hours, and scheduling.
 */
const ReminderService = {
  intervalId: null,

  /**
   * Initialize notification system and background checker
   */
  init() {
    this.startScheduler();
    this.cleanStaleFiredReminders();
  },

  /**
   * Check if Notifications API is supported by the current browser
   */
  isSupported() {
    return 'Notification' in window;
  },

  /**
   * Get current notification permission state
   */
  getPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'granted' | 'denied' | 'default'
  },

  /**
   * Request permission from user
   */
  async requestPermission() {
    if (!this.isSupported()) {
      return { success: false, permission: 'unsupported', message: 'Browser does not support desktop notifications.' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return { success: true, permission: 'granted', message: 'Notification permission granted.' };
      } else {
        return { success: false, permission, message: 'Notification permission was denied or dismissed.' };
      }
    } catch (e) {
      console.error('[ReminderService] Error requesting permission:', e);
      return { success: false, permission: 'error', message: e.message };
    }
  },

  /**
   * Test notification trigger
   */
  async sendTestNotification() {
    if (this.getPermission() !== 'granted') {
      const res = await this.requestPermission();
      if (!res.success) {
        return { success: false, message: 'Please grant notification permissions in your browser to test.' };
      }
    }

    const title = 'TrackFlow Notification Test';
    const body = 'Your notification system is configured and working perfectly! Reminders will trigger for upcoming tasks.';
    return this.showNotification(title, {
      body,
      tag: 'trackflow-test-' + Date.now(),
      data: { url: './index.html' }
    });
  },

  /**
   * Display a notification via Service Worker (if available) or standard Notification constructor
   */
  async showNotification(title, options = {}) {
    if (this.getPermission() !== 'granted') {
      return { success: false, error: 'Permission not granted' };
    }

    const defaultOptions = {
      body: '',
      icon: 'assets/icon-192.png',
      badge: 'assets/favicon.svg',
      tag: 'trackflow-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200]
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Play subtle audio cue if enabled and not in quiet hours
    this.playAudioCue();

    // 1. Try Service Worker Registration if active
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          await registration.showNotification(title, finalOptions);
          return { success: true, method: 'service-worker' };
        }
      } catch (err) {
        console.warn('[ReminderService] Service Worker showNotification failed, trying fallback:', err);
      }
    }

    // 2. Fallback to standard window Notification
    try {
      const notification = new Notification(title, finalOptions);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return { success: true, method: 'window-notification' };
    } catch (err) {
      console.error('[ReminderService] Window Notification failed:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Check if current time falls within configured Quiet Hours
   */
  isInQuietHours() {
    const settings = store.state.settings || CONFIG.DEFAULT_SETTINGS;
    const startStr = settings.quietHoursStart || '23:00';
    const endStr = settings.quietHoursEnd || '07:00';

    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (startMin < endMin) {
      // e.g. 01:00 to 06:00
      return curMinutes >= startMin && curMinutes < endMin;
    } else {
      // e.g. 23:00 to 07:00 (spans midnight)
      return curMinutes >= startMin || curMinutes < endMin;
    }
  },

  /**
   * Play an accessible subtle notification sound if enabled
   */
  playAudioCue() {
    const settings = store.state.settings || CONFIG.DEFAULT_SETTINGS;
    if (!settings.soundEnabled || this.isInQuietHours()) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // AudioContext blocked or unsupported - silent fallback
    }
  },

  /**
   * Start the foreground scheduler (runs every 30 seconds)
   */
  startScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Run check immediately and then every 30 seconds
    this.checkReminders();
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, 30000);
  },

  /**
   * Periodic check of upcoming tasks and EOD review reminder
   */
  checkReminders() {
    const settings = store.state.settings || CONFIG.DEFAULT_SETTINGS;
    if (!settings.notificationsEnabled || this.getPermission() !== 'granted') {
      return;
    }

    const now = new Date();
    const todayStr = store.formatDate(now);
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    const firedMap = StorageService.get(CONFIG.STORAGE_KEYS.FIRED_REMINDERS, {});
    let firedChanged = false;

    // 1. Check EOD Review Reminder
    const reviewTimeStr = settings.dailyReviewTime || '21:00';
    const [rh, rm] = reviewTimeStr.split(':').map(Number);
    const reviewMin = rh * 60 + rm;
    const eodKey = `eod_${todayStr}`;

    // If within 5 minutes of review time and not already fired today
    if (Math.abs(curMinutes - reviewMin) <= 4 && !firedMap[eodKey]) {
      // Check if EOD is already submitted
      const existingReport = (store.state.reports || []).find(r => r.date === todayStr);
      if (!existingReport) {
        this.showNotification('TrackFlow: Time for End-of-Day Review', {
          body: 'Take 2 minutes to review today\'s tasks, reflect on accomplishments, and set priorities for tomorrow.',
          tag: 'eod-review',
          data: { url: './index.html?view=eod' }
        });
        firedMap[eodKey] = Date.now();
        firedChanged = true;
      }
    }

    // 2. Check Task Reminders
    const tasks = store.state.tasks || [];
    const todayTasks = tasks.filter(t => t.date === todayStr && t.status === 'pending' && t.reminderEnabled && t.startTime);

    todayTasks.forEach(task => {
      const [th, tm] = task.startTime.split(':').map(Number);
      const taskStartMin = th * 60 + tm;
      const leadMin = Number(settings.defaultLeadMinutes) || 10;

      // Advance reminder (e.g. 10 mins before)
      const advanceKey = `adv_${task.taskId}_${todayStr}`;
      const timeUntilStart = taskStartMin - curMinutes;

      if (timeUntilStart > 0 && timeUntilStart <= leadMin && !firedMap[advanceKey]) {
        this.showNotification(`Upcoming Task: ${task.title}`, {
          body: `Starting in ${timeUntilStart} min (${task.startTime}) - Category: ${task.category || 'General'}`,
          tag: `task-adv-${task.taskId}`,
          data: { taskId: task.taskId, url: './index.html' }
        });
        firedMap[advanceKey] = Date.now();
        firedChanged = true;
      }

      // Exact Start reminder
      const startKey = `start_${task.taskId}_${todayStr}`;
      if (Math.abs(curMinutes - taskStartMin) <= 1 && !firedMap[startKey]) {
        this.showNotification(`Time to Focus: ${task.title}`, {
          body: `Scheduled now (${task.startTime}). Earn ${task.plannedPoints} points upon completion.`,
          tag: `task-start-${task.taskId}`,
          data: { taskId: task.taskId, url: './index.html' }
        });
        firedMap[startKey] = Date.now();
        firedChanged = true;
      }

      // Follow-up reminder (15 min after start if still pending)
      const followKey = `follow_${task.taskId}_${todayStr}`;
      if (curMinutes - taskStartMin >= 15 && curMinutes - taskStartMin <= 20 && !firedMap[followKey]) {
        this.showNotification(`Task in Progress: ${task.title}`, {
          body: `Don't forget to mark this task complete in TrackFlow once finished.`,
          tag: `task-follow-${task.taskId}`,
          data: { taskId: task.taskId, url: './index.html' }
        });
        firedMap[followKey] = Date.now();
        firedChanged = true;
      }
    });

    if (firedChanged) {
      StorageService.set(CONFIG.STORAGE_KEYS.FIRED_REMINDERS, firedMap);
    }
  },

  /**
   * Find next upcoming scheduled reminder
   */
  getNextScheduledReminder() {
    const now = new Date();
    const todayStr = store.formatDate(now);
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    const tasks = store.state.tasks || [];
    const upcoming = tasks
      .filter(t => t.date === todayStr && t.status === 'pending' && t.reminderEnabled && t.startTime)
      .map(t => {
        const [h, m] = t.startTime.split(':').map(Number);
        return {
          task: t,
          minutes: h * 60 + m
        };
      })
      .filter(item => item.minutes >= curMinutes)
      .sort((a, b) => a.minutes - b.minutes);

    if (upcoming.length > 0) {
      const next = upcoming[0];
      const diff = next.minutes - curMinutes;
      return {
        task: next.task,
        time: next.task.startTime,
        diffMinutes: diff,
        label: diff === 0 ? 'Starting now' : `In ${diff} min (${next.task.startTime})`
      };
    }

    return null;
  },

  /**
   * Cancel reminders when task is completed or deleted
   */
  cancelTaskReminders(taskId) {
    const todayStr = store.formatDate(new Date());
    const firedMap = StorageService.get(CONFIG.STORAGE_KEYS.FIRED_REMINDERS, {});
    // Mark as fired so they won't trigger
    firedMap[`adv_${taskId}_${todayStr}`] = Date.now();
    firedMap[`start_${taskId}_${todayStr}`] = Date.now();
    firedMap[`follow_${taskId}_${todayStr}`] = Date.now();
    StorageService.set(CONFIG.STORAGE_KEYS.FIRED_REMINDERS, firedMap);
  },

  /**
   * Clean out reminder keys older than 3 days
   */
  cleanStaleFiredReminders() {
    const firedMap = StorageService.get(CONFIG.STORAGE_KEYS.FIRED_REMINDERS, {});
    const threeDaysAgo = Date.now() - 3 * 24 * 3600000;
    const cleaned = {};
    Object.keys(firedMap).forEach(key => {
      if (firedMap[key] > threeDaysAgo) {
        cleaned[key] = firedMap[key];
      }
    });
    StorageService.set(CONFIG.STORAGE_KEYS.FIRED_REMINDERS, cleaned);
  }
};
