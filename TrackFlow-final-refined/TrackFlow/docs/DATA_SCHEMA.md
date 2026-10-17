# TrackFlow Google Sheets Data Schema

TrackFlow uses Google Sheets as its primary persistent cloud storage. The database schema consists of 5 dedicated sheets created and managed automatically by `backend/Code.gs`.

---

## 1. Sheet: `Tasks`
Primary operational table storing all daily scheduled tasks and completion metadata.

| Column Name | Type | Constraints / Format | Description |
| :--- | :--- | :--- | :--- |
| `taskId` | String | Primary Key, `tsk_...` (UUID) | Stable unique task identifier. |
| `userId` | String | Optional (default: `default_user`) | Single or multi-user identifier. |
| `title` | String | Required, max 200 chars | Name of the task or focus session. |
| `description`| String | Optional, max 1000 chars | Context, notes, or reference links. |
| `date` | String | `YYYY-MM-DD` | Scheduled calendar date. |
| `startTime` | String | `HH:MM` (24-hour) | Scheduled start time. |
| `endTime` | String | `HH:MM` (24-hour) | Scheduled end time (must be > startTime). |
| `category` | String | Enum (`Study`, `Coding`, `Project`, `Work`, `Interview Preparation`, `Personal`, `Health`, `Other`) | Category classification for analytics. |
| `priority` | String | Enum (`urgent`, `high`, `medium`, `low`) | Priority weighting level. |
| `plannedPoints` | Integer | Range: 0 to 100 | Points allocated toward daily 100-point total. |
| `status` | String | Enum (`pending`, `completed`, `missed`, `rescheduled`) | Authoritative source of scoring truth. |
| `reminderEnabled` | Boolean | `true` / `false` | Whether alerts trigger for this task. |
| `reminderTime` | String | `HH:MM` | Specific trigger time. |
| `createdAt` | ISO 8601 | e.g. `2026-10-17T12:00:00.000Z` | Record creation timestamp. |
| `updatedAt` | ISO 8601 | e.g. `2026-10-17T12:15:00.000Z` | Last modification timestamp. |
| `completedAt`| ISO 8601 | Blank if not completed | Authoritative timestamp of completion. |
| `notes` | String | Optional | Completion notes or outcome reflection. |

---

## 2. Sheet: `DailyReports`
Stores historical End-of-Day (EOD) snapshots and reflection reviews. Immutable once submitted, with edit history preserved.

| Column Name | Type | Constraints / Format | Description |
| :--- | :--- | :--- | :--- |
| `reportId` | String | Primary Key, `rep_...` | Unique snapshot identifier. |
| `date` | String | Unique per day, `YYYY-MM-DD` | Date of the snapshot. |
| `plannedPoints` | Integer | $\ge 0$ | Total points planned across day's tasks. |
| `earnedPoints` | Integer | $\ge 0$ | Total points earned from completed tasks. |
| `dailyScore` | Integer | Range: 0 to 100 | Final percentage score $\min(100, \frac{\text{earned}}{\text{planned}} \times 100)$. |
| `plannedTaskCount` | Integer | $\ge 0$ | Number of tasks planned for the day. |
| `completedTaskCount` | Integer | $\ge 0$ | Number of tasks marked completed. |
| `pendingTaskCount` | Integer | $\ge 0$ | Number of tasks left pending. |
| `missedTaskCount` | Integer | $\ge 0$ | Number of tasks flagged as missed. |
| `successfulDay` | Boolean | `true` / `false` | Whether `dailyScore` meets configured threshold ($\ge 80\%$). |
| `reviewNotes` | String | Text | Daily wins, accomplishments, and focus outcomes. |
| `challenges` | String | Text | Obstacles, context switching, or blockers. |
| `tomorrowPriorities`| String | Text | Top 3 priorities for the following day. |
| `submittedAt` | ISO 8601 | Timestamp | Initial submission timestamp. |
| `updatedAt` | ISO 8601 | Timestamp | Last update timestamp. |

---

## 3. Sheet: `Goals`
Stores monthly goals with isolated tracking per calendar month (`monthKey`).

| Column Name | Type | Constraints / Format | Description |
| :--- | :--- | :--- | :--- |
| `goalId` | String | Primary Key, `gol_...` | Unique goal identifier. |
| `monthKey` | String | Format: `YYYY-MM` | Isolates goals by month (e.g. `2026-10`). |
| `title` | String | Required | Specific goal title. |
| `description` | String | Optional | Description of purpose and milestones. |
| `targetValue` | Number | $\ge 1$ | Numeric target (e.g. 40). |
| `currentValue` | Number | $\ge 0$ | Current progress achieved. |
| `unit` | String | e.g. `problems`, `hours`, `sessions`, `days` | Unit of measure. |
| `startDate` | String | `YYYY-MM-DD` | Start boundary of goal. |
| `endDate` | String | `YYYY-MM-DD` | End boundary of goal. |
| `status` | String | Enum (`active`, `completed`, `archived`) | Goal status. |
| `createdAt` | ISO 8601 | Timestamp | Creation timestamp. |
| `updatedAt` | ISO 8601 | Timestamp | Last update timestamp. |

---

## 4. Sheet: `Settings`
Key-value configuration store for system settings.

| Column Name | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `key` | String | Primary Key, `timezone` | Setting identifier name. |
| `value` | String | `Asia/Kolkata` | Configured stringified value. |
| `updatedAt` | ISO 8601 | Timestamp | Timestamp of last setting change. |

**Default Keys**:
- `timezone`: e.g. `Asia/Kolkata`
- `dailyReviewTime`: e.g. `21:00`
- `successThreshold`: e.g. `80`
- `scoringMode`: `weighted` or `equal`
- `defaultReminderLeadMinutes`: `10`
- `quietHoursStart`: `23:00`
- `quietHoursEnd`: `07:00`
- `theme`: `dark` | `light` | `system`

---

## 5. Sheet: `ActivityLog`
Audit trail recording data mutations, trigger executions, and errors.

| Column Name | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `logId` | String | `log_...` | Unique log entry ID. |
| `timestamp` | ISO 8601 | Timestamp | Time of action. |
| `action` | String | `CREATE`, `UPDATE_STATUS`, `DELETE`, `ERROR` | Operation performed. |
| `entityType` | String | `TASK`, `DAILY_REPORT`, `GOAL`, `SYSTEM` | Target entity. |
| `entityId` | String | Target ID or `SYSTEM` | Identifier of affected entity. |
| `details` | String | Text | Operational description or error details. |
