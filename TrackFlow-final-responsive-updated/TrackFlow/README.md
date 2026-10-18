# TrackFlow: Personal Productivity, Daily Schedule & Progress Tracking System

> A professional personal productivity and daily schedule tracking system powered by **Vanilla HTML5, CSS3, ES6+ JavaScript**, and backed by **Google Sheets** through a secure **Google Apps Script** serverless API.

---

## 🌟 Key Features

1. **Daily Productivity Dashboard**:
   - Real-time **100-Point Daily Score** calculation ($\min(100, \frac{\text{Earned Points}}{\text{Planned Points}} \times 100)$).
   - Planned, Completed, Pending, and Missed task counters.
   - Live **Consistency Streak Tracker** with flame counter and best streak records.
   - Next upcoming task alert banner with lead time indicator.
   - Overdue task warning system.
   - Mini weekly productivity trend preview.

2. **Daily Schedule Maker & Overlap Detection**:
   - Interactive timeline grid with 1-hour time blocks (06:00 to 23:00).
   - Real-time **Time Overlap Detection** that flags conflicting intervals before saving.
   - Task metadata: Category, Priority, Points, Time bounds, and Reminder preferences.
   - Instant 1-click completion toggle with automatic timestamping.

3. **All Tasks Manager**:
   - Multi-parameter filtering by Date, Category, Priority, and Status.
   - Sorting by Scheduled Time, Priority Weight, Highest Points, or Creation Date.
   - Live text search across titles, descriptions, and categories.

4. **Dedicated End-of-Day (EOD) Review**:
   - Evening reflection workflow (default reminder at 9:00 PM / 21:00).
   - Final status verification for all scheduled tasks.
   - Structured reflection prompts: Wins & Accomplishments, Challenges & Blockers, and Tomorrow's Priorities.
   - Prevents duplicate reports for the same date while preserving edit history.

5. **Monthly Goals**:
   - Completely independent by month (`monthKey`: `YYYY-MM`).
   - Changing one month's target never alters past or future months.
   - Dynamic progress bars with remaining targets and unit meters.
   - One-click **Auto-Sync** from authentic completed tasks matching category or criteria.

6. **Weekly & Monthly Analytics**:
   - **Weekly**: Daily score line chart and planned vs completed bar chart via Chart.js.
   - **Monthly**: GitHub-style interactive calendar activity heatmap with 4 intensity levels, category doughnut chart, and month-over-month comparisons.

7. **Notification & Reminder Engine**:
   - Browser Notifications API + PWA Service Worker.
   - 3-stage task reminders (Advance lead-time, Start-time focus alert, and 15-minute follow-up).
   - Configurable Quiet Hours (e.g. 23:00 to 07:00) with automatic audio muting.
   - Immediate reminder cancellation upon task completion.

8. **Google Sheets Cloud Persistence**:
   - 5 dedicated sheets: `Tasks`, `DailyReports`, `Goals`, `Settings`, and `ActivityLog`.
   - Concurrency locking with Apps Script `LockService`.
   - Server-side data validation and optional Bearer API Token authorization.
   - Automatic offline fallback and batch sync queue.

---

## 📁 Project Structure

```
TrackFlow/
├── frontend/
│   ├── index.html                 # Single-page application interface
│   ├── manifest.webmanifest       # PWA web manifest
│   ├── service-worker.js          # Offline cache & background notifications
│   ├── css/
│   │   └── styles.css             # Responsive design system (Dark & Light themes)
│   ├── js/
│   │   ├── config.js              # System defaults, categories, priorities
│   │   ├── state.js               # Reactive state store & subscriber pattern
│   │   ├── storage.js             # Local cache & offline sync queue
│   │   ├── scoring.js             # 100-Point scoring engine
│   │   ├── streak.js              # Consistency & streak tracker
│   │   ├── tasks.js               # Validation, overlap detection, filtering
│   │   ├── reminders.js           # Notifications API & foreground scheduler
│   │   ├── api.js                 # Google Apps Script Web App connector
│   │   ├── eod.js                 # End-of-Day review service
│   │   ├── goals.js               # Monthly goals manager
│   │   ├── analytics.js           # Chart.js visualizations & calendar heatmap
│   │   ├── settings.js            # Configuration & cloud connection manager
│   │   └── app.js                 # App lifecycle orchestrator & event bindings
│   └── assets/
│       ├── chart.umd.min.js       # Bundled Chart.js for offline use
│       ├── favicon.svg            # Vector icon
│       ├── icon-192.png           # PWA icon 192x192
│       └── icon-512.png           # PWA icon 512x512
├── backend/
│   ├── Code.gs                    # Google Apps Script API endpoints & sheet handlers
│   └── appsscript.json            # Apps Script manifest
├── tests/
│   ├── scoring.test.js            # Unit tests for scoring rules
│   ├── streak.test.js             # Unit tests for streak calculations
│   ├── tasks.test.js              # Unit tests for overlap & validation
│   └── run-tests.js               # Automated test runner
├── docs/
│   ├── SETUP.md                   # Google Sheets & Apps Script deployment guide
│   ├── DATA_SCHEMA.md             # Detailed 5-sheet database schema
│   ├── NOTIFICATIONS.md           # PWA, notifications, and platform reality guide
│   └── TESTING.md                 # 24-scenario verification matrix
└── README.md                      # Project documentation
```

---

## 🚀 Quick Start (Running Locally)

TrackFlow runs directly in any modern browser without requiring any Node.js dependencies to operate.

### Option 1: Using Python's Built-in HTTP Server
From the root of the project:
```bash
cd TrackFlow/frontend
python -m http.server 8080
```
Open your browser to: [http://localhost:8080](http://localhost:8080)

### Option 2: Running the Automated Test Suite
From the `TrackFlow/` root directory:
```bash
node tests/run-tests.js
```

---

## ☁️ Connecting to Google Sheets

1. Follow the step-by-step instructions in [docs/SETUP.md](file:///C:/Users/hp/.gemini/antigravity/scratch/TrackFlow/docs/SETUP.md) to deploy `backend/Code.gs` in your Google Drive.
2. In TrackFlow, navigate to **Settings**.
3. Paste your **Google Apps Script Web App URL**.
4. Click **🔌 Test Connection** and **📊 Initialize Sheets Structure**.
5. Your data will now automatically persist in your personal Google Sheet.

---

## 🔒 Security & Privacy

- **Zero Hardcoded Secrets**: No private credentials or API keys exist in frontend code.
- **Single-User Ownership**: All data resides inside your personal Google Drive / Google Sheets.
- **XSS Prevention**: All user-rendered strings are sanitized via safe DOM encoding.
- **Input Validation**: Both client-side and server-side validation protect data integrity.

---

## 📄 License
MIT License. Created for high-performance personal productivity.

## Secure multi-user setup

See [`docs/SECURITY_SETUP.md`](docs/SECURITY_SETUP.md) and deploy [`firestore.rules`](firestore.rules). Firebase Email/Password Authentication and Firestore must be configured before the app unlocks. The legacy Apps Script endpoint is not safe for multi-user use; it now fails closed when its shared token is missing, but that token is not per-user authorization. Existing local/Sheets records are not automatically assigned to new accounts.
