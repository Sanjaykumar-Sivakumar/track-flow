/**
 * Unit Tests for StreakCalculator
 */
const assert = require('assert');
const StreakCalculator = require('../frontend/js/streak.js');

function runStreakTests() {
  console.log('--- Running StreakCalculator Tests ---');

  // Test 1: Consecutive successful days ending yesterday
  {
    const today = '2026-10-17';
    const reports = [
      { date: '2026-10-14', dailyScore: 85, successfulDay: true, plannedPoints: 100 },
      { date: '2026-10-15', dailyScore: 90, successfulDay: true, plannedPoints: 100 },
      { date: '2026-10-16', dailyScore: 80, successfulDay: true, plannedPoints: 100 }
    ];
    // Today has no tasks yet (in progress)
    const result = StreakCalculator.calculateConsistency([], reports, today, { threshold: 80 });
    assert.strictEqual(result.currentStreak, 3, 'Streak should be 3 from previous consecutive successful days');
    assert.strictEqual(result.bestStreak, 3, 'Best streak should be 3');
    console.log('✓ Test 1 Passed: 3-day consecutive streak preserved when today is in progress');
  }

  // Test 2: Unsuccessful day breaks streak
  {
    const today = '2026-10-17';
    const reports = [
      { date: '2026-10-13', dailyScore: 90, successfulDay: true, plannedPoints: 100 },
      { date: '2026-10-14', dailyScore: 90, successfulDay: true, plannedPoints: 100 },
      { date: '2026-10-15', dailyScore: 60, successfulDay: false, plannedPoints: 100 }, // Breaks streak!
      { date: '2026-10-16', dailyScore: 85, successfulDay: true, plannedPoints: 100 }
    ];
    const result = StreakCalculator.calculateConsistency([], reports, today, { threshold: 80 });
    assert.strictEqual(result.currentStreak, 1, 'Current streak should be 1 after break on Oct 15');
    assert.strictEqual(result.bestStreak, 2, 'Best streak should be 2 (Oct 13-14)');
    console.log('✓ Test 2 Passed: Streak break on unsuccessful day');
  }

  // Test 3: Rest / no-plan days do not break streak when failNoPlanDays is false
  {
    const today = '2026-10-17';
    const reports = [
      { date: '2026-10-14', dailyScore: 85, successfulDay: true, plannedPoints: 100 },
      // 2026-10-15 had no tasks / rest day
      { date: '2026-10-16', dailyScore: 90, successfulDay: true, plannedPoints: 100 }
    ];
    const result = StreakCalculator.calculateConsistency([], reports, today, { threshold: 80, failNoPlanDays: false });
    assert.strictEqual(result.currentStreak, 2, 'No-plan days should not break streak when failNoPlanDays is false');
    console.log('✓ Test 3 Passed: Rest day handling does not penalize user by default');
  }

  // Test 4: Future dates excluded from calculations
  {
    const today = '2026-10-17';
    const reports = [
      { date: '2026-10-16', dailyScore: 90, successfulDay: true, plannedPoints: 100 },
      { date: '2026-10-20', dailyScore: 0, successfulDay: false, plannedPoints: 0 } // Future date
    ];
    const result = StreakCalculator.calculateConsistency([], reports, today);
    assert.strictEqual(result.currentStreak, 1, 'Future dates must not break current streak');
    console.log('✓ Test 4 Passed: Future dates strictly excluded from streak evaluation');
  }
}

module.exports = runStreakTests;
