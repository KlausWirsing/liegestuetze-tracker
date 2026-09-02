(function () {
  "use strict";

  var SLAP_CYCLE_MS = 1600;
  var SLAP_COUNT = 5;
  var KICK_MS = 600;

  var overlay = document.getElementById("battle-overlay");
  var scene = document.getElementById("battle-svg");
  var attackerEl = document.getElementById("fighter-attacker");
  var defenderEl = document.getElementById("fighter-defender");
  var attackerNameEl = document.getElementById("battle-attacker-name");
  var defenderNameEl = document.getElementById("battle-defender-name");
  var impactEl = document.getElementById("battle-impact");
  var resultEl = document.getElementById("battle-result");
  var closeBtn = document.getElementById("battle-close");

  var timers = [];
  var doneCallback = null;

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    timers = [];
  }

  function spawnImpact(leftPct, topPct) {
    var span = document.createElement("span");
    span.className = "impact-star";
    span.textContent = ["💥", "✨", "⚡"][Math.floor(Math.random() * 3)];
    span.style.left = leftPct + "%";
    span.style.top = topPct + "%";
    impactEl.appendChild(span);
    setTimeout(function () {
      if (span.parentNode) span.parentNode.removeChild(span);
    }, 450);
  }

  function reset() {
    clearTimers();
    scene.classList.remove("slapping", "kicking");
    attackerEl.classList.remove("is-defeated", "is-winner");
    defenderEl.classList.remove("is-defeated", "is-winner");
    resultEl.classList.add("hidden");
    closeBtn.classList.add("hidden");
    impactEl.innerHTML = "";
  }

  function finishFight(loserEl, opts) {
    var winnerEl = loserEl === attackerEl ? defenderEl : attackerEl;
    winnerEl.classList.add("is-winner");
    loserEl.classList.add("is-defeated");
    var winnerName = opts.attackerWins ? opts.attackerName : opts.defenderName;
    var showTimer = setTimeout(function () {
      resultEl.textContent = "🏳️ " + winnerName + " gewinnt!";
      resultEl.classList.remove("hidden");
      closeBtn.classList.remove("hidden");
    }, 500);
    timers.push(showTimer);
  }

  function play(opts) {
    reset();
    attackerNameEl.textContent = opts.attackerName;
    defenderNameEl.textContent = opts.defenderName;
    overlay.classList.remove("hidden");
    doneCallback = opts.onDone || null;

    requestAnimationFrame(function () {
      scene.classList.add("slapping");
      spawnImpact(68, 20);
      var slapInterval = setInterval(function () {
        spawnImpact(68, 20);
      }, SLAP_CYCLE_MS);
      timers.push(slapInterval);

      var resolveTimer = setTimeout(function () {
        clearInterval(slapInterval);
        scene.classList.remove("slapping");

        if (opts.attackerWins) {
          finishFight(defenderEl, opts);
        } else {
          scene.classList.add("kicking");
          spawnImpact(33, 65);
          var kickTimer = setTimeout(function () {
            scene.classList.remove("kicking");
            finishFight(attackerEl, opts);
          }, KICK_MS);
          timers.push(kickTimer);
        }
      }, SLAP_CYCLE_MS * SLAP_COUNT);
      timers.push(resolveTimer);
    });
  }

  closeBtn.addEventListener("click", function () {
    overlay.classList.add("hidden");
    reset();
    if (doneCallback) doneCallback();
  });

  window.PushupBattle = { play: play };
})();
