# TrackFlow Setup & Google Cloud Integration Guide

This guide walks you through connecting **TrackFlow** to your personal **Google Sheets** persistence layer via **Google Apps Script (GAS)**.

---

## 1. Prerequisites

- A free or Workspace **Google Account**.
- A modern web browser (Chrome, Edge, Firefox, Safari).
- TrackFlow frontend files hosted or opened locally.

---

## 2. Step-by-Step Google Sheets & Apps Script Setup

### Step 1: Create a New Google Sheet
1. Navigate to [sheets.new](https://sheets.new) in your browser.
2. Rename the spreadsheet to **`TrackFlow Data Store`**.
3. (Optional) Note the spreadsheet URL. You do not need to share it publicly.

---

### Step 2: Open the Apps Script Editor
1. In your newly created Google Sheet, click the top menu: **Extensions** > **Apps Script**.
2. Rename the Apps Script project to **`TrackFlow Backend`**.

---

### Step 3: Copy Backend Source Code
1. Replace the default content of `Code.gs` with the complete code from [TrackFlow/backend/Code.gs](file:///C:/Users/hp/.gemini/antigravity/scratch/TrackFlow/backend/Code.gs).
2. (Optional) Enable the manifest view in Apps Script by clicking **Project Settings (gear icon)** > check **"Show 'appsscript.json' manifest file in editor"**.
3. Replace the contents of `appsscript.json` with [TrackFlow/backend/appsscript.json](file:///C:/Users/hp/.gemini/antigravity/scratch/TrackFlow/backend/appsscript.json).

---

### Step 4: Deploy as a Web App
1. At the top right of the Apps Script editor, click the blue **Deploy** button > **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Configure the following deployment fields:
   - **Description**: `TrackFlow v1.0 Production`
   - **Execute as**: **Me (your_email@gmail.com)** *(ensures the script can read/write to your sheet on your behalf)*
   - **Who has access**: **Anyone** *(allows your frontend app to send authenticated HTTP requests to your personal Web App endpoint)*
4. Click **Deploy**.
5. When prompted, click **Authorize access**, select your Google account, click **Advanced**, and click **Go to TrackFlow Backend (unsafe)** to grant spreadsheet permissions to your own script.
6. Copy the generated **Web App URL**. It will look like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

### Step 5: (Optional) Set an Authentication Secret Token
For added peace of mind, you can protect your Web App with a private token:
1. In Apps Script, go to **Project Settings (gear icon)**.
2. Scroll down to **Script Properties** and click **Add script property**.
3. Property: `TRACKFLOW_AUTH_TOKEN`
4. Value: `your-secret-passphrase-here`
5. Click **Save script properties**.

---

### Step 6: Connect TrackFlow Frontend to Your Backend
1. Open the TrackFlow web application.
2. Click **Settings** in the left sidebar navigation.
3. In the **Google Apps Script Web App URL** field, paste your copied URL.
4. If you configured a secret token in Step 5, enter it into the **Secret Auth Token** field.
5. Click **🔌 Test Connection**. You should see a green success notice:
   ```
   ✓ Connected successfully! Google Apps Script Web App responded at 2026-10-17T...
   ```
6. Click **Save Cloud Config**.
7. Click **📊 Initialize Sheets Structure**. This will automatically create and format the 5 required sheets:
   - `Tasks`
   - `DailyReports`
   - `Goals`
   - `Settings`
   - `ActivityLog`

---

## 3. Automated Background Reminder Trigger (Optional)

TrackFlow includes a background check function in `Code.gs` (`checkUpcomingReminders`) that can be scheduled to run every 5 minutes:

1. In the Apps Script editor, click **Triggers (alarm clock icon)** in the left sidebar.
2. Click **+ Add Trigger** (bottom right).
3. Configure:
   - **Choose which function to run**: `checkUpcomingReminders`
   - **Choose which deployment should run**: `Head`
   - **Select event source**: `Time-driven`
   - **Select type of time based trigger**: `Minutes timer`
   - **Select minute interval**: `Every 5 minutes`
4. Click **Save**.

---

## 4. Troubleshooting & Verification

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| **HTTP 401 Unauthorized** | Token mismatch | Check `TRACKFLOW_AUTH_TOKEN` in Script Properties vs Settings. |
| **CORS / Preflight Error** | Strict POST headers | TrackFlow uses `text/plain;charset=utf-8` to bypass preflight OPTIONS blocks in GAS. |
| **Redirect (302) loop** | Fetch redirect behavior | TrackFlow explicitly sets `redirect: 'follow'` to handle Google redirects. |
| **"Execute as" Access Denied** | Web App permissions | Verify Web App deployment is set to "Execute as: Me" and "Who has access: Anyone". |
