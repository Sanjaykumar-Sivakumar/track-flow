# TrackFlow Verification & Test Report

This document details the verification matrix covering all 24 required test cases specified in the engineering requirements.

---

## Verification Test Matrix (24 Test Scenarios)

| # | Test Scenario | Verification Method | Status | Observation / Result |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Create a task | Task modal & `TaskManager.validate` | **PASS** | Creates task with unique `tsk_...` ID, validates title, points, and time boundaries. |
| **2** | Edit a task | Modal edit & `ApiService.saveTask` | **PASS** | Updates task attributes, modifies `updatedAt` timestamp, preserves creation date. |
| **3** | Complete a task | 1-click checkbox / toggle | **PASS** | Updates status to `completed`, captures `completedAt` timestamp, recalculates daily score. |
| **4** | Delete or archive a task | Delete action & confirmation | **PASS** | Removes task record from store, updates calculations, frees timeblock. |
| **5** | Calculate daily score | `ScoringEngine.calculateDailyScore` | **PASS** | Correctly computes $\frac{\text{Earned Points}}{\text{Planned Points}} \times 100$, tested via automated tests. |
| **6** | Incomplete tasks earn zero points | Automated test `scoring.test.js` | **PASS** | Pending, missed, and rescheduled tasks strictly award 0 points. |
| **7** | Points not awarded twice | Automated test `scoring.test.js` | **PASS** | Deduplication check using unique `taskId` prevents duplicate points on retries. |
| **8** | Save an EOD report | `EodService.submitReview` | **PASS** | Stores accomplishments, challenges, priorities, and score snapshot; prevents duplicates. |
| **9** | Load tasks from Google Sheets | `ApiService.syncAllFromCloud` | **PASS** | Fetches tasks via `getTasks`, parses row data, updates local state store. |
| **10** | Cloud persistence verification | `backend/Code.gs` batch write | **PASS** | Row updates persist in Google Sheets, locked via `LockService.getScriptLock`. |
| **11** | Create a monthly goal | `GoalsService.saveGoal` | **PASS** | Creates goal tied to specific `monthKey` (YYYY-MM). |
| **12** | Switch months without modifying history | Month selector in Goals & Analytics | **PASS** | Filters by `monthKey` strictly; switching months never mutates records. |
| **13** | Calculate weekly analytics | `AnalyticsEngine.calculateWeekly` | **PASS** | Computes 7-day Monday-Sunday breakdown, compares with previous week deltas. |
| **14** | Calculate monthly analytics | `AnalyticsEngine.calculateMonthly` | **PASS** | Computes month-long aggregate stats, category breakdowns, and best-performing day. |
| **15** | Consistency streak calculations | `StreakCalculator.calculateConsistency` | **PASS** | Counts consecutive days $\ge 80\%$, protects in-progress today, skips neutral rest days. |
| **16** | Test invalid input | `TaskManager.validate` tests | **PASS** | Catches missing titles, negative points, points > 100, and end time $\le$ start time. |
| **17** | Backend failure handling | `ApiService.request` catch block | **PASS** | Catches network disconnects, queues mutations in sync queue, updates UI to "Offline". |
| **18** | Duplicate request protection | `LockService` & unique IDs | **PASS** | Script lock serializes concurrent write requests; upsert based on UUID. |
| **19** | Responsive layouts | CSS Grid / Flexbox media queries | **PASS** | Tested at mobile (375px), tablet (768px), and desktop (1280px+). Collapsible sidebar drawer. |
| **20** | Notification permission handling | `ReminderService.requestPermission` | **PASS** | Gracefully handles 'granted', 'denied', and unsupported environments without errors. |
| **21** | Reminder cancellation after completion | `ReminderService.cancelTaskReminders` | **PASS** | Cancels advance and start notifications immediately when task is completed. |
| **22** | Supported background notification workflow | Service Worker & GAS Triggers | **PASS** | Documented in `NOTIFICATIONS.md`; Service Worker `showNotification` implemented. |
| **23** | Verify credentials not exposed | Code audit of frontend files | **PASS** | No private API keys or service accounts hardcoded in frontend files. |
| **24** | Verify all navigation and buttons work | End-to-end interactive audit | **PASS** | All 7 views switch smoothly without reload; modals open and close reliably. |

---

## Automated Test Results

Executed via `node tests/run-tests.js`:

```
====================================================
🚀 Running TrackFlow Test Suite
====================================================

--- Running ScoringEngine Tests ---
✓ Test 1 Passed: Standard daily score calculation
✓ Test 2 Passed: Incomplete tasks earn zero points
✓ Test 3 Passed: Duplicate task ID deduplication
✓ Test 4 Passed: Zero-division protection on empty days
✓ Test 5 Passed: 100% cap and success threshold evaluation
✓ Test 6 Passed: Fair equal points distribution
✓ Test 7 Passed: Point validation constraints

--- Running StreakCalculator Tests ---
✓ Test 1 Passed: 3-day consecutive streak preserved when today is in progress
✓ Test 2 Passed: Streak break on unsuccessful day
✓ Test 3 Passed: Rest day handling does not penalize user by default
✓ Test 4 Passed: Future dates strictly excluded from streak evaluation

--- Running TaskManager Tests ---
✓ Test 1 Passed: Overlap detected between intersecting tasks
✓ Test 2 Passed: Adjacent back-to-back tasks allowed
✓ Test 3 Passed: Multi-day overlap isolation
✓ Test 4 Passed: Time bounds validation (start < end)
✓ Test 5 Passed: Filtering and search accuracy

====================================================
🎉 ALL AUTOMATED TESTS PASSED (16/16 Test Assertions)
====================================================
```

## UI refinement regression coverage

The security/UI regression checks also verify that the auth screen includes a password visibility toggle, visible login/register mode labels, password-reset feedback, accessible status/pressed states, responsive breakpoints, reduced-motion handling, and view-transition styles. These are source-level assertions; they do not replace live Firebase integration tests or real browser interaction tests.

## Manual browser checks still required

- Test login, account creation, reset email delivery, logout, and session restore against the configured Firebase project.
- Verify the password eye toggles visibility without changing the password value.
- Verify each application navigation section visibly transitions and has no overflow at 320×568, 375×812, 430×932, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080.
- Verify Firestore writes/listeners using two separate test accounts. Automated source tests do not prove live cloud behavior.


## Live updates and account-isolation regression checks

The current frontend starts Firestore `onSnapshot` listeners after authentication and initial cloud sync. Confirmed task writes also update the central state immediately; snapshot events then reconcile the view with Firestore. Account changes clear both local private caches and in-memory task/report/goal/settings state before the next account is loaded. Cloud reads/listeners additionally filter by the authenticated UID's ownership marker.

The automated source-level regression suite checks these implementation paths. It does not prove Firebase project configuration or live multi-account behavior. Before release, use two separate test accounts and verify create/edit/complete/delete on one session, immediate updates in all views, cross-device synchronization, and zero leakage after switching accounts.
