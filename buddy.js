(function () {
  "use strict";

  var MIN_MUSCLE = 0;
  var MAX_MUSCLE = 5;
  var DEFAULT_MUSCLE = 2;

  var KEY_MUSCLE = "combined_muscle_level_v2";
  var KEY_MUSCLE_CHECKED = "combined_muscle_checked_until_v2";

  var U = window.ExerciseUtils;

  // Jede Übung wird nur gegen ihren EIGENEN bisherigen Durchschnitt verglichen -
  // keine Umrechnung zwischen Wiederholungen und Sekunden. Die Muckis wachsen,
  // wenn die Mehrheit der bereits genutzten Übungen an einem Tag über dem
  // eigenen Schnitt lag.
  var EXERCISES = [
    { get: function () { return window.PushupApp; }, seed: 10 },
    { get: function () { return window.SquatsApp; }, seed: 10 },
    { get: function () { return window.PlankApp; }, seed: 15 }
  ];

  var MILESTONE_CONFIG = [
    { get: function () { return window.PushupApp; }, key: "pushups_last_milestone_v1", smallKey: "pushups_last_small_milestone_v1", big: 500, small: 50, name: "Liegestütze", seconds: false },
    { get: function () { return window.SquatsApp; }, key: "squats_last_milestone_v1", smallKey: "squats_last_small_milestone_v1", big: 500, small: 50, name: "Squats", seconds: false },
    { get: function () { return window.PlankApp; }, key: "plank_last_milestone_v1", smallKey: "plank_last_small_milestone_v1", big: 1800, small: 300, name: "Plank", seconds: true }
  ];

  var BIG_MESSAGES = [
    "Wahnsinn! {n} {ex} geschafft!",
    "{n} {ex}! Du bist nicht mehr zu stoppen!",
    "Boom! {n} {ex} erreicht – weiter so, Champion!",
    "{n} {ex} im Kasten! Absolute Bestleistung!",
    "Respekt! {n} {ex} – dein Buddy ist mächtig stolz auf dich!"
  ];
  var SMALL_MESSAGES = [
    "{n} {ex}! Weiter so 👊",
    "{n} {ex} – sauber!",
    "{n} {ex}! Dein Buddy nickt anerkennend.",
    "{n} {ex} erreicht, nicht nachlassen!"
  ];

  function parseKey(key) { return new Date(key + "T00:00:00"); }

  function evaluateDay(cursor) {
    var active = 0, passed = 0;
    EXERCISES.forEach(function (ex) {
      var tracker = ex.get();
      if (!tracker || tracker.getEntries().length === 0) return;
      var first = U.startOfDay(tracker.firstEntryDate());
      if (first > cursor) return; // diese Übung gab es an dem Tag noch nicht
      active++;

      var map = tracker.dailyTotalsMap();
      var dayTotal = map[U.dateKey(cursor)] || 0;

      var priorSum = 0, priorDays = 0;
      var pc = new Date(first);
      while (pc < cursor) {
        priorSum += map[U.dateKey(pc)] || 0;
        priorDays++;
        pc = U.addDays(pc, 1);
      }
      var reference = priorDays > 0 ? (priorSum / priorDays) : ex.seed;
      if (dayTotal >= reference) passed++;
    });
    if (active === 0) return null;
    return passed * 2 >= active;
  }

  function evaluateMuscle() {
    var level = parseInt(localStorage.getItem(KEY_MUSCLE), 10);
    if (isNaN(level)) level = DEFAULT_MUSCLE;

    var today = U.startOfDay(new Date());
    var checkedUntil = localStorage.getItem(KEY_MUSCLE_CHECKED);
    if (!checkedUntil) {
      localStorage.setItem(KEY_MUSCLE_CHECKED, U.dateKey(U.addDays(today, -1)));
      localStorage.setItem(KEY_MUSCLE, String(level));
      return level;
    }

    var cursor = U.addDays(parseKey(checkedUntil), 1);
    var safety = 0;
    while (cursor < today && safety < 3650) {
      var result = evaluateDay(cursor);
      if (result === true) level = Math.min(MAX_MUSCLE, level + 1);
      else if (result === false) level = Math.max(MIN_MUSCLE, level - 1);
      cursor = U.addDays(cursor, 1);
      safety++;
    }
    localStorage.setItem(KEY_MUSCLE_CHECKED, U.dateKey(U.addDays(today, -1)));
    localStorage.setItem(KEY_MUSCLE, String(level));
    return level;
  }

  function getLastEntryTimestamp() {
    var all = [];
    EXERCISES.forEach(function (ex) {
      var t = ex.get();
      if (t) all = all.concat(t.getEntries());
    });
    if (all.length === 0) return null;
    var max = all[0].ts;
    for (var i = 1; i < all.length; i++) if (all[i].ts > max) max = all[i].ts;
    return max;
  }

  function computeMood() {
    var lastTs = getLastEntryTimestamp();
    if (!lastTs) return "neutral";
    var today = U.startOfDay(new Date());
    var lastDay = U.startOfDay(new Date(lastTs));
    var diffDays = Math.round((today.getTime() - lastDay.getTime()) / 86400000);
    if (diffDays <= 0) return "happy";
    if (diffDays === 1) return "neutral";
    return "angry";
  }

  function captionFor(level, mood) {
    if (mood === "angry") {
      return level <= 1
        ? "Autsch … Zeit für ein Comeback! 😤"
        : "Wo bleibst du? Dein Buddy vermisst dich!";
    }
    if (mood === "neutral") return "Heute schon trainiert? Dran bleiben!";
    if (level >= 4) return "Du bist eine Maschine! 💪🔥";
    if (level >= 2) return "Starke Leistung, weiter so!";
    return "Guter Start – die Muckis kommen!";
  }

  function checkMilestone(total, key, step) {
    var last = parseInt(localStorage.getItem(key), 10);
    if (isNaN(last)) last = 0;
    var current = Math.floor(total / step) * step;
    if (current > last && current > 0) {
      localStorage.setItem(key, String(current));
      return current;
    }
    return null;
  }

  var buddySvg = document.getElementById("buddy-svg");
  var captionEl = document.getElementById("buddy-caption");
  var overlay = document.getElementById("celebration-overlay");
  var confettiEl = document.getElementById("celebration-confetti");
  var celebrationText = document.getElementById("celebration-text");
  var closeBtn = document.getElementById("celebration-close");
  var smallToast = document.getElementById("small-milestone-toast");
  var smallToastText = document.getElementById("small-milestone-text");

  var CONFETTI_EMOJI = ["🎉", "💪", "🔥", "⭐", "🎊"];
  var smallToastTimer = null;

  function spawnConfetti() {
    confettiEl.innerHTML = "";
    for (var i = 0; i < 24; i++) {
      var span = document.createElement("span");
      span.className = "confetti-piece";
      span.textContent = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
      span.style.left = Math.random() * 100 + "%";
      span.style.animationDelay = (Math.random() * 0.6) + "s";
      span.style.animationDuration = (2 + Math.random() * 1.5) + "s";
      span.style.fontSize = (18 + Math.random() * 14) + "px";
      confettiEl.appendChild(span);
    }
  }

  function milestoneLabel(cfg, value) {
    return cfg.seconds ? (value / 60) + " Minuten" : value.toLocaleString("de-DE");
  }

  function showBigCelebration(cfg, value) {
    var label = milestoneLabel(cfg, value);
    var msg = BIG_MESSAGES[Math.floor(Math.random() * BIG_MESSAGES.length)]
      .replace("{n}", label).replace("{ex}", cfg.name);
    celebrationText.textContent = msg;
    spawnConfetti();
    overlay.classList.remove("hidden");
    buddySvg.classList.add("buddy-cheer");
  }

  function hideCelebration() {
    overlay.classList.add("hidden");
    confettiEl.innerHTML = "";
    buddySvg.classList.remove("buddy-cheer");
  }

  function showSmallCheer(cfg, value) {
    var label = milestoneLabel(cfg, value);
    var msg = SMALL_MESSAGES[Math.floor(Math.random() * SMALL_MESSAGES.length)]
      .replace("{n}", label).replace("{ex}", cfg.name);
    smallToastText.textContent = msg;
    smallToast.classList.remove("hidden");
    if (smallToastTimer) clearTimeout(smallToastTimer);
    smallToastTimer = setTimeout(function () {
      smallToast.classList.add("hidden");
    }, 2800);
  }

  closeBtn.addEventListener("click", hideCelebration);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) hideCelebration();
  });

  var currentLevel = DEFAULT_MUSCLE;
  var currentMood = "neutral";

  function renderBuddy() {
    currentLevel = evaluateMuscle();
    currentMood = computeMood();
    buddySvg.setAttribute("data-muscle", String(currentLevel));
    buddySvg.setAttribute("data-mood", currentMood);
    captionEl.textContent = captionFor(currentLevel, currentMood);
  }

  function checkMilestonesFor(cfg) {
    var tracker = cfg.get();
    if (!tracker) return;
    var total = tracker.getTotal();
    var big = checkMilestone(total, cfg.key, cfg.big);
    if (big) {
      showBigCelebration(cfg, big);
      localStorage.setItem(cfg.smallKey, String(big));
    } else {
      var small = checkMilestone(total, cfg.smallKey, cfg.small);
      if (small) showSmallCheer(cfg, small);
    }
  }

  window.PushupBuddy = {
    getMuscleLevel: function () { return currentLevel; },
    getMood: function () { return currentMood; }
  };

  function whenReady(fn) {
    function check() {
      if (window.PushupApp && window.SquatsApp && window.PlankApp) fn();
      else setTimeout(check, 20);
    }
    check();
  }

  whenReady(function () {
    renderBuddy();
    MILESTONE_CONFIG.forEach(function (cfg) {
      cfg.get().onChange(function () {
        renderBuddy();
        checkMilestonesFor(cfg);
      });
    });
  });
})();
