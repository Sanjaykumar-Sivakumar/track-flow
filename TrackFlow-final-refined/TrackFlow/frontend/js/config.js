/**
 * TrackFlow - Application Configuration & Constants
 */
const CONFIG = {
  APP_NAME: 'TrackFlow',
  VERSION: '1.0.0',

  // Local storage keys
  STORAGE_KEYS: {
    TASKS: 'trackflow_tasks_v1',
    REPORTS: 'trackflow_reports_v1',
    GOALS: 'trackflow_goals_v1',
    SETTINGS: 'trackflow_settings_v1',
    SYNC_QUEUE: 'trackflow_sync_queue_v1',
    GAS_URL: 'trackflow_gas_url',
    AUTH_TOKEN: 'trackflow_auth_token',
    THEME: 'trackflow_theme',
    FIRED_REMINDERS: 'trackflow_fired_reminders'
  },

  // Default system settings
  DEFAULT_SETTINGS: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    dailyReviewTime: '21:00',
    successThreshold: 80, // Default 80% daily score is a "Successful Day"
    scoringMode: 'weighted', // 'weighted' or 'equal'
    defaultDailyTarget: 100, // Total planned points target
    defaultLeadMinutes: 10,  // Reminder lead time
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
    notificationsEnabled: true,
    soundEnabled: true,
    theme: 'dark' // 'dark' | 'light' | 'system'
  },

  // Available task categories with icons and color tokens
  CATEGORIES: [
    { id: 'Study', label: 'Study', icon: 'book', color: '#38bdf8' },
    { id: 'Coding', label: 'Coding', icon: 'code', color: '#10b981' },
    { id: 'Project', label: 'Project', icon: 'folder', color: '#818cf8' },
    { id: 'Work', label: 'Work', icon: 'briefcase', color: '#f59e0b' },
    { id: 'Interview Preparation', label: 'Interview Prep', icon: 'award', color: '#ec4899' },
    { id: 'Personal', label: 'Personal', icon: 'user', color: '#06b6d4' },
    { id: 'Health', label: 'Health', icon: 'heart', color: '#ef4444' },
    { id: 'Other', label: 'Other', icon: 'tag', color: '#94a3b8' }
  ],

  // Priority definitions
  PRIORITIES: {
    urgent: { label: 'Urgent', color: '#ef4444', weight: 4 },
    high: { label: 'High', color: '#f97316', weight: 3 },
    medium: { label: 'Medium', color: '#38bdf8', weight: 2 },
    low: { label: 'Low', color: '#64748b', weight: 1 }
  },

  // Task statuses
  STATUSES: {
    pending: { label: 'Pending', icon: 'clock', color: '#f59e0b' },
    completed: { label: 'Completed', icon: 'check-circle', color: '#10b981' },
    missed: { label: 'Missed', icon: 'x-circle', color: '#ef4444' },
    rescheduled: { label: 'Rescheduled', icon: 'rotate-cw', color: '#818cf8' }
  }
};

// Freeze config to prevent accidental mutations
Object.freeze(CONFIG);
