/**
 * TrackFlow - Task Management Engine
 * Task validation, overlap detection, filtering, sorting, and scheduling.
 */
const TaskManager = {
  /**
   * Validate a task payload
   */
  validate(task) {
    const errors = [];

    if (!task) {
      return { isValid: false, errors: ['Task data is required'] };
    }

    // Title validation
    if (!task.title || !String(task.title).trim()) {
      errors.push('Task title is required');
    } else if (String(task.title).trim().length > 200) {
      errors.push('Task title cannot exceed 200 characters');
    }

    // Date validation (YYYY-MM-DD with calendar validity)
    if (!task.date || !/^\d{4}-\d{2}-\d{2}$/.test(task.date)) {
      errors.push('A valid date (YYYY-MM-DD) is required');
    } else {
      const [y, m, d] = task.date.split('-').map(Number);
      const parsed = new Date(y, m - 1, d);
      if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
        errors.push(`Invalid calendar date: ${task.date}`);
      }
    }

    // Time validation
    if (task.startTime && !/^\d{2}:\d{2}$/.test(task.startTime)) {
      errors.push('Start time must be in HH:MM format');
    }
    if (task.endTime && !/^\d{2}:\d{2}$/.test(task.endTime)) {
      errors.push('End time must be in HH:MM format');
    }
    if (task.startTime && task.endTime && task.startTime >= task.endTime) {
      errors.push('Start time must be strictly earlier than end time');
    }

    // Points validation
    const points = Number(task.plannedPoints);
    if (isNaN(points) || points < 0 || points > 100) {
      errors.push('Planned points must be a number between 0 and 100');
    }

    // Category validation
    const validCategories = CONFIG.CATEGORIES ? CONFIG.CATEGORIES.map(c => c.id) : [
      'Study', 'Coding', 'Project', 'Work', 'Interview Preparation', 'Personal', 'Health', 'Other'
    ];
    if (task.category && !validCategories.includes(task.category)) {
      errors.push(`Invalid category: ${task.category}`);
    }

    // Priority validation
    const validPriorities = ['urgent', 'high', 'medium', 'low'];
    if (task.priority && !validPriorities.includes(task.priority)) {
      errors.push(`Invalid priority: ${task.priority}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Detect time overlap between a candidate task and existing scheduled tasks
   * @param {Object} candidate - { taskId?, date, startTime, endTime }
   * @param {Array} existingTasks - List of all existing tasks
   * @returns {Object|null} Conflicting task if overlap detected, otherwise null
   */
  checkOverlap(candidate, existingTasks = []) {
    if (!candidate || !candidate.date || !candidate.startTime || !candidate.endTime) {
      return null;
    }

    // Convert HH:MM to total minutes from midnight for exact interval comparison
    const toMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const candStart = toMinutes(candidate.startTime);
    const candEnd = toMinutes(candidate.endTime);

    for (const existing of existingTasks) {
      // Must be on same date, not the same task being edited, and has valid time bounds
      if (
        existing.date === candidate.date &&
        existing.taskId !== candidate.taskId &&
        existing.startTime &&
        existing.endTime &&
        existing.status !== 'missed' &&
        existing.status !== 'rescheduled'
      ) {
        const existStart = toMinutes(existing.startTime);
        const existEnd = toMinutes(existing.endTime);

        // Check if intervals [candStart, candEnd) and [existStart, existEnd) intersect
        const isOverlapping = Math.max(candStart, existStart) < Math.min(candEnd, existEnd);
        if (isOverlapping) {
          return existing; // Found overlap
        }
      }
    }

    return null;
  },

  /**
   * Filter tasks based on search and selected filter criteria
   */
  filter(tasks = [], filters = {}) {
    return tasks.filter(task => {
      // Date filter
      if (filters.date && task.date !== filters.date) {
        return false;
      }

      // Month filter (YYYY-MM)
      if (filters.monthKey && (!task.date || !task.date.startsWith(filters.monthKey))) {
        return false;
      }

      // Category filter
      if (filters.category && filters.category !== 'all' && task.category !== filters.category) {
        return false;
      }

      // Priority filter
      if (filters.priority && filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }

      // Status filter
      if (filters.status && filters.status !== 'all' && task.status !== filters.status) {
        return false;
      }

      // Search text query (matches title or description or category)
      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const matchTitle = (task.title || '').toLowerCase().includes(q);
        const matchDesc = (task.description || '').toLowerCase().includes(q);
        const matchCat = (task.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat) {
          return false;
        }
      }

      return true;
    });
  },

  /**
   * Sort tasks by selected criteria
   */
  sort(tasks = [], sortBy = 'time') {
    const list = [...tasks];
    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };

    switch (sortBy) {
      case 'time':
        return list.sort((a, b) => {
          const timeA = a.startTime || '99:99';
          const timeB = b.startTime || '99:99';
          if (timeA !== timeB) return timeA.localeCompare(timeB);
          return (a.title || '').localeCompare(b.title || '');
        });

      case 'priority':
        return list.sort((a, b) => {
          const pA = priorityWeights[a.priority] || 0;
          const pB = priorityWeights[b.priority] || 0;
          if (pA !== pB) return pB - pA; // Descending priority
          return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
        });

      case 'points':
        return list.sort((a, b) => (Number(b.plannedPoints) || 0) - (Number(a.plannedPoints) || 0));

      case 'createdAt':
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      default:
        return list;
    }
  },

  /**
   * Create a standardized new task object with defaults
   */
  createDefault(overrides = {}) {
    let today = '';
    if (typeof store !== 'undefined' && store.state && store.state.activeDate) {
      today = store.state.activeDate;
    } else {
      const nowD = new Date();
      const y = nowD.getFullYear();
      const m = String(nowD.getMonth() + 1).padStart(2, '0');
      const d = String(nowD.getDate()).padStart(2, '0');
      today = `${y}-${m}-${d}`;
    }
    const now = new Date().toISOString();

    return {
      taskId: 'tsk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: '',
      description: '',
      date: today,
      startTime: '09:00',
      endTime: '10:00',
      category: 'Coding',
      priority: 'medium',
      plannedPoints: 20,
      reminderEnabled: true,
      reminderTime: '08:50',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      completedAt: '',
      notes: '',
      ...overrides
    };
  }
};

// Node.js module export support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskManager;
}
