const API = "https://pokeapi.co/api/v2/pokemon";
const HIGHSCORE_KEY = "memory_highscore_pokemon";
const LAST_USER_KEY = "memory_last_user";

const board = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const usernameInput = document.getElementById("username");
const pairsSelect = document.getElementById("pairsSelect");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");

let deck = [];
let flipped = [];
let matched = 0;
let pairCount = 8;
let startTime = null;
let timerInterval = null;
let canFlip = true;

usernameInput.value = localStorage.getItem(LAST_USER_KEY) || "";
renderBest();

startBtn.addEventListener("click", startGame);

async function startGame() {
  const username = usernameInput.value.trim();

  if (!username) {
    Swal.fire({
      title: "nombre requerido",
      text: "por favor ingresa tu nombre para comenzar",
      icon: "warning",
      confirmButtonText: "ok",
    });
    return;
  }

  pairCount = parseInt(pairsSelect.value, 10);
  localStorage.setItem(LAST_USER_KEY, username);

  resetUI();

  try {
    const images = await fetchImages(pairCount);
    buildDeck(images);
    renderBoard();
  } catch (err) {
    console.error(err);
    board.innerHTML = `<div style="color:#f88">error al cargar imagenes</div>`;
  }
}

async function fetchImages(n) {
  const urls = [];
  const tried = new Set();
  let attempts = 0;

  while (urls.length < n && attempts < n * 12) {
    attempts++;
    const id = Math.floor(Math.random() * 898) + 1;

    if (tried.has(id)) continue;
    tried.add(id);

    const url = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${id}.png`;

    try {
      await preloadImage(url, 3000);
      if (!urls.includes(url)) urls.push(url);
    } catch (err) {
      console.warn(`imagen ${id} no disponible`);
    }
  }

  if (urls.length < n) {
    throw new Error(`solo se cargaron ${urls.length} de ${n} imagenes`);
  }

  return urls;
}

function preloadImage(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = "";
      reject(new Error("timeout"));
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve();
    };

    img.onerror = (e) => {
      clearTimeout(timer);
      reject(e);
    };

    img.src = url;
  });
}

function buildDeck(images) {
  deck = images.flatMap((url, i) => [
    { id: `${i}-a`, pairId: i, img: url },
    { id: `${i}-b`, pairId: i, img: url },
  ]);
  shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function renderBoard() {
  board.innerHTML = "";
  deck.forEach((card) => board.appendChild(createCard(card)));
}

function createCard(card) {
  const container = makeDiv("div", "card", {
    id: card.id,
    pair: card.pairId,
  });

  const inner = makeDiv("div", "card-inner");
  const front = makeDiv("div", "card-front");
  const back = makeDiv("div", "card-back");
  const img = makeDiv("img");

  img.src = card.img;
  img.alt = "pokemon";

  back.appendChild(img);
  inner.append(front, back);
  container.appendChild(inner);

  container.addEventListener("click", () => onCardClicked(container));
  container.tabIndex = 0;
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onCardClicked(container);
  });

  return container;
}

function onCardClicked(cardEl) {
  if (
    !canFlip ||
    cardEl.classList.contains("is-flipped") ||
    cardEl.classList.contains("matched")
  ) {
    return;
  }

  if (!startTime) {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 50);
  }

  cardEl.classList.add("is-flipped");
  flipped.push(cardEl);

  if (flipped.length === 2) checkMatch();
}

function checkMatch() {
  canFlip = false;
  const [a, b] = flipped;

  if (a.dataset.pair === b.dataset.pair) {
    setTimeout(() => {
      a.classList.add("matched");
      b.classList.add("matched");
      matched++;
      resetFlipped();
      if (matched === pairCount) endGame();
    }, 300);
  } else {
    setTimeout(() => {
      a.classList.remove("is-flipped");
      b.classList.remove("is-flipped");
      resetFlipped();
    }, 900);
  }
}

function updateTimer() {
  if (!startTime) return;
  const ms = Date.now() - startTime;
  timerEl.textContent = formatTime(ms);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(ms) {
  const cent = Math.floor((ms % 1000) / 10);
  const sec = Math.floor((ms / 1000) % 60);
  const min = Math.floor(ms / (1000 * 60));
  return `${pad(min)}:${pad(sec)}.${pad(cent)}`;
}

function endGame() {
  stopTimer();
  const elapsed = Date.now() - startTime;
  const username = usernameInput.value.trim();
  const isRecord = saveHighscore(username, elapsed);
  renderBest();

  const title = isRecord ? "nuevo record" : "partida finalizada";
  const text = `${username} tu tiempo fue ${formatTime(elapsed)}`;

  Swal.fire({ title, text, icon: isRecord ? "success" : "info" });
}

function resetUI() {
  board.innerHTML = '<div class="loading">cargando...</div>';
  stopTimer();
  timerEl.textContent = "00:00.00";
  matched = 0;
  deck = [];
  flipped = [];
  canFlip = true;
  startTime = null;
}

function resetFlipped() {
  flipped = [];
  canFlip = true;
}

function saveHighscore(username, timeMs) {
  const current = loadHighscore();
  if (!current || timeMs < current.timeMs) {
    const record = {
      username,
      timeMs,
      date: new Date().toISOString(),
      pairs: pairCount,
    };
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(record));
    return true;
  }
  return false;
}

function loadHighscore() {
  try {
    return JSON.parse(localStorage.getItem(HIGHSCORE_KEY));
  } catch {
    return null;
  }
}

function renderBest() {
  const best = loadHighscore();
  bestEl.textContent = best
    ? `mejor: ${best.username} — ${formatTime(best.timeMs)}`
    : "mejor: —";
}

function makeDiv(tag, className, dataset = {}, text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(dataset).forEach(([k, v]) => (el.dataset[k] = v));
  if (text) el.textContent = text;
  return el;
}

function pad(n) {
  return String(n).padStart(2, "0");
}
