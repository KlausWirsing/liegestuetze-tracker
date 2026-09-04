// Generische Tracker-Fabrik: eine Instanz pro Übung (Liegestütze, Squats, Plank).
// Kapselt Datenhaltung (localStorage), Aggregation (Tag/Woche/Monat/Streak/Chart)
// und die generische Bedienung der zugehörigen DOM-Elemente eines Übungs-Screens.
window.createExerciseTracker = (function () {
  "use strict";

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function dateKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function startOfDay(d) {
    var r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }
  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function startOfWeek(d) {
    var r = startOfDay(d);
    var day = r.getDay();
    var diff = day === 0 ? 6 : day - 1;
    return addDays(r, -diff);
  }
  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function fmtInt(n) {
    return Math.round(n).toLocaleString("de-DE");
  }
  function fmtDuration(totalSeconds) {
    var s = Math.max(0, Math.round(totalSeconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ":" + pad2(m) + ":" + pad2(sec);
    return m + ":" + pad2(sec);
  }

  return function createExerciseTracker(config) {
    var prefix = config.prefix;
    var unit = config.unit || "reps";
    var goal = config.goal;
    var fmt = unit === "seconds" ? fmtDuration : fmtInt;

    function byId(suffix) { return document.getElementById(prefix + "-" + suffix); }

    // ---- Datenspeicher ----
    function loadEntries() {
      try {
        var raw = localStorage.getItem(config.storageKeyEntries);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    function saveEntries() {
      localStorage.setItem(config.storageKeyEntries, JSON.stringify(entries));
    }
    function getStartDate() {
      var raw = localStorage.getItem(config.storageKeyStart);
      if (raw) return new Date(raw);
      var now = new Date();
      localStorage.setItem(config.storageKeyStart, now.toISOString());
      return now;
    }

    var entries = loadEntries();
    var startDate = getStartDate();
    var changeListeners = [];

    function addEntry(amount) {
      if (!amount || amount <= 0) return null;
      var entry = { ts: Date.now(), count: amount };
      entries.push(entry);
      saveEntries();
      render();
      return entry;
    }
    function removeEntry(entry) {
      var idx = entries.indexOf(entry);
      if (idx === -1) {
        idx = entries.findIndex(function (e) { return e.ts === entry.ts && e.count === entry.count; });
      }
      if (idx !== -1) {
        entries.splice(idx, 1);
        saveEntries();
        render();
      }
    }

    // ---- Aggregation ----
    function totalCount() {
      var sum = 0;
      for (var i = 0; i < entries.length; i++) sum += entries[i].count;
      return sum;
    }
    function sumSince(sinceDate) {
      var sinceTs = sinceDate.getTime();
      var sum = 0;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].ts >= sinceTs) sum += entries[i].count;
      }
      return sum;
    }
    function dailyTotalsMap() {
      var map = {};
      for (var i = 0; i < entries.length; i++) {
        var key = dateKey(new Date(entries[i].ts));
        map[key] = (map[key] || 0) + entries[i].count;
      }
      return map;
    }
    function calcStreak(map) {
      var streak = 0;
      var cursor = startOfDay(new Date());
      if (!map[dateKey(cursor)]) cursor = addDays(cursor, -1);
      while (map[dateKey(cursor)]) {
        streak++;
        cursor = addDays(cursor, -1);
      }
      return streak;
    }
    function firstEntryDate() {
      if (entries.length === 0) return startDate;
      var min = entries[0].ts;
      for (var i = 1; i < entries.length; i++) if (entries[i].ts < min) min = entries[i].ts;
      return new Date(min);
    }
    function daysSince(d) {
      var diff = startOfDay(new Date()).getTime() - startOfDay(d).getTime();
      return Math.max(1, Math.floor(diff / 86400000) + 1);
    }

    // ---- Rendering ----
    var elTotal = byId("total-count");
    var elProgressBar = byId("progress-bar");
    var elProgressPct = byId("progress-pct");
    var elProgressSub = byId("progress-sub");
    var elStatToday = byId("stat-today");
    var elStatWeek = byId("stat-week");
    var elStatMonth = byId("stat-month");
    var elStatTotal = byId("stat-total");
    var elStreakValue = byId("streak-value");
    var elAvgTotal = byId("avg-total");
    var elAvgWeek = byId("avg-week");
    var elChart = byId("chart");
    var chartRange = 7;

    function renderTop() {
      if (!elTotal) return;
      var total = totalCount();
      elTotal.textContent = fmt(total);

      if (elProgressBar && goal) {
        var pct = Math.min(100, (total / goal) * 100);
        elProgressBar.style.width = pct.toFixed(2) + "%";
        elProgressPct.textContent = (pct < 10 ? pct.toFixed(1) : Math.round(pct)) + " %";
        var remaining = Math.max(0, goal - total);
        elProgressSub.textContent = remaining === 0
          ? "Ziel erreicht! 🎉"
          : fmt(remaining) + " übrig bis " + fmt(goal);
      }
    }

    function renderStats() {
      if (!elStatToday) return;
      var total = totalCount();
      var today = startOfDay(new Date());
      var week = startOfWeek(new Date());
      var month = startOfMonth(new Date());

      elStatToday.textContent = fmt(sumSince(today));
      elStatWeek.textContent = fmt(sumSince(week));
      elStatMonth.textContent = fmt(sumSince(month));
      elStatTotal.textContent = fmt(total);

      var map = dailyTotalsMap();
      var streak = calcStreak(map);
      elStreakValue.textContent = streak + (streak === 1 ? " Tag" : " Tage");

      var totalDays = daysSince(firstEntryDate());
      elAvgTotal.textContent = fmt(total / totalDays);

      var last7Sum = sumSince(addDays(today, -6));
      elAvgWeek.textContent = fmt(last7Sum / 7);

      renderChart(map);
    }

    function renderChart(map) {
      if (!elChart) return;
      elChart.innerHTML = "";
      var today = startOfDay(new Date());
      var days = [];
      for (var i = chartRange - 1; i >= 0; i--) days.push(addDays(today, -i));
      var values = days.map(function (d) { return map[dateKey(d)] || 0; });
      var max = Math.max.apply(null, values.concat([1]));

      days.forEach(function (d, idx) {
        var val = values[idx];
        var wrap = document.createElement("div");
        wrap.className = "chart-bar-wrap";

        var bar = document.createElement("div");
        bar.className = "chart-bar" + (val > 0 ? " has-value" : "");
        var heightPct = val > 0 ? Math.max(4, (val / max) * 100) : 2;
        bar.style.height = heightPct + "%";
        bar.title = dateKey(d) + ": " + fmt(val);
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

    function render() {
      renderTop();
      renderStats();
      var total = totalCount();
      changeListeners.forEach(function (cb) { cb(total); });
    }

    // ---- Undo Toast ----
    var undoToast = byId("undo-toast");
    var undoText = byId("undo-text");
    var undoBtn = byId("undo-btn");
    var undoTimer = null;
    var lastEntry = null;

    function showUndo(entry, label) {
      if (!undoToast) return;
      lastEntry = entry;
      undoText.textContent = "+" + fmt(entry.count) + " " + label + " hinzugefügt";
      undoToast.classList.remove("hidden");
      if (undoTimer) clearTimeout(undoTimer);
      undoTimer = setTimeout(function () {
        undoToast.classList.add("hidden");
        lastEntry = null;
      }, 3000);
    }
    if (undoBtn) {
      undoBtn.addEventListener("click", function () {
        if (lastEntry) { removeEntry(lastEntry); lastEntry = null; }
        undoToast.classList.add("hidden");
        if (undoTimer) clearTimeout(undoTimer);
      });
    }

    // ---- Event-Bindings: Schnell-Buttons ----
    var addButtons = document.querySelectorAll('.add-btn[data-exercise="' + prefix + '"]');
    addButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var amount = parseFloat(btn.getAttribute("data-amount"));
        var entry = addEntry(amount);
        if (entry) {
          showUndo(entry, config.entryLabel);
          if (navigator.vibrate) navigator.vibrate(15);
        }
      });
    });

    // ---- Event-Bindings: manuelle Zeiteingabe (Plank) ----
    if (config.manualEntry) {
      var btnManual = byId("manual-submit");
      var inputMin = byId("input-min");
      var inputSec = byId("input-sec");
      if (btnManual) {
        btnManual.addEventListener("click", function () {
          var min = parseInt(inputMin.value, 10) || 0;
          var sec = parseInt(inputSec.value, 10) || 0;
          var total = min * 60 + sec;
          if (total <= 0) return;
          var entry = addEntry(total);
          if (entry) {
            showUndo(entry, config.entryLabel);
            inputMin.value = "";
            inputSec.value = "";
            if (navigator.vibrate) navigator.vibrate(15);
          }
        });
      }
    }

    // ---- Event-Bindings: Chart-Zeitraum ----
    var rangeButtons = document.querySelectorAll('.range-btn[data-exercise="' + prefix + '"]');
    rangeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        rangeButtons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        chartRange = parseInt(btn.getAttribute("data-range"), 10);
        renderChart(dailyTotalsMap());
      });
    });

    render();

    return {
      addEntry: addEntry,
      removeEntry: removeEntry,
      getEntries: function () { return entries; },
      getStartDate: function () { return startDate; },
      getTotal: totalCount,
      getTodayTotal: function () { return sumSince(startOfDay(new Date())); },
      sumSince: sumSince,
      dailyTotalsMap: dailyTotalsMap,
      calcStreak: function () { return calcStreak(dailyTotalsMap()); },
      firstEntryDate: firstEntryDate,
      formatValue: fmt,
      unit: unit,
      onChange: function (cb) { changeListeners.push(cb); }
    };
  };
})();

window.ExerciseUtils = (function () {
  "use strict";
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function startOfDay(d) { var r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function startOfWeek(d) {
    var r = startOfDay(d);
    var day = r.getDay();
    return addDays(r, -(day === 0 ? 6 : day - 1));
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function fmtInt(n) { return Math.round(n).toLocaleString("de-DE"); }
  function fmtDuration(totalSeconds) {
    var s = Math.max(0, Math.round(totalSeconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ":" + (m < 10 ? "0" + m : m) + ":" + (sec < 10 ? "0" + sec : sec);
    return m + ":" + (sec < 10 ? "0" + sec : sec);
  }
  return {
    dateKey: dateKey, startOfDay: startOfDay, addDays: addDays,
    startOfWeek: startOfWeek, startOfMonth: startOfMonth,
    fmtInt: fmtInt, fmtDuration: fmtDuration
  };
})();
