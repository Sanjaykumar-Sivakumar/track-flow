/**
 * TrackFlow - End-of-Day (EOD) Review Controller
 * Comprehensive evening review workflow, reflection notes, and daily snapshot generation.
 */
const EodService = {
  /**
   * Get EOD review data for a specific date
   */
  getReviewData(dateStr) {
    const tasks = store.state.tasks || [];
    const reports = store.state.reports || [];
    const settings = store.state.settings || CONFIG.DEFAULT_SETTINGS;

    const dayTasks = tasks.filter(t => t.date === dateStr);
    const existingReport = reports.find(r => r.date === dateStr);

    const scoreData = ScoringEngine.calculateDailyScore(tasks, dateStr, Number(settings.successThreshold) || 80);

    return {
      date: dateStr,
      dayTasks,
      existingReport,
      scoreData,
      isSubmitted: !!existingReport,
      accomplishments: existingReport ? (existingReport.reviewNotes || '') : '',
      challenges: existingReport ? (existingReport.challenges || '') : '',
      tomorrowPriorities: existingReport ? (existingReport.tomorrowPriorities || '') : '',
      submittedAt: existingReport ? existingReport.submittedAt : null
    };
  },

  /**
   * Submit or update the EOD review
   */
  async submitReview(dateStr, formValues) {
    const tasks = store.state.tasks || [];
    const settings = store.state.settings || CONFIG.DEFAULT_SETTINGS;
    const threshold = Number(settings.successThreshold) || 80;

    const report = ScoringEngine.generateDailySnapshot(dateStr, tasks, {
      reviewNotes: formValues.accomplishments,
      challenges: formValues.challenges,
      tomorrowPriorities: formValues.tomorrowPriorities
    }, threshold);

    const res = await ApiService.request('POST', 'saveDailyReport', { report });
    if (res.success) {
      // Re-fetch or update store
      const reports = [...(store.state.reports || [])];
      const idx = reports.findIndex(r => r.date === dateStr);
      if (idx >= 0) {
        reports[idx] = res.report || report;
      } else {
        reports.unshift(res.report || report);
      }
      store.setState({ reports });
      return { success: true, report: res.report || report };
    }
    return res;
  }
};
