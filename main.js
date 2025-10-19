// constantes de configuracion
const API = "https://pokeapi.co/api/v2/pokemon";
const HIGHSCORE_KEY = "memory_highscore_pokemon";
const LAST_USER_KEY = "memory_last_user";

// referencias al dom
const board = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const usernameInput = document.getElementById("username");
const pairsSelect = document.getElementById("pairsSelect");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");

// variables de estado del juego
let deck = []; // baraja de cartas
let flipped = []; // cartas actualmente volteadas
let matched = 0; // cantidad de pares encontrados
let pairCount = 8; // cantidad de pares elegidos
let startTime = null; // momento en que empieza el juego
let timerInterval = null;
let canFlip = true; // controla si el usuario puede voltear

// cargar nombre guardado y mejor puntaje al iniciar
usernameInput.value = localStorage.getItem(LAST_USER_KEY) || "";
renderBest();

// evento para comenzar el juego
startBtn.addEventListener("click", startGame);

/* ---------------- funciones principales ---------------- */

// inicia una partida nueva
async function startGame() {
  const username = usernameInput.value.trim();

  // validar que el usuario escriba su nombre antes de comenzar
  if (!username) {
    Swal.fire({
      title: "nombre requerido",
      text: "por favor ingresa tu nombre para comenzar",
      icon: "warning",
      confirmButtonText: "ok",
    });
    return; // corta la funcion y no arranca el juego
  }

  pairCount = parseInt(pairsSelect.value, 10);
  localStorage.setItem(LAST_USER_KEY, username);

  // reinicia ui y variables
  resetUI();

  try {
    // obtiene imagenes, arma el tablero
    const images = await fetchImages(pairCount);
    buildDeck(images);
    renderBoard();
  } catch (err) {
    console.error(err);
    board.innerHTML = `<div style="color:#f88">error al cargar imagenes</div>`;
  }
}

// obtiene imagenes desde la api
async function fetchImages(n) {
  const urls = [];

  while (urls.length < n) {
    const id = Math.floor(Math.random() * 898) + 1; // hay 898 pokémon oficiales
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) throw new Error("error en api");
      const data = await res.json();

      const img = data.sprites.other["official-artwork"].front_default;

      // evitar pokémon que no tengan imagen oficial (algunos especiales)
      if (img && !urls.includes(img)) {
        urls.push(img);
      }
    } catch (err) {
      console.error("Error cargando Pokémon:", err);
    }
  }

  return urls;
}

// arma la baraja duplicando las imagenes y mezclando
function buildDeck(images) {
  deck = images.flatMap((url, i) => [
    { id: `${i}-a`, pairId: i, img: url },
    { id: `${i}-b`, pairId: i, img: url },
  ]);
  shuffle(deck);
}

// mezcla un array con fisher yates
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// dibuja las cartas en el tablero
function renderBoard() {
  board.innerHTML = "";
  deck.forEach((card) => board.appendChild(createCard(card)));
}

// crea un elemento de carta con front y back
function createCard(card) {
  const container = makeDiv("div", "card", {
    id: card.id,
    pair: card.pairId,
  });

  const inner = makeDiv("div", "card-inner");
  const front = makeDiv("div", "card-front", {});
  const back = makeDiv("div", "card-back");
  const img = makeDiv("img");
  img.src = card.img;
  img.alt = "imagen";

  back.appendChild(img);
  inner.append(front, back);
  container.appendChild(inner);

  // listeners de click y teclado
  container.addEventListener("click", () => onCardClicked(container));
  container.tabIndex = 0;
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onCardClicked(container);
  });

  return container;
}

// cuando el usuario voltea una carta
function onCardClicked(cardEl) {
  if (!canFlip) return;
  if (
    cardEl.classList.contains("is-flipped") ||
    cardEl.classList.contains("matched")
  )
    return;

  // arranca cronometro en el primer click
  if (!startTime) {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 50);
  }

  // voltea carta
  cardEl.classList.add("is-flipped");
  flipped.push(cardEl);

  // si hay dos cartas volteadas, comprobar match
  if (flipped.length === 2) checkMatch();
}

// comprueba si las cartas matchean
function checkMatch() {
  canFlip = false;
  const [a, b] = flipped;

  if (a.dataset.pair === b.dataset.pair) {
    setTimeout(() => {
      [a, b].forEach((el) => el.classList.add("matched"));
      matched++;
      resetFlipped();
      if (matched === pairCount) endGame();
    }, 300);
  } else {
    setTimeout(() => {
      [a, b].forEach((el) => el.classList.remove("is-flipped"));
      resetFlipped();
    }, 900);
  }
}

// actualiza cronometro en pantalla
function updateTimer() {
  if (!startTime) return;
  const ms = Date.now() - startTime;
  timerEl.textContent = formatTime(ms);
}

// detiene cronometro
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// formatea tiempo en mm:ss.cc
function formatTime(ms) {
  const cent = Math.floor((ms % 1000) / 10);
  const sec = Math.floor((ms / 1000) % 60);
  const min = Math.floor(ms / (1000 * 60));
  return `${pad(min)}:${pad(sec)}.${pad(cent)}`;
}

// termina el juego y guarda puntaje
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

/* ---------------- utilidades ---------------- */

// reinicia interfaz y variables del juego
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

// reinicia array de cartas volteadas y habilita clicks
function resetFlipped() {
  flipped = [];
  canFlip = true;
}

// guarda record en localstorage si es mejor tiempo
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

// carga record desde localstorage
function loadHighscore() {
  try {
    return JSON.parse(localStorage.getItem(HIGHSCORE_KEY));
  } catch {
    return null;
  }
}

// muestra mejor puntaje en pantalla
function renderBest() {
  const best = loadHighscore();
  bestEl.textContent = best
    ? `la puntuacion mas alta la tiene: ${best.username} —con: ${formatTime(
        best.timeMs
      )}`
    : "mejor: —";
}

// helper para crear elementos html facilmente
function makeDiv(tag, className, dataset = {}, text = "") {
  const eltag = document.createElement(tag);
  if (className) eltag.className = className;
  Object.entries(dataset).forEach(([k, v]) => (eltag.dataset[k] = v));
  if (text) eltag.textContent = text;
  return eltag;
}

// helper para rellenar con ceros
function pad(n) {
  return String(n).padStart(2, "0");
}
