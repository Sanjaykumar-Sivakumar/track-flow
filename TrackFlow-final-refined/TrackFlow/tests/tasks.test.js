/**
 * Unit Tests for TaskManager
 */
const assert = require('assert');

// Mock CONFIG for Node testing environment
global.CONFIG = {
  CATEGORIES: [
    { id: 'Study' }, { id: 'Coding' }, { id: 'Project' }, { id: 'Work' },
    { id: 'Interview Preparation' }, { id: 'Personal' }, { id: 'Health' }, { id: 'Other' }
  ]
};

const TaskManager = require('../frontend/js/tasks.js');

function runTaskTests() {
  console.log('--- Running TaskManager Tests ---');

  // Test 1: Time Overlap Detection on same date
  {
    const existing = [
      { taskId: '1', date: '2026-10-17', startTime: '09:00', endTime: '10:30', title: 'Task A', status: 'pending' },
      { taskId: '2', date: '2026-10-17', startTime: '11:00', endTime: '12:00', title: 'Task B', status: 'pending' }
    ];

    // Candidate overlaps with Task A (09:30 to 10:45)
    const candidateOverlap = { taskId: '3', date: '2026-10-17', startTime: '09:30', endTime: '10:45' };
    const conflict = TaskManager.checkOverlap(candidateOverlap, existing);
    assert.notStrictEqual(conflict, null, 'Should detect overlap with Task A');
    assert.strictEqual(conflict.taskId, '1');
    console.log('✓ Test 1 Passed: Overlap detected between intersecting tasks');
  }

  // Test 2: Adjacent/consecutive tasks do not overlap
  {
    const existing = [
      { taskId: '1', date: '2026-10-17', startTime: '09:00', endTime: '10:00', title: 'Task A', status: 'pending' }
    ];
    // Candidate starts exactly when Task A ends (10:00)
    const candidateAdjacent = { taskId: '2', date: '2026-10-17', startTime: '10:00', endTime: '11:00' };
    const conflict = TaskManager.checkOverlap(candidateAdjacent, existing);
    assert.strictEqual(conflict, null, 'Back-to-back tasks should not be flagged as overlapping');
    console.log('✓ Test 2 Passed: Adjacent back-to-back tasks allowed');
  }

  // Test 3: Same times on different dates do not overlap
  {
    const existing = [
      { taskId: '1', date: '2026-10-17', startTime: '09:00', endTime: '10:00', title: 'Task A', status: 'pending' }
    ];
    const candidateOtherDay = { taskId: '2', date: '2026-10-18', startTime: '09:00', endTime: '10:00' };
    const conflict = TaskManager.checkOverlap(candidateOtherDay, existing);
    assert.strictEqual(conflict, null, 'Tasks on different dates should never overlap');
    console.log('✓ Test 3 Passed: Multi-day overlap isolation');
  }

  // Test 4: Validation rejects invalid start/end time order
  {
    const invalidTimes = {
      title: 'Backwards Task',
      date: '2026-10-17',
      startTime: '14:00',
      endTime: '13:00', // Earlier than start
      plannedPoints: 20
    };
    const val = TaskManager.validate(invalidTimes);
    assert.strictEqual(val.isValid, false, 'Start time >= end time must be invalid');
    console.log('✓ Test 4 Passed: Time bounds validation (start < end)');
  }

  // Test 5: Filtering by category, priority, status and search
  {
    const all = [
      { taskId: '1', title: 'Learn Reactivity in JS', category: 'Coding', priority: 'high', status: 'pending', date: '2026-10-17' },
      { taskId: '2', title: 'Gym Workout', category: 'Health', priority: 'medium', status: 'completed', date: '2026-10-17' },
      { taskId: '3', title: 'System Design Spec', category: 'Project', priority: 'urgent', status: 'pending', date: '2026-10-17' }
    ];

    const codingOnly = TaskManager.filter(all, { category: 'Coding' });
    assert.strictEqual(codingOnly.length, 1);
    assert.strictEqual(codingOnly[0].taskId, '1');

    const searchMatch = TaskManager.filter(all, { search: 'gym' });
    assert.strictEqual(searchMatch.length, 1);
    assert.strictEqual(searchMatch[0].taskId, '2');

    console.log('✓ Test 5 Passed: Filtering and search accuracy');
  }
}

module.exports = runTaskTests;
