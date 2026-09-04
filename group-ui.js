(function () {
  "use strict";

  var SEEN_FIGHTS_KEY = "pushup_seen_fights_v1";
  var U = window.ExerciseUtils;

  function loadSeenFights() {
    try {
      var raw = localStorage.getItem(SEEN_FIGHTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveSeenFights(list) {
    var trimmed = list.slice(-200);
    localStorage.setItem(SEEN_FIGHTS_KEY, JSON.stringify(trimmed));
  }

  function whenReady(fn, onTimeout) {
    var waited = 0;
    function check() {
      if (window.PushupApp && window.SquatsApp && window.PlankApp && window.PushupCloud && window.PushupBattle) {
        window.PushupCloud.onReady(function () { fn(); });
      } else if (waited > 6000) {
        onTimeout();
      } else {
        waited += 50;
        setTimeout(check, 50);
      }
    }
    check();
  }

  // Eine Übungs-Rangliste: welches Feld sortiert, wie wird formatiert.
  var RANKINGS = [
    { field: "pushupsTotal", listEl: "ranking-pushups", leadEl: "lead-pushups", fmt: U.fmtInt, unit: "" },
    { field: "plankTotal", listEl: "ranking-plank", leadEl: "lead-plank", fmt: U.fmtDuration, unit: "" },
    { field: "squatsTotal", listEl: "ranking-squats", leadEl: "lead-squats", fmt: U.fmtInt, unit: "" }
  ];

  whenReady(function () {
    var cloud = window.PushupCloud;
    var battle = window.PushupBattle;

    var joinCard = document.getElementById("group-join-card");
    var boardCard = document.getElementById("group-board-card");
    var inputName = document.getElementById("input-name");
    var inputCode = document.getElementById("input-code");
    var btnCreate = document.getElementById("btn-create-group");
    var btnJoin = document.getElementById("btn-join-group");
    var errorEl = document.getElementById("group-error");
    var codeDisplay = document.getElementById("group-code-display");
    var btnCopy = document.getElementById("btn-copy-code");
    var btnLeave = document.getElementById("btn-leave-group");
    var copyToast = document.getElementById("copy-toast");
    var tauntStatusEl = document.getElementById("taunt-status");
    var btnInjury = document.getElementById("btn-injury-toggle");
    var injuryBtnText = document.getElementById("injury-btn-text");
    var fightListEl = document.getElementById("fight-list");

    var seenFights = loadSeenFights();
    var incomingQueue = [];
    var battlePlaying = false;
    var lastFights = [];

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.remove("hidden");
    }
    function clearError() {
      errorEl.classList.add("hidden");
    }

    function showBoard() {
      joinCard.classList.add("hidden");
      boardCard.classList.remove("hidden");
      codeDisplay.textContent = cloud.getGroupCode() || "";
    }
    function showJoin() {
      boardCard.classList.add("hidden");
      joinCard.classList.remove("hidden");
      inputName.value = cloud.getDisplayName() || "";
    }

    function tallyFights(fights) {
      var map = {};
      fights.forEach(function (f) {
        if (!map[f.challengerUid]) map[f.challengerUid] = { wins: 0, losses: 0 };
        if (!map[f.opponentUid]) map[f.opponentUid] = { wins: 0, losses: 0 };
        if (f.winnerUid === f.challengerUid) {
          map[f.challengerUid].wins++;
          map[f.opponentUid].losses++;
        } else {
          map[f.opponentUid].wins++;
          map[f.challengerUid].losses++;
        }
      });
      return map;
    }

    function renderTauntStatus() {
      var remaining = cloud.getTauntsRemaining();
      tauntStatusEl.textContent = remaining > 0
        ? "Noch " + remaining + "x diese Woche anpöbeln (So–So)"
        : "Diese Woche schon 2x angepöbelt – ab Sonntag wieder frei";
    }

    function renderInjuryButton() {
      var injured = cloud.isInjured();
      btnInjury.classList.toggle("is-active", injured);
      injuryBtnText.textContent = injured ? "Wieder fit melden" : "Verletzungspause nehmen";
    }

    btnInjury.addEventListener("click", function () {
      cloud.setInjured(!cloud.isInjured()).then(renderInjuryButton);
    });

    function playNext() {
      if (battlePlaying || incomingQueue.length === 0) return;
      battlePlaying = true;
      var job = incomingQueue.shift();
      battle.play({
        attackerName: job.attackerName,
        defenderName: job.defenderName,
        attackerWins: job.attackerWins,
        onDone: function () {
          battlePlaying = false;
          renderTauntStatus();
          playNext();
        }
      });
    }

    function startChallenge(opponent, btnEl) {
      if (cloud.isInjured()) {
        showError("Du bist gerade in der Verletzungspause und kannst nicht anpöbeln.");
        return;
      }
      if (opponent.injured) {
        showError(opponent.name + " ist gerade verletzt und kann nicht angepöbelt werden.");
        return;
      }
      if (cloud.getTauntsRemaining() <= 0) {
        showError("Diese Woche hast du schon 2x angepöbelt. Ab Sonntag wieder frei!");
        return;
      }
      clearError();
      if (btnEl) btnEl.setAttribute("disabled", "disabled");

      cloud.challenge(opponent.uid, opponent.name).then(function (result) {
        seenFights.push(result.id);
        saveSeenFights(seenFights);
        incomingQueue.push({
          attackerName: result.me.name + " (Du)",
          defenderName: result.opponent.name,
          attackerWins: result.winnerUid === result.me.uid
        });
        playNext();
      }).catch(function () {
        showError("Anpöbeln hat nicht geklappt. Prüfe deine Verbindung.");
      }).finally(function () {
        if (btnEl) btnEl.removeAttribute("disabled");
      });
    }

    function renderRanking(cfg, players) {
      var listEl = document.getElementById(cfg.listEl);
      var leadEl = document.getElementById(cfg.leadEl);
      listEl.innerHTML = "";

      var sorted = players.slice().sort(function (a, b) { return (b[cfg.field] || 0) - (a[cfg.field] || 0); });
      var me = null;
      sorted.forEach(function (p) { if (p.isMe) me = p; });

      if (sorted.length <= 1) {
        leadEl.textContent = "";
      } else if (me && sorted[0].isMe) {
        var second = sorted[1];
        var lead = (me[cfg.field] || 0) - (second[cfg.field] || 0);
        leadEl.textContent = lead > 0
          ? "🏆 Vorne, " + cfg.fmt(lead) + " vor " + second.name
          : "Gleichstand mit " + second.name;
      } else if (me) {
        var leader = sorted[0];
        var gap = (leader[cfg.field] || 0) - (me[cfg.field] || 0);
        leadEl.textContent = leader.name + " liegt " + cfg.fmt(gap) + " vor dir";
      } else {
        leadEl.textContent = "";
      }

      sorted.forEach(function (p, idx) {
        var row = document.createElement("div");
        row.className = "leaderboard-row" + (p.isMe ? " is-me" : "");

        var rank = document.createElement("div");
        rank.className = "leaderboard-rank";
        rank.textContent = (idx + 1) + ".";

        var name = document.createElement("div");
        name.className = "leaderboard-name";
        name.textContent = p.name + (p.isMe ? " (Du)" : "");

        var total = document.createElement("div");
        total.className = "leaderboard-total";
        total.textContent = cfg.fmt(p[cfg.field] || 0);

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(total);
        listEl.appendChild(row);
      });
    }

    function renderFightList(players, fights) {
      fightListEl.innerHTML = "";
      var records = tallyFights(fights);
      var others = players.filter(function (p) { return !p.isMe; });

      if (others.length === 0) {
        fightListEl.innerHTML = '<p class="section-hint">Noch niemand zum Anpöbeln da – lade einen Freund mit dem Code ein!</p>';
        return;
      }

      others.forEach(function (p) {
        var row = document.createElement("div");
        row.className = "leaderboard-row" + (p.injured ? " is-injured" : "");

        var name = document.createElement("div");
        name.className = "leaderboard-name";
        name.textContent = p.name;
        row.appendChild(name);

        if (p.injured) {
          var badge = document.createElement("div");
          badge.className = "leaderboard-injury-badge";
          badge.textContent = "✚";
          badge.title = "Verletzungspause";
          row.appendChild(badge);
        }

        var rec = records[p.uid];
        var recordEl = document.createElement("div");
        recordEl.className = "leaderboard-record";
        recordEl.textContent = "🥊" + (rec ? rec.wins : 0) + "/" + (rec ? rec.losses : 0);
        recordEl.title = (rec ? rec.wins : 0) + " Siege, " + (rec ? rec.losses : 0) + " Niederlagen";
        row.appendChild(recordEl);

        var myInjured = cloud.isInjured();
        if (!p.injured && !myInjured) {
          var challengeBtn = document.createElement("button");
          challengeBtn.className = "challenge-btn";
          challengeBtn.textContent = "⚔️";
          challengeBtn.title = "Anpöbeln";
          challengeBtn.addEventListener("click", function () {
            startChallenge(p, challengeBtn);
          });
          row.appendChild(challengeBtn);
        }

        fightListEl.appendChild(row);
      });
    }

    function renderAll(players) {
      if (players.length === 0) {
        RANKINGS.forEach(function (cfg) {
          document.getElementById(cfg.listEl).innerHTML = "";
          document.getElementById(cfg.leadEl).textContent = "Warte auf Daten …";
        });
        tauntStatusEl.textContent = "";
        return;
      }
      renderTauntStatus();
      renderInjuryButton();
      RANKINGS.forEach(function (cfg) { renderRanking(cfg, players); });
      renderFightList(players, lastFights);
    }

    btnCreate.addEventListener("click", function () {
      var name = inputName.value.trim();
      if (!name) { showError("Bitte gib deinen Namen ein."); return; }
      clearError();
      cloud.createGroup(name).then(function () {
        showBoard();
      }).catch(function () {
        showError("Gruppe konnte nicht erstellt werden. Prüfe deine Internetverbindung.");
      });
    });

    btnJoin.addEventListener("click", function () {
      var name = inputName.value.trim();
      var code = inputCode.value.trim();
      if (!name) { showError("Bitte gib deinen Namen ein."); return; }
      if (!code) { showError("Bitte gib einen Gruppencode ein."); return; }
      clearError();
      cloud.joinGroup(code, name).then(function () {
        showBoard();
      }).catch(function () {
        showError("Beitritt fehlgeschlagen. Prüfe den Code und deine Internetverbindung.");
      });
    });

    btnLeave.addEventListener("click", function () {
      cloud.leaveGroup();
      showJoin();
    });

    btnCopy.addEventListener("click", function () {
      var code = cloud.getGroupCode() || "";
      var done = function () {
        copyToast.classList.remove("hidden");
        setTimeout(function () { copyToast.classList.add("hidden"); }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(done);
      } else {
        done();
      }
    });

    cloud.onLeaderboard(renderAll);

    cloud.onFights(function (fights) {
      lastFights = fights;
      renderAll(cloud.getLeaderboardSnapshot());

      var myUid = cloud.getUid();
      var newlySeen = false;
      fights.forEach(function (f) {
        if (seenFights.indexOf(f.id) !== -1) return;
        newlySeen = true;
        seenFights.push(f.id);
        var isRecent = (Date.now() - f.createdAtMs) < (2 * 60 * 60 * 1000);
        if (isRecent && f.opponentUid === myUid && f.challengerUid !== myUid) {
          incomingQueue.push({
            attackerName: f.challengerName + " hat dich angepöbelt!",
            defenderName: f.opponentName + " (Du)",
            attackerWins: f.winnerUid === f.challengerUid
          });
        }
      });
      if (newlySeen) saveSeenFights(seenFights);
      playNext();
    });

    function syncIfInGroup() {
      if (cloud.hasGroup()) cloud.syncAll();
    }
    window.PushupApp.onChange(syncIfInGroup);
    window.SquatsApp.onChange(syncIfInGroup);
    window.PlankApp.onChange(syncIfInGroup);

    if (cloud.hasGroup()) {
      showBoard();
      cloud.syncAll();
    } else {
      showJoin();
    }
  }, function () {
    var joinCard = document.getElementById("group-join-card");
    joinCard.innerHTML = '<h2 class="section-title">Mit Freunden vergleichen</h2>' +
      '<p class="section-hint">Dafür brauchst du eine Internetverbindung. Bitte prüfe dein Netz und öffne den Tab erneut.</p>';
  });
})();
