/**
 * TrackFlow - API Integration Layer
 * Connects frontend to Google Apps Script Web App with offline fallback and sync queue.
 */
const ApiService = {
  getGasUrl() {
    return StorageService.get(CONFIG.STORAGE_KEYS.GAS_URL, '');
  },

  setGasUrl(url) {
    StorageService.set(CONFIG.STORAGE_KEYS.GAS_URL, (url || '').trim());
  },

  getAuthToken() {
    return StorageService.get(CONFIG.STORAGE_KEYS.AUTH_TOKEN, '');
  },

  setAuthToken(token) {
    StorageService.set(CONFIG.STORAGE_KEYS.AUTH_TOKEN, (token || '').trim());
  },

  /**
   * Determine if we are operating with a connected Google Apps Script endpoint
   */
  isCloudConnected() {
    const url = this.getGasUrl();
    return !!(url && url.startsWith('https://script.google.com/macros/s/'));
  },

  /**
   * Universal Request Handler
   */
  async request(method, action, payload = {}, params = {}) {
    if (FirebaseAuthService.configured) {
      if (!FirebaseAuthService.user) throw new Error('Sign in is required.');
      const result = await FirebaseAuthService.request(method, action, payload, params);
      store.setState({ syncStatus: 'synced', syncMessage: 'Synced to your private cloud account' });
      return result;
    }
    const gasUrl = this.getGasUrl();
    const token = this.getAuthToken();

    // If cloud is not configured, fall back immediately to local mode
    if (!this.isCloudConnected()) {
      return this.handleLocalFallback(action, payload, params);
    }

    store.setState({ syncStatus: 'saving', syncMessage: 'Saving to Google Sheets...' });

    try {
      let url = gasUrl;
      const queryParams = new URLSearchParams({ action, ...params });
      if (token) queryParams.set('authToken', token);

      let options = {
        method: method,
        redirect: 'follow', // Crucial for Google Apps Script 302 redirects
        headers: {}
      };

      if (method === 'GET') {
        url += (url.includes('?') ? '&' : '?') + queryParams.toString();
      } else {
        // Apps Script doPost receives stringified JSON body
        const postBody = {
          action,
          authToken: token,
          ...payload
        };
        options.body = JSON.stringify(postBody);
        options.headers['Content-Type'] = 'text/plain;charset=utf-8'; // Prevents pre-flight CORS issues in GAS
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
      options.signal = controller.signal;

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Operation failed on server');
      }

      store.setState({ syncStatus: 'synced', syncMessage: 'Saved to Google Sheets' });
      return result;
    } catch (err) {
      console.warn('[ApiService] Cloud request failed, falling back to local storage & queueing mutation:', err);

      // If it was a mutation (POST), queue it for sync
      if (method === 'POST') {
        StorageService.enqueueMutation(action, payload);
      }

      store.setState({ 
        syncStatus: 'offline', 
        syncMessage: 'Offline: Saved locally'
      });

      return this.handleLocalFallback(action, payload, params);
    }
  },

  /**
   * Handle operation locally using StorageService
   */
  handleLocalFallback(action, payload, params) {
    const isConfigured = this.isCloudConnected();
    const status = isConfigured ? 'offline' : 'local';
    const message = isConfigured ? 'Offline: Saved locally' : 'Saved locally (Demo / Standalone)';

    switch (action) {
      case 'ping':
        return { success: true, local: true, message: 'Local storage active' };

      case 'init':
        StorageService.seedInitialDataIfEmpty();
        return { success: true, message: 'Local data structure initialized' };

      case 'getTasks': {
        let tasks = StorageService.get(CONFIG.STORAGE_KEYS.TASKS, []);
        if (tasks.length === 0) {
          StorageService.seedInitialDataIfEmpty();
          tasks = StorageService.get(CONFIG.STORAGE_KEYS.TASKS, []);
        }
        return { success: true, tasks };
      }

      case 'saveTask': {
        const task = { ...payload.task };
        const now = new Date().toISOString();
        let tasks = StorageService.get(CONFIG.STORAGE_KEYS.TASKS, []);

        if (!task.taskId) {
          task.taskId = 'tsk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
          task.createdAt = now;
          task.updatedAt = now;
          tasks.unshift(task);
        } else {
          task.updatedAt = now;
          const idx = tasks.findIndex(t => t.taskId === task.taskId);
          if (idx >= 0) {
            tasks[idx] = { ...tasks[idx], ...task };
          } else {
            tasks.unshift(task);
          }
        }

        StorageService.set(CONFIG.STORAGE_KEYS.TASKS, tasks);
        store.setState({ tasks, syncStatus: status, syncMessage: message });
        return { success: true, task, message: 'Task saved' };
      }

      case 'updateTaskStatus': {
        const { taskId, status: taskStatus, notes } = payload;
        let tasks = StorageService.get(CONFIG.STORAGE_KEYS.TASKS, []);
        const idx = tasks.findIndex(t => t.taskId === taskId);
        const now = new Date().toISOString();

        if (idx >= 0) {
          tasks[idx].status = taskStatus;
          tasks[idx].updatedAt = now;
          if (taskStatus === 'completed') {
            tasks[idx].completedAt = tasks[idx].completedAt || now;
          } else {
            tasks[idx].completedAt = '';
          }
          if (notes !== undefined) {
            tasks[idx].notes = notes;
          }
          StorageService.set(CONFIG.STORAGE_KEYS.TASKS, tasks);
          store.setState({ tasks, syncStatus: status, syncMessage: message });
          return { success: true, taskId, status: taskStatus, message: 'Status updated' };
        }
        return { success: false, error: 'Task not found' };
      }

      case 'deleteTask': {
        const { taskId } = payload;
        let tasks = StorageService.get(CONFIG.STORAGE_KEYS.TASKS, []);
        tasks = tasks.filter(t => t.taskId !== taskId);
        StorageService.set(CONFIG.STORAGE_KEYS.TASKS, tasks);
        store.setState({ tasks, syncStatus: status, syncMessage: message });
        return { success: true, message: 'Task deleted' };
      }

      case 'getDailyReports': {
        let reports = StorageService.get(CONFIG.STORAGE_KEYS.REPORTS, []);
        return { success: true, reports };
      }

      case 'saveDailyReport': {
        const report = { ...payload.report };
        const now = new Date().toISOString();
        let reports = StorageService.get(CONFIG.STORAGE_KEYS.REPORTS, []);
        const idx = reports.findIndex(r => r.date === report.date);

        if (idx >= 0) {
          report.reportId = reports[idx].reportId;
          report.submittedAt = reports[idx].submittedAt || report.submittedAt || now;
          report.updatedAt = now;
          reports[idx] = report;
        } else {
          report.reportId = report.reportId || 'rep_' + Date.now();
          report.submittedAt = now;
          report.updatedAt = now;
          reports.unshift(report);
        }

        StorageService.set(CONFIG.STORAGE_KEYS.REPORTS, reports);
        store.setState({ reports, syncStatus: status, syncMessage: message });
        return { success: true, report, message: 'Daily report saved' };
      }

      case 'getGoals': {
        let goals = StorageService.get(CONFIG.STORAGE_KEYS.GOALS, []);
        return { success: true, goals };
      }

      case 'saveGoal': {
        const goal = { ...payload.goal };
        const now = new Date().toISOString();
        let goals = StorageService.get(CONFIG.STORAGE_KEYS.GOALS, []);

        if (!goal.goalId) {
          goal.goalId = 'gol_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
          goal.createdAt = now;
          goal.updatedAt = now;
          goals.unshift(goal);
        } else {
          goal.updatedAt = now;
          const idx = goals.findIndex(g => g.goalId === goal.goalId);
          if (idx >= 0) {
            goals[idx] = { ...goals[idx], ...goal };
          } else {
            goals.unshift(goal);
          }
        }

        StorageService.set(CONFIG.STORAGE_KEYS.GOALS, goals);
        store.setState({ goals, syncStatus: status, syncMessage: message });
        return { success: true, goal, message: 'Goal saved' };
      }

      case 'deleteGoal': {
        const { goalId } = payload;
        let goals = StorageService.get(CONFIG.STORAGE_KEYS.GOALS, []);
        goals = goals.filter(g => g.goalId !== goalId);
        StorageService.set(CONFIG.STORAGE_KEYS.GOALS, goals);
        store.setState({ goals, syncStatus: status, syncMessage: message });
        return { success: true, message: 'Goal deleted' };
      }

      case 'getSettings': {
        let settings = StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, { ...CONFIG.DEFAULT_SETTINGS });
        return { success: true, settings };
      }

      case 'saveSettings': {
        const newSettings = { ...store.state.settings, ...payload.settings };
        StorageService.set(CONFIG.STORAGE_KEYS.SETTINGS, newSettings);
        store.setState({ settings: newSettings, syncStatus: status, syncMessage: message });
        return { success: true, message: 'Settings saved' };
      }

      default:
        return { success: false, error: 'Unknown action' };
    }
  },

  /**
   * Flush pending mutations in the sync queue to Google Apps Script
   */
  async flushSyncQueue() {
    if (!this.isCloudConnected()) return;

    const queue = StorageService.getQueue();
    if (queue.length === 0) return;

    store.setState({ syncStatus: 'saving', syncMessage: `Syncing ${queue.length} pending changes...` });

    try {
      const result = await this.request('POST', 'batchSync', { operations: queue });
      if (result.success) {
        StorageService.clearQueue();
        store.setState({ syncStatus: 'synced', syncMessage: 'All changes synced to Google Sheets' });
        // Refresh local store with cloud data
        await this.syncAllFromCloud();
      }
    } catch (e) {
      console.error('[ApiService] Failed to flush sync queue:', e);
      store.setState({ syncStatus: 'offline', syncMessage: 'Sync paused (Connection issue)' });
    }
  },

  /**
   * Pull latest data from Google Sheets
   */
  async syncAllFromCloud() {
    if (FirebaseAuthService.configured) {
      if (!FirebaseAuthService.user) return;
      try {
        const [a,b,c,d] = await Promise.all([this.request('GET','getTasks'),this.request('GET','getDailyReports'),this.request('GET','getGoals'),this.request('GET','getSettings')]);
        StorageService.set(CONFIG.STORAGE_KEYS.TASKS,a.tasks||[]); StorageService.set(CONFIG.STORAGE_KEYS.REPORTS,b.reports||[]); StorageService.set(CONFIG.STORAGE_KEYS.GOALS,c.goals||[]); StorageService.set(CONFIG.STORAGE_KEYS.SETTINGS,{...CONFIG.DEFAULT_SETTINGS,...(d.settings||{})});
        store.setState({tasks:a.tasks||[],reports:b.reports||[],goals:c.goals||[],settings:{...CONFIG.DEFAULT_SETTINGS,...(d.settings||{})},syncStatus:'synced',syncMessage:'Synced to your private cloud account'});
      } catch(e) { console.error('[TrackFlow] Cloud sync failed',e); store.setState({syncStatus:'offline',syncMessage:'Cloud unavailable; cloud changes not confirmed'}); }
      return;
    }
    if (!this.isCloudConnected()) {
      // Load local data
      const tasksRes = this.handleLocalFallback('getTasks', {}, {});
      const reportsRes = this.handleLocalFallback('getDailyReports', {}, {});
      const goalsRes = this.handleLocalFallback('getGoals', {}, {});
      const settingsRes = this.handleLocalFallback('getSettings', {}, {});

      store.setState({
        tasks: tasksRes.tasks || [],
        reports: reportsRes.reports || [],
        goals: goalsRes.goals || [],
        settings: settingsRes.settings || { ...CONFIG.DEFAULT_SETTINGS },
        syncStatus: 'local',
        syncMessage: 'Running in Local Mode (Connect Google Sheets in Settings)'
      });
      return;
    }

    try {
      store.setState({ syncStatus: 'saving', syncMessage: 'Fetching latest data from Google Sheets...' });
      const [tasksRes, reportsRes, goalsRes, settingsRes] = await Promise.all([
        this.request('GET', 'getTasks'),
        this.request('GET', 'getDailyReports'),
        this.request('GET', 'getGoals'),
        this.request('GET', 'getSettings')
      ]);

      if (tasksRes.tasks) {
        StorageService.set(CONFIG.STORAGE_KEYS.TASKS, tasksRes.tasks);
      }
      if (reportsRes.reports) {
        StorageService.set(CONFIG.STORAGE_KEYS.REPORTS, reportsRes.reports);
      }
      if (goalsRes.goals) {
        StorageService.set(CONFIG.STORAGE_KEYS.GOALS, goalsRes.goals);
      }
      if (settingsRes.settings && Object.keys(settingsRes.settings).length > 0) {
        const mergedSettings = { ...CONFIG.DEFAULT_SETTINGS, ...settingsRes.settings };
        StorageService.set(CONFIG.STORAGE_KEYS.SETTINGS, mergedSettings);
      }

      store.setState({
        tasks: tasksRes.tasks || [],
        reports: reportsRes.reports || [],
        goals: goalsRes.goals || [],
        settings: StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, { ...CONFIG.DEFAULT_SETTINGS }),
        syncStatus: 'synced',
        syncMessage: 'Synced with Google Sheets'
      });
    } catch (err) {
      console.warn('[ApiService] Failed to pull from cloud, using cache:', err);
      // Fallback to cached items
      const tasks = StorageService.get(CONFIG.STORAGE_KEYS.TASKS, []);
      const reports = StorageService.get(CONFIG.STORAGE_KEYS.REPORTS, []);
      const goals = StorageService.get(CONFIG.STORAGE_KEYS.GOALS, []);
      const settings = StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, { ...CONFIG.DEFAULT_SETTINGS });

      store.setState({
        tasks,
        reports,
        goals,
        settings,
        syncStatus: 'offline',
        syncMessage: 'Using cached offline data'
      });
    }
  }
};
