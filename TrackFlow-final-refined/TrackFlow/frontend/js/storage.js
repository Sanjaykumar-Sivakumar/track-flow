/**
 * TrackFlow - Storage and Offline Queue Manager
 */
const StorageService = {
  // Read item from localStorage safely
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.warn(`[StorageService] Failed to read ${key}:`, e);
      return defaultValue;
    }
  },

  // Write item to localStorage safely
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[StorageService] Failed to write ${key}:`, e);
      return false;
    }
  },

  // Remove item
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`[StorageService] Failed to remove ${key}:`, e);
    }
  },

  // Enqueue a mutation for background sync
  enqueueMutation(type, data) {
    const queue = this.get(CONFIG.STORAGE_KEYS.SYNC_QUEUE, []);
    const mutation = {
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type,
      data,
      timestamp: new Date().toISOString()
    };
    queue.push(mutation);
    this.set(CONFIG.STORAGE_KEYS.SYNC_QUEUE, queue);
    store.setState({ syncQueueCount: queue.length });
    return mutation;
  },

  // Get all queued mutations
  getQueue() {
    return this.get(CONFIG.STORAGE_KEYS.SYNC_QUEUE, []);
  },

  // Remove processed mutation
  removeQueueItem(mutationId) {
    const queue = this.getQueue().filter(m => m.id !== mutationId);
    this.set(CONFIG.STORAGE_KEYS.SYNC_QUEUE, queue);
    store.setState({ syncQueueCount: queue.length });
  },

  // Clear entire queue
  clearQueue() {
    this.set(CONFIG.STORAGE_KEYS.SYNC_QUEUE, []);
    store.setState({ syncQueueCount: 0 });
  },

  // Seed default demonstration data if cache is empty
  seedInitialDataIfEmpty() {
    const existingTasks = this.get(CONFIG.STORAGE_KEYS.TASKS, null);
    if (existingTasks && existingTasks.length > 0) {
      return; // Already initialized
    }

    const today = store.state.activeDate;
    const now = new Date();
    
    // Create realistic initial tasks for today
    const demoTasks = [
      {
        taskId: 'tsk_demo_1',
        title: 'Review System Architecture & Tech Specs',
        description: 'Examine data flows, API specifications, and verify Google Sheets integration.',
        date: today,
        startTime: '09:00',
        endTime: '10:30',
        category: 'Project',
        priority: 'high',
        plannedPoints: 25,
        status: 'completed',
        reminderEnabled: true,
        reminderTime: '08:50',
        createdAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
        updatedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
        completedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
        notes: 'Completed ahead of schedule'
      },
      {
        taskId: 'tsk_demo_2',
        title: 'Algorithms & Data Structures Practice',
        description: 'Solve 2 Graph traversal and Dynamic Programming problems.',
        date: today,
        startTime: '11:00',
        endTime: '12:30',
        category: 'Coding',
        priority: 'urgent',
        plannedPoints: 30,
        status: 'completed',
        reminderEnabled: true,
        reminderTime: '10:50',
        createdAt: new Date(now.getTime() - 3 * 3600000).toISOString(),
        updatedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
        completedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
        notes: 'Optimized BFS with adjacency list'
      },
      {
        taskId: 'tsk_demo_3',
        title: 'Frontend PWA & Service Worker Implementation',
        description: 'Implement offline caching strategy, push notifications, and web manifest.',
        date: today,
        startTime: '14:00',
        endTime: '16:00',
        category: 'Project',
        priority: 'high',
        plannedPoints: 25,
        status: 'pending',
        reminderEnabled: true,
        reminderTime: '13:50',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        completedAt: '',
        notes: ''
      },
      {
        taskId: 'tsk_demo_4',
        title: 'Evening Physical Workout & Mobility',
        description: 'Cardio session followed by 15-minute mobility stretch.',
        date: today,
        startTime: '18:00',
        endTime: '19:00',
        category: 'Health',
        priority: 'medium',
        plannedPoints: 20,
        status: 'pending',
        reminderEnabled: true,
        reminderTime: '17:50',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        completedAt: '',
        notes: ''
      }
    ];

    // Seed recent reports for realistic streak and analytics
    const pastReports = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = store.formatDate(d);
      const earned = i === 3 ? 65 : (i === 5 ? 75 : (85 + (i % 3) * 5));
      const planned = 100;
      const score = Math.round((earned / planned) * 100);

      pastReports.push({
        reportId: 'rep_demo_' + i,
        date: dateStr,
        plannedPoints: planned,
        earnedPoints: earned,
        dailyScore: score,
        plannedTaskCount: 4,
        completedTaskCount: score >= 80 ? 4 : 3,
        pendingTaskCount: 0,
        missedTaskCount: score < 80 ? 1 : 0,
        successfulDay: score >= 80,
        reviewNotes: `Solid focus day. Maintained consistent rhythm.`,
        challenges: i === 3 ? 'Context switching between meetings.' : 'None',
        tomorrowPriorities: 'Complete project deliverables on time.',
        submittedAt: new Date(d.getTime() + 21 * 3600000).toISOString(),
        updatedAt: new Date(d.getTime() + 21 * 3600000).toISOString()
      });
    }

    // Seed Monthly Goals for current month
    const curMonth = today.substring(0, 7);
    const demoGoals = [
      {
        goalId: 'gol_demo_1',
        monthKey: curMonth,
        title: 'Solve 40 LeetCode / Coding Practice Problems',
        description: 'Focus on graphs, trees, and system design patterns.',
        targetValue: 40,
        currentValue: 26,
        unit: 'problems',
        startDate: curMonth + '-01',
        endDate: curMonth + '-28',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        goalId: 'gol_demo_2',
        monthKey: curMonth,
        title: 'Achieve 20 Successful Productivity Days (>=80%)',
        description: 'Maintain daily streak and high-leverage task completion.',
        targetValue: 20,
        currentValue: 14,
        unit: 'days',
        startDate: curMonth + '-01',
        endDate: curMonth + '-28',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        goalId: 'gol_demo_3',
        monthKey: curMonth,
        title: 'Ship 3 Full-Stack Project Modules',
        description: 'Complete TrackFlow cloud sync, PWA offline, and analytics visualization.',
        targetValue: 3,
        currentValue: 2,
        unit: 'modules',
        startDate: curMonth + '-01',
        endDate: curMonth + '-28',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
    ];

    this.set(CONFIG.STORAGE_KEYS.TASKS, demoTasks);
    this.set(CONFIG.STORAGE_KEYS.REPORTS, pastReports);
    this.set(CONFIG.STORAGE_KEYS.GOALS, demoGoals);
  }
};
