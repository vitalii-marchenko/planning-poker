# Real-Time Planning Poker Web Application

A lightweight, premium, real-time Planning Poker application designed for Agile team estimations. This project has a decentralized serverless architecture leveraging **GitHub Pages** for static site hosting, **Firebase Realtime Database** for live session sync, and **Google Apps Script** for secure owner operations.

## Architecture & Features

- **Decentralized Backend**: Google Apps Script acts as the backend API to handle administrative tasks (create rooms, verify ownership, reset state, reveal cards) securely without exposing admin credentials.
- **Real-Time Sync**: Firebase Realtime Database handles voter presence, ticket updates, card selections, and card reveals.
- **Secure Estimations**: Firebase Security Rules prevent cheating. Votes are fully read-blocked for all clients until the owner clicks "Reveal Cards".
- **Dynamic Decks**: Choose between **Fibonacci** (`0, 1, 2, 3, 5, 8, 13, ..., ?, ☕`) and **Days** (`0.5, 1, 1.5, ..., 7, ?, ☕`).
- **Owner Controls**: Only the creator of the room has administrative access (update ticket names, change deck types, reset cards, and reveal votes).

---

## Setup Instructions

Follow these steps to configure the backend, database, and publish the frontend.

### Step 1: Set Up Firebase Realtime Database

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**. Follow the prompts to create a free project.
2. In the left-hand sidebar, navigate to **Build > Authentication**.
   - Click **Get Started**.
   - Under the **Sign-in method** tab, click **Anonymous**, toggle **Enable**, and click **Save**.
3. In the sidebar, navigate to **Build > Realtime Database**.
   - Click **Create Database**.
   - Choose a database location and start in **Locked Mode**.
4. Once the database is created, click the **Rules** tab.
   - Replace the default rules with the contents of the [database-rules.json](database-rules.json) file.
   - Click **Publish**.
5. Copy the Database URL from the top of the **Data** tab (e.g., `https://your-project-id-default-rtdb.firebaseio.com/`). You will need this for both the frontend config and Apps Script.
6. Retrieve your Web App config credentials:
   - Click the gear icon next to **Project Overview** in the left sidebar and select **Project Settings**.
   - Under the **General** tab, scroll down to **Your Apps** and click the Web icon (`</>`) to register a new web app.
   - Copy the `firebaseConfig` credentials object.

---

### Step 2: Set Up Google Apps Script Backend

1. Open [Google Apps Script](https://script.google.com/).
2. Click **New Project** and name it something descriptive (e.g., `Planning Poker Backend`).
3. Replace the contents of the default `Code.gs` with the code in the [Code.gs](Code.gs) file in this workspace.
4. Set up the database variables in the settings:
   - Click the gear icon on the left panel (**Project Settings**).
   - Scroll down to **Script Properties** and click **Add Script Property**.
   - Add two properties:
     - `FIREBASE_DB_URL`: Enter your Firebase Realtime Database URL (e.g. `https://your-project-id-default-rtdb.firebaseio.com`).
     - `FIREBASE_DB_SECRET`: *(Optional but highly recommended)* Generate a Firebase legacy Database Secret or Service Account token to secure REST access.
       - *To find legacy Database Secret: Project settings (gear icon) > Service Accounts tab > Database secrets > Click "Show" and copy it.*
5. Deploy the script as a Web App:
   - Click **Deploy > New Deployment** (top right).
   - Click the gear icon next to **Select type** and choose **Web app**.
   - Set the configuration:
     - **Execute as**: `Me (your-email@gmail.com)`
     - **Who has access**: `Anyone` *(Crucial so that any voter's browser can call the endpoints anonymously)*.
   - Click **Deploy**.
   - Grant the necessary permissions (sign in with your Google Account, click Advanced, and click "Go to Project Name (unsafe)" to authorize `UrlFetchApp` database HTTP requests).
6. Copy the **Web App URL** from the success screen (e.g. `https://script.google.com/macros/s/AKfycbz.../exec`).

---

### Step 3: Configure Frontend Code

1. In the project workspace, open [config.js](config.js).
2. Update the `FIREBASE` object with the Web App credentials you copied from the Firebase Console in Step 1.
3. Update the `APPS_SCRIPT_URL` property with the Web App deployment URL you copied from Apps Script in Step 2.

---

### Step 4: Host on GitHub Pages

1. Create a new repository on GitHub.
2. Initialize, commit, and push this workspace to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initialize Planning Poker app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
3. In your GitHub repository page:
   - Navigate to **Settings** > **Pages** (in the sidebar).
   - Under **Build and deployment**, set **Source** to `Deploy from a branch`.
   - Set **Branch** to `main` (or the branch you pushed to) and the folder to `/ (root)`.
   - Click **Save**.
4. GitHub will build and host the site. Within a minute, your app will be live at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

---

## How to Use

1. **Create a Room**:
   - Go to your live site URL.
   - Enter your name, select the default card deck type (Fibonacci or Days), and click **Create Room**.
   - The app will redirect you to the room (e.g. `index.html?roomId=ABCDEF`).
2. **Invite the Team**:
   - Click the **Copy Link** button on the top-right.
   - Send this link to your team.
   - When team members open the link, they will be prompted to enter their names and join the live room.
3. **Estimate Tickets**:
   - As the Room Owner (Admin), type the name of the ticket to be discussed in the top bar and press **Enter**.
   - Team members will see the ticket update instantly in real-time.
   - Each user clicks a card in their deck to vote.
   - A green checkmark shows who has cast a vote, but actual card values remain hidden.
4. **Reveal & View Results**:
   - Once everyone has voted, the Room Owner clicks **Reveal Cards**.
   - All voter cards will flip over with an animation, displaying their estimation.
   - The stats panel will appear automatically, showing the calculated **Average**, **Median**, and **Consensus** (highest frequency vote).
5. **Next Ticket**:
   - To estimate the next ticket, the Room Owner types the new ticket name and presses **Enter** (or clicks **Reset Room**).
   - All client states reset, votes are cleared, and users can estimate again.
