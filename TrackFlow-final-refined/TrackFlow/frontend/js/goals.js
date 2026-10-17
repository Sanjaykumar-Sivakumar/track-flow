/**
 * TrackFlow - Monthly Goals Manager
 * Isolates goals by monthKey (YYYY-MM), calculates dynamic progress, and maintains historical independence.
 */
const GoalsService = {
  /**
   * Get all goals for a specific month
   * @param {string} monthKey - Format 'YYYY-MM'
   */
  getGoalsForMonth(monthKey) {
    const goals = store.state.goals || [];
    return goals.filter(g => g.monthKey === monthKey);
  },

  /**
   * Calculate progress metrics for a goal
   */
  calculateProgress(goal) {
    const target = Math.max(1, Number(goal.targetValue) || 1);
    const current = Math.max(0, Number(goal.currentValue) || 0);
    const percentage = Math.min(100, Math.round((current / target) * 100));
    const remaining = Math.max(0, target - current);
    const isCompleted = current >= target;

    return {
      target,
      current,
      percentage,
      remaining,
      isCompleted
    };
  },

  /**
   * Auto-sync goal progress from actual tasks or reports in that month
   * For instance, if unit is 'days', sync with successful days count in that month.
   * If title mentions a category (e.g. 'coding', 'study'), count completed tasks in that category.
   */
  autoSyncGoal(goal) {
    const tasks = store.state.tasks || [];
    const reports = store.state.reports || [];
    const monthKey = goal.monthKey;

    const lowerTitle = (goal.title || '').toLowerCase();
    const lowerUnit = (goal.unit || '').toLowerCase();

    // 1. If unit is 'days', sync with successful days in the month
    if (lowerUnit.includes('day') || lowerTitle.includes('successful day')) {
      const monthReports = reports.filter(r => r.date && r.date.startsWith(monthKey) && r.successfulDay);
      return Math.min(goal.targetValue, monthReports.length);
    }

    // 2. If title or unit matches a category, count completed tasks in that category
    for (const cat of CONFIG.CATEGORIES) {
      if (lowerTitle.includes(cat.id.toLowerCase()) || lowerUnit.includes(cat.id.toLowerCase())) {
        const monthCatTasks = tasks.filter(t => 
          t.date && 
          t.date.startsWith(monthKey) && 
          t.category === cat.id && 
          t.status === 'completed'
        );
        return Math.min(goal.targetValue, monthCatTasks.length);
      }
    }

    // Default to current value if not auto-derivable
    return goal.currentValue;
  },

  /**
   * Save or update goal
   */
  async saveGoal(goalData) {
    const res = await ApiService.request('POST', 'saveGoal', { goal: goalData });
    if (res.success) {
      const goals = [...(store.state.goals || [])];
      const savedGoal = res.goal || goalData;
      const idx = goals.findIndex(g => g.goalId === savedGoal.goalId);
      if (idx >= 0) {
        goals[idx] = savedGoal;
      } else {
        goals.unshift(savedGoal);
      }
      store.setState({ goals });
      return { success: true, goal: savedGoal };
    }
    return res;
  },

  /**
   * Delete goal
   */
  async deleteGoal(goalId) {
    const res = await ApiService.request('POST', 'deleteGoal', { goalId });
    if (res.success) {
      const goals = (store.state.goals || []).filter(g => g.goalId !== goalId);
      store.setState({ goals });
      return { success: true };
    }
    return res;
  }
};
