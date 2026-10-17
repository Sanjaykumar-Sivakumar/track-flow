/**
 * TrackFlow - Google Apps Script Backend
 * Persistent Cloud Data Store and API Integration Layer
 * 
 * Version: 1.0.0
 * Architecture: Clean Sheets schema with script locks, batch operations, 
 * token security, and strict server-side validation.
 */

// Configuration Constants
const SHEET_NAMES = {
  TASKS: 'Tasks',
  DAILY_REPORTS: 'DailyReports',
  GOALS: 'Goals',
  SETTINGS: 'Settings',
  ACTIVITY_LOG: 'ActivityLog'
};

const SCHEMAS = {
  TASKS: [
    'taskId', 'userId', 'title', 'description', 'date', 
    'startTime', 'endTime', 'category', 'priority', 'plannedPoints', 
    'status', 'reminderEnabled', 'reminderTime', 'createdAt', 
    'updatedAt', 'completedAt', 'notes'
  ],
  DAILY_REPORTS: [
    'reportId', 'date', 'plannedPoints', 'earnedPoints', 'dailyScore', 
    'plannedTaskCount', 'completedTaskCount', 'pendingTaskCount', 
    'missedTaskCount', 'successfulDay', 'reviewNotes', 'challenges', 
    'tomorrowPriorities', 'submittedAt', 'updatedAt'
  ],
  GOALS: [
    'goalId', 'monthKey', 'title', 'description', 'targetValue', 
    'currentValue', 'unit', 'startDate', 'endDate', 'status', 
    'createdAt', 'updatedAt'
  ],
  SETTINGS: [
    'key', 'value', 'updatedAt'
  ],
  ACTIVITY_LOG: [
    'logId', 'timestamp', 'action', 'entityType', 'entityId', 'details'
  ]
};

// ============================================================================
// HTTP ROUTER (doGet & doPost)
// ============================================================================

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || 'ping';

    // Verify authentication if configured
    if (!verifyAuthToken(params.authToken)) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid or missing authToken' }, 401);
    }

    let result;
    switch (action) {
      case 'ping':
        result = { success: true, message: 'TrackFlow Apps Script API is active', timestamp: new Date().toISOString() };
        break;
      case 'init':
        result = initSpreadsheet();
        break;
      case 'getTasks':
        result = getTasks(params);
        break;
      case 'getDailyReports':
        result = getDailyReports(params);
        break;
      case 'getGoals':
        result = getGoals(params);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'getAnalytics':
        result = getAggregatedAnalytics(params);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    logActivity('ERROR', 'SYSTEM', 'doGet', err.toString());
    return jsonResponse({ success: false, error: err.message || err.toString() }, 500);
  }
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Acquire lock to prevent concurrent write collisions (15 sec timeout)
    lock.waitLock(15000);

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        return jsonResponse({ success: false, error: 'Malformed JSON payload' }, 400);
      }
    }

    const action = payload.action || (e && e.parameter ? e.parameter.action : '');
    const authToken = payload.authToken || (e && e.parameter ? e.parameter.authToken : '');

    // Verify token
    if (!verifyAuthToken(authToken)) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid or missing authToken' }, 401);
    }

    let result;
    switch (action) {
      case 'saveTask':
        result = saveTask(payload.task);
        break;
      case 'updateTaskStatus':
        result = updateTaskStatus(payload.taskId, payload.status, payload.notes);
        break;
      case 'deleteTask':
        result = deleteTask(payload.taskId);
        break;
      case 'saveDailyReport':
        result = saveDailyReport(payload.report);
        break;
      case 'saveGoal':
        result = saveGoal(payload.goal);
        break;
      case 'deleteGoal':
        result = deleteGoal(payload.goalId);
        break;
      case 'saveSettings':
        result = saveSettings(payload.settings);
        break;
      case 'batchSync':
        result = handleBatchSync(payload);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    logActivity('ERROR', 'SYSTEM', 'doPost', err.toString());
    return jsonResponse({ success: false, error: err.message || err.toString() }, 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

/**
 * Helper to construct JSON response
 */
function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Auth token verification
 * Allows user to secure their Web App with an optional secret token.
 */
function verifyAuthToken(providedToken) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const configuredToken = scriptProperties.getProperty('TRACKFLOW_AUTH_TOKEN');
  
  // Fail closed: an unset shared token must never expose the spreadsheet API.
  // This token is only a deployment gate, NOT per-user authentication.
  if (!configuredToken || !providedToken) return false;
  return constantTimeEquals(String(providedToken), String(configuredToken));
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ============================================================================
// SPREADSHEET INITIALIZATION & SCHEMA MANAGEMENT
// ============================================================================

/**
 * Initialize all required sheets with formatting and default schemas
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const createdSheets = [];

  Object.keys(SHEET_NAMES).forEach(key => {
    const sheetName = SHEET_NAMES[key];
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      createdSheets.push(sheetName);
    }

    const headers = SCHEMAS[key];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      
      // Styling header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#f8fafc');
      sheet.setFrozenRows(1);
    }
  });

  // Ensure default settings exist
  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (settingsSheet && settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['timezone', 'Asia/Kolkata', new Date().toISOString()],
      ['dailyReviewTime', '21:00', new Date().toISOString()],
      ['successThreshold', '80', new Date().toISOString()],
      ['scoringMode', 'weighted', new Date().toISOString()],
      ['defaultReminderLeadMinutes', '10', new Date().toISOString()],
      ['quietHoursStart', '23:00', new Date().toISOString()],
      ['quietHoursEnd', '07:00', new Date().toISOString()],
      ['theme', 'system', new Date().toISOString()]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
  }

  logActivity('INFO', 'SYSTEM', 'initSpreadsheet', 'Spreadsheet structure initialized');
  return { 
    success: true, 
    message: 'Spreadsheet structure initialized successfully', 
    createdSheets: createdSheets 
  };
}

// ============================================================================
// TASKS OPERATIONS
// ============================================================================

/**
 * Retrieve tasks with optional filters (date, month, status, category)
 */
function getTasks(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, tasks: [] };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  const dateFilter = params.date;
  const monthFilter = params.monthKey; // YYYY-MM
  const statusFilter = params.status;
  const categoryFilter = params.category;

  const tasks = [];
  rows.forEach(row => {
    const task = rowToObject(headers, row);
    if (!task.taskId) return;

    // Normalize date string (YYYY-MM-DD)
    if (task.date instanceof Date) {
      task.date = Utilities.formatDate(task.date, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    }

    // Apply filters
    if (dateFilter && task.date !== dateFilter) return;
    if (monthFilter && (!task.date || !task.date.startsWith(monthFilter))) return;
    if (statusFilter && task.status !== statusFilter) return;
    if (categoryFilter && task.category !== categoryFilter) return;

    // Parse types
    task.plannedPoints = Number(task.plannedPoints) || 0;
    task.reminderEnabled = (task.reminderEnabled === true || task.reminderEnabled === 'true' || task.reminderEnabled === 1);

    tasks.push(task);
  });

  return { success: true, tasks: tasks };
}

/**
 * Create or update a task with server-side validation
 */
function saveTask(task) {
  if (!task || !task.title || !task.date) {
    return { success: false, error: 'Validation failed: Task title and date are required' };
  }

  // Sanitize and validate inputs
  task.title = String(task.title).trim().substring(0, 200);
  task.description = String(task.description || '').trim().substring(0, 1000);
  task.category = task.category || 'General';
  task.priority = ['urgent', 'high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium';
  task.status = ['pending', 'completed', 'missed', 'rescheduled'].includes(task.status) ? task.status : 'pending';
  task.plannedPoints = Math.max(0, Math.min(100, Number(task.plannedPoints) || 0));
  task.reminderEnabled = !!task.reminderEnabled;
  task.reminderTime = task.reminderTime || '';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!sheet) initSpreadsheet();

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const now = new Date().toISOString();

  // If new task without ID, generate unique UUID
  if (!task.taskId) {
    task.taskId = 'tsk_' + Utilities.getUuid();
    task.createdAt = now;
    task.updatedAt = now;
    if (task.status === 'completed' && !task.completedAt) {
      task.completedAt = now;
    }

    const row = objectToRow(headers, task);
    sheet.appendRow(row);
    logActivity('CREATE', 'TASK', task.taskId, 'Created task: ' + task.title);
    return { success: true, task: task, message: 'Task created successfully' };
  }

  // Update existing task
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][headers.indexOf('taskId')] === task.taskId) {
      rowIndex = i + 1;
      break;
    }
  }

  task.updatedAt = now;
  if (task.status === 'completed' && !task.completedAt) {
    task.completedAt = now;
  } else if (task.status !== 'completed') {
    task.completedAt = '';
  }

  if (rowIndex > 0) {
    const existingRow = values[rowIndex - 1];
    task.createdAt = existingRow[headers.indexOf('createdAt')] || now;
    const row = objectToRow(headers, task);
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
    logActivity('UPDATE', 'TASK', task.taskId, 'Updated task: ' + task.title);
    return { success: true, task: task, message: 'Task updated successfully' };
  } else {
    // Retried creation with client-provided unique ID
    task.createdAt = task.createdAt || now;
    const row = objectToRow(headers, task);
    sheet.appendRow(row);
    logActivity('CREATE', 'TASK', task.taskId, 'Appended task with ID: ' + task.taskId);
    return { success: true, task: task, message: 'Task created successfully' };
  }
}

/**
 * Update task status (e.g. Instant Completion)
 */
function updateTaskStatus(taskId, status, notes) {
  if (!taskId || !status) {
    return { success: false, error: 'taskId and status are required' };
  }

  const validStatuses = ['pending', 'completed', 'missed', 'rescheduled'];
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Invalid status: ' + status };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!sheet) return { success: false, error: 'Tasks sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('taskId');
  const statusIndex = headers.indexOf('status');
  const updatedAtIndex = headers.indexOf('updatedAt');
  const completedAtIndex = headers.indexOf('completedAt');
  const notesIndex = headers.indexOf('notes');

  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] === taskId) {
      const rowIndex = i + 1;
      const now = new Date().toISOString();
      const completedAt = status === 'completed' ? (values[i][completedAtIndex] || now) : '';

      sheet.getRange(rowIndex, statusIndex + 1).setValue(status);
      sheet.getRange(rowIndex, updatedAtIndex + 1).setValue(now);
      sheet.getRange(rowIndex, completedAtIndex + 1).setValue(completedAt);
      if (notes !== undefined && notesIndex >= 0) {
        sheet.getRange(rowIndex, notesIndex + 1).setValue(notes);
      }

      logActivity('UPDATE_STATUS', 'TASK', taskId, 'Status updated to: ' + status);
      return { 
        success: true, 
        taskId: taskId, 
        status: status, 
        completedAt: completedAt,
        message: 'Task status updated to ' + status 
      };
    }
  }

  return { success: false, error: 'Task not found: ' + taskId };
}

/**
 * Delete a task by ID
 */
function deleteTask(taskId) {
  if (!taskId) return { success: false, error: 'taskId is required' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!sheet) return { success: false, error: 'Tasks sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('taskId');

  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] === taskId) {
      sheet.deleteRow(i + 1);
      logActivity('DELETE', 'TASK', taskId, 'Deleted task');
      return { success: true, message: 'Task deleted successfully' };
    }
  }

  return { success: false, error: 'Task not found: ' + taskId };
}

// ============================================================================
// DAILY REPORTS & EOD REVIEWS
// ============================================================================

/**
 * Get daily reports with optional date/range filter
 */
function getDailyReports(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DAILY_REPORTS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, reports: [] };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  const dateFilter = params.date;
  const monthFilter = params.monthKey;

  const reports = [];
  rows.forEach(row => {
    const report = rowToObject(headers, row);
    if (!report.reportId) return;

    if (report.date instanceof Date) {
      report.date = Utilities.formatDate(report.date, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    }

    if (dateFilter && report.date !== dateFilter) return;
    if (monthFilter && (!report.date || !report.date.startsWith(monthFilter))) return;

    report.plannedPoints = Number(report.plannedPoints) || 0;
    report.earnedPoints = Number(report.earnedPoints) || 0;
    report.dailyScore = Number(report.dailyScore) || 0;
    report.successfulDay = (report.successfulDay === true || report.successfulDay === 'true' || report.successfulDay === 1);

    reports.push(report);
  });

  return { success: true, reports: reports };
}

/**
 * Save or update End-of-Day review report
 */
function saveDailyReport(report) {
  if (!report || !report.date) {
    return { success: false, error: 'Validation failed: Report date is required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DAILY_REPORTS);
  if (!sheet) initSpreadsheet();

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const dateIndex = headers.indexOf('date');
  const now = new Date().toISOString();

  // Sanitize numerical scores
  report.plannedPoints = Math.max(0, Number(report.plannedPoints) || 0);
  report.earnedPoints = Math.max(0, Number(report.earnedPoints) || 0);
  report.dailyScore = report.plannedPoints > 0 
    ? Math.min(100, Math.round((report.earnedPoints / report.plannedPoints) * 100))
    : 0;

  report.plannedTaskCount = Number(report.plannedTaskCount) || 0;
  report.completedTaskCount = Number(report.completedTaskCount) || 0;
  report.pendingTaskCount = Number(report.pendingTaskCount) || 0;
  // Server-side validation of successfulDay against configured threshold
  let threshold = 80;
  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (settingsSheet && settingsSheet.getLastRow() > 1) {
    const sValues = settingsSheet.getDataRange().getValues();
    for (let s = 1; s < sValues.length; s++) {
      if (sValues[s][0] === 'successThreshold') {
        threshold = Number(sValues[s][1]) || 80;
        break;
      }
    }
  }
  report.successfulDay = (report.dailyScore >= threshold && report.plannedPoints > 0);

  // Check if report already exists for this date to prevent duplicate reports
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    let rowDate = values[i][dateIndex];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    }
    if (rowDate === report.date) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    // Update existing report
    const existingRow = values[rowIndex - 1];
    report.reportId = existingRow[headers.indexOf('reportId')];
    report.submittedAt = existingRow[headers.indexOf('submittedAt')] || now;
    report.updatedAt = now;

    const row = objectToRow(headers, report);
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
    logActivity('UPDATE', 'DAILY_REPORT', report.reportId, 'Updated EOD Report for ' + report.date);
    return { success: true, report: report, message: 'EOD report updated successfully' };
  } else {
    // Create new report
    report.reportId = report.reportId || 'rep_' + Utilities.getUuid();
    report.submittedAt = now;
    report.updatedAt = now;

    const row = objectToRow(headers, report);
    sheet.appendRow(row);
    logActivity('CREATE', 'DAILY_REPORT', report.reportId, 'Created EOD Report for ' + report.date);
    return { success: true, report: report, message: 'EOD report saved successfully' };
  }
}

// ============================================================================
// MONTHLY GOALS
// ============================================================================

/**
 * Retrieve goals, optionally filtered by monthKey (YYYY-MM)
 */
function getGoals(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.GOALS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, goals: [] };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);
  const monthFilter = params.monthKey;

  const goals = [];
  rows.forEach(row => {
    const goal = rowToObject(headers, row);
    if (!goal.goalId) return;

    if (monthFilter && goal.monthKey !== monthFilter) return;

    goal.targetValue = Number(goal.targetValue) || 0;
    goal.currentValue = Number(goal.currentValue) || 0;

    goals.push(goal);
  });

  return { success: true, goals: goals };
}

/**
 * Save or update a monthly goal
 */
function saveGoal(goal) {
  if (!goal || !goal.title || !goal.monthKey) {
    return { success: false, error: 'Validation failed: Goal title and monthKey (YYYY-MM) are required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.GOALS);
  if (!sheet) initSpreadsheet();

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const now = new Date().toISOString();

  goal.title = String(goal.title).trim().substring(0, 200);
  goal.targetValue = Math.max(1, Number(goal.targetValue) || 1);
  goal.currentValue = Math.max(0, Number(goal.currentValue) || 0);
  goal.unit = goal.unit || 'sessions';
  goal.status = ['active', 'completed', 'archived'].includes(goal.status) ? goal.status : 'active';

  let rowIndex = -1;
  if (goal.goalId) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][headers.indexOf('goalId')] === goal.goalId) {
        rowIndex = i + 1;
        break;
      }
    }
  }

  if (rowIndex > 0) {
    const existingRow = values[rowIndex - 1];
    goal.createdAt = existingRow[headers.indexOf('createdAt')] || now;
    goal.updatedAt = now;

    const row = objectToRow(headers, goal);
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
    logActivity('UPDATE', 'GOAL', goal.goalId, 'Updated goal: ' + goal.title);
    return { success: true, goal: goal, message: 'Goal updated successfully' };
  } else {
    goal.goalId = goal.goalId || 'gol_' + Utilities.getUuid();
    goal.createdAt = now;
    goal.updatedAt = now;

    const row = objectToRow(headers, goal);
    sheet.appendRow(row);
    logActivity('CREATE', 'GOAL', goal.goalId, 'Created goal: ' + goal.title);
    return { success: true, goal: goal, message: 'Goal created successfully' };
  }
}

/**
 * Delete a goal by ID
 */
function deleteGoal(goalId) {
  if (!goalId) return { success: false, error: 'goalId is required' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.GOALS);
  if (!sheet) return { success: false, error: 'Goals sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('goalId');

  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] === goalId) {
      sheet.deleteRow(i + 1);
      logActivity('DELETE', 'GOAL', goalId, 'Deleted goal');
      return { success: true, message: 'Goal deleted successfully' };
    }
  }

  return { success: false, error: 'Goal not found: ' + goalId };
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Get all settings as key-value map
 */
function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, settings: {} };
  }

  const values = sheet.getDataRange().getValues();
  const settings = {};

  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    const val = values[i][1];
    if (key) {
      settings[key] = val;
    }
  }

  return { success: true, settings: settings };
}

/**
 * Save settings key-value map
 */
function saveSettings(newSettings) {
  if (!newSettings || typeof newSettings !== 'object') {
    return { success: false, error: 'Settings object required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) initSpreadsheet();

  const values = sheet.getDataRange().getValues();
  const existingKeys = {};
  for (let i = 1; i < values.length; i++) {
    existingKeys[values[i][0]] = i + 1; // 1-indexed row
  }

  const now = new Date().toISOString();
  Object.keys(newSettings).forEach(key => {
    const value = String(newSettings[key]);
    if (existingKeys[key]) {
      sheet.getRange(existingKeys[key], 2, 1, 2).setValues([[value, now]]);
    } else {
      sheet.appendRow([key, value, now]);
    }
  });

  logActivity('UPDATE', 'SETTINGS', 'SYSTEM', 'Settings updated');
  return { success: true, message: 'Settings saved successfully' };
}

// ============================================================================
// AGGREGATED ANALYTICS
// ============================================================================

/**
 * Calculate weekly or monthly analytics on backend using authentic records
 */
function getAggregatedAnalytics(params) {
  const period = params.period || 'week'; // 'week' | 'month'
  const startDateStr = params.startDate; // YYYY-MM-DD
  const endDateStr = params.endDate;     // YYYY-MM-DD

  const tasksRes = getTasks({});
  const reportsRes = getDailyReports({});

  const allTasks = tasksRes.tasks || [];
  const allReports = reportsRes.reports || [];

  // Filter tasks and reports in range
  const filteredTasks = allTasks.filter(t => t.date >= startDateStr && t.date <= endDateStr);
  const filteredReports = allReports.filter(r => r.date >= startDateStr && r.date <= endDateStr);

  const totalPlanned = filteredTasks.length;
  const totalCompleted = filteredTasks.filter(t => t.status === 'completed').length;
  const totalMissed = filteredTasks.filter(t => t.status === 'missed').length;

  let totalScoreSum = 0;
  let successfulDaysCount = 0;
  filteredReports.forEach(r => {
    totalScoreSum += Number(r.dailyScore) || 0;
    if (r.successfulDay) successfulDaysCount++;
  });

  const avgScore = filteredReports.length > 0 ? Math.round(totalScoreSum / filteredReports.length) : 0;

  return {
    success: true,
    period: period,
    startDate: startDateStr,
    endDate: endDateStr,
    summary: {
      totalPlannedTasks: totalPlanned,
      totalCompletedTasks: totalCompleted,
      totalMissedTasks: totalMissed,
      completionRate: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
      averageDailyScore: avgScore,
      successfulDays: successfulDaysCount,
      reportCount: filteredReports.length
    },
    tasks: filteredTasks,
    reports: filteredReports
  };
}

// ============================================================================
// BATCH SYNC (OFFLINE QUEUE SYNCHRONIZATION)
// ============================================================================

/**
 * Process a batch of pending mutations from an offline sync queue
 */
function handleBatchSync(payload) {
  const operations = payload.operations || [];
  const results = [];

  operations.forEach(op => {
    try {
      let opResult;
      switch (op.type) {
        case 'saveTask':
          opResult = saveTask(op.data);
          break;
        case 'updateTaskStatus':
          opResult = updateTaskStatus(op.data.taskId, op.data.status, op.data.notes);
          break;
        case 'deleteTask':
          opResult = deleteTask(op.data.taskId);
          break;
        case 'saveDailyReport':
          opResult = saveDailyReport(op.data);
          break;
        case 'saveGoal':
          opResult = saveGoal(op.data);
          break;
        default:
          opResult = { success: false, error: 'Unknown op: ' + op.type };
      }
      results.push({ opId: op.id, success: opResult.success, result: opResult });
    } catch (e) {
      results.push({ opId: op.id, success: false, error: e.toString() });
    }
  });

  return { success: true, processed: results.length, results: results };
}

// ============================================================================
// AUDIT LOGGING & TRIGGER REMINDERS
// ============================================================================

/**
 * Append entry to ActivityLog
 */
function logActivity(action, entityType, entityId, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY_LOG);
    if (!sheet) return;

    sheet.appendRow([
      'log_' + Utilities.getUuid(),
      new Date().toISOString(),
      action,
      entityType,
      entityId,
      details
    ]);
  } catch (e) {
    console.error('Failed to write activity log:', e);
  }
}

/**
 * Background Scheduler Trigger (Can be attached to a 5-minute time-driven trigger)
 * Checks for tasks starting in the next 15 minutes that have reminderEnabled=true
 */
function checkUpcomingReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd');
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!sheet || sheet.getLastRow() <= 1) return;

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const dateIdx = headers.indexOf('date');
  const statusIdx = headers.indexOf('status');
  const timeIdx = headers.indexOf('startTime');
  const reminderIdx = headers.indexOf('reminderEnabled');
  const titleIdx = headers.indexOf('title');

  values.slice(1).forEach(row => {
    let rowDate = row[dateIdx];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, timeZone, 'yyyy-MM-dd');
    }
    const status = row[statusIdx];
    const reminderEnabled = (row[reminderIdx] === true || row[reminderIdx] === 'true');
    const startTime = row[timeIdx];

    if (rowDate === todayStr && status === 'pending' && reminderEnabled && startTime) {
      const parts = startTime.split(':');
      if (parts.length === 2) {
        const taskMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        const diff = taskMinutes - currentMinutes;

        // If starting in 5-15 minutes, trigger notification/log
        if (diff > 0 && diff <= 15) {
          logActivity('REMINDER_TRIGGER', 'TASK', row[headers.indexOf('taskId')], 
            'Upcoming task reminder: "' + row[titleIdx] + '" starts in ' + diff + ' mins');
        }
      }
    }
  });
}

// ============================================================================
// UTILITY / CONVERSION HELPERS
// ============================================================================

/**
 * Convert spreadsheet row array to object based on column headers
 */
function rowToObject(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    obj[key] = (row[i] !== undefined && row[i] !== null) ? row[i] : '';
  }
  return obj;
}

/**
 * Convert object to array matching column headers order
 */
function objectToRow(headers, obj) {
  const row = [];
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    let val = obj[key];
    if (val === undefined || val === null) {
      val = '';
    }
    row.push(val);
  }
  return row;
}

