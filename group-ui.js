(function () {
  "use strict";

  function whenReady(fn, onTimeout) {
    var waited = 0;
    function check() {
      if (window.PushupApp && window.PushupCloud) {
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

  whenReady(function () {
    var cloud = window.PushupCloud;
    var appApi = window.PushupApp;

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
    var leadEl = document.getElementById("leaderboard-lead");
    var listEl = document.getElementById("leaderboard-list");
    var copyToast = document.getElementById("copy-toast");

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

    function fmt(n) {
      return Math.round(n).toLocaleString("de-DE");
    }

    function renderLeaderboard(players) {
      listEl.innerHTML = "";

      if (players.length === 0) {
        leadEl.textContent = "Warte auf Daten …";
        return;
      }

      var me = null;
      players.forEach(function (p) { if (p.isMe) me = p; });

      if (players.length === 1 && me) {
        leadEl.textContent = "Du bist allein in der Gruppe – lade einen Freund mit dem Code ein!";
      } else if (me && players[0].isMe) {
        var second = players[1];
        var lead = me.total - second.total;
        leadEl.textContent = lead > 0
          ? "🏆 Du liegst vorne, " + fmt(lead) + " vor " + second.name
          : "Gleichstand mit " + second.name + "!";
      } else if (me) {
        var leader = players[0];
        var gap = leader.total - me.total;
        leadEl.textContent = leader.name + " liegt " + fmt(gap) + " vor dir";
      } else {
        leadEl.textContent = "";
      }

      players.forEach(function (p, idx) {
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
        total.textContent = fmt(p.total);

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(total);
        listEl.appendChild(row);
      });
    }

    btnCreate.addEventListener("click", function () {
      var name = inputName.value.trim();
      if (!name) { showError("Bitte gib deinen Namen ein."); return; }
      clearError();
      cloud.createGroup(name, appApi.getTotal()).then(function () {
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
      cloud.joinGroup(code, name, appApi.getTotal()).then(function () {
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

    cloud.onLeaderboard(renderLeaderboard);

    appApi.onChange(function (total) {
      if (cloud.hasGroup()) cloud.syncTotal(total);
    });

    if (cloud.hasGroup()) {
      showBoard();
      cloud.syncTotal(appApi.getTotal());
    } else {
      showJoin();
    }
  }, function () {
    var joinCard = document.getElementById("group-join-card");
    joinCard.innerHTML = '<h2 class="section-title">Mit Freunden vergleichen</h2>' +
      '<p class="section-hint">Dafür brauchst du eine Internetverbindung. Bitte prüfe dein Netz und öffne den Tab erneut.</p>';
  });
})();
