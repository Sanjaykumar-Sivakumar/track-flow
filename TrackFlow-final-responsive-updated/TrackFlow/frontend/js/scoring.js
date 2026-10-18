/**
 * TrackFlow - Daily 100-Point Scoring System
 * Authoritative scoring engine supporting both weighted and equal-points modes.
 */
const ScoringEngine = {
  /**
   * Calculate daily score metrics from a list of tasks for a given date
   * @param {Array} tasks - List of task objects
   * @param {string} dateStr - Date string 'YYYY-MM-DD'
   * @param {number} threshold - Successful day threshold percentage (default 80)
   * @returns {Object} Calculated metrics
   */
  calculateDailyScore(tasks, dateStr, threshold = 80) {
    if (!Array.isArray(tasks)) {
      tasks = [];
    }

    // Filter tasks strictly belonging to the given date
    const dayTasks = tasks.filter(t => t.date === dateStr);

    if (dayTasks.length === 0) {
      return {
        date: dateStr,
        isEmpty: true,
        plannedPoints: 0,
        earnedPoints: 0,
        dailyScore: 0,
        completionPercentage: 0,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        missedTasks: 0,
        rescheduledTasks: 0,
        isSuccessful: false,
        statusText: 'No tasks planned'
      };
    }

    let plannedPoints = 0;
    let earnedPoints = 0;
    let completedTasks = 0;
    let pendingTasks = 0;
    let missedTasks = 0;
    let rescheduledTasks = 0;

    // Track unique IDs to strictly prevent duplicate counting
    const processedTaskIds = new Set();

    dayTasks.forEach(task => {
      if (!task.taskId || processedTaskIds.has(task.taskId)) {
        return;
      }
      processedTaskIds.add(task.taskId);

      const points = Math.max(0, Math.min(100, Number(task.plannedPoints) || 0));
      plannedPoints += points;

      // Status is the authoritative source for points
      if (task.status === 'completed') {
        earnedPoints += points;
        completedTasks++;
      } else if (task.status === 'missed') {
        missedTasks++;
      } else if (task.status === 'rescheduled') {
        rescheduledTasks++;
      } else {
        pendingTasks++;
      }
    });

    // Score calculation with division by zero guard and 100% cap
    let dailyScore = 0;
    if (plannedPoints > 0) {
      dailyScore = Math.min(100, Math.round((earnedPoints / plannedPoints) * 100));
    }

    const completionPercentage = dayTasks.length > 0 
      ? Math.round((completedTasks / dayTasks.length) * 100) 
      : 0;

    const isSuccessful = dailyScore >= threshold && plannedPoints > 0;

    return {
      date: dateStr,
      isEmpty: false,
      plannedPoints,
      earnedPoints,
      dailyScore,
      completionPercentage,
      totalTasks: dayTasks.length,
      completedTasks,
      pendingTasks,
      missedTasks,
      rescheduledTasks,
      isSuccessful,
      statusText: isSuccessful ? 'Goal Achieved' : (dailyScore > 0 ? 'In Progress' : 'Pending Action')
    };
  },

  /**
   * Distribute 100 points equally across a set of tasks
   * Handles integer remainder fairly across earlier tasks.
   * @param {Array} tasks - Tasks to distribute points across
   * @param {number} totalTarget - Total target points (default 100)
   * @returns {Array} New task objects with updated plannedPoints
   */
  distributeEqualPoints(tasks, totalTarget = 100) {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    
    const count = tasks.length;
    const basePoints = Math.floor(totalTarget / count);
    const remainder = totalTarget % count;

    return tasks.map((task, index) => {
      const assignedPoints = basePoints + (index < remainder ? 1 : 0);
      return {
        ...task,
        plannedPoints: assignedPoints
      };
    });
  },

  /**
   * Validate point allocation for an individual task
   * @param {number|string} points 
   * @returns {Object} { isValid: boolean, points: number, error?: string }
   */
  validatePoints(points) {
    const num = Number(points);
    if (isNaN(num)) {
      return { isValid: false, points: 0, error: 'Points must be a valid number' };
    }
    if (num < 0) {
      return { isValid: false, points: 0, error: 'Points cannot be negative' };
    }
    if (num > 100) {
      return { isValid: false, points: 100, error: 'Points cannot exceed 100' };
    }
    return { isValid: true, points: Math.round(num) };
  },

  /**
   * Generate an immutable daily snapshot record suitable for DailyReports storage
   */
  generateDailySnapshot(dateStr, tasks, reviewData = {}, threshold = 80) {
    const scoreData = this.calculateDailyScore(tasks, dateStr, threshold);
    const now = new Date().toISOString();

    return {
      reportId: 'rep_' + dateStr.replace(/-/g, '') + '_' + Math.random().toString(36).substr(2, 6),
      date: dateStr,
      plannedPoints: scoreData.plannedPoints,
      earnedPoints: scoreData.earnedPoints,
      dailyScore: scoreData.dailyScore,
      plannedTaskCount: scoreData.totalTasks,
      completedTaskCount: scoreData.completedTasks,
      pendingTaskCount: scoreData.pendingTasks,
      missedTaskCount: scoreData.missedTasks,
      successfulDay: scoreData.isSuccessful,
      reviewNotes: (reviewData.reviewNotes || '').trim(),
      challenges: (reviewData.challenges || '').trim(),
      tomorrowPriorities: (reviewData.tomorrowPriorities || '').trim(),
      submittedAt: now,
      updatedAt: now
    };
  }
};

// Node.js module export support for automated testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoringEngine;
}
