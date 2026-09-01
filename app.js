(function () {
  "use strict";

  // ---- Konfiguration ----
  var GOAL = 10000;
  var STORAGE_KEY_ENTRIES = "pushup_entries_v1";
  var STORAGE_KEY_START = "pushup_start_date_v1";

  // ---- Hilfsfunktionen ----
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

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
    // Woche beginnt Montag
    var r = startOfDay(d);
    var day = r.getDay(); // 0 = Sonntag
    var diff = day === 0 ? 6 : day - 1;
    return addDays(r, -diff);
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function fmtInt(n) {
    return Math.round(n).toLocaleString("de-DE");
  }

  // ---- Datenspeicher ----
  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_ENTRIES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  }

  function getStartDate() {
    var raw = localStorage.getItem(STORAGE_KEY_START);
    if (raw) return new Date(raw);
    var now = new Date();
    localStorage.setItem(STORAGE_KEY_START, now.toISOString());
    return now;
  }

  var entries = loadEntries();
  var startDate = getStartDate();

  function addEntry(amount) {
    var entry = { ts: Date.now(), count: amount };
    entries.push(entry);
    saveEntries(entries);
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
      saveEntries(entries);
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
      var d = new Date(entries[i].ts);
      var key = dateKey(d);
      map[key] = (map[key] || 0) + entries[i].count;
    }
    return map;
  }

  function calcStreak(map) {
    var streak = 0;
    var cursor = startOfDay(new Date());
    var todayKey = dateKey(cursor);
    if (!map[todayKey]) {
      cursor = addDays(cursor, -1);
    }
    while (map[dateKey(cursor)]) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function firstEntryDate() {
    if (entries.length === 0) return startDate;
    var min = entries[0].ts;
    for (var i = 1; i < entries.length; i++) {
      if (entries[i].ts < min) min = entries[i].ts;
    }
    return new Date(min);
  }

  function daysSince(d) {
    var diff = startOfDay(new Date()).getTime() - startOfDay(d).getTime();
    return Math.max(1, Math.floor(diff / 86400000) + 1);
  }

  // ---- Rendering ----
  var elTotal = document.getElementById("total-count");
  var elProgressPct = document.getElementById("progress-pct");
  var elProgressBar = document.getElementById("progress-bar");
  var elProgressSub = document.getElementById("progress-sub");

  var elStatToday = document.getElementById("stat-today");
  var elStatWeek = document.getElementById("stat-week");
  var elStatMonth = document.getElementById("stat-month");
  var elStatTotal = document.getElementById("stat-total");
  var elStreakValue = document.getElementById("streak-value");
  var elAvgTotal = document.getElementById("avg-total");
  var elAvgWeek = document.getElementById("avg-week");
  var elChart = document.getElementById("chart");

  var chartRange = 7;

  function renderHome() {
    var total = totalCount();
    elTotal.textContent = fmtInt(total);

    var pct = Math.min(100, (total / GOAL) * 100);
    elProgressBar.style.width = pct.toFixed(2) + "%";
    elProgressPct.textContent = (pct < 10 ? pct.toFixed(1) : Math.round(pct)) + " %";

    var remaining = Math.max(0, GOAL - total);
    elProgressSub.textContent = remaining === 0
      ? "Ziel erreicht! 🎉"
      : fmtInt(remaining) + " übrig bis " + fmtInt(GOAL);
  }

  function renderStats() {
    var total = totalCount();
    var today = startOfDay(new Date());
    var week = startOfWeek(new Date());
    var month = startOfMonth(new Date());

    var todaySum = sumSince(today);
    var weekSum = sumSince(week);
    var monthSum = sumSince(month);

    elStatToday.textContent = fmtInt(todaySum);
    elStatWeek.textContent = fmtInt(weekSum);
    elStatMonth.textContent = fmtInt(monthSum);
    elStatTotal.textContent = fmtInt(total);

    var map = dailyTotalsMap();
    var streak = calcStreak(map);
    elStreakValue.textContent = streak + (streak === 1 ? " Tag" : " Tage");

    var totalDays = daysSince(firstEntryDate());
    elAvgTotal.textContent = fmtInt(total / totalDays);

    var last7Start = addDays(today, -6);
    var last7Sum = sumSince(last7Start);
    elAvgWeek.textContent = fmtInt(last7Sum / 7);

    renderChart(map);
  }

  function renderChart(map) {
    elChart.innerHTML = "";
    var today = startOfDay(new Date());
    var days = [];
    for (var i = chartRange - 1; i >= 0; i--) {
      days.push(addDays(today, -i));
    }
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
      bar.title = dateKey(d) + ": " + val;

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

  var changeListeners = [];

  function render() {
    renderHome();
    renderStats();
    var total = totalCount();
    changeListeners.forEach(function (cb) { cb(total); });
  }

  window.PushupApp = {
    getTotal: totalCount,
    getEntries: function () { return entries; },
    getStartDate: function () { return startDate; },
    getTodayTotal: function () { return sumSince(startOfDay(new Date())); },
    onChange: function (cb) { changeListeners.push(cb); }
  };

  // ---- Undo Toast ----
  var undoToast = document.getElementById("undo-toast");
  var undoText = document.getElementById("undo-text");
  var undoBtn = document.getElementById("undo-btn");
  var undoTimer = null;
  var lastEntry = null;

  function showUndo(entry) {
    lastEntry = entry;
    undoText.textContent = "+" + entry.count + " Liegestütze hinzugefügt";
    undoToast.classList.remove("hidden");
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(function () {
      undoToast.classList.add("hidden");
      lastEntry = null;
    }, 3000);
  }

  undoBtn.addEventListener("click", function () {
    if (lastEntry) {
      removeEntry(lastEntry);
      lastEntry = null;
    }
    undoToast.classList.add("hidden");
    if (undoTimer) clearTimeout(undoTimer);
  });

  // ---- Event-Bindings ----
  var addButtons = document.querySelectorAll(".add-btn");
  addButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var amount = parseInt(btn.getAttribute("data-amount"), 10);
      var entry = addEntry(amount);
      showUndo(entry);
      if (navigator.vibrate) navigator.vibrate(15);
    });
  });

  var tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.add("hidden"); });
      document.getElementById(btn.getAttribute("data-view")).classList.remove("hidden");
    });
  });

  var rangeButtons = document.querySelectorAll(".range-btn");
  rangeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      rangeButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      chartRange = parseInt(btn.getAttribute("data-range"), 10);
      renderChart(dailyTotalsMap());
    });
  });

  // ---- Service Worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }

  // ---- Initial Render ----
  render();
})();
