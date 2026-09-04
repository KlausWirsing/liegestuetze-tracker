(function () {
  "use strict";

  // Gewichtung: wie viele "Punkte" ein Wiederholung/eine Sekunde zählt.
  // Frei anpassbar, falls das Verhältnis nicht passt.
  var POINTS_PER_PUSHUP = 1;
  var POINTS_PER_SQUAT = 1;
  var POINTS_PER_PLANK_SECOND = 0.5; // 2 Sekunden Plank = 1 Punkt

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

    function total() {
      return pushups.getTotal() * POINTS_PER_PUSHUP
        + squats.getTotal() * POINTS_PER_SQUAT
        + plank.getTotal() * POINTS_PER_PLANK_SECOND;
    }
    function todayTotal() {
      return pushups.getTodayTotal() * POINTS_PER_PUSHUP
        + squats.getTodayTotal() * POINTS_PER_SQUAT
        + plank.getTodayTotal() * POINTS_PER_PLANK_SECOND;
    }
    function sumSince(date) {
      return pushups.sumSince(date) * POINTS_PER_PUSHUP
        + squats.sumSince(date) * POINTS_PER_SQUAT
        + plank.sumSince(date) * POINTS_PER_PLANK_SECOND;
    }
    function dailyTotalsMap() {
      var map = {};
      function merge(src, factor) {
        for (var k in src) if (src.hasOwnProperty(k)) map[k] = (map[k] || 0) + src[k] * factor;
      }
      merge(pushups.dailyTotalsMap(), POINTS_PER_PUSHUP);
      merge(squats.dailyTotalsMap(), POINTS_PER_SQUAT);
      merge(plank.dailyTotalsMap(), POINTS_PER_PLANK_SECOND);
      return map;
    }
    function calcStreakFromMap(map) {
      var streak = 0;
      var cursor = U.startOfDay(new Date());
      if (!map[U.dateKey(cursor)]) cursor = U.addDays(cursor, -1);
      while (map[U.dateKey(cursor)]) {
        streak++;
        cursor = U.addDays(cursor, -1);
      }
      return streak;
    }
    function firstEntryDate() {
      var dates = [pushups.firstEntryDate(), squats.firstEntryDate(), plank.firstEntryDate()];
      return new Date(Math.min.apply(null, dates.map(function (d) { return d.getTime(); })));
    }
    function lastEntryTimestamp() {
      var all = pushups.getEntries().concat(squats.getEntries(), plank.getEntries());
      if (all.length === 0) return null;
      var max = all[0].ts;
      for (var i = 1; i < all.length; i++) if (all[i].ts > max) max = all[i].ts;
      return max;
    }
    function daysSince(d) {
      var diff = U.startOfDay(new Date()).getTime() - U.startOfDay(d).getTime();
      return Math.max(1, Math.floor(diff / 86400000) + 1);
    }

    var changeListeners = [];
    function notify() {
      var t = total();
      changeListeners.forEach(function (cb) { cb(t); });
    }

    window.PushupCombined = {
      getTotal: total,
      getTodayTotal: todayTotal,
      sumSince: sumSince,
      dailyTotalsMap: dailyTotalsMap,
      calcStreak: function () { return calcStreakFromMap(dailyTotalsMap()); },
      firstEntryDate: firstEntryDate,
      getLastEntryTimestamp: lastEntryTimestamp,
      onChange: function (cb) { changeListeners.push(cb); }
    };

    // ---- Gesamt-Screen rendern ----
    var elTotal = document.getElementById("combined-total-count");
    var elBreakdownPushups = document.getElementById("breakdown-pushups");
    var elBreakdownSquats = document.getElementById("breakdown-squats");
    var elBreakdownPlank = document.getElementById("breakdown-plank");
    var elStatToday = document.getElementById("combined-stat-today");
    var elStatWeek = document.getElementById("combined-stat-week");
    var elStatMonth = document.getElementById("combined-stat-month");
    var elStatTotal = document.getElementById("combined-stat-total");
    var elStreakValue = document.getElementById("combined-streak-value");
    var elAvgTotal = document.getElementById("combined-avg-total");
    var elAvgWeek = document.getElementById("combined-avg-week");
    var elChart = document.getElementById("combined-chart");
    var chartRange = 7;

    function fmtPts(n) { return Math.round(n).toLocaleString("de-DE"); }

    function renderBreakdown() {
      if (!elBreakdownPushups) return;
      elBreakdownPushups.textContent = U.fmtInt(pushups.getTotal());
      elBreakdownSquats.textContent = U.fmtInt(squats.getTotal());
      elBreakdownPlank.textContent = U.fmtDuration(plank.getTotal());
    }

    function renderCombinedStats() {
      if (!elStatToday) return;
      var t = total();
      var today = U.startOfDay(new Date());
      var week = U.startOfWeek(new Date());
      var month = U.startOfMonth(new Date());

      elTotal.textContent = fmtPts(t);
      elStatToday.textContent = fmtPts(sumSince(today));
      elStatWeek.textContent = fmtPts(sumSince(week));
      elStatMonth.textContent = fmtPts(sumSince(month));
      elStatTotal.textContent = fmtPts(t);

      var map = dailyTotalsMap();
      var streak = calcStreakFromMap(map);
      elStreakValue.textContent = streak + (streak === 1 ? " Tag" : " Tage");

      var totalDays = daysSince(firstEntryDate());
      elAvgTotal.textContent = fmtPts(t / totalDays);
      elAvgWeek.textContent = fmtPts(sumSince(U.addDays(today, -6)) / 7);

      renderChart(map);
      renderBreakdown();
    }

    function renderChart(map) {
      if (!elChart) return;
      elChart.innerHTML = "";
      var today = U.startOfDay(new Date());
      var days = [];
      for (var i = chartRange - 1; i >= 0; i--) days.push(U.addDays(today, -i));
      var values = days.map(function (d) { return map[U.dateKey(d)] || 0; });
      var max = Math.max.apply(null, values.concat([1]));

      days.forEach(function (d, idx) {
        var val = values[idx];
        var wrap = document.createElement("div");
        wrap.className = "chart-bar-wrap";
        var bar = document.createElement("div");
        bar.className = "chart-bar" + (val > 0 ? " has-value" : "");
        bar.style.height = (val > 0 ? Math.max(4, (val / max) * 100) : 2) + "%";
        bar.title = U.dateKey(d) + ": " + fmtPts(val) + " Punkte";
        wrap.appendChild(bar);
        if (chartRange === 7 || d.getDay() === 1 || idx === days.length - 1) {
          var label = document.createElement("div");
          label.className = "chart-day-label";
          label.textContent = chartRange === 7
            ? d.toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2)
            : d.getDate() + "." + (d.getMonth() + 1) + ".";
          wrap.appendChild(label);
        }
        elChart.appendChild(wrap);
      });
    }

    var rangeButtons = document.querySelectorAll('.range-btn[data-exercise="combined"]');
    rangeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        rangeButtons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        chartRange = parseInt(btn.getAttribute("data-range"), 10);
        renderChart(dailyTotalsMap());
      });
    });

    pushups.onChange(function () { renderCombinedStats(); notify(); });
    squats.onChange(function () { renderCombinedStats(); notify(); });
    plank.onChange(function () { renderCombinedStats(); notify(); });

    renderCombinedStats();
  });
})();
