/* ============================================
   🔺 DEMON'S TRIANGLE — логика
   ============================================ */

const SVG_NS = "http://www.w3.org/2000/svg";

// ============================================
// ГЕОМЕТРИЯ
// ============================================
const A = { x: 5,  y: 40 };
const B = { x: 95, y: 40 };
const C = { x: 50, y: 117.94 };

const M_AB = midpoint(A, B);
const M_AC = midpoint(A, C);
const M_BC = midpoint(B, C);

const K1 = {
  base: [A, M_AB],
  apex: { x: (A.x + M_AB.x) / 2, y: A.y - 45 * Math.sqrt(3) / 2 },
};
const K2 = {
  base: [M_AB, B],
  apex: { x: (M_AB.x + B.x) / 2, y: B.y - 45 * Math.sqrt(3) / 2 },
};

const L_ROMB = {
  vertices: [
    A,
    M_AC,
    { x: 5, y: 117.94 },
    { x: -17.5, y: 78.97 },
  ],
};

const R_ROMB = {
  vertices: [
    B,
    { x: 117.5, y: 78.97 },
    { x: 95, y: 117.94 },
    M_BC,
  ],
};

// ============================================
// ЗВУК — Web Audio API
// ============================================
const Sound = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(master);
  }

  function resume() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone({
    freq = 440,
    type = "sine",
    duration = 0.15,
    volume = 1,
    slideTo = null,
    delay = 0,
    attack = 0.005,
    dest = null,
  } = {}) {
    if (muted) return;
    init(); resume();
    if (!ctx) return;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise({ duration = 0.15, volume = 0.4, highpass = 1200, delay = 0 } = {}) {
    if (muted) return;
    init(); resume();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  function chord(freqs, opts = {}) {
    freqs.forEach((f, i) => {
      tone({ freq: f, delay: (opts.stagger || 0) * i, ...opts });
    });
  }

  function musicNote(freq, delay, dur, type = "triangle", vol = 0.5) {
    if (muted) return;
    init(); resume();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function musicBar() {
    if (muted || !ctx) return;
    const step = 0.27;

    const bassNotes = [
      [110, 4],
      [87.31, 4],
      [130.81, 4],
      [98.00, 4],
    ];
    let t = 0;
    bassNotes.forEach(([f, n]) => {
      for (let i = 0; i < n; i++) {
        musicNote(f, t, 0.5, "sine", 0.4);
        t += step * 2;
      }
    });

    const arps = [
      [220, 261.63, 329.63, 440],
      [174.61, 220, 261.63, 349.23],
      [261.63, 329.63, 392, 523.25],
      [196, 246.94, 293.66, 392],
    ];
    let at = 0;
    arps.forEach((notes) => {
      for (let i = 0; i < 8; i++) {
        const n = notes[i % notes.length];
        musicNote(n, at, 0.22, "triangle", 0.35);
        at += step;
      }
    });
  }

  function musicStart() {
    init(); resume();
    if (musicTimer) return;
    musicBar();
    musicTimer = setInterval(() => {
      if (!muted) musicBar();
    }, 4320);
  }

  function musicStop() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  const api = {
    unlock() { init(); resume(); },
    musicStart,
    musicStop,
    toggleMute() {
      muted = !muted;
      if (muted) musicStop();
      else musicStart();
      return muted;
    },
    isMuted() { return muted; },

    spinLeft() {
      tone({ freq: 180, type: "sawtooth", duration: 0.3, volume: 0.4, slideTo: 720 });
      tone({ freq: 240, type: "triangle", duration: 0.2, volume: 0.25, delay: 0.05, slideTo: 600 });
    },
    spinRight() {
      tone({ freq: 200, type: "sawtooth", duration: 0.3, volume: 0.4, slideTo: 800 });
      tone({ freq: 260, type: "triangle", duration: 0.2, volume: 0.25, delay: 0.05, slideTo: 660 });
    },
    rotate() {
      tone({ freq: 600, type: "square", duration: 0.08, volume: 0.25, slideTo: 900 });
      noise({ duration: 0.05, volume: 0.15, highpass: 2000 });
    },
    centerWin() {
      chord([523.25, 659.25, 783.99, 1046.50], {
        type: "triangle",
        duration: 0.2,
        volume: 0.6,
        stagger: 0.07,
      });
    },
    centerEmpty() {
      tone({ freq: 180, type: "sine", duration: 0.15, volume: 0.4, slideTo: 120 });
      noise({ duration: 0.08, volume: 0.15, highpass: 600 });
    },
    win() {
      chord([523.25, 659.25, 783.99, 1046.50, 1318.51], {
        type: "triangle",
        duration: 0.25,
        volume: 0.6,
        stagger: 0.08,
      });
      for (let i = 0; i < 5; i++) {
        tone({
          freq: 2000 + Math.random() * 2000,
          type: "sine",
          duration: 0.1,
          volume: 0.2,
          delay: 0.4 + i * 0.05,
        });
      }
    },
    lose() {
      tone({ freq: 220, type: "sawtooth", duration: 0.35, volume: 0.5, slideTo: 80 });
      tone({ freq: 110, type: "sine",     duration: 0.45, volume: 0.4, slideTo: 55, delay: 0.12 });
    },
  };

  return api;
})();

// ---- Мьют-кнопка ----
(function setupMuteButton() {
  const btn = document.createElement("button");
  btn.id = "muteBtn";
  btn.textContent = "🔊";
  btn.title = "Звук вкл/выкл";
  Object.assign(btn.style, {
    position: "fixed",
    top: "14px",
    right: "14px",
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "2px solid #ffcc00",
    background: "rgba(0,0,0,0.55)",
    color: "#ffcc00",
    fontSize: "20px",
    cursor: "pointer",
    zIndex: "100",
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  btn.addEventListener("click", () => {
    Sound.unlock();
    const m = Sound.toggleMute();
    btn.textContent = m ? "🔇" : "🔊";
  });
  document.body.appendChild(btn);
})();

// ---- Разблокировка аудио + запуск музыки ----
["pointerdown", "keydown", "touchstart"].forEach(evt => {
  window.addEventListener(evt, () => {
    Sound.unlock();
    Sound.musicStart();
  }, { once: true });
});

// ============================================
// СОСТОЯНИЕ ИГРЫ
// ============================================
let deposit = 100;
const START_DEPOSIT = 100;
const MIN_BET = 10;
let currentBet = 10;
let centerClickUsed = false;
let isFirstSpin = true;

// ============================================
// УНИКАЛЬНЫЕ ОРБИТЫ (76)
// ============================================
function buildUniqueOrbits() {
  const seen = new Set();
  const orbits = [];

  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      for (let c = 1; c <= 6; c++) {
        const rotations = [
          [a, b, c],
          [b, c, a],
          [c, a, b],
        ];
        let canon = rotations[0];
        for (let k = 1; k < rotations.length; k++) {
          const r = rotations[k];
          if (
            r[0] < canon[0] ||
            (r[0] === canon[0] && r[1] < canon[1]) ||
            (r[0] === canon[0] && r[1] === canon[1] && r[2] < canon[2])
          ) {
            canon = r;
          }
        }
        const key = canon.join(",");
        if (!seen.has(key)) {
          seen.add(key);
          orbits.push([...canon]);
        }
      }
    }
  }

  return orbits;
}

const UNIQUE_ORBITS = buildUniqueOrbits();

function randomUniqueOrbits(n) {
  const pool = UNIQUE_ORBITS.map(o => [...o]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ============================================
// УТИЛИТЫ
// ============================================
function midpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function incenter(p1, p2, p3) {
  const a = distance(p2, p3);
  const b = distance(p1, p3);
  const c = distance(p1, p2);
  const sum = a + b + c;
  return {
    x: (a * p1.x + b * p2.x + c * p3.x) / sum,
    y: (a * p1.y + b * p2.y + c * p3.y) / sum,
  };
}

function centroid(p1, p2, p3) {
  return {
    x: (p1.x + p2.x + p3.x) / 3,
    y: (p1.y + p2.y + p3.y) / 3,
  };
}

function splitTriangleIntoThree(v1, v2, v3) {
  const I = incenter(v1, v2, v3);
  return [
    { vertices: [v1, I, v2], center: centroid(v1, I, v2) },
    { vertices: [v2, I, v3], center: centroid(v2, I, v3) },
    { vertices: [v3, I, v1], center: centroid(v3, I, v1) },
  ];
}

function randomDigit() {
  return Math.floor(Math.random() * 6) + 1;
}

function sortPartsClockwise(parts, I) {
  return [...parts].sort((p1, p2) => {
    const a1 = Math.atan2(p1.center.y - I.y, p1.center.x - I.x);
    const a2 = Math.atan2(p2.center.y - I.y, p2.center.x - I.x);
    return a1 - a2;
  });
}

// ============================================
// SVG-ХЕЛПЕРЫ
// ============================================
function createSVG(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function polygonPoints(vertices) {
  return vertices.map(v => `${v.x},${v.y}`).join(" ");
}

function drawPolygon(parent, vertices, className, extraAttrs = {}) {
  const poly = createSVG("polygon", {
    points: polygonPoints(vertices),
    class: className,
    ...extraAttrs,
  });
  parent.appendChild(poly);
  return poly;
}

function drawLine(parent, p1, p2, className) {
  const line = createSVG("line", {
    x1: p1.x, y1: p1.y,
    x2: p2.x, y2: p2.y,
    class: className,
  });
  parent.appendChild(line);
  return line;
}

function drawText(parent, x, y, text, className) {
  const t = createSVG("text", { x, y, class: className });
  t.textContent = text;
  parent.appendChild(t);
  return t;
}

function drawDots(parent, cx, cy, value, className = "dot", dotRadius = 0.7, spacing = 1.5) {
  const s = spacing;

  const layouts = {
    1: [[0, 0]],
    2: [[-s, -s], [s, s]],
    3: [[-s, -s], [0, 0], [s, s]],
    4: [[-s, -s], [s, -s], [-s, s], [s, s]],
    5: [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]],
    6: [[-s, -s], [-s, 0], [-s, s], [s, -s], [s, 0], [s, s]],
  };

  const positions = layouts[value] || [];

  positions.forEach(([dx, dy]) => {
    const dot = createSVG("circle", {
      cx: cx + dx,
      cy: cy + dy,
      r: dotRadius,
      class: className,
    });
    parent.appendChild(dot);
  });
}

// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================
const svg = document.getElementById("field");
const infoEl = document.getElementById("info");

let rotationMode = 1;
let spinning = false;
let gameOver = false;

const triangles = {
  top: null,
  left: null,
  right: null,
  center: null,
};

let k1Poly = null;
let k2Poly = null;
let centerPoly = null;

const centerDotEls = {
  top: null,
  left: null,
  right: null,
};

let betFillRect = null;
let betSliderLine = null;
let betSliderMarker = null;
let betValueText = null;
let betTicksGroup = null;
let depositRedRect = null;
let depositValueText = null;
let depositTicksGroup = null;

const L_ROMB_CENTER_X = 5;
const R_ROMB_CENTER_X = 95;
const L_ROMB_TOP_Y = 40;
const L_ROMB_BOTTOM_Y = 117.94;
const R_ROMB_TOP_Y = 40;
const R_ROMB_BOTTOM_Y = 117.94;

// ============================================
// АНИМИРОВАННЫЙ СЧЁТЧИК ДЕПОЗИТА
// ============================================
let displayedDeposit = deposit;
let depositAnimRaf = null;
const DEPOSIT_TICK_MS = 400;

function animateDepositTo(target) {
  if (depositAnimRaf) cancelAnimationFrame(depositAnimRaf);
  const start = displayedDeposit;
  const diff = target - start;
  const t0 = performance.now();

  function step(now) {
    const k = Math.min(1, (now - t0) / DEPOSIT_TICK_MS);
    const e = 1 - Math.pow(1 - k, 3);
    displayedDeposit = Math.round(start + diff * e);
    if (depositValueText) {
      depositValueText.textContent = String(displayedDeposit);
    }
    if (k < 1) {
      depositAnimRaf = requestAnimationFrame(step);
    } else {
      displayedDeposit = target;
      if (depositValueText) {
        depositValueText.textContent = String(target);
      }
      depositAnimRaf = null;
    }
  }
  depositAnimRaf = requestAnimationFrame(step);
}

// ============================================
// СООБЩЕНИЯ
// ============================================
function showResult(text, type = "info") {
  infoEl.textContent = text;
  infoEl.className = "info";
  if (type === "win") infoEl.classList.add("win");
  if (type === "lose") infoEl.classList.add("lose");
}

// ============================================
// ПУЛЬСАЦИЯ ЦЕНТРАЛЬНОГО ТРЕУГОЛЬНИКА
// ============================================
function startCenterPulse() {
  if (centerPoly) centerPoly.classList.add("pulse");
}

function stopCenterPulse() {
  if (centerPoly) centerPoly.classList.remove("pulse");
}

// ============================================
// ПОДСВЕТКА ЦЕНТРАЛЬНЫХ СЕГМЕНТОВ
// ============================================
function highlightCenterDots() {
  Object.values(centerDotEls).forEach(group => {
    if (!group) return;
    group.querySelectorAll(".center-dot").forEach(dot => {
      dot.classList.add("highlight");
    });
  });
}

function clearCenterHighlight() {
  Object.values(centerDotEls).forEach(group => {
    if (!group) return;
    group.querySelectorAll(".center-dot").forEach(dot => {
      dot.classList.remove("highlight");
    });
  });
}

// ============================================
// ИСКРЫ
// ============================================
function playSparks(from, color = "#ffea00", count = 14) {
  const group = createSVG("g", { class: "spark" });
  svg.appendChild(group);

  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 1.2 + Math.random() * 1.8;
    const c = createSVG("circle", {
      cx: from.x,
      cy: from.y,
      r: 0.8 + Math.random() * 0.6,
      fill: color,
      opacity: 1,
    });
    group.appendChild(c);
    particles.push({
      el: c,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 15,
      maxLife: 45,
    });
  }

  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    let alive = false;

    particles.forEach(p => {
      if (p.life <= 0) return;
      p.life--;
      p.el.setAttribute("cx", parseFloat(p.el.getAttribute("cx")) + p.vx);
      p.el.setAttribute("cy", parseFloat(p.el.getAttribute("cy")) + p.vy);
      p.vy += 0.04;
      const op = Math.max(0, p.life / p.maxLife);
      p.el.setAttribute("opacity", op);
      if (p.life > 0) alive = true;
    });

    if (alive) {
      requestAnimationFrame(frame);
    } else {
      group.remove();
    }
  }

  requestAnimationFrame(frame);
}

// ============================================
// ЭФФЕКТ «СТРУЙКА»
// ============================================
function playStream(from, to, options = {}) {
  const duration = options.duration || 600;
  const dotCount = options.dotCount || 4;

  const group = createSVG("g", { class: "stream-group" });
  svg.appendChild(group);

  const gradId = "streamGrad_" + Math.random().toString(36).slice(2);
  const defs = svg.querySelector("defs");
  if (defs) {
    const grad = createSVG("linearGradient", {
      id: gradId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      gradientUnits: "userSpaceOnUse",
    });
    grad.appendChild(createSVG("stop", { offset: "0%",   "stop-color": "#d40000", "stop-opacity": "0" }));
    grad.appendChild(createSVG("stop", { offset: "50%",  "stop-color": "#ff2222", "stop-opacity": "1" }));
    grad.appendChild(createSVG("stop", { offset: "100%", "stop-color": "#d40000", "stop-opacity": "0" }));
    defs.appendChild(grad);
  }

  const line = createSVG("line", {
    x1: from.x, y1: from.y,
    x2: to.x, y2: to.y,
    stroke: `url(#${gradId})`,
    "stroke-width": 1.6,
    "stroke-linecap": "round",
    opacity: 0,
  });
  group.appendChild(line);

  const len = distance(from, to);
  line.setAttribute("stroke-dasharray", `${len}`);
  line.setAttribute("stroke-dashoffset", `${len}`);

  const dots = [];
  for (let i = 0; i < dotCount; i++) {
    const c = createSVG("circle", {
      cx: from.x, cy: from.y, r: 0.9,
      fill: "#ff2222",
      stroke: "#7a0000",
      "stroke-width": 0.15,
      opacity: 0,
    });
    group.appendChild(c);
    dots.push(c);
  }

  const startTime = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - startTime) / duration);

    line.setAttribute("stroke-dashoffset", `${len * (1 - t)}`);
    if (t < 0.05) {
      line.setAttribute("opacity", `${t / 0.05}`);
    } else if (t > 0.85) {
      line.setAttribute("opacity", `${1 - (t - 0.85) / 0.15}`);
    } else {
      line.setAttribute("opacity", "1");
    }

    dots.forEach((c, i) => {
      const delay = i / (dotCount + 1);
      const lt = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
      if (lt <= 0) {
        c.setAttribute("opacity", "0");
        return;
      }
      const x = from.x + (to.x - from.x) * lt;
      const y = from.y + (to.y - from.y) * lt;
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      const op = lt < 0.85 ? 1 : 1 - (lt - 0.85) / 0.15;
      c.setAttribute("opacity", op);
    });

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      group.remove();
      const g = svg.querySelector(`#${gradId}`);
      if (g) g.remove();
    }
  }

  requestAnimationFrame(frame);
}

function playLoseStream() {
  const from = R_ROMB.vertices[2];
  const to = midpoint(M_AB, M_AC);
  playStream(from, to, { duration: 600, dotCount: 4 });
}

function playWinStream() {
  const from = M_AB;
  const to = R_ROMB.vertices[0];
  playStream(from, to, { duration: 600, dotCount: 4 });
}

// ============================================
// ПОСТРОЕНИЕ
// ============================================
function defineGradients() {
  const defs = createSVG("defs");
  svg.appendChild(defs);

  const gradSpin = createSVG("linearGradient", {
    id: "spinGradient",
    x1: "0%", y1: "0%",
    x2: "0%", y2: "100%",
  });
  gradSpin.appendChild(createSVG("stop", { offset: "0%",  "stop-color": "#ffe066" }));
  gradSpin.appendChild(createSVG("stop", { offset: "55%", "stop-color": "#ffaa00" }));
  gradSpin.appendChild(createSVG("stop", { offset: "100%", "stop-color": "#b37700" }));
  defs.appendChild(gradSpin);

  const gradTemp = createSVG("linearGradient", {
    id: "tempGradient",
    x1: "0%", y1: "0%",
    x2: "0%", y2: "100%",
  });
  gradTemp.appendChild(createSVG("stop", { offset: "0%",   "stop-color": "#ff2200" }));
  gradTemp.appendChild(createSVG("stop", { offset: "25%",  "stop-color": "#ff8800" }));
  gradTemp.appendChild(createSVG("stop", { offset: "50%",  "stop-color": "#ffcc00" }));
  gradTemp.appendChild(createSVG("stop", { offset: "70%",  "stop-color": "#66cc00" }));
  gradTemp.appendChild(createSVG("stop", { offset: "90%",  "stop-color": "#00aaff" }));
  gradTemp.appendChild(createSVG("stop", { offset: "100%", "stop-color": "#0044cc" }));
  defs.appendChild(gradTemp);

  const clipL = createSVG("clipPath", { id: "clipLeftRomb" });
  clipL.appendChild(createSVG("polygon", {
    points: polygonPoints(L_ROMB.vertices),
  }));
  defs.appendChild(clipL);

  const clipR = createSVG("clipPath", { id: "clipRightRomb" });
  clipR.appendChild(createSVG("polygon", {
    points: polygonPoints(R_ROMB.vertices),
  }));
  defs.appendChild(clipR);
}

function createTriangleData(vertices, parts) {
  const I = incenter(...vertices);
  const partsCW = sortPartsClockwise(parts, I);
  return {
    vertices,
    incenter: I,
    parts: partsCW,
    digits: partsCW.map(() => randomDigit()),
    partGroups: [null, null, null],
    groupEl: null,
    onCenterIndex: -1,
  };
}

function findCenterSideIndex(triangle, sharedSideEnd1, sharedSideEnd2) {
  return triangle.parts.findIndex(p =>
    p.vertices.includes(sharedSideEnd1) && p.vertices.includes(sharedSideEnd2)
  );
}

// ============================================
// ЛЕВЫЙ РОМБ (ставка)
// ============================================
function drawLeftRomb() {
  const centerX = L_ROMB_CENTER_X;

  betFillRect = createSVG("rect", {
    x: -20,
    y: L_ROMB_TOP_Y,
    width: 50,
    height: L_ROMB_BOTTOM_Y - L_ROMB_TOP_Y,
    fill: "url(#tempGradient)",
    "clip-path": "url(#clipLeftRomb)",
  });
  svg.appendChild(betFillRect);

  drawPolygon(svg, L_ROMB.vertices, "side-romb left-outline");

  betTicksGroup = createSVG("g", { class: "bet-ticks" });
  svg.appendChild(betTicksGroup);
  drawBetTicks();

  betSliderLine = createSVG("line", {
    x1: centerX - 7, y1: 0,
    x2: centerX + 7, y2: 0,
    class: "bet-slider-line",
  });
  svg.appendChild(betSliderLine);

  betSliderMarker = createSVG("polygon", {
    points: "", class: "bet-slider-marker",
  });
  svg.appendChild(betSliderMarker);

  betValueText = createSVG("text", {
    x: centerX, y: 0,
    class: "romb-text romb-value",
  });
  betValueText.textContent = String(currentBet);
  svg.appendChild(betValueText);

  const label = createSVG("text", {
    x: centerX, y: L_ROMB_TOP_Y + 10,
    class: "romb-text romb-label",
  });
  label.textContent = "СТАВКА";
  svg.appendChild(label);

  const hitArea = createSVG("polygon", {
    points: polygonPoints(L_ROMB.vertices),
    class: "bet-hit-area",
  });
  svg.appendChild(hitArea);

  hitArea.addEventListener("mousedown", onBetSliderMouseDown);
  hitArea.addEventListener("touchstart", onBetSliderTouchStart, { passive: false });
}

function drawBetTicks() {
  if (!betTicksGroup) return;
  betTicksGroup.innerHTML = "";

  const centerX = L_ROMB_CENTER_X;
  const minY = L_ROMB_TOP_Y;
  const maxY = L_ROMB_BOTTOM_Y;
  const height = maxY - minY;
  const maxBet = Math.max(deposit, MIN_BET);

  for (let bet = 10; bet <= maxBet; bet += 10) {
    const ratio = (bet - MIN_BET) / Math.max(1, (maxBet - MIN_BET));
    const y = maxY - ratio * height;

    betTicksGroup.appendChild(createSVG("line", {
      x1: centerX - 3, y1: y,
      x2: centerX + 3, y2: y,
      class: "tick",
    }));
  }
}

function getBetY(bet) {
  const maxBet = Math.max(deposit, MIN_BET);
  const minY = L_ROMB_TOP_Y;
  const maxY = L_ROMB_BOTTOM_Y;
  const height = maxY - minY;
  const clampedBet = Math.max(MIN_BET, Math.min(bet, maxBet));
  const ratio = (clampedBet - MIN_BET) / Math.max(1, (maxBet - MIN_BET));
  return maxY - ratio * height;
}

function getYToBet(y) {
  const maxBet = Math.max(deposit, MIN_BET);
  const minY = L_ROMB_TOP_Y;
  const maxY = L_ROMB_BOTTOM_Y;
  const height = maxY - minY;
  const clampedY = Math.max(minY, Math.min(y, maxY));
  const ratio = (maxY - clampedY) / height;
  const bet = MIN_BET + ratio * (maxBet - MIN_BET);
  return Math.max(MIN_BET, Math.round(bet / 10) * 10);
}

function updateBetSlider() {
  if (!betSliderLine) return;

  const centerX = L_ROMB_CENTER_X;
  const y = getBetY(currentBet);

  betSliderLine.setAttribute("y1", y);
  betSliderLine.setAttribute("y2", y);

  const markerX = centerX + 7;
  betSliderMarker.setAttribute("points",
    `${markerX},${y - 1.2} ${markerX + 2.5},${y} ${markerX},${y + 1.2}`
  );

  betValueText.setAttribute("y", y - 3);
  betValueText.textContent = String(currentBet);
}

// ============================================
// ПРАВЫЙ РОМБ (депозит)
// ============================================
function drawRightRomb() {
  const centerX = R_ROMB_CENTER_X;
  const centerY = (R_ROMB_TOP_Y + R_ROMB_BOTTOM_Y) / 2;

  const greenRect = createSVG("rect", {
    x: 70, y: R_ROMB_TOP_Y,
    width: 50,
    height: R_ROMB_BOTTOM_Y - R_ROMB_TOP_Y,
    fill: "#4a6b1a",
    "clip-path": "url(#clipRightRomb)",
  });
  svg.appendChild(greenRect);

  depositRedRect = createSVG("rect", {
    x: 70,
    y: R_ROMB_BOTTOM_Y,
    width: 50,
    height: 0,
    fill: "#d40000",
    "clip-path": "url(#clipRightRomb)",
  });
  svg.appendChild(depositRedRect);

  drawPolygon(svg, R_ROMB.vertices, "side-romb right-outline");

  depositTicksGroup = createSVG("g", { class: "deposit-ticks" });
  svg.appendChild(depositTicksGroup);
  drawDepositTicks();

  depositValueText = createSVG("text", {
    x: centerX, y: centerY,
    class: "romb-text romb-value",
  });
  depositValueText.textContent = String(Math.round(deposit));
  svg.appendChild(depositValueText);

  const label = createSVG("text", {
    x: centerX, y: R_ROMB_TOP_Y + 10,
    class: "romb-text romb-label",
  });
  label.textContent = "ДЕПОЗИТ";
  svg.appendChild(label);

  displayedDeposit = deposit;
}

function drawDepositTicks() {
  if (!depositTicksGroup) return;
  depositTicksGroup.innerHTML = "";

  const centerX = R_ROMB_CENTER_X;
  const minY = R_ROMB_TOP_Y;
  const maxY = R_ROMB_BOTTOM_Y;
  const height = maxY - minY;

  for (let dep = 10; dep <= START_DEPOSIT; dep += 10) {
    const ratio = dep / START_DEPOSIT;
    const y = maxY - ratio * height;

    depositTicksGroup.appendChild(createSVG("line", {
      x1: centerX - 3, y1: y,
      x2: centerX + 3, y2: y,
      class: "tick",
    }));
  }
}

function updateDepositScale() {
  if (!depositRedRect) return;

  const topY = R_ROMB_TOP_Y;
  const bottomY = R_ROMB_BOTTOM_Y;
  const fullHeight = bottomY - topY;

  const ratio = Math.min(1, deposit / START_DEPOSIT);
  const redHeight = ratio * fullHeight;

  const redY = bottomY - redHeight;

  depositRedRect.setAttribute("y", redY);
  depositRedRect.setAttribute("height", redHeight);

  // Плавная анимация счётчика
  animateDepositTo(deposit);
}

// ============================================
// ПОСТРОЕНИЕ ПОЛЯ
// ============================================
function buildField() {
  svg.innerHTML = "";
  defineGradients();

  drawLeftRomb();
  drawRightRomb();

  k1Poly = drawPolygon(svg, [K1.base[0], K1.base[1], K1.apex], "spin-triangle");
  k2Poly = drawPolygon(svg, [K2.base[0], K2.base[1], K2.apex], "spin-triangle");

  const k1Center = centroid(K1.base[0], K1.base[1], K1.apex);
  const k2Center = centroid(K2.base[0], K2.base[1], K2.apex);
  drawText(svg, k1Center.x, k1Center.y + 2, "SPIN", "spin-label");
  drawText(svg, k2Center.x, k2Center.y + 2, "SPIN", "spin-label");

  k1Poly.addEventListener("click", () => handleSpin(-1));
  k2Poly.addEventListener("click", () => handleSpin(1));

  drawPolygon(svg, [A, B, C], "big-triangle");

  const topV    = [A, M_AB, M_AC];
  const leftV   = [M_AC, M_BC, C];
  const rightV  = [M_AB, B, M_BC];
  const centerV = [M_AB, M_AC, M_BC];

  const topPoly   = drawPolygon(svg, topV,    "sub-triangle");
  const leftPoly  = drawPolygon(svg, leftV,   "sub-triangle");
  const rightPoly = drawPolygon(svg, rightV,  "sub-triangle");
  centerPoly      = drawPolygon(svg, centerV, "sub-triangle center");

  topPoly.addEventListener("click", () => rotateTriangle("top"));
  leftPoly.addEventListener("click", () => rotateTriangle("left"));
  rightPoly.addEventListener("click", () => rotateTriangle("right"));
  centerPoly.addEventListener("click", onCenterClick);

  const topParts    = splitTriangleIntoThree(...topV);
  const leftParts   = splitTriangleIntoThree(...leftV);
  const rightParts  = splitTriangleIntoThree(...rightV);
  const centerParts = splitTriangleIntoThree(...centerV);

  for (const v of [topV, leftV, rightV, centerV]) {
    const I = incenter(...v);
    drawLine(svg, I, v[0], "bisector");
    drawLine(svg, I, v[1], "bisector");
    drawLine(svg, I, v[2], "bisector");
  }

  triangles.top    = createTriangleData(topV, topParts);
  triangles.left   = createTriangleData(leftV, leftParts);
  triangles.right  = createTriangleData(rightV, rightParts);
  triangles.center = createTriangleData(centerV, centerParts);

  triangles.top.onCenterIndex   = findCenterSideIndex(triangles.top,   M_AB, M_AC);
  triangles.left.onCenterIndex  = findCenterSideIndex(triangles.left,  M_AC, M_BC);
  triangles.right.onCenterIndex = findCenterSideIndex(triangles.right, M_AB, M_BC);

  const centerPartTopIdx   = findCenterSideIndex(triangles.center, M_AB, M_AC);
  const centerPartLeftIdx  = findCenterSideIndex(triangles.center, M_AC, M_BC);
  const centerPartRightIdx = findCenterSideIndex(triangles.center, M_AB, M_BC);

  triangles.center.centerIdxFor = {
    top:   centerPartTopIdx,
    left:  centerPartLeftIdx,
    right: centerPartRightIdx,
  };

  applyStartSplash();

  drawDotsForTriangle(triangles.top);
  drawDotsForTriangle(triangles.left);
  drawDotsForTriangle(triangles.right);
  drawCenterDots();

  updateSpinButtons();
  updateBetSlider();
  updateDepositScale();

  showResult("Нажмите SPIN для генерации", "info");
}

function applyStartSplash() {
  function pickPart(triangle, dir) {
    const I = triangle.incenter;
    let best = -1;
    let bestScore = Infinity;

    triangle.parts.forEach((part, idx) => {
      const dx = part.center.x - I.x;
      const dy = part.center.y - I.y;

      let score = Infinity;
      if (dir === "left") {
        if (dx < 0) score = Math.abs(dy) + Math.abs(dx) * 0.01;
      } else if (dir === "right") {
        if (dx > 0) score = Math.abs(dy) + Math.abs(dx) * 0.01;
      } else if (dir === "top") {
        if (dy < 0) score = Math.abs(dx) + Math.abs(dy) * 0.01;
      } else if (dir === "bottom") {
        if (dy > 0) score = Math.abs(dx) + Math.abs(dy) * 0.01;
      }

      if (score < bestScore) {
        bestScore = score;
        best = idx;
      }
    });

    return best;
  }

  {
    const t = triangles.top;
    t.digits = [0, 0, 0];
    const i = pickPart(t, "left");
    if (i >= 0) t.digits[i] = 1;
  }

  {
    const t = triangles.right;
    t.digits = [0, 0, 0];
    const i = pickPart(t, "right");
    if (i >= 0) t.digits[i] = 1;
  }

  {
    const t = triangles.left;
    t.digits = [0, 0, 0];
    const i = pickPart(t, "top");
    if (i >= 0) t.digits[i] = 6;
  }

  {
    const t = triangles.center;
    t.digits = [1, 1, 1];
    const iB = pickPart(t, "bottom");
    if (iB >= 0) t.digits[iB] = 6;
  }
}

function drawDotsForTriangle(triangle) {
  if (triangle.groupEl) {
    triangle.groupEl.remove();
  }

  const group = createSVG("g", { class: "dots-group" });
  group.style.transformOrigin = `${triangle.incenter.x}px ${triangle.incenter.y}px`;
  svg.appendChild(group);

  triangle.groupEl = group;

  triangle.partGroups = triangle.parts.map((part, idx) => {
    const partGroup = createSVG("g", { class: "part-dots" });
    group.appendChild(partGroup);
    drawDots(partGroup, part.center.x, part.center.y, triangle.digits[idx], "dot", 0.7, 1.5);
    return partGroup;
  });
}

function refreshTriangleDots(triangle) {
  if (!triangle.partGroups) return;
  triangle.partGroups.forEach((partGroup, idx) => {
    partGroup.innerHTML = "";
    drawDots(partGroup, triangle.parts[idx].center.x, triangle.parts[idx].center.y, triangle.digits[idx], "dot", 0.7, 1.5);
  });
}

function drawCenterDots() {
  Object.values(centerDotEls).forEach(el => el && el.remove());

  const centerTri = triangles.center;

  let topDigit, leftDigit, rightDigit;

  if (isFirstSpin) {
    topDigit   = centerTri.digits[centerTri.centerIdxFor.top];
    leftDigit  = centerTri.digits[centerTri.centerIdxFor.left];
    rightDigit = centerTri.digits[centerTri.centerIdxFor.right];
  } else {
    topDigit   = triangles.top.digits[triangles.top.onCenterIndex];
    leftDigit  = triangles.left.digits[triangles.left.onCenterIndex];
    rightDigit = triangles.right.digits[triangles.right.onCenterIndex];
  }

  const centerTopIdx   = centerTri.centerIdxFor.top;
  const centerLeftIdx  = centerTri.centerIdxFor.left;
  const centerRightIdx = centerTri.centerIdxFor.right;

  const topGroup = createSVG("g");
  svg.appendChild(topGroup);
  drawDots(topGroup, centerTri.parts[centerTopIdx].center.x, centerTri.parts[centerTopIdx].center.y,
    topDigit, "dot center-dot", 0.8, 1.6);
  centerDotEls.top = topGroup;

  const leftGroup = createSVG("g");
  svg.appendChild(leftGroup);
  drawDots(leftGroup, centerTri.parts[centerLeftIdx].center.x, centerTri.parts[centerLeftIdx].center.y,
    leftDigit, "dot center-dot", 0.8, 1.6);
  centerDotEls.left = leftGroup;

  const rightGroup = createSVG("g");
  svg.appendChild(rightGroup);
  drawDots(rightGroup, centerTri.parts[centerRightIdx].center.x, centerTri.parts[centerRightIdx].center.y,
    rightDigit, "dot center-dot", 0.8, 1.6);
  centerDotEls.right = rightGroup;
}

function refreshCenterDots() {
  drawCenterDots();
}

function updateSpinButtons() {
  if (!k1Poly || !k2Poly) return;
  if (rotationMode === -1) {
    k1Poly.classList.add("active");
    k2Poly.classList.remove("active");
  } else {
    k2Poly.classList.add("active");
    k1Poly.classList.remove("active");
  }
}

// ============================================
// ПРОВЕРКА ВЫИГРЫША
// ============================================
function getCenterDigits() {
  if (isFirstSpin) {
    const c = triangles.center;
    return [
      c.digits[c.centerIdxFor.top],
      c.digits[c.centerIdxFor.left],
      c.digits[c.centerIdxFor.right],
    ];
  }
  return [
    triangles.top.digits[triangles.top.onCenterIndex],
    triangles.left.digits[triangles.left.onCenterIndex],
    triangles.right.digits[triangles.right.onCenterIndex],
  ];
}

function checkAutoWin() {
  const [t, l, r] = getCenterDigits();

  if (t === l && l === r) {
    const multiplier = t + 1;
    const winAmount = currentBet * multiplier;
    deposit += winAmount;
    updateDepositScale();
    drawBetTicks();
    updateBetSlider();
    playWinStream();
    Sound.win();
    highlightCenterDots();
    setTimeout(clearCenterHighlight, 2000);
    showResult(`🎉 ВЫИГРЫШ! ${t}+${t}+${t} → ×${multiplier} → +${winAmount}`, "win");
    return true;
  } else {
    playLoseStream();
    Sound.lose();
    showResult(`😢 Не выигрыш (${t}, ${l}, ${r}). Крутите внешние, чтобы составить комбинацию, затем кликните по центру (1 раз).`, "info");
    return false;
  }
}

function checkManualWin() {
  const [t, l, r] = getCenterDigits();
  const center = triangles.center.parts[triangles.center.centerIdxFor.top].center;

  if (t === l && l === r) {
    const winAmount = currentBet;
    deposit += winAmount;
    updateDepositScale();
    drawBetTicks();
    updateBetSlider();
    playWinStream();
    playSparks(center, "#ffea00", 16);
    Sound.centerWin();
    Sound.win();
    highlightCenterDots();
    setTimeout(clearCenterHighlight, 2000);
    showResult(`🖐 РУЧНОЙ ВЫИГРЫШ! ${t}+${t}+${t} → +${winAmount}`, "win");
    return true;
  } else {
    playSparks(center, "#8a2020", 12);
    Sound.centerEmpty();
    Sound.lose();
    showResult(`❌ Не выигрышная комбинация (${t}, ${l}, ${r}). Клик по центру использован.`, "lose");
    return false;
  }
}

function onCenterClick() {
  if (spinning || gameOver) return;
  if (centerClickUsed) {
    showResult("⏳ Клик по центру уже использован в этом раунде", "info");
    return;
  }

  centerClickUsed = true;
  stopCenterPulse();
  const manualWin = checkManualWin();

  if (deposit <= 0 && !manualWin) {
    gameOver = true;
    showResult("💀 Игра окончена. Депозит = 0", "lose");
  }
}

// ============================================
// ИНТЕРАКТИВНЫЙ ПОЛЗУНОК
// ============================================
let sliderDragging = false;

function onBetSliderMouseDown(e) {
  if (gameOver) return;
  sliderDragging = true;
  const pt = svgPoint(e);
  setBetFromY(pt.y);
  document.addEventListener("mousemove", onBetSliderMouseMove);
  document.addEventListener("mouseup", onBetSliderMouseUp);
}

function onBetSliderMouseMove(e) {
  if (!sliderDragging) return;
  const pt = svgPoint(e);
  setBetFromY(pt.y);
}

function onBetSliderMouseUp() {
  sliderDragging = false;
  document.removeEventListener("mousemove", onBetSliderMouseMove);
  document.removeEventListener("mouseup", onBetSliderMouseUp);
}

function onBetSliderTouchStart(e) {
  if (gameOver) return;
  e.preventDefault();
  sliderDragging = true;
  const pt = svgPoint(e.touches[0]);
  setBetFromY(pt.y);
  document.addEventListener("touchmove", onBetSliderTouchMove, { passive: false });
  document.addEventListener("touchend", onBetSliderTouchEnd);
}

function onBetSliderTouchMove(e) {
  if (!sliderDragging) return;
  e.preventDefault();
  const pt = svgPoint(e.touches[0]);
  setBetFromY(pt.y);
}

function onBetSliderTouchEnd() {
  sliderDragging = false;
  document.removeEventListener("touchmove", onBetSliderTouchMove);
  document.removeEventListener("touchend", onBetSliderTouchEnd);
}

function setBetFromY(y) {
  const newBet = getYToBet(y);
  if (newBet !== currentBet) {
    currentBet = newBet;
    updateBetSlider();
  }
}

function svgPoint(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// ============================================
// SPIN
// ============================================
function handleSpin(dir) {
  if (spinning || gameOver) return;

  if (deposit < currentBet) {
    showResult("❌ Недостаточно средств для ставки", "lose");
    return;
  }
  deposit -= currentBet;
  updateDepositScale();

  centerClickUsed = false;
  isFirstSpin = false;

  clearCenterHighlight();
  stopCenterPulse();

  rotationMode = dir;
  updateSpinButtons();

  if (dir === -1) Sound.spinLeft();
  else Sound.spinRight();

  spinning = true;

  const flashCount = 8;
  const flashInterval = 50;
  let flashes = 0;

  const orbits = randomUniqueOrbits(3);

  const timer = setInterval(() => {
    ["top", "left", "right"].forEach(key => {
      const tri = triangles[key];
      tri.digits = tri.parts.map(() => randomDigit());
      refreshTriangleDots(tri);
    });

    refreshCenterDots();

    flashes++;

    if (flashes >= flashCount) {
      clearInterval(timer);

      triangles.top.digits = [...orbits[0]];
      triangles.left.digits = [...orbits[1]];
      triangles.right.digits = [...orbits[2]];

      refreshTriangleDots(triangles.top);
      refreshTriangleDots(triangles.left);
      refreshTriangleDots(triangles.right);

      refreshCenterDots();

      spinning = false;

      const autoWin = checkAutoWin();

      if (autoWin) {
        centerClickUsed = true;
      } else {
        // Разрешаем клик по центру — пульсация
        startCenterPulse();
      }

      if (deposit <= 0 && !autoWin) {
        showResult("🎲 Последний шанс! Крутите внешние и нажмите на центр.", "info");
      }
    }
  }, flashInterval);
}

// ============================================
// ПРОКРУТКА (БЕСПЛАТНАЯ)
// ============================================
function rotateTriangle(whichKey) {
  if (spinning || gameOver) return;

  const triangle = triangles[whichKey];
  if (!triangle) return;

  Sound.rotate();

  spinning = true;

  const group = triangle.groupEl;
  const angle = rotationMode === 1 ? 120 : -120;

  group.style.transition = "transform 0.3s ease-in-out";
  group.style.transform = `rotate(${angle}deg)`;

  setTimeout(() => {
    group.style.transition = "none";
    group.style.transform = "rotate(0deg)";

    if (rotationMode === 1) {
      triangle.digits.unshift(triangle.digits.pop());
    } else {
      triangle.digits.push(triangle.digits.shift());
    }

    refreshTriangleDots(triangle);

    refreshCenterDots();

    requestAnimationFrame(() => {
      spinning = false;
    });
  }, 300);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
buildField();