import { CONFIG } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  onValue,
  onDisconnect,
  off
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import {
  getAuth,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ==========================================
// CONFIGURATION AND STATE
// ==========================================

const DECK_TEMPLATES = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
  days: ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '?', '☕']
};

let db = null;
let auth = null;
let roomId = null;
let userId = null;
let userName = null;
let ownerToken = null;
let isOwner = false;

let roomData = {
  ticket: '',
  revealed: false,
  deckType: 'fibonacci',
  users: {}
};
let votesData = {};

let votesSubscription = null;
let roomSubscription = null;
let presenceSubscription = null;

// ==========================================
// APP INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Parse roomId from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  roomId = urlParams.get('roomId');

  if (roomId) {
    roomId = roomId.toUpperCase();
    // Retrieve owner token if this browser created the room
    ownerToken = localStorage.getItem(`ownerToken_${roomId}`);
    isOwner = !!ownerToken;

    // Check if userName is already saved locally
    userName = localStorage.getItem('userName');

    if (!userName) {
      // Show Name Prompt Dialog
      showNamePromptDialog();
    } else {
      initFirebaseAndJoin();
    }
  } else {
    // Show Landing Screen
    showScreen('landing-screen');
    setupLandingListeners();
  }
});

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ==========================================
// FIREBASE OPERATIONS & JOIN ROOM
// ==========================================

async function initFirebaseAndJoin() {
  if (CONFIG.FIREBASE.apiKey === "YOUR_API_KEY") {
    alert("Please configure your Firebase credentials in config.js first!");
    return;
  }

  try {
    const app = initializeApp(CONFIG.FIREBASE);
    db = getDatabase(app);
    auth = getAuth(app);

    // Sign in Anonymously
    const userCredential = await signInAnonymously(auth);
    userId = userCredential.user.uid;

    showScreen('game-screen');
    setupGameUI();
    startListeningToRoom();
  } catch (error) {
    console.error("Firebase Initialization Failed:", error);
    showToast("Error connecting to database. Please check console.", "error");
  }
}

// Listen to room settings (ticket name, deck type, revealed status)
function startListeningToRoom() {
  const roomRef = ref(db, `rooms/${roomId}`);

  roomSubscription = onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      showToast("Room not found. Creating a new one...", "warning");
      setTimeout(() => {
        window.location.href = window.location.pathname; // Redirect to landing
      }, 2000);
      return;
    }

    const prevRevealed = roomData.revealed;
    const prevDeckType = roomData.deckType;
    const prevTicket = roomData.ticket;

    roomData = data;
    roomData.users = data.users || {};

    // 1. If ticket changed, reset local card selection selection
    if (prevTicket !== roomData.ticket) {
      resetLocalVoteSelection();
    }

    // 2. Render UI components
    renderRoomInfo();

    // 3. Render cards (in case deck type changed)
    if (prevDeckType !== roomData.deckType || prevTicket !== roomData.ticket) {
      renderCardDeck();
    }

    // 4. Handle revealed state changes (fetch votes or clear)
    if (prevRevealed !== roomData.revealed || prevRevealed === undefined) {
      syncVotesListener();
    }

    renderVotersList();
    setupUserPresence();
  });
}

// Setup User Presence inside Room
function setupUserPresence() {
  if (presenceSubscription) return; // Only set up once

  const connectedRef = ref(db, ".info/connected");
  const userPresenceRef = ref(db, `rooms/${roomId}/users/${userId}`);

  presenceSubscription = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      // Set to delete presence on disconnect
      onDisconnect(userPresenceRef).remove();

      // Update/Set current presence
      set(userPresenceRef, {
        name: userName,
        hasVoted: roomData.users[userId]?.hasVoted || false
      });
    }
  });
}

// Manage Votes Database Subscription dynamically (avoids Permission Denied errors)
function syncVotesListener() {
  const votesRef = ref(db, `votes/${roomId}`);

  if (roomData.revealed) {
    if (votesSubscription) return; // Already listening

    votesSubscription = onValue(votesRef, (snapshot) => {
      votesData = snapshot.val() || {};
      renderVotersList(); // Re-render to show card values
      calculateStatistics();
    });
  } else {
    // Unsubscribe if cards are not revealed
    if (votesSubscription) {
      off(votesRef);
      votesSubscription = null;
    }
    votesData = {};
    renderVotersList();
    hideStatistics();
  }
}

// ==========================================
// UI RENDERING
// ==========================================

function setupGameUI() {
  document.getElementById('header-user-name').textContent = userName;
  document.getElementById('room-id-display').textContent = roomId;

  // Set up owner control panel visibility
  const ownerControls = document.getElementById('owner-controls');
  const deckSettingsGroup = document.getElementById('deck-settings-group');

  if (isOwner) {
    ownerControls.style.display = 'flex';
    deckSettingsGroup.style.display = 'block';
  } else {
    ownerControls.style.display = 'none';
    deckSettingsGroup.style.display = 'none';
  }

  // Configure ticket editing based on ownership
  const ticketInput = document.getElementById('ticket-input');
  if (isOwner) {
    ticketInput.disabled = false;
    ticketInput.placeholder = "Enter ticket name & press Enter...";

    // Listen for Ticket Update
    ticketInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const title = ticketInput.value.trim();
        callBackend('updateTicket', { ticket: title });
      }
    });
  } else {
    ticketInput.disabled = true;
    ticketInput.placeholder = "Waiting for owner to set ticket...";
  }

  // Setup Share Link click
  document.getElementById('btn-share').addEventListener('click', copyShareLink);

  // Owner Buttons Listeners
  if (isOwner) {
    document.getElementById('btn-reveal').addEventListener('click', () => {
      callBackend('revealCards');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      const ticketInput = document.getElementById('ticket-input');
      callBackend('updateTicket', { ticket: ticketInput.value.trim() });
    });

    document.getElementById('deck-type-select').addEventListener('change', (e) => {
      callBackend('changeDeckType', { deckType: e.target.value });
    });
  }
}

function renderRoomInfo() {
  const ticketInput = document.getElementById('ticket-input');
  if (!isOwner) {
    ticketInput.value = roomData.ticket;
  }

  if (isOwner) {
    document.getElementById('deck-type-select').value = roomData.deckType;
  }

  const revealedBadge = document.getElementById('room-status-badge');
  if (roomData.revealed) {
    revealedBadge.textContent = "Revealed";
    revealedBadge.style.color = "hsl(var(--accent))";
    revealedBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
    revealedBadge.style.background = "rgba(16, 185, 129, 0.1)";
  } else {
    revealedBadge.textContent = "Voting Active";
    revealedBadge.style.color = "hsl(var(--primary-light))";
    revealedBadge.style.borderColor = "rgba(139, 92, 246, 0.3)";
    revealedBadge.style.background = "rgba(139, 92, 246, 0.1)";
  }
}

function renderCardDeck() {
  const deckContainer = document.getElementById('card-deck');
  deckContainer.innerHTML = '';

  const cards = DECK_TEMPLATES[roomData.deckType] || DECK_TEMPLATES.fibonacci;
  const localVote = roomData.users[userId]?.hasVoted ? localStorage.getItem(`vote_${roomId}`) : null;

  cards.forEach(val => {
    const cardEl = document.createElement('div');
    cardEl.className = 'poker-card';
    if (localVote === val) {
      cardEl.classList.add('selected');
    }
    if (roomData.revealed) {
      cardEl.classList.add('disabled');
    }

    cardEl.textContent = val;
    cardEl.addEventListener('click', () => submitVote(val));

    deckContainer.appendChild(cardEl);
  });
}

function renderVotersList() {
  const listContainer = document.getElementById('voters-list');
  const countEl = document.getElementById('voter-count');
  listContainer.innerHTML = '';

  const users = roomData.users;
  const userIds = Object.keys(users);
  countEl.textContent = `${userIds.length} online`;

  userIds.forEach(uid => {
    const user = users[uid];
    const hasVoted = user.hasVoted;
    const voteValue = votesData[uid];

    const row = document.createElement('div');
    row.className = 'voter-row';

    // Details
    const details = document.createElement('div');
    details.className = 'voter-details';

    const avatar = document.createElement('div');
    avatar.className = 'voter-avatar';
    avatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : '?';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'voter-name';
    nameSpan.textContent = user.name || 'Anonymous';

    if (uid === userId) {
      nameSpan.innerHTML += ' <span class="voter-badge-owner" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: hsl(var(--accent))">You</span>';
    }

    details.appendChild(avatar);
    details.appendChild(nameSpan);

    // Status box (animated card flip)
    const statusBox = document.createElement('div');
    statusBox.className = 'voter-status-box';
    if (roomData.revealed) {
      statusBox.classList.add('revealed');
    }

    const flipper = document.createElement('div');
    flipper.className = 'card-flipper';

    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';
    if (hasVoted) {
      cardBack.classList.add('voted');
    }

    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.textContent = voteValue !== undefined ? voteValue : '';

    flipper.appendChild(cardBack);
    flipper.appendChild(cardFront);
    statusBox.appendChild(flipper);

    row.appendChild(details);
    row.appendChild(statusBox);

    listContainer.appendChild(row);
  });
}

// ==========================================
// VOTING LOGIC
// ==========================================

function submitVote(value) {
  if (roomData.revealed) return; // Cannot vote if cards are revealed

  const userVoteRef = ref(db, `votes/${roomId}/${userId}`);
  const userPresenceRef = ref(db, `rooms/${roomId}/users/${userId}/hasVoted`);

  const currentLocalVote = localStorage.getItem(`vote_${roomId}`);

  if (currentLocalVote === value) {
    // Toggle off (remove vote)
    set(userVoteRef, null);
    set(userPresenceRef, false);
    localStorage.removeItem(`vote_${roomId}`);
  } else {
    // Select vote
    set(userVoteRef, value);
    set(userPresenceRef, true);
    localStorage.setItem(`vote_${roomId}`, value);
  }

  renderCardDeck(); // Refresh card select styling
}

function resetLocalVoteSelection() {
  localStorage.removeItem(`vote_${roomId}`);
  const deckContainer = document.getElementById('card-deck');
  if (deckContainer) {
    document.querySelectorAll('.poker-card').forEach(card => {
      card.classList.remove('selected');
    });
  }
}

// ==========================================
// STATISTICS & CALCULATIONS
// ==========================================

function calculateStatistics() {
  const votes = Object.values(votesData);
  const numericVotes = votes
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));

  const resultsContainer = document.getElementById('results-container');
  resultsContainer.style.display = 'block';

  if (numericVotes.length === 0) {
    document.getElementById('stat-average').textContent = '-';
    document.getElementById('stat-median').textContent = '-';
    document.getElementById('stat-consensus').textContent = '-';
    return;
  }

  // Calculate Average
  const sum = numericVotes.reduce((a, b) => a + b, 0);
  const avg = sum / numericVotes.length;
  document.getElementById('stat-average').textContent = avg.toFixed(1);

  // Calculate Median
  numericVotes.sort((a, b) => a - b);
  const mid = Math.floor(numericVotes.length / 2);
  const median = numericVotes.length % 2 !== 0
    ? numericVotes[mid]
    : (numericVotes[mid - 1] + numericVotes[mid]) / 2;
  document.getElementById('stat-median').textContent = median.toFixed(1);

  // Calculate Consensus (mode or agreement percentage)
  const uniqueVotes = new Set(votes);
  if (uniqueVotes.size === 1) {
    document.getElementById('stat-consensus').textContent = votes[0];
  } else {
    // Find most frequent vote
    const counts = {};
    let maxCount = 0;
    let consensusVal = 'Mixed';

    votes.forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > maxCount) {
        maxCount = counts[v];
        consensusVal = v;
      }
    });

    const percentage = (maxCount / votes.length) * 100;
    document.getElementById('stat-consensus').textContent = `${consensusVal} (${percentage.toFixed(0)}%)`;
  }
}

function hideStatistics() {
  document.getElementById('results-container').style.display = 'none';
}

// ==========================================
// BACKEND API CALLS
// ==========================================

async function callBackend(action, extraParams = {}) {
  if (CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
    alert("Please deploy your Google Apps Script and configure APPS_SCRIPT_URL in config.js.");
    return;
  }

  try {
    const payload = {
      action,
      roomId,
      ownerToken,
      ...extraParams
    };

    // We send a POST request with the action details.
    // We use 'text/plain' to avoid CORS preflight (OPTIONS) request, which Google Apps Script web apps do not support.
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload)
    });

    // The request completes successfully, and Firebase listeners sync the database state.
    // The Google Apps Script handles operations atomically.
    showToast(`${action.replace(/([A-Z])/g, ' $1')} requested!`, "success");
  } catch (error) {
    console.error("Backend request failed:", error);
    showToast("Error connecting to backend.", "error");
  }
}

// ==========================================
// LANDING SCREEN HANDLERS
// ==========================================

function setupLandingListeners() {
  const btnCreate = document.getElementById('btn-create-room');
  const btnJoin = document.getElementById('btn-join-room');

  btnCreate.addEventListener('click', async () => {
    const nameInput = document.getElementById('create-owner-name');
    const ownerName = nameInput.value.trim();
    const deckSelect = document.getElementById('create-deck-select');
    const deckType = deckSelect.value;

    if (!ownerName) {
      showToast("Please enter your name", "error");
      return;
    }

    if (CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
      alert("Please configure APPS_SCRIPT_URL in config.js first!");
      return;
    }

    btnCreate.disabled = true;
    btnCreate.textContent = "Creating Room...";

    try {
      // Create room via Apps Script.
      // We use 'text/plain' to avoid CORS preflight (OPTIONS) request, which Google Apps Script web apps do not support.
      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          action: 'createRoom',
          ownerName,
          deckType
        })
      });

      const result = await response.json();
      if (result.success) {
        localStorage.setItem('userName', ownerName);
        localStorage.setItem(`ownerToken_${result.roomId}`, result.ownerToken);

        // Redirect to Room
        window.location.href = `?roomId=${result.roomId}`;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(error);
      showToast("Creation failed: " + error.message, "error");
      btnCreate.disabled = false;
      btnCreate.textContent = "Create Room";
    }
  });

  btnJoin.addEventListener('click', () => {
    const roomIdInput = document.getElementById('join-room-id');
    const code = roomIdInput.value.trim().toUpperCase();

    if (code.length !== 6) {
      showToast("Please enter a valid 6-character Room ID", "error");
      return;
    }

    window.location.href = `?roomId=${code}`;
  });
}

// ==========================================
// NAME DIALOG POPUP (FOR INVITED USERS)
// ==========================================

function showNamePromptDialog() {
  const dialog = document.getElementById('name-dialog');
  dialog.showModal();

  const form = document.getElementById('name-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('join-name-input');
    const name = nameInput.value.trim();

    if (name) {
      userName = name;
      localStorage.setItem('userName', name);
      dialog.close();
      initFirebaseAndJoin();
    }
  });
}

// ==========================================
// UTILITIES
// ==========================================

function copyShareLink() {
  const shareLink = window.location.href;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareLink).then(() => {
      showToast("Share link copied to clipboard!", "success");
    }).catch(err => {
      console.error("Clipboard write failed:", err);
      fallbackCopyText(shareLink);
    });
  } else {
    fallbackCopyText(shareLink);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";  // Avoid scrolling to bottom
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast("Share link copied to clipboard!", "success");
  } catch (err) {
    showToast("Could not copy link automatically.", "error");
  }
  document.body.removeChild(textArea);
}

function showToast(message, type = "success") {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast'; // Reset

  if (type === 'error') {
    toast.style.borderColor = 'hsl(348, 80%, 60%)';
    toast.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
  } else if (type === 'warning') {
    toast.style.borderColor = 'hsl(45, 100%, 50%)';
    toast.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.3)';
  } else {
    toast.style.borderColor = 'hsl(var(--accent))';
    toast.style.boxShadow = '0 0 10px hsl(var(--accent-glow))';
  }

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
