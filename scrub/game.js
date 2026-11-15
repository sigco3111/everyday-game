// 《回声：搓澡大师》—— 竖屏：按住拖动搓澡巾，把顾客背上的泥搓成泥条。躲开红色痛点，赶在限时内搓到九成三干净。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];

// ---------- 尺寸 ----------
// 顾客趴在床上，头朝屏幕上方（-z）。后背是一个圆角的鼓包：半宽 AX、半长 AZ、最高处 BH。
const AX = 3.7, AZ = 5.0, BH = 1.5, NP = 3;
const GW = 48, GH = 66;                                             // 泥的网格
const NEED = 0.93, TIME = 24;                                       // 搓到这个比例算干净；每位顾客的限时（秒）
const rOf = (x, z) => (Math.abs(x / AX) ** NP + Math.abs(z / AZ) ** NP) ** (1 / NP);
const hAt = (x, z) => { const r = rOf(x, z); return r >= 1 ? 0 : BH * Math.sqrt(1 - r * r); };

// ---------- 渲染 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfe6ee);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 120);
const CAM = new THREE.Vector3(0, 23.5, 8.5), LOOK = new THREE.Vector3(0, 0, -0.6);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.5, 0.92)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() {
  H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px';
  renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.fov = W / H < 0.5 ? 56 : 50; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = H * renderer.getPixelRatio() * 0.42;
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb8c0, 0.95));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.35); sun.position.set(-8, 22, 8); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 4, far: 60 }); sun.shadow.bias = -0.002;

// 澡堂：瓷砖地、搓澡床
{
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#d9f1f5'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a9d3db'; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(8, 8, 50, 14);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 14); t.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), new THREE.MeshLambertMaterial({ map: t })); f.rotation.x = -Math.PI / 2; f.position.y = -2.2; f.receiveShadow = true; scene.add(f);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.2, 21), new THREE.MeshLambertMaterial({ color: 0x2f9db4 })); bed.position.set(0, -0.6, 0.5); bed.receiveShadow = true; scene.add(bed);
  const base = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0xe8eef0 })); base.position.set(0, -1.7, 0.5); scene.add(base);
}

// ---------- 顾客 ----------
const cust = new THREE.Group(); scene.add(cust);
function domeGeo() {                                                // 后背：极坐标铺开的圆角鼓包，uv 就是俯视投影
  const NR = 22, NS = 72, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NS; j++) {
    const r = i / NR, a = j / NS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const x = AX * r * Math.sign(c) * Math.abs(c) ** (2 / NP), z = AZ * r * Math.sign(s) * Math.abs(s) ** (2 / NP);
    pos.push(x, BH * Math.sqrt(Math.max(0, 1 - r * r)), z); uv.push(x / AX / 2 + 0.5, z / AZ / 2 + 0.5);
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + NS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const skinMat = new THREE.MeshLambertMaterial({ color: 0xf2c9a4 }), hairMat = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
const back = new THREE.Mesh(domeGeo(), skinMat); back.castShadow = true; back.receiveShadow = true; cust.add(back);
const dirt = new Float32Array(GW * GH), inside = new Uint8Array(GW * GH), dirtPix = new Uint8Array(GW * GH * 4);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) inside[j * GW + i] = rOf(((i + 0.5) / GW * 2 - 1) * AX, ((j + 0.5) / GH * 2 - 1) * AZ) < 0.985 ? 1 : 0;
const dirtTex = new THREE.DataTexture(dirtPix, GW, GH, THREE.RGBAFormat); dirtTex.magFilter = dirtTex.minFilter = THREE.LinearFilter; dirtTex.colorSpace = THREE.SRGBColorSpace;
const dirtMesh = new THREE.Mesh(back.geometry, new THREE.MeshLambertMaterial({ map: dirtTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); dirtMesh.scale.setScalar(1.012); dirtMesh.renderOrder = 2; cust.add(dirtMesh);
const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; m.castShadow = true; cust.add(m); return m; };
const sph = new THREE.SphereGeometry(1, 24, 16), cap = new THREE.CapsuleGeometry(1, 1, 6, 14);
const head = new THREE.Group(); head.position.set(0, 0.9, -6.5); cust.add(head);
{ const h = new THREE.Mesh(sph, skinMat); h.scale.set(1.55, 1.35, 1.6); h.castShadow = true; head.add(h);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat); hair.scale.set(1.6, 1.42, 1.66); hair.rotation.x = -0.5; head.add(hair);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(sph, skinMat); e.scale.set(0.3, 0.42, 0.42); e.position.set(s * 1.55, 0, 0.1); head.add(e); } }
add(sph, skinMat, 0, 0.5, -5.0, 1.5, 0.9, 0.9);                     // 脖子
for (const s of [-1, 1]) { add(sph, skinMat, s * 3.5, 0.6, -3.7, 1.3, 1.0, 1.4); add(cap, skinMat, s * 4.6, 0.35, -0.6, 0.72, 2.6, 0.72, Math.PI / 2); add(sph, skinMat, s * 4.7, 0.3, 2.9, 0.75, 0.5, 0.95); }   // 肩、胳膊、手
add(new THREE.BoxGeometry(7.6, 1.5, 3.2), new THREE.MeshLambertMaterial({ color: 0xffffff }), 0, 0.7, 6.1);                 // 盖着的毛巾
for (const s of [-1, 1]) add(cap, skinMat, s * 1.7, 0.45, 10.4, 1.25, 4.2, 1.1, Math.PI / 2);                                  // 腿
// 痛点（红圈）、香皂
const soreMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
const soreMeshes = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.6, 28), soreMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.visible = false; cust.add(m); const d = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), soreMat); d.position.z = 0.01; m.add(d); return m; });
const soap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.85), new THREE.MeshLambertMaterial({ color: 0xff9fd2, emissive: 0x40102a })); soap.castShadow = true; soap.visible = false; cust.add(soap);
// 搓澡巾
const mitt = new THREE.Group(); scene.add(mitt);
{ const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 2.3), new THREE.MeshLambertMaterial({ color: 0x35c46a })); m.castShadow = true; mitt.add(m);
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.52, 0.2), new THREE.MeshLambertMaterial({ color: 0xeafff0 })); s.position.z = -0.85 + i * 0.56; mitt.add(s); } }
// 泥条
const NMAX = 260, noodleMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, 0.7, 3, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2c }), NMAX);
noodleMesh.castShadow = true; noodleMesh.frustumCulled = false; noodleMesh.count = 0; scene.add(noodleMesh); const dummy = new THREE.Object3D();

// ---------- 粒子（水花、泡泡、热气） ----------
const PMAX = 2600;
const pPos = new Float32Array(PMAX * 3).fill(-999), pVel = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pGrav = new Float32Array(PMAX), pSize = new Float32Array(PMAX);
let pNext = 0; const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, toneMapped: false,
  vertexShader: 'attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.25, d); gl_FragColor = vec4(vC, a * 0.7); }' });
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 6; scene.add(pPoints);
function spark(x, y, z, vx, vy, vz, col, life, size = 1, grav = 16) { const i = pNext; pNext = (pNext + 1) % PMAX; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz; pCol[i * 3] = col[0]; pCol[i * 3 + 1] = col[1]; pCol[i * 3 + 2] = col[2]; pLife[i] = life; pGrav[i] = grav; pSize[i] = size; }
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; } pVel[i * 3 + 1] -= pGrav[i] * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aCol.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
}
const WATER = [0.7, 0.92, 1.0], FOAM = [1, 1, 1];

// ---------- 数据 ----------
const NAMES = ['刚下班的老王', '三天没洗的阿强', '踢完球的小李', '工地回来的大刘', '跑完马拉松的阿杰', '一周没洗的宅男', '刚挖完藕的表哥', '泥潭摔跤冠军', '半年没搓的老板', '传说中的泥人'];
const SKINS = [0xf2c9a4, 0xe8b88c, 0xd9a273, 0xf6d6b8, 0xc98f62], HAIRS = [0x2a2018, 0x111111, 0x5a3a1c, 0x8a8a8a];
const SAY = { good: ['舒服', '对，就是这里', '手法可以'], ouch: ['哎哟，轻点'], slow: ['用力点，没吃饭吗'], done: ['搓干净了', '老板大气'], next: ['下一位'], angry: ['不洗了，走了'] };

// ---------- 状态 ----------
let state = 'title', held = false, auto = false, muted = false;
let phase = 'in', phaseT = 0, time = 0, money = 0, custN = 0, bad = 0, timeLeft = TIME, total0 = 1, totalNow = 1, clean = 0, flow = 0, flowT = 0, bestFlow = 0, noodleAcc = 0, noodleCount = 0, shake = 0, hurt = 0, bannerT = 0, ouchCd = 0, foamT = 0, soapOn = false, soapAt = 0, wig = 0, slowT = 0, dirtDirty = true, R = 1.0, limit = TIME;
let best = 0; try { best = +localStorage.getItem('echo_scrub_best') || 0; } catch (e) { /* 存不了就算了 */ }
let sores = [], noodles = [];
const ptr = { x: 0, z: 0, down: false, has: false, lx: 0, lz: 0 }, bot = { x: 0, z: 0 };

// ---------- 声音 ----------
let ac = null, master = null, noiseBuf = null; const lastSfx = {};
function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; }
}
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function hiss(dur, vol, f0, f1, delay = 0, type = 'bandpass') { if (!ac || muted) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, rand(0.5)); s.stop(t + dur + 0.05); }
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const sfx = {
  scrub: (v) => limited('scrub', 75, () => hiss(0.09, 0.1 + Math.min(0.14, v * 0.01), rand(1800, 2600), rand(900, 1300))),   // 嚓、嚓
  noodle: () => limited('noodle', 50, () => tone('triangle', rand(500, 700), 300, 0.05, 0.06)),
  ouch: () => { tone('sawtooth', 520, 180, 0.3, 0.22); },
  soap: () => [660, 880, 1100, 1320].forEach((f, i) => tone('sine', f, f * 1.02, 0.14, 0.12, i * 0.06)),
  splash: () => { hiss(0.9, 0.3, 3000, 500, 0, 'lowpass'); tone('sine', 200, 60, 0.4, 0.16); },
  coin: (i = 0) => tone('square', 990 + i * 110, 1480 + i * 110, 0.09, 0.07, i * 0.07),
  bad: () => [300, 220, 160].forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.2, 0.16, i * 0.16)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
  flow: () => { tone('triangle', 660, 990, 0.12, 0.12); },
};
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[text], now = performance.now();
  bubble(text);
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
  if (state === 'title') s.innerHTML = '<h1>搓澡大师</h1><div class="sub">回声 · 第 4 期</div><div class="help"><b>按住拖动</b>搓澡巾，把背上的泥搓成泥条<br>限时内搓到 <b>93%</b> 干净，顾客满意就给小费<br>红圈是<b>痛点</b>，别碰；颜色深的是<b>老泥</b>，要多搓几遍<br>搓到<b>香皂</b>进入泡泡时间，搓得又宽又快<br>三个差评就关门</div>' +
    (best ? '<div class="sub" style="margin-top:12px">最高收入 ¥' + best + '</div>' : '') + '<button class="go" data-act="start">开 搓</button>';
  else s.innerHTML = '<h1 class="red">关门大吉</h1><div class="sub">收入 ¥' + money + '　搓了 ' + (custN - 1) + ' 位顾客<br>一共搓下 ' + noodleCount + ' 根泥条<br>最高收入 ¥' + best + '</div><button class="go" data-act="start">重新开张</button>';
}
function hud() {
  $('money').textContent = '¥' + money; $('custN').textContent = '第 ' + custN + ' 位'; $('bad').textContent = '✗'.repeat(bad) + '·'.repeat(3 - bad);
  const tb = $('tbar'); tb.firstChild.style.width = clamp(timeLeft / limit * 100, 0, 100) + '%'; tb.className = 'bar' + (timeLeft < 7 ? ' low' : ''); $('ttxt').textContent = '剩 ' + Math.max(0, timeLeft).toFixed(1) + ' 秒';
  $('cbar').firstChild.style.width = Math.round(clean * 100) + '%'; $('ctxt').textContent = '干净 ' + Math.floor(clean * 100) + '%';
  const m = Math.min(99, Math.floor(flow / 12)); $('flow').innerHTML = m >= 2 ? '×' + m + '<small>连搓</small>' : '';
  $('tip').textContent = foamT > 0 ? '泡泡时间：搓得又宽又快' : '';
  $('hurt').style.opacity = hurt.toFixed(2); $('foam').style.opacity = foamT > 0 ? 0.7 : 0;
}

// ---------- 顾客进出 ----------
function paintDirt() {
  let sum = 0;
  for (let k = 0; k < GW * GH; k++) {
    const v = inside[k] ? dirt[k] : 0, o = k * 4, d = clamp((v - 0.8) / 2.2, 0, 1); sum += v;
    dirtPix[o] = 128 - d * 62; dirtPix[o + 1] = 92 - d * 48; dirtPix[o + 2] = 56 - d * 30; dirtPix[o + 3] = Math.min(1, v * 1.25) * 238;
  }
  dirtTex.needsUpdate = true; totalNow = sum; clean = clamp(1 - sum / total0, 0, 1); dirtDirty = false;
}
function newCustomer() {
  custN++; phase = 'in'; phaseT = 0; limit = Math.max(12, TIME - (custN - 1) * 0.6); timeLeft = limit;   // 越往后限时越短 flow = 0; bestFlow = 0; foamT = 0; soapOn = false; ouchCd = 0;
  const lv = custN - 1, base = 0.6 + lv * 0.3;                                                             // 越往后泥越厚
  skinMat.color.setHex(SKINS[lv % SKINS.length]); hairMat.color.setHex(pick(HAIRS));
  for (let k = 0; k < GW * GH; k++) dirt[k] = inside[k] ? base * rand(0.75, 1.05) : 0;
  const blob = (cx, cz, rr, amt) => { for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = ((i + 0.5) / GW * 2 - 1) * AX, z = ((j + 0.5) / GH * 2 - 1) * AZ, d = Math.hypot(x - cx, z - cz); if (d < rr && inside[j * GW + i]) dirt[j * GW + i] = Math.max(dirt[j * GW + i], amt * (1 - d / rr * 0.5)); } };
  const spot = () => { for (let n = 0; n < 30; n++) { const x = rand(-AX * 0.72, AX * 0.72), z = rand(-AZ * 0.78, AZ * 0.78); if (rOf(x, z) < 0.8) return [x, z]; } return [0, 0]; };
  for (let n = 0; n < Math.min(7, 1 + Math.floor(lv * 0.8)); n++) { const [x, z] = spot(); blob(x, z, rand(0.9, 1.5), base + 1 + lv * 0.08); }     // 老泥
  sores = [];
  for (let n = 0; n < Math.min(5, Math.floor((lv + 1) / 2)); n++) { for (let q = 0; q < 20; q++) { const [x, z] = spot(); if (sores.every((s) => Math.hypot(s.x - x, s.z - z) > 2.2)) { sores.push({ x, z, r: 0.62 }); break; } } }
  for (const s of sores) for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = ((i + 0.5) / GW * 2 - 1) * AX, z = ((j + 0.5) / GH * 2 - 1) * AZ; if (Math.hypot(x - s.x, z - s.z) < s.r + 0.5) dirt[j * GW + i] = 0; }   // 痛点上不长泥，不用冒险去搓
  soreMeshes.forEach((m, i) => { const s = sores[i]; m.visible = !!s; if (s) m.position.set(s.x, hAt(s.x, s.z) + 0.1, s.z); });
  soapAt = lv >= 1 ? rand(4, 12) : 1e9; soap.visible = false;
  total0 = 0; for (let k = 0; k < GW * GH; k++) total0 += dirt[k]; paintDirt();
  $('name').textContent = NAMES[Math.min(NAMES.length - 1, lv)]; say('下一位', 1);
}
function finish(ok) {
  phase = 'out'; phaseT = 0; soap.visible = false; soapOn = false;
  if (ok) {
    const tip = 20 + Math.floor(timeLeft * 3) + Math.min(40, Math.floor(bestFlow / 12)); money += tip; banner('小费 +¥' + tip, 1.6); sfx.splash(); for (let i = 0; i < 5; i++) sfx.coin(i); say(pick(SAY.done), 2);
    for (let i = 0; i < 170; i++) { const x = rand(-AX, AX), z = rand(-AZ, AZ); spark(x, rand(5, 9), z, rand(-2, 2), rand(-8, -3), rand(1, 5), WATER, rand(0.5, 1.0), rand(1.0, 2.0), 22); }
    shake = 0.6;
  } else { bad++; banner('差评', 1.4); sfx.bad(); say('不洗了，走了', 3); hurt = 1; }
}
function endGame() { state = 'over'; sfx.over(); if (money > best) { best = money; try { localStorage.setItem('echo_scrub_best', '' + best); } catch (e) { /* 忽略 */ } } say('关门大吉', 5); showScreen(); }
function newGame() {
  state = 'play'; time = money = custN = bad = noodleCount = shake = hurt = bannerT = wig = 0; noodles = []; pLife.fill(0); pPos.fill(-999); R = 1.0;
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'scrub'; (h.played = h.played || {}).scrub = k; h.last = 'scrub'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 存不了就算了 */ }   // 给首页记一次打卡
  sayUntil = 0; newCustomer(); showScreen();
}

// ---------- 搓 ----------
function scrub(x, z, L) {
  if (phase !== 'scrub' || L <= 0) return;
  for (const s of sores) if (Math.hypot(x - s.x, z - s.z) < s.r + 0.2) { if (ouchCd <= 0) { ouchCd = 0.9; timeLeft -= 2; flow = 0; hurt = 0.8; shake = 0.7; wig = 1; sfx.ouch(); say('哎哟，轻点', 2); banner('痛！−2 秒', 0.9); } return; }
  if (soapOn && Math.hypot(x - soap.position.x, z - soap.position.z) < 1.1) { soapOn = false; soap.visible = false; foamT = 6; sfx.soap(); say('泡泡时间', 2); banner('泡泡时间', 1.3); }
  const fm = foamT > 0, rr = R * (fm ? 1.7 : 1), pw = 0.5 * (fm ? 2 : 1) * (1 + Math.min(1, Math.floor(flow / 12) * 0.06));
  const gi = (x / AX + 1) / 2 * GW, gj = (z / AZ + 1) / 2 * GH, ri = rr / (2 * AX) * GW, rj = rr / (2 * AZ) * GH; let removed = 0;
  for (let j = Math.max(0, Math.floor(gj - rj)); j <= Math.min(GH - 1, Math.ceil(gj + rj)); j++) for (let i = Math.max(0, Math.floor(gi - ri)); i <= Math.min(GW - 1, Math.ceil(gi + ri)); i++) {
    const k = j * GW + i; if (!inside[k] || dirt[k] <= 0) continue;
    const d = Math.hypot((i + 0.5 - gi) / ri, (j + 0.5 - gj) / rj); if (d >= 1) continue;
    const dv = Math.min(dirt[k], pw * L / rr * (1 - d * 0.7)); dirt[k] -= dv; removed += dv;
  }
  if (removed > 0) {
    dirtDirty = true; flow += L; flowT = 0.7; bestFlow = Math.max(bestFlow, flow); sfx.scrub(removed); noodleAcc += removed; slowT = 0;
    if (Math.floor(flow / 12) > Math.floor((flow - L) / 12) && flow >= 24) { sfx.flow(); if (Math.floor(flow / 12) % 4 === 0) say(pick(SAY.good), 1, 4000); }
    while (noodleAcc > 5) { noodleAcc -= 5; noodleCount++; sfx.noodle(); if (noodles.length < NMAX) { const side = x >= 0 ? 1 : -1; noodles.push({ x: x + rand(-0.5, 0.5), y: hAt(x, z) + 0.2, z: z + rand(-0.5, 0.5), vx: side * rand(2, 6), vy: rand(2, 5), vz: rand(-1, 4), t: 0, a: rand(6), s: rand(0.7, 1.5) }); } }
    if (fm && Math.random() < 0.6) spark(x + rand(-rr, rr), hAt(x, z) + 0.3, z + rand(-rr, rr), rand(-1, 1), rand(1, 4), rand(-1, 1), FOAM, rand(0.5, 1.1), rand(1.2, 2.6), -2);
  }
}

// ---------- 每帧 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.8); wig = Math.max(0, wig - dt * 2);
  for (const n of noodles) { n.t += dt; n.vy -= 26 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt; const fl = Math.max(hAt(n.x, n.z), Math.abs(n.x) < 5.7 ? 0 : -2.2) + 0.12; if (n.y < fl) { n.y = fl; n.vy = 0; n.vx += Math.sign(n.x || 1) * 9 * dt; n.vz *= 0.96; } }
  noodles = noodles.filter((n) => n.t < 3.2);
  if (Math.random() < 0.1) spark(rand(-9, 9), -1, rand(-12, 10), rand(-0.3, 0.3), rand(1, 2.4), 0, [1, 1, 1], rand(1.5, 3), rand(1.0, 2.2), 0);   // 热气
  if (state !== 'play') { updateParticles(dt); return; }
  time += dt; phaseT += dt; if (ouchCd > 0) ouchCd -= dt; if (foamT > 0) foamT -= dt;
  if (phase === 'in') { cust.position.x = -22 * (1 - Math.min(1, phaseT / 0.7)) ** 2; if (phaseT >= 0.7) { phase = 'scrub'; phaseT = 0; cust.position.x = 0; } }
  else if (phase === 'out') {
    if (phaseT < 0.5) { for (let k = 0; k < GW * GH; k++) dirt[k] *= 0.8; dirtDirty = true; }
    cust.position.x = phaseT > 1.2 ? 26 * ((phaseT - 1.2) / 0.6) ** 2 : 0;
    if (phaseT >= 1.8) { if (bad >= 3) { endGame(); return; } R = Math.min(1.35, 1.0 + (custN) * 0.03); newCustomer(); }
  } else {
    timeLeft -= dt;
    if (flowT > 0) { flowT -= dt; if (flowT <= 0) flow = 0; }
    slowT += dt; if (slowT > 4.5) { slowT = 0; say('用力点，没吃饭吗', 1, 6000); }
    if (!soapOn && foamT <= 0 && phaseT > soapAt) { for (let q = 0; q < 30; q++) { const x = rand(-AX * 0.6, AX * 0.6), z = rand(-AZ * 0.7, AZ * 0.7); if (sores.every((s) => Math.hypot(s.x - x, s.z - z) > 1.9)) { soap.position.set(x, hAt(x, z) + 0.3, z); soap.visible = soapOn = true; break; } } soapAt = 1e9; }
    if (auto) autoPlay(dt);
    if (clean >= NEED) finish(true); else if (timeLeft <= 0) finish(false);
  }
  if (dirtDirty) paintDirt();
  updateParticles(dt);
}
function autoPlay(dt) {                                            // 电脑代打（测试用）：扫向最脏的地方，绕开痛点
  let bk = -1, bv = 0.05;
  for (let k = 0; k < GW * GH; k++) { if (!inside[k] || dirt[k] <= bv) continue; const x = ((k % GW + 0.5) / GW * 2 - 1) * AX, z = ((Math.floor(k / GW) + 0.5) / GH * 2 - 1) * AZ; if (sores.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.45)) continue; const dd = Math.hypot(x - bot.x, z - bot.z); if (dd < 0.7) continue; const v = dirt[k] - dd * 0.12; if (v > bv) { bv = v; bk = k; } }
  if (bk < 0) return;
  const tx = ((bk % GW + 0.5) / GW * 2 - 1) * AX, tz = ((Math.floor(bk / GW) + 0.5) / GH * 2 - 1) * AZ, d = Math.hypot(tx - bot.x, tz - bot.z) || 1, step = Math.min(d, 20 * dt);
  let nx = bot.x + (tx - bot.x) / d * step, nz = bot.z + (tz - bot.z) / d * step;
  for (const s of sores) { const q = Math.hypot(nx - s.x, nz - s.z); if (q < s.r + 0.3) { const ux = (nx - s.x) / (q || 1), uz = (nz - s.z) / (q || 1); nx = s.x + ux * (s.r + 0.3) - uz * 0.25; nz = s.z + uz * (s.r + 0.3) + ux * 0.25; } }
  scrub(nx, nz, Math.hypot(nx - bot.x, nz - bot.z)); bot.x = nx; bot.z = nz; ptr.x = nx; ptr.z = nz; ptr.has = true;
}
function draw() {
  const t = performance.now() / 1000;
  cust.rotation.z = Math.sin(t * 30) * 0.03 * wig; head.rotation.y = Math.sin(t * 1.3) * 0.12 + Math.sin(t * 26) * 0.2 * wig; cust.position.y = Math.sin(t * 2) * 0.03;
  soreMat.opacity = 0.6 + 0.3 * Math.sin(t * 6); for (const m of soreMeshes) if (m.visible) m.scale.setScalar(1 + 0.12 * Math.sin(t * 6));
  if (soap.visible) { soap.rotation.y = t * 2; soap.position.y = hAt(soap.position.x, soap.position.z) + 0.45 + Math.sin(t * 4) * 0.12; }
  const rr = R * (foamT > 0 ? 1.7 : 1), on = state === 'play' && phase === 'scrub' && ptr.has;
  mitt.visible = on; if (on) { mitt.position.set(ptr.x, hAt(ptr.x, ptr.z) + (ptr.down || auto ? 0.3 : 1.1), ptr.z); mitt.scale.setScalar(rr * 0.95); mitt.rotation.y = Math.sin(t * 22) * (ptr.down || auto ? 0.12 : 0); }
  let c = 0; for (const n of noodles) { dummy.position.set(n.x + cust.position.x * 0, n.y, n.z); dummy.rotation.set(Math.PI / 2, n.a, n.a + n.t * 6); const s = n.s * (n.t > 2.6 ? (3.2 - n.t) / 0.6 : 1); dummy.scale.set(s, s, s); dummy.updateMatrix(); noodleMesh.setMatrixAt(c++, dummy.matrix); }
  noodleMesh.count = c; noodleMesh.instanceMatrix.needsUpdate = true;
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.4, CAM.y + rand(-1, 1) * shake * 0.3, CAM.z + rand(-1, 1) * shake * 0.3);
  hud(); composer.render();
}

// ---------- 输入：指针射到后背上，换算成背上的位置 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BH * 0.6), hitV = new THREE.Vector3();
function locate(e) {
  const r = stage.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(back, false)[0]; if (hit) { hitV.copy(hit.point); } else if (!ray.ray.intersectPlane(plane, hitV)) return false;
  ptr.x = hitV.x - cust.position.x; ptr.z = hitV.z; ptr.has = true; return !!hit;
}
stage.addEventListener('pointerdown', (e) => {
  initAudio(); const a = e.target.closest && e.target.closest('[data-act]');
  if (a && a.dataset.act === 'start') { newGame(); return; }
  if (state !== 'play' || auto) return; locate(e); ptr.down = true; ptr.lx = ptr.x; ptr.lz = ptr.z; try { stage.setPointerCapture(e.pointerId); } catch (er) { /* 没有也行 */ }
});
stage.addEventListener('pointermove', (e) => {
  if (state !== 'play' || auto) return; const on = locate(e);
  if (ptr.down) { const L = Math.min(2.5, Math.hypot(ptr.x - ptr.lx, ptr.z - ptr.lz)); if (on && L > 0.01) scrub(ptr.x, ptr.z, L); ptr.lx = ptr.x; ptr.lz = ptr.z; }
});
const up = () => { ptr.down = false; }; stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { e.preventDefault(); initAudio(); newGame(); } });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); paintDirt(); showScreen(); requestAnimationFrame(frame);

// 调试入口
window.__scrub = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on) { auto = on; }, scrub, foam() { foamT = 6; },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, phase, cust: custN, money, bad, timeLeft: +timeLeft.toFixed(1), clean: +clean.toFixed(3), flow: Math.floor(flow), noodles: noodleCount, sores: sores.length, soap: soapOn }; },
};
