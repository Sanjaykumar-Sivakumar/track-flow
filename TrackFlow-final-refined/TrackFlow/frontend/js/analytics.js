/**
 * TrackFlow - Weekly & Monthly Analytics Engine
 * Chart.js integrations, GitHub-style calendar heatmap, and authentic performance metrics.
 */
const AnalyticsEngine = {
  charts: {},

  /**
   * Destroy an existing Chart.js instance to prevent memory leaks and redraw glitches
   */
  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      delete this.charts[id];
    }
  },

  /**
   * Get 7-day week bounds based on an anchor date (Monday to Sunday)
   */
  getWeekDays(anchorDateStr) {
    const d = new Date(anchorDateStr + 'T00:00:00');
    const day = d.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMon = (day === 0 ? -6 : 1) - day;

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMon);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const dt = String(cur.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${dt}`);
    }
    return days;
  },

  /**
   * Calculate Weekly Metrics
   */
  calculateWeekly(tasks = [], reports = [], anchorDateStr, threshold = 80) {
    const weekDays = this.getWeekDays(anchorDateStr);
    const prevWeekAnchor = new Date(new Date(anchorDateStr + 'T00:00:00').getTime() - 7 * 86400000);
    const prevWeekDays = this.getWeekDays(store.formatDate(prevWeekAnchor));

    const computeWeekData = (days) => {
      let totalPlanned = 0;
      let totalCompleted = 0;
      let scoreSum = 0;
      let daysWithScore = 0;
      let successfulDays = 0;
      let eodReviews = 0;

      const dailyBreakdown = days.map(dateKey => {
        const dayTasks = tasks.filter(t => t.date === dateKey);
        const dayReport = reports.find(r => r.date === dateKey);
        const scoreData = ScoringEngine.calculateDailyScore(tasks, dateKey, threshold);

        const score = dayReport ? dayReport.dailyScore : scoreData.dailyScore;
        const hasPlan = scoreData.plannedPoints > 0;
        const isSuccess = dayReport ? dayReport.successfulDay : scoreData.isSuccessful;

        totalPlanned += scoreData.totalTasks;
        totalCompleted += scoreData.completedTasks;
        if (hasPlan) {
          scoreSum += score;
          daysWithScore++;
          if (isSuccess) successfulDays++;
        }
        if (dayReport) eodReviews++;

        const dObj = new Date(dateKey + 'T00:00:00');
        const dayName = dObj.toLocaleDateString(undefined, { weekday: 'short' });

        return {
          date: dateKey,
          dayName,
          score,
          plannedTasks: scoreData.totalTasks,
          completedTasks: scoreData.completedTasks,
          earnedPoints: scoreData.earnedPoints,
          plannedPoints: scoreData.plannedPoints,
          hasPlan,
          isSuccess,
          hasReport: !!dayReport
        };
      });

      const avgScore = daysWithScore > 0 ? Math.round(scoreSum / daysWithScore) : 0;
      const consistency = daysWithScore > 0 ? Math.round((successfulDays / daysWithScore) * 100) : 0;
      const eodRate = Math.round((eodReviews / 7) * 100);

      return {
        dailyBreakdown,
        totalPlanned,
        totalCompleted,
        avgScore,
        successfulDays,
        daysWithScore,
        consistency,
        eodReviews,
        eodRate
      };
    };

    const currentWeek = computeWeekData(weekDays);
    const previousWeek = computeWeekData(prevWeekDays);

    const scoreDelta = currentWeek.avgScore - previousWeek.avgScore;
    const taskDelta = currentWeek.totalCompleted - previousWeek.totalCompleted;

    return {
      weekDays,
      current: currentWeek,
      previous: previousWeek,
      scoreDelta,
      taskDelta
    };
  },

  /**
   * Calculate Monthly Metrics and Heatmap Data
   */
  calculateMonthly(tasks = [], reports = [], monthKey, threshold = 80) {
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      days.push(dayStr);
    }

    let totalPlanned = 0;
    let totalCompleted = 0;
    let totalMissed = 0;
    let scoreSum = 0;
    let daysWithPlan = 0;
    let successfulDays = 0;
    let eodCount = 0;
    let bestDay = null;

    const categoryCounts = {};
    CONFIG.CATEGORIES.forEach(c => { categoryCounts[c.id] = 0; });

    const heatmapData = days.map(dateKey => {
      const dayTasks = tasks.filter(t => t.date === dateKey);
      const dayReport = reports.find(r => r.date === dateKey);
      const scoreData = ScoringEngine.calculateDailyScore(tasks, dateKey, threshold);

      const score = dayReport ? dayReport.dailyScore : scoreData.dailyScore;
      const hasPlan = scoreData.plannedPoints > 0;
      const isSuccess = dayReport ? dayReport.successfulDay : scoreData.isSuccessful;

      totalPlanned += scoreData.totalTasks;
      totalCompleted += scoreData.completedTasks;
      totalMissed += scoreData.missedTasks;

      // Category breakdown for completed tasks
      dayTasks.forEach(t => {
        if (t.status === 'completed' && t.category) {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        }
      });

      if (hasPlan) {
        scoreSum += score;
        daysWithPlan++;
        if (isSuccess) successfulDays++;

        if (!bestDay || score > bestDay.score) {
          bestDay = { date: dateKey, score, completed: scoreData.completedTasks };
        }
      }

      if (dayReport) eodCount++;

      // Intensity level for Heatmap (0 to 3)
      let level = 0;
      if (hasPlan) {
        if (score === 0) level = 0;
        else if (score < 50) level = 1;
        else if (score < threshold) level = 2;
        else level = 3;
      }

      const dObj = new Date(dateKey + 'T00:00:00');
      return {
        date: dateKey,
        dayNumber: dObj.getDate(),
        dayOfWeek: dObj.getDay(), // 0 Sun - 6 Sat
        score,
        hasPlan,
        isSuccess,
        level,
        completedTasks: scoreData.completedTasks,
        plannedTasks: scoreData.totalTasks,
        hasReport: !!dayReport
      };
    });

    const avgScore = daysWithPlan > 0 ? Math.round(scoreSum / daysWithPlan) : 0;
    const consistency = daysWithPlan > 0 ? Math.round((successfulDays / daysWithPlan) * 100) : 0;
    const completionRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
    const eodRate = Math.round((eodCount / daysInMonth) * 100);

    return {
      monthKey,
      daysInMonth,
      totalPlanned,
      totalCompleted,
      totalMissed,
      avgScore,
      successfulDays,
      daysWithPlan,
      consistency,
      completionRate,
      eodCount,
      eodRate,
      bestDay: bestDay || { date: 'N/A', score: 0, completed: 0 },
      categoryCounts,
      heatmapData
    };
  },

  /**
   * Render Weekly Performance Line & Bar Charts using Chart.js
   */
  renderWeeklyCharts(canvasIdScore, canvasIdTasks, weeklyData) {
    if (typeof Chart === 'undefined') {
      console.warn('[AnalyticsEngine] Chart.js not loaded yet');
      return;
    }

    const labels = weeklyData.dailyBreakdown.map(d => `${d.dayName} (${d.date.substring(5)})`);
    const scores = weeklyData.dailyBreakdown.map(d => d.score);
    const completed = weeklyData.dailyBreakdown.map(d => d.completedTasks);
    const planned = weeklyData.dailyBreakdown.map(d => d.plannedTasks);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';

    // 1. Daily Score Line Chart
    this.destroyChart(canvasIdScore);
    const canvasScore = document.getElementById(canvasIdScore);
    if (canvasScore) {
      this.charts[canvasIdScore] = new Chart(canvasScore, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Daily Score (%)',
            data: scores,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointBackgroundColor: scores.map(s => s >= 80 ? '#10b981' : '#38bdf8'),
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 0,
              max: 100,
              grid: { color: gridColor },
              ticks: { color: textColor, callback: v => v + '%' }
            },
            x: {
              grid: { display: false },
              ticks: { color: textColor }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Score: ${ctx.parsed.y}%`
              }
            }
          }
        }
      });
    }

    // 2. Tasks Comparison Bar Chart
    this.destroyChart(canvasIdTasks);
    const canvasTasks = document.getElementById(canvasIdTasks);
    if (canvasTasks) {
      this.charts[canvasIdTasks] = new Chart(canvasTasks, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Completed',
              data: completed,
              backgroundColor: '#10b981',
              borderRadius: 6
            },
            {
              label: 'Planned',
              data: planned,
              backgroundColor: isDark ? '#334155' : '#cbd5e1',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: textColor },
              grid: { color: gridColor }
            },
            x: {
              grid: { display: false },
              ticks: { color: textColor }
            }
          },
          plugins: {
            legend: {
              labels: { color: textColor, usePointStyle: true, boxWidth: 8 }
            }
          }
        }
      });
    }
  },

  /**
   * Render Monthly Category Doughnut Chart
   */
  renderCategoryChart(canvasId, categoryCounts) {
    if (typeof Chart === 'undefined') return;

    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = [];
    const data = [];
    const bgColors = [];

    CONFIG.CATEGORIES.forEach(c => {
      const count = categoryCounts[c.id] || 0;
      if (count > 0) {
        labels.push(c.label);
        data.push(count);
        bgColors.push(c.color);
      }
    });

    if (data.length === 0) {
      labels.push('No completed tasks yet');
      data.push(1);
      bgColors.push('#475569');
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    this.charts[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: textColor, usePointStyle: true, boxWidth: 8 }
          }
        },
        cutout: '68%'
      }
    });
  }
};
