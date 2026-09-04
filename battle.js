(function () {
  "use strict";

  var SLAP_COUNT = 6;
  var SWING_DURATION = 710;   // muss zu den CSS-Keyframes (swing-cycle) passen
  var IMPACT_DELAY = 355;     // Zeitpunkt des Treffers innerhalb eines Swings
  var SWING_PAUSE = 260;      // Pause zwischen zwei Ohrfeigen
  var KICK_DURATION = 650;    // muss zu hip-kick passen
  var KICK_IMPACT_DELAY = 420;
  var COLLAPSE_DURATION = 1300; // muss zu stumble-fall passen

  var overlay = document.getElementById("battle-overlay");
  var scene = document.getElementById("battle-svg");
  var attackerEl = document.getElementById("fighter-attacker");
  var defenderEl = document.getElementById("fighter-defender");
  var attackerTorso = attackerEl.querySelector(".torso-group");
  var defenderTorso = defenderEl.querySelector(".defender-torso-group");
  var slapArmA = attackerEl.querySelector(".slap-arm-a");
  var slapArmB = attackerEl.querySelector(".slap-arm-b");
  var attackerNameEl = document.getElementById("battle-attacker-name");
  var defenderNameEl = document.getElementById("battle-defender-name");
  var impactEl = document.getElementById("battle-impact");
  var resultEl = document.getElementById("battle-result");
  var closeBtn = document.getElementById("battle-close");

  var timers = [];
  var rafId = null;
  var doneCallback = null;

  function later(fn, ms) {
    var t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  }

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
    el.classList.add(cls);
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
    }, 420);
  }

  function reset() {
    clearTimers();
    scene.classList.remove("kicking");
    [attackerEl, defenderEl].forEach(function (el) {
      el.classList.remove("is-collapsing", "is-defeated", "is-winner");
    });
    [slapArmA, slapArmB].forEach(function (el) { el.classList.remove("swinging"); });
    attackerTorso.classList.remove("twisting-a", "twisting-b");
    defenderTorso.classList.remove("reacting", "kick-reacting");
    resultEl.classList.add("hidden");
    closeBtn.classList.add("hidden");
    impactEl.innerHTML = "";
  }

  function triggerSwing(side) {
    var armEl = side === "a" ? slapArmA : slapArmB;
    var otherEl = side === "a" ? slapArmB : slapArmA;
    otherEl.classList.remove("swinging");
    restart(armEl, "swinging");
    attackerTorso.classList.remove("twisting-a", "twisting-b");
    restart(attackerTorso, side === "a" ? "twisting-a" : "twisting-b");

    later(function () {
      spawnImpact(70, 24);
      restart(defenderTorso, "reacting");
    }, IMPACT_DELAY);
  }

  function playSlaps(count, onDone) {
    var i = 0;
    function next() {
      if (i >= count) { onDone(); return; }
      triggerSwing(i % 2 === 0 ? "a" : "b");
      i++;
      later(next, SWING_DURATION + SWING_PAUSE);
    }
    next();
  }

  function performKick(onDone) {
    scene.classList.add("kicking");
    later(function () {
      spawnImpact(33, 66);
      restart(attackerTorso, "twisting-a"); // leichte Reaktion des Angreifers auf den Tritt
    }, KICK_IMPACT_DELAY);
    later(function () {
      scene.classList.remove("kicking");
      onDone();
    }, KICK_DURATION);
  }

  function collapseFighter(el, onDone) {
    el.classList.add("is-collapsing");
    later(function () {
      spawnImpact(el === attackerEl ? 25 : 75, 78);
      el.classList.remove("is-collapsing");
      el.classList.add("is-defeated");
      onDone();
    }, COLLAPSE_DURATION);
  }

  function finishFight(loserEl, opts) {
    var winnerEl = loserEl === attackerEl ? defenderEl : attackerEl;
    winnerEl.classList.add("is-winner");
    var winnerName = opts.attackerWins ? opts.attackerName : opts.defenderName;
    later(function () {
      resultEl.textContent = "🏳️ " + winnerName + " gewinnt!";
      resultEl.classList.remove("hidden");
      closeBtn.classList.remove("hidden");
    }, 300);
  }

  function play(opts) {
    reset();
    attackerNameEl.textContent = opts.attackerName;
    defenderNameEl.textContent = opts.defenderName;
    overlay.classList.remove("hidden");
    doneCallback = opts.onDone || null;

    rafId = requestAnimationFrame(function () {
      rafId = null;
      playSlaps(SLAP_COUNT, function () {
        if (opts.attackerWins) {
          collapseFighter(defenderEl, function () { finishFight(defenderEl, opts); });
        } else {
          performKick(function () {
            collapseFighter(attackerEl, function () { finishFight(attackerEl, opts); });
          });
        }
      });
    });
  }

  closeBtn.addEventListener("click", function () {
    overlay.classList.add("hidden");
    reset();
    if (doneCallback) doneCallback();
  });

  window.PushupBattle = { play: play };
})();
