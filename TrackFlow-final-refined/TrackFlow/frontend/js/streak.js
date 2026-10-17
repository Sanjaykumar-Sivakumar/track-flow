/**
 * TrackFlow - Consistency & Streak Tracker
 * Accurately tracks daily consistency, current and best streaks, and success rates.
 */
const StreakCalculator = {
  /**
   * Calculate consistency and streak statistics from historical tasks and reports
   * @param {Array} tasks - All tasks
   * @param {Array} reports - All daily reports (snapshots)
   * @param {string} todayStr - Current date YYYY-MM-DD
   * @param {Object} options - { threshold: 80, failNoPlanDays: false }
   */
  calculateConsistency(tasks = [], reports = [], todayStr, options = {}) {
    const threshold = options.threshold !== undefined ? options.threshold : 80;
    const failNoPlanDays = !!options.failNoPlanDays;

    if (!todayStr) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      todayStr = `${y}-${m}-${d}`;
    }

    // Map existing reports by date
    const reportMap = new Map();
    reports.forEach(r => {
      if (r && r.date) reportMap.set(r.date, r);
    });

    // Group tasks by date
    const tasksByDate = new Map();
    tasks.forEach(t => {
      if (!t || !t.date) return;
      if (!tasksByDate.has(t.date)) {
        tasksByDate.set(t.date, []);
      }
      tasksByDate.get(t.date).push(t);
    });

    // Find earliest tracked date
    let allDates = new Set([...reportMap.keys(), ...tasksByDate.keys()]);
    // Filter out future dates
    allDates = Array.from(allDates).filter(d => d <= todayStr).sort();

    if (allDates.length === 0) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        successfulDays: 0,
        unsuccessfulDays: 0,
        daysWithNoPlan: 0,
        totalTrackedDays: 0,
        consistencyPercentage: 0,
        history: []
      };
    }

    const startDateStr = allDates[0];
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(todayStr + 'T00:00:00');

    const dayDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    const history = [];

    let successfulDays = 0;
    let unsuccessfulDays = 0;
    let daysWithNoPlan = 0;

    // Iterate day by day from startDate to today
    for (let i = 0; i <= dayDiff; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      // If report exists, that is an authoritative snapshot
      const existingReport = reportMap.get(dateKey);
      let dayScore = 0;
      let hasTasks = false;
      let hasPlan = false;
      let isSuccess = false;

      if (existingReport) {
        dayScore = Number(existingReport.dailyScore) || 0;
        hasPlan = (Number(existingReport.plannedPoints) || 0) > 0 || (Number(existingReport.plannedTaskCount) || 0) > 0;
        isSuccess = existingReport.successfulDay !== undefined ? !!existingReport.successfulDay : (dayScore >= threshold && hasPlan);
      } else {
        // Compute from tasks
        const dayTasks = tasksByDate.get(dateKey) || [];
        if (dayTasks.length > 0) {
          hasPlan = true;
          let planned = 0;
          let earned = 0;
          dayTasks.forEach(t => {
            const pts = Number(t.plannedPoints) || 0;
            planned += pts;
            if (t.status === 'completed') earned += pts;
          });
          dayScore = planned > 0 ? Math.min(100, Math.round((earned / planned) * 100)) : 0;
          isSuccess = dayScore >= threshold && planned > 0;
        } else {
          hasPlan = false;
        }
      }

      let statusType = 'no-plan';
      if (hasPlan) {
        if (isSuccess) {
          statusType = 'success';
          successfulDays++;
        } else {
          // If it's today and not yet successful, it might be in progress
          if (dateKey === todayStr) {
            statusType = 'in-progress';
          } else {
            statusType = 'unsuccessful';
            unsuccessfulDays++;
          }
        }
      } else {
        daysWithNoPlan++;
        if (failNoPlanDays && dateKey !== todayStr) {
          unsuccessfulDays++;
          statusType = 'unsuccessful';
        }
      }

      history.push({
        date: dateKey,
        score: dayScore,
        hasPlan,
        isSuccess,
        statusType
      });
    }

    // Calculate Best Streak
    let bestStreak = 0;
    let tempStreak = 0;

    history.forEach(day => {
      if (day.statusType === 'success') {
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else if (day.statusType === 'unsuccessful') {
        tempStreak = 0;
      }
      // Note: If day has 'no-plan' and failNoPlanDays is false, does it break streak?
      // Standard productivity rule: rest/no-plan days do not advance streak, but don't break it unless failNoPlanDays is true.
      else if (day.statusType === 'no-plan' && failNoPlanDays) {
        tempStreak = 0;
      }
    });

    // Calculate Current Streak
    let currentStreak = 0;
    // Iterate backwards from the most recent day
    for (let i = history.length - 1; i >= 0; i--) {
      const day = history[i];

      // If today is in progress, check if it's already successful
      if (day.date === todayStr) {
        if (day.statusType === 'success') {
          currentStreak++;
        }
        // If today is in-progress (not yet successful), we don't break the previous streak!
        continue;
      }

      if (day.statusType === 'success') {
        currentStreak++;
      } else if (day.statusType === 'unsuccessful') {
        break; // Streak broken
      } else if (day.statusType === 'no-plan') {
        if (failNoPlanDays) {
          break; // Streak broken if no plan days count as failed
        }
        // Otherwise, skip neutral rest day without breaking streak
      }
    }

    const evaluatableDays = successfulDays + unsuccessfulDays;
    const consistencyPercentage = evaluatableDays > 0 
      ? Math.round((successfulDays / evaluatableDays) * 100) 
      : 0;

    return {
      currentStreak,
      bestStreak: Math.max(bestStreak, currentStreak),
      successfulDays,
      unsuccessfulDays,
      daysWithNoPlan,
      totalTrackedDays: history.length,
      consistencyPercentage,
      history
    };
  }
};

// Node.js module export support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreakCalculator;
}
