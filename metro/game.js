// 《回声：挤地铁》—— 竖屏：早高峰站台。按住拖动“推手”，把乘客往车厢里推、往里塞，关门前塞够人数。要下车的人得先放出来。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];

// ---------- 场地（俯视，xz 平面） ----------
// 车厢在上：x ∈ [-CW, CW]，z ∈ [-CD, 0]；车门开在 z = 0 这条线上，|x| < DW；站台在下：z ∈ [0, PD]
const CW = 6, CD = 8.2, DW = 2.7, PW = 7.2, PD = 9.5, HAND_R = 1.5, OPEN = 13;

// ---------- 渲染 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x20242e);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 140);
const CAM = new THREE.Vector3(0, 27.5, 11), LOOK = new THREE.Vector3(0, 0, 1.4);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.9)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.fov = W / H < 0.5 ? 56 : 50; camera.updateProjectionMatrix(); }
scene.add(new THREE.HemisphereLight(0xffffff, 0x707888, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-6, 26, 10); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 2, far: 70 }); sun.shadow.bias = -0.002;
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function mk(parent, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
// 站台
{
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#c9ccd4'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a8acb6'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 6); t.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), L(0xffffff, { map: t })); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, 8); f.receiveShadow = true; scene.add(f);
  const y = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.7), new THREE.MeshBasicMaterial({ color: 0xffc21a })); y.rotation.x = -Math.PI / 2; y.position.set(0, 0.02, 1.0); scene.add(y);        // 黄线
  const track = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), L(0x14161c)); track.rotation.x = -Math.PI / 2; track.position.set(0, -0.6, -5); scene.add(track);
  for (const x of [-DW - 0.3, DW + 0.3]) { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.2), new THREE.MeshBasicMaterial({ color: 0x35c46a })); a.rotation.x = -Math.PI / 2; a.position.set(x, 0.02, 2.9); scene.add(a); }   // 候车线
}
// 车厢：地板、三面墙、车门两侧的墙、两扇滑门
const car = new THREE.Group(); scene.add(car);
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(CW * 2, CD), L(0x8fa3b8)); f.rotation.x = -Math.PI / 2; f.position.set(0, 0.01, -CD / 2); f.receiveShadow = true; car.add(f);
  const wall = L(0xe8edf2), trim = L(0x2f7fd8);
  mk(car, box(CW * 2 + 0.8, 2.2, 0.4), wall, 0, 1.1, -CD - 0.2); mk(car, box(CW * 2 + 0.8, 0.5, 0.42), trim, 0, 2.2, -CD - 0.2);
  for (const s of [-1, 1]) { mk(car, box(0.4, 2.2, CD + 0.4), wall, s * (CW + 0.2), 1.1, -CD / 2); mk(car, box(CW - DW, 2.2, 0.4), wall, s * (DW + (CW - DW) / 2), 1.1, 0); mk(car, box(CW - DW, 0.5, 0.42), trim, s * (DW + (CW - DW) / 2), 2.2, 0); }
  for (let i = 0; i < 5; i++) mk(car, box(1.5, 0.5, 0.9), L(0x3f8fd0), -4.6 + i * 2.3, 0.45, -CD + 0.6);                    // 一排座位
}
const doorMat = L(0xb8c4d0, { emissive: 0x101820 });
const doors = [-1, 1].map((s) => { const d = mk(car, box(DW, 2.0, 0.3), doorMat, s * DW * 1.5, 1.0, 0.05); d.userData.s = s; return d; });
// 乘客：身体（染色）+ 头 + 头发，三套实例
const NMAX = 110, dummy = new THREE.Object3D();
const inst = (geo, mat, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, NMAX); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NMAX * 3).fill(1), 3); m.castShadow = shadow; m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
const bodyM = inst(new THREE.CapsuleGeometry(0.6, 0.7, 6, 14), L(0xffffff)), headM = inst(new THREE.SphereGeometry(0.42, 16, 12), L(0xffffff)), hairM = inst(new THREE.SphereGeometry(0.44, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), L(0xffffff)), packM = inst(box(0.9, 0.9, 0.5), L(0xffffff)), arrowM = inst(new THREE.ConeGeometry(0.4, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), false);
function put(m, n, x, y, z, sx, sy, sz, r, g, b, ry = 0, rx = 0) { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); m.setMatrixAt(n, dummy.matrix); const c = m.instanceColor.array; c[n * 3] = r; c[n * 3 + 1] = g; c[n * 3 + 2] = b; }
// 站牌：平铺在站台靠下的位置，每趟车换一个站名
const signCv = document.createElement('canvas'); signCv.width = 512; signCv.height = 160; const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 3), new THREE.MeshBasicMaterial({ map: signTex })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.03, 11.2); scene.add(m); }
function drawSign() {
  const g = signCv.getContext('2d'), [c, city, name] = station; g.fillStyle = '#14356b'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#ffc21a'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 150, 512, 10);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 ' + (name.length > 4 ? 62 : 76) + 'px "PingFang SC", sans-serif'; g.fillText(name + '站', 256, 66); g.fillStyle = '#b8d4ff'; g.font = '700 30px "PingFang SC", sans-serif'; g.fillText(c === city ? c : c + ' · ' + city, 256, 124); signTex.needsUpdate = true;
}
// 推手
const hand = new THREE.Group(); scene.add(hand);
{ const p = new THREE.Mesh(new THREE.CylinderGeometry(HAND_R, HAND_R, 0.5, 28), L(0xffffff, { emissive: 0x555555 })); p.castShadow = true; hand.add(p);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HAND_R, 0.14, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff7a3c })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; hand.add(ring);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ff7a3c'; g.font = '900 96px "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('推', 64, 70);
  const t = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); t.rotation.x = -Math.PI / 2; t.position.y = 0.27; hand.add(t); }

// ---------- 数据 ----------
const TYPES = {
  norm: { r: 0.62, m: 1, spd: 1.3, w: 10 }, kid: { r: 0.44, m: 0.5, spd: 2.4, w: 3 }, fat: { r: 0.95, m: 2.6, spd: 0.9, w: 2 },
  pack: { r: 0.72, m: 1.4, spd: 1.2, w: 3, pack: 1 }, zombie: { r: 0.62, m: 1.6, spd: 0.45, w: 2, phone: 1 },   // 低头族：自己几乎不挪，还爱堵在门口
};
const TYPE_BAG = Object.keys(TYPES).flatMap((k) => Array(TYPES[k].w).fill(k));
const SHIRTS = [[0.95, 0.35, 0.3], [0.25, 0.55, 0.95], [0.3, 0.75, 0.45], [0.98, 0.75, 0.2], [0.65, 0.4, 0.9], [0.95, 0.5, 0.7], [0.3, 0.75, 0.8], [0.9, 0.9, 0.92], [0.25, 0.28, 0.36]];
const SKINS = [[0.95, 0.79, 0.64], [0.91, 0.72, 0.55], [0.85, 0.64, 0.45], [0.96, 0.84, 0.72]], HAIRS = [[0.12, 0.1, 0.09], [0.07, 0.07, 0.07], [0.35, 0.23, 0.11], [0.6, 0.6, 0.62]];

// 出了名挤的地铁站：[国家, 城市, 站名]，每趟车随机到一站，不连着重复
const STATIONS = [["中国", "北京", "西二旗"], ["中国", "北京", "天通苑"], ["中国", "北京", "国贸"], ["中国", "北京", "西直门"], ["中国", "上海", "人民广场"], ["中国", "上海", "徐家汇"], ["中国", "广州", "体育西路"], ["中国", "广州", "珠江新城"], ["中国", "深圳", "车公庙"], ["中国", "成都", "春熙路"], ["中国", "武汉", "街道口"], ["中国", "南宁", "朝阳广场"], ["中国", "香港", "金钟"], ["中国", "台北", "台北车站"], ["日本", "东京", "新宿"], ["日本", "东京", "涩谷"], ["日本", "东京", "池袋"], ["日本", "大阪", "梅田"], ["韩国", "首尔", "新道林"], ["韩国", "首尔", "江南"], ["印度", "孟买", "达达尔"], ["印度", "德里", "拉吉夫广场"], ["新加坡", "新加坡", "裕廊东"], ["泰国", "曼谷", "暹罗"], ["菲律宾", "马尼拉", "塔夫脱大道"], ["英国", "伦敦", "牛津圆环"], ["英国", "伦敦", "银行"], ["法国", "巴黎", "夏特雷"], ["俄罗斯", "莫斯科", "共青团"], ["美国", "纽约", "时代广场"], ["墨西哥", "墨西哥城", "潘提特兰"], ["巴西", "圣保罗", "主教座堂"], ["埃及", "开罗", "烈士"]];

// ---------- 状态 ----------
let state = 'title', held = false, auto = false, muted = false;
let phase = 'arrive', phaseT = 0, round = 0, score = 0, bad = 0, timeLeft = OPEN, quota = 0, boarded = 0, carX = 0, doorK = 0, shake = 0, hurt = 0, bannerT = 0, pushSnd = 0, squeak = 0, tipT = 0;
let best = 0; try { best = +localStorage.getItem('echo_metro_best') || 0; } catch (e) { /* 存不了就算了 */ }
let people = [], station = STATIONS[0], stBag = [];
const ptr = { x: 0, z: 6, lx: 0, lz: 6, vx: 0, vz: 0, down: false, has: false }, bot = { st: 0, x: 0, z: 9 };

// ---------- 声音 ----------
let ac = null, master = null, noiseBuf = null; const lastSfx = {};
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function hiss(dur, vol, f0, f1, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, rand(0.5)); s.stop(t + dur + 0.05); }
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const sfx = {
  push: (v) => limited('push', 90, () => hiss(0.1, Math.min(0.2, 0.05 + v * 0.01), 900, 300)),
  squeak: () => limited('squeak', 110, () => tone('sine', rand(700, 1300), rand(400, 600), 0.07, 0.07)),     // 被挤得吱一声
  in: () => limited('in', 60, () => tone('triangle', rand(620, 760), 980, 0.06, 0.09)),
  out: () => limited('out', 80, () => tone('triangle', 520, 300, 0.08, 0.08)),
  chime: () => { tone('sine', 880, 880, 0.35, 0.16); tone('sine', 698, 698, 0.5, 0.16, 0.3); },
  beep: () => limited('beep', 200, () => tone('square', 1500, 1500, 0.08, 0.1)),
  shut: () => { hiss(0.3, 0.3, 1800, 200); tone('sine', 120, 50, 0.3, 0.3, 0.15); },
  pinch: () => tone('sawtooth', 700, 250, 0.2, 0.16),
  train: () => hiss(1.4, 0.22, 500, 120),
  good: () => [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.14, 0.14, i * 0.08)),
  bad: () => [300, 220, 160].forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.2, 0.16, i * 0.16)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
};
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[text], now = performance.now();
  if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text);
  if (!c || (now < sayUntil && pri <= sayPri)) { sayLast[text] = now; return; }
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
  if (state === 'title') s.innerHTML = '<h1>挤地铁</h1><div class="sub">回声 · 第 6 期</div><div class="help"><b>按住拖动</b>推手，把乘客往车厢里推<br>关门前塞进<b>目标人数</b>，塞得越多分越高<br>头顶有<b>黄箭头</b>的要下车，先把门口让出来<br>胖子难推，低头族爱堵门，小孩一推就飞<br>没塞够人数记一次投诉，三次就下岗</div>' +
    (best ? '<div class="sub" style="margin-top:12px">最高得分 ' + best + '</div>' : '') + '<button class="go" data-act="start">上 岗</button>';
  else s.innerHTML = '<h1 class="red">下岗了</h1><div class="sub">得分 ' + score + '　送走 ' + (round - 1) + ' 趟车<br>最后一站：' + station[1] + ' · ' + station[2] + '站<br>最高得分 ' + best + '</div><button class="go" data-act="start">再上一天班</button>';
}
function hud() {
  $('money').textContent = score; $('clock').textContent = station[2]; $('stL').textContent = '第 ' + round + ' 趟 · ' + (station[0] === station[1] ? station[0] : station[0] + station[1]); $('bad').textContent = '✗'.repeat(bad) + '·'.repeat(Math.max(0, 3 - bad));
  const tb = $('tbar'), open = phase === 'open'; tb.firstChild.style.width = (open ? clamp(timeLeft / OPEN, 0, 1) * 100 : 0) + '%'; tb.className = 'bar' + (open && timeLeft < 3.5 ? ' max' : ''); $('ttxt').textContent = open ? '关门倒计时 ' + Math.max(0, timeLeft).toFixed(1) + ' 秒' : phase === 'arrive' ? '列车进站' : '列车出发';
  $('name').textContent = '已上车 ' + boarded + ' / 目标 ' + quota; $('name').style.color = boarded >= quota ? '#9ff0a8' : '#fffaf0';
  const need = people.filter((p) => p.exit && p.z < 0.6).length; $('flow').innerHTML = need ? need + '<small>人要下车</small>' : '';
  $('tip').textContent = phase === 'open' && round === 1 && tipT < 5 ? '按住往上推，把人塞进车门' : '';
  $('hurt').style.opacity = hurt.toFixed(2);
}

// ---------- 乘客 ----------
function addPerson(x, z, o = {}) {
  if (people.length >= NMAX - 2) return null; const k = o.type || pick(TYPE_BAG), d = TYPES[k];
  const p = { k, d, x, z, vx: 0, vz: 0, r: d.r, m: d.m, press: 0, sq: 0, rider: false, exit: false, in: z < 0, col: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS), wob: rand(6), tx: rand(-DW + 0.8, DW - 0.8), deep: rand(-CD + 1.2, -1.2), gone: false, ...o };
  people.push(p); return p;
}
function newTrain() {
  round++; phase = 'arrive'; phaseT = 0; carX = -40; doorK = 0; boarded = 0; sfx.train();
  if (!stBag.length) stBag = [...STATIONS].sort(() => Math.random() - 0.5); station = stBag.pop(); drawSign();
  people = people.filter((p) => !p.in);                               // 上一趟车里的人跟车走了，站台上剩下的留给这一趟
  const riders = Math.min(34, 2 + round * 3), exits = round >= 2 ? Math.min(6, 1 + Math.floor(round / 2)) : 0;
  for (let i = 0; i < riders; i++) { const p = addPerson(rand(-CW + 1, CW - 1), rand(-CD + 1.6, -0.9), { type: Math.random() < 0.8 ? 'norm' : 'pack', rider: true }); if (p && i < exits) { p.exit = true; p.z = rand(-CD + 2, -2); } }
  const wait = Math.min(40, 9 + round * 3) - people.filter((p) => !p.in).length;
  for (let i = 0; i < wait; i++) addPerson(rand(-PW + 1, PW - 1), rand(2.2, PD + 3), round < 2 ? { type: Math.random() < 0.8 ? 'norm' : 'kid' } : {});
  quota = Math.max(4, Math.round(people.filter((p) => !p.in).length * Math.max(0.5, 0.72 - round * 0.012)));
  for (let k = 0; k < 30; k++) collide(0.016, true);                  // 先让大家别叠在一起
}
function endDoor() {                                                // 关门：卡在门缝上的，按重心在哪边算，夹一下
  let pinch = 0;
  for (const p of people) if (Math.abs(p.z) < p.r * 0.8 && Math.abs(p.x) < DW + 0.3) { pinch++; p.z = p.z < 0 ? -p.r - 0.1 : p.r + 0.15; p.sq = 0.5; }
  for (const p of people) p.in = p.z < 0;
  const got = people.filter((p) => p.in && !p.rider).length, stuck = people.filter((p) => p.in && p.exit).length;
  boarded = got; let pts = got * 10 + Math.max(0, got - quota) * 10 - pinch * 5 - stuck * 20; const left = people.filter((p) => !p.in && !p.exit).length;
  if (pinch) { sfx.pinch(); }
  if (got >= quota) { if (left === 0) { pts += 100; banner('全员上车　+' + pts, 1.8); } else banner('发车　+' + pts, 1.6); sfx.good(); say(pick(['挤上去了', '下一趟']), 2); }
  else { bad++; hurt = 1; shake = 0.8; banner('没塞够　投诉 +1', 1.8); sfx.bad(); say('投诉你', 3); }
  if (stuck) say('我要下车', 2);
  score = Math.max(0, score + pts);
}
function endGame() { state = 'over'; sfx.over(); if (score > best) { best = score; try { localStorage.setItem('echo_metro_best', '' + best); } catch (e) { /* 忽略 */ } } say('末班车开走了', 5); showScreen(); }
function newGame() {
  state = 'play'; score = bad = round = shake = hurt = bannerT = tipT = 0; people = [];
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'metro'; (h.played = h.played || {}).metro = k; h.last = 'metro'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 存不了就算了 */ }   // 给首页记一次打卡
  sayUntil = 0; newTrain(); showScreen();
}

// ---------- 物理：圆和圆互相挤开（留一点弹性，所以能硬塞），再被墙和车门挡住 ----------
function collide(dt, settle) {
  const n = people.length;
  for (let i = 0; i < n; i++) { const a = people[i]; for (let j = i + 1; j < n; j++) { const b = people[j]; const dx = b.x - a.x, dz = b.z - a.z, min = (a.r + b.r) * 0.9, d2 = dx * dx + dz * dz; if (d2 >= min * min) continue; const d = Math.sqrt(d2) || 0.01, ov = (min - d) * 0.55, nx = dx / d, nz = dz / d, wa = b.m / (a.m + b.m), wb = 1 - wa; a.x -= nx * ov * wa; a.z -= nz * ov * wa; b.x += nx * ov * wb; b.z += nz * ov * wb; a.press += ov; b.press += ov; } }
  const open = phase === 'open' || settle;
  for (const p of people) {
    const r = p.r * 0.85;
    if (p.in) { p.x = clamp(p.x, -CW + r, CW - r); if (p.z < -CD + r) p.z = -CD + r; if (p.z > -r && (Math.abs(p.x) > DW - r * 0.5 || !open || settle)) p.z = -r; }
    else { p.x = clamp(p.x, -PW - 6, PW + 6); if (p.z < r && (Math.abs(p.x) > DW - r * 0.5 || !open || settle) && !p.gone) p.z = r; }
    if (Math.abs(p.z) < r && Math.abs(p.x) > DW - r) p.x = clamp(p.x, -DW + r, DW - r);                      // 正在过门：别卡进门框里
    if (!settle) { const was = p.in; p.in = p.z < 0; if (p.in !== was) { if (p.in) { if (!p.rider) sfx.in(); } else sfx.out(); } }
  }
}
function physics(dt) {
  const open = phase === 'open';
  for (const p of people) {
    p.press = 0; let tx, tz, sp = p.d.spd;
    if (p.exit) { if (p.in) { tx = clamp(p.x, -DW + 1, DW - 1) * 0.6; tz = 1.5; sp = open ? 2.2 : 0; } else { tx = p.x + (p.x >= 0 ? 4 : -4); tz = PD + 6; sp = 2.6; p.gone = true; } }
    else if (p.in) { tx = p.x; tz = p.deep; sp = 0.55; }                                                          // 进了车就慢慢往里挪
    else { tx = p.tx; tz = Math.abs(p.x) < DW - 0.5 ? -1 : 1.4; sp = open ? sp : sp * 0.4; if (!open && p.z < 2.2) sp = 0; }   // 站台上的自己往门口凑
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1, dt * 5);
    p.vx += (dx / d * sp - p.vx) * k; p.vz += (dz / d * sp - p.vz) * k; p.x += p.vx * dt; p.z += p.vz * dt;
  }
  if (ptr.down && open) for (const p of people) {                    // 推手：把碰到的人顶开，并带上手的速度
    const dx = p.x - ptr.x, dz = p.z - ptr.z, min = HAND_R + p.r * 0.9, d2 = dx * dx + dz * dz; if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 0.01, ov = min - d; p.x += dx / d * ov; p.z += dz / d * ov; const g = Math.min(1, 1.1 / p.m); p.vx += (ptr.vx * 0.8 - p.vx) * g * 0.5; p.vz += (ptr.vz * 0.8 - p.vz) * g * 0.5; pushSnd += ov;
  }
  collide(dt); collide(dt);
  for (const p of people) { p.sq += (clamp(p.press * 2.2, 0, 0.5) - p.sq) * Math.min(1, dt * 10); if (p.sq > 0.34 && Math.random() < dt * 2) { sfx.squeak(); squeak++; } }
  if (pushSnd > 0.05) { sfx.push(Math.hypot(ptr.vx, ptr.vz)); pushSnd = 0; }
  people = people.filter((p) => !(p.gone && (p.z > PD + 4 || Math.abs(p.x) > PW + 5)));
}

// ---------- 每帧 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.6);
  if (state !== 'play') return;
  phaseT += dt;
  if (phase === 'arrive') { carX = -40 * (1 - Math.min(1, phaseT / 1.2)) ** 2; if (phaseT >= 1.2) { carX = 0; if (phaseT >= 1.5) { phase = 'open'; phaseT = 0; timeLeft = OPEN; sfx.chime(); banner(station[1] + ' · ' + station[2] + '站', 1.5); say(station[2] + '站到了', 2); } } doorK = clamp((phaseT - 1.2) / 0.3, 0, 1); }
  else if (phase === 'open') {
    timeLeft -= dt; tipT += dt; doorK = 1;
    if (timeLeft < OPEN - 2.2 && timeLeft > OPEN - 2.4) say(people.some((p) => p.exit && p.in) ? '先下后上' : '往里走，往里走', 1, 4000);
    if (timeLeft < 3.5) { sfx.beep(); if (timeLeft > 3.4) say('车门即将关闭', 2, 5000); }
    if (auto) autoPlay(dt);
    boarded = people.filter((p) => p.in && !p.rider).length;
    if (people.filter((p) => p.sq > 0.36).length > 6) say('别挤了', 1, 5000);
    if (timeLeft <= 0) { phase = 'close'; phaseT = 0; ptr.down = false; sfx.shut(); endDoor(); }
  } else if (phase === 'close') { doorK = 1 - clamp(phaseT / 0.35, 0, 1); if (phaseT >= 1.3) { phase = 'leave'; phaseT = 0; sfx.train(); } }
  else if (phase === 'leave') { carX = 44 * (phaseT / 1.2) ** 2; if (phaseT >= 1.2) { if (bad >= 3) { endGame(); return; } newTrain(); } }
  const sub = 2; for (let i = 0; i < sub; i++) physics(dt / sub);
  ptr.vx *= 0.8; ptr.vz *= 0.8;
}
function autoPlay(dt) {                                            // 电脑代打（测试用）：一趟一趟从站台往车门里铲
  const out = people.filter((p) => !p.in && !p.exit && !p.gone), need = people.some((p) => p.exit && p.in), sp = 15;
  if (bot.st === 0) { let cx = 0; if (out.length) { const t = pick(out); cx = t.x; } bot.x = clamp(cx, -PW + 1, PW - 1); bot.z = Math.min(PD, 2 + rand(2, 6)); bot.st = need && timeLeft > OPEN - 2.5 ? 3 : 1; bot.w = 0; ptr.down = false; ptr.x = bot.x; ptr.z = bot.z; return; }
  if (bot.st === 3) { bot.w += dt; if (bot.w > 0.5 || !need) bot.st = 1; return; }                                // 先等要下车的出来
  ptr.down = true; const tx = clamp(bot.x, -DW + 1.2, DW - 1.2) * 0.5, tz = -2.6, dx = tx - ptr.x, dz = tz - ptr.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, sp * dt);
  ptr.vx = dx / d * sp; ptr.vz = dz / d * sp; ptr.x += dx / d * st; ptr.z += dz / d * st; ptr.has = true; if (d < 0.2) bot.st = 0;
}
function draw() {
  const t = performance.now() / 1000; let nb = 0, np = 0, na = 0;
  car.position.x = carX; for (const d of doors) d.position.x = d.userData.s * (DW * 0.5 + doorK * DW);
  for (const p of people) {
    const ox = p.in ? carX : 0, s = p.r / 0.62, q = p.sq, w = 1 - q * 0.42, h = 1 + q * 0.6, bob = Math.abs(Math.sin(t * 6 + p.wob)) * 0.06 * (Math.hypot(p.vx, p.vz) > 0.3 ? 1 : 0.2);
    const red = q * 1.2, face = Math.atan2(p.vx, p.vz) || 0;
    put(bodyM, nb, p.x + ox, 0.95 * h * s + bob, p.z, s * w, s * h, s * w, p.col[0] + red * 0.3, p.col[1] * (1 - red * 0.4), p.col[2] * (1 - red * 0.4), face);
    put(headM, nb, p.x + ox, 2.0 * h * s + bob, p.z, s, s, s, Math.min(1, p.skin[0] + red * 0.2), p.skin[1] * (1 - red * 0.45), p.skin[2] * (1 - red * 0.45), face, p.d.phone ? 0.5 : 0);
    put(hairM, nb, p.x + ox, 2.06 * h * s + bob, p.z, s, s, s, p.hair[0], p.hair[1], p.hair[2], face); nb++;
    if (p.d.pack) put(packM, np++, p.x + ox - Math.sin(face) * 0.62 * s, 1.1 * h * s, p.z - Math.cos(face) * 0.62 * s, s, s, s, 0.2, 0.22, 0.3, face);
    if (p.d.phone) put(packM, np++, p.x + ox + Math.sin(face) * 0.5, 1.5 * s, p.z + Math.cos(face) * 0.5, 0.3, 0.45, 0.14, 0.6, 0.95, 1.0, face);
    if (p.exit && !p.gone) put(arrowM, na++, p.x + ox, 3.5 * s + Math.sin(t * 6) * 0.2, p.z, 1, 1, 1, 1.0, 0.82, 0.1, t * 3, Math.PI);
  }
  for (const [m, c] of [[bodyM, nb], [headM, nb], [hairM, nb], [packM, np], [arrowM, na]]) { m.count = c; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  const on = state === 'play' && phase === 'open' && ptr.has; hand.visible = on; if (on) { hand.position.set(ptr.x, ptr.down ? 0.5 : 2.4, ptr.z); hand.scale.setScalar(ptr.down ? 1 : 0.85); }
  doorMat.emissive.setHex(phase === 'open' && timeLeft < 3.5 && Math.floor(t * 6) % 2 ? 0x802010 : 0x101820);
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.4, CAM.y + rand(-1, 1) * shake * 0.3, CAM.z + rand(-1, 1) * shake * 0.3);
  hud(); composer.render();
}

// ---------- 输入：指针射到地面上 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8), hitV = new THREE.Vector3();
function locate(e) { const r = stage.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(ground, hitV)) return; ptr.x = clamp(hitV.x, -PW - 1, PW + 1); ptr.z = clamp(hitV.z, -CD + 0.5, PD + 2); ptr.has = true; }
let lastMove = 0;
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') { newGame(); return; } if (state !== 'play' || auto) return; locate(e); ptr.lx = ptr.x; ptr.lz = ptr.z; ptr.vx = ptr.vz = 0; ptr.down = true; lastMove = performance.now(); try { stage.setPointerCapture(e.pointerId); } catch (er) { /* 没有也行 */ } });
stage.addEventListener('pointermove', (e) => { if (state !== 'play' || auto) return; locate(e); const now = performance.now(), dt = Math.max(0.008, (now - lastMove) / 1000); lastMove = now; if (ptr.down) { ptr.vx = clamp((ptr.x - ptr.lx) / dt, -40, 40); ptr.vz = clamp((ptr.z - ptr.lz) / dt, -40, 40); } ptr.lx = ptr.x; ptr.lz = ptr.z; });
const up = () => { if (!auto) ptr.down = false; }; stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { e.preventDefault(); initAudio(); newGame(); } });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 调试入口
window.__metro = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on) { auto = on; bot.st = 0; },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, phase, round, station: station.join('/'), score, bad, timeLeft: +timeLeft.toFixed(1), quota, boarded, people: people.length, inside: people.filter((p) => p.in).length, wait: people.filter((p) => !p.in && !p.gone).length, exits: people.filter((p) => p.exit && p.in).length, squeak }; },
};
