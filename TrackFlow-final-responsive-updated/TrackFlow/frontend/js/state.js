/**
 * TrackFlow - Central Reactive State Store
 */
class StateStore {
  constructor() {
    const today = this.formatDate(new Date());
    const month = today.substring(0, 7);

    this.state = {
      tasks: [],
      reports: [],
      goals: [],
      settings: { ...CONFIG.DEFAULT_SETTINGS },
      activeDate: today,
      activeMonth: month,
      activeView: 'dashboard',
      syncStatus: 'synced', // 'synced' | 'saving' | 'offline' | 'error' | 'local'
      syncMessage: 'Ready',
      syncQueueCount: 0,
      filterCategory: 'all',
      filterPriority: 'all',
      filterStatus: 'all',
      searchQuery: '',
      sortField: 'time',
      isQuickAddOpen: false,
      editingTaskId: null,
      networkOnline: navigator.onLine
    };

    this.subscribers = new Set();

    // Listen to network changes
    window.addEventListener('online', () => {
      this.setState({ networkOnline: true });
    });
    window.addEventListener('offline', () => {
      this.setState({ networkOnline: false, syncStatus: 'offline', syncMessage: 'Offline mode active' });
    });
  }

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };
    this.notify(this.state, prevState);
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify(currentState, prevState) {
    this.subscribers.forEach(listener => {
      try {
        listener(currentState, prevState);
      } catch (e) {
        console.error('[StateStore] Subscriber notification error:', e);
      }
    });
  }
}

const store = new StateStore();
