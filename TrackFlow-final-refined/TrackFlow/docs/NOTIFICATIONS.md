# TrackFlow Notification & PWA Architecture

This document describes the notification system implemented in TrackFlow, including foreground browser alerts, service worker handling, and the technical realities of background notifications across web platforms.

---

## 1. Notification Architecture Overview

TrackFlow implements a multi-tier notification architecture:

```
┌────────────────────────────────────────────────────────┐
│                   TrackFlow Frontend                   │
│                                                        │
│  [ReminderService Scheduler] (Checks every 30s)        │
│    │                                                   │
│    ├── 1. Lead Time Alert (e.g. 10m before start)      │
│    ├── 2. Start Time Alert ("Time to Focus!")          │
│    ├── 3. Follow-up Alert (15m after start if pending) │
│    └── 4. EOD Review Alert (21:00 Evening Review)      │
└───────────────────────────┬────────────────────────────┘
                            │
               Permission Granted?
               ├── Yes ──► ServiceWorkerRegistration.showNotification()
               │           └── Fallback: window.Notification()
               └── No  ──► Graceful Toast Prompt
```

---

## 2. Notification Types & Trigger Rules

### A. Lead Time Reminder (Pre-task)
- **Timing**: Triggered `defaultLeadMinutes` (5, 10, 15, or 30 min) prior to `startTime`.
- **Message**: `"Upcoming Task: {title} - Starting in {X} mins ({startTime})"`.
- **Condition**: Task is `pending`, `reminderEnabled: true`, not in quiet hours.

### B. Start Time Reminder
- **Timing**: Triggered at scheduled `startTime`.
- **Message**: `"Time to Focus: {title} - Scheduled now ({startTime}). Earn {points} pts."`.
- **Condition**: Task is `pending`.

### C. Follow-up Reminder
- **Timing**: Triggered 15-20 minutes after `startTime` if task remains `pending`.
- **Message**: `"Task in Progress: {title} - Don't forget to mark this task complete."`.

### D. End-of-Day (EOD) Review Reminder
- **Timing**: Triggered at `dailyReviewTime` (default 21:00).
- **Message**: `"TrackFlow: Time for End-of-Day Review - Take 2 minutes to review today's tasks."`.
- **Condition**: EOD report for today has not yet been submitted.

### E. Quiet Hours Suppression
- Configurable quiet hours (default: `23:00` to `07:00`).
- During quiet hours, audible audio synthesis is automatically muted.

### F. Cancellation on Completion
- When a task is marked `completed` or deleted, all pending reminder tokens for that task are registered in `trackflow_fired_reminders` to suppress any subsequent alerts.

---

## 3. Technical Constraints: Foreground vs. Background Notifications

In accordance with strict engineering standards, we clearly document the boundaries of Web platform notifications:

| Platform / State | Behavior | Implementation |
| :--- | :--- | :--- |
| **Foreground Tab (Open & Active)** | Guaranteed instant alerts every 30 seconds. | Handled via `ReminderService.checkReminders()`. |
| **Background Tab (Minimized / Other Tab)** | Service Worker / Desktop Notification will pop up in system notification center. | Handled via `registration.showNotification()`. |
| **Browser Closed (Desktop Windows/macOS)** | Standard JavaScript timers stop executing. | Requires OS-level Web Push service (VAPID / FCM) or native companion daemon. |
| **Mobile Screen Off / Deep Sleep (Android/iOS)** | Mobile OS aggressively suspends browser processes to conserve battery. | Web Push with FCM / APNs payload required for lockscreen wake. |

### Background Server-Side Scheduler Alternative
Because Google Apps Script runs entirely on Google's cloud servers, you can also use Google's native time-driven trigger:
- Function: `checkUpcomingReminders()` in `backend/Code.gs`.
- Schedule: Runs every 5 minutes in the background, completely independent of whether your laptop or phone is awake.
- Can be extended to trigger an email notification (`MailApp.sendEmail`) or Webhook push.

---

## 4. Testing Notification System

1. Open TrackFlow **Settings**.
2. Click **🔔 Test Notification**.
3. If permissions were not previously granted, your browser will prompt: *"TrackFlow wants to show notifications"*. Click **Allow**.
4. A notification titled **"TrackFlow Notification Test"** with the TrackFlow logo will immediately appear in your operating system's notification center.
