/**
 * Unit Tests for ScoringEngine
 */
const assert = require('assert');
const ScoringEngine = require('../frontend/js/scoring.js');

function runScoringTests() {
  console.log('--- Running ScoringEngine Tests ---');

  // Test 1: Daily score calculation with completed and pending tasks
  {
    const tasks = [
      { taskId: '1', date: '2026-10-17', title: 'Task 1', plannedPoints: 25, status: 'completed' },
      { taskId: '2', date: '2026-10-17', title: 'Task 2', plannedPoints: 25, status: 'completed' },
      { taskId: '3', date: '2026-10-17', title: 'Task 3', plannedPoints: 25, status: 'pending' },
      { taskId: '4', date: '2026-10-17', title: 'Task 4', plannedPoints: 25, status: 'pending' }
    ];

    const result = ScoringEngine.calculateDailyScore(tasks, '2026-10-17', 80);
    assert.strictEqual(result.plannedPoints, 100, 'Planned points must sum to 100');
    assert.strictEqual(result.earnedPoints, 50, 'Earned points must sum completed tasks (50)');
    assert.strictEqual(result.dailyScore, 50, 'Daily score percentage must be 50%');
    assert.strictEqual(result.isSuccessful, false, 'Score 50% must not meet 80% threshold');
    console.log('✓ Test 1 Passed: Standard daily score calculation');
  }

  // Test 2: Incomplete, missed and rescheduled tasks earn strictly 0 points
  {
    const tasks = [
      { taskId: '1', date: '2026-10-17', plannedPoints: 30, status: 'pending' },
      { taskId: '2', date: '2026-10-17', plannedPoints: 30, status: 'missed' },
      { taskId: '3', date: '2026-10-17', plannedPoints: 40, status: 'rescheduled' }
    ];

    const result = ScoringEngine.calculateDailyScore(tasks, '2026-10-17');
    assert.strictEqual(result.earnedPoints, 0, 'Incomplete/missed/rescheduled tasks must earn 0 points');
    assert.strictEqual(result.dailyScore, 0, 'Daily score must be 0%');
    console.log('✓ Test 2 Passed: Incomplete tasks earn zero points');
  }

  // Test 3: Duplicate task ID protection
  {
    const tasks = [
      { taskId: 'dup_1', date: '2026-10-17', plannedPoints: 40, status: 'completed' },
      { taskId: 'dup_1', date: '2026-10-17', plannedPoints: 40, status: 'completed' } // Duplicate
    ];

    const result = ScoringEngine.calculateDailyScore(tasks, '2026-10-17');
    assert.strictEqual(result.plannedPoints, 40, 'Duplicate task ID must not be counted twice');
    assert.strictEqual(result.earnedPoints, 40, 'Duplicate task must not award points twice');
    console.log('✓ Test 3 Passed: Duplicate task ID deduplication');
  }

  // Test 4: Division by zero protection on empty days
  {
    const tasks = [];
    const result = ScoringEngine.calculateDailyScore(tasks, '2026-10-17');
    assert.strictEqual(result.isEmpty, true, 'Empty day must have isEmpty: true');
    assert.strictEqual(result.dailyScore, 0, 'Empty day score must be 0 (no NaN)');
    assert.strictEqual(result.plannedPoints, 0);
    assert.strictEqual(result.earnedPoints, 0);
    console.log('✓ Test 4 Passed: Zero-division protection on empty days');
  }

  // Test 5: Score capped at 100%
  {
    const tasks = [
      { taskId: '1', date: '2026-10-17', plannedPoints: 100, status: 'completed' }
    ];
    const result = ScoringEngine.calculateDailyScore(tasks, '2026-10-17');
    assert.strictEqual(result.dailyScore, 100, 'Score must be 100%');
    assert.strictEqual(result.isSuccessful, true);
    console.log('✓ Test 5 Passed: 100% cap and success threshold evaluation');
  }

  // Test 6: Equal points distribution across 3 tasks
  {
    const tasks = [
      { taskId: '1', title: 'A' },
      { taskId: '2', title: 'B' },
      { taskId: '3', title: 'C' }
    ];
    const distributed = ScoringEngine.distributeEqualPoints(tasks, 100);
    const sum = distributed.reduce((acc, t) => acc + t.plannedPoints, 0);
    assert.strictEqual(sum, 100, 'Sum of distributed points must equal 100');
    assert.strictEqual(distributed[0].plannedPoints, 34);
    assert.strictEqual(distributed[1].plannedPoints, 33);
    assert.strictEqual(distributed[2].plannedPoints, 33);
    console.log('✓ Test 6 Passed: Fair equal points distribution');
  }

  // Test 7: Point validation bounds
  {
    assert.strictEqual(ScoringEngine.validatePoints(-5).isValid, false);
    assert.strictEqual(ScoringEngine.validatePoints(105).isValid, false);
    assert.strictEqual(ScoringEngine.validatePoints('abc').isValid, false);
    assert.strictEqual(ScoringEngine.validatePoints(25).isValid, true);
    console.log('✓ Test 7 Passed: Point validation constraints');
  }
}

module.exports = runScoringTests;
