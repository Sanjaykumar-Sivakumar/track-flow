/**
 * TrackFlow Automated Test Runner
 */
const runScoringTests = require('./scoring.test.js');
const runStreakTests = require('./streak.test.js');
const runTaskTests = require('./tasks.test.js');

require('./security-config.test.js');

console.log('====================================================');
console.log('🚀 Running TrackFlow Test Suite');
console.log('====================================================\n');

let failed = false;

try {
  runScoringTests();
  console.log('');
  runStreakTests();
  console.log('');
  runTaskTests();
  console.log('');
  console.log('====================================================');
  console.log('🎉 ALL AUTOMATED TESTS PASSED (16 core assertions + 28 security/UI, language and theme assertions)');
  console.log('====================================================');
} catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}

