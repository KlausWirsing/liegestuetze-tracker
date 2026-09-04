(function () {
  "use strict";

  // ---- Ziele (einfach anpassbar) ----
  var PUSHUPS_GOAL = 10000;
  var SQUATS_GOAL = 10000;
  var PLANK_GOAL_SECONDS = 18000; // 5 Stunden gesamt

  var pushups = window.createExerciseTracker({
    prefix: "pushups",
    unit: "reps",
    goal: PUSHUPS_GOAL,
    storageKeyEntries: "pushup_entries_v1",
    storageKeyStart: "pushup_start_date_v1",
    entryLabel: "Liegestütze"
  });

  var squats = window.createExerciseTracker({
    prefix: "squats",
    unit: "reps",
    goal: SQUATS_GOAL,
    storageKeyEntries: "squats_entries_v1",
    storageKeyStart: "squats_start_date_v1",
    entryLabel: "Squats"
  });

  var plank = window.createExerciseTracker({
    prefix: "plank",
    unit: "seconds",
    goal: PLANK_GOAL_SECONDS,
    storageKeyEntries: "plank_entries_v1",
    storageKeyStart: "plank_start_date_v1",
    entryLabel: "Sekunden Plank",
    manualEntry: true
  });

  window.PushupApp = pushups; // Name aus Kompatibilitätsgründen beibehalten
  window.SquatsApp = squats;
  window.PlankApp = plank;

  // ---- Tab-Navigation ----
  var pageTitle = document.getElementById("page-title");
  var tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.add("hidden"); });
      document.getElementById(btn.getAttribute("data-view")).classList.remove("hidden");
      if (pageTitle) pageTitle.textContent = btn.getAttribute("data-title") || "";
    });
  });

  // ---- Service Worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
