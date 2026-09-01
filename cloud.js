import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function () {
  "use strict";

  var STORAGE_CODE = "pushup_group_code_v1";
  var STORAGE_NAME = "pushup_display_name_v1";
  var CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I/L zur besseren Lesbarkeit

  var app, auth, db;
  var uid = null;
  var unsubscribe = null;
  var readyCallbacks = [];
  var leaderboardCallbacks = [];
  var lastLeaderboard = [];
  var isReady = false;

  function generateCode() {
    var code = "";
    for (var i = 0; i < 6; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  function normalizeCode(code) {
    return (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  }

  function getGroupCode() {
    return localStorage.getItem(STORAGE_CODE) || null;
  }

  function getDisplayName() {
    return localStorage.getItem(STORAGE_NAME) || "";
  }

  function subscribeToGroup(code) {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (!code || !db) return;
    var col = collection(db, "groups", code, "players");
    unsubscribe = onSnapshot(col, function (snapshot) {
      var players = [];
      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        players.push({
          uid: docSnap.id,
          name: data.name || "?",
          total: typeof data.total === "number" ? data.total : 0,
          isMe: docSnap.id === uid
        });
      });
      players.sort(function (a, b) { return b.total - a.total; });
      lastLeaderboard = players;
      leaderboardCallbacks.forEach(function (cb) { cb(players); });
    }, function () {
      lastLeaderboard = [];
      leaderboardCallbacks.forEach(function (cb) { cb([]); });
    });
  }

  function writeSelf(code, name, total) {
    if (!db || !uid || !code) return Promise.resolve();
    var ref = doc(db, "groups", code, "players", uid);
    return setDoc(ref, {
      name: (name || "Ich").slice(0, 24),
      total: Math.max(0, Math.floor(total || 0)),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  function init() {
    try {
      app = initializeApp(window.PUSHUP_FIREBASE_CONFIG);
      auth = getAuth(app);
      db = getFirestore(app);
    } catch (e) {
      return;
    }

    onAuthStateChanged(auth, function (user) {
      if (user) {
        uid = user.uid;
        isReady = true;
        readyCallbacks.forEach(function (cb) { cb(uid); });
        readyCallbacks = [];
        var code = getGroupCode();
        if (code) subscribeToGroup(code);
      }
    });

    signInAnonymously(auth).catch(function () {});
  }

  var api = {
    onReady: function (cb) {
      if (isReady) cb(uid);
      else readyCallbacks.push(cb);
    },
    getUid: function () { return uid; },
    getGroupCode: getGroupCode,
    getDisplayName: getDisplayName,
    hasGroup: function () { return !!getGroupCode(); },

    createGroup: function (name, currentTotal) {
      var code = generateCode();
      localStorage.setItem(STORAGE_CODE, code);
      localStorage.setItem(STORAGE_NAME, name || "Ich");
      subscribeToGroup(code);
      return writeSelf(code, name, currentTotal).then(function () { return code; });
    },

    joinGroup: function (code, name, currentTotal) {
      var normalized = normalizeCode(code);
      if (!normalized) return Promise.reject(new Error("invalid-code"));
      localStorage.setItem(STORAGE_CODE, normalized);
      localStorage.setItem(STORAGE_NAME, name || "Ich");
      subscribeToGroup(normalized);
      return writeSelf(normalized, name, currentTotal).then(function () { return normalized; });
    },

    leaveGroup: function () {
      localStorage.removeItem(STORAGE_CODE);
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      lastLeaderboard = [];
      leaderboardCallbacks.forEach(function (cb) { cb([]); });
    },

    renameSelf: function (name) {
      localStorage.setItem(STORAGE_NAME, name || "Ich");
      var code = getGroupCode();
      if (code) return writeSelf(code, name, lastSelfTotal);
      return Promise.resolve();
    },

    syncTotal: function (total) {
      lastSelfTotal = total;
      var code = getGroupCode();
      if (!code || !isReady) return Promise.resolve();
      return writeSelf(code, getDisplayName(), total);
    },

    onLeaderboard: function (cb) {
      leaderboardCallbacks.push(cb);
      if (getGroupCode()) cb(lastLeaderboard);
    }
  };

  var lastSelfTotal = 0;

  window.PushupCloud = api;
  init();
})();
