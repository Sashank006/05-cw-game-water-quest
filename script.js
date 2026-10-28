// Drop Catch, a charity: water prototype

const GAME_SECONDS = 30;
const CLEAN_VALUE = 2; // litres per clean drop
const DUMP_COST = 5; // litres it costs to clear a contaminated can
const CONTAMINATION_MS = 6000; // how long contamination lasts on its own

// Difficulty settings. Each one changes the goal, the pace and the risk.
const DIFFICULTIES = {
  easy: {
    goal: 30,
    spawnMs: 820,
    minFall: 3.0,
    maxFall: 4.6,
    badRate: 0.2,
    note: "Easy: 30 litres, slow drops, little contamination.",
  },
  normal: {
    goal: 40,
    spawnMs: 650,
    minFall: 2.4,
    maxFall: 4.0,
    badRate: 0.3,
    note: "Normal: 40 litres, steady drops, some contamination.",
  },
  hard: {
    goal: 55,
    spawnMs: 480,
    minFall: 1.6,
    maxFall: 2.8,
    badRate: 0.42,
    note: "Hard: 55 litres, fast drops, dirty water everywhere.",
  },
};

// LevelUp: milestone messages held in an array and triggered by conditionals
const MILESTONES = [
  { at: 10, text: "10 litres. That is one person's drinking water for a day." },
  { at: 20, text: "20 litres. A family has enough to cook and drink." },
  { at: 30, text: "30 litres. A week of drinking water for one person." },
  { at: 45, text: "45 litres. More than most people carry home in a day." },
];

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
const muteBtn = document.getElementById("muteBtn");
const diffButtons = document.querySelectorAll(".diff-btn");
const diffNote = document.getElementById("difficultyNote");
const canvas = document.getElementById("confetti");

// Game state
let level = "normal";
let settings = DIFFICULTIES[level];
let score = 0;
let timeLeft = GAME_SECONDS;
let running = false;
let contaminated = false;
let milestoneIndex = 0;

let spawnTimer = null;
let countdownTimer = null;
let contaminationTimer = null;

goalDisplay.textContent = settings.goal;

// LevelUp: sound effects, generated in the browser so there are no files to load
let audioCtx = null;
let soundOn = true;

function playTone(frequency, seconds, shape) {
  if (!soundOn) return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = shape || "sine";
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0.16, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + seconds);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + seconds);
  } catch (error) {
    // Some browsers block audio until the user interacts. The game still works.
  }
}

function soundCatch() {
  playTone(880, 0.12, "sine");
}

function soundBad() {
  playTone(150, 0.3, "sawtooth");
}

function soundWin() {
  playTone(660, 0.18, "sine");
  setTimeout(function () { playTone(880, 0.18, "sine"); }, 160);
  setTimeout(function () { playTone(1175, 0.3, "sine"); }, 320);
}

// Keeps the numbers on screen in step with the state
function render() {
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;
  goalDisplay.textContent = settings.goal;

  const percent = Math.min((score / settings.goal) * 100, 100);
  progressFill.style.width = percent + "%";
  progressFill.style.backgroundColor = contaminated ? "#8a6a44" : "#2e9df7";

  field.classList.toggle("contaminated", contaminated);
  dumpBtn.disabled = !running || !contaminated;
}

function setStatus(text, tone) {
  statusLine.textContent = text;
  statusLine.className = "status" + (tone ? " " + tone : "");
}

// Checks the milestone array against the current score
function checkMilestones() {
  while (milestoneIndex < MILESTONES.length && score >= MILESTONES[milestoneIndex].at) {
    const reached = MILESTONES[milestoneIndex];
    if (reached.at < settings.goal) {
      setStatus(reached.text, "good");
    }
    milestoneIndex++;
  }
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
  const isBad = Math.random() < settings.badRate;

  const drop = document.createElement("button");
  drop.type = "button";
  drop.className = "drop" + (isBad ? " bad" : "");
  drop.setAttribute("aria-label", isBad ? "Contaminated drop" : "Clean water drop");

  // Random position and speed so no two rounds feel the same
  const span = settings.maxFall - settings.minFall;
  drop.style.left = Math.random() * (field.clientWidth - 46) + "px";
  drop.style.animationDuration = (settings.minFall + Math.random() * span) + "s";

  drop.addEventListener("click", function () {
    if (!running) return;

    const x = parseFloat(drop.style.left);
    const y = drop.getBoundingClientRect().top - field.getBoundingClientRect().top;

    if (isBad) {
      // The challenge mechanic: catching dirt costs you and spoils the can
      score = Math.max(0, score - 1);
      showPop("-1", false, x, y);
      soundBad();
      startContamination();
    } else {
      const gained = contaminated ? CLEAN_VALUE / 2 : CLEAN_VALUE;
      score = score + gained;
      showPop("+" + gained, true, x, y);
      soundCatch();
      if (!contaminated) {
        setStatus("Clean water collected.", "good");
      }
    }

    drop.remove();
    render();
    checkMilestones();
    checkWin();
  });

  // Clean itself up once it has fallen past the bottom
  drop.addEventListener("animationend", function () {
    drop.remove();
  });

  field.appendChild(drop);
}

function checkWin() {
  if (score >= settings.goal) {
    endGame(true);
  }
}

function startGame() {
  score = 0;
  timeLeft = GAME_SECONDS;
  running = true;
  milestoneIndex = 0;
  clearContamination();

  overlay.classList.add("hidden");
  setStatus("Go. Click the blue drops.", "");
  render();

  spawnTimer = setInterval(spawnDrop, settings.spawnMs);

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
      "You delivered " + score + " litres of clean water on " + level +
      " with " + timeLeft + " seconds to spare.";
    setStatus("You hit the goal.", "good");
    soundWin();
    launchConfetti();
  } else {
    overlayTitle.textContent = "Time's up";
    overlayText.textContent =
      "You delivered " + score + " litres out of " + settings.goal + ". Dirty water is the difference.";
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
  milestoneIndex = 0;

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

  cancelAnimationFrame(confettiFrame);
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

// Difficulty buttons
diffButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    if (running) return;

    level = button.dataset.level;
    settings = DIFFICULTIES[level];

    diffButtons.forEach(function (other) {
      other.classList.remove("active");
    });
    button.classList.add("active");

    diffNote.textContent = settings.note;
    render();
  });
});

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

muteBtn.addEventListener("click", function () {
  soundOn = !soundOn;
  muteBtn.textContent = soundOn ? "Sound on" : "Sound off";
  muteBtn.setAttribute("aria-pressed", soundOn ? "false" : "true");
});

render();