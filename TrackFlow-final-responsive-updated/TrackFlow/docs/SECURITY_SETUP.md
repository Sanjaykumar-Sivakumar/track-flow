# TrackFlow secure account setup

## Required Firebase setup

1. Create a Firebase project at https://console.firebase.google.com/.
2. Add a Web app and copy its web configuration into `frontend/js/firebase-config.js`. These web config values are public identifiers, not service-account credentials. Never commit service-account JSON or Admin SDK credentials.
3. In **Authentication → Sign-in method**, enable **Email/Password**.
4. In **Firestore Database**, create a database and deploy the repository's `firestore.rules` rules. Do not use test mode or permissive `allow read, write: if true` rules.
5. Add the exact production/preview domains in **Authentication → Settings → Authorized domains**.
6. Serve the frontend over HTTPS (or localhost for development). Firebase SDKs are loaded from Google's CDN, so the first load requires internet access.
7. Open the app, create an account, then test with two synthetic accounts before importing any existing data.

## Data model and isolation

Cloud records live below `users/{Firebase Auth UID}/tasks`, `reports`, `goals`, and `private/settings`. Firestore rules require the authenticated UID to match the path UID and enforce the record owner UID. The client does not accept a user UID from a request to select another user's collection.

Legacy browser data is deliberately cleared on first account sign-in and account switching. It is not automatically uploaded because legacy records have no trustworthy owner. Export/back up legacy data and manually review it before importing into an identified account.

## Google Apps Script / Sheets warning

The Apps Script API is a legacy single-spreadsheet API, not a multi-user identity provider. It now fails closed if `TRACKFLOW_AUTH_TOKEN` is missing, but a shared token still does **not** prove individual user identity and its existing handlers do not consistently enforce row-level ownership. Do not connect the GAS endpoint for multi-user use. Use Firebase/Firestore for authenticated multi-user data. If retaining GAS for a single trusted operator, set a long random `TRACKFLOW_AUTH_TOKEN` in Script Properties and keep the endpoint private; never treat this as per-user authorization.

## Current implementation boundaries

Firebase Auth provides email/password registration, login, session restoration, logout, and password reset. Firestore cloud operations currently cover tasks, task status, task deletion, daily reports, goals, and settings. The client uses Firestore snapshot listeners to propagate task, report, goal, and settings changes to other signed-in devices. This is not a full offline-first synchronization engine: mutations that fail to reach Firestore are not queued for later upload, and concurrent conflict resolution is not implemented. Do not represent a failed write as saved. Analytics and streaks are derived from the signed-in account's cloud-loaded records. Verify all flows against a configured Firebase project before production use.

## Migration

No existing Google Sheets or localStorage records are migrated automatically. Records in the legacy Sheets file may have missing/ambiguous owners; assigning them to an account without evidence would risk exposing one person's records to another. Back up the spreadsheet, inspect ownership, and migrate only records whose owner is established.
