// Drop Catch, a charity: water prototype

const GAME_SECONDS = 30;
const GOAL = 40;
const CLEAN_VALUE = 2; // litres per clean drop
const DUMP_COST = 5; // litres it costs to clear a contaminated can
const CONTAMINATION_MS = 6000; // how long contamination lasts on its own

// Page elements
const field = document.getElementById("field");
const timeDisplay = document.getElementById("timeLeft");
const scoreDisplay = document.getElementById("score");
const goalDisplay = document.getElementById("goal");
const progressFill = document.getElementById("progressFill");
const statusLine = document.getElementById("status");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const dumpBtn = document.getElementById("dumpBtn");
const resetBtn = document.getElementById("resetBtn");
const canvas = document.getElementById("confetti");

// Game state
let score = 0;
let timeLeft = GAME_SECONDS;
let running = false;
let contaminated = false;

let spawnTimer = null;
let countdownTimer = null;
let contaminationTimer = null;

goalDisplay.textContent = GOAL;

// Keeps the numbers on screen in step with the state
function render() {
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;

  const percent = Math.min((score / GOAL) * 100, 100);
  progressFill.style.width = percent + "%";
  progressFill.style.backgroundColor = contaminated ? "#8a6a44" : "#2e9df7";

  field.classList.toggle("contaminated", contaminated);
  dumpBtn.disabled = !running || !contaminated;
}

function setStatus(text, tone) {
  statusLine.textContent = text;
  statusLine.className = "status" + (tone ? " " + tone : "");
}

// Floating +2 or -1 where the player clicked
function showPop(text, isGood, x, y) {
  const pop = document.createElement("span");
  pop.className = "pop " + (isGood ? "good" : "bad");
  pop.textContent = text;
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  field.appendChild(pop);
  setTimeout(function () {
    pop.remove();
  }, 700);
}

function startContamination() {
  contaminated = true;
  clearTimeout(contaminationTimer);
  contaminationTimer = setTimeout(clearContamination, CONTAMINATION_MS);
  setStatus("Can contaminated. Clean water is worth half until you dump it.", "warn");
  render();
}

function clearContamination() {
  contaminated = false;
  clearTimeout(contaminationTimer);
  render();
}

// Makes one drop and drops it down the field
function spawnDrop() {
  const isBad = Math.random() < 0.3;

  const drop = document.createElement("button");
  drop.type = "button";
  drop.className = "drop" + (isBad ? " bad" : "");
  drop.setAttribute("aria-label", isBad ? "Contaminated drop" : "Clean water drop");

  // Random position and speed so no two rounds feel the same
  drop.style.left = Math.random() * (field.clientWidth - 46) + "px";
  drop.style.animationDuration = (2.4 + Math.random() * 1.6) + "s";

  drop.addEventListener("click", function () {
    if (!running) return;

    const x = parseFloat(drop.style.left);
    const y = drop.getBoundingClientRect().top - field.getBoundingClientRect().top;

    if (isBad) {
      // The challenge mechanic: catching dirt costs you and spoils the can
      score = Math.max(0, score - 1);
      showPop("-1", false, x, y);
      startContamination();
    } else {
      const gained = contaminated ? CLEAN_VALUE / 2 : CLEAN_VALUE;
      score = score + gained;
      showPop("+" + gained, true, x, y);
      if (!contaminated) {
        setStatus("Clean water collected.", "good");
      }
    }

    drop.remove();
    render();
    checkWin();
  });

  // Clean itself up once it has fallen past the bottom
  drop.addEventListener("animationend", function () {
    drop.remove();
  });

  field.appendChild(drop);
}

function checkWin() {
  if (score >= GOAL) {
    endGame(true);
  }
}

function startGame() {
  score = 0;
  timeLeft = GAME_SECONDS;
  running = true;
  clearContamination();

  overlay.classList.add("hidden");
  setStatus("Go. Click the blue drops.", "");
  render();

  spawnTimer = setInterval(spawnDrop, 650);

  countdownTimer = setInterval(function () {
    timeLeft = timeLeft - 1;
    render();
    if (timeLeft <= 0) {
      endGame(false);
    }
  }, 1000);
}

function stopTimers() {
  clearInterval(spawnTimer);
  clearInterval(countdownTimer);
  clearTimeout(contaminationTimer);
}

function clearField() {
  const drops = field.querySelectorAll(".drop, .pop");
  drops.forEach(function (node) {
    node.remove();
  });
}

function endGame(won) {
  running = false;
  stopTimers();
  clearField();

  if (won) {
    overlayTitle.textContent = "Goal reached";
    overlayText.textContent =
      "You delivered " + score + " litres of clean water with " + timeLeft + " seconds to spare.";
    setStatus("You hit the goal.", "good");
    launchConfetti();
  } else {
    overlayTitle.textContent = "Time's up";
    overlayText.textContent =
      "You delivered " + score + " litres out of " + GOAL + ". Dirty water is the difference.";
    setStatus("Round over.", "");
  }

  startBtn.textContent = "Play again";
  overlay.classList.remove("hidden");
  render();
}

function resetGame() {
  running = false;
  stopTimers();
  clearField();
  stopConfetti();

  score = 0;
  timeLeft = GAME_SECONDS;
  contaminated = false;

  overlayTitle.textContent = "Catch the clean water";
  overlayText.textContent =
    "Click the blue drops to collect clean water. Avoid the brown ones: they contaminate your jerry can and halve what you collect until you dump it.";
  startBtn.textContent = "Start";
  overlay.classList.remove("hidden");
  setStatus("Press start when you're ready.", "");
  render();
}

// Confetti, drawn on a canvas so there is nothing to download
let confettiPieces = [];
let confettiFrame = null;
const ctx = canvas.getContext("2d");

function launchConfetti() {
  canvas.width = field.clientWidth;
  canvas.height = field.clientHeight;

  const colours = ["#ffc907", "#2e9df7", "#4fcb53", "#231f20"];
  confettiPieces = [];

  for (let i = 0; i < 120; i++) {
    confettiPieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: 6 + Math.random() * 6,
      speed: 2 + Math.random() * 3,
      drift: -1 + Math.random() * 2,
      colour: colours[Math.floor(Math.random() * colours.length)],
    });
  }

  drawConfetti();
}

function drawConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  confettiPieces.forEach(function (piece) {
    ctx.fillStyle = piece.colour;
    ctx.fillRect(piece.x, piece.y, piece.size, piece.size * 0.6);
    piece.y = piece.y + piece.speed;
    piece.x = piece.x + piece.drift;

    if (piece.y > canvas.height) {
      piece.y = -10;
      piece.x = Math.random() * canvas.width;
    }
  });

  confettiFrame = requestAnimationFrame(drawConfetti);
}

function stopConfetti() {
  cancelAnimationFrame(confettiFrame);
  confettiPieces = [];
  if (canvas.width) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Buttons
startBtn.addEventListener("click", function () {
  stopConfetti();
  startGame();
});

dumpBtn.addEventListener("click", function () {
  if (!running || !contaminated) return;
  score = Math.max(0, score - DUMP_COST);
  clearContamination();
  setStatus("Can dumped. Back to full value.", "");
  render();
});

resetBtn.addEventListener("click", resetGame);

render();