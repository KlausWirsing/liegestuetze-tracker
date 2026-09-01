(function () {
  "use strict";

  var SEED_BASELINE = 10; // angenommener Schnitt, bevor genug eigene Historie besteht
  var BIG_MILESTONE_STEP = 500;
  var SMALL_MILESTONE_STEP = 50;
  var MIN_MUSCLE = 0;
  var MAX_MUSCLE = 5;
  var DEFAULT_MUSCLE = 2;

  var KEY_MUSCLE = "pushup_muscle_level_v1";
  var KEY_MUSCLE_CHECKED = "pushup_muscle_checked_until_v1";
  var KEY_BIG_MILESTONE = "pushup_last_milestone_v1";
  var KEY_SMALL_MILESTONE = "pushup_last_small_milestone_v1";

  var BIG_MESSAGES = [
    "Wahnsinn! Du hast {n} Liegestütze geschafft!",
    "{n} Liegestütze! Du bist nicht mehr zu stoppen!",
    "Boom! {n} erreicht – weiter so, Champion!",
    "{n} Liegestütze im Kasten! Absolute Bestleistung!",
    "Respekt! {n} Liegestütze – dein Buddy ist mächtig stolz auf dich!",
    "{n}! Deine Muckis merken das schon. Dran bleiben!"
  ];
  var SMALL_MESSAGES = [
    "{n} geschafft! Weiter so 👊",
    "{n} Stück – sauber!",
    "{n}! Dein Buddy nickt anerkennend.",
    "{n} erreicht, nicht nachlassen!",
    "{n} im Sack. Nächste Runde!"
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

  function firstEntryDay(entries) {
    if (entries.length === 0) return null;
    var min = entries[0].ts;
    for (var i = 1; i < entries.length; i++) {
      if (entries[i].ts < min) min = entries[i].ts;
    }
    return startOfDay(new Date(min));
  }

  // Muskeln: jeder abgeschlossene Tag wird gegen den bisherigen eigenen
  // Gesamtdurchschnitt (alle Tage davor) verglichen - "täglich vs. generell".
  // Drüber -> Muckis auf, drunter -> Muckis ab. Kein fester Zeitrahmen nötig.
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

    var firstDay = firstEntryDay(entries);
    var map = dailyTotals(entries);
    var cursor = addDays(parseKey(checkedUntil), 1);
    var safety = 0;

    while (cursor < today && safety < 3650) {
      var dayTotal = map[dateKey(cursor)] || 0;

      var priorSum = 0;
      var priorDays = 0;
      if (firstDay && firstDay < cursor) {
        var pc = new Date(firstDay);
        while (pc < cursor) {
          priorSum += map[dateKey(pc)] || 0;
          priorDays++;
          pc = addDays(pc, 1);
        }
      }
      var reference = priorDays > 0 ? (priorSum / priorDays) : SEED_BASELINE;

      if (dayTotal >= reference) {
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

  function showBigCelebration(milestone) {
    var msg = BIG_MESSAGES[Math.floor(Math.random() * BIG_MESSAGES.length)].replace("{n}", milestone.toLocaleString("de-DE"));
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

  function showSmallCheer(milestone) {
    var msg = SMALL_MESSAGES[Math.floor(Math.random() * SMALL_MESSAGES.length)].replace("{n}", milestone.toLocaleString("de-DE"));
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

  function render() {
    var entries = window.PushupApp.getEntries();
    var total = window.PushupApp.getTotal();

    currentLevel = evaluateMuscle(entries);
    currentMood = computeMood(entries);

    buddySvg.setAttribute("data-muscle", String(currentLevel));
    buddySvg.setAttribute("data-mood", currentMood);
    captionEl.textContent = captionFor(currentLevel, currentMood);

    var big = checkMilestone(total, KEY_BIG_MILESTONE, BIG_MILESTONE_STEP);
    if (big) {
      showBigCelebration(big);
      localStorage.setItem(KEY_SMALL_MILESTONE, String(big));
    } else {
      var small = checkMilestone(total, KEY_SMALL_MILESTONE, SMALL_MILESTONE_STEP);
      if (small) showSmallCheer(small);
    }
  }

  window.PushupBuddy = {
    getMuscleLevel: function () { return currentLevel; },
    getMood: function () { return currentMood; }
  };

  render();
  window.PushupApp.onChange(render);
})();
