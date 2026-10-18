/**
 * TrackFlow - Main Application Controller & UI Orchestrator
 */

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Global App Object
const App = {
  deferredInstallPrompt: null,

  async init() {
    console.log('[TrackFlow] Initializing application...');

    // 1. Load initial settings & theme
    const savedSettings = StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, { ...CONFIG.DEFAULT_SETTINGS });
    const savedTheme = StorageService.get(CONFIG.STORAGE_KEYS.THEME, savedSettings.theme || 'dark');
    SettingsManager.applyTheme(savedTheme);

    // 2. Initialize Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').then((reg) => {
        console.log('[ServiceWorker] Registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('[ServiceWorker] Registration failed:', err);
      });

      // Listen for messages from SW (e.g. notification action clicks)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'COMPLETE_TASK') {
          this.handleToggleTaskStatus(event.data.taskId, 'completed');
        }
      });
    }

    // 3. Capture PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    // 4. Initialize Reminders
    ReminderService.init();

    // 5. Connect State Store
    store.subscribe((state, prevState) => {
      this.render();
      this.updateSyncBadge(state);
    });

    // 6. Pull initial data (Cloud or Local)
    await ApiService.syncAllFromCloud();

    // 7. Bind UI Event Handlers
    this.bindEvents();

    // 8. Initial Render
    this.render();
    this.updateSyncBadge(store.getState());

    // 9. Check for URL parameters (e.g. ?action=quick-add or ?view=eod or ?action=complete&taskId=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'quick-add') {
      this.openTaskModal();
    } else if (urlParams.get('action') === 'complete' && urlParams.get('taskId')) {
      this.handleToggleTaskStatus(urlParams.get('taskId'), 'completed');
    } else if (urlParams.get('view')) {
      this.navigateTo(urlParams.get('view'));
    }

    console.log('[TrackFlow] Application ready.');
  },

  /**
   * Bind DOM event listeners
   */
  bindEvents() {
    // Navigation items
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-view-target');
        this.navigateTo(target);
        // Close mobile drawer if open
        document.getElementById('sidebar').classList.remove('open');
      });
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Date selector change
    const globalDateInput = document.getElementById('global-date-picker');
    if (globalDateInput) {
      globalDateInput.value = store.state.activeDate;
      globalDateInput.addEventListener('change', (e) => {
        const newDate = e.target.value;
        if (newDate) {
          store.setState({ activeDate: newDate, activeMonth: newDate.substring(0, 7) });
        }
      });
    }

    // Quick Add Task Button
    const quickAddBtn = document.getElementById('btn-quick-add');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.openTaskModal());
    }

    // Install PWA Button
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          this.deferredInstallPrompt = null;
        }
      });
    }

    // Task Modal Form Submission
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));
    }

    // Task Modal Cancel / Close
    const closeTaskModalBtn = document.getElementById('btn-close-task-modal');
    const cancelTaskBtn = document.getElementById('btn-cancel-task');
    if (closeTaskModalBtn) closeTaskModalBtn.addEventListener('click', () => this.closeTaskModal());
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', () => this.closeTaskModal());

    // Live Overlap Detection on time change in Task Modal
    const startTimeInput = document.getElementById('task-start-time');
    const endTimeInput = document.getElementById('task-end-time');
    const dateInput = document.getElementById('task-date');
    const overlapNotice = document.getElementById('task-overlap-warning');

    const checkLiveOverlap = () => {
      if (!startTimeInput || !endTimeInput || !dateInput || !overlapNotice) return;
      const d = dateInput.value;
      const s = startTimeInput.value;
      const e = endTimeInput.value;
      const taskId = document.getElementById('task-id')?.value;

      if (d && s && e && s < e) {
        const conflict = TaskManager.checkOverlap({ taskId, date: d, startTime: s, endTime: e }, store.state.tasks);
        if (conflict) {
          overlapNotice.style.display = 'block';
          overlapNotice.innerHTML = `⚠️ <strong>Time Overlap Warning:</strong> Conflicts with "${conflict.title}" (${conflict.startTime} - ${conflict.endTime}).`;
        } else {
          overlapNotice.style.display = 'none';
        }
      } else {
        overlapNotice.style.display = 'none';
      }
    };

    if (startTimeInput) startTimeInput.addEventListener('change', checkLiveOverlap);
    if (endTimeInput) endTimeInput.addEventListener('change', checkLiveOverlap);
    if (dateInput) dateInput.addEventListener('change', checkLiveOverlap);

    // Goal Modal Form Submission
    const goalForm = document.getElementById('goal-form');
    if (goalForm) {
      goalForm.addEventListener('submit', (e) => this.handleGoalFormSubmit(e));
    }
    const closeGoalModalBtn = document.getElementById('btn-close-goal-modal');
    const cancelGoalBtn = document.getElementById('btn-cancel-goal');
    if (closeGoalModalBtn) closeGoalModalBtn.addEventListener('click', () => this.closeGoalModal());
    if (cancelGoalBtn) cancelGoalBtn.addEventListener('click', () => this.closeGoalModal());

    // Reschedule Modal Form Submission & Cancel
    const rescheduleForm = document.getElementById('reschedule-form');
    if (rescheduleForm) {
      rescheduleForm.addEventListener('submit', (e) => this.handleRescheduleSubmit(e));
    }
    const closeRescheduleBtn = document.getElementById('btn-close-reschedule-modal');
    const cancelRescheduleBtn = document.getElementById('btn-cancel-reschedule');
    if (closeRescheduleBtn) closeRescheduleBtn.addEventListener('click', () => this.closeRescheduleModal());
    if (cancelRescheduleBtn) cancelRescheduleBtn.addEventListener('click', () => this.closeRescheduleModal());

    // EOD Review Form Submission
    const eodForm = document.getElementById('eod-review-form');
    if (eodForm) {
      eodForm.addEventListener('submit', (e) => this.handleEodSubmit(e));
    }

    // Settings Form Submission
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSettingsSubmit(e));
    }

    // Settings Action Buttons
    const btnTestConn = document.getElementById('btn-test-gas-connection');
    if (btnTestConn) {
      btnTestConn.addEventListener('click', () => this.handleTestGasConnection());
    }

    const btnInitSheet = document.getElementById('btn-init-spreadsheet');
    if (btnInitSheet) {
      btnInitSheet.addEventListener('click', () => this.handleInitSpreadsheet());
    }

    const btnTestNotif = document.getElementById('btn-test-notification');
    if (btnTestNotif) {
      btnTestNotif.addEventListener('click', async () => {
        const res = await ReminderService.sendTestNotification();
        if (res.success) {
          showToast('Test notification sent successfully!', 'success');
        } else {
          showToast(res.message || 'Notification permission required', 'error');
        }
      });
    }

    const btnExport = document.getElementById('btn-export-data');
    if (btnExport) {
      btnExport.addEventListener('click', () => SettingsManager.exportData());
    }

    const btnResetDemo = document.getElementById('btn-reset-demo');
    if (btnResetDemo) {
      btnResetDemo.addEventListener('click', () => {
        if (confirm('Reset to default demo tasks and reports?')) {
          localStorage.clear();
          StorageService.seedInitialDataIfEmpty();
          ApiService.syncAllFromCloud();
          showToast('Data reset to demonstration state', 'info');
        }
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // 'N' for new task (when not typing in an input)
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        this.openTaskModal();
      }
      // 'Escape' to close modals
      if (e.key === 'Escape') {
        this.closeTaskModal();
        this.closeGoalModal();
        this.closeRescheduleModal();
      }
    });

    // Task Filter controls
    const searchInput = document.getElementById('tasks-search');
    const catFilter = document.getElementById('tasks-filter-category');
    const priorityFilter = document.getElementById('tasks-filter-priority');
    const statusFilter = document.getElementById('tasks-filter-status');
    const sortFilter = document.getElementById('tasks-sort-by');

    const updateFilters = () => {
      store.setState({
        searchQuery: searchInput ? searchInput.value : '',
        filterCategory: catFilter ? catFilter.value : 'all',
        filterPriority: priorityFilter ? priorityFilter.value : 'all',
        filterStatus: statusFilter ? statusFilter.value : 'all',
        sortField: sortFilter ? sortFilter.value : 'time'
      });
    };

    if (searchInput) searchInput.addEventListener('input', updateFilters);
    if (catFilter) catFilter.addEventListener('change', updateFilters);
    if (priorityFilter) priorityFilter.addEventListener('change', updateFilters);
    if (statusFilter) statusFilter.addEventListener('change', updateFilters);
    if (sortFilter) sortFilter.addEventListener('change', updateFilters);
  },

  /**
   * Switch active view
   */
  navigateTo(viewId) {
    const validViews = ['dashboard', 'schedule', 'tasks', 'eod', 'goals', 'analytics', 'settings'];
    if (!validViews.includes(viewId)) viewId = 'dashboard';

    // Update active nav links
    document.querySelectorAll('.nav-item').forEach(item => {
      const target = item.querySelector('button')?.getAttribute('data-view-target');
      if (target === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active');
    });
    const targetSection = document.getElementById(`view-${viewId}`);
    if (targetSection) targetSection.classList.add('active');

    // Update page heading
    const headings = {
      dashboard: 'Dashboard',
      schedule: 'Daily Schedule',
      tasks: 'All Tasks',
      eod: 'End-of-Day Review',
      goals: 'Monthly Goals',
      analytics: 'Productivity Analytics',
      settings: 'Settings'
    };
    const titleEl = document.getElementById('current-view-title');
    if (titleEl) titleEl.textContent = headings[viewId] || 'TrackFlow';

    store.setState({ activeView: viewId });
    // Account email + logout are intentionally shown only on Dashboard and Settings.
    if (typeof FirebaseAuthService !== 'undefined' && FirebaseAuthService.syncAccountVisibility) {
      FirebaseAuthService.syncAccountVisibility(viewId);
    }
  },

  /**
   * Update sync indicator status pill
   */
  updateSyncBadge(state) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    if (!dot || !text) return;

    dot.className = `status-dot ${state.syncStatus}`;
    const labels = LanguageManager?.current?.() === 'ta'
      ? { synced: 'ஒத்திசைக்கப்பட்டது', saving: 'ஒத்திசைக்கிறது', offline: 'இணையமில்லை', error: 'பிழை', local: 'உள்ளூர்' }
      : { synced: 'Synced', saving: 'Syncing', offline: 'Offline', error: 'Error', local: 'Local' };
    text.textContent = labels[state.syncStatus] || (LanguageManager?.current?.() === 'ta' ? 'தயார்' : 'Ready');
  },

  /**
   * Master Render Router
   */
  render() {
    const state = store.getState();
    switch (state.activeView) {
      case 'dashboard':
        this.renderDashboard(state);
        break;
      case 'schedule':
        this.renderSchedule(state);
        break;
      case 'tasks':
        this.renderTasks(state);
        break;
      case 'eod':
        this.renderEod(state);
        break;
      case 'goals':
        this.renderGoals(state);
        break;
      case 'analytics':
        this.renderAnalytics(state);
        break;
      case 'settings':
        this.renderSettings(state);
        break;
    }
    if (typeof LanguageManager !== 'undefined') LanguageManager.translatePage();
  },

  // ==========================================================================
  // DASHBOARD RENDERER
  // ==========================================================================
  renderDashboard(state) {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    const today = state.activeDate;
    const threshold = Number(state.settings.successThreshold) || 80;
    const scoreData = ScoringEngine.calculateDailyScore(state.tasks, today, threshold);
    const streakData = StreakCalculator.calculateConsistency(state.tasks, state.reports, today, {
      threshold
    });

    const nextReminder = ReminderService.getNextScheduledReminder();

    // Check overdue tasks (scheduled earlier today, still pending)
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const overdueTasks = (state.tasks || []).filter(t => {
      if (t.date !== today || t.status !== 'pending' || !t.startTime) return false;
      const [h, m] = t.startTime.split(':').map(Number);
      return (h * 60 + m) < curMin;
    });

    // Mini Weekly Preview (Last 7 days scores)
    const weekCalc = AnalyticsEngine.calculateWeekly(state.tasks, state.reports, today, threshold);

    const profileName = this.getProfileName();
    const profilePhoto = this.getProfilePhoto();
    const profileInitial = (profileName || FirebaseAuthService.user?.email || 'T').trim().charAt(0).toUpperCase();

    container.innerHTML = `
      <!-- Personal profile card: reflects the profile saved in Settings -->
      <section class="tf-dashboard-profile card" aria-label="Your profile">
        <div class="tf-dashboard-avatar" aria-hidden="true">
          ${profilePhoto ? `<img src="${this.escape(profilePhoto)}" alt="">` : `<span>${this.escape(profileInitial)}</span>`}
        </div>
        <div class="tf-dashboard-profile-copy">
          <p class="tf-dashboard-profile-kicker">${LanguageManager?.current?.() === 'ta' ? 'உங்கள் தனிப்பட்ட பணியிடம்' : 'YOUR PERSONAL WORKSPACE'}</p>
          <h2>${this.escape(profileName || (LanguageManager?.current?.() === 'ta' ? 'மீண்டும் வரவேற்கிறோம்' : 'Welcome back'))}</h2>
          <p>${this.escape(FirebaseAuthService.user?.email || '')}</p>
        </div>
        <button type="button" class="btn btn-secondary tf-dashboard-profile-edit" data-view-target="settings">${LanguageManager?.current?.() === 'ta' ? 'சுயவிவரத்தைத் திருத்து' : 'Edit profile'}</button>
      </section>

      <!-- Hero Productivity Score Card -->
      <div class="score-hero-card">
        <div class="score-hero-details">
          <h2>Today's Productivity Score</h2>
          <p>
            ${scoreData.earnedPoints} of ${scoreData.plannedPoints} planned points earned 
            (${scoreData.completedTasks}/${scoreData.totalTasks} tasks completed)
          </p>
          <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem;">
            <span class="badge ${scoreData.isSuccessful ? 'badge-priority-medium' : 'badge-category'}">
              Status: ${scoreData.statusText}
            </span>
            <span class="badge badge-points">
              Success Target: ${threshold}%
            </span>
          </div>
        </div>
        <div class="score-badge-circle">
          <div class="score-val">${scoreData.dailyScore}</div>
          <div class="score-max">/ 100 PTS</div>
        </div>
      </div>

      <!-- Next Reminder & Overdue Alerts -->
      ${nextReminder ? `
        <div class="upcoming-alert-banner">
          <div class="upcoming-info">
            <span style="font-size: 1.25rem;">⏰</span>
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">Next Scheduled: ${this.escape(nextReminder.task.title)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${this.escape(nextReminder.label)} • Category: ${this.escape(nextReminder.task.category || 'General')}</div>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="App.handleToggleTaskStatus('${nextReminder.task.taskId}', 'completed')">
            Mark Done
          </button>
        </div>
      ` : ''}

      ${overdueTasks.length > 0 ? `
        <div class="upcoming-alert-banner" style="border-color: var(--accent-danger); border-left-color: var(--accent-danger);">
          <div class="upcoming-info">
            <span style="font-size: 1.25rem;">⚠️</span>
            <div>
              <div style="font-weight: 600; font-size: 0.95rem; color: var(--accent-danger);">${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Tasks scheduled earlier today still marked as pending.</div>
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="App.navigateTo('tasks')">Review Tasks</button>
        </div>
      ` : ''}

      <!-- Top Summary Metrics Grid -->
      <div class="grid-4" style="margin-bottom: 1.5rem;">
        <div class="card stat-card">
          <div class="stat-label">Planned Tasks</div>
          <div class="stat-value" style="color: var(--accent-primary);">${scoreData.totalTasks}</div>
          <div class="stat-sub">${scoreData.plannedPoints} Total Points</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Completed</div>
          <div class="stat-value" style="color: var(--accent-success);">${scoreData.completedTasks}</div>
          <div class="stat-sub">${scoreData.completionPercentage}% Rate</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Pending / Remaining</div>
          <div class="stat-value" style="color: var(--accent-warning);">${scoreData.pendingTasks}</div>
          <div class="stat-sub">${scoreData.plannedPoints - scoreData.earnedPoints} pts remaining</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Consistency Streak</div>
          <div class="stat-value" style="color: #f59e0b;">🔥 ${streakData.currentStreak} <span style="font-size: 0.9rem; font-weight: normal;">days</span></div>
          <div class="stat-sub">Best Streak: ${streakData.bestStreak} days (${streakData.consistencyPercentage}% consistency)</div>
        </div>
      </div>

      <!-- Dashboard Split: Today's Tasks & Weekly Trend -->
      <div class="grid-2">
        <!-- Today's Tasks Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <span>📅</span> Today's Schedule (${today})
            </h3>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-sm btn-secondary" onclick="App.handleAutoBalancePoints('${today}')" title="Distribute 100 points equally across today's tasks">⚖️ Balance 100 Pts</button>
              <button class="btn btn-sm btn-primary" onclick="App.openTaskModal()">+ Add Task</button>
            </div>
          </div>

          <div id="dashboard-task-list" class="task-list">
            ${this.renderTaskListHtml(state.tasks.filter(t => t.date === today))}
          </div>
        </div>

        <!-- Weekly Performance & Quick Actions -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <span>📈</span> Weekly Productivity Trend
              </h3>
              <button class="btn btn-sm btn-secondary" onclick="App.navigateTo('analytics')">Full Analytics</button>
            </div>
            <div style="height: 180px; position: relative;">
              <canvas id="mini-week-chart"></canvas>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <span>⚡</span> Quick Actions
              </h3>
            </div>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button class="btn btn-secondary" onclick="App.openTaskModal()">
                <span>➕</span> New Task (N)
              </button>
              <button class="btn btn-secondary" onclick="App.navigateTo('eod')">
                <span>📝</span> Open EOD Review
              </button>
              <button class="btn btn-secondary" onclick="App.navigateTo('goals')">
                <span>🎯</span> View Monthly Goals
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render mini weekly line chart
    setTimeout(() => {
      const canvas = document.getElementById('mini-week-chart');
      if (canvas && typeof Chart !== 'undefined') {
        AnalyticsEngine.destroyChart('mini-week-chart');
        AnalyticsEngine.charts['mini-week-chart'] = new Chart(canvas, {
          type: 'line',
          data: {
            labels: weekCalc.current.dailyBreakdown.map(d => d.dayName),
            datasets: [{
              data: weekCalc.current.dailyBreakdown.map(d => d.score),
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              fill: true,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: weekCalc.current.dailyBreakdown.map(d => d.score >= threshold ? '#10b981' : '#0284c7')
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { min: 0, max: 100, display: false },
              x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
    }, 50);
  },

  // ==========================================================================
  // MY SCHEDULE RENDERER (Timeline Grid)
  // ==========================================================================
  renderSchedule(state) {
    const container = document.getElementById('view-schedule');
    if (!container) return;

    const today = state.activeDate;
    const dayTasks = state.tasks.filter(t => t.date === today);

    // Timeline from 06:00 to 23:00
    let hoursHtml = '';
    for (let h = 6; h <= 23; h++) {
      const hourStr = String(h).padStart(2, '0') + ':00';
      const nextHourStr = String(h + 1).padStart(2, '0') + ':00';

      // Find tasks falling in this hour window
      const slotTasks = dayTasks.filter(t => {
        if (!t.startTime) return false;
        const [th] = t.startTime.split(':').map(Number);
        return th === h;
      });

      hoursHtml += `
        <div class="timeline-hour-row">
          <div class="timeline-time-label">${hourStr}</div>
          <div class="timeline-slot-content">
            ${slotTasks.length > 0 ? slotTasks.map(t => {
              const conflict = TaskManager.checkOverlap(t, dayTasks);
              return `
                <div class="schedule-pill ${conflict ? 'conflict' : ''}" 
                     role="button" 
                     tabindex="0" 
                     aria-label="Scheduled task ${this.escape(t.title)} from ${t.startTime} to ${t.endTime || ''}. Category: ${this.escape(t.category)}. Click or press enter to edit."
                     onclick="App.openTaskModal('${t.taskId}')"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.openTaskModal('${t.taskId}');}">
                  <div>
                    <strong>${this.escape(t.title)}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                      ${t.startTime} - ${t.endTime || ''} • ${this.escape(t.category)} • ${t.plannedPoints} pts
                      ${conflict ? '<span style="color: var(--accent-danger); font-weight: bold;">(Overlap!)</span>' : ''}
                    </div>
                  </div>
                  <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}" 
                       role="checkbox"
                       tabindex="0"
                       aria-checked="${t.status === 'completed'}"
                       aria-label="Mark task ${this.escape(t.title)} as ${t.status === 'completed' ? 'pending' : 'completed'}"
                       onclick="event.stopPropagation(); App.handleToggleTaskStatus('${t.taskId}')"
                       onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();event.preventDefault();App.handleToggleTaskStatus('${t.taskId}');}"></div>
                </div>
              `;
            }).join('') : `
              <div style="color: var(--text-muted); font-size: 0.775rem; padding: 0.2rem 0; opacity: 0.5;">
                No tasks scheduled
              </div>
            `}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header">
          <div>
            <h3 class="card-title">Schedule for ${today}</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">Interactive hourly timeblocks with automatic overlap detection.</p>
          </div>
          <button class="btn btn-primary" onclick="App.openTaskModal()">+ Add Timeblock</button>
        </div>
        <div class="schedule-container">
          ${hoursHtml}
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // ALL TASKS RENDERER (Filters, Search, Sort)
  // ==========================================================================
  renderTasks(state) {
    const container = document.getElementById('view-tasks-list-container');
    if (!container) return;

    const filtered = TaskManager.filter(state.tasks, {
      category: state.filterCategory,
      priority: state.filterPriority,
      status: state.filterStatus,
      search: state.searchQuery
    });

    const sorted = TaskManager.sort(filtered, state.sortField);

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No tasks found</div>
          <p>No tasks match the selected filters or search query.</p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="App.openTaskModal()">Create New Task</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.renderTaskListHtml(sorted, true);
  },

  // ==========================================================================
  // END-OF-DAY REVIEW RENDERER
  // ==========================================================================
  renderEod(state) {
    const container = document.getElementById('view-eod');
    if (!container) return;

    const today = state.activeDate;
    const reviewData = EodService.getReviewData(today);

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Evening Review & Reflection</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">Review today's achievements, evaluate incomplete tasks, and prepare for tomorrow.</p>
            </div>
            <span class="badge ${reviewData.isSubmitted ? 'badge-priority-medium' : 'badge-category'}">
              ${reviewData.isSubmitted ? '✓ Submitted for ' + today : 'Review Pending'}
            </span>
          </div>

          <!-- Score Banner -->
          <div class="score-hero-card" style="margin-bottom: 1.5rem;">
            <div>
              <h3>Daily Productivity Score: ${reviewData.scoreData.dailyScore}%</h3>
              <p>${reviewData.scoreData.earnedPoints} of ${reviewData.scoreData.plannedPoints} points earned</p>
            </div>
            <div style="font-size: 1.25rem; font-weight: bold; color: ${reviewData.scoreData.isSuccessful ? 'var(--accent-success)' : 'var(--accent-warning)'}">
              ${reviewData.scoreData.isSuccessful ? '★ Successful Day' : 'Goal Unfinished'}
            </div>
          </div>

          <!-- Tasks Checklist for Today -->
          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Today's Task Statuses</h4>
          <div class="task-list" style="margin-bottom: 1.5rem;">
            ${reviewData.dayTasks.length > 0 ? reviewData.dayTasks.map(t => `
              <div class="task-item ${t.status === 'completed' ? 'completed' : ''}">
                <div class="task-left">
                  <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}" 
                       onclick="App.handleToggleTaskStatus('${t.taskId}')"></div>
                  <div>
                    <div class="task-title">${this.escape(t.title)}</div>
                    <div class="task-details">
                      <span>${t.startTime || ''}</span>
                      <span class="badge badge-points">${t.plannedPoints} pts</span>
                      <span class="badge badge-category">${t.category}</span>
                    </div>
                  </div>
                </div>
                <select class="form-control" style="width: 140px; font-size: 0.8rem; padding: 0.3rem;"
                        onchange="App.handleUpdateTaskStatusSelect('${t.taskId}', this.value)">
                  <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="missed" ${t.status === 'missed' ? 'selected' : ''}>Missed</option>
                  <option value="rescheduled" ${t.status === 'rescheduled' ? 'selected' : ''}>Rescheduled</option>
                </select>
              </div>
            `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">No tasks were scheduled for this date.</p>'}
          </div>

          <!-- Reflection Form -->
          <form id="eod-review-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div class="form-group">
              <label class="form-label">Important Accomplishments & Wins</label>
              <textarea id="eod-accomplishments" class="form-control" rows="3" placeholder="What went well today? What key milestones did you hit?">${this.escape(reviewData.accomplishments)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Challenges & Blockers</label>
              <textarea id="eod-challenges" class="form-control" rows="2" placeholder="What distractions, bugs, or friction points arose?">${this.escape(reviewData.challenges)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Top 3 Priorities for Tomorrow</label>
              <textarea id="eod-tomorrow" class="form-control" rows="3" placeholder="1. Complete authentication module&#10;2. Practice 2 dynamic programming problems&#10;3. 30-minute cardio">${this.escape(reviewData.tomorrowPriorities)}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
              <button type="submit" class="btn btn-primary">
                ${reviewData.isSubmitted ? 'Update EOD Report' : 'Submit & Save Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Re-bind form submission handler
    const form = document.getElementById('eod-review-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleEodSubmit(e));
    }
  },

  // ==========================================================================
  // MONTHLY GOALS RENDERER
  // ==========================================================================
  renderGoals(state) {
    const container = document.getElementById('view-goals');
    if (!container) return;

    const monthKey = state.activeMonth;
    const goals = GoalsService.getGoalsForMonth(monthKey);

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <div>
            <h3 class="card-title">Monthly Goals (${monthKey})</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">
              Goals are completely isolated per month. Track targets, hours, and practice sessions.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <input type="month" class="form-control" style="width: 170px;" value="${monthKey}"
                   onchange="store.setState({ activeMonth: this.value })">
            <button class="btn btn-primary" onclick="App.openGoalModal()">+ New Goal</button>
          </div>
        </div>

        <div class="grid-3" style="margin-top: 1rem;">
          ${goals.length > 0 ? goals.map(g => {
            const prog = GoalsService.calculateProgress(g);
            return `
              <div class="card" style="background-color: var(--bg-surface); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                  <h4 style="font-size: 1rem; font-weight: 600;">${this.escape(g.title)}</h4>
                  <button class="btn-icon" onclick="App.handleDeleteGoal('${g.goalId}')" title="Delete Goal">✕</button>
                </div>
                <p style="font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1rem;">
                  ${this.escape(g.description || 'No description')}
                </p>

                <!-- Progress Bar -->
                <div style="background: var(--bg-card); height: 10px; border-radius: var(--radius-full); overflow: hidden; margin-bottom: 0.5rem;">
                  <div style="width: ${prog.percentage}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #10b981); transition: width 0.3s ease;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
                  <span>${prog.current} / ${prog.target} ${this.escape(g.unit || '')}</span>
                  <span style="font-weight: 600; color: var(--text-main);">${prog.percentage}%</span>
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                  <button class="btn btn-sm btn-secondary" onclick="App.handleAutoSyncGoal('${g.goalId}')" title="Calculate progress automatically from completed tasks in this category">
                    🔄 Auto-Sync
                  </button>
                  <button class="btn btn-sm btn-primary" onclick="App.handleIncrementGoal('${g.goalId}')">
                    +1 ${this.escape(g.unit || '')}
                  </button>
                </div>
              </div>
            `;
          }).join('') : `
            <div class="empty-state" style="grid-column: 1 / -1;">
              <div class="empty-state-icon">🎯</div>
              <div class="empty-state-title">No Goals Set for ${monthKey}</div>
              <p>Set specific monthly targets to maintain high-leverage focus.</p>
              <button class="btn btn-primary" style="margin-top: 1rem;" onclick="App.openGoalModal()">+ Create Goal for ${monthKey}</button>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // ANALYTICS RENDERER (Weekly & Monthly + Heatmap)
  // ==========================================================================
  renderAnalytics(state) {
    const container = document.getElementById('view-analytics');
    if (!container) return;

    const today = state.activeDate;
    const monthKey = state.activeMonth;
    const threshold = Number(state.settings.successThreshold) || 80;

    const weekly = AnalyticsEngine.calculateWeekly(state.tasks, state.reports, today, threshold);
    const monthly = AnalyticsEngine.calculateMonthly(state.tasks, state.reports, monthKey, threshold);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <!-- Weekly Analytics Section -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Weekly Performance Analytics</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">
                Week of ${weekly.weekDays[0]} to ${weekly.weekDays[6]}
              </p>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <span class="badge badge-points">Average Score: ${weekly.current.avgScore}%</span>
              <span class="badge badge-category">Consistency: ${weekly.current.consistency}%</span>
            </div>
          </div>

          <div class="grid-2" style="margin-top: 1rem;">
            <div>
              <h4 style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Daily Score (%)</h4>
              <div style="height: 220px; position: relative;">
                <canvas id="chart-weekly-score"></canvas>
              </div>
            </div>
            <div>
              <h4 style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Completed vs Planned Tasks</h4>
              <div style="height: 220px; position: relative;">
                <canvas id="chart-weekly-tasks"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly Analytics & Heatmap Section -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Monthly Progress & Calendar Heatmap</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">
                Daily performance intensity across ${monthKey}
              </p>
            </div>
            <input type="month" class="form-control" style="width: 170px;" value="${monthKey}"
                   onchange="store.setState({ activeMonth: this.value })">
          </div>

          <!-- Monthly Metrics Summary Grid -->
          <div class="grid-4" style="margin: 1rem 0;">
            <div class="card stat-card" style="background: var(--bg-surface);">
              <div class="stat-label">Monthly Average Score</div>
              <div class="stat-value" style="color: var(--accent-primary);">${monthly.avgScore}%</div>
              <div class="stat-sub">${monthly.daysWithPlan} active days</div>
            </div>
            <div class="card stat-card" style="background: var(--bg-surface);">
              <div class="stat-label">Tasks Completed</div>
              <div class="stat-value" style="color: var(--accent-success);">${monthly.totalCompleted}</div>
              <div class="stat-sub">of ${monthly.totalPlanned} planned</div>
            </div>
            <div class="card stat-card" style="background: var(--bg-surface);">
              <div class="stat-label">Successful Days (≥${threshold}%)</div>
              <div class="stat-value" style="color: #10b981;">${monthly.successfulDays}</div>
              <div class="stat-sub">${monthly.consistency}% consistency</div>
            </div>
            <div class="card stat-card" style="background: var(--bg-surface);">
              <div class="stat-label">EOD Review Rate</div>
              <div class="stat-value" style="color: #8b5cf6;">${monthly.eodRate}%</div>
              <div class="stat-sub">${monthly.eodCount} reviews submitted</div>
            </div>
          </div>

          <!-- GitHub-Style Calendar Heatmap -->
          <div class="heatmap-container" style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size: 0.9rem; font-weight: 600;">Activity Heatmap Grid</h4>
              <div class="heatmap-legend">
                <span>Less</span>
                <div class="legend-box level-0" style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color);"></div>
                <div class="legend-box level-1" style="background-color: rgba(245, 158, 11, 0.35);"></div>
                <div class="legend-box level-2" style="background-color: rgba(56, 189, 248, 0.45);"></div>
                <div class="legend-box level-3" style="background-color: rgba(16, 185, 129, 0.65);"></div>
                <span>More</span>
              </div>
            </div>

            <div class="heatmap-grid">
              <div class="heatmap-day-header">Sun</div>
              <div class="heatmap-day-header">Mon</div>
              <div class="heatmap-day-header">Tue</div>
              <div class="heatmap-day-header">Wed</div>
              <div class="heatmap-day-header">Thu</div>
              <div class="heatmap-day-header">Fri</div>
              <div class="heatmap-day-header">Sat</div>

              <!-- Pad cells for first day of month -->
              ${this.renderHeatmapPadding(monthly.heatmapData[0].dayOfWeek)}

              <!-- Month Day Cells -->
              ${monthly.heatmapData.map(d => `
                <div class="heatmap-cell level-${d.level}" 
                     role="button"
                     tabindex="0"
                     aria-label="${d.date}: Score ${d.score}%, ${d.completedTasks} of ${d.plannedTasks} tasks completed${d.hasReport ? ', EOD review submitted' : ''}. Press enter to open dashboard for this day."
                     title="${d.date}: Score ${d.score}% (${d.completedTasks}/${d.plannedTasks} tasks, ${d.hasReport ? 'EOD Done' : 'No EOD'})"
                     onclick="store.setState({ activeDate: '${d.date}' }); App.navigateTo('dashboard');"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();store.setState({ activeDate: '${d.date}' }); App.navigateTo('dashboard');}">
                  <span>${d.dayNumber}</span>
                  ${d.score > 0 ? `<span style="font-size: 0.65rem; opacity: 0.85;">${d.score}%</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Category Doughnut Chart -->
          <div style="margin-top: 1.5rem;">
            <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem;">Effort Breakdown by Category</h4>
            <div style="height: 240px; position: relative;">
              <canvas id="chart-monthly-categories"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render charts
    setTimeout(() => {
      AnalyticsEngine.renderWeeklyCharts('chart-weekly-score', 'chart-weekly-tasks', weekly);
      AnalyticsEngine.renderCategoryChart('chart-monthly-categories', monthly.categoryCounts);
    }, 50);
  },

  renderHeatmapPadding(firstDayOfWeek) {
    let pad = '';
    for (let i = 0; i < firstDayOfWeek; i++) {
      pad += `<div style="aspect-ratio: 1; opacity: 0;"></div>`;
    }
    return pad;
  },

  // ==========================================================================
  // SETTINGS RENDERER
  // ==========================================================================
  renderSettings(state) {
    const container = document.getElementById('view-settings');
    if (!container) return;

    const s = state.settings || CONFIG.DEFAULT_SETTINGS;
    const gasUrl = ApiService.getGasUrl();
    const token = ApiService.getAuthToken();
    const notifPermission = ReminderService.getPermission();

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Profile Settings -->
        <section class="card">
          <div class="card-header"><div><h3 class="card-title">Profile Settings</h3><p style="font-size:.85rem;color:var(--text-secondary);">Manage your name, profile photo and account password.</p></div></div>
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
            <img id="profile-photo-preview" alt="Profile photo" src="${this.getProfilePhoto()}" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:2px solid var(--border-color);${this.getProfilePhoto() ? '' : 'display:none;'}">
            <div style="display:flex;flex-direction:column;gap:.5rem;">
              <label class="form-label" for="profile-photo-input">Profile photo</label>
              <input type="file" id="profile-photo-input" class="form-control" accept="image/png,image/jpeg,image/webp" style="max-width:320px;">
              <small style="color:var(--text-muted);">PNG, JPG or WebP. Stored for this account on this device.</small>
            </div>
          </div>
          <div class="form-group"><label class="form-label" for="profile-display-name">Your name</label><input id="profile-display-name" class="form-control" maxlength="80" placeholder="Enter your name" value="${this.escape(FirebaseAuthService.user?.displayName || localStorage.getItem('trackflow_profile_name_' + (FirebaseAuthService.user?.uid || '')) || '')}"></div>
          <button type="button" id="btn-save-profile" class="btn btn-primary" style="margin-top:.75rem;">Save Profile</button>
          <div style="border-top:1px solid var(--border-color);margin:1.25rem 0;"></div>
          <h4 style="margin:0 0 .75rem;">Change password</h4>
          <form id="change-password-form" style="display:flex;flex-direction:column;gap:.85rem;">
            <div class="form-group"><label class="form-label" for="profile-current-password">Current password</label><input id="profile-current-password" type="password" class="form-control" autocomplete="current-password" required minlength="8"></div>
            <div class="form-row"><div class="form-group"><label class="form-label" for="profile-new-password">New password</label><input id="profile-new-password" type="password" class="form-control" autocomplete="new-password" required minlength="8"></div><div class="form-group"><label class="form-label" for="profile-confirm-password">Confirm new password</label><input id="profile-confirm-password" type="password" class="form-control" autocomplete="new-password" required minlength="8"></div></div>
            <button type="submit" class="btn btn-secondary" style="align-self:flex-start;">Update Password</button>
          </form>
        </section>

        <!-- Productivity & Scoring Configuration -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Productivity & Scoring Settings</h3>
          </div>

          <form id="settings-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Successful Day Threshold (%)</label>
                <input type="number" name="successThreshold" class="form-control" min="50" max="100" 
                       value="${s.successThreshold || 80}">
                <span style="font-size: 0.75rem; color: var(--text-muted);">Default: 80% daily score</span>
              </div>
              <div class="form-group">
                <label class="form-label">Scoring Mode</label>
                <select name="scoringMode" class="form-control">
                  <option value="weighted" ${s.scoringMode === 'weighted' ? 'selected' : ''}>Weighted Points (Custom points per task)</option>
                  <option value="equal" ${s.scoringMode === 'equal' ? 'selected' : ''}>Equal Points (Auto-divided to 100)</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Daily Review Time</label>
                <input type="time" name="dailyReviewTime" class="form-control" 
                       value="${s.dailyReviewTime || '21:00'}">
                <span style="font-size: 0.75rem; color: var(--text-muted);">Default: 9:00 PM (21:00)</span>
              </div>
              <div class="form-group">
                <label class="form-label">Timezone</label>
                <input type="text" name="timezone" class="form-control" 
                       value="${s.timezone || 'Asia/Kolkata'}">
              </div>
            </div>

            <!-- Notifications & Quiet Hours -->
            <h4 style="font-size: 0.95rem; font-weight: 600; margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
              Notifications & Quiet Hours
            </h4>

            <label style="display:flex;align-items:center;gap:.65rem;padding:.75rem 0;cursor:pointer;">
              <input type="checkbox" name="notificationsEnabled" value="true" ${s.notificationsEnabled !== false ? 'checked' : ''}>
              <span><strong>Enable notifications</strong><small style="display:block;color:var(--text-muted);">Turn task reminders and productivity notifications on or off.</small></span>
            </label>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Quiet Hours Start</label>
                <input type="time" name="quietHoursStart" class="form-control" 
                       value="${s.quietHoursStart || '23:00'}">
              </div>
              <div class="form-group">
                <label class="form-label">Quiet Hours End</label>
                <input type="time" name="quietHoursEnd" class="form-control" 
                       value="${s.quietHoursEnd || '07:00'}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Default Task Lead Time</label>
                <select name="defaultLeadMinutes" class="form-control">
                  <option value="5" ${s.defaultLeadMinutes == 5 ? 'selected' : ''}>5 minutes before</option>
                  <option value="10" ${s.defaultLeadMinutes == 10 ? 'selected' : ''}>10 minutes before</option>
                  <option value="15" ${s.defaultLeadMinutes == 15 ? 'selected' : ''}>15 minutes before</option>
                  <option value="30" ${s.defaultLeadMinutes == 30 ? 'selected' : ''}>30 minutes before</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Language</label>
                <select id="settings-language" name="language" class="form-control" onchange="LanguageManager.setLanguage(this.value)">
                  <option value="en" ${LanguageManager.current() === 'en' ? 'selected' : ''}>English</option>
                  <option value="ta" ${LanguageManager.current() === 'ta' ? 'selected' : ''}>Tamil</option>
                </select>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Choose the language used throughout TrackFlow.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Theme</label>
                <select name="theme" class="form-control" onchange="SettingsManager.applyTheme(this.value)">
                  <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark Mode</option>
                  <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light Mode</option>
                  <option value="system" ${s.theme === 'system' ? 'selected' : ''}>System Default</option>
                </select>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem;">
              <div>
                <button type="button" id="btn-test-notification" class="btn btn-secondary">
                  🔔 Test Notification (${notifPermission})
                </button>
              </div>
              <button type="submit" class="btn btn-primary">Save Settings</button>
            </div>
          </form>
        </div>

        <!-- Data Management & Backups Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Data Management & Backup</h3>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="btn-export-data" class="btn btn-secondary">
              📊 Export All Data (Excel)
            </button>
            <button type="button" id="btn-reset-demo" class="btn btn-danger">
              ⚠️ Reset Local Cache to Demo
            </button>
          </div>
        </div>

      </div>
    `;

    // Re-bind listeners for freshly rendered settings DOM
    const profilePhoto = document.getElementById('profile-photo-input');
    if (profilePhoto) profilePhoto.addEventListener('change', e => this.handleProfilePhotoChange(e));
    const saveProfile = document.getElementById('btn-save-profile');
    if (saveProfile) saveProfile.addEventListener('click', () => this.handleSaveProfile());
    const passwordForm = document.getElementById('change-password-form');
    if (passwordForm) passwordForm.addEventListener('submit', e => this.handleChangePassword(e));
    const exportButton = document.getElementById('btn-export-data');
    if (exportButton) exportButton.addEventListener('click', () => SettingsManager.exportExcel());

    const btnNotif = document.getElementById('btn-test-notification');
    if (btnNotif) {
      btnNotif.addEventListener('click', async () => {
        const res = await ReminderService.sendTestNotification();
        if (res.success) showToast('Test notification sent!', 'success');
        else showToast(res.message || 'Notification error', 'error');
      });
    }

    const form = document.getElementById('settings-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSettingsSubmit(e));
    }
  },

  // ==========================================================================
  // TASK ACTIONS & MODAL CONTROLS
  // ==========================================================================

  renderTaskListHtml(tasks, showFullMeta = false) {
    if (!tasks || tasks.length === 0) {
      return `
        <div class="empty-state" style="padding: 1.5rem 0;">
          <p style="color: var(--text-muted); font-size: 0.9rem;">No tasks scheduled yet.</p>
        </div>
      `;
    }

    return tasks.map(t => `
      <div class="task-item ${t.status === 'completed' ? 'completed' : ''}" id="task-item-${t.taskId}">
        <div class="task-left">
          <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}" 
               role="checkbox"
               tabindex="0"
               aria-checked="${t.status === 'completed'}"
               aria-label="Mark task ${this.escape(t.title)} as ${t.status === 'completed' ? 'pending' : 'completed'}"
               onclick="App.handleToggleTaskStatus('${t.taskId}')" 
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.handleToggleTaskStatus('${t.taskId}');}"
               title="${t.status === 'completed' ? 'Mark Pending' : 'Mark Completed'}"></div>
          <div class="task-meta-group">
            <div class="task-title" title="${this.escape(t.title)}">${this.escape(t.title)}</div>
            <div class="task-details">
              <span>${t.startTime || 'No time'} ${t.endTime ? '- ' + t.endTime : ''}</span>
              <span class="badge badge-points">${t.plannedPoints} pts</span>
              <span class="badge badge-category">${this.escape(t.category || 'General')}</span>
              <span class="badge badge-priority-${t.priority || 'medium'}">${t.priority}</span>
              ${showFullMeta && t.date ? `<span style="color: var(--text-muted);">📅 ${t.date}</span>` : ''}
              ${t.status === 'missed' ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">Missed</span>' : ''}
              ${t.status === 'rescheduled' ? '<span class="badge" style="background: rgba(129, 140, 248, 0.15); color: #818cf8;">Rescheduled</span>' : ''}
              ${t.notes ? `<span style="color: var(--text-muted); font-style: italic;" title="${this.escape(t.notes)}">📝 ${this.escape(t.notes)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="task-actions">
          <button class="btn-icon" onclick="App.openRescheduleModal('${t.taskId}')" title="Reschedule Task" aria-label="Reschedule task ${this.escape(t.title)}">🔄</button>
          <button class="btn-icon" onclick="App.openTaskModal('${t.taskId}')" title="Edit Task" aria-label="Edit task ${this.escape(t.title)}">✏️</button>
          <button class="btn-icon" onclick="App.handleDeleteTask('${t.taskId}')" title="Delete Task" aria-label="Delete task ${this.escape(t.title)}">🗑️</button>
        </div>
      </div>
    `).join('');
  },

  async handleToggleTaskStatus(taskId, targetStatus) {
    const tasks = store.state.tasks || [];
    const task = tasks.find(t => t.taskId === taskId);
    if (!task) return;

    const nextStatus = targetStatus || (task.status === 'completed' ? 'pending' : 'completed');

    // If completing, cancel future reminders
    if (nextStatus === 'completed') {
      ReminderService.cancelTaskReminders(taskId);
    }

    const res = await ApiService.request('POST', 'updateTaskStatus', {
      taskId,
      status: nextStatus
    });

    if (res.success) {
      showToast(nextStatus === 'completed' ? `✓ Completed: "${task.title}" (+${task.plannedPoints} pts)` : 'Task updated to pending', 'success');
    } else {
      showToast('Failed to update task status: ' + (res.error || 'Server error'), 'error');
    }
  },

  async handleUpdateTaskStatusSelect(taskId, newStatus) {
    if (newStatus === 'completed') {
      ReminderService.cancelTaskReminders(taskId);
    }
    const res = await ApiService.request('POST', 'updateTaskStatus', { taskId, status: newStatus });
    if (res.success) {
      showToast(`Task status updated to ${newStatus}`, 'success');
    }
  },

  openTaskModal(taskId = null) {
    const modal = document.getElementById('task-modal-backdrop');
    if (!modal) return;

    const titleEl = document.getElementById('task-modal-title');
    const idInput = document.getElementById('task-id');
    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-desc');
    const dateInput = document.getElementById('task-date');
    const startTimeInput = document.getElementById('task-start-time');
    const endTimeInput = document.getElementById('task-end-time');
    const catInput = document.getElementById('task-category');
    const priorityInput = document.getElementById('task-priority');
    const pointsInput = document.getElementById('task-points');
    const reminderCheck = document.getElementById('task-reminder-enabled');
    const overlapWarning = document.getElementById('task-overlap-warning');

    if (overlapWarning) overlapWarning.style.display = 'none';

    if (taskId) {
      const task = (store.state.tasks || []).find(t => t.taskId === taskId);
      if (!task) return;
      titleEl.textContent = 'Edit Task';
      idInput.value = task.taskId;
      titleInput.value = task.title;
      descInput.value = task.description || '';
      dateInput.value = task.date;
      startTimeInput.value = task.startTime || '';
      endTimeInput.value = task.endTime || '';
      catInput.value = task.category || 'Coding';
      priorityInput.value = task.priority || 'medium';
      pointsInput.value = task.plannedPoints;
      reminderCheck.checked = !!task.reminderEnabled;
    } else {
      titleEl.textContent = 'Create New Task';
      idInput.value = '';
      titleInput.value = '';
      descInput.value = '';
      dateInput.value = store.state.activeDate;
      startTimeInput.value = '10:00';
      endTimeInput.value = '11:00';
      catInput.value = 'Coding';
      priorityInput.value = 'medium';
      pointsInput.value = store.state.settings.scoringMode === 'equal' ? 20 : 25;
      reminderCheck.checked = true;
    }

    modal.classList.add('open');
    this.trapFocus(modal);
    setTimeout(() => titleInput.focus(), 50);
  },

  closeTaskModal() {
    const modal = document.getElementById('task-modal-backdrop');
    if (modal) {
      modal.classList.remove('open');
      this.releaseFocus();
    }
  },

  async handleTaskFormSubmit(e) {
    e.preventDefault();

    const idInput = document.getElementById('task-id');
    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-desc');
    const dateInput = document.getElementById('task-date');
    const startTimeInput = document.getElementById('task-start-time');
    const endTimeInput = document.getElementById('task-end-time');
    const catInput = document.getElementById('task-category');
    const priorityInput = document.getElementById('task-priority');
    const pointsInput = document.getElementById('task-points');
    const reminderCheck = document.getElementById('task-reminder-enabled');

    const existingTask = idInput.value ? (store.state.tasks || []).find(t => t.taskId === idInput.value) : null;

    const taskPayload = {
      taskId: idInput.value || undefined,
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      date: dateInput.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      category: catInput.value,
      priority: priorityInput.value,
      plannedPoints: Number(pointsInput.value) || 20,
      reminderEnabled: reminderCheck.checked,
      status: existingTask ? existingTask.status : 'pending',
      completedAt: existingTask ? (existingTask.completedAt || '') : '',
      notes: existingTask ? (existingTask.notes || '') : ''
    };

    // Client-side validation
    const validation = TaskManager.validate(taskPayload);
    if (!validation.isValid) {
      showToast(validation.errors[0], 'error');
      return;
    }

    // Check overlap
    const conflict = TaskManager.checkOverlap(taskPayload, store.state.tasks);
    if (conflict) {
      if (!confirm(`Warning: Time overlaps with "${conflict.title}" (${conflict.startTime}-${conflict.endTime}). Save anyway?`)) {
        return;
      }
    }

    this.closeTaskModal();
    const res = await ApiService.request('POST', 'saveTask', { task: taskPayload });
    if (res.success) {
      showToast('Task saved successfully', 'success');
    } else {
      showToast('Failed to save task: ' + (res.error || 'Server error'), 'error');
    }
  },

  async handleDeleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const res = await ApiService.request('POST', 'deleteTask', { taskId });
    if (res.success) {
      showToast('Task deleted', 'info');
    } else {
      showToast('Failed to delete task', 'error');
    }
  },

  // ==========================================================================
  // RESCHEDULE ACTIONS & MODAL
  // ==========================================================================
  openRescheduleModal(taskId) {
    const task = (store.state.tasks || []).find(t => t.taskId === taskId);
    if (!task) return;

    const modal = document.getElementById('reschedule-modal-backdrop');
    if (!modal) return;

    document.getElementById('reschedule-task-id').value = task.taskId;
    document.getElementById('reschedule-task-title').textContent = `Task: "${task.title}" (Currently scheduled ${task.date} at ${task.startTime || 'no time'})`;
    document.getElementById('reschedule-date').value = task.date;
    document.getElementById('reschedule-start-time').value = task.startTime || '09:00';
    document.getElementById('reschedule-end-time').value = task.endTime || '10:00';
    document.getElementById('reschedule-reason').value = '';

    modal.classList.add('open');
    this.trapFocus(modal);
    setTimeout(() => document.getElementById('reschedule-date').focus(), 50);
  },

  closeRescheduleModal() {
    const modal = document.getElementById('reschedule-modal-backdrop');
    if (modal) {
      modal.classList.remove('open');
      this.releaseFocus();
    }
  },

  async handleRescheduleSubmit(e) {
    e.preventDefault();
    const taskId = document.getElementById('reschedule-task-id').value;
    const newDate = document.getElementById('reschedule-date').value;
    const newStart = document.getElementById('reschedule-start-time').value;
    const newEnd = document.getElementById('reschedule-end-time').value;
    const reason = document.getElementById('reschedule-reason').value.trim();

    const task = (store.state.tasks || []).find(t => t.taskId === taskId);
    if (!task) return;

    const updatedTask = {
      ...task,
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
      status: 'pending',
      notes: reason ? `Rescheduled: ${reason}` : `Rescheduled from ${task.date} ${task.startTime}`
    };

    const val = TaskManager.validate(updatedTask);
    if (!val.isValid) {
      showToast(val.errors[0], 'error');
      return;
    }

    const conflict = TaskManager.checkOverlap(updatedTask, store.state.tasks);
    if (conflict) {
      if (!confirm(`Warning: Time overlaps with "${conflict.title}" on ${newDate}. Proceed?`)) {
        return;
      }
    }

    this.closeRescheduleModal();
    const res = await ApiService.request('POST', 'saveTask', { task: updatedTask });
    if (res.success) {
      showToast(`Task rescheduled to ${newDate} at ${newStart}`, 'success');
      if (newDate !== store.state.activeDate) {
        store.setState({ activeDate: newDate, activeMonth: newDate.substring(0, 7) });
      }
    } else {
      showToast('Failed to reschedule task', 'error');
    }
  },

  async handleAutoBalancePoints(targetDate) {
    const date = targetDate || store.state.activeDate;
    const dayTasks = (store.state.tasks || []).filter(t => t.date === date);

    if (dayTasks.length === 0) {
      showToast('No tasks to balance on ' + date, 'info');
      return;
    }

    const balanced = ScoringEngine.distributeEqualPoints(dayTasks, 100);
    showToast(`Balancing 100 points across ${balanced.length} tasks...`, 'info');

    for (const t of balanced) {
      await ApiService.request('POST', 'saveTask', { task: t });
    }

    showToast(`✓ 100 points distributed equally across ${balanced.length} tasks!`, 'success');
  },

  // ==========================================================================
  // GOAL ACTIONS & MODALS
  // ==========================================================================
  openGoalModal() {
    const modal = document.getElementById('goal-modal-backdrop');
    if (!modal) return;
    document.getElementById('goal-month').value = store.state.activeMonth;
    modal.classList.add('open');
    this.trapFocus(modal);
    setTimeout(() => document.getElementById('goal-title').focus(), 50);
  },

  closeGoalModal() {
    const modal = document.getElementById('goal-modal-backdrop');
    if (modal) {
      modal.classList.remove('open');
      this.releaseFocus();
    }
  },

  async handleGoalFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('goal-title').value.trim();
    const desc = document.getElementById('goal-desc').value.trim();
    const target = Number(document.getElementById('goal-target').value) || 10;
    const unit = document.getElementById('goal-unit').value.trim() || 'sessions';
    const month = document.getElementById('goal-month').value || store.state.activeMonth;

    if (!title) {
      showToast('Goal title is required', 'error');
      return;
    }

    const goal = {
      monthKey: month,
      title,
      description: desc,
      targetValue: target,
      currentValue: 0,
      unit,
      status: 'active'
    };

    this.closeGoalModal();
    const res = await GoalsService.saveGoal(goal);
    if (res.success) {
      showToast('Monthly goal created for ' + month, 'success');
    } else {
      showToast('Failed to save goal', 'error');
    }
  },

  async handleIncrementGoal(goalId) {
    const goals = store.state.goals || [];
    const g = goals.find(item => item.goalId === goalId);
    if (!g) return;

    const updated = { ...g, currentValue: Number(g.currentValue || 0) + 1 };
    await GoalsService.saveGoal(updated);
    showToast(`Progress logged: ${updated.currentValue}/${updated.targetValue} ${updated.unit}`, 'success');
  },

  async handleAutoSyncGoal(goalId) {
    const goals = store.state.goals || [];
    const g = goals.find(item => item.goalId === goalId);
    if (!g) return;

    const newVal = GoalsService.autoSyncGoal(g);
    const updated = { ...g, currentValue: newVal };
    await GoalsService.saveGoal(updated);
    showToast(`Goal auto-synced to ${newVal} ${g.unit}`, 'info');
  },

  async handleDeleteGoal(goalId) {
    if (!confirm('Delete this goal?')) return;
    const res = await GoalsService.deleteGoal(goalId);
    if (res.success) showToast('Goal removed', 'info');
  },

  // ==========================================================================
  // EOD REVIEW SUBMISSION
  // ==========================================================================
  async handleEodSubmit(e) {
    e.preventDefault();
    const date = store.state.activeDate;
    const acc = document.getElementById('eod-accomplishments')?.value || '';
    const ch = document.getElementById('eod-challenges')?.value || '';
    const tm = document.getElementById('eod-tomorrow')?.value || '';

    const res = await EodService.submitReview(date, {
      accomplishments: acc,
      challenges: ch,
      tomorrowPriorities: tm
    });

    if (res.success) {
      showToast('End-of-Day Review saved successfully!', 'success');
      this.render();
    } else {
      showToast('Failed to save EOD Review: ' + (res.error || 'Server error'), 'error');
    }
  },

  getProfileName() {
    const uid = FirebaseAuthService.user?.uid;
    if (!uid) return '';
    try { return (FirebaseAuthService.user?.displayName || localStorage.getItem('trackflow_profile_name_' + uid) || '').trim(); } catch (_) { return (FirebaseAuthService.user?.displayName || '').trim(); }
  },

  getProfilePhoto() {
    const uid = FirebaseAuthService.user?.uid;
    if (!uid) return '';
    try { return localStorage.getItem('trackflow_profile_photo_' + uid) || ''; } catch (_) { return ''; }
  },

  handleProfilePhotoChange(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { showToast('Choose a PNG, JPG or WebP image.', 'error'); event.target.value=''; return; }
    if (file.size > 1024 * 1024) { showToast('Profile photo must be 1 MB or smaller.', 'error'); event.target.value=''; return; }
    const reader = new FileReader();
    reader.onload = () => { const img = document.getElementById('profile-photo-preview'); if (img) { img.src = reader.result; img.style.display = 'block'; } this.pendingProfilePhoto = reader.result; };
    reader.onerror = () => showToast('Could not read the selected image.', 'error');
    reader.readAsDataURL(file);
  },

  async handleSaveProfile() {
    const user = FirebaseAuthService.user; if (!user) { showToast('Please sign in again.', 'error'); return; }
    const name = document.getElementById('profile-display-name')?.value.trim() || '';
    if (!name) { showToast('Enter your name before saving.', 'error'); return; }
    const btn = document.getElementById('btn-save-profile'); if (btn) btn.disabled = true;
    try {
      await user.updateProfile({ displayName: name });
      localStorage.setItem('trackflow_profile_name_' + user.uid, name);
      if (this.pendingProfilePhoto) { localStorage.setItem('trackflow_profile_photo_' + user.uid, this.pendingProfilePhoto); this.pendingProfilePhoto = null; }
      showToast('Profile saved successfully.', 'success');
      if (typeof FirebaseAuthService.showAccount === 'function') FirebaseAuthService.showAccount();
      // Keep the dashboard/header in sync immediately without a page reload.
      if (store.state.activeView === 'dashboard') this.renderDashboard(store.state);
    } catch (err) { showToast('Could not save profile: ' + (err.message || 'Please try again.'), 'error'); }
    finally { if (btn) btn.disabled = false; }
  },

  async handleChangePassword(event) {
    event.preventDefault();
    const user = FirebaseAuthService.user;
    const current = document.getElementById('profile-current-password')?.value || '';
    const next = document.getElementById('profile-new-password')?.value || '';
    const confirmNext = document.getElementById('profile-confirm-password')?.value || '';
    if (!user || !user.email) { showToast('Please sign in with an email/password account.', 'error'); return; }
    if (next.length < 8) { showToast('New password must contain at least 8 characters.', 'error'); return; }
    if (next !== confirmNext) { showToast('New password and confirmation do not match.', 'error'); return; }
    if (next === current) { showToast('Choose a password different from your current password.', 'error'); return; }
    const form = event.target, submit = form.querySelector('button[type="submit"]'); if (submit) submit.disabled = true;
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, current);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(next);
      form.reset(); showToast('Password updated successfully.', 'success');
    } catch (err) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : err.code === 'auth/weak-password' ? 'Choose a stronger password.' : (err.message || 'Please sign in again and retry.');
      showToast('Password update failed: ' + msg, 'error');
    } finally { if (submit) submit.disabled = false; }
  },

  // ==========================================================================
  // SETTINGS HANDLERS
  // ==========================================================================
  handleSaveGasConfig() {
    const url = document.getElementById('setting-gas-url')?.value.trim();
    const token = document.getElementById('setting-auth-token')?.value.trim();

    ApiService.setGasUrl(url);
    ApiService.setAuthToken(token);

    showToast('Cloud configuration saved', 'success');
    ApiService.syncAllFromCloud();
  },

  async handleTestGasConnection() {
    const url = document.getElementById('setting-gas-url')?.value.trim();
    const token = document.getElementById('setting-auth-token')?.value.trim();
    const resultBox = document.getElementById('gas-test-result');

    if (!resultBox) return;
    resultBox.style.display = 'block';
    resultBox.style.backgroundColor = 'var(--bg-card)';
    resultBox.style.color = 'var(--text-main)';
    resultBox.innerHTML = 'Testing connection to Google Apps Script...';

    const res = await SettingsManager.testConnection(url, token);
    if (res.success) {
      resultBox.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      resultBox.style.color = '#34d399';
      resultBox.innerHTML = '✓ ' + res.message;
    } else {
      resultBox.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      resultBox.style.color = '#f87171';
      resultBox.innerHTML = '✕ ' + res.message;
    }
  },

  async handleInitSpreadsheet() {
    if (!confirm('This will create and format all required sheets (Tasks, DailyReports, Goals, Settings, ActivityLog) in your active Google Spreadsheet. Proceed?')) {
      return;
    }

    showToast('Initializing spreadsheet structure on Google Sheets...', 'info');
    const res = await SettingsManager.initializeSpreadsheet();
    if (res.success) {
      showToast('Spreadsheet sheets initialized successfully!', 'success');
    } else {
      showToast('Initialization failed: ' + (res.message || 'Check Apps Script deployment'), 'error');
    }
  },

  async handleSettingsSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const settingsObj = {
      successThreshold: Number(formData.get('successThreshold')) || 80,
      scoringMode: formData.get('scoringMode') || 'weighted',
      dailyReviewTime: formData.get('dailyReviewTime') || '21:00',
      timezone: formData.get('timezone') || 'Asia/Kolkata',
      quietHoursStart: formData.get('quietHoursStart') || '23:00',
      quietHoursEnd: formData.get('quietHoursEnd') || '07:00',
      defaultLeadMinutes: Number(formData.get('defaultLeadMinutes')) || 10,
      theme: formData.get('theme') || 'dark',
      notificationsEnabled: formData.get('notificationsEnabled') === 'true'
    };

    const res = await SettingsManager.saveSettings(settingsObj);
    if (res.success) {
      showToast('Settings saved successfully', 'success');
    } else {
      showToast('Settings saved locally', 'info');
    }
  },

  lastFocusedElement: null,
  activeFocusTrapHandler: null,

  trapFocus(modalElement) {
    this.lastFocusedElement = document.activeElement;
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    if (this.activeFocusTrapHandler) {
      this.releaseFocus();
    }

    this.activeFocusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(modalElement.querySelectorAll(focusableSelectors))
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    modalElement.addEventListener('keydown', this.activeFocusTrapHandler);
  },

  releaseFocus() {
    if (this.activeFocusTrapHandler) {
      document.querySelectorAll('.modal-backdrop').forEach(m => {
        m.removeEventListener('keydown', this.activeFocusTrapHandler);
      });
      this.activeFocusTrapHandler = null;
    }
    if (this.lastFocusedElement && this.lastFocusedElement.focus) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  },

  // Helper for XSS safety
  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Start application when DOM is parsed
window.addEventListener('DOMContentLoaded', () => {
  FirebaseAuthService.start();
});
