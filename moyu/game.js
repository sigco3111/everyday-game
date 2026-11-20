// 《메아리: 월급 루팡 달인》—— 세로 화면: 누르면 딴짓, 놓으면 일하는 척. 사장이 돌아보거나, CCTV 에 빨간불이 켜지거나, HR 이 지나갈 때 딴짓 중이면 걸림.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const DAY_LEN = 40;                                                 // 하루(9:00 부터 18:00)의 초 수

// ---------- 렌더링 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfd8e6);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 120);
const CAM = new THREE.Vector3(0, 12.5, 15.5), LOOK = new THREE.Vector3(0, 3.2, -3);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.9)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.fov = W / H < 0.5 ? 56 : 50; camera.updateProjectionMatrix(); }
scene.add(new THREE.HemisphereLight(0xffffff, 0x8f98a8, 1.0));
const sun = new THREE.DirectionalLight(0xfff6e6, 1.2); sun.position.set(-7, 18, 10); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -20, near: 2, far: 60 }); sun.shadow.bias = -0.002;

// ---------- 사무실 ----------
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sphG = new THREE.SphereGeometry(1, 20, 14), capG = new THREE.CapsuleGeometry(1, 1, 6, 12);
function mk(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
{
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#6f7f96'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#687890'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 12); t.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(44, 60), L(0xffffff, { map: t })); f.rotation.x = -Math.PI / 2; f.position.z = -6; f.receiveShadow = true; scene.add(f);
  mk(scene, box(44, 16, 1), L(0xe9eef5), 0, 8, -19);                                                    // 뒷벽
  mk(scene, box(11, 5.5, 0.3), L(0xffffff), 0, 7, -18.4); mk(scene, box(11.6, 6.1, 0.2), L(0x8a94a6), 0, 7, -18.5);   // 화이트보드
  for (const x of [-15, 15]) mk(scene, box(7, 6, 0.3), L(0x9fd4ff, { emissive: 0x2a5a80 }), x, 8, -18.4);                // 창문
}
function person(shirt, skin, hair, s = 1) {                         // 작은 사람 하나: 정면이 +z(눈이 있는 면)
  const g = new THREE.Group(), sk = L(skin);
  mk(g, capG, L(shirt), 0, 2.0, 0, 0.85, 0.75, 0.6); mk(g, capG, L(0x2e3445), -0.4, 0.75, 0, 0.32, 0.5, 0.32); mk(g, capG, L(0x2e3445), 0.4, 0.75, 0, 0.32, 0.5, 0.32);
  const head = new THREE.Group(); head.position.y = 3.6; g.add(head);
  mk(head, sphG, sk, 0, 0, 0, 0.72, 0.76, 0.72); mk(head, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), L(hair), 0, 0.06, -0.06, 0.76, 0.78, 0.78);
  for (const x of [-0.27, 0.27]) { mk(head, sphG, L(0xffffff), x, 0.05, 0.62, 0.16, 0.18, 0.1); mk(head, sphG, L(0x111111), x, 0.05, 0.7, 0.08, 0.09, 0.06); }
  g.userData.head = head; g.scale.setScalar(s); return g;
}
// 자리: 책상, 모니터(일할 때는 표, 딴짓할 때는 숏폼)
function screenTex(draw) { const c = document.createElement('canvas'); c.width = 256; c.height = 160; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const texWork = screenTex((g) => { g.fillStyle = '#f4f7fb'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#1f7a4a'; g.fillRect(0, 0, 256, 22); g.strokeStyle = '#b8c2d0'; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, 22 + i * 18); g.lineTo(256, 22 + i * 18); g.stroke(); } for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * 43, 22); g.lineTo(i * 43, 160); g.stroke(); } g.fillStyle = '#5a6b80'; for (let i = 0; i < 26; i++) g.fillRect(6 + (i % 6) * 43, 28 + Math.floor(i / 6) * 18 + 4, rand(14, 30), 6); });
const playTex = (a) => a.tex || (a.tex = screenTex((g) => { g.fillStyle = a.col; g.fillRect(0, 0, 256, 160); g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 7; k++) g.fillRect(rand(256), rand(160), rand(20, 70), rand(8, 22)); g.fillStyle = 'rgba(255,255,255,.95)'; g.font = '900 ' + (a.name.length > 3 ? 46 : 56) + 'px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.name, 128, 84); }));
const monMat = new THREE.MeshBasicMaterial({ map: texWork });
const desk = new THREE.Group(); desk.position.set(0, 0, 4.2); scene.add(desk);
mk(desk, box(9, 0.35, 3.6), L(0xd9b68a), 0, 2.2, 0); for (const x of [-4, 4]) mk(desk, box(0.4, 2.2, 3.2), L(0xb59368), x, 1.1, 0);
mk(desk, box(4.6, 3.0, 0.25), L(0x22262e), 0, 4.3, -1.0); { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), monMat); m.position.set(0, 4.3, -0.86); desk.add(m); } mk(desk, box(0.5, 0.9, 0.3), L(0x22262e), 0, 2.7, -1.0);
mk(desk, box(2.6, 0.12, 0.9), L(0x3a4050), 0, 2.45, 0.7);
const me = person(0x3f7fe0, 0xf2c9a4, 0x2a2018, 1.25); me.position.set(0, 0, 7.2); me.rotation.y = Math.PI; scene.add(me);   // 카메라를 등지고 앉음
mk(scene, box(2.4, 0.3, 2.2), L(0x2a2f3a), 0, 1.3, 7.4); mk(scene, box(2.4, 2.6, 0.3), L(0x2a2f3a), 0, 2.7, 8.5);
const phone = mk(scene, box(0.55, 0.95, 0.08), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }), 0.9, 3.4, 6.0); phone.castShadow = false;
// 동료들(분위기용)
const mates = [];
for (const [x, z] of [[-8.5, 1], [8.5, 1], [-8.5, -6], [8.5, -6]]) { mk(scene, box(5.5, 0.3, 2.6), L(0xd9b68a), x, 2.2, z); mk(scene, box(2.4, 1.6, 0.2), L(0x22262e), x, 3.4, z - 0.7); const p = person(pick([0xe0703f, 0x55aa77, 0x9a6fd8, 0xd8b23f]), pick([0xf2c9a4, 0xd9a273]), pick([0x111111, 0x5a3a1c]), 1.0); p.position.set(x, 0, z + 2.2); p.rotation.y = Math.PI; scene.add(p); mates.push(p); }
// 감시자 셋: 사장(돌아봄), CCTV(빨간불), HR(지나감)
const boss = person(0x23262e, 0xe8b88c, 0x555555, 2.1); boss.position.set(0, 0, -11); boss.rotation.y = Math.PI; scene.add(boss);
mk(boss, box(0.22, 0.9, 0.1), L(0xd02a2a), 0, 2.3, 0.6); for (const x of [-0.27, 0.27]) mk(boss.userData.head, box(0.36, 0.1, 0.1), L(0x111111), x, 0.32, 0.66).rotation.z = x > 0 ? 0.35 : -0.35;   // 넥타이, 성난 눈썹
const hr = person(0xd84a8a, 0xf6d6b8, 0x3a2414, 1.5); hr.visible = false; scene.add(hr);
mk(scene, box(0.25, 7, 0.25), L(0x8a94a6), 5.2, 3.5, -9); const camBox = mk(scene, box(1.7, 1.1, 1.3), L(0x2a2f3a), 5.2, 7.4, -9); const camLight = mk(scene, sphG, new THREE.MeshBasicMaterial({ color: 0x35c46a }), 4.9, 7.3, -8.2, 0.36, 0.36, 0.36); camLight.castShadow = false; camBox.visible = camLight.visible = false;
const coneMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
function coneTo(ax, az, bx, bz, w) { const g = new THREE.BufferGeometry(), dx = bz - az, dz = -(bx - ax), l = Math.hypot(dx, dz) || 1; g.setAttribute('position', new THREE.Float32BufferAttribute([ax, 0.06, az, bx + dx / l * w, 0.06, bz + dz / l * w, bx - dx / l * w, 0.06, bz - dz / l * w], 3)); const m = new THREE.Mesh(g, coneMat.clone()); m.frustumCulled = false; scene.add(m); return m; }
const bossCone = coneTo(0, -10, 0, 8, 3.2), camCone = coneTo(5.0, -8.5, 0, 7.5, 2.6);
function tagTex(text, bg) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = '900 84px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const TAG = { warn: tagTex('!', '#ffab1a'), look: tagTex('빤', '#e0261c'), fake: tagTex('?', '#8a94a6') };
const mkTag = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TAG.warn, depthTest: false })); s.scale.set(2.6, 2.6, 1); s.renderOrder = 10; s.visible = false; scene.add(s); return s; };

// ---------- 데이터 ----------
// 딴짓 방식: 무작위 추첨, 종류마다 수익(rate)과 손 떼는 데 걸리는 시간(slow, 초)이 다름; w 는 추첨 가중치, pose 는 특수 자세
const ACTS = [
  { name: '숏폼 보기', rate: 1.0, slow: 0.05, w: 10, col: '#ff5a7a' }, { name: '버블티 마시기', rate: 0.9, slow: 0.04, w: 9, col: '#c98a5a' }, { name: '과자 먹기', rate: 1.0, slow: 0.06, w: 9, col: '#ffb02e' },
  { name: '인터넷 쇼핑', rate: 1.1, slow: 0.06, w: 8, col: '#ff7a3c' }, { name: '소설 읽기', rate: 1.1, slow: 0.06, w: 8, col: '#5a8fd8' }, { name: '매니큐어', rate: 1.0, slow: 0.07, w: 7, col: '#e86aa8' },
  { name: '수다 떨기', rate: 1.2, slow: 0.08, w: 8, col: '#35b0a0' }, { name: '드라마 정주행', rate: 1.3, slow: 0.09, w: 8, col: '#7f6bff' }, { name: '주식', rate: 1.3, slow: 0.1, w: 6, col: '#d8463c' },
  { name: '뜨개질', rate: 1.3, slow: 0.11, w: 5, col: '#b8763c' }, { name: '게임', rate: 1.5, slow: 0.12, w: 7, col: '#35c46a' }, { name: '카드게임', rate: 1.5, slow: 0.13, w: 6, col: '#2f9a55' },
  { name: '고양이 쓰다듬기', rate: 1.6, slow: 0.14, w: 5, col: '#f0a04a' }, { name: '마스크팩', rate: 1.8, slow: 0.19, w: 4, col: '#8fd0c0' }, { name: '푹 자기', rate: 1.8, slow: 0.19, w: 5, col: '#4a5aa8', pose: 'sleep' },
  { name: '유급 화장실', rate: 2.0, slow: 0.22, w: 4, col: '#8a6a3a', pose: 'gone' }, { name: '족욕', rate: 2.2, slow: 0.24, w: 4, col: '#27c3d9' }, { name: '훠궈 끓이기', rate: 2.6, slow: 0.28, w: 3, col: '#e0302a' },
];
const ACT_BAG = ACTS.flatMap((a) => Array(a.w).fill(a));
const risk = (a) => (a.slow >= 0.18 ? '상' : a.slow >= 0.1 ? '중' : '하');
const W_BOSS = { key: 'boss', name: '사장', from: 1, tag: mkTag() }, W_CAM = { key: 'cam', name: 'CCTV', from: 2, tag: mkTag() }, W_HR = { key: 'hr', name: 'HR', from: 3, tag: mkTag() };
const WATCH = [W_BOSS, W_CAM, W_HR];
const STREAK = { 5: '딴짓 신입', 15: '화장실 단골', 30: '직장 고인물', 60: '딴짓 대가' };

// ---------- 상태 ----------
let state = 'title', held = false, auto = false, muted = false;
let time = 0, money = 0, day = 1, dayT = 0, bad = 0, press = false, slack = false, holdT = 0, hideT = 0, stun = 0, mult = 1, act = ACTS[0], actT = 0, dayPhase = 'work', phaseT = 0, shake = 0, hurt = 0, bannerT = 0, slackSec = 0, daySec = 0, lastRelease = -9, botT = 0, botReact = 0.22, noteT = 0, lean = 0;
let best = 0; try { best = +localStorage.getItem('echo_moyu_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }

// ---------- 소리 ----------
let ac = null, master = null; const lastSfx = {};
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const TUNE = [523, 659, 784, 659, 880, 784, 659, 587];              // 딴짓할 때의 가락, 놓으면 멈춤
const sfx = {
  type: () => limited('type', 95, () => tone('square', rand(1500, 2200), 900, 0.02, 0.025)),
  note: (i, m) => tone('triangle', TUNE[i % TUNE.length] * (m >= 4 ? 2 : 1), TUNE[i % TUNE.length] * (m >= 4 ? 2 : 1), 0.13, 0.11),
  warn: (k) => { if (k === 'boss') tone('sawtooth', 150, 210, 0.2, 0.2); else if (k === 'cam') { tone('square', 1400, 1400, 0.07, 0.1); tone('square', 1400, 1400, 0.07, 0.1, 0.14); } else for (let i = 0; i < 4; i++) tone('square', 2400, 1200, 0.03, 0.09, i * 0.13); },
  look: () => tone('sawtooth', 220, 120, 0.25, 0.12),
  hide: () => tone('sine', 600, 260, 0.08, 0.1),
  near: () => { tone('triangle', 880, 1320, 0.1, 0.14); tone('triangle', 1320, 1760, 0.14, 0.12, 0.08); },
  caught: () => { [300, 200, 130].forEach((f, i) => tone('sawtooth', f, f * 0.8, 0.25, 0.26, i * 0.16)); },
  bell: () => [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.4, 0.14, i * 0.12)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
};
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '열심히 해': '好好干', '깜짝이야': '吓死我了', '누가 딴짓이야': '谁在摸鱼', '월급 깎는다': '扣工资', '근무 시간에 뭐 하는 거야': '上班时间干嘛呢', '넌 해고야': '你被开除了', 'CCTV 달았다': '装了摄像头', '순찰 조심해': '小心巡查', '딴짓 최고': '摸鱼真爽', '퇴근이다': '下班啦', '숏폼 보기': '刷短视频', '버블티 마시기': '喝奶茶', '과자 먹기': '吃零食', '인터넷 쇼핑': '网购', '소설 읽기': '看小说', '매니큐어': '修指甲', '수다 떨기': '聊八卦', '드라마 정주행': '追剧', '주식': '炒股', '뜨개질': '织毛衣', '게임': '打游戏', '카드게임': '斗地主', '고양이 쓰다듬기': '撸猫', '마스크팩': '敷面膜', '푹 자기': '睡大觉', '유급 화장실': '带薪拉屎', '족욕': '泡个脚', '훠궈 끓이기': '煮火锅' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[VOICE[text] || text], now = performance.now(); bubble(text);
  if (!c || (gap && now - (sayLast[text] || 0) < gap) || (now < sayUntil && pri <= sayPri)) return;
  sayLast[text] = now; sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

// ---------- 화면 ----------
function banner(text, sec = 1.4) { $('banner').textContent = text; bannerT = sec; }
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  if (state === 'title') s.innerHTML = '<h1>월급 루팡 달인</h1><div class="sub">메아리 · 제 5 기</div><div class="help"><b>누르면</b> 딴짓, <b>놓으면</b> 일하는 척<br>딴짓 방식은 <b>무작위</b>로, 열여덟 가지가 돌아가며 나옵니다<br>엉뚱할수록 더 벌지만 <b>손 떼기가 느립니다</b>; 오래 누를수록 배율 상승<br>머리 위에 <b>!</b> 가 뜨면 곧 쳐다보고, <b>빤</b> 일 때 딴짓하면 걸립니다<br>사장은 페이크도 씁니다; 나중엔 CCTV 와 HR 도 있습니다<br>경고 세 번이면 해고</div>' +
    (best ? '<div class="sub" style="margin-top:12px">최고 딴짓 수입 ₩' + best + '</div>' : '') + '<button class="go" data-act="start">출 근</button>';
  else s.innerHTML = '<h1 class="red">해고되었습니다</h1><div class="sub">딴짓 수입 ₩' + Math.floor(money) + '　' + day + ' 일차까지 버팀<br>총 ' + Math.floor(slackSec) + ' 초 딴짓<br>최고 딴짓 수입 ₩' + best + '</div><button class="go" data-act="start">새 직장 구하기</button>';
}
function hud() {
  $('money').textContent = '₩' + Math.floor(money); $('dayL').textContent = day + ' 일차'; const m = 9 * 60 + Math.floor(clamp(dayT / DAY_LEN, 0, 1) * 540); $('clock').textContent = Math.floor(m / 60) + ':' + String(m % 60 - m % 10).padStart(2, '0');
  $('bad').textContent = '✗'.repeat(bad) + '·'.repeat(Math.max(0, 3 - bad));
  const tb = $('tbar'); tb.firstChild.style.width = (mult - 1) / 4 * 100 + '%'; tb.className = 'bar' + (mult >= 5 ? ' max' : ''); $('ttxt').textContent = '딴짓 배율 ×' + mult.toFixed(1);
  $('name').textContent = slack ? '하는 중: ' + act.name + '　위험 ' + risk(act) : stun > 0 ? '감시 중, 얌전히 일하기' : '하는 중: 열심히 일하기';
  $('flow').innerHTML = slack ? '+₩' + Math.round(10 * mult * act.rate * (1 + (day - 1) * 0.25)) + '<small>초당</small>' : '';
  $('tip').textContent = dayPhase !== 'work' ? '' : slack ? '놓기 = 일하는 척' : '누르기 = 딴짓';
  $('hurt').style.opacity = hurt.toFixed(2); $('foam').style.opacity = slack ? 0.4 + act.slow * 1.6 : 0;
}

// ---------- 감시 상태 머신: away(안 봄) → warn(볼 차례) → look(주시); 사장은 가끔 페이크뿐 ----------
function resetWatch(w, first) { w.st = 'away'; w.t = first ? rand(2.5, 4) : nextAway(w); w.fake = false; }
const hard = () => Math.min(1, (day - 1) / 6);                       // 0 에서 1: 7 일차부터 가장 어려움
function nextAway(w) { const k = 1 - hard() * 0.45; return (w.key === 'boss' ? rand(2.0, 5.0) : w.key === 'cam' ? rand(3.5, 7) : rand(5, 10)) * k; }
const warnLen = (w) => (w.key === 'boss' ? 0.8 : w.key === 'cam' ? 0.85 : 1.0) - hard() * 0.48;
function stepWatch(w, dt) {
  if (day < w.from) { w.st = 'off'; return; } if (w.st === 'off' || !w.st) resetWatch(w, true);
  w.t -= dt; if (w.t > 0) return;
  if (w.st === 'away') { w.st = 'warn'; w.t = warnLen(w); w.fake = w.key === 'boss' && Math.random() < 0.12 + hard() * 0.2; sfx.warn(w.key); }
  else if (w.st === 'warn') {
    if (w.fake) { w.st = 'away'; w.t = rand(0.5, 1.6); w.fake = false; return; }
    w.st = 'look'; w.t = w.key === 'hr' ? 1.5 : rand(1.2, 2.4); sfx.look();
    if (!slack && time - lastRelease < 0.3) { money += 30 * day; banner('아슬아슬 +₩' + 30 * day, 1); sfx.near(); say('깜짝이야', 1, 5000); }
  } else resetWatch(w);
}
function newAct() {                                                // 딴짓 방식을 무작위로 바꾸되 직전 것과 겹치지 않게
  let a = pick(ACT_BAG); for (let i = 0; i < 6 && a === act; i++) a = pick(ACT_BAG);
  act = a; actT = rand(2.2, 3.6); banner(a.name + (a.slow >= 0.18 ? ' · 고위험' : ''), 0.9); say(a.name, 1, 1200); if (a.rate >= 2) say('딴짓 최고', 1, 8000);
}
function caught(w) {
  bad++; stun = 1.6; hideT = 0; holdT = 0; mult = 1; slack = false; hurt = 1; shake = 1; sfx.caught(); banner(w.name + '에게 걸렸다', 1.6);
  say(w.key === 'boss' ? pick(['누가 딴짓이야', '월급 깎는다']) : w.key === 'hr' ? '근무 시간에 뭐 하는 거야' : '월급 깎는다', 3);
  for (const o of WATCH) if (o.st !== 'off') { o.st = 'look'; o.t = 1.4; }
  if (bad >= 3) endGame();
}
function endGame() { state = 'over'; sfx.over(); const s = Math.floor(money); if (s > best) { best = s; try { localStorage.setItem('echo_moyu_best', '' + best); } catch (e) { /* 무시 */ } } say('넌 해고야', 5); showScreen(); }
function newGame() {
  state = 'play'; time = money = bad = holdT = hideT = stun = shake = hurt = bannerT = slackSec = daySec = dayT = 0; day = 1; mult = 1; act = ACTS[0]; slack = press = false; dayPhase = 'work'; lastRelease = -9;
  for (const w of WATCH) w.st = 'off';
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'moyu'; (h.played = h.played || {}).moyu = k; h.last = 'moyu'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
  banner('1 일차 · 출근', 1.6); sayUntil = 0; say('열심히 해', 2); showScreen();
}

// ---------- 매 프레임 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.6);
  if (state !== 'play') return;
  time += dt;
  if (dayPhase === 'off') {                                         // 퇴근 정산, 2 초 쉬고 다음 날로
    phaseT -= dt; if (phaseT <= 0) { day++; dayT = 0; daySec = 0; dayPhase = 'work'; for (const w of WATCH) w.st = 'off'; banner(day + ' 일차' + (day === 2 ? ' · CCTV 설치' : day === 3 ? ' · HR 순찰 시작' : ''), 1.8); say(day === 2 ? 'CCTV 달았다' : day === 3 ? '순찰 조심해' : '열심히 해', 2); }
    return;
  }
  if (auto) autoPlay(dt);
  if (stun > 0) stun -= dt;
  const want = press && stun <= 0;
  if (want) { if (!slack || holdT < 0) { slack = true; holdT = 0; noteT = 0; newAct(); } hideT = 0; }
  else if (slack) { if (hideT <= 0 && holdT >= 0) { hideT = act.slow; lastRelease = time; holdT = -1; sfx.hide(); } else { hideT -= dt; if (hideT <= 0) { slack = false; hideT = 0; } } }   // 신나게 할수록 손 떼기가 느림
  if (slack && want) {
    holdT += dt; mult = Math.min(5, 1 + holdT * 0.4); actT -= dt; if (actT <= 0) newAct();                       // 하다 보면 다른 걸로 바뀜
    money += 10 * mult * act.rate * dt * (1 + (day - 1) * 0.25); slackSec += dt; daySec += dt;
    noteT -= dt; if (noteT <= 0) { noteT = 0.22 - act.rate * 0.04; sfx.note(Math.floor(slackSec * 5), mult); }
    const s0 = Math.floor(slackSec - dt), s1 = Math.floor(slackSec); if (s1 !== s0 && STREAK[s1]) banner(STREAK[s1], 1.4);
  } else if (!slack) { mult = Math.max(1, mult - dt * 6); sfx.type(); }
  monMat.map = slack ? playTex(act) : texWork;
  for (const w of WATCH) { stepWatch(w, dt); if (w.st === 'look' && slack && stun <= 0) { caught(w); if (state !== 'play') return; } }
  dayT += dt;
  if (dayT >= DAY_LEN) { dayPhase = 'off'; phaseT = 2.2; slack = false; press = false; mult = 1; const bonus = 50 * day; money += bonus; sfx.bell(); banner('퇴근　개근 보너스 +₩' + bonus, 2); say('퇴근이다', 2); for (const w of WATCH) { w.st = 'off'; } }
}
function autoPlay(dt) {                                            // 자동 플레이(테스트용): 아무도 안 보면 딴짓, 경고를 보면 0.22 초 뒤에 반응해서 손을 뗌
  const danger = WATCH.some((w) => w.st === 'warn' || w.st === 'look');
  if (danger) { botT += dt; if (botT > botReact) press = false; } else { botT = 0; press = true; }
}
const ang = (a, b, k) => a + (b - a) * k;
function draw() {
  const t = performance.now() / 1000, play = state === 'play';
  // 사장: 등짐 = 화이트보드를 향함, 봄 = 돌아옴
  const bl = W_BOSS.st === 'look', bw = W_BOSS.st === 'warn';
  boss.rotation.y = ang(boss.rotation.y, bl ? 0 : bw ? Math.PI * 0.72 : Math.PI, 0.25); boss.userData.head.rotation.y = bw ? Math.sin(t * 18) * 0.25 : 0; boss.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
  bossCone.material.opacity = ang(bossCone.material.opacity, bl ? 0.3 : 0, 0.3);
  camBox.visible = camLight.visible = play && day >= W_CAM.from; camLight.material.color.setHex(W_CAM.st === 'look' ? 0xff2a1a : W_CAM.st === 'warn' ? (Math.floor(t * 10) % 2 ? 0xffc21a : 0x554400) : 0x35c46a);
  camCone.material.opacity = ang(camCone.material.opacity, W_CAM.st === 'look' ? 0.28 : 0, 0.3);
  // HR: 경고 때 왼쪽에서 들어오고, 주시할 때 마침 뒤를 지나감
  const hs = W_HR.st; hr.visible = play && (hs === 'warn' || hs === 'look');
  if (hr.visible) { const k = hs === 'warn' ? 1 - W_HR.t / warnLen(W_HR) : 1 + (1 - W_HR.t / 1.5); hr.position.set(-9.5 + k * 4.2, Math.abs(Math.sin(t * 9)) * 0.15, 1.5); hr.rotation.y = hs === 'look' ? 0.9 : Math.PI / 2; }
  const tagAt = (w, x, y, z) => { const s = w.tag, on = play && (w.st === 'warn' || w.st === 'look'); s.visible = on; if (on) { s.material.map = w.st === 'look' ? TAG.look : TAG.warn; s.position.set(x, y + Math.sin(t * 12) * 0.12, z); const k = w.st === 'warn' ? 1 + 0.25 * Math.sin(t * 20) : 1.15; s.scale.set(2.6 * k, 2.6 * k, 1); } };
  tagAt(W_BOSS, -3.3, 8.2, -11); tagAt(W_CAM, 5.2, 5.2, -8.6); tagAt(W_HR, hr.position.x + 0.4, 7.4, 1.5);
  // 나: 일할 때는 앞으로 기울여 타이핑, 딴짓할 때는 뒤로 기댐; 자면 엎드림
  lean = ang(lean, slack ? (act.pose === 'sleep' ? -0.5 : 0.22) : -0.12, 0.25); me.visible = !(slack && act.pose === 'gone');   // 유급 화장실: 자리에 사람이 없음 me.rotation.x = -lean; me.userData.head.rotation.x = slack ? 0 : Math.sin(t * 16) * 0.04; me.position.y = slack ? Math.abs(Math.sin(t * 6)) * 0.08 : 0;
  phone.visible = slack && !act.pose; phone.position.y = 3.5 + Math.sin(t * 5) * 0.06;
  mates.forEach((p, i) => { p.userData.head.rotation.x = Math.sin(t * 9 + i * 2) * 0.06; });
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.4, CAM.y + rand(-1, 1) * shake * 0.3, CAM.z + rand(-1, 1) * shake * 0.3);
  hud(); composer.render();
}

// ---------- 입력: 누르면 딴짓, 놓으면 일 ----------
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') { newGame(); return; } if (state === 'play' && !auto && dayPhase === 'work') press = true; });
const up = () => { if (!auto) press = false; }; addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('blur', up);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (state !== 'play') { initAudio(); newGame(); } else if (!auto && !e.repeat && dayPhase === 'work') press = true; } });
addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') up(); });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 디버그 입구
window.__moyu = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on, react) { auto = on; if (react) botReact = react; }, press(on) { press = on; }, setDay(n) { day = n; dayT = 0; for (const w of WATCH) w.st = 'off'; },
  force(key, st, t = 1) { const w = WATCH.find((o) => o.key === key); w.st = st; w.t = t; w.fake = false; },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, day, clock: +dayT.toFixed(1), money: Math.floor(money), bad, slack, mult: +mult.toFixed(2), act: act.name, slackSec: Math.floor(slackSec), watch: WATCH.map((w) => w.key + ':' + w.st).join(' ') }; },
};
