(function () {
  "use strict";

  var GOAL = 100000;
  var GOAL_YEARS = 3;
  var DAILY_TARGET = GOAL / (GOAL_YEARS * 365.25); // ~91.3 / Tag im Schnitt
  var MILESTONE_STEP = 500;
  var MIN_MUSCLE = 0;
  var MAX_MUSCLE = 5;
  var DEFAULT_MUSCLE = 2;

  var KEY_MUSCLE = "pushup_muscle_level_v1";
  var KEY_MUSCLE_CHECKED = "pushup_muscle_checked_until_v1";
  var KEY_MILESTONE = "pushup_last_milestone_v1";

  var MESSAGES = [
    "Wahnsinn! Du hast {n} Liegestütze geschafft!",
    "{n} Liegestütze! Du bist nicht mehr zu stoppen!",
    "Boom! {n} erreicht – weiter so, Champion!",
    "{n} Liegestütze im Kasten! Absolute Bestleistung!",
    "Respekt! {n} Liegestütze – dein Buddy ist mächtig stolz auf dich!",
    "{n}! Deine Muckis merken das schon. Dran bleiben!"
  ];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function startOfDay(d) { var r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function parseKey(key) { return new Date(key + "T00:00:00"); }

  function dailyTotals(entries) {
    var map = {};
    for (var i = 0; i < entries.length; i++) {
      var k = dateKey(new Date(entries[i].ts));
      map[k] = (map[k] || 0) + entries[i].count;
    }
    return map;
  }

  function evaluateMuscle(entries) {
    var level = parseInt(localStorage.getItem(KEY_MUSCLE), 10);
    if (isNaN(level)) level = DEFAULT_MUSCLE;

    var today = startOfDay(new Date());
    var checkedUntil = localStorage.getItem(KEY_MUSCLE_CHECKED);

    if (!checkedUntil) {
      localStorage.setItem(KEY_MUSCLE_CHECKED, dateKey(addDays(today, -1)));
      localStorage.setItem(KEY_MUSCLE, String(level));
      return level;
    }

    var map = dailyTotals(entries);
    var cursor = addDays(parseKey(checkedUntil), 1);
    var safety = 0;
    while (cursor < today && safety < 3650) {
      var dayTotal = map[dateKey(cursor)] || 0;
      if (dayTotal >= DAILY_TARGET) {
        level = Math.min(MAX_MUSCLE, level + 1);
      } else {
        level = Math.max(MIN_MUSCLE, level - 1);
      }
      cursor = addDays(cursor, 1);
      safety++;
    }

    localStorage.setItem(KEY_MUSCLE_CHECKED, dateKey(addDays(today, -1)));
    localStorage.setItem(KEY_MUSCLE, String(level));
    return level;
  }

  function lastEntryDate(entries) {
    if (entries.length === 0) return null;
    var max = entries[0].ts;
    for (var i = 1; i < entries.length; i++) {
      if (entries[i].ts > max) max = entries[i].ts;
    }
    return new Date(max);
  }

  function computeMood(entries) {
    var last = lastEntryDate(entries);
    if (!last) return "neutral";
    var today = startOfDay(new Date());
    var lastDay = startOfDay(last);
    var diffDays = Math.round((today.getTime() - lastDay.getTime()) / 86400000);
    if (diffDays <= 0) return "happy";
    if (diffDays === 1) return "neutral";
    return "angry";
  }

  function captionFor(level, mood) {
    if (mood === "angry") {
      return level <= 1
        ? "Autsch … Zeit für ein Comeback! 😤"
        : "Wo bleibst du? Dein Buddy vermisst die Liegestütze!";
    }
    if (mood === "neutral") {
      return "Heute schon trainiert? Dran bleiben!";
    }
    if (level >= 4) return "Du bist eine Maschine! 💪🔥";
    if (level >= 2) return "Starke Leistung, weiter so!";
    return "Guter Start – die Muckis kommen!";
  }

  function checkMilestone(total) {
    var last = parseInt(localStorage.getItem(KEY_MILESTONE), 10);
    if (isNaN(last)) last = 0;
    var current = Math.floor(total / MILESTONE_STEP) * MILESTONE_STEP;
    if (current > last && current > 0) {
      localStorage.setItem(KEY_MILESTONE, String(current));
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

  var CONFETTI_EMOJI = ["🎉", "💪", "🔥", "⭐", "🎊"];

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

  function showCelebration(milestone) {
    var msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)].replace("{n}", milestone.toLocaleString("de-DE"));
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

  closeBtn.addEventListener("click", hideCelebration);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) hideCelebration();
  });

  function render() {
    var entries = window.PushupApp.getEntries();
    var total = window.PushupApp.getTotal();

    var level = evaluateMuscle(entries);
    var mood = computeMood(entries);

    buddySvg.setAttribute("data-muscle", String(level));
    buddySvg.setAttribute("data-mood", mood);
    captionEl.textContent = captionFor(level, mood);

    var milestone = checkMilestone(total);
    if (milestone) showCelebration(milestone);
  }

  render();
  window.PushupApp.onChange(render);
})();
