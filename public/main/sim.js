/*
 * CAFFEINE CHALLENGE: SIMULASI (aturan, course, fisika, hadiah)
 * Dipakai bersama oleh game (browser) dan server (netlify/functions) supaya skor bisa dihitung ulang
 * dari rekaman tap. Deterministik: tanpa Math.random, tanpa DOM, langkah tetap 60 Hz.
 * Game buatan Ridho (Bytepreneur); aturan hadiah mengikuti naskah presentasi & laporan UTS.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CaffeineSim = api;
})(this, function () {
'use strict';

/* ======================================================================
   CONFIG (tune difficulty here)
   ====================================================================== */
const W = 360, H = 640, GROUND = 552, DPR = 2;
const BX = 96, R = 10.5, PW = 58;               // bird x, bird radius, pillar width
const STEP = 1 / 60;                             // fixed simulation step (seconds)
const GRAV = 1500, FLAP = -400, ACCEL = 60;      // physics; ACCEL = speed change per second between stages
const POINTS = 100;                              // score per pillar
const PER_STAGE = 6;                             // pillars per stage
const SLEEP_RATE = 0.045;                        // sleepiness gained per second (full in ~22 s)
const SLEEP_FLAP = 0.30;                         // flap power lost at full sleepiness
const SLEEP_GRAV = 0.22;                         // extra gravity at full sleepiness
const BEAN_COOL = 0.22;                          // sleepiness removed per coffee bean
const BEAN_SPOTS = [1, 4];                       // beans sit between pillar a and a+1 inside each stage

// One stage per menu item. speed = px/s, gap = opening between pillars, spacing = distance between pillars,
// delta = max vertical shift between two openings, seed = fixed layout (same for every player).
const STAGES = [
  { name: 'Americano',           color: '#e9b872', speed: 125, gap: 160, spacing: 210, delta: 90,  seed: 101 },
  { name: 'Dalgona Coffee',      color: '#c98a4b', speed: 132, gap: 154, spacing: 206, delta: 110, seed: 202 },
  { name: 'Ice Coffee Milo',     color: '#8a5a44', speed: 140, gap: 148, spacing: 202, delta: 130, seed: 303 },
  { name: 'Cimory Matcha Latte', color: '#8a9a62', speed: 148, gap: 142, spacing: 198, delta: 145, seed: 404 },
  { name: 'Dirty Latte',         color: '#f2e6d2', speed: 156, gap: 136, spacing: 194, delta: 160, seed: 505 }
];
// Sesuai rencana (naskah presentasi & laporan UTS): minimal tetap Medium, skor menentukan bonus.
// Topping belum ada dan poin digital belum jadi, jadi "poin" memakai kartu stamp (versi manual poin).
const VOUCHER = 1000;                                   // nilai voucher untuk pesanan berikutnya (Rp)
const TIERS = [
  { key: 'voucher', min: 0,    size: 'Medium', bonus: '+ voucher Rp1.000',   short: 'VOUCHER', desc: 'Skor di bawah 1.800. Cup tetap Medium, plus voucher Rp1.000 untuk pesanan berikutnya.' },
  { key: 'cap',     min: 1800, size: 'Medium', bonus: '+ 1 cap kartu stamp', short: '+1 CAP',  desc: 'Capai 1.800 (tamat stage 3). Cup Medium, plus 1 cap tambahan di kartu stamp.' },
  { key: 'large',   min: 3000, size: 'Large',  bonus: 'upgrade dari Medium', short: 'LARGE',   desc: 'Capai 3.000 (tamat semua stage). Cup kamu di-upgrade ke Large.' }
];
const TOTAL = PER_STAGE * STAGES.length * POINTS;   // 3000
const VERSION = 1;


/* ======================================================================
   HELPERS
   ====================================================================== */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (a, n) => ((a % n) + n) % n;
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tierFor = score => (score >= TIERS[2].min ? TIERS[2] : score >= TIERS[1].min ? TIERS[1] : TIERS[0]);
const sizeFor = score => tierFor(score).size;


/* ======================================================================
   SIM (deterministic: no Math.random, no DOM, fixed step)
   ====================================================================== */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCourse() {
  const pipes = [], beans = [];
  let x = 340, prevGy = 290;
  STAGES.forEach((S, st) => {
    const rnd = mulberry32(S.seed);
    const lo = S.gap / 2 + 56, hi = GROUND - S.gap / 2 - 56;
    let dir = rnd() < 0.5 ? -1 : 1;
    for (let i = 0; i < PER_STAGE; i++) {
      let gy = 290;
      if (pipes.length) {
        if (rnd() < 0.7) dir = -dir;                       // mostly alternate up and down
        gy = clamp(prevGy + (0.35 + 0.65 * rnd()) * S.delta * dir, lo, hi);
      }
      pipes.push({ x, gy, gap: S.gap, stage: st });
      prevGy = gy;
      x += S.spacing;
    }
  });
  STAGES.forEach((S, st) => {
    const rnd = mulberry32(S.seed + 999);
    BEAN_SPOTS.forEach(spot => {
      const a = pipes[st * PER_STAGE + spot], b = pipes[st * PER_STAGE + spot + 1];
      beans.push({
        x: (a.x + b.x) / 2 + PW / 2,
        y: clamp((a.gy + b.gy) / 2 + (rnd() - 0.5) * 50, 40, GROUND - 40),
        stage: st
      });
    });
  });
  beans.sort((p, q) => p.x - q.x);
  return { pipes, beans };
}
const COURSE = buildCourse();

function createSim() {
  return {
    t: 0, y: 290, vy: 0, dist: 0, speed: STAGES[0].speed,
    passed: 0, score: 0, sleepy: 0, beans: 0,
    got: new Uint8Array(COURSE.beans.length),
    alive: true, won: false
  };
}

function hitRect(cx, cy, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < R * R;
}

function simStep(s, tap) {
  if (!s.alive || s.won) return;
  const dt = STEP;
  if (tap) s.vy = FLAP * (1 - SLEEP_FLAP * s.sleepy);
  s.vy += GRAV * (1 + SLEEP_GRAV * s.sleepy) * dt;
  s.y += s.vy * dt;
  if (s.y < R) { s.y = R; if (s.vy < 0) s.vy = 0; }

  const target = STAGES[Math.min(STAGES.length - 1, Math.floor(s.passed / PER_STAGE))].speed;
  const dv = ACCEL * dt;
  s.speed += clamp(target - s.speed, -dv, dv);
  s.dist += s.speed * dt;
  s.sleepy = Math.min(1, s.sleepy + SLEEP_RATE * dt);

  const pipes = COURSE.pipes;
  while (s.passed < pipes.length && pipes[s.passed].x - s.dist + PW / 2 < BX) {
    s.passed++; s.score = s.passed * POINTS;
  }
  for (let i = Math.max(0, s.passed - 1); i < pipes.length; i++) {
    const p = pipes[i], px = p.x - s.dist;
    if (px > BX + R + 8) break;
    if (px + PW < BX - R - 8) continue;
    const top = p.gy - p.gap / 2, bot = p.gy + p.gap / 2;
    if (hitRect(BX, s.y, px - 3, -20, PW + 6, top + 20) || hitRect(BX, s.y, px - 3, bot, PW + 6, GROUND - bot)) {
      s.alive = false; break;
    }
  }
  if (s.alive) {
    const beans = COURSE.beans;
    for (let i = 0; i < beans.length; i++) {
      if (s.got[i]) continue;
      const bx = beans[i].x - s.dist;
      if (bx > BX + 40) break;
      if (bx < BX - 40) continue;
      if (Math.hypot(bx - BX, beans[i].y - s.y) < R + 9) {
        s.got[i] = 1; s.beans++; s.sleepy = Math.max(0, s.sleepy - BEAN_COOL);
      }
    }
  }
  if (s.alive && s.y + R >= GROUND) { s.y = GROUND - R; s.alive = false; }
  if (s.alive && s.passed >= pipes.length) s.won = true;
  s.t++;
}

// Re-run a recorded run (list of step numbers where a tap happened). Used by the server to verify results.
function replay(taps) {
  const s = createSim();
  let k = 0;
  const maxT = (taps.length ? taps[taps.length - 1] : 0) + 60 * 20;
  while (s.alive && !s.won && s.t < maxT) {
    let tap = false;
    while (k < taps.length && taps[k] === s.t) { tap = true; k++; }
    simStep(s, tap);
  }
  return { score: s.score, passed: s.passed, beans: s.beans, won: s.won, alive: s.alive, steps: s.t, size: sizeFor(s.score), tier: tierFor(s.score).key };
}

// Rekaman tap dikirim web sebagai selisih langkah dalam basis 36, dipisah titik.
function decodeTaps(code) {
  const out = []; let t = 0;
  for (const part of String(code || '').split('.')) { if (!part) continue; t += parseInt(part, 36); out.push(t); }
  return out;
}
function encodeTaps(list) { let p = 0; return list.map(t => { const d = (t - p).toString(36); p = t; return d; }).join('.'); }

return { W, H, GROUND, DPR, BX, R, PW, STEP, GRAV, FLAP, ACCEL, POINTS, PER_STAGE, SLEEP_RATE, SLEEP_FLAP, SLEEP_GRAV, BEAN_COOL, BEAN_SPOTS, STAGES, VOUCHER, TIERS, TOTAL, VERSION, clamp, mod, fmt, tierFor, sizeFor, mulberry32, buildCourse, COURSE, createSim, hitRect, simStep, replay, encodeTaps, decodeTaps };
});
