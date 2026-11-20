// 《메아리: 가죽재킷 황 사장》—— 세로 화면 턴제 전략: 창업자가 돌아와 12 개 분기 동안 연구개발, 파운드리 물량 확보, 시장 구역 쟁탈로 시총 1 위를 되찾는다.
// 등장인물, 회사, 경쟁사는 전부 허구.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const QUARTERS = 12, EVENT_Q = [2, 3, 5, 6, 8, 9, 11];
const COS = [
  { name: '핵공장', color: 0x6fdc24, css: '#8cff5a', dark: '#2f7a12' },
  { name: '적토반도체', color: 0xe0483c, css: '#ff6a5a', dark: '#8a231c', gen0: 2, ups: [4, 6, 9, 12], home: [[1, -3], [2, -3], [1, -2], [2, -2]] },
  { name: '청경전자', color: 0x3f8fe0, css: '#5aa8ff', dark: '#1c4a86', gen0: 1, ups: [3, 6, 9, 12], home: [[3, -2], [3, -1], [2, -1], [2, 0]] },
  { name: '은과기술', color: 0xc8ccd8, css: '#dfe3ee', dark: '#6a7080', gen0: 2, ups: [4, 7, 10], home: [[-3, 1], [-3, 2], [-2, 0], [-2, 1]] },
];
const MY_HOME = [[-2, 3], [-1, 3], [-1, 2]];
const TYPE = { GPU: '게임용 GPU', PC: 'PC', CAR: '자동차', PHONE: '스마트폰', AI: 'AI 연산' };

// ---------- 장면 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.domElement.className = 'bg'; stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05080d); scene.fog = new THREE.Fog(0x05080d, 30, 70);
const camera = new THREE.PerspectiveCamera(50, 0.6, 0.5, 120);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.8)); composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight(0xa8b8c8, 0x0c1014, 1.0)); { const d = new THREE.DirectionalLight(0xffffff, 1.3); d.position.set(5, 16, 9); scene.add(d); }
const stageLight = new THREE.PointLight(0xd8ffd0, 8, 22); stageLight.position.set(0, 7, -4); scene.add(stageLight);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
function mk(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
{ const f = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M(0x070b10, { roughness: 0.9 })); f.rotation.x = -Math.PI / 2; f.position.y = -0.02; scene.add(f);
  const g = new THREE.GridHelper(120, 80, 0x1f5a2a, 0x10301a); g.position.y = 0; g.material.transparent = true; g.material.opacity = 0.5; scene.add(g); }

// 무대, 대형 스크린, 스포트라이트
mk(scene, new THREE.BoxGeometry(15, 0.5, 3.2), M(0x10151c), 0, 0.25, -8.6);
mk(scene, new THREE.BoxGeometry(15, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: 0x4fae2a }), 0, 0.5, -7.0);
const scr = document.createElement('canvas'); scr.width = 512; scr.height = 256; const sg = scr.getContext('2d'), scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace;
mk(scene, new THREE.BoxGeometry(12.6, 6.3, 0.2), M(0x0a0e12), 0, 4.2, -10.2);
mk(scene, new THREE.PlaneGeometry(12, 5.7), new THREE.MeshBasicMaterial({ map: scrTex }), 0, 4.2, -10.05);
const spots = [];
for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8cff5a : 0xffffff, vertexColors: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); m.geometry.translate(0, -4.5, 0); { const p = m.geometry.attributes.position, c = new Float32Array(p.count * 3); for (let k = 0; k < p.count; k++) c.fill(Math.max(0, (p.getY(k) + 9) / 9) ** 2, k * 3, k * 3 + 3); m.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); } m.position.set(-5.4 + i * 3.6, 9, -8.4); scene.add(m); spots.push(m); }

// 가죽재킷 황 사장: 검은 가죽재킷, 은발, 안경
const boss = new THREE.Group(); boss.position.set(0, 0.5, -8.0); boss.scale.setScalar(2.3); scene.add(boss);
const LEA = M(0x0b0b0f, { roughness: 0.32, metalness: 0.35 }), SKIN = M(0xe6b68e), HAIRM = M(0xd4d7dc, { roughness: 0.5 });
for (const x of [-0.17, 0.17]) { mk(boss, new THREE.CapsuleGeometry(0.13, 0.6, 4, 8), M(0x14161b), x, 0.45, 0); mk(boss, new THREE.BoxGeometry(0.2, 0.1, 0.34), M(0x08080a), x, 0.05, 0.05); }
const torso = new THREE.Group(); torso.position.y = 0.85; boss.add(torso);
mk(torso, new THREE.CapsuleGeometry(0.3, 0.45, 6, 12), LEA, 0, 0.42, 0, 1.08, 1, 0.8); mk(torso, new THREE.BoxGeometry(0.03, 0.62, 0.02), M(0x9aa0a8, { metalness: 0.8, roughness: 0.3 }), 0, 0.42, 0.245);
mk(torso, new THREE.BoxGeometry(0.2, 0.14, 0.05), M(0x2a2c32), 0, 0.82, 0.19);
const head = new THREE.Group(); head.position.y = 1.12; torso.add(head);
mk(head, new THREE.SphereGeometry(0.25, 18, 14), SKIN, 0, 0, 0, 0.95, 1.05, 0.98); mk(head, new THREE.SphereGeometry(0.262, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.46), HAIRM, 0, 0.035, -0.03, 1, 1.05, 1.02);
for (const x of [-0.1, 0.1]) { mk(head, new THREE.TorusGeometry(0.066, 0.008, 6, 18), M(0x111111), x, 0.01, 0.235); mk(head, new THREE.SphereGeometry(0.022, 8, 6), M(0x111111), x, 0.01, 0.228); }
mk(head, new THREE.BoxGeometry(0.07, 0.012, 0.012), M(0x111111), 0, 0.02, 0.243); const mouth = mk(head, new THREE.BoxGeometry(0.1, 0.018, 0.02), M(0x7a3a2a), 0, -0.11, 0.232);
const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.36, 0.74, 0); torso.add(p); mk(p, new THREE.CapsuleGeometry(0.095, 0.5, 4, 8), LEA, 0, -0.3, 0); mk(p, new THREE.SphereGeometry(0.085, 10, 8), SKIN, 0, -0.66, 0); return p; });
const chipInHand = mk(arms[1], new THREE.BoxGeometry(0.26, 0.26, 0.04), new THREE.MeshBasicMaterial({ color: 0x8cff5a }), 0, -0.82, 0.02); chipInHand.visible = false;

// ---------- 판도: 31 개의 육각 시장 ----------
const tiles = [], byKey = {}, picks = [];
const SIDE_GEO = new THREE.CylinderGeometry(0.95, 0.95, 1, 6), TOP_GEO = new THREE.CircleGeometry(0.93, 6, Math.PI / 6).rotateX(-Math.PI / 2);
for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
  const s = -q - r, ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s)); if (ring > 3 || (ring === 3 && (q === 0 || r === 0 || s === 0))) continue;
  const x = Math.sqrt(3) * (q + r / 2), z = 1.5 * r;
  const type = ring <= 1 ? 'AI' : Math.abs(z) > Math.abs(x) * 0.9 ? (z > 0 ? 'GPU' : 'PC') : x > 0 ? 'CAR' : 'PHONE';
  const t = { q, r, ring, x, z, type, val: [10, 5, 3, 2][ring], base: [12, 6, 3, 2][ring], own: -1, fort: 0, h: 0.3, bump: 0, lock: false };
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); t.g = g;
  t.sideM = M(0x2a3340, { roughness: 0.55 }); t.side = mk(g, SIDE_GEO, t.sideM, 0, 0, 0); t.side.userData.tile = t; picks.push(t.side);
  t.cv = document.createElement('canvas'); t.cv.width = t.cv.height = 128; t.tex = new THREE.CanvasTexture(t.cv); t.tex.colorSpace = THREE.SRGBColorSpace;
  t.top = mk(g, TOP_GEO, new THREE.MeshBasicMaterial({ map: t.tex }), 0, 0, 0); t.top.userData.tile = t; picks.push(t.top);
  tiles.push(t); byKey[q + ',' + r] = t;
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
for (const t of tiles) t.nb = DIRS.map(([a, b]) => byKey[(t.q + a) + ',' + (t.r + b)]).filter(Boolean);
const selRing = mk(scene, new THREE.RingGeometry(0.8, 1.02, 6, 1, Math.PI / 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), 0, -5, 0);

// 이펙트: 날아가는 칩, 충격 링, 파티클
const shots = [], rings = [];
const CHIP_GEO = new THREE.BoxGeometry(0.34, 0.08, 0.34), RING_GEO = new THREE.RingGeometry(0.75, 1, 28).rotateX(-Math.PI / 2);
const PN = 520, pPos = new Float32Array(PN * 3).fill(-999), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pGrav = new Float32Array(PN); let pI = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.3, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
const tmpC = new THREE.Color();
function burst(x, y, z, color, n, sp = 5, grav = 9, life = 0.8) { for (let i = 0; i < n; i++) { const k = pI = (pI + 1) % PN, a = rand(6.283), u = rand(0.2, 1); pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z; pVel[k * 3] = Math.cos(a) * sp * u; pVel[k * 3 + 1] = rand(0.3, 1) * sp; pVel[k * 3 + 2] = Math.sin(a) * sp * u; tmpC.setHex(Array.isArray(color) ? pick(color) : color); pCol[k * 3] = tmpC.r; pCol[k * 3 + 1] = tmpC.g; pCol[k * 3 + 2] = tmpC.b; pLife[k] = life * rand(0.6, 1.2); pGrav[k] = grav; } }
function ringFx(x, z, color) { const m = mk(scene, RING_GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), x, 0.95, z); rings.push({ m, t: 0 }); }
function shoot(a, b, color, done) { for (let i = 0; i < 3; i++) { const m = mk(scene, CHIP_GEO, new THREE.MeshBasicMaterial({ color }), a.x, -5, a.z); shots.push({ m, a, b, t: -i * 0.07, done: i === 0 ? done : null }); } }

// ---------- 상태 ----------
let state = 'title', held = false, auto = false, muted = false, busy = false, W = 0, H = 0, camK = 0, camGoal = 0;
let S = null, cos = [], typeMul = {}, sel = null, evt = null, evDeck = [], laters = [], hist = [], epic = 0, grabbed = 0, lostN = 0, wasFirst = false, bannerT = 0, cheer = 0, sad = 0, talk = 0, botT = 0, result = null;
let key = null;                                                       // 발표회 미니게임: { t, p, a, b, c, stopped }
let best = 0; try { best = +localStorage.getItem('echo_chip_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
const later = (sec, fn) => laters.push({ t: sec, fn });
const inc = (t) => Math.max(1, Math.round(t.val * typeMul[t.type]));
const owned = (i) => tiles.filter((t) => t.own === i);
const income = (i) => owned(i).reduce((a, t) => a + inc(t), 0);
const defOf = (t) => (t.own < 0 ? t.base : 2 * cos[t.own].gen + (t.own === 0 ? 4 : 3) + t.fort);
const atkCost = (t) => Math.ceil(defOf(t) / S.gen);
const reach = (t) => t.nb.some((n) => n.own === 0);
const revenue = () => Math.round(income(0) * (1 + (S.hype - 1) * 0.5) * S.revMul);
const mcap = (i) => (i === 0 ? Math.round((income(0) * 30 * S.hype + Math.max(0, S.cash) + S.gen * 40) * 5) : income(i) ? Math.round((income(i) * 34 + cos[i].gen * 40 + 60) * 5) : 0);
const rankOf = () => 1 + [1, 2, 3].filter((i) => mcap(i) > mcap(0)).length;
const money = (n) => (n >= 10000 ? (n / 10000).toFixed(2) + '<em>조</em>' : n.toLocaleString() + '<em>억</em>');
const rdCost = () => 10 + 5 * (S.gen - 1) + 2 * (S.gen - 1) ** 2, capCost = () => 12 + 8 * (S.cap - 3), talCost = () => 10 + 8 * (S.talent - 1), rdGain = () => 28 + 8 * S.talent;
const hypeAdd = (d) => { S.hype = clamp(+(S.hype + d).toFixed(2), 0.6, 1.6); };

// ---------- 소리 ----------
let ac = null, master = null;
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination); } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function noise(dur, vol, freq, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t); }
const sfx = {
  tap: () => tone('triangle', 700, 900, 0.05, 0.07), no: () => tone('square', 160, 120, 0.12, 0.08),
  spend: () => { tone('triangle', 520, 780, 0.09, 0.12); tone('triangle', 780, 1040, 0.1, 0.1, 0.07); },
  launch: () => { tone('sawtooth', 220, 900, 0.22, 0.1); noise(0.2, 0.12, 2400); },
  take: () => { noise(0.25, 0.3, 500); [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.16, 0.14, 0.05 + i * 0.06)); },
  fort: () => { tone('square', 300, 300, 0.06, 0.08); tone('square', 450, 450, 0.1, 0.08, 0.06); },
  lost: () => { noise(0.3, 0.3, 300); tone('sawtooth', 300, 110, 0.4, 0.2); }, clash: () => { noise(0.14, 0.14, 900); tone('square', 200, 160, 0.08, 0.06); },
  coin: () => [988, 1319, 1568].forEach((f, i) => tone('sine', f, f, 0.12, 0.1, i * 0.06)),
  event: () => [440, 554, 440].forEach((f, i) => tone('triangle', f, f, 0.14, 0.12, i * 0.11)),
  fanfare: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone('sawtooth', f, f, 0.22, 0.09, i * 0.1)),
  cheer: () => { noise(1.6, 0.35, 1600); noise(1.6, 0.25, 3200, 0.1); [1047, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, f, 0.3, 0.12, i * 0.08)); },
  boo: () => { tone('sawtooth', 220, 90, 0.7, 0.22); tone('sawtooth', 180, 80, 0.7, 0.18, 0.1); },
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.2, i * 0.22)), win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.35, 0.16, i * 0.12)),
};
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '돌아왔다': '我回来了', '가죽재킷 입고, 시작': '皮衣穿好，开干', '뺏었다': '拿下', '이 구역은 내 거다': '这块地盘归我了', '재고가 부족해': '货不够啊', '돈이 부족해': '钱不够啊', '구역을 뺏겼다': '地盘被抢了', '침착해, 당황하지 마': '稳住，别慌', '그리고 한 가지 더': '还有一件事', '많이 살수록 더 아낀다': '买得越多，省得越多', '전원 기립': '全场起立', '너무 부풀렸다': '吹过头了', '시총 1위다': '市值第一了', '또 쫓겨났다': '又被赶走了', '왕의 귀환': '王者归来' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[VOICE[text] || text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text); sayLast[text] = now; talk = 1;
  if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
function banner(text, sec = 1.4, bad) { const b = $('banner'); b.textContent = text; b.className = bad ? 'bad' : ''; bannerT = sec; }
const v3 = new THREE.Vector3();
function floatAt(x, y, z, text, cls) { v3.set(x, y, z).project(camera); const el = document.createElement('div'); el.className = 'float ' + (cls || ''); el.textContent = text; el.style.left = ((v3.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - v3.y) / 2 * H) + 'px'; $('hud').appendChild(el); setTimeout(() => el.remove(), 1000); }

// ---------- 화면 갱신 ----------
function drawTile(t) {
  const g = t.cv.getContext('2d'), c = t.own >= 0 ? cos[t.own] : null, light = t.own === 3, can = t.own !== 0 && reach(t);
  g.fillStyle = c ? (t.own === 0 ? '#3f9a18' : c.dark) : '#222b36'; g.fillRect(0, 0, 128, 128);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = light ? '#10141c' : '#fff';
  g.font = '900 ' + (t.type === 'AI' ? 40 : 46) + 'px "Noto Sans KR","Malgun Gothic",sans-serif'; g.fillText(t.type, 64, 60);
  g.font = '700 20px sans-serif'; g.fillStyle = light ? '#3a2a00' : '#ffe27a'; g.fillText('+' + inc(t), 64, 24);
  g.font = '800 21px "Noto Sans KR",sans-serif';
  if (can) { const n = atkCost(t); g.fillStyle = n <= S.stock ? '#b8ff7a' : '#ff9a8a'; if (light) g.fillStyle = n <= S.stock ? '#0f5a00' : '#a01808'; g.fillText('공 ' + n, 64, 100); }
  else { g.fillStyle = light ? '#2a3040' : 'rgba(255,255,255,.7)'; g.fillText('방 ' + defOf(t), 64, 100); }
  t.tex.needsUpdate = true;
  t.sideM.color.setHex(c ? c.color : 0x2a3340); t.sideM.emissive.setHex(c ? c.color : 0x000000); t.sideM.emissiveIntensity = t.own === 0 ? 0.35 : c ? 0.18 : 0;
}
function drawScreen() {
  const g = sg; g.fillStyle = '#04100a'; g.fillRect(0, 0, 512, 256); g.textBaseline = 'middle';
  if (key) {
    g.textAlign = 'center'; g.fillStyle = '#8cff5a'; g.font = '900 54px "Noto Sans KR",sans-serif'; g.fillText('핵공장 ' + (S.gen + 1) + ' 세대', 256, 78);
    g.fillStyle = '#fff'; g.font = '900 84px sans-serif'; g.fillText('×' + (1 + key.p * 9).toFixed(1), 256, 172); scrTex.needsUpdate = true; return;
  }
  g.textAlign = 'left'; g.fillStyle = '#8cff5a'; g.font = '900 26px "Noto Sans KR",sans-serif'; g.fillText('핵공장 · 제 ' + (S ? S.gen : 1) + ' 세대 칩　시총 추이', 16, 34);
  g.strokeStyle = 'rgba(140,255,90,.18)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(16, 84 + i * 38); g.lineTo(496, 84 + i * 38); g.stroke(); }
  if (hist.length) { const max = Math.max(...hist.flat(), 1); for (let i = 3; i >= 0; i--) { g.strokeStyle = COS[i].css; g.lineWidth = i === 0 ? 6 : 3; g.beginPath(); hist.forEach((h, k) => { const x = 16 + k * (480 / QUARTERS), y = 236 - h[i] / max * 150; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); } }
  scrTex.needsUpdate = true;
}
function refresh() {
  if (!S) return; tiles.forEach(drawTile);
  $('qn').textContent = Math.min(S.q, QUARTERS) + ' / ' + QUARTERS; const r = rankOf(); $('cap').innerHTML = money(mcap(0)); $('cash').innerHTML = S.cash + '<em>억</em>';
  $('rank').innerHTML = [0, 1, 2, 3].sort((a, b) => mcap(b) - mcap(a)).map((i, k) => '<span class="' + (i === 0 ? 'me' : '') + (mcap(i) ? '' : ' out') + '"><i style="background:' + cos[i].css + '"></i>' + (k + 1) + ' ' + cos[i].name.slice(0, 2) + ' <b>' + (mcap(i) >= 10000 ? (mcap(i) / 10000).toFixed(1) + ' 조' : mcap(i)) + '</b></span>').join('');
  $('sGen').innerHTML = '제 ' + S.gen + ' 세대'; $('rdbar').firstChild.style.width = clamp(S.rd, 0, 100) + '%'; $('sStock').innerHTML = S.stock + '<em>+' + S.cap + '/분기</em>'; $('sTal').innerHTML = S.talent + '<em>명</em>'; $('sHype').innerHTML = '×' + S.hype.toFixed(2);
  const set = (id, cost, ok, tip) => { const b = $(id); b.className = ok ? '' : 'off'; b.lastChild.textContent = tip || cost + ' 억'; };
  set('bRd', rdCost(), S.cash >= rdCost(), rdCost() + ' 억 · 진행 +' + rdGain() + '%'); set('bCap', capCost(), S.cash >= capCost(), capCost() + ' 억 · 분기당 재고 +1'); set('bTal', talCost(), S.talent < 5 && S.cash >= talCost(), S.talent >= 5 ? '최대치' : talCost() + ' 억 · 연구 가속');
  $('bNext').lastChild.textContent = '수입 +' + revenue() + ' 억';
  if (r === 1 && !wasFirst && S.q > 1) { wasFirst = true; say('시총 1위다', 3); } if (r > 1) wasFirst = false;
  showSel();
}
function showSel() {
  const el = $('tile'), t = sel; if (!t || state !== 'play') { el.style.display = 'none'; selRing.position.y = -5; return; }
  el.style.display = 'flex'; el.style.borderColor = t.own >= 0 ? cos[t.own].css : '#8a96a8';
  $('tName').textContent = TYPE[t.type] + ' · ' + (t.own >= 0 ? cos[t.own].name : '점유 없음');
  const b = $('tBtn');
  if (t.own === 0) { $('tInfo').textContent = '분기 수입 +' + inc(t) + ' 억　방어 ' + defOf(t); const ok = t.fort < 6 && S.stock >= 1; b.className = ok ? '' : 'off'; b.innerHTML = '보강<small>' + (t.fort >= 6 ? '상한 도달' : '재고 1, 방어 +2') + '</small>'; }
  else if (reach(t)) { const n = atkCost(t); $('tInfo').textContent = '분기 수입 +' + inc(t) + ' 억　방어 ' + defOf(t) + ', 내 칩은 제 ' + S.gen + ' 세대'; b.className = n <= S.stock ? '' : 'off'; b.innerHTML = '공격<small>재고 ' + n + ' 필요</small>'; }
  else { $('tInfo').textContent = '분기 수입 +' + inc(t) + ' 억　방어 ' + defOf(t); b.className = 'off'; b.innerHTML = '닿지 않음<small>옆 구역부터 차지</small>'; }
}
function showScreen() {
  const s = $('screen');
  if (state === 'play' || state === 'key') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = 'none';
  if (state === 'title') s.innerHTML = '<h1>가죽재킷 황 사장</h1><div class="sub">메아리 · 제 12 기　등장인물과 회사는 허구</div><div class="help">핵공장 시총이 꼴찌가 되자 이사회가 창업자 황 사장을 다시 불렀습니다<br>당신에게는 <b>12 개 분기</b>가 있습니다. 시총을 <b>1 위</b>로 되돌리세요<br><b>연구개발</b>이 차면 발표회를 열어 새 세대 칩을 내고, 세대가 높을수록 공격에 재고가 덜 듭니다<br><b>증산</b>으로 분기 출하량을 늘리고, 재고로 <b>구역 탈취</b>와 <b>보강</b>을<br>지도에서 내 구역에 붙은 칸을 눌러 공격하세요. 점유한 칸은 분기마다 수입을 줍니다<br>경쟁사도 노립니다: 세대가 앞서면 지켜냅니다<br>발표회에서 수치를 크게 부를수록 주가가 오르지만, 지나치면 망신</div>' +
    (best ? '<div class="sub" style="margin-top:12px">최고 시총 ' + best.toLocaleString() + ' 억</div>' : '') + '<button class="go" data-act="start">CEO 복귀</button>';
  else s.innerHTML = '<h1 class="' + result.cls + '">' + result.title + '</h1><div class="sub">' + result.line + '<br>시총 ' + mcap(0).toLocaleString() + ' 억　' + rankOf() + ' 위<br>구역 ' + owned(0).length + ' 개　칩 제 ' + S.gen + ' 세대<br>탈취 ' + grabbed + ' 개　탈취당함 ' + lostN + ' 개　발표회 전설 ' + epic + ' 회<br>최고 시총 ' + best.toLocaleString() + ' 억</div><button class="go" data-act="start">한 임기 더</button>';
}

// ---------- 플레이어 조작 ----------
function select(t) { sel = t; if (t) sfx.tap(); showSel(); }
function setOwner(t, i) { t.own = i; t.fort = 0; t.bump = 1; t.lock = false; }
function attack(t) {
  if (busy || state !== 'play' || t.lock || t.own === 0 || !reach(t)) return false; const n = atkCost(t);
  if (n > S.stock) { sfx.no(); say('재고가 부족해', 1, 4000); return false; }
  S.stock -= n; t.lock = true; const from = t.nb.filter((x) => x.own === 0).sort((a, b) => b.val - a.val)[0], was = t.own; sfx.launch(); refresh();
  shoot(from, t, 0x8cff5a, () => { setOwner(t, 0); grabbed++; if (sel === t) sel = null; sfx.take(); cheer = 1; ringFx(t.x, t.z, 0x8cff5a); burst(t.x, 1, t.z, [0x8cff5a, 0xffffff, 0xffe27a], 34); floatAt(t.x, 1.2, t.z, '+' + inc(t) + ' 억/분기', 'g');
    if (was > 0 && !owned(was).length) banner(cos[was].name + ' 탈락', 1.6); else if (t.ring === 0) banner('AI 센터 점령', 1.6);
    say(pick(['뺏었다', '이 구역은 내 거다']), 1, 2500); refresh(); });
  return true;
}
function fortify(t) { if (busy || state !== 'play' || t.own !== 0 || t.fort >= 6) return false; if (S.stock < 1) { sfx.no(); say('재고가 부족해', 1, 4000); return false; } S.stock--; t.fort += 2; t.bump = 0.6; sfx.fort(); ringFx(t.x, t.z, 0xffffff); say('침착해, 당황하지 마', 1, 6000); refresh(); return true; }
function tileAct() { if (!sel) return; if (sel.own === 0) fortify(sel); else if (reach(sel)) attack(sel); else sfx.no(); }
function buy(what) {
  if (busy || state !== 'play') return false; const cost = what === 'rd' ? rdCost() : what === 'cap' ? capCost() : talCost();
  if ((what === 'tal' && S.talent >= 5)) { sfx.no(); return false; } if (S.cash < cost) { sfx.no(); say('돈이 부족해', 1, 4000); return false; }
  S.cash -= cost; sfx.spend();
  if (what === 'rd') { S.rd += rdGain(); burst(0, 3, -8.3, 0x8cff5a, 10, 3); } else if (what === 'cap') { S.cap++; floatAt(0, 1, 4, '분기당 +1 재고', 'g'); } else { S.talent++; floatAt(0, 1, 4, '인재 +1', 'g'); }
  refresh(); checkRd(); return true;
}
function checkRd() { if (state === 'play' && !busy && !evt && S.rd >= 100) startKey(); }

// ---------- 발표회 ----------
function startKey() {
  const g = Math.max(0.07, 0.15 - 0.015 * S.gen); key = { t: rand(1), p: 0, a: 0.4, b: 0.7, c: 0.7 + g, sp: 0.75 + 0.1 * S.gen, stopped: false };
  state = 'key'; busy = true; camGoal = 1; sel = null; showSel(); chipInHand.visible = true;
  const z = (cls, l, r) => { const e = $('meter').querySelector(cls); e.style.left = l * 100 + '%'; e.style.width = (r - l) * 100 + '%'; }; z('.z1', 0, key.a); z('.z2', key.a, key.b); z('.z3', key.b, key.c); z('.z4', key.c, 1);
  $('mlab').innerHTML = [['성실', key.a / 2], ['과장', (key.a + key.b) / 2], ['전설', (key.b + key.c) / 2], ['망신', (key.c + 1) / 2]].map(([s, x]) => '<span style="left:' + x * 100 + '%">' + s + '</span>').join('');
  $('kT').innerHTML = '핵공장 ' + (S.gen + 1) + ' 세대 발표회<small>성능 향상폭은 당신이 정합니다</small>'; $('ktip').style.display = 'block'; $('key').style.display = 'block'; $('panel').style.display = 'none';
  sfx.fanfare(); say('그리고 한 가지 더', 2);
}
function stopKey() {
  if (!key || key.stopped || key.t < 0.35) return; key.stopped = true; $('ktip').style.display = 'none'; const p = key.p; let text, bad = false;
  if (p < key.a) { hypeAdd(0.05); text = '성실하게, 객석은 졸립다'; tone('triangle', 440, 440, 0.2, 0.1); }
  else if (p < key.b) { hypeAdd(0.2); text = '과감한 과장, 주가 상승'; sfx.take(); cheer = 1; say('많이 살수록 더 아낀다', 2); burst(0, 5, -8, [0x8cff5a, 0xffffff], 40, 6, 5, 1.4); }
  else if (p < key.c) { hypeAdd(0.4); epic++; text = '전원 기립!'; sfx.cheer(); cheer = 1.6; say('전원 기립', 3); for (let i = 0; i < 5; i++) burst(rand(-5, 5), rand(5, 8), -8, [0x8cff5a, 0xffffff, 0xffe27a, 0xff6a8a, 0x5aa8ff], 60, 6, 4, 2.2); }
  else { hypeAdd(-0.2); text = '너무 과장했다, 그 자리에서 망신'; bad = true; sfx.boo(); sad = 1.4; say('너무 부풀렸다', 3); }
  banner(text, 1.7, bad);
  later(1.8, () => { S.gen++; cos[0].gen = S.gen; S.rd -= 100; key = null; state = 'play'; busy = false; camGoal = 0; chipInHand.visible = false; $('key').style.display = 'none'; $('panel').style.display = 'block'; tiles.forEach((t) => { if (t.own === 0) t.bump = 0.5; }); banner('제 ' + S.gen + ' 세대 칩 출시', 1.3); drawScreen(); refresh(); checkRd(); });
}

// ---------- 이벤트 ----------
const EVENTS = [
  { t: '채굴 열풍', d: '채굴업자들이 트럭을 몰고 와 GPU 를 싹쓸이하려 합니다.', o: [{ b: '전부 채굴장에 판다', s: '현금 +20 억, 게이머 야유, 화제성 −0.1', f: () => { S.cash += 20; hypeAdd(-0.1); } }, { b: '1 인 1 개 제한, 게이머에게', s: '현금 +6 억, 평판 상승, 화제성 +0.1', f: () => { S.cash += 6; hypeAdd(0.1); } }] },
  { t: '수출 규제', d: '최상위 칩을 일부 시장에 팔 수 없게 됐습니다.', o: [{ b: '특별 공급판을 급히 만든다', s: '10 억 소모, 수입 영향 없음', c: 10, f: () => { S.cash -= 10; } }, { b: '받아들인다', s: '이번 분기 수입 30% 감소', f: () => { S.revMul = 0.7; } }] },
  { t: '파운드리 가격 인상', d: '파운드리가 첨단 라인이 인기라며 가격을 올립니다.', o: [{ b: '인상 수용', s: '12 억 소모', c: 12, f: () => { S.cash -= 12; } }, { b: '주문을 조금 줄인다', s: '재고 −3', f: () => { S.stock = Math.max(0, S.stock - 3); } }] },
  { t: '경쟁사의 인재 빼가기', d: '옆 회사가 연봉 3 배로 수석 아키텍트를 빼가려 합니다.', o: [{ b: '연봉을 올려 잡는다', s: '10 억 소모', c: 10, f: () => { S.cash -= 10; } }, { b: '보내준다', s: '연구 진행 −30', f: () => { S.rd = Math.max(0, S.rd - 30); } }] },
  { t: '주주들의 배당 요구', d: '주주들이 회사가 살아났으니 돈을 나누자고 합니다.', o: [{ b: '배당한다', s: '15 억 소모, 화제성 +0.15', c: 15, f: () => { S.cash -= 15; hypeAdd(0.15); } }, { b: '안 주고 연구에 쓴다', s: '화제성 −0.1, 연구 진행 +25', f: () => { hypeAdd(-0.1); S.rd += 25; } }] },
  { t: 'AI 열풍', d: '하룻밤 사이 모두가 연산을 노리고, 데이터센터는 내년까지 예약 찼습니다.', o: [{ b: 'AI 에 올인', s: 'AI 칸 수입 ×1.6, 게임용 GPU 칸 수입 30% 감소', f: () => { typeMul.AI *= 1.6; typeMul.GPU *= 0.7; } }, { b: '둘 다 챙긴다', s: 'AI 칸 수입 ×1.3', f: () => { typeMul.AI *= 1.3; } }] },
  { t: '커넥터 발화', d: '새 카드의 전원 커넥터가 녹았다는 글이 올라왔습니다.', o: [{ b: '전량 리콜', s: '12 억 소모, 화제성 +0.05', c: 12, f: () => { S.cash -= 12; hypeAdd(0.05); } }, { b: '사용자가 느슨하게 꽂았다고 한다', s: '비용 0, 화제성 −0.2', f: () => { hypeAdd(-0.2); } }] },
  { t: '경쟁사의 선공', d: '적토가 먼저 발표회를 열고 성능이 당신을 앞섰다고 합니다.', o: [{ b: '가격 인하로 맞선다', s: '이번 분기 수입 20% 감소, 경쟁사는 이번 분기 공격 못 함', f: () => { S.revMul = 0.8; S.truce = true; } }, { b: '망하길 기다린다', s: '50% 확률로 화제성 +0.2, 50% 확률로 −0.15', f: () => { if (Math.random() < 0.5) { hypeAdd(0.2); return '진짜로 망했다'; } hypeAdd(-0.15); return '망하지 않았다'; } }] },
  { t: '개발자 대회', d: '개발자들이 소프트웨어 도구를 더 잘 만들어 달라고 합니다.', o: [{ b: '생태계에 투자', s: '12 억 소모, 모든 구역 방어 +2', c: 12, f: () => { S.cash -= 12; owned(0).forEach((t) => { t.fort = Math.min(6, t.fort + 2); t.bump = 0.5; }); } }, { b: '나중에', s: '아무 변화 없음', f: () => {} }] },
  { t: '자동차 회사의 제안', d: '몇몇 완성차 업체가 자율주행 칩을 만들어 달라고 합니다.', o: [{ b: '받는다', s: '자동차 칸 수입 2 배, 재고 −2', f: () => { typeMul.CAR *= 2; S.stock = Math.max(0, S.stock - 2); } }, { b: '거절하고 본업에 집중', s: '연구 진행 +30', f: () => { S.rd += 30; } }] },
];
function showEvent() {
  evt = evDeck.pop(); if (!evt) return; sel = null; showSel(); sfx.event();
  $('eT').innerHTML = '<small>제 ' + S.q + ' 분기 · 돌발</small>' + evt.t; $('eD').textContent = evt.d;
  $('eB').innerHTML = evt.o.map((o, i) => { const ok = !o.c || S.cash >= o.c; return '<button data-ev="' + i + '"' + (ok ? '' : ' style="opacity:.45"') + '>' + o.b + '<small>' + o.s + (ok ? '' : '(자금 부족)') + '</small></button>'; }).join('');
  $('event').style.display = 'flex';
}
function choose(i) {
  if (!evt) return false; const o = evt.o[i]; if (!o || (o.c && S.cash < o.c)) { sfx.no(); return false; }
  const extra = o.f(); evt = null; $('event').style.display = 'none'; sfx.spend(); banner(extra || o.b, 1.2); refresh(); checkRd(); return true;
}

// ---------- 턴 정산 ----------
function rivalAct(i) {
  const c = cos[i], mine = owned(i); if (!mine.length) return;
  const pow = 2 * c.gen + 2 + S.q * 0.12, cand = [...new Set(mine.flatMap((t) => t.nb))].filter((n) => n.own !== i && !n.lock && !(S.truce && n.own === 0)); if (!cand.length) return;
  let sum = 0; const w = cand.map((n) => { const k = (inc(n) + 1) / (defOf(n) + 1) * (defOf(n) <= pow + 2.5 ? 1 : 0.08) * (n.own === 0 ? 0.5 : 1); sum += k; return k; }); let x = rand(sum), n = cand[0];
  for (let k = 0; k < cand.length; k++) { x -= w[k]; if (x <= 0) { n = cand[k]; break; } }
  const win = pow + rand(0, 3) > defOf(n), from = n.nb.find((t) => t.own === i); n.lock = true;
  shoot(from, n, c.color, () => {
    n.lock = false; ringFx(n.x, n.z, c.color);
    if (!win) { burst(n.x, 1, n.z, 0xffffff, 10, 3); sfx.clash(); n.bump = 0.3; if (n.own === 0) floatAt(n.x, 1.2, n.z, '막아냄', 'g'); return; }
    const mineLost = n.own === 0; setOwner(n, i); burst(n.x, 1, n.z, c.color, 24);
    if (mineLost) { lostN++; sad = 1; sfx.lost(); floatAt(n.x, 1.2, n.z, c.name.slice(0, 2) + '에게 뺏김', 'bad'); banner(c.name + '가 내 ' + TYPE[n.type] + ' 을 뺏었다', 1.3, true); say('구역을 뺏겼다', 2, 5000); if (sel === n) sel = null; } else sfx.clash();
    refresh();
  });
}
function endTurn() {
  if (busy || state !== 'play' || evt) return; busy = true; sel = null; showSel();
  const rev = revenue(); S.revMul = 1; S.cash += rev; sfx.coin(); owned(0).forEach((t) => { floatAt(t.x, 1, t.z, '+' + inc(t)); t.bump = 0.35; });
  let d = 0.75; const acts = S.q >= 4 ? 2 : 1;
  for (let k = 0; k < acts; k++) for (const i of [1, 2, 3]) if (owned(i).length) { later(d, () => rivalAct(i)); d += 0.42; }
  later(d + 0.5, nextQuarter); refresh();
}
function nextQuarter() {
  S.truce = false; S.q++; S.stock += S.cap; S.hype = +(S.hype + (1 - S.hype) * 0.3).toFixed(2); hist.push([0, 1, 2, 3].map(mcap));
  if (!owned(0).length) return endGame(true); if (S.q > QUARTERS) return endGame(false);
  for (const i of [1, 2, 3]) if (owned(i).length && cos[i].ups.includes(S.q)) { cos[i].gen++; banner(cos[i].name + '가 제 ' + cos[i].gen + ' 세대 출시', 1.4, true); owned(i).forEach((t) => { t.bump = 0.5; }); }
  busy = false; floatAt(0, 1, 4.5, '입고 +' + S.cap, 'g'); drawScreen(); refresh();
  if (EVENT_Q.includes(S.q)) showEvent(); else checkRd();
  if (S.q === QUARTERS) banner('마지막 분기', 1.4);
}
function endGame(fired) {
  state = 'over'; busy = false; const r = rankOf(), m = mcap(0); sel = null; key = null; camGoal = 0;
  result = fired ? { cls: 'red', title: '두 번째 해고', line: '구역을 다 잃고 이사회가 밤새 회의' } : r === 1 && m >= 10000 ? { cls: 'gold', title: '조 단위 제국', line: '시총 1 조 돌파, 가죽재킷은 전설이 됐다' } : r === 1 ? { cls: '', title: '왕의 귀환', line: '시총 1 위 탈환, 이사회 기립 박수' }
    : r === 2 ? { cls: '', title: '아깝다', line: '2 위, 이사회가 한 임기를 더 준다고 합니다' } : r === 3 ? { cls: 'red', title: '어중간하다', line: '3 위, 이사회가 새 사람을 찾기 시작합니다' } : { cls: 'red', title: '두 번째 해고', line: '시총은 여전히 꼴찌, 재킷만 남기고 사람은 떠남' };
  if (!auto && m > best) { best = m; try { localStorage.setItem('echo_chip_best', '' + best); } catch (e) { /* 무시 */ } }
  if (r === 1 && !fired) { sfx.win(); say('왕의 귀환', 5); cheer = 2; } else if (result.cls === 'red') { sfx.over(); say('또 쫓겨났다', 5); sad = 2; }
  $('event').style.display = 'none'; $('key').style.display = 'none'; $('panel').style.display = 'block'; drawScreen(); showScreen();
}
function newGame() {
  state = 'play'; busy = false; evt = null; key = null; sel = null; laters = []; hist = []; epic = grabbed = lostN = 0; wasFirst = false; camGoal = 0; result = null;
  S = { q: 1, cash: 30, gen: 1, rd: 0, cap: 3, stock: 4, talent: 1, hype: 1, revMul: 1, truce: false };
  cos = COS.map((c) => ({ ...c, gen: c.gen0 || 1 })); typeMul = { GPU: 1, PC: 1, CAR: 1, PHONE: 1, AI: 1 };
  for (const t of tiles) { t.own = -1; t.fort = 0; t.lock = false; t.bump = 0.4; }
  MY_HOME.forEach(([q, r]) => { byKey[q + ',' + r].own = 0; }); for (let i = 1; i < 4; i++) COS[i].home.forEach(([q, r]) => { byKey[q + ',' + r].own = i; });
  evDeck = EVENTS.slice().sort(() => Math.random() - 0.5); for (const s of shots) scene.remove(s.m); shots.length = 0;
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'chip'; (h.played = h.played || {}).chip = k; h.last = 'chip'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
  hist.push([0, 1, 2, 3].map(mcap)); $('event').style.display = 'none'; $('key').style.display = 'none'; $('panel').style.display = 'block';
  showScreen(); drawScreen(); refresh(); banner('제 1 분기', 1.2); say(pick(['돌아왔다', '가죽재킷 입고, 시작']), 2); cheer = 1;
}

// ---------- 자동 플레이(자동 테스트용) ----------
let botAcc = 0.6;
function bot() {
  if (evt) { const ok = evt.o.map((o, i) => i).filter((i) => !evt.o[i].c || S.cash >= evt.o[i].c); choose(pick(ok)); return; }
  if (state === 'key') { if (key && !key.stopped && key.t > 0.5) { const good = key.p >= key.a && key.p < key.c; if (Math.random() < botAcc ? good : Math.random() < 0.04) stopKey(); } return; }
  if (busy) return;
  if (S.talent < 3 && S.q <= 4 && S.cash >= talCost() + rdCost()) return void buy('tal');
  if (S.cash >= rdCost()) return void buy('rd');
  const tg = tiles.filter((t) => t.own !== 0 && !t.lock && reach(t) && atkCost(t) <= S.stock).sort((a, b) => inc(b) / atkCost(b) - inc(a) / atkCost(a))[0]; if (tg) return void attack(tg);
  const weak = owned(0).filter((t) => t.fort < 2 && t.nb.some((n) => n.own > 0))[0]; if (weak && S.stock >= 1) return void fortify(weak);
  endTurn();
}

// ---------- 매 프레임 ----------
const camA = new THREE.Vector3(), camB = new THREE.Vector3(), lookA = new THREE.Vector3(), lookB = new THREE.Vector3();
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  cheer = Math.max(0, cheer - dt * 0.9); sad = Math.max(0, sad - dt * 0.7); talk = Math.max(0, talk - dt * 0.8); camK += (camGoal - camK) * Math.min(1, dt * 4);
  for (let i = laters.length - 1; i >= 0; i--) { const l = laters[i]; l.t -= dt; if (l.t <= 0) { laters.splice(i, 1); l.fn(); } }
  for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.t += dt / 0.3; if (s.t < 0) continue; const k = Math.min(1, s.t); s.m.position.set(s.a.x + (s.b.x - s.a.x) * k, 1 + Math.sin(k * Math.PI) * 2.2, s.a.z + (s.b.z - s.a.z) * k); s.m.rotation.y += dt * 14; s.m.rotation.x += dt * 9; if (s.t >= 1) { scene.remove(s.m); s.m.material.dispose(); shots.splice(i, 1); if (s.done) s.done(); } }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt * 2.2; r.m.scale.setScalar(1 + r.t * 2.4); r.m.material.opacity = 0.9 * (1 - r.t); if (r.t >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); } }
  for (let k = 0; k < PN; k++) { if (pLife[k] <= 0) continue; pLife[k] -= dt; pVel[k * 3 + 1] -= pGrav[k] * dt; pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt; if (pLife[k] <= 0) pPos[k * 3 + 1] = -999; }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  for (const t of tiles) t.bump = Math.max(0, t.bump - dt * 2.4);
  if (key && !key.stopped) { key.t += dt; const u = (key.t * key.sp) % 2; key.p = u < 1 ? u : 2 - u; }
  if (auto && (state === 'play' || state === 'key')) { botT += dt; if (botT > 0.12) { botT = 0; bot(); } }
}
function draw() {
  const now = performance.now() / 1000, far = clamp(0.6 / camera.aspect, 1.2, 1.6);
  camA.set(0, 19 * far, 11.5 * far + 1); lookA.set(0, 0, -1.3); camB.set(0, 4.6, 4.2 * far); lookB.set(0, 3.7, -9); const k = camK * camK * (3 - 2 * camK);
  camera.position.lerpVectors(camA, camB, k); v3.lerpVectors(lookA, lookB, k); camera.lookAt(v3);
  for (const t of tiles) { const want = t.own === 0 ? 0.75 : t.own > 0 ? 0.55 : 0.28, can = S && state === 'play' && !busy && t.own !== 0 && reach(t) && atkCost(t) <= S.stock; t.h += (want - t.h) * 0.2; const h = t.h + Math.sin(t.bump * Math.PI) * 0.7 + (can ? (Math.sin(now * 4 + t.x) + 1) * 0.06 : 0); t.side.scale.y = h; t.side.position.y = h / 2; t.top.position.y = h + 0.005; }
  if (sel) { selRing.position.set(sel.x, sel.side.scale.y + 0.03, sel.z); selRing.material.opacity = 0.6 + Math.sin(now * 8) * 0.3; }
  // 황 사장의 동작: 평소엔 흔들리고, 구역을 뺏으면 손을 들고, 잃으면 고개를 숙이고, 발표회엔 칩을 들어 올림
  const kk = key ? 1 : 0, up = Math.min(1, cheer);
  boss.position.y = 0.5 + Math.abs(Math.sin(now * (2 + up * 6))) * (0.03 + up * 0.25); torso.rotation.x = Math.min(1, sad) * 0.35; head.rotation.x = Math.min(1, sad) * 0.4; head.rotation.y = Math.sin(now * 0.8) * 0.2 * (1 - kk); torso.rotation.y = Math.sin(now * 1.3) * 0.12;
  arms[0].rotation.z = -(0.14 + up * 2.6 + Math.sin(now * 9) * 0.2 * up); arms[1].rotation.z = 0.14 + Math.max(up * 2.6, kk * 2.2) + Math.sin(now * 9 + 1) * 0.2 * up; arms[1].rotation.x = -kk * 0.5; mouth.scale.y = 1 + talk * (1 + Math.sin(now * 22)) * 2;
  spots.forEach((s, i) => { s.rotation.z = Math.sin(now * (0.7 + kk * 1.6) + i * 1.7) * (0.35 + kk * 0.3); s.material.opacity = 0.12 + kk * 0.2 + up * 0.1; }); stageLight.intensity = 8 + kk * 14 + up * 8;
  if (key) { $('meter').lastElementChild.style.left = key.p * 100 + '%'; $('brag').textContent = '"성능 ' + (1 + key.p * 9).toFixed(1) + ' 배 향상!"'; if (!key.stopped) drawScreen(); }
  composer.render();
}
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); }

// ---------- 입력 ----------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || state !== 'play' || auto || evt) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 12) return;
  const b = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(picks)[0], t = hit && hit.object.userData.tile; if (!t) return select(null);
  if (t === sel) tileAct(); else select(t);                              // 두 번 누르면 바로 행동
});
$('tBtn').addEventListener('click', () => { if (!auto) tileAct(); });
$('bRd').addEventListener('click', () => { if (!auto) buy('rd'); }); $('bCap').addEventListener('click', () => { if (!auto) buy('cap'); }); $('bTal').addEventListener('click', () => { if (!auto) buy('tal'); }); $('bNext').addEventListener('click', () => { if (!auto) endTurn(); });
$('eB').addEventListener('click', (e) => { const b = e.target.closest('[data-ev]'); if (b && !auto) choose(+b.dataset.ev); });
$('key').addEventListener('pointerdown', () => { if (!auto) stopKey(); });
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') newGame(); });
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') muted = !muted; if (state === 'title' || state === 'over') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); initAudio(); newGame(); } return; } if (auto) return;
  if (state === 'key') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); stopKey(); } return; }
  if (evt) { if (e.code === 'Digit1') choose(0); if (e.code === 'Digit2') choose(1); return; }
  if (e.code === 'KeyR') buy('rd'); if (e.code === 'KeyC') buy('cap'); if (e.code === 'KeyT') buy('tal'); if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); endTurn(); }
});
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); drawScreen(); showScreen(); requestAnimationFrame(frame);

// 디버그 입구
window.__chip = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on, acc) { auto = on; if (acc !== undefined) botAcc = acc; },
  buy, attack: (q, r) => attack(byKey[q + ',' + r]), fortify: (q, r) => fortify(byKey[q + ',' + r]), select: (q, r) => select(byKey[q + ',' + r]), endTurn, choose, stopKey, startKey, set(o) { Object.assign(S, o); cos[0].gen = S.gen; refresh(); },
  get key() { return key && { p: +key.p.toFixed(2), a: key.a, b: key.b, c: +key.c.toFixed(2) }; }, get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return S && { state, busy, ...S, evt: evt && evt.t, mine: owned(0).length, tiles: [1, 2, 3].map((i) => owned(i).length), gens: cos.map((c) => c.gen), income: income(0), caps: [0, 1, 2, 3].map(mcap), rank: rankOf(), epic, grabbed, lost: lostN }; },
};
