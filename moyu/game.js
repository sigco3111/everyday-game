// 《回声：摸鱼大师》—— 竖屏：按住就摸鱼，松手就装作在工作。老板回头、摄像头亮红灯、HR 路过的时候还在摸，就被抓。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const DAY_LEN = 40;                                                 // 一天（9:00 到 18:00）的秒数

// ---------- 渲染 ----------
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

// ---------- 办公室 ----------
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sphG = new THREE.SphereGeometry(1, 20, 14), capG = new THREE.CapsuleGeometry(1, 1, 6, 12);
function mk(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
{
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#6f7f96'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#687890'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 12); t.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(44, 60), L(0xffffff, { map: t })); f.rotation.x = -Math.PI / 2; f.position.z = -6; f.receiveShadow = true; scene.add(f);
  mk(scene, box(44, 16, 1), L(0xe9eef5), 0, 8, -19);                                                    // 后墙
  mk(scene, box(11, 5.5, 0.3), L(0xffffff), 0, 7, -18.4); mk(scene, box(11.6, 6.1, 0.2), L(0x8a94a6), 0, 7, -18.5);   // 白板
  for (const x of [-15, 15]) mk(scene, box(7, 6, 0.3), L(0x9fd4ff, { emissive: 0x2a5a80 }), x, 8, -18.4);                // 窗
}
function person(shirt, skin, hair, s = 1) {                         // 一个小人：正面朝 +z（有眼睛的一面）
  const g = new THREE.Group(), sk = L(skin);
  mk(g, capG, L(shirt), 0, 2.0, 0, 0.85, 0.75, 0.6); mk(g, capG, L(0x2e3445), -0.4, 0.75, 0, 0.32, 0.5, 0.32); mk(g, capG, L(0x2e3445), 0.4, 0.75, 0, 0.32, 0.5, 0.32);
  const head = new THREE.Group(); head.position.y = 3.6; g.add(head);
  mk(head, sphG, sk, 0, 0, 0, 0.72, 0.76, 0.72); mk(head, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), L(hair), 0, 0.06, -0.06, 0.76, 0.78, 0.78);
  for (const x of [-0.27, 0.27]) { mk(head, sphG, L(0xffffff), x, 0.05, 0.62, 0.16, 0.18, 0.1); mk(head, sphG, L(0x111111), x, 0.05, 0.7, 0.08, 0.09, 0.06); }
  g.userData.head = head; g.scale.setScalar(s); return g;
}
// 工位：桌子、显示器（工作时是表格，摸鱼时是短视频）
function screenTex(draw) { const c = document.createElement('canvas'); c.width = 256; c.height = 160; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const texWork = screenTex((g) => { g.fillStyle = '#f4f7fb'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#1f7a4a'; g.fillRect(0, 0, 256, 22); g.strokeStyle = '#b8c2d0'; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, 22 + i * 18); g.lineTo(256, 22 + i * 18); g.stroke(); } for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * 43, 22); g.lineTo(i * 43, 160); g.stroke(); } g.fillStyle = '#5a6b80'; for (let i = 0; i < 26; i++) g.fillRect(6 + (i % 6) * 43, 28 + Math.floor(i / 6) * 18 + 4, rand(14, 30), 6); });
const playTex = (a) => a.tex || (a.tex = screenTex((g) => { g.fillStyle = a.col; g.fillRect(0, 0, 256, 160); g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 7; k++) g.fillRect(rand(256), rand(160), rand(20, 70), rand(8, 22)); g.fillStyle = 'rgba(255,255,255,.95)'; g.font = '900 ' + (a.name.length > 3 ? 46 : 56) + 'px "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.name, 128, 84); }));
const monMat = new THREE.MeshBasicMaterial({ map: texWork });
const desk = new THREE.Group(); desk.position.set(0, 0, 4.2); scene.add(desk);
mk(desk, box(9, 0.35, 3.6), L(0xd9b68a), 0, 2.2, 0); for (const x of [-4, 4]) mk(desk, box(0.4, 2.2, 3.2), L(0xb59368), x, 1.1, 0);
mk(desk, box(4.6, 3.0, 0.25), L(0x22262e), 0, 4.3, -1.0); { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), monMat); m.position.set(0, 4.3, -0.86); desk.add(m); } mk(desk, box(0.5, 0.9, 0.3), L(0x22262e), 0, 2.7, -1.0);
mk(desk, box(2.6, 0.12, 0.9), L(0x3a4050), 0, 2.45, 0.7);
const me = person(0x3f7fe0, 0xf2c9a4, 0x2a2018, 1.25); me.position.set(0, 0, 7.2); me.rotation.y = Math.PI; scene.add(me);   // 背对镜头坐着
mk(scene, box(2.4, 0.3, 2.2), L(0x2a2f3a), 0, 1.3, 7.4); mk(scene, box(2.4, 2.6, 0.3), L(0x2a2f3a), 0, 2.7, 8.5);
const phone = mk(scene, box(0.55, 0.95, 0.08), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }), 0.9, 3.4, 6.0); phone.castShadow = false;
// 同事（凑气氛）
const mates = [];
for (const [x, z] of [[-8.5, 1], [8.5, 1], [-8.5, -6], [8.5, -6]]) { mk(scene, box(5.5, 0.3, 2.6), L(0xd9b68a), x, 2.2, z); mk(scene, box(2.4, 1.6, 0.2), L(0x22262e), x, 3.4, z - 0.7); const p = person(pick([0xe0703f, 0x55aa77, 0x9a6fd8, 0xd8b23f]), pick([0xf2c9a4, 0xd9a273]), pick([0x111111, 0x5a3a1c]), 1.0); p.position.set(x, 0, z + 2.2); p.rotation.y = Math.PI; scene.add(p); mates.push(p); }
// 三个盯梢的：老板（会回头）、摄像头（亮红灯）、HR（路过）
const boss = person(0x23262e, 0xe8b88c, 0x555555, 2.1); boss.position.set(0, 0, -11); boss.rotation.y = Math.PI; scene.add(boss);
mk(boss, box(0.22, 0.9, 0.1), L(0xd02a2a), 0, 2.3, 0.6); for (const x of [-0.27, 0.27]) mk(boss.userData.head, box(0.36, 0.1, 0.1), L(0x111111), x, 0.32, 0.66).rotation.z = x > 0 ? 0.35 : -0.35;   // 领带、怒眉
const hr = person(0xd84a8a, 0xf6d6b8, 0x3a2414, 1.5); hr.visible = false; scene.add(hr);
mk(scene, box(0.25, 7, 0.25), L(0x8a94a6), 5.2, 3.5, -9); const camBox = mk(scene, box(1.7, 1.1, 1.3), L(0x2a2f3a), 5.2, 7.4, -9); const camLight = mk(scene, sphG, new THREE.MeshBasicMaterial({ color: 0x35c46a }), 4.9, 7.3, -8.2, 0.36, 0.36, 0.36); camLight.castShadow = false; camBox.visible = camLight.visible = false;
const coneMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
function coneTo(ax, az, bx, bz, w) { const g = new THREE.BufferGeometry(), dx = bz - az, dz = -(bx - ax), l = Math.hypot(dx, dz) || 1; g.setAttribute('position', new THREE.Float32BufferAttribute([ax, 0.06, az, bx + dx / l * w, 0.06, bz + dz / l * w, bx - dx / l * w, 0.06, bz - dz / l * w], 3)); const m = new THREE.Mesh(g, coneMat.clone()); m.frustumCulled = false; scene.add(m); return m; }
const bossCone = coneTo(0, -10, 0, 8, 3.2), camCone = coneTo(5.0, -8.5, 0, 7.5, 2.6);
function tagTex(text, bg) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = '900 84px "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const TAG = { warn: tagTex('!', '#ffab1a'), look: tagTex('盯', '#e0261c'), fake: tagTex('?', '#8a94a6') };
const mkTag = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TAG.warn, depthTest: false })); s.scale.set(2.6, 2.6, 1); s.renderOrder = 10; s.visible = false; scene.add(s); return s; };

// ---------- 数据 ----------
// 摸鱼方式：随机抽，每种的收益（rate）和收手要花的时间（slow，秒）不一样；w 是抽中的权重，pose 是特殊姿势
const ACTS = [
  { name: '刷短视频', rate: 1.0, slow: 0.05, w: 10, col: '#ff5a7a' }, { name: '喝奶茶', rate: 0.9, slow: 0.04, w: 9, col: '#c98a5a' }, { name: '吃零食', rate: 1.0, slow: 0.06, w: 9, col: '#ffb02e' },
  { name: '网购', rate: 1.1, slow: 0.06, w: 8, col: '#ff7a3c' }, { name: '看小说', rate: 1.1, slow: 0.06, w: 8, col: '#5a8fd8' }, { name: '修指甲', rate: 1.0, slow: 0.07, w: 7, col: '#e86aa8' },
  { name: '聊八卦', rate: 1.2, slow: 0.08, w: 8, col: '#35b0a0' }, { name: '追剧', rate: 1.3, slow: 0.09, w: 8, col: '#7f6bff' }, { name: '炒股', rate: 1.3, slow: 0.1, w: 6, col: '#d8463c' },
  { name: '织毛衣', rate: 1.3, slow: 0.11, w: 5, col: '#b8763c' }, { name: '打游戏', rate: 1.5, slow: 0.12, w: 7, col: '#35c46a' }, { name: '斗地主', rate: 1.5, slow: 0.13, w: 6, col: '#2f9a55' },
  { name: '撸猫', rate: 1.6, slow: 0.14, w: 5, col: '#f0a04a' }, { name: '敷面膜', rate: 1.8, slow: 0.19, w: 4, col: '#8fd0c0' }, { name: '睡大觉', rate: 1.8, slow: 0.19, w: 5, col: '#4a5aa8', pose: 'sleep' },
  { name: '带薪拉屎', rate: 2.0, slow: 0.22, w: 4, col: '#8a6a3a', pose: 'gone' }, { name: '泡个脚', rate: 2.2, slow: 0.24, w: 4, col: '#27c3d9' }, { name: '煮火锅', rate: 2.6, slow: 0.28, w: 3, col: '#e0302a' },
];
const ACT_BAG = ACTS.flatMap((a) => Array(a.w).fill(a));
const risk = (a) => (a.slow >= 0.18 ? '高' : a.slow >= 0.1 ? '中' : '低');
const W_BOSS = { key: 'boss', name: '老板', from: 1, tag: mkTag() }, W_CAM = { key: 'cam', name: '摄像头', from: 2, tag: mkTag() }, W_HR = { key: 'hr', name: 'HR', from: 3, tag: mkTag() };
const WATCH = [W_BOSS, W_CAM, W_HR];
const STREAK = { 5: '摸鱼新秀', 15: '带薪拉屎', 30: '职场老油条', 60: '摸鱼宗师' };

// ---------- 状态 ----------
let state = 'title', held = false, auto = false, muted = false;
let time = 0, money = 0, day = 1, dayT = 0, bad = 0, press = false, slack = false, holdT = 0, hideT = 0, stun = 0, mult = 1, act = ACTS[0], actT = 0, dayPhase = 'work', phaseT = 0, shake = 0, hurt = 0, bannerT = 0, slackSec = 0, daySec = 0, lastRelease = -9, botT = 0, botReact = 0.22, noteT = 0, lean = 0;
let best = 0; try { best = +localStorage.getItem('echo_moyu_best') || 0; } catch (e) { /* 存不了就算了 */ }

// ---------- 声音 ----------
let ac = null, master = null; const lastSfx = {};
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const TUNE = [523, 659, 784, 659, 880, 784, 659, 587];              // 摸鱼时的小曲，一松手就停
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
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[text], now = performance.now(); bubble(text);
  if (!c || (gap && now - (sayLast[text] || 0) < gap) || (now < sayUntil && pri <= sayPri)) return;
  sayLast[text] = now; sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 已经放完 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

// ---------- 界面 ----------
function banner(text, sec = 1.4) { $('banner').textContent = text; bannerT = sec; }
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  if (state === 'title') s.innerHTML = '<h1>摸鱼大师</h1><div class="sub">回声 · 第 5 期</div><div class="help"><b>按住</b>屏幕就摸鱼，<b>松手</b>就装作在工作<br>摸鱼方式<b>随机</b>出现，十八种轮着来<br>越离谱的赚得越多，但<b>收手越慢</b>；按得越久倍数越高<br>头顶冒 <b>!</b> 就是要看过来了，冒 <b>盯</b> 的时候还在摸就被抓<br>老板会假动作；后面还有摄像头和 HR<br>三次警告就被开除</div>' +
    (best ? '<div class="sub" style="margin-top:12px">最高摸鱼收入 ¥' + best + '</div>' : '') + '<button class="go" data-act="start">上 班</button>';
  else s.innerHTML = '<h1 class="red">你被开除了</h1><div class="sub">摸鱼收入 ¥' + Math.floor(money) + '　撑到第 ' + day + ' 天<br>一共摸了 ' + Math.floor(slackSec) + ' 秒<br>最高摸鱼收入 ¥' + best + '</div><button class="go" data-act="start">再找一份工</button>';
}
function hud() {
  $('money').textContent = '¥' + Math.floor(money); $('dayL').textContent = '第 ' + day + ' 天'; const m = 9 * 60 + Math.floor(clamp(dayT / DAY_LEN, 0, 1) * 540); $('clock').textContent = Math.floor(m / 60) + ':' + String(m % 60 - m % 10).padStart(2, '0');
  $('bad').textContent = '✗'.repeat(bad) + '·'.repeat(Math.max(0, 3 - bad));
  const tb = $('tbar'); tb.firstChild.style.width = (mult - 1) / 4 * 100 + '%'; tb.className = 'bar' + (mult >= 5 ? ' max' : ''); $('ttxt').textContent = '摸鱼倍数 ×' + mult.toFixed(1);
  $('name').textContent = slack ? '正在：' + act.name + '　风险' + risk(act) : stun > 0 ? '被盯着，老实干活' : '正在：认真工作';
  $('flow').innerHTML = slack ? '+¥' + Math.round(10 * mult * act.rate * (1 + (day - 1) * 0.25)) + '<small>每秒</small>' : '';
  $('tip').textContent = dayPhase !== 'work' ? '' : slack ? '松手 = 装作在工作' : '按住 = 摸鱼';
  $('hurt').style.opacity = hurt.toFixed(2); $('foam').style.opacity = slack ? 0.4 + act.slow * 1.6 : 0;
}

// ---------- 盯梢的状态机：away（没看）→ warn（要看了）→ look（盯着）；老板有时只是假动作 ----------
function resetWatch(w, first) { w.st = 'away'; w.t = first ? rand(2.5, 4) : nextAway(w); w.fake = false; }
const hard = () => Math.min(1, (day - 1) / 6);                       // 0 到 1：第 7 天起最难
function nextAway(w) { const k = 1 - hard() * 0.45; return (w.key === 'boss' ? rand(2.0, 5.0) : w.key === 'cam' ? rand(3.5, 7) : rand(5, 10)) * k; }
const warnLen = (w) => (w.key === 'boss' ? 0.8 : w.key === 'cam' ? 0.85 : 1.0) - hard() * 0.48;
function stepWatch(w, dt) {
  if (day < w.from) { w.st = 'off'; return; } if (w.st === 'off' || !w.st) resetWatch(w, true);
  w.t -= dt; if (w.t > 0) return;
  if (w.st === 'away') { w.st = 'warn'; w.t = warnLen(w); w.fake = w.key === 'boss' && Math.random() < 0.12 + hard() * 0.2; sfx.warn(w.key); }
  else if (w.st === 'warn') {
    if (w.fake) { w.st = 'away'; w.t = rand(0.5, 1.6); w.fake = false; return; }
    w.st = 'look'; w.t = w.key === 'hr' ? 1.5 : rand(1.2, 2.4); sfx.look();
    if (!slack && time - lastRelease < 0.3) { money += 30 * day; banner('极限操作 +¥' + 30 * day, 1); sfx.near(); say('吓死我了', 1, 5000); }
  } else resetWatch(w);
}
function newAct() {                                                // 随机换一种摸鱼方式，不和上一种重复
  let a = pick(ACT_BAG); for (let i = 0; i < 6 && a === act; i++) a = pick(ACT_BAG);
  act = a; actT = rand(2.2, 3.6); banner(a.name + (a.slow >= 0.18 ? ' · 高风险' : ''), 0.9); say(a.name, 1, 1200); if (a.rate >= 2) say('摸鱼真爽', 1, 8000);
}
function caught(w) {
  bad++; stun = 1.6; hideT = 0; holdT = 0; mult = 1; slack = false; hurt = 1; shake = 1; sfx.caught(); banner('被' + w.name + '抓到了', 1.6);
  say(w.key === 'boss' ? pick(['谁在摸鱼', '扣工资']) : w.key === 'hr' ? '上班时间干嘛呢' : '扣工资', 3);
  for (const o of WATCH) if (o.st !== 'off') { o.st = 'look'; o.t = 1.4; }
  if (bad >= 3) endGame();
}
function endGame() { state = 'over'; sfx.over(); const s = Math.floor(money); if (s > best) { best = s; try { localStorage.setItem('echo_moyu_best', '' + best); } catch (e) { /* 忽略 */ } } say('你被开除了', 5); showScreen(); }
function newGame() {
  state = 'play'; time = money = bad = holdT = hideT = stun = shake = hurt = bannerT = slackSec = daySec = dayT = 0; day = 1; mult = 1; act = ACTS[0]; slack = press = false; dayPhase = 'work'; lastRelease = -9;
  for (const w of WATCH) w.st = 'off';
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'moyu'; (h.played = h.played || {}).moyu = k; h.last = 'moyu'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 存不了就算了 */ }   // 给首页记一次打卡
  banner('第 1 天 · 上班', 1.6); sayUntil = 0; say('好好干', 2); showScreen();
}

// ---------- 每帧 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.6);
  if (state !== 'play') return;
  time += dt;
  if (dayPhase === 'off') {                                         // 下班结算，停两秒进入下一天
    phaseT -= dt; if (phaseT <= 0) { day++; dayT = 0; daySec = 0; dayPhase = 'work'; for (const w of WATCH) w.st = 'off'; banner('第 ' + day + ' 天' + (day === 2 ? ' · 装了摄像头' : day === 3 ? ' · HR 开始巡查' : ''), 1.8); say(day === 2 ? '装了摄像头' : day === 3 ? '小心巡查' : '好好干', 2); }
    return;
  }
  if (auto) autoPlay(dt);
  if (stun > 0) stun -= dt;
  const want = press && stun <= 0;
  if (want) { if (!slack || holdT < 0) { slack = true; holdT = 0; noteT = 0; newAct(); } hideT = 0; }
  else if (slack) { if (hideT <= 0 && holdT >= 0) { hideT = act.slow; lastRelease = time; holdT = -1; sfx.hide(); } else { hideT -= dt; if (hideT <= 0) { slack = false; hideT = 0; } } }   // 摸得越嗨，收手越慢
  if (slack && want) {
    holdT += dt; mult = Math.min(5, 1 + holdT * 0.4); actT -= dt; if (actT <= 0) newAct();                       // 摸着摸着就换一种
    money += 10 * mult * act.rate * dt * (1 + (day - 1) * 0.25); slackSec += dt; daySec += dt;
    noteT -= dt; if (noteT <= 0) { noteT = 0.22 - act.rate * 0.04; sfx.note(Math.floor(slackSec * 5), mult); }
    const s0 = Math.floor(slackSec - dt), s1 = Math.floor(slackSec); if (s1 !== s0 && STREAK[s1]) banner(STREAK[s1], 1.4);
  } else if (!slack) { mult = Math.max(1, mult - dt * 6); sfx.type(); }
  monMat.map = slack ? playTex(act) : texWork;
  for (const w of WATCH) { stepWatch(w, dt); if (w.st === 'look' && slack && stun <= 0) { caught(w); if (state !== 'play') return; } }
  dayT += dt;
  if (dayT >= DAY_LEN) { dayPhase = 'off'; phaseT = 2.2; slack = false; press = false; mult = 1; const bonus = 50 * day; money += bonus; sfx.bell(); banner('下班啦　全勤 +¥' + bonus, 2); say('下班啦', 2); for (const w of WATCH) { w.st = 'off'; } }
}
function autoPlay(dt) {                                            // 电脑代打（测试用）：没人要看就摸，看到警告过 0.22 秒才反应过来松手
  const danger = WATCH.some((w) => w.st === 'warn' || w.st === 'look');
  if (danger) { botT += dt; if (botT > botReact) press = false; } else { botT = 0; press = true; }
}
const ang = (a, b, k) => a + (b - a) * k;
function draw() {
  const t = performance.now() / 1000, play = state === 'play';
  // 老板：背对 = 转向白板，看 = 转过来
  const bl = W_BOSS.st === 'look', bw = W_BOSS.st === 'warn';
  boss.rotation.y = ang(boss.rotation.y, bl ? 0 : bw ? Math.PI * 0.72 : Math.PI, 0.25); boss.userData.head.rotation.y = bw ? Math.sin(t * 18) * 0.25 : 0; boss.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
  bossCone.material.opacity = ang(bossCone.material.opacity, bl ? 0.3 : 0, 0.3);
  camBox.visible = camLight.visible = play && day >= W_CAM.from; camLight.material.color.setHex(W_CAM.st === 'look' ? 0xff2a1a : W_CAM.st === 'warn' ? (Math.floor(t * 10) % 2 ? 0xffc21a : 0x554400) : 0x35c46a);
  camCone.material.opacity = ang(camCone.material.opacity, W_CAM.st === 'look' ? 0.28 : 0, 0.3);
  // HR：警告时从左边走进来，盯的时候正好路过你身后
  const hs = W_HR.st; hr.visible = play && (hs === 'warn' || hs === 'look');
  if (hr.visible) { const k = hs === 'warn' ? 1 - W_HR.t / warnLen(W_HR) : 1 + (1 - W_HR.t / 1.5); hr.position.set(-9.5 + k * 4.2, Math.abs(Math.sin(t * 9)) * 0.15, 1.5); hr.rotation.y = hs === 'look' ? 0.9 : Math.PI / 2; }
  const tagAt = (w, x, y, z) => { const s = w.tag, on = play && (w.st === 'warn' || w.st === 'look'); s.visible = on; if (on) { s.material.map = w.st === 'look' ? TAG.look : TAG.warn; s.position.set(x, y + Math.sin(t * 12) * 0.12, z); const k = w.st === 'warn' ? 1 + 0.25 * Math.sin(t * 20) : 1.15; s.scale.set(2.6 * k, 2.6 * k, 1); } };
  tagAt(W_BOSS, -3.3, 8.2, -11); tagAt(W_CAM, 5.2, 5.2, -8.6); tagAt(W_HR, hr.position.x + 0.4, 7.4, 1.5);
  // 我：工作时前倾打字，摸鱼时往后一靠；睡觉就趴下
  lean = ang(lean, slack ? (act.pose === 'sleep' ? -0.5 : 0.22) : -0.12, 0.25); me.visible = !(slack && act.pose === 'gone');   // 带薪拉屎：人不在座位上 me.rotation.x = -lean; me.userData.head.rotation.x = slack ? 0 : Math.sin(t * 16) * 0.04; me.position.y = slack ? Math.abs(Math.sin(t * 6)) * 0.08 : 0;
  phone.visible = slack && !act.pose; phone.position.y = 3.5 + Math.sin(t * 5) * 0.06;
  mates.forEach((p, i) => { p.userData.head.rotation.x = Math.sin(t * 9 + i * 2) * 0.06; });
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.4, CAM.y + rand(-1, 1) * shake * 0.3, CAM.z + rand(-1, 1) * shake * 0.3);
  hud(); composer.render();
}

// ---------- 输入：按住摸鱼，松开工作 ----------
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') { newGame(); return; } if (state === 'play' && !auto && dayPhase === 'work') press = true; });
const up = () => { if (!auto) press = false; }; addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('blur', up);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (state !== 'play') { initAudio(); newGame(); } else if (!auto && !e.repeat && dayPhase === 'work') press = true; } });
addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') up(); });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 调试入口
window.__moyu = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on, react) { auto = on; if (react) botReact = react; }, press(on) { press = on; }, setDay(n) { day = n; dayT = 0; for (const w of WATCH) w.st = 'off'; },
  force(key, st, t = 1) { const w = WATCH.find((o) => o.key === key); w.st = st; w.t = t; w.fake = false; },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, day, clock: +dayT.toFixed(1), money: Math.floor(money), bad, slack, mult: +mult.toFixed(2), act: act.name, slackSec: Math.floor(slackSec), watch: WATCH.map((w) => w.key + ':' + w.st).join(' ') }; },
};
