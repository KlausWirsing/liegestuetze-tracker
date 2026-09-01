(function () {
  "use strict";

  var BRAWL_DURATION = 18000;
  var IMPACT_INTERVAL = 550;
  var IMPACT_EMOJI = ["💥", "✨", "⚡"];

  var overlay = document.getElementById("battle-overlay");
  var arena = document.querySelector(".battle-arena");
  var leftFighter = document.getElementById("battle-left");
  var rightFighter = document.getElementById("battle-right");
  var leftNameEl = document.getElementById("battle-left-name");
  var rightNameEl = document.getElementById("battle-right-name");
  var impactEl = document.getElementById("battle-impact");
  var resultEl = document.getElementById("battle-result");
  var closeBtn = document.getElementById("battle-close");

  var impactTimer = null;
  var resolveTimer = null;
  var doneCallback = null;

  function spawnImpact() {
    var span = document.createElement("span");
    span.className = "impact-star";
    span.textContent = IMPACT_EMOJI[Math.floor(Math.random() * IMPACT_EMOJI.length)];
    span.style.left = (45 + Math.random() * 10) + "%";
    impactEl.appendChild(span);
    setTimeout(function () {
      if (span.parentNode) span.parentNode.removeChild(span);
    }, 450);
  }

  function reset() {
    arena.classList.remove("brawling");
    leftFighter.classList.remove("is-winner", "is-loser");
    rightFighter.classList.remove("is-winner", "is-loser");
    resultEl.classList.add("hidden");
    closeBtn.classList.add("hidden");
    impactEl.innerHTML = "";
    if (impactTimer) { clearInterval(impactTimer); impactTimer = null; }
    if (resolveTimer) { clearTimeout(resolveTimer); resolveTimer = null; }
  }

  function play(opts) {
    reset();
    leftNameEl.textContent = opts.leftName;
    rightNameEl.textContent = opts.rightName;
    overlay.classList.remove("hidden");
    doneCallback = opts.onDone || null;

    // kurze Verzögerung, damit das Overlay sichtbar ist bevor die Animation losgeht
    requestAnimationFrame(function () {
      arena.classList.add("brawling");
      impactTimer = setInterval(spawnImpact, IMPACT_INTERVAL);

      resolveTimer = setTimeout(function () {
        clearInterval(impactTimer);
        impactTimer = null;
        arena.classList.remove("brawling");

        var winnerEl = opts.winnerIsLeft ? leftFighter : rightFighter;
        var loserEl = opts.winnerIsLeft ? rightFighter : leftFighter;
        winnerEl.classList.add("is-winner");
        loserEl.classList.add("is-loser");

        resultEl.textContent = "🏆 " + (opts.winnerIsLeft ? opts.leftName : opts.rightName) + " gewinnt!";
        resultEl.classList.remove("hidden");
        closeBtn.classList.remove("hidden");
      }, BRAWL_DURATION);
    });
  }

  closeBtn.addEventListener("click", function () {
    overlay.classList.add("hidden");
    reset();
    if (doneCallback) doneCallback();
  });

  window.PushupBattle = { play: play };
})();
