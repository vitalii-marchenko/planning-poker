---
name: clasp-deployment
description: "Deploys, pushes, or status-checks Google Apps Script backend changes using the CLASP tool."
---

# Google Apps Script Clasp Deployment Skill

This skill outlines how to deploy local Google Apps Script backend changes (`Code.gs` and `appsscript.json`) to the remote Google Apps Script container using the CLASP (Command Line Apps Script Projects) tool.

## Activation/Triggering

This skill is active when executing tasks related to:
* Pushing local backend changes (`Code.gs`, `appsscript.json`) to Google Apps Script.
* Status checks or pulls of Apps Script code.
* Troubleshooting Apps Script deployments or configuration.

## Configuration & Files

* **[.clasp.json](file:///Users/vitaliimarchenko/workplace/planning-poker-app/.clasp.json)**: Links the local environment to the Apps Script project (via `scriptId`).
* **[.claspignore](file:///Users/vitaliimarchenko/workplace/planning-poker-app/.claspignore)**: Specifies which files to exclude (e.g., ignoring everything except `Code.gs` and `appsscript.json`).

## Commands & Workflows

### 1. Verify Authentication
To verify clasp is authorized to interact with Google API:
```bash
clasp status
```
If clasp is unauthorized, ask the user to log in or run:
```bash
clasp login
```
*Note: Logging in is interactive and opens a browser window. If execution is automated/headless, prompt the user to run `clasp login` on their local terminal.*

### 2. Push Changes
To compile and upload local changes to the Apps Script project:
```bash
clasp push
```
If you want to watch for local changes and push them automatically during development:
```bash
clasp push --watch
```

### 3. Deploy/Re-deploy (Version Management)
To list existing deployments:
```bash
clasp deployments
```
To create a new versioned deployment (e.g., Web App release):
```bash
clasp deploy
```
To update an existing deployment (e.g., for Web App URL updates):
```bash
clasp deploy -i <deploymentId> -d "Deployment Description"
```

## Best Practices & Safety

* **Check Status First**: Run `clasp status` before making edits or pushing to ensure there are no local/remote synchronization conflicts.
* **CORS Preflight Bypass Alert**: Remember that the frontend bypasses Apps Script CORS preflights by sending requests as `text/plain`. Do NOT modify the Apps Script Web App endpoints to require `application/json` headers on incoming CORS requests, and make sure that any updates to Apps Script POST handling do not break JSON parsing of raw text payloads.
* **Database Secrets**: Do not commit secrets/credentials to the source files. Ensure that settings such as `FIREBASE_DB_URL` and `FIREBASE_DB_SECRET` are managed via Script Properties in the Google Apps Script project settings.
