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
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function () {
  "use strict";

  var STORAGE_CODE = "pushup_group_code_v1";
  var STORAGE_NAME = "pushup_display_name_v1";
  var STORAGE_INJURED = "pushup_injured_v1";
  var CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I/L zur besseren Lesbarkeit
  var TAUNTS_PER_WEEK = 2;

  var app, auth, db;
  var uid = null;
  var unsubscribePlayers = null;
  var unsubscribeFights = null;
  var readyCallbacks = [];
  var leaderboardCallbacks = [];
  var fightCallbacks = [];
  var lastLeaderboard = [];
  var lastFights = [];
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

  function isInjured() {
    return localStorage.getItem(STORAGE_INJURED) === "1";
  }

  // Woche = Sonntag bis Sonntag
  function weekKeyFor(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function subscribeToGroup(code) {
    if (unsubscribePlayers) { unsubscribePlayers(); unsubscribePlayers = null; }
    if (unsubscribeFights) { unsubscribeFights(); unsubscribeFights = null; }
    if (!code || !db) return;

    var playersCol = collection(db, "groups", code, "players");
    unsubscribePlayers = onSnapshot(playersCol, function (snapshot) {
      var players = [];
      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        players.push({
          uid: docSnap.id,
          name: data.name || "?",
          pushupsTotal: data.pushupsTotal || 0,
          pushupsToday: data.pushupsToday || 0,
          squatsTotal: data.squatsTotal || 0,
          squatsToday: data.squatsToday || 0,
          plankTotal: data.plankTotal || 0,
          plankToday: data.plankToday || 0,
          muscleLevel: typeof data.muscleLevel === "number" ? data.muscleLevel : 2,
          mood: data.mood || "neutral",
          tauntWeekKey: data.tauntWeekKey || "",
          tauntCount: typeof data.tauntCount === "number" ? data.tauntCount : 0,
          injured: !!data.injured,
          isMe: docSnap.id === uid
        });
      });
      lastLeaderboard = players;
      leaderboardCallbacks.forEach(function (cb) { cb(players); });
    }, function () {
      lastLeaderboard = [];
      leaderboardCallbacks.forEach(function (cb) { cb([]); });
    });

    var fightsCol = query(collection(db, "groups", code, "fights"), orderBy("createdAt", "desc"), limit(50));
    unsubscribeFights = onSnapshot(fightsCol, function (snapshot) {
      var fights = [];
      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        fights.push({
          id: docSnap.id,
          challengerUid: data.challengerUid,
          challengerName: data.challengerName,
          opponentUid: data.opponentUid,
          opponentName: data.opponentName,
          winnerUid: data.winnerUid,
          winnerName: data.winnerName,
          createdAtMs: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : Date.now()
        });
      });
      lastFights = fights;
      fightCallbacks.forEach(function (cb) { cb(fights); });
    }, function () {
      lastFights = [];
      fightCallbacks.forEach(function (cb) { cb([]); });
    });
  }

  function writeSelf(code, name, extra) {
    if (!db || !uid || !code) return Promise.resolve();
    var ref = doc(db, "groups", code, "players", uid);
    var payload = {
      name: (name || "Ich").slice(0, 24),
      updatedAt: serverTimestamp()
    };
    if (extra) {
      for (var k in extra) if (extra.hasOwnProperty(k)) payload[k] = extra[k];
    }
    return setDoc(ref, payload, { merge: true });
  }

  // Rohwerte je Übung (keine Umrechnung!) fürs Speichern/Anzeigen.
  function exerciseStatsExtra() {
    var extra = {};
    if (window.PushupApp) {
      extra.pushupsTotal = Math.floor(window.PushupApp.getTotal());
      extra.pushupsToday = Math.floor(window.PushupApp.getTodayTotal());
    }
    if (window.SquatsApp) {
      extra.squatsTotal = Math.floor(window.SquatsApp.getTotal());
      extra.squatsToday = Math.floor(window.SquatsApp.getTodayTotal());
    }
    if (window.PlankApp) {
      extra.plankTotal = Math.floor(window.PlankApp.getTotal());
      extra.plankToday = Math.floor(window.PlankApp.getTodayTotal());
    }
    if (window.PushupBuddy) {
      extra.muscleLevel = window.PushupBuddy.getMuscleLevel();
      extra.mood = window.PushupBuddy.getMood();
    }
    extra.injured = isInjured();
    return extra;
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

  // Nur intern für den Kampfausgang: eine kombinierte "Stärke" aus allen drei
  // Übungen. Wird nirgendwo als Nutzer-sichtbare Zahl angezeigt.
  function battleStrength(p) {
    var moodBonus = p.mood === "happy" ? 6 : (p.mood === "angry" ? -6 : 0);
    var todayScore = (p.pushupsToday || 0) + (p.squatsToday || 0) + (p.plankToday || 0) * 0.5;
    var totalScore = Math.min(p.pushupsTotal || 0, 5000) * 0.02
      + Math.min(p.squatsTotal || 0, 5000) * 0.02
      + Math.min(p.plankTotal || 0, 5000) * 0.01;
    return todayScore * 1.5 + totalScore + (p.muscleLevel || 2) * 6 + moodBonus + (Math.random() * 16 - 8);
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

    isInjured: isInjured,
    setInjured: function (injured) {
      localStorage.setItem(STORAGE_INJURED, injured ? "1" : "0");
      var code = getGroupCode();
      if (code) return writeSelf(code, getDisplayName(), exerciseStatsExtra());
      return Promise.resolve();
    },

    createGroup: function (name) {
      var code = generateCode();
      localStorage.setItem(STORAGE_CODE, code);
      localStorage.setItem(STORAGE_NAME, name || "Ich");
      subscribeToGroup(code);
      return writeSelf(code, name, exerciseStatsExtra()).then(function () { return code; });
    },

    joinGroup: function (code, name) {
      var normalized = normalizeCode(code);
      if (!normalized) return Promise.reject(new Error("invalid-code"));
      localStorage.setItem(STORAGE_CODE, normalized);
      localStorage.setItem(STORAGE_NAME, name || "Ich");
      subscribeToGroup(normalized);
      return writeSelf(normalized, name, exerciseStatsExtra()).then(function () { return normalized; });
    },

    leaveGroup: function () {
      localStorage.removeItem(STORAGE_CODE);
      if (unsubscribePlayers) { unsubscribePlayers(); unsubscribePlayers = null; }
      if (unsubscribeFights) { unsubscribeFights(); unsubscribeFights = null; }
      lastLeaderboard = [];
      lastFights = [];
      leaderboardCallbacks.forEach(function (cb) { cb([]); });
      fightCallbacks.forEach(function (cb) { cb([]); });
    },

    renameSelf: function (name) {
      localStorage.setItem(STORAGE_NAME, name || "Ich");
      var code = getGroupCode();
      if (code) return writeSelf(code, name, exerciseStatsExtra());
      return Promise.resolve();
    },

    // Bei jeder Änderung an einer der drei Übungen aufrufen.
    syncAll: function () {
      var code = getGroupCode();
      if (!code || !isReady) return Promise.resolve();
      return writeSelf(code, getDisplayName(), exerciseStatsExtra());
    },

    onLeaderboard: function (cb) {
      leaderboardCallbacks.push(cb);
      if (getGroupCode()) cb(lastLeaderboard);
    },
    getLeaderboardSnapshot: function () { return lastLeaderboard; },

    onFights: function (cb) {
      fightCallbacks.push(cb);
      if (getGroupCode()) cb(lastFights);
    },
    getFightsSnapshot: function () { return lastFights; },

    // Anpöbeln: zweimal pro Woche (So-So) pro Person
    getTauntsRemaining: function () {
      var me = null;
      for (var i = 0; i < lastLeaderboard.length; i++) {
        if (lastLeaderboard[i].isMe) { me = lastLeaderboard[i]; break; }
      }
      var wk = weekKeyFor(new Date());
      if (!me || me.tauntWeekKey !== wk) return TAUNTS_PER_WEEK;
      return Math.max(0, TAUNTS_PER_WEEK - me.tauntCount);
    },

    challenge: function (opponentUid, opponentName) {
      var code = getGroupCode();
      if (!code || !uid) return Promise.reject(new Error("no-group"));
      var remaining = api.getTauntsRemaining();
      if (remaining <= 0) return Promise.reject(new Error("no-taunts-left"));

      var me = null, opponent = null;
      for (var i = 0; i < lastLeaderboard.length; i++) {
        if (lastLeaderboard[i].isMe) me = lastLeaderboard[i];
        if (lastLeaderboard[i].uid === opponentUid) opponent = lastLeaderboard[i];
      }
      if (!me || !opponent) return Promise.reject(new Error("player-not-found"));
      if (me.injured) return Promise.reject(new Error("self-injured"));
      if (opponent.injured) return Promise.reject(new Error("opponent-injured"));

      var myScore = battleStrength(me);
      var oppScore = battleStrength(opponent);
      var winner = myScore >= oppScore ? me : opponent;

      var wk = weekKeyFor(new Date());
      var newCount = (me.tauntWeekKey === wk ? me.tauntCount : 0) + 1;

      return writeSelf(code, getDisplayName(), {
        tauntWeekKey: wk,
        tauntCount: newCount
      }).then(function () {
        return addDoc(collection(db, "groups", code, "fights"), {
          challengerUid: uid,
          challengerName: me.name,
          opponentUid: opponent.uid,
          opponentName: opponent.name,
          winnerUid: winner.uid,
          winnerName: winner.name,
          createdAt: serverTimestamp()
        });
      }).then(function (docRef) {
        return { id: docRef.id, me: me, opponent: opponent, winnerUid: winner.uid, winnerName: winner.name };
      });
    }
  };

  window.PushupCloud = api;
  init();
})();
