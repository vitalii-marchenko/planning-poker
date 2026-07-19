---
name: playwright-testing
description: "Provides instructions and patterns to run automated E2E testing on the web application using the Playwright browser subagent or Playwright MCP tools."
---

# Web Application Testing with Playwright MCP

This skill outlines how to perform automated E2E and visual testing of the Planning Poker Web Application using the Playwright browser subagent.

## Activation/Triggering

This skill is active when executing tasks related to:
* Running automated E2E tests on the Planning Poker app.
* Verifying visual layouts, styles, or theme switcher states.
* Automating user flows (e.g. creating rooms, joining rooms, voting, and revealing cards) inside the browser.
* Debugging layout regressions or frontend console exceptions.

## Commands & Workflows

### 1. Setup Local Server
Before initiating browser automation, ensure a local server is running in the background to serve static files (`index.html`, `style.css`, `app.js`, `config.js`).
```bash
python3 -m http.server 8000
```
*Note: Always remember to shut down this background process when testing completes.*

### 2. Invoke Browser Subagent
Use the `browser_subagent` tool with a highly specific E2E task description. Specify details about input fields, button IDs, and transition waits.

**Task Prompt Template**:
```
1. Navigate to http://localhost:8000.
2. Wait for the page to load completely. Check if the element '#btn-theme-toggle' is present.
3. Take a screenshot of the default landing page (landing_default.png).
4. Click '#btn-theme-toggle' to change the color scheme.
5. Take a screenshot of the light-themed landing page (landing_light.png) to verify frosted glass styles.
6. Enter '<user_name>' into '#create-owner-name' and select '<deck_type>' from '#create-deck-select'.
7. Click '#btn-create-room' and wait for redirect to the game screen.
8. Verify that '#game-screen' has the class 'active' and the URL contains 'roomId='.
9. Take a screenshot of the room in light mode (game_room_light.png).
10. Click '#btn-theme-toggle' again and take a dark mode screenshot (game_room_dark.png) to verify visual contrast.
```

### 3. Check for Console Errors
When verifying browser executions:
* Ensure that the subagent checks browser console logs (`console.error` and exceptions).
* Watch for module import failures (e.g. bare specifier resolution errors) or CORS blocked requests.

### 4. Cleanup background tasks
Once E2E verification completes:
* Retrieve the background server task ID.
* Use `manage_task` with action `kill` to cleanly terminate the Python HTTP server.

## Best Practices & Safety

* **Avoid Port Conflicts**: Ensure the HTTP server runs on a free port (e.g. `8000` or `8080`).
* **Handle Persistent States**: The browser subagent may load with cached data in `localStorage` (e.g. `userName` or `ownerToken`). Clear `localStorage` inside the page before starting the test if a clean-state run is needed.
* **Do not use interactive tools in headless tests**: If an alert or modal blocks input (like the `name-dialog` popup), instruct the subagent to click the submit/enter button or fill in the input appropriately.
