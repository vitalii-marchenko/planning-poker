// Google Apps Script Backend for Planning Poker Web Application
// Deployed as a Web App to handle administrative actions.

function doPost(e) {
  var response = handleRequest(e);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var response = handleRequest(e);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(e) {
  var params = {};
  
  // Extract query parameters from URL
  if (e.parameter) {
    for (var key in e.parameter) {
      params[key] = e.parameter[key];
    }
  }
  
  // Extract body parameters from POST request
  if (e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var key in body) {
        params[key] = body[key];
      }
    } catch (err) {
      // Input was not JSON or failed parsing, proceed with URL params
    }
  }
  
  var action = params.action;
  if (!action) {
    return { success: false, error: "Missing 'action' parameter" };
  }
  
  try {
    if (action === "createRoom") {
      return createRoom(params.ownerName, params.deckType);
    } else if (action === "updateTicket") {
      return updateTicket(params.roomId, params.ownerToken, params.ticket);
    } else if (action === "changeDeckType") {
      return changeDeckType(params.roomId, params.ownerToken, params.deckType);
    } else if (action === "revealCards") {
      return revealCards(params.roomId, params.ownerToken);
    } else {
      return { success: false, error: "Unknown action: " + action };
    }
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

// ==========================================
// CORE ENDPOINTS
// ==========================================

function createRoom(ownerName, deckType) {
  if (!ownerName || ownerName.trim() === "") {
    throw new Error("Owner name is required");
  }
  
  var roomId = generateRoomId();
  var ownerToken = generateToken();
  var selectedDeck = deckType || "fibonacci";
  
  // Initialize the room state
  firebaseRequest("PUT", "/rooms/" + roomId, {
    ticket: "",
    revealed: false,
    deckType: selectedDeck,
    lastActive: new Date().getTime()
  });
  
  // Store the owner token privately
  firebaseRequest("PUT", "/owners/" + roomId, {
    ownerToken: ownerToken
  });
  
  return {
    success: true,
    roomId: roomId,
    ownerToken: ownerToken,
    deckType: selectedDeck
  };
}

function updateTicket(roomId, ownerToken, ticketName) {
  verifyOwner(roomId, ownerToken);
  
  var updates = {
    ticket: ticketName || "",
    revealed: false,
    lastActive: new Date().getTime()
  };
  
  // Reset all users' voting state
  var users = firebaseRequest("GET", "/rooms/" + roomId + "/users");
  if (users) {
    for (var userId in users) {
      users[userId].hasVoted = false;
    }
    updates.users = users;
  }
  
  // Apply updates in a single batch
  firebaseRequest("PATCH", "/rooms/" + roomId, updates);
  
  // Clear the actual votes
  firebaseRequest("DELETE", "/votes/" + roomId);
  
  return { success: true };
}

function changeDeckType(roomId, ownerToken, deckType) {
  verifyOwner(roomId, ownerToken);
  
  if (deckType !== "fibonacci" && deckType !== "days") {
    throw new Error("Invalid deck type: " + deckType);
  }
  
  var updates = {
    deckType: deckType,
    revealed: false,
    lastActive: new Date().getTime()
  };
  
  // Reset all users' voting state
  var users = firebaseRequest("GET", "/rooms/" + roomId + "/users");
  if (users) {
    for (var userId in users) {
      users[userId].hasVoted = false;
    }
    updates.users = users;
  }
  
  // Apply updates
  firebaseRequest("PATCH", "/rooms/" + roomId, updates);
  
  // Clear the actual votes
  firebaseRequest("DELETE", "/votes/" + roomId);
  
  return { success: true };
}

function revealCards(roomId, ownerToken) {
  verifyOwner(roomId, ownerToken);
  
  firebaseRequest("PATCH", "/rooms/" + roomId, {
    revealed: true,
    lastActive: new Date().getTime()
  });
  
  return { success: true };
}

// ==========================================
// HELPERS & FIREBASE INTEGRATION
// ==========================================

function verifyOwner(roomId, ownerToken) {
  if (!roomId || !ownerToken) {
    throw new Error("Room ID and Owner Token are required");
  }
  
  var ownerData = firebaseRequest("GET", "/owners/" + roomId);
  if (!ownerData || ownerData.ownerToken !== ownerToken) {
    throw new Error("Unauthorized: Invalid owner token");
  }
}

function getFirebaseConfig() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var dbUrl = props.FIREBASE_DB_URL;
  var dbSecret = props.FIREBASE_DB_SECRET; // Deprecated Legacy token or Database Secret
  
  if (!dbUrl) {
    throw new Error("Missing FIREBASE_DB_URL script property. Please add it to your Google Apps Script settings.");
  }
  
  if (dbUrl.endsWith("/")) {
    dbUrl = dbUrl.slice(0, -1);
  }
  
  return { dbUrl: dbUrl, dbSecret: dbSecret };
}

function firebaseRequest(method, path, data) {
  var config = getFirebaseConfig();
  var url = config.dbUrl + path + ".json";
  
  if (config.dbSecret) {
    url += "?auth=" + encodeURIComponent(config.dbSecret);
  }
  
  var options = {
    method: method,
    contentType: "application/json",
    muteHttpExceptions: true
  };
  
  if (data !== undefined) {
    options.payload = JSON.stringify(data);
  }
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  
  if (code < 200 || code >= 300) {
    throw new Error("Firebase API error (" + code + "): " + text);
  }
  
  return text ? JSON.parse(text) : null;
}

function generateRoomId() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Readable, no O/0/I/1 confusion
  var id = "";
  for (var i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateToken() {
  var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var token = "";
  for (var i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function smartDatabaseCleanup() {
  try {
    console.log("Starting smart database cleanup...");
    var rooms = firebaseRequest("GET", "/rooms");
    if (!rooms) {
      console.log("No rooms found in database.");
      return;
    }
    
    var now = new Date().getTime();
    var expirationPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    var deletedCount = 0;
    
    for (var roomId in rooms) {
      var room = rooms[roomId];
      
      // Check if the room has online users
      var hasActiveUsers = room.users && Object.keys(room.users).length > 0;
      
      // If a room has no lastActive tag (legacy rooms), treat it as expired
      var lastActive = room.lastActive || 0; 
      var isExpired = (now - lastActive) > expirationPeriod;
      
      if (!hasActiveUsers && isExpired) {
        console.log("Deleting expired inactive room: " + roomId);
        
        // Delete room details, votes, and ownership tokens
        firebaseRequest("DELETE", "/rooms/" + roomId);
        firebaseRequest("DELETE", "/votes/" + roomId);
        firebaseRequest("DELETE", "/owners/" + roomId);
        
        deletedCount++;
      }
    }
    
    console.log("Smart cleanup finished. Deleted " + deletedCount + " inactive rooms.");
  } catch (err) {
    console.error("Smart cleanup failed: " + err.toString());
  }
}
