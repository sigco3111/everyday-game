// 《메아리: 야시장 고리 던지기》—— 세로 화면: 눌러서 위로 끌면 조준(바닥에 낙하점 원), 놓으면 고리를 던짐. 멀수록 비싸고 걸기 어려움. 고리를 다 쓰면 철수.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;   // 대략 -1 에서 1, 가운데가 많음
// 노점: x ∈ [-MW, MW], z 는 -2(가장 가까움)부터 -FAR(가장 멂); 사람은 z = 4 에 서서 앞으로 던짐
const MW = 5, FAR = 15, RING_R = 1.05, START_RINGS = 12;

// ---------- 렌더링 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0f1a); scene.fog = new THREE.Fog(0x0d0f1a, 30, 60);
const camera = new THREE.PerspectiveCamera(50, 0.6, 0.5, 120);
const CAM = new THREE.Vector3(0, 16.5, 12.5), LOOK = new THREE.Vector3(0, 0, -6.2);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.85)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.fov = W / H < 0.5 ? 58 : 52; camera.updateProjectionMatrix(); }
scene.add(new THREE.HemisphereLight(0xfff0d8, 0x30364a, 0.75));
const lamp = new THREE.DirectionalLight(0xffe2b0, 1.25); lamp.position.set(-5, 16, 6); lamp.target.position.set(0, 0, -8); scene.add(lamp, lamp.target);
lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); Object.assign(lamp.shadow.camera, { left: -12, right: 12, top: 14, bottom: -12, near: 2, far: 50 }); lamp.shadow.bias = -0.002;
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sph = (r) => new THREE.SphereGeometry(r, 18, 12), cyl = (a, b, h, n = 18) => new THREE.CylinderGeometry(a, b, h, n);
function mk(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
// 야시장: 시멘트 바닥, 붉은 천 노점, 뒤의 간판, 전구 줄, 주인
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), L(0x2a2d38)); g.rotation.x = -Math.PI / 2; g.position.y = -0.03; g.receiveShadow = true; scene.add(g);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#b3262a'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#a01f24'; for (let i = 0; i < 8; i++) x.fillRect(i * 32, 0, 16, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MW * 2 + 1.5, FAR), L(0xffffff, { map: t })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -1.5 - FAR / 2 + 0.6); m.receiveShadow = true; scene.add(m);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(MW * 2 + 1.5, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe27a })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.02, 1.2); scene.add(line);   // 서는 자리 선
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; const s = sc.getContext('2d'); s.fillStyle = '#ffd23a'; s.fillRect(0, 0, 512, 128); s.fillStyle = '#c41f1f'; s.font = '900 76px "Noto Sans KR", sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle'; s.fillText('고리 던지기 10원에 12개', 256, 68);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc) })); sign.position.set(0, 4.6, -FAR - 2.2); scene.add(sign);
  mk(scene, box(14, 9, 0.3), L(0x1c2440), 0, 4.5, -FAR - 2.6);
  const bulb = new THREE.SphereGeometry(0.22, 10, 8);
  for (let i = 0; i < 13; i++) { const col = [0xffd66e, 0xff7a6a, 0x7fe3ff, 0x9bf08a][i % 4], b = new THREE.Mesh(bulb, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6) })); b.position.set(-7.2 + i * 1.2, 7.0 - Math.sin(i / 12 * Math.PI) * 0.8, -FAR - 1.6); scene.add(b); }
}
function person(shirt, skin, hair, s = 1) { const g = new THREE.Group(); mk(g, new THREE.CapsuleGeometry(1, 1, 6, 12), L(shirt), 0, 2.0, 0, 0.85, 0.75, 0.6); const head = new THREE.Group(); head.position.y = 3.6; g.add(head); mk(head, sph(1), L(skin), 0, 0, 0, 0.72, 0.76, 0.72); mk(head, new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), L(hair), 0, 0.06, -0.06, 0.76, 0.78, 0.78); for (const x of [-0.27, 0.27]) { mk(head, sph(1), L(0xffffff), x, 0.05, 0.62, 0.16, 0.18, 0.1); mk(head, sph(1), L(0x111111), x, 0.05, 0.7, 0.08, 0.09, 0.06); } g.userData.head = head; g.scale.setScalar(s); return g; }
const boss = person(0x2f7f5a, 0xe8b88c, 0x222222, 1.25); boss.position.set(MW + 1.3, 0, -14.5); boss.rotation.y = -0.6; scene.add(boss);

// ---------- 경품 모델 ----------
const P = (g) => { const o = new THREE.Group(); g(o); return o; };
const MAKE = {
  duck: () => P((o) => { mk(o, sph(0.42), L(0xffd21a), 0, 0.4, 0, 1, 0.85, 1.15); mk(o, sph(0.27), L(0xffd21a), 0, 0.86, 0.2); mk(o, new THREE.ConeGeometry(0.1, 0.24, 8), L(0xff7a1a), 0, 0.84, 0.5, 1, 1, 1, Math.PI / 2); }),
  soap: () => P((o) => { mk(o, box(0.72, 0.3, 0.5), L(0xff9fd2), 0, 0.15, 0); mk(o, box(0.5, 0.06, 0.3), L(0xffd0e8), 0, 0.33, 0); }),
  drink: () => P((o) => { mk(o, cyl(0.26, 0.28, 0.95), L(0x2fb86a), 0, 0.48, 0); mk(o, cyl(0.12, 0.2, 0.25), L(0x2fb86a), 0, 1.06, 0); mk(o, cyl(0.13, 0.13, 0.1), L(0xffffff), 0, 1.22, 0); mk(o, cyl(0.285, 0.285, 0.36), L(0xffe27a), 0, 0.5, 0); }),
  fan: () => P((o) => { mk(o, cyl(0.34, 0.4, 0.14), L(0x3f8fd0), 0, 0.07, 0); mk(o, cyl(0.06, 0.06, 0.7, 8), L(0xe8eef2), 0, 0.45, 0); mk(o, cyl(0.5, 0.5, 0.12, 20), L(0x7fc8ff), 0, 0.95, 0, 1, 1, 1, Math.PI / 2); }),
  bear: () => P((o) => { const b = L(0xb07a44); mk(o, sph(0.55), b, 0, 0.55, 0, 1, 1.05, 0.9); mk(o, sph(0.4), b, 0, 1.3, 0); for (const x of [-0.3, 0.3]) mk(o, sph(0.15), b, x, 1.65, 0); mk(o, sph(0.16), L(0xf0d8b0), 0, 1.22, 0.33); mk(o, sph(0.05), L(0x111111), 0, 1.27, 0.48); }),
  card: () => P((o) => { mk(o, cyl(0.46, 0.46, 0.12, 22), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.85, 0.2) }), 0, 0.5, 0, 1, 1, 1, Math.PI / 2); mk(o, cyl(0.05, 0.05, 0.5, 6), L(0xffffff), 0, 0.2, 0); }),
  wine: () => P((o) => { mk(o, cyl(0.3, 0.32, 0.85), L(0xf8f8f8), 0, 0.43, 0); mk(o, cyl(0.12, 0.26, 0.3), L(0xf8f8f8), 0, 1.0, 0); mk(o, cyl(0.13, 0.13, 0.2), L(0xd02a2a), 0, 1.25, 0); mk(o, cyl(0.325, 0.325, 0.3), L(0xd02a2a), 0, 0.45, 0); }),
  goose: () => P((o) => { const w = L(0xffffff); mk(o, sph(0.6), w, 0, 0.75, 0, 0.9, 0.85, 1.3); mk(o, cyl(0.13, 0.17, 0.95, 10), w, 0, 1.5, 0.5, 1, 1, 1, 0.25); mk(o, sph(0.22), w, 0, 2.05, 0.66); mk(o, new THREE.ConeGeometry(0.1, 0.34, 8), L(0xff8a1a), 0, 2.03, 0.95, 1, 1, 1, Math.PI / 2); mk(o, sph(0.1), L(0xff8a1a), 0, 2.22, 0.74); for (const x of [-0.22, 0.22]) mk(o, cyl(0.05, 0.05, 0.35, 6), L(0xff8a1a), x, 0.17, 0); }),
  cooker: () => P((o) => { mk(o, cyl(0.82, 0.78, 0.9, 24), L(0xf2f2f2), 0, 0.45, 0); mk(o, sph(0.82), L(0xe04a3a), 0, 0.9, 0, 1, 0.42, 1); mk(o, cyl(0.14, 0.14, 0.16), L(0x222222), 0, 1.3, 0); }),
  gold: () => P((o) => { const g = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.8, 0.15) }); mk(o, box(1.0, 0.35, 0.5), g, 0, 0.18, 0); mk(o, box(0.8, 0.2, 0.36), g, 0, 0.45, 0); }),
  bike: () => P((o) => { mk(o, box(0.5, 0.6, 2.0), L(0x2f7fd8), 0, 0.85, 0); mk(o, box(0.6, 0.2, 0.9), L(0x222222), 0, 1.25, -0.4); mk(o, box(1.1, 0.1, 0.1), L(0x222222), 0, 1.7, 0.85); mk(o, cyl(0.06, 0.06, 0.9, 6), L(0x888888), 0, 1.25, 0.85); for (const z of [-0.85, 0.85]) mk(o, cyl(0.42, 0.42, 0.22, 18), L(0x151515), 0, 0.42, z, 1, 1, 1, 0, Math.PI / 2); }),
};
// 경품: 이름, 가치, 받침 반경(클수록 걸기 어려움), 몇 번째 줄인지, 움직이는지
const KINDS = {
  duck: { name: '노란 오리', v: 2, r: 0.5, row: 0 }, soap: { name: '비누', v: 3, r: 0.46, row: 0 }, drink: { name: '음료수', v: 5, r: 0.36, row: 1 }, fan: { name: '미니 선풍기', v: 12, r: 0.52, row: 1 },
  bear: { name: '곰인형', v: 18, r: 0.62, row: 1 }, card: { name: '고리 3개 증정', v: 0, r: 0.5, row: 1, rings: 3 }, wine: { name: '좋은 술', v: 50, r: 0.4, row: 2, dodge: 1 }, goose: { name: '큰 거위', v: 80, r: 0.66, row: 2, walk: 1 },
  cooker: { name: '전기밥솥', v: 60, r: 0.86, row: 2, dodge: 1 }, gold: { name: '금괴', v: 150, r: 0.72, row: 3, slide: 1 }, bike: { name: '전동 스쿠터', v: 500, r: 1.0, row: 3, s: 1.5 },
};
const ROW_Z = [-3.4, -6.8, -10.3, -13.6];

// ---------- 고리 ----------
const RING_COL = [0xff5a5a, 0xffd23a, 0x4ad0ff, 0x7be36a, 0xff8fe0];
const ringGeo = new THREE.TorusGeometry(RING_R, 0.075, 8, 40);
const rings = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial({ color: RING_COL[i % 5], emissive: new THREE.Color(RING_COL[i % 5]).multiplyScalar(0.25) })); m.castShadow = true; m.visible = false; scene.add(m); return { m, on: false }; });
// 조준: 바닥의 낙하점 원 + 포물선 점 줄
const aimRing = new THREE.Mesh(new THREE.RingGeometry(RING_R - 0.09, RING_R + 0.05, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false })); aimRing.rotation.x = -Math.PI / 2; aimRing.renderOrder = 5; aimRing.visible = false; scene.add(aimRing);
const dots = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: false })); m.renderOrder = 5; m.visible = false; scene.add(m); return m; });
const handRing = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 })); handRing.position.set(0, 2.2, 4.6); handRing.rotation.x = Math.PI / 2 - 0.5; scene.add(handRing);
// 작은 파티클: 걸리면 색종이 한 줌
const PMAX = 600, pPos = new Float32Array(PMAX * 3).fill(-999), pVel = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX); let pNext = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, depthWrite: false })); pPoints.frustumCulled = false; scene.add(pPoints);
function confetti(x, y, z, n) { for (let k = 0; k < n; k++) { const i = pNext; pNext = (pNext + 1) % PMAX; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = rand(-4, 4); pVel[i * 3 + 1] = rand(4, 11); pVel[i * 3 + 2] = rand(-4, 4); const c = new THREE.Color(pick(RING_COL)); pCol[i * 3] = c.r * 1.3; pCol[i * 3 + 1] = c.g * 1.3; pCol[i * 3 + 2] = c.b * 1.3; pLife[i] = rand(0.6, 1.2); } }
function updateParticles(dt) { for (let i = 0; i < PMAX; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; } pVel[i * 3 + 1] -= 18 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; } pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true; }

// ---------- 상태 ----------
let state = 'title', held = false, auto = false, muted = false;
let time = 0, money = 0, left = START_RINGS, streak = 0, bestStreak = 0, wins = 0, wave = 1, wind = 0, shake = 0, hurt = 0, bannerT = 0, cool = 0, lastMsg = '', botT = 0, tipT = 0, endT = 0, haul = {};
let best = 0; try { best = +localStorage.getItem('echo_ring_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
let prizes = [], flying = [];
const aim = { on: false, sx: 0, sy: 0, x: 0, z: -6, ok: false };

// ---------- 소리 ----------
let ac = null, master = null, noiseBuf = null; const lastSfx = {};
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function hiss(dur, vol, f0, f1) { if (!ac || muted) return; const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, rand(0.5), dur + 0.05); }
const sfx = {
  throw: () => hiss(0.22, 0.2, 900, 2600),
  land: () => { tone('triangle', 700, 300, 0.07, 0.1); },
  clank: () => { tone('square', 1300, 900, 0.06, 0.1); tone('triangle', 2100, 1500, 0.1, 0.08, 0.02); },   // 쨍 — 경품에 맞고 튕김
  win: (v) => { const n = v >= 50 ? 5 : 3; for (let i = 0; i < n; i++) tone('triangle', 660 * 1.26 ** i, 660 * 1.26 ** i, 0.15, 0.15, i * 0.07); },
  honk: () => { tone('sawtooth', 420, 330, 0.16, 0.16); tone('sawtooth', 380, 300, 0.22, 0.16, 0.18); },   // 거위 울음
  ringsUp: () => [880, 1100, 1320].forEach((f, i) => tone('sine', f, f, 0.12, 0.12, i * 0.06)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
};
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '자 자, 고리 던지기': '来来来，套圈', '아이고 발 미끄러졌네': '哎呀脚滑了', '손해다 손해': '亏本了亏本了', '손쓰임이 좋은데요': '手气可以哦', '걸렸다': '套中了', '아깝다': '差一点点', '또 와 또 와': '再来再来', '장사 끝': '收摊了' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[VOICE[text] || text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text); sayLast[text] = now;
  if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

// ---------- 화면 ----------
function banner(text, sec = 1.3) { $('banner').textContent = text; bannerT = sec; }
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  if (state === 'title') s.innerHTML = '<h1>야시장 고리 던지기</h1><div class="sub">메아리 · 제 8 기</div><div class="help"><b>눌러서 위로 끄는 것</b>이 조준, 바닥의 원이 낙하점<br><b>놓으면</b> 고리를 던져서 경품에 걸리면 내 것<br>멀수록 비싸고, 받침이 클수록 걸기 어렵습니다<br>거위는 걸어다니고, 금괴는 미끄러지고, 주인은 "발이 미끄러지기"도 합니다<br>연속 2개 성공마다 고리 1개 보너스, 노점 대부분을 털면 주인이 새로 진열하며 4개 보너스<br>고리를 다 쓰면 철수</div>' +
    (best ? '<div class="sub" style="margin-top:12px">최고 획득 ₩' + best + '</div>' : '') + '<button class="go" data-act="start">고리 12 개</button>';
  else { const list = Object.keys(haul).sort((a, b) => KINDS[b].v - KINDS[a].v).map((k) => KINDS[k].name + ' ×' + haul[k]).join(', ') || '아무것도 못 건졌습니다'; s.innerHTML = '<h1 class="red">장사 끝</h1><div class="sub">획득 가치 ₩' + money + '　최다 연속 ' + bestStreak + '<br><span style="font-size:13px">' + list + '</span><br>최고 획득 ₩' + best + '</div><button class="go" data-act="start">고리 12개 더</button>'; }
}
function hud() {
  $('money').textContent = '¥' + money; $('clock').textContent = left; $('bad').textContent = streak;
  const tb = $('tbar'), w = Math.round(Math.abs(wind) * 3); tb.firstChild.style.width = '0%'; $('ttxt').textContent = w ? '바람 ' + (wind > 0 ? '→'.repeat(w) : '←'.repeat(w)) + '　고리가 밀립니다' : '바람 없음';
  $('name').textContent = lastMsg; $('flow').innerHTML = '';
  $('tip').textContent = tipT < 6 && wins === 0 ? '눌러서 위로 끌어 조준하고 놓아서 던지세요' : '';
  $('hurt').style.opacity = hurt.toFixed(2); $('foam').style.opacity = 0;
}

// ---------- 노점 차리기 ----------
function addPrize(kind, x, z) { const d = KINDS[kind], g = MAKE[kind](); g.scale.setScalar(d.s || 1); g.position.set(x, 0, z); scene.add(g); const p = { kind, d, g, x, z, x0: x, r: d.r, t: rand(6), on: true, vx: d.walk ? pick([-1, 1]) * 1.1 : 0, kick: 0, ph: rand(6) }; prizes.push(p); return p; }
function clearStall() { for (const p of prizes) scene.remove(p.g); prizes = []; }
function stock() {                                                  // 주인이 진열: 줄마다 몇 개씩, 뒤 웨이브일수록 멀리 좋은 것이 많고 더 잘 움직임
  clearStall();
  const rows = [['duck', 'soap', 'duck', 'soap'], ['drink', 'fan', 'bear', 'card', 'drink'], ['wine', 'goose', 'cooker'], ['gold', 'bike']];
  rows.forEach((ks, r) => { const n = ks.length, list = [...ks].sort(() => Math.random() - 0.5); list.forEach((k, i) => { const span = MW - 1.2 - (r === 3 ? 1 : 0); addPrize(k, -span + (n === 1 ? span : i * 2 * span / (n - 1)) + rand(-0.3, 0.3), ROW_Z[r] + rand(-0.5, 0.5)); }); });
  wind = wave >= 2 ? clamp(rand(-1, 1) * Math.min(1, 0.35 + wave * 0.15), -1, 1) : 0;
}
function landPoint(tx, tz) { const dist = 4 - tz; return [tx + wind * dist * 0.075, tz]; }   // 바람이 고리를 한쪽으로 밀고, 멀수록 더 밀림
function throwRing(tx, tz) {
  if (left <= 0 || cool > 0) return; left--; cool = 0.28; sfx.throw();
  const dist = 4 - tz, sc = 0.1 + dist * 0.02 + Math.min(0.12, wave * 0.012), [lx, lz] = landPoint(tx, tz), x1 = lx + gauss() * sc, z1 = lz + gauss() * sc * 1.2;
  const r = rings.find((q) => !q.on) || rings[0]; r.on = true; r.m.visible = true; r.m.material.opacity = 1; r.m.material.transparent = false;
  flying.push({ r, x0: 0, z0: 3.4, x1, z1, t: 0, T: 0.5 + dist * 0.035, h: 2.6 + dist * 0.22, st: 'fly', spin: rand(6), life: 0 });
  for (const p of prizes) if (p.on && p.d.dodge && Math.hypot(p.x - x1, p.z - z1) < 0.55 && Math.random() < 0.22 + wave * 0.02) { p.kick = (p.x > x1 ? 1 : -1) * rand(0.6, 0.9); say('아이고 발 미끄러졌네', 2, 6000); }   // 주인의 "발 미끄러짐": 걸릴 듯하면 경품이 움직임
}
function resolve(f) {                                               // 고리 착지: 성공 / 맞고 튕김 / 빗나감
  let hit = null, near = null, nd = 1e9;
  for (const p of prizes) { if (!p.on) continue; const d = Math.hypot(p.x - f.x1, p.z - f.z1); if (d < RING_R - p.r * 0.92) { hit = p; break; } if (d < nd) { nd = d; near = p; } }
  if (hit) {
    hit.on = false; hit.win = 0; f.st = 'won'; f.p = hit; wins++; streak++; bestStreak = Math.max(bestStreak, streak); money += hit.d.v; haul[hit.kind] = (haul[hit.kind] || 0) + 1; sfx.win(hit.d.v); confetti(hit.x, 1.2, hit.z, hit.d.v >= 50 ? 60 : 24); if (hit.d.walk) sfx.honk();
    lastMsg = '성공: ' + hit.d.name + (hit.d.v ? '　+₩' + hit.d.v : ''); banner(hit.d.name + (hit.d.v ? '　+₩' + hit.d.v : ''), 1.4); if (hit.d.v >= 50) { shake = 0.8; say('손해다 손해', 3); } else say(pick(['손쓰임이 좋은데요', '걸렸다']), 1, 2500);
    if (hit.d.rings) { left += hit.d.rings; sfx.ringsUp(); }
    if (streak > 0 && streak % 2 === 0) { left += 1; sfx.ringsUp(); banner('연속 ' + streak + ' 개　고리 1개 보너스', 1.4); }
    if (prizes.filter((p) => p.on).length <= 6) { wave++; restockT = 1.2; }
  } else {
    streak = 0; const touch = near && nd < RING_R + near.r;
    if (touch) { f.st = 'bounce'; f.vx = (f.x1 - near.x) / (nd || 1) * 2.4; f.vz = (f.z1 - near.z) / (nd || 1) * 2.4; f.vy = 4; f.y = near.d.walk ? 1.2 : 0.6; sfx.clank(); lastMsg = near.d.name + '에 맞고 튕겨 나감'; if (nd < RING_R - near.r * 0.92 + 0.3) { say('아깝다', 1, 2500); banner('아깝다', 0.8); } if (near.d.walk) sfx.honk(); }
    else { f.st = 'rest'; sfx.land(); lastMsg = '빗나감'; }
  }
}
let restockT = 0;
function endGame() { state = 'over'; sfx.over(); if (money > best) { best = money; try { localStorage.setItem('echo_ring_best', '' + best); } catch (e) { /* 무시 */ } } say('장사 끝', 5); aim.on = false; showScreen(); }
function newGame() {
  state = 'play'; time = money = streak = bestStreak = wins = shake = hurt = bannerT = cool = tipT = endT = restockT = 0; left = START_RINGS; wave = 1; haul = {}; lastMsg = '';
  for (const f of flying) { f.r.on = false; f.r.m.visible = false; } flying = []; stock();
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'ring'; (h.played = h.played || {}).ring = k; h.last = 'ring'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
  sayUntil = 0; say('자 자, 고리 던지기', 2); showScreen();
}

// ---------- 매 프레임 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.8); updateParticles(dt);
  if (state !== 'play') return;
  time += dt; tipT += dt; if (cool > 0) cool -= dt;
  for (const p of prizes) {
    p.t += dt;
    if (p.on) {
      if (p.d.walk) { p.x += p.vx * dt * (1 + wave * 0.08); if (Math.abs(p.x) > MW - 1.2) { p.x = clamp(p.x, -MW + 1.2, MW - 1.2); p.vx *= -1; } if (Math.random() < dt * 0.3) p.vx *= -1; }
      if (p.d.slide) p.x = clamp(p.x0 + Math.sin(p.t * (0.8 + wave * 0.08) + p.ph) * 2.2, -MW + 0.8, MW - 0.8);
      if (p.kick) { const s = Math.sign(p.kick) * Math.min(Math.abs(p.kick), 4 * dt); p.x = clamp(p.x + s, -MW + 1, MW - 1); p.kick -= s; }
    } else if (p.win !== undefined) p.win += dt;
  }
  for (const f of flying) {
    if (f.st === 'fly') { f.t += dt; if (f.t >= f.T) { f.t = f.T; resolve(f); } }
    else if (f.st === 'bounce') { f.life += dt; f.vy -= 22 * dt; f.x1 += f.vx * dt; f.z1 += f.vz * dt; f.y += f.vy * dt; if (f.y < 0.08) { f.y = 0.08; f.vy *= -0.3; f.vx *= 0.6; f.vz *= 0.6; } }
    else f.life += dt;
    if (f.life > (f.st === 'won' ? 0.9 : 2.2)) { f.dead = true; f.r.on = false; f.r.m.visible = false; if (f.p) { scene.remove(f.p.g); prizes = prizes.filter((p) => p !== f.p); } }
  }
  flying = flying.filter((f) => !f.dead);
  if (restockT > 0) { restockT -= dt; if (restockT <= 0) { stock(); left += 4; sfx.ringsUp(); banner('주인이 새 상품 진열　고리 4개 보너스' + (wind ? '　바람이 붑니다' : ''), 1.8); say('또 와 또 와', 1); } }
  if (auto) autoPlay(dt);
  if (left <= 0 && restockT <= 0 && !flying.some((f) => f.st === 'fly')) { endT += dt; if (endT > 1.3) endGame(); } else endT = 0;
}
function autoPlay(dt) {                                            // 자동 플레이(테스트용): 이득인 걸 골라 조준, 바람을 계산하고 움직이는 건 앞을 봄
  botT -= dt; if (botT > 0 || cool > 0 || left <= 0 || restockT > 0) return; botT = 0.7;
  let t = null, bv = -1; for (const p of prizes) { if (!p.on) continue; const tol = Math.max(0, RING_R - p.r * 0.92), dist = 4 - p.z, sc = 0.1 + dist * 0.02, chance = clamp((tol / (sc * 1.6)) ** 2, 0, 1) * (p.d.walk || p.d.slide ? 0.5 : 1), v = chance * (p.d.v + (p.d.rings ? 25 : 8)); if (v > bv) { bv = v; t = p; } }
  if (!t) return; const dist = 4 - t.z, T = 0.5 + dist * 0.035, lead = t.d.walk ? t.vx * T : 0; throwRing(t.x + lead - wind * dist * 0.075, t.z);
}
function draw() {
  const t = performance.now() / 1000;
  for (const p of prizes) {
    if (p.on) { p.g.position.set(p.x, p.d.walk ? Math.abs(Math.sin(t * 7)) * 0.08 : 0, p.z); if (p.d.walk) p.g.rotation.y = p.vx > 0 ? Math.PI / 2 : -Math.PI / 2; else if (p.d.rings || p.kind === 'gold') p.g.rotation.y = t * 1.5; }
    else if (p.win !== undefined) { const k = Math.min(1, p.win / 0.8); p.g.position.set(p.x + (0 - p.x) * k * k, k * 5 * (1 - k) * 2 + 0.3, p.z + (6 - p.z) * k * k); p.g.rotation.y = t * 8; p.g.scale.setScalar((p.d.s || 1) * (1 - k * 0.5)); }   // 걸린 건 손으로 날아옴
  }
  for (const f of flying) {
    const m = f.r.m;
    if (f.st === 'fly') { const k = f.t / f.T; m.position.set(f.x0 + (f.x1 - f.x0) * k, 2.2 + (0.5 - 2.2) * k + Math.sin(k * Math.PI) * f.h, f.z0 + (f.z1 - f.z0) * k); m.rotation.set(Math.PI / 2 + Math.sin(k * 9 + f.spin) * 0.25 * (1 - k), 0, k * 10); }
    else if (f.st === 'won') { m.position.set(f.p.g.position.x, f.p.g.position.y + 0.25, f.p.g.position.z); m.rotation.set(Math.PI / 2, 0, 0); }
    else if (f.st === 'bounce') { m.position.set(f.x1, f.y, f.z1); m.rotation.set(Math.PI / 2 + Math.sin(f.life * 14) * 0.5 * Math.max(0, 1 - f.life), 0, f.life * 3); }
    else { m.position.set(f.x1, 0.08, f.z1); m.rotation.set(Math.PI / 2, 0, 0); }
    if (f.st !== 'fly' && f.st !== 'won' && f.life > 1.6) { m.material.transparent = true; m.material.opacity = Math.max(0, 1 - (f.life - 1.6) / 0.6); }
  }
  const on = state === 'play' && aim.on && aim.ok && left > 0; aimRing.visible = on; for (const d of dots) d.visible = on;
  if (on) {
    const [lx, lz] = landPoint(aim.x, aim.z), dist = 4 - aim.z, h = 2.6 + dist * 0.22, hot = prizes.some((p) => p.on && Math.hypot(p.x - lx, p.z - lz) < RING_R - p.r * 0.92);
    aimRing.position.set(lx, 0.12, lz); aimRing.material.color.setHex(hot ? 0x6bff8a : 0xffffff); aimRing.scale.setScalar(1 + Math.sin(t * 8) * 0.03);
    dots.forEach((d, i) => { const k = (i + 1) / (dots.length + 1); d.position.set(lx * k, 2.2 + (0.5 - 2.2) * k + Math.sin(k * Math.PI) * h, 3.4 + (lz - 3.4) * k); });
  }
  handRing.visible = state === 'play' && left > 0; handRing.rotation.z = t * 1.2; handRing.position.x = aim.on ? clamp(aim.x * 0.15, -1, 1) : 0;
  boss.userData.head.rotation.y = Math.sin(t * 1.4) * 0.3; boss.position.y = Math.abs(Math.sin(t * 2.2)) * 0.05;
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.3, CAM.y + rand(-1, 1) * shake * 0.25, CAM.z + rand(-1, 1) * shake * 0.25);
  hud(); composer.render();
}

// ---------- 입력: 누른 곳이 시작점, 위로 끈 만큼 멀리, 좌우로 끌면 그쪽으로 치우침 ----------
function setAim(e) { const r = stage.getBoundingClientRect(), dx = (e.clientX - aim.sx) / r.width, dy = (aim.sy - e.clientY) / r.height; aim.x = clamp(dx * 13, -MW, MW); aim.z = -2 - clamp(dy * 26, 0, FAR - 1.6); aim.ok = dy > 0.03; }
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') { newGame(); return; } if (state !== 'play' || auto) return; aim.on = true; aim.sx = e.clientX; aim.sy = e.clientY; aim.ok = false; try { stage.setPointerCapture(e.pointerId); } catch (er) { /* 없어도 됨 */ } });
stage.addEventListener('pointermove', (e) => { if (state === 'play' && aim.on && !auto) setAim(e); });
const up = (e) => { if (state === 'play' && aim.on && !auto) { if (e && e.clientX !== undefined) setAim(e); if (aim.ok) throwRing(aim.x, aim.z); } aim.on = false; };
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', () => { aim.on = false; });
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { e.preventDefault(); initAudio(); newGame(); } });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); stock(); showScreen(); requestAnimationFrame(frame);

// 디버그 입구
window.__ring = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on) { auto = on; }, throwAt: throwRing, aimAt(x, z) { aim.on = true; aim.ok = true; aim.x = x; aim.z = z; },
  get prizes() { return prizes.filter((p) => p.on).map((p) => p.kind + '@' + p.x.toFixed(1) + ',' + p.z.toFixed(1)); },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, money, left, streak, bestStreak, wins, wave, wind: +wind.toFixed(2), prizes: prizes.filter((p) => p.on).length, flying: flying.length, time: +time.toFixed(0), haul: JSON.stringify(haul) }; },
};
