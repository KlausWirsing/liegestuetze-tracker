(function () {
  "use strict";

  var U = window.ExerciseUtils;

  function whenReady(fn) {
    function check() {
      if (window.PushupApp && window.SquatsApp && window.PlankApp) fn();
      else setTimeout(check, 20);
    }
    check();
  }

  whenReady(function () {
    var pushups = window.PushupApp;
    var squats = window.SquatsApp;
    var plank = window.PlankApp;

    // Streak ist unproblematisch kombinierbar: es zählt nur, ob an einem Tag
    // IRGENDEINE Übung stattfand - keine Umrechnung zwischen Einheiten nötig.
    function combinedDailyHasActivity() {
      var map = {};
      [pushups.dailyTotalsMap(), squats.dailyTotalsMap(), plank.dailyTotalsMap()].forEach(function (src) {
        for (var k in src) if (src.hasOwnProperty(k) && src[k] > 0) map[k] = true;
      });
      return map;
    }
    function calcCombinedStreak() {
      var map = combinedDailyHasActivity();
      var streak = 0;
      var cursor = U.startOfDay(new Date());
      if (!map[U.dateKey(cursor)]) cursor = U.addDays(cursor, -1);
      while (map[U.dateKey(cursor)]) {
        streak++;
        cursor = U.addDays(cursor, -1);
      }
      return streak;
    }

    window.PushupCombined = {
      calcStreak: calcCombinedStreak
    };

    // ---- Gesamt-Screen rendern: jede Übung bleibt für sich, nichts wird verrechnet ----
    var elBreakdownPushups = document.getElementById("breakdown-pushups");
    var elBreakdownSquats = document.getElementById("breakdown-squats");
    var elBreakdownPlank = document.getElementById("breakdown-plank");
    var elStreakValue = document.getElementById("combined-streak-value");

    function renderTotal() {
      if (!elBreakdownPushups) return;
      elBreakdownPushups.textContent = U.fmtInt(pushups.getTotal());
      elBreakdownSquats.textContent = U.fmtInt(squats.getTotal());
      elBreakdownPlank.textContent = U.fmtDuration(plank.getTotal());

      var streak = calcCombinedStreak();
      elStreakValue.textContent = streak + (streak === 1 ? " Tag" : " Tage");
    }

    pushups.onChange(renderTotal);
    squats.onChange(renderTotal);
    plank.onChange(renderTotal);
    renderTotal();
  });
})();
