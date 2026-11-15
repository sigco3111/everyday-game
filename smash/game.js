// 《回声：怒砸办公室》—— 竖屏：点哪砸哪，按住划过去一路砸。东西碎成渣满地飞，连砸涨倍数，怒气满了暴走：一棍一大片。限时内砸得越多越好。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const START_TIME = 35, RAGE_HITS = 18;

// ---------- 渲染 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a2f3a);
const camera = new THREE.PerspectiveCamera(50, 0.6, 0.5, 120);
const CAM = new THREE.Vector3(0, 7.8, 22), LOOK = new THREE.Vector3(0, 5.3, 0);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.fov = W / H < 0.5 ? 58 : 52; camera.updateProjectionMatrix(); }
scene.add(new THREE.HemisphereLight(0xffffff, 0x70788a, 1.0));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.25); sun.position.set(-6, 16, 12); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -4, near: 2, far: 50 }); sun.shadow.bias = -0.002;
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o }), B = (c) => new THREE.MeshBasicMaterial({ color: c });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sph = (r) => new THREE.SphereGeometry(r, 16, 12), cyl = (a, b, h, n = 16) => new THREE.CylinderGeometry(a, b, h, n);
function mk(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
// 房间：地板、后墙。墙的颜色每间不一样
const wallMat = L(0xdfe6ee), floorMat = L(0x8a93a3);
{ const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), floorMat); f.rotation.x = -Math.PI / 2; f.position.z = 6; f.receiveShadow = true; scene.add(f); const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), wallMat); w.position.set(0, 11, -3); w.receiveShadow = true; scene.add(w); mk(scene, box(40, 0.5, 0.3), L(0x5a6272), 0, 0.25, -2.85); }

// ---------- 可砸的东西 ----------
// 每样：名字、价值、要砸几下、材质（决定声音和碎片）、碎片颜色、命中半径、中心高度、怎么搭出来
const G = (f) => { const g = new THREE.Group(); f(g); return g; };
const THINGS = {
  monitor: { name: '显示器', v: 800, hp: 1, mat: 'glass', cols: [0x1c2028, 0x3aa0ff, 0x9fd4ff], r: 1.2, cy: 1.1, make: () => G((g) => { mk(g, box(2.3, 1.5, 0.16), L(0x1c2028), 0, 1.25, 0); mk(g, box(2.05, 1.25, 0.05), B(0x3aa0ff), 0, 1.25, 0.1); mk(g, box(0.25, 0.5, 0.2), L(0x1c2028), 0, 0.3, 0); mk(g, box(1.0, 0.1, 0.6), L(0x1c2028), 0, 0.05, 0); }) },
  keyboard: { name: '键盘', v: 120, hp: 1, mat: 'plastic', cols: [0x2a2f3a, 0xe8eef2, 0x555c6a], r: 0.9, cy: 0.2, make: () => G((g) => { mk(g, box(1.9, 0.14, 0.7), L(0x2a2f3a), 0, 0.07, 0); for (let i = 0; i < 10; i++) mk(g, box(0.13, 0.06, 0.13), L(0xe8eef2), -0.78 + i * 0.173, 0.17, rand(-0.2, 0.2)); }) },
  mug: { name: '咖啡杯', v: 30, hp: 1, mat: 'glass', cols: [0xffffff, 0x6a3c1c, 0xe04a3a], r: 0.55, cy: 0.35, make: () => G((g) => { mk(g, cyl(0.3, 0.26, 0.6), L(0xffffff), 0, 0.3, 0); mk(g, cyl(0.25, 0.25, 0.05), L(0x6a3c1c), 0, 0.59, 0); mk(g, new THREE.TorusGeometry(0.17, 0.05, 6, 12), L(0xffffff), 0.36, 0.3, 0); }) },
  vase: { name: '花瓶', v: 260, hp: 1, mat: 'glass', cols: [0x4ab8d8, 0xffffff, 0xff7aa8, 0x3f9a55], r: 0.75, cy: 0.9, make: () => G((g) => { mk(g, sph(0.45), L(0x4ab8d8), 0, 0.5, 0).scale.y = 1.2; mk(g, cyl(0.16, 0.24, 0.5), L(0x4ab8d8), 0, 1.1, 0); for (let i = 0; i < 3; i++) { mk(g, cyl(0.03, 0.03, 0.8, 5), L(0x3f9a55), (i - 1) * 0.14, 1.6, 0, 0, (i - 1) * 0.3); mk(g, sph(0.15), L(0xff7aa8), (i - 1) * 0.3, 2.0, 0); } }) },
  trophy: { name: '年度优秀员工奖杯', v: 500, hp: 1, mat: 'metal', cols: [0xffc21a, 0xffe27a, 0x7a5a1a], r: 0.7, cy: 0.8, make: () => G((g) => { const m = L(0xffc21a, { emissive: 0x6a4a00 }); mk(g, box(0.7, 0.2, 0.7), L(0x3a2a1a), 0, 0.1, 0); mk(g, cyl(0.08, 0.14, 0.5), m, 0, 0.45, 0); mk(g, cyl(0.42, 0.14, 0.7), m, 0, 1.05, 0); for (const s of [-1, 1]) mk(g, new THREE.TorusGeometry(0.2, 0.04, 6, 12), m, s * 0.45, 1.1, 0); }) },
  lamp: { name: '台灯', v: 150, hp: 1, mat: 'metal', cols: [0x35c46a, 0xffffff, 0x2a2f3a], r: 0.75, cy: 0.9, make: () => G((g) => { mk(g, cyl(0.38, 0.42, 0.12), L(0x2a2f3a), 0, 0.06, 0); mk(g, cyl(0.04, 0.04, 1.3, 6), L(0x2a2f3a), 0.1, 0.7, 0, 0, -0.2); mk(g, new THREE.ConeGeometry(0.5, 0.55, 14, 1, true), L(0x35c46a, { side: THREE.DoubleSide }), 0.25, 1.45, 0); mk(g, sph(0.14), B(0xfff2b0), 0.25, 1.3, 0); }) },
  papers: { name: '一摞文件', v: 10, hp: 1, mat: 'paper', cols: [0xffffff, 0xf2f2f2, 0xdfe8f2], r: 0.8, cy: 0.4, make: () => G((g) => { for (let i = 0; i < 7; i++) { const p = mk(g, box(1.1, 0.09, 1.4), L(i % 3 ? 0xffffff : 0xdfe8f2), rand(-0.06, 0.06), 0.05 + i * 0.1, rand(-0.06, 0.06)); p.rotation.y = rand(-0.15, 0.15); } }) },
  plant: { name: '绿植', v: 80, hp: 1, mat: 'plant', cols: [0x3f9a55, 0x2f7d45, 0xc98a5a, 0x5a3a1c], r: 0.8, cy: 0.9, make: () => G((g) => { mk(g, cyl(0.42, 0.32, 0.6), L(0xc98a5a), 0, 0.3, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mk(g, sph(0.34), L(i % 2 ? 0x3f9a55 : 0x2f7d45), Math.cos(a) * 0.3, 1.0 + (i % 3) * 0.25, Math.sin(a) * 0.3).scale.y = 1.5; } }) },
  tank: { name: '鱼缸', v: 600, hp: 1, mat: 'water', cols: [0x7fd8ff, 0xffffff, 0xff8a3a], r: 1.0, cy: 0.7, make: () => G((g) => { mk(g, box(1.8, 1.2, 0.9), L(0x7fd8ff, { transparent: true, opacity: 0.6 }), 0, 0.7, 0); mk(g, box(1.9, 0.12, 1.0), L(0x2a2f3a), 0, 0.06, 0); for (let i = 0; i < 3; i++) mk(g, sph(0.12), L(0xff8a3a), rand(-0.6, 0.6), rand(0.4, 1.0), 0.1).scale.x = 1.6; }) },
  printer: { name: '打印机', v: 1500, hp: 2, mat: 'plastic', cols: [0xe8eef2, 0x8a93a3, 0x2a2f3a, 0xffffff], r: 1.15, cy: 0.7, make: () => G((g) => { mk(g, box(2.0, 1.0, 1.4), L(0xe8eef2), 0, 0.5, 0); mk(g, box(1.6, 0.12, 0.9), L(0x8a93a3), 0, 1.06, -0.1); mk(g, box(1.2, 0.06, 0.9), L(0xffffff), 0, 0.35, 0.8); mk(g, box(0.5, 0.2, 0.05), B(0x35c46a), 0.6, 0.75, 0.71); }) },
  clock: { name: '打卡机', v: 300, hp: 1, mat: 'plastic', cols: [0x2a2f3a, 0xff5a3c, 0xe8eef2], r: 0.7, cy: 0.6, make: () => G((g) => { mk(g, box(0.9, 1.2, 0.3), L(0x2a2f3a), 0, 0.6, 0); mk(g, box(0.7, 0.4, 0.05), B(0xff5a3c), 0, 0.85, 0.16); mk(g, cyl(0.22, 0.22, 0.06), L(0xe8eef2), 0, 0.35, 0.16, Math.PI / 2); }) },
  cooler: { name: '饮水机', v: 400, hp: 2, mat: 'water', cols: [0x7fd8ff, 0xe8eef2, 0xffffff], r: 1.0, cy: 1.6, make: () => G((g) => { mk(g, box(1.0, 2.2, 1.0), L(0xe8eef2), 0, 1.1, 0); mk(g, cyl(0.45, 0.45, 1.1), L(0x7fd8ff, { transparent: true, opacity: 0.7 }), 0, 2.75, 0); mk(g, box(0.2, 0.2, 0.2), L(0xe0483c), -0.2, 1.5, 0.55); mk(g, box(0.2, 0.2, 0.2), L(0x3a8fe0), 0.2, 1.5, 0.55); }) },
  tower: { name: '电脑主机', v: 3000, hp: 2, mat: 'metal', cols: [0x1c2028, 0x35c46a, 0x8a93a3, 0xff5a3c], r: 0.95, cy: 0.9, make: () => G((g) => { mk(g, box(0.8, 1.8, 1.6), L(0x1c2028), 0, 0.9, 0); mk(g, box(0.06, 1.4, 1.2), B(0x35c46a), 0.41, 0.9, 0); mk(g, cyl(0.07, 0.07, 0.05), B(0xff5a3c), 0, 1.6, 0.81, Math.PI / 2); }) },
  chair: { name: '老板椅', v: 2000, hp: 3, mat: 'wood', cols: [0x1c1c22, 0x3a2a1a, 0x8a93a3], r: 1.3, cy: 1.6, make: () => G((g) => { const m = L(0x1c1c22); mk(g, box(1.6, 0.35, 1.5), m, 0, 1.3, 0); mk(g, box(1.6, 2.2, 0.35), m, 0, 2.4, -0.6); for (const s of [-1, 1]) mk(g, box(0.2, 0.2, 1.2), m, s * 0.9, 1.8, 0); mk(g, cyl(0.1, 0.1, 1.1, 8), L(0x8a93a3), 0, 0.65, 0); mk(g, cyl(0.9, 0.9, 0.12, 5), L(0x8a93a3), 0, 0.08, 0); }) },
  safe: { name: '保险柜', v: 5000, hp: 5, mat: 'metal', cols: [0x4a5262, 0x8a93a3, 0xffc21a, 0xffe27a], r: 1.3, cy: 1.1, coins: 1, make: () => G((g) => { mk(g, box(2.0, 2.2, 1.6), L(0x4a5262), 0, 1.1, 0); mk(g, box(1.6, 1.8, 0.1), L(0x5a6272), 0, 1.1, 0.82); mk(g, cyl(0.3, 0.3, 0.12), L(0xc8ced8), 0.3, 1.1, 0.9, Math.PI / 2); mk(g, box(0.1, 0.5, 0.1), L(0xc8ced8), -0.5, 1.1, 0.9); }) },
  board: { name: '白板', v: 300, hp: 1, mat: 'plastic', cols: [0xffffff, 0x8a93a3, 0xe0483c, 0x3a8fe0], r: 1.6, cy: 0, wall: 1, make: () => G((g) => { mk(g, box(3.6, 2.2, 0.12), L(0x8a93a3), 0, 0, 0); mk(g, box(3.35, 1.95, 0.06), L(0xffffff), 0, 0, 0.06); for (let i = 0; i < 4; i++) mk(g, box(rand(0.8, 2.2), 0.07, 0.02), B(pick([0xe0483c, 0x3a8fe0, 0x2a2f3a])), rand(-0.5, 0.5), 0.6 - i * 0.38, 0.1); }) },
  portrait: { name: '老板画像', v: 888, hp: 1, mat: 'wood', cols: [0xc8962a, 0xf2c9a4, 0x23262e, 0xd02a2a], r: 1.2, cy: 0, wall: 1, make: () => G((g) => { mk(g, box(1.9, 2.4, 0.14), L(0xc8962a), 0, 0, 0); mk(g, box(1.6, 2.1, 0.05), L(0x9fb8d0), 0, 0, 0.08); mk(g, sph(0.42), L(0xf2c9a4), 0, 0.3, 0.12).scale.z = 0.3; mk(g, box(1.1, 0.8, 0.06), L(0x23262e), 0, -0.6, 0.11); mk(g, box(0.12, 0.5, 0.07), L(0xd02a2a), 0, -0.55, 0.13); }) },
  banner: { name: '“奋斗”锦旗', v: 1, hp: 1, mat: 'paper', cols: [0xd02a2a, 0xffc21a], r: 1.0, cy: 0, wall: 1, make: () => G((g) => { mk(g, box(1.3, 2.2, 0.06), L(0xd02a2a), 0, 0, 0); mk(g, box(1.45, 0.1, 0.1), L(0xffc21a), 0, 1.1, 0); mk(g, box(0.5, 1.2, 0.02), B(0xffc21a), 0, 0, 0.05); }) },
  desk: { name: '办公桌', v: 1200, hp: 4, mat: 'wood', cols: [0xc9a06a, 0xa8834f, 0x8a6a3a], r: 3.2, cy: 1.5, furniture: 1, make: () => G((g) => { mk(g, box(9.6, 0.35, 3.2), L(0xc9a06a), 0, 2.85, 0); for (const s of [-1, 1]) mk(g, box(0.4, 2.7, 2.9), L(0xa8834f), s * 4.4, 1.35, 0); mk(g, box(8.4, 1.4, 0.2), L(0xa8834f), 0, 1.9, -1.3); }) },
  shelf: { name: '置物架', v: 600, hp: 2, mat: 'wood', cols: [0x8a6a3a, 0xa8834f], r: 2.8, cy: 0.1, furniture: 1, make: () => G((g) => { mk(g, box(8.6, 0.25, 1.3), L(0x8a6a3a), 0, 0, 0); for (const s of [-1, 1]) mk(g, box(0.25, 0.9, 1.1), L(0xa8834f), s * 3.6, -0.5, 0); }) },
};
// 每间屋子：名字、墙色、桌上 / 架子上 / 地上 / 墙上各摆什么
const ROOMS = [
  { name: '自己的工位', wall: 0xdfe6ee, desk: ['monitor', 'keyboard', 'mug', 'papers', 'lamp'], shelf: ['plant', 'papers', 'mug'], floor: ['tower', 'plant'], wall2: ['board'] },
  { name: '茶水间', wall: 0xd8eedf, desk: ['mug', 'mug', 'vase', 'mug', 'plant'], shelf: ['mug', 'vase', 'mug', 'plant'], floor: ['cooler', 'cooler', 'plant'], wall2: ['banner', 'clock'] },
  { name: '会议室', wall: 0xe6e0f0, desk: ['monitor', 'papers', 'mug', 'papers', 'lamp'], shelf: ['trophy', 'plant', 'vase', 'trophy'], floor: ['printer', 'chair', 'plant'], wall2: ['board', 'banner'] },
  { name: '财务室', wall: 0xf0e6d8, desk: ['monitor', 'keyboard', 'papers', 'papers', 'tank'], shelf: ['papers', 'trophy', 'papers', 'vase'], floor: ['safe', 'printer', 'tower'], wall2: ['clock', 'banner'] },
  { name: '老板办公室', wall: 0xe8d8d8, desk: ['monitor', 'trophy', 'tank', 'vase', 'lamp'], shelf: ['trophy', 'trophy', 'vase', 'trophy'], floor: ['chair', 'safe', 'tower'], wall2: ['portrait', 'banner'] },
];

// ---------- 碎片（实例方块）、纸片、粒子 ----------
const SMAX = 900, dummy = new THREE.Object3D();
const shardM = new THREE.InstancedMesh(box(1, 1, 1), L(0xffffff), SMAX); shardM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SMAX * 3).fill(1), 3); shardM.castShadow = true; shardM.frustumCulled = false; shardM.count = 0; scene.add(shardM);
let shards = [];
const tmpC = new THREE.Color();
function spawnShards(x, y, z, n, cols, spd, o = {}) {
  for (let i = 0; i < n; i++) {
    if (shards.length >= SMAX) shards.shift();
    const a = rand(Math.PI * 2), s = spd * rand(0.3, 1), paper = o.paper; tmpC.setHex(pick(cols));
    shards.push({ x: x + rand(-0.4, 0.4), y: y + rand(-0.3, 0.5), z: z + rand(-0.3, 0.3), vx: Math.cos(a) * s + (o.dx || 0), vy: rand(2, 9) * (paper ? 0.9 : 1) + (o.up || 0), vz: Math.abs(Math.sin(a)) * s * 0.8 + rand(0, 3), sx: paper ? rand(0.3, 0.5) : rand(0.1, o.big ? 0.5 : 0.32), sy: paper ? 0.02 : rand(0.08, o.big ? 0.4 : 0.26), sz: paper ? rand(0.4, 0.6) : rand(0.1, o.big ? 0.45 : 0.3),
      rx: rand(6), ry: rand(6), wx: rand(-9, 9), wy: rand(-9, 9), r: tmpC.r, g: tmpC.g, b: tmpC.b, t: 0, paper, coin: o.coin, rest: false });
  }
}
const PMAX = 1500, pPos = new Float32Array(PMAX * 3).fill(-999), pVel = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX); let pNext = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })); pPoints.frustumCulled = false; scene.add(pPoints);
function puff(x, y, z, n, hex, spd, up = 6) { tmpC.setHex(hex); for (let k = 0; k < n; k++) { const i = pNext; pNext = (pNext + 1) % PMAX; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = rand(-spd, spd); pVel[i * 3 + 1] = rand(1, up); pVel[i * 3 + 2] = rand(-spd * 0.3, spd); pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b; pLife[i] = rand(0.35, 0.9); } }
// 命中的闪光圈、球棒
const flash = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false })); flash.renderOrder = 8; scene.add(flash);
const bat = new THREE.Group(); scene.add(bat); { mk(bat, cyl(0.2, 0.09, 3.6, 10), L(0xd9a45a), 0, 1.8, 0); mk(bat, cyl(0.11, 0.11, 0.6, 8), L(0x2a2f3a), 0, 0.15, 0); } bat.visible = false;

// ---------- 状态 ----------
let state = 'title', held = false, auto = false, muted = false;
let time = 0, money = 0, timeLeft = START_TIME, roomN = 0, combo = 0, comboT = 0, bestCombo = 0, rage = 0, rageT = 0, stop = 0, shake = 0, bannerT = 0, flashT = 0, batT = 0, smashed = 0, phase = 'in', phaseT = 0, botT = 0, loop = 0, lastHit = '';
let best = 0; try { best = +localStorage.getItem('echo_smash_best') || 0; } catch (e) { /* 存不了就算了 */ }
let things = [];
const ptr = { down: false };

// ---------- 声音 ----------
let ac = null, master = null, noiseBuf = null; const lastSfx = {};
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function noise(dur, vol, f0, f1, type = 'bandpass', delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = type; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, rand(0.5), dur + 0.05); }
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const sfx = {
  thump: () => limited('thump', 40, () => { tone('sine', 150, 45, 0.16, 0.4); noise(0.06, 0.3, 900, 300); }),                       // 棍子砸上去的闷响
  glass: () => limited('glass', 50, () => { noise(0.35, 0.34, 5200, 2600, 'highpass'); for (let i = 0; i < 4; i++) tone('triangle', rand(2400, 5200), rand(1800, 3000), 0.09, 0.07, i * 0.035); }),   // 哗啦
  wood: () => limited('wood', 50, () => { noise(0.2, 0.36, 700, 220); tone('square', 190, 70, 0.13, 0.18); }),                           // 咔嚓
  metal: () => limited('metal', 50, () => { tone('square', 520, 380, 0.35, 0.14); tone('triangle', 1310, 1100, 0.45, 0.1); noise(0.08, 0.26, 2600, 1200); }),   // 当
  plastic: () => limited('plastic', 50, () => { noise(0.14, 0.34, 1700, 500); tone('square', 320, 120, 0.09, 0.14); }),
  paper: () => limited('paper', 50, () => { noise(0.28, 0.24, 3400, 1500, 'highpass'); }),
  plant: () => limited('plant', 50, () => { noise(0.2, 0.26, 1100, 380); tone('sine', 200, 80, 0.14, 0.2); }),
  water: () => limited('water', 50, () => { noise(0.55, 0.36, 2600, 380, 'lowpass'); noise(0.3, 0.26, 5200, 2600, 'highpass'); }),
  coins: () => { for (let i = 0; i < 9; i++) tone('square', rand(1500, 2400), rand(1800, 2800), 0.07, 0.06, i * 0.045); },
  combo: (c) => { const f = 392 * 2 ** (Math.min(24, Math.floor(c / 2)) / 12); tone('triangle', f, f * 1.01, 0.09, 0.09); },
  rage: () => { [196, 262, 330, 392, 523].forEach((f, i) => tone('sawtooth', f, f * 1.02, 0.16, 0.12, i * 0.05)); noise(0.6, 0.2, 300, 2400); },
  room: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.14, 0.14, i * 0.07)),
  over: () => { for (let i = 0; i < 6; i++) tone('square', i % 2 ? 880 : 660, i % 2 ? 880 : 660, 0.16, 0.12, i * 0.17); },   // 保安的哨子
};
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text); sayLast[text] = now;
  if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 已经放完 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
function banner(text, sec = 1.1) { $('banner').textContent = text; bannerT = sec; }

// ---------- 界面 ----------
const fmt = (n) => '¥' + Math.round(n).toLocaleString();
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  if (state === 'title') s.innerHTML = '<h1>怒砸办公室</h1><div class="sub">回声 · 第 10 期</div><div class="help"><b>点哪砸哪</b>，按住划过去一路砸<br>连着砸，损失金额的倍数越来越高<br>怒气满了进入<b>暴走</b>：一棍砸一大片<br>桌上的东西砸完，才能砸桌子<br>砸光一间加时间、换下一间；保安到之前尽量砸</div>' +
    (best ? '<div class="sub" style="margin-top:12px">最高损失 ' + fmt(best) + '</div>' : '') + '<button class="go" data-act="start">开 砸</button>';
  else s.innerHTML = '<h1 class="red">保安来了</h1><div class="sub">造成损失 ' + fmt(money) + '<br>砸了 ' + smashed + ' 样东西　砸光 ' + (roomN - 1) + ' 间<br>最多连砸 ' + bestCombo + '　最高损失 ' + fmt(best) + '</div><button class="go" data-act="start">再砸一次</button>';
}
function hud() {
  $('money').textContent = fmt(money); $('clock').textContent = ROOMS[(roomN - 1 + ROOMS.length * 9) % ROOMS.length].name; $('bad').textContent = combo;
  const tb = $('tbar'); tb.firstChild.style.width = clamp(timeLeft / START_TIME, 0, 1) * 100 + '%'; tb.className = 'bar' + (timeLeft < 6 ? ' max' : ''); $('ttxt').textContent = '保安还有 ' + Math.max(0, timeLeft).toFixed(1) + ' 秒到';
  $('rbar').firstChild.style.width = (rageT > 0 ? rageT / 6 : rage / RAGE_HITS) * 100 + '%'; $('rtxt').textContent = rageT > 0 ? '暴走中' : '怒气';
  $('name').textContent = lastHit; const m = 1 + Math.min(4, combo * 0.05); $('flow').innerHTML = combo >= 4 ? '×' + m.toFixed(1) + '<small>倍损失</small>' : '';
  $('tip').textContent = roomN === 1 && smashed === 0 ? '点一下，或者按住划过去' : ''; $('foam').style.opacity = rageT > 0 ? 0.8 : 0; $('hurt').style.opacity = 0;
}

// ---------- 布置房间 ----------
function addThing(kind, x, y, z, slot) { const d = THINGS[kind], g = d.make(); g.position.set(x, y + 16, z); scene.add(g); const t = { kind, d, g, x, y, z, hp: d.hp, max: d.hp, on: true, slot, drop: rand(0, 0.25), dent: 0, tilt: rand(-0.05, 0.05) }; things.push(t); return t; }
function clearRoom() { for (const t of things) scene.remove(t.g); things = []; }
function newRoom() {
  roomN++; loop = Math.floor((roomN - 1) / ROOMS.length); const r = ROOMS[(roomN - 1) % ROOMS.length]; clearRoom(); phase = 'in'; phaseT = 0; wallMat.color.setHex(r.wall);
  addThing('desk', 0, 0, 0.6, 'f'); addThing('shelf', 0, 7.0, -2.1, 'f');
  r.desk.forEach((k, i) => addThing(k, -3.7 + i * 1.85 + rand(-0.15, 0.15), 3.03, 0.6 + rand(-0.4, 0.5), 'desk'));
  r.shelf.forEach((k, i) => addThing(k, -3.0 + i * (6 / Math.max(1, r.shelf.length - 1)), 7.13, -2.1, 'shelf'));
  r.floor.forEach((k, i) => addThing(k, (r.floor.length === 2 ? [-3.4, 3.4] : [-3.9, 0, 3.9])[i], 0, 4.4 + (i === 1 && r.floor.length === 3 ? 0.8 : 0), 'floor'));
  r.wall2.forEach((k, i) => addThing(k, r.wall2.length === 1 ? 0 : (i ? 2.6 : -2.6), 10.6, -2.75, 'wall'));
  banner(r.name, 1.2); if (roomN > 1) say('下一间', 1);
}
const blocked = (t) => t.d.furniture && things.some((o) => o.on && o.slot === (t.kind === 'desk' ? 'desk' : 'shelf'));   // 上面还有东西，先别砸家具

// ---------- 砸 ----------
function hit(t, power = 1, sx = 0) {
  if (!t.on || phase !== 'play') return;
  t.hp -= power; t.dent = 1; const d = t.d, cx = t.x, cy = t.y + d.cy + (d.wall ? 0 : 0.2), cz = t.z, dead = t.hp <= 0;
  combo++; comboT = 1.3; bestCombo = Math.max(bestCombo, combo); if (rageT <= 0) { rage++; if (rage >= RAGE_HITS) startRage(); }
  sfx.thump(); sfx[d.mat](); sfx.combo(combo); batT = 0.16; bat.position.set(cx + 1.2, cy - 1.4, cz + 1.6); flash.position.set(cx, cy, cz + 0.6); flash.lookAt(camera.position); flashT = 0.14;
  const paper = d.mat === 'paper';
  if (dead) {
    t.on = false; scene.remove(t.g); smashed++; const mult = (1 + Math.min(4, combo * 0.05)) * (1 + loop * 0.5), gain = d.v * mult; money += gain; lastHit = d.name + '　' + fmt(gain);
    const big = d.r > 1.1; spawnShards(cx, cy, cz, paper ? 36 : big ? 46 : 24, d.cols, big ? 9 : 7, { dx: sx * 3, paper, big, up: big ? 2 : 0 });
    if (d.mat === 'water') puff(cx, cy, cz, 70, 0x9fe0ff, 6, 9); else puff(cx, cy, cz, 16, 0xd8d8d8, 4, 4);
    if (d.coins) { spawnShards(cx, cy, cz, 60, [0xffc21a, 0xffe27a], 10, { coin: 1, up: 4 }); sfx.coins(); say('这个值钱', 2); }
    stop = big ? 0.09 : 0.045; shake = Math.max(shake, big ? 1 : 0.5);
    if (d.v >= 1500) banner(d.name + '　' + fmt(gain), 1.1); if (t.kind === 'clock') say('打卡机，砸', 2, 3000); else if (t.kind === 'chair' || t.kind === 'portrait') say('砸得好', 2, 3000);
    if (combo === 15) say('爽', 1); if (combo === 30) banner('停不下来　×' + combo, 1); if (combo === 60) banner('拆迁队　×' + combo, 1);
    if (rageT > 0 && power < 99) for (const o of things) if (o.on && o !== t && !blocked(o) && Math.hypot(o.x - t.x, (o.y + o.d.cy) - (t.y + d.cy)) < 3.6) hit(o, 99, Math.sign(o.x - t.x));   // 暴走：连带旁边的一起碎
    if (!things.some((o) => o.on)) roomDone();
  } else { spawnShards(cx, cy, cz, 7, d.cols, 5, { dx: sx * 2 }); puff(cx, cy, cz, 6, 0xd8d8d8, 3, 3); stop = 0.03; shake = Math.max(shake, 0.35); lastHit = d.name + '　还差 ' + t.hp + ' 下'; }
}
function startRage() { rage = 0; rageT = 6; sfx.rage(); banner('暴 走', 1.2); say('暴走', 3); shake = 1; }
function roomDone() { if (phase !== 'play') return; const add = Math.max(2, 7 - roomN * 0.6), bonus = 500 * roomN; money += bonus; timeLeft = Math.min(START_TIME + 5, timeLeft + add); phase = 'out'; phaseT = 0; sfx.room(); banner('砸光了　+' + add.toFixed(0) + ' 秒', 1.2); }
function endGame() { state = 'over'; sfx.over(); if (money > best) { best = Math.round(money); try { localStorage.setItem('echo_smash_best', '' + best); } catch (e) { /* 忽略 */ } } say('保安来了', 5); showScreen(); }
function newGame() {
  state = 'play'; time = money = combo = comboT = bestCombo = rage = rageT = stop = shake = bannerT = smashed = roomN = 0; timeLeft = START_TIME; shards = []; lastHit = '';
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'smash'; (h.played = h.played || {}).smash = k; h.last = 'smash'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 存不了就算了 */ }   // 给首页记一次打卡
  sayUntil = 0; newRoom(); say('开砸', 2); showScreen();
}

// ---------- 每帧 ----------
function update(real) {
  if (bannerT > 0) { bannerT -= real; if (bannerT <= 0) $('banner').textContent = ''; }
  let dt = real; if (stop > 0) { stop -= real; dt *= 0.06; }                // 命中停顿：砸中的一瞬间画面顿一下
  shake = Math.max(0, shake - real * 4); flashT = Math.max(0, flashT - real); batT = Math.max(0, batT - real);
  for (const s of shards) {
    s.t += dt; if (s.rest) continue;
    s.vy -= (s.paper ? 7 : 24) * dt; if (s.paper) { s.vx *= 1 - 1.5 * dt; s.vz *= 1 - 1.5 * dt; s.vx += Math.sin(s.t * 6 + s.rx) * 4 * dt; if (s.vy < -2.2) s.vy = -2.2; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rx += s.wx * dt; s.ry += s.wy * dt;
    if (s.z < -2.6) { s.z = -2.6; s.vz = Math.abs(s.vz) * 0.4; }
    if (s.y < s.sy / 2) { s.y = s.sy / 2; if (Math.abs(s.vy) < 2 || s.paper) { s.rest = true; s.rx = 0; } else { s.vy *= -0.35; s.vx *= 0.6; s.vz *= 0.6; s.wx *= 0.5; s.wy *= 0.5; } }
  }
  for (let i = 0; i < PMAX; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; } pVel[i * 3 + 1] -= 14 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
  for (const t of things) t.dent = Math.max(0, t.dent - real * 6);
  if (state !== 'play') return;
  time += dt; phaseT += dt;
  if (phase === 'in') { if (phaseT > 0.75) phase = 'play'; }
  else if (phase === 'out') { if (phaseT > 0.7) newRoom(); }
  else {
    timeLeft -= dt; if (rageT > 0) rageT -= dt;
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
    if (auto) { botT -= dt; if (botT <= 0) { botT = botGap; const c = things.filter((t) => t.on && !blocked(t)); if (c.length) hit(pick(c)); } }
    if (timeLeft <= 0) endGame();
  }
}
let botGap = 0.2;
function draw() {
  const t = performance.now() / 1000;
  for (const o of things) { if (!o.on) continue; const k = phase === 'in' ? clamp((phaseT - o.drop) / 0.4, 0, 1) : 1, e = 1 - (1 - k) ** 3, bounce = k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.3, cr = 1 - o.hp / o.max;
    o.g.position.set(o.x + (o.dent ? rand(-0.06, 0.06) * o.dent : 0), o.y + 16 * (1 - e) + bounce, o.z); o.g.rotation.z = o.tilt * cr * 4 + o.dent * 0.06; o.g.scale.set(1 + o.dent * 0.08, 1 - o.dent * 0.1 - cr * 0.08, 1 + o.dent * 0.08); }
  let n = 0; for (const s of shards) { dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(s.rx, s.ry, 0); dummy.scale.set(s.sx, s.sy, s.sz); dummy.updateMatrix(); shardM.setMatrixAt(n, dummy.matrix); const c = shardM.instanceColor.array, sh = s.coin ? 1.25 : 1; c[n * 3] = s.r * sh; c[n * 3 + 1] = s.g * sh; c[n * 3 + 2] = s.b * sh; n++; }
  shardM.count = n; shardM.instanceMatrix.needsUpdate = true; shardM.instanceColor.needsUpdate = true;
  flash.material.opacity = flashT / 0.14 * 0.9; flash.scale.setScalar(1 + (1 - flashT / 0.14) * 2.2 * (rageT > 0 ? 1.8 : 1));
  bat.visible = batT > 0; if (bat.visible) { const k = 1 - batT / 0.16; bat.rotation.set(0.4, 0, 1.9 - k * 2.6); }
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.35, CAM.y + rand(-1, 1) * shake * 0.3, CAM.z + rand(-1, 1) * shake * 0.2);
  hud(); composer.render();
}

// ---------- 输入：从指针射一条线，离线最近的那样东西挨砸 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v3 = new THREE.Vector3(); let lastT = null, lastX = 0;
function strike(e, drag) {
  const r = stage.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera);
  let bestT = null, bd = 1e9; for (const t of things) { if (!t.on || blocked(t)) continue; v3.set(t.x, t.y + t.d.cy, t.z); const d = ray.ray.distanceToPoint(v3), lim = t.d.r * (t.d.furniture ? 0.7 : 1.05) * (rageT > 0 ? 1.3 : 1); if (d < lim && d / lim < bd) { bd = d / lim; bestT = t; } }
  const sx = Math.sign(e.clientX - lastX); lastX = e.clientX;
  if (!bestT) { lastT = null; return; } if (drag && bestT === lastT) return; lastT = bestT; hit(bestT, 1, sx);
}
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') { newGame(); return; } if (state !== 'play' || auto) return; ptr.down = true; lastT = null; lastX = e.clientX; strike(e, false); try { stage.setPointerCapture(e.pointerId); } catch (er) { /* 没有也行 */ } });
stage.addEventListener('pointermove', (e) => { if (state === 'play' && ptr.down && !auto) strike(e, true); });
const up = () => { ptr.down = false; lastT = null; }; stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { e.preventDefault(); initAudio(); newGame(); } });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 调试入口
window.__smash = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on, gap) { auto = on; if (gap) botGap = gap; }, rage: () => startRage(),
  where(kind) { const t = things.find((o) => o.on && o.kind === kind); if (!t) return null; v3.set(t.x, t.y + t.d.cy, t.z).project(camera); return [(v3.x + 1) / 2, (1 - v3.y) / 2]; },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, phase, room: roomN, money: Math.round(money), timeLeft: +timeLeft.toFixed(1), combo, bestCombo, smashed, left: things.filter((t) => t.on).length, shards: shards.length, rage, rageT: +rageT.toFixed(1) }; },
};
