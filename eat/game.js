// 《메아리: 먹는 대로 싸기》—— 세로 화면 러닝: 작은 짐승 "냠냠이"가 계속 앞으로 달리고, 먹는 것에 맞는 똥탄을 싸서 뒤쫓아오는 잡식괴물을 때립니다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 필드 ----------
// 냠냠이는 z = 0 에 고정, -z(화면 위쪽)를 향해 달림. 먹이는 앞(-z)에서 마주 오고, 잡식괴물은 뒤(+z, 화면 아래쪽)에서 쫓아옴.
const HALF = 6.2;            // 길의 반폭
const LANES = [-4.8, -2.4, 0, 2.4, 4.8];
const FOOD_Z = -58, BACK_Z = 22;
const STAGE_LEN = 20;

// ---------- 렌더링 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;   // 톤을 누르지 않아야 색이 산다
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0f0); scene.fog = new THREE.Fog(0x8fd0f0, 62, 110);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 220);
const CAM = new THREE.Vector3(0, 32, 27), LOOK = new THREE.Vector3(0, 0, 3);   // 냠냠이는 화면 중간보다 위, 아래 반은 추격자와 똥탄용
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() {
  H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62));
  stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H);
  camera.aspect = W / H; camera.fov = W / H < 0.5 ? 56 : 50; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = H * renderer.getPixelRatio() * 0.42;   // 파티클은 작게, 괴물과 똥탄을 가리면 안 됨
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a6a3a, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
sun.position.set(-12, 34, 14); sun.target.position.set(0, 0, -14); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 44, bottom: -34, near: 5, far: 110 }); sun.shadow.bias = -0.0015;

function stripeTex(a, b, n) {                                      // 가로줄무늬 텍스처: 스크롤돼야 달리는 게 보임
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * 256 / n, 64, 256 / n + 1); }
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,' + rand(0.02, 0.08) + ')'; g.fillRect(rand(64), rand(256), rand(2, 7), rand(2, 5)); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const roadTex = stripeTex('#b98a55', '#a97c4a', 8), grassTex = stripeTex('#3f9a55', '#368c4b', 8);
roadTex.repeat.set(1, 5); grassTex.repeat.set(1, 5);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(90, 130), new THREE.MeshLambertMaterial({ map: grassTex })); g.rotation.x = -Math.PI / 2; g.position.set(0, -0.05, -30); g.receiveShadow = true; scene.add(g);
  const r = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 1.2, 130), new THREE.MeshLambertMaterial({ map: roadTex })); r.rotation.x = -Math.PI / 2; r.position.set(0, 0, -30); r.receiveShadow = true; scene.add(r);
}

// ---------- 모델(병합 지오메트리 + 정점 색) ----------
const m4 = new THREE.Matrix4(), eul = new THREE.Euler(), quat = new THREE.Quaternion(), v3a = new THREE.Vector3(), v3b = new THREE.Vector3();
function part(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(m4.compose(v3a.set(x, y, z), quat.setFromEuler(eul.set(rx, ry, rz)), v3b.set(sx, sy, sz)));
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g;
}
const model = (...ps) => mergeGeometries(ps);
const G = {
  box: (a, b, c) => new THREE.BoxGeometry(a, b, c), cyl: (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n),
  sph: (r) => new THREE.IcosahedronGeometry(r, 2), cone: (r, h, n = 10) => new THREE.ConeGeometry(r, h, n),
  dode: (r) => new THREE.DodecahedronGeometry(r, 0), tor: (r, t) => new THREE.TorusGeometry(r, t, 6, 12),
};
const vcMat = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
const dummy = new THREE.Object3D();
function inst(geo, mat, max, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  m.count = 0; m.frustumCulled = false; m.castShadow = !!shadow; m.userData.n = 0; m.userData.max = max; scene.add(m); return m;
}
function put(m, x, y, z, ry, sx, sy, sz, r = 1, g = 1, b = 1, rx = 0, rz = 0) {
  const i = m.userData.n; if (i >= m.userData.max) return; m.userData.n++;
  dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
  dummy.matrix.toArray(m.instanceMatrix.array, i * 16);
  const c = m.instanceColor.array; c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
}
const PINK = [1.0, 0.62, 0.68], PINK2 = [0.92, 0.48, 0.56], DARK = [0.12, 0.08, 0.08], WHITE = [1, 1, 1];
// 냠냠이: 통통한 작은 짐승, 엉덩이가 카메라(+z) 쪽, 말린 꼬리
const petGeo = model(
  part(G.sph(1.25), PINK, 0, 1.45, 0, 0, 0, 0, 1, 0.92, 1.12), part(G.sph(0.82), PINK, 0, 2.1, -1.05),
  part(G.cyl(0.36, 0.4, 0.4), PINK2, 0, 2.0, -1.85, Math.PI / 2), part(G.sph(0.09), DARK, 0.13, 2.0, -2.06), part(G.sph(0.09), DARK, -0.13, 2.0, -2.06),
  part(G.cone(0.3, 0.55, 4), PINK2, 0.5, 2.85, -1.0, 0, 0, -0.4), part(G.cone(0.3, 0.55, 4), PINK2, -0.5, 2.85, -1.0, 0, 0, 0.4),
  part(G.sph(0.13), DARK, 0.42, 2.4, -1.72), part(G.sph(0.13), DARK, -0.42, 2.4, -1.72),
  part(G.cyl(0.26, 0.22, 0.7, 8), PINK2, 0.62, 0.35, -0.6), part(G.cyl(0.26, 0.22, 0.7, 8), PINK2, -0.62, 0.35, -0.6),
  part(G.cyl(0.26, 0.22, 0.7, 8), PINK2, 0.62, 0.35, 0.65), part(G.cyl(0.26, 0.22, 0.7, 8), PINK2, -0.62, 0.35, 0.65),
  part(G.tor(0.26, 0.09), PINK2, 0, 1.9, 1.42, 0, Math.PI / 2, 0));
const pet = new THREE.Mesh(petGeo, vcMat()); pet.castShadow = true; scene.add(pet);
// 잡식괴물: 둥근 몸에 큰 입, -z 쪽으로 추격
const foeGeo = model(
  part(G.sph(0.9), WHITE, 0, 0.95, 0, 0, 0, 0, 1, 0.9, 1), part(G.box(1.1, 0.34, 0.5), DARK, 0, 0.7, -0.62),
  part(G.box(0.2, 0.2, 0.12), [3, 3, 3], 0.3, 0.84, -0.86), part(G.box(0.2, 0.2, 0.12), [3, 3, 3], -0.3, 0.84, -0.86), part(G.box(0.2, 0.2, 0.12), [3, 3, 3], 0, 0.56, -0.86),
  part(G.sph(0.2), [3, 3, 3], 0.36, 1.5, -0.5), part(G.sph(0.2), [3, 3, 3], -0.36, 1.5, -0.5), part(G.sph(0.1), DARK, 0.36, 1.52, -0.68), part(G.sph(0.1), DARK, -0.36, 1.52, -0.68),
  part(G.cone(0.16, 0.5, 5), WHITE, 0.5, 1.75, 0.1, 0, 0, -0.5), part(G.cone(0.16, 0.5, 5), WHITE, -0.5, 1.75, 0.1, 0, 0, 0.5));
// 한 덩이: 위로 갈수록 작아지는 세 층, 꼭대기는 뾰족. 흰색이고 인스턴스 색으로 각 맛을 입힘
const poopGeo = model(part(G.sph(0.7), [1, 1, 1], 0, 0.36, 0, 0, 0, 0, 1, 0.6, 1), part(G.sph(0.52), [0.92, 0.92, 0.92], 0, 0.82, 0, 0, 0, 0, 1, 0.62, 1),
  part(G.sph(0.34), [1, 1, 1], 0, 1.18, 0, 0, 0, 0, 1, 0.66, 1), part(G.cone(0.16, 0.36, 8), [0.92, 0.92, 0.92], 0.05, 1.5, 0, 0, 0, -0.25));
// 먹이: type -> { 이름, 배 속에 표시할 글자, 색, 싸면 나오는 것의 이름, 모델 }
const FOODS = {
  corn: { name: '옥수수', ch: '옥', css: '#ffd84a', col: [1.0, 0.82, 0.22], poop: '옥수수포', w: 30,
    geo: model(part(G.cyl(0.42, 0.3, 1.5, 10), [1.0, 0.85, 0.2], 0, 1.3, 0), part(G.sph(0.42), [1.0, 0.85, 0.2], 0, 2.05, 0), part(G.cone(0.5, 1.0, 5), [0.3, 0.75, 0.25], 0.2, 0.85, 0, 0, 0, -0.5), part(G.cone(0.5, 1.0, 5), [0.3, 0.75, 0.25], -0.2, 0.85, 0, 0, 0, 0.5)) },
  chili: { name: '고추', ch: '매', css: '#ff5a3c', col: [1.6, 0.4, 0.12], poop: '화염똥', w: 16,
    geo: model(part(G.cone(0.42, 1.7, 10), [0.95, 0.15, 0.1], 0, 1.25, 0, Math.PI, 0, 0.25), part(G.sph(0.42), [0.95, 0.15, 0.1], 0.2, 2.05, 0), part(G.cyl(0.08, 0.1, 0.5, 6), [0.25, 0.65, 0.2], 0.3, 2.5, 0, 0, 0, -0.4)) },
  ice: { name: '아이스크림', ch: '얼', css: '#8fe6ff', col: [0.55, 1.2, 1.5], poop: '얼음똥', w: 14,
    geo: model(part(G.cone(0.5, 1.3, 10), [0.9, 0.7, 0.4], 0, 0.95, 0, Math.PI), part(G.sph(0.56), [1.0, 0.7, 0.8], 0, 1.85, 0), part(G.sph(0.42), [0.95, 0.97, 1.0], 0, 2.5, 0)) },
  bean: { name: '콩', ch: '콩', css: '#9be86b', col: [0.6, 1.2, 0.35], poop: '연발 방귀', w: 14,
    geo: model(part(G.sph(0.42), [0.45, 0.8, 0.25], -0.62, 1.4, 0), part(G.sph(0.46), [0.5, 0.85, 0.28], 0, 1.5, 0), part(G.sph(0.42), [0.45, 0.8, 0.25], 0.62, 1.4, 0), part(G.cyl(0.3, 0.3, 1.9, 8), [0.35, 0.68, 0.2], 0, 1.4, 0, 0, 0, Math.PI / 2, 1, 1, 0.6)) },
  melon: { name: '수박', ch: '수', css: '#4fd07a', col: [0.3, 0.85, 0.4], poop: '점보', w: 12,
    geo: model(part(G.sph(0.95), [0.2, 0.6, 0.25], 0, 1.4, 0), part(G.cyl(0.8, 0.8, 0.12, 14), [1.0, 0.3, 0.35], 0, 1.4, -0.7, Math.PI / 2), part(G.box(0.14, 1.9, 0.14), [0.1, 0.36, 0.14], 0.5, 1.4, 0.72), part(G.box(0.14, 1.9, 0.14), [0.1, 0.36, 0.14], -0.5, 1.4, 0.72)) },
  candy: { name: '무지개 사탕', ch: '사', css: '#ff8fe0', col: [1.4, 0.5, 1.2], poop: '무지개똥', w: 6,
    geo: model(part(G.cyl(0.75, 0.75, 0.24, 16), [1.0, 0.45, 0.8], 0, 1.9, 0, Math.PI / 2), part(G.cyl(0.5, 0.5, 0.28, 16), [1.0, 0.95, 0.5], 0, 1.9, 0, Math.PI / 2), part(G.cyl(0.25, 0.25, 0.32, 12), [0.5, 0.9, 1.0], 0, 1.9, 0, Math.PI / 2), part(G.cyl(0.07, 0.07, 1.3, 6), [1, 1, 1], 0, 0.8, 0)) },
  rock: { name: '돌', ch: '돌', css: '#a8a8a8', col: [0.6, 0.6, 0.62], poop: '변비', w: 8,
    geo: model(part(G.dode(0.85), [0.55, 0.55, 0.58], 0, 0.8, 0, 0.3, 0.5, 0), part(G.dode(0.45), [0.45, 0.45, 0.48], 0.7, 0.45, 0.3)) },
};
const FOOD_KEYS = Object.keys(FOODS), FOOD_BAG = FOOD_KEYS.flatMap((k) => Array(FOODS[k].w).fill(k));
const M = {
  foe: inst(foeGeo, vcMat(), 320, true), poop: inst(poopGeo, vcMat(), 160, true),
  ball: inst(G.sph(1), new THREE.MeshLambertMaterial(), 12, true),
  gib: inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 420),
  tree: inst(model(part(G.cyl(0.3, 0.4, 1.6, 6), [0.45, 0.3, 0.18], 0, 0.8, 0), part(G.cone(1.7, 2.6, 7), [0.2, 0.62, 0.3], 0, 2.7, 0), part(G.cone(1.25, 2.1, 7), [0.26, 0.7, 0.34], 0, 4.1, 0)), vcMat(), 40, true),
  glow: inst((() => { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }), 80),
};
for (const k of FOOD_KEYS) M['f_' + k] = inst(FOODS[k].geo, vcMat(), 40, true);

// ---------- 파티클 ----------
const PMAX = 5000;
const pPos = new Float32Array(PMAX * 3).fill(-999), pVel = new Float32Array(PMAX * 3), pBase = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
const pLife = new Float32Array(PMAX), pMaxL = new Float32Array(PMAX), pGrav = new Float32Array(PMAX), pSize = new Float32Array(PMAX);
let pNext = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, toneMapped: false,
  vertexShader: 'attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.2, d); gl_FragColor = vec4(vC, a * 0.5); }',
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; scene.add(pPoints);
function spark(x, y, z, vx, vy, vz, col, life, size = 1, grav = 16) {
  const i = pNext; pNext = (pNext + 1) % PMAX;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pBase[i * 3] = col[0]; pBase[i * 3 + 1] = col[1]; pBase[i * 3 + 2] = col[2]; pLife[i] = pMaxL[i] = life; pGrav[i] = grav; pSize[i] = size;
}
function burst(x, y, z, n, col, spd, life = 0.5, size = 1) { for (let k = 0; k < n; k++) { const a = rand(Math.PI * 2), s = spd * rand(0.25, 1); spark(x, y, z, Math.cos(a) * s, rand(spd * 0.9), Math.sin(a) * s, col, life * rand(0.5, 1.2), size * rand(0.6, 1.3)); } }
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
    pVel[i * 3 + 1] -= pGrav[i] * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    pCol[i * 3] = pBase[i * 3]; pCol[i * 3 + 1] = pBase[i * 3 + 1]; pCol[i * 3 + 2] = pBase[i * 3 + 2];
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aCol.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
}
const ringPool = [];
for (let i = 0; i < 10; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); ringPool.push({ m, on: false, r: 0, max: 1, speed: 1 });
}
function addRing(x, z, max, speed, col) { const r = ringPool.find((q) => !q.on) || ringPool[0]; r.on = true; r.r = 0.5; r.max = max; r.speed = speed; r.m.position.set(x, 0.15, z); r.m.material.color.setRGB(col[0], col[1], col[2]); r.m.visible = true; }

// ---------- 데이터 ----------
const FOES = {
  small: { hp: 14, spd: 3.0, r: 0.9, s: 1.0, col: [0.62, 0.42, 0.95], pts: 10 },
  fast: { hp: 8, spd: 5.6, r: 0.75, s: 0.8, col: [1.0, 0.7, 0.25], pts: 12 },
  fat: { hp: 110, spd: 1.9, r: 1.7, s: 1.95, col: [0.9, 0.35, 0.4], pts: 60 },
};
const STREAK = { 20: '잘 쌌다', 60: '일사천리', 150: '전대미문', 300: '똥 서사시급' };

// ---------- 상태 ----------
let state = 'title', held = false, auto = false, muted = false;
let time = 0, score = 0, kills = 0, hearts = 5, stageN = 1, stageT = 0, foodT = 0, foeT = 0, combo = 0, comboT = 0, shake = 0, hurt = 0, bannerT = 0, safeT = 0, stuck = 0, rainbowT = 0, flameT = 0, flameK = 1, squash = 0, gulp = 0, hitId = 0, tipT = 0;
let best = 0; try { best = +localStorage.getItem('echo_eat_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
let foods = [], foes = [], poops = [], gibs = [], gases = [], pending = [], backlog = [], belly = [];
const me = { x: 0, tx: 0 };
const trees = Array.from({ length: 36 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * rand(8.5, 17), z: -70 + i * 2.6, s: rand(0.8, 1.5) }));
const run = () => 15 + Math.min(8, stageN * 0.5);
const hs = () => 1.33 ** (stageN - 1);

// ---------- 소리 ----------
let ac = null, master = null, noiseBuf = null; const lastSfx = {};
function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, vol, freq, delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(120, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
function fart(dur, vol, f0 = 120, delay = 0, bend = 0.45) {                                 // 뿌우: 저주파 톱니파에 빠른 떨림
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * rand(0.9, 1.15), t); o.frequency.exponentialRampToValueAtTime(f0 * bend, t + dur);
  l.frequency.value = rand(26, 40); lg.gain.value = vol * 0.6; l.connect(lg); lg.connect(g.gain);
  g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
}
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const sfx = {
  eat: () => limited('eat', 60, () => { tone('triangle', 520, 880, 0.07, 0.14); tone('triangle', 880, 420, 0.09, 0.12, 0.07); }),
  poop: (big) => limited('poop', 70, () => { fart(big ? 0.5 : 0.22, big ? 0.34 : 0.22, big ? 90 : rand(110, 160)); }),
  pop: (c) => limited('pop', 40, () => { const st = Math.min(14, Math.floor(c / 6)), f = 330 * 2 ** (([0, 2, 4, 7, 9][st % 5] + 12 * Math.floor(st / 5)) / 12); tone('triangle', f, f * 0.6, 0.08, 0.1); tone('sine', 150, 55, 0.07, 0.08); }),
  splat: () => limited('splat', 80, () => { hiss(0.18, 0.2, 1800); tone('sine', 140, 50, 0.16, 0.2); }),
  boom: () => limited('boom', 100, () => { tone('sine', 170, 42, 0.35, 0.34); hiss(0.3, 0.25, 2200); }),
  flame: () => limited('flame', 110, () => hiss(0.22, 0.12, 3200)),
  ice: () => limited('ice', 100, () => { tone('triangle', 2400, 900, 0.2, 0.12); hiss(0.25, 0.14, 6000); }),
  rock: () => { tone('square', 160, 70, 0.3, 0.16); tone('square', 120, 60, 0.3, 0.14, 0.18); },
  bite: () => { tone('sawtooth', 300, 70, 0.3, 0.3); hiss(0.2, 0.22, 1400); },
  rainbow: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.16, 0.14, i * 0.06)),
  stage: () => { tone('triangle', 660, 880, 0.14, 0.16); tone('triangle', 880, 1320, 0.2, 0.14, 0.1); },
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
};
// 음성: tools/gen_voice.py --set eat 로 미리 생성한 mp3(voice/index.json 은 대사 -> 파일); 없는 문구는 말하지 않음
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '먹자': '开吃', '변비야': '便秘了', '슈퍼 더블': '超级加倍', '화염똥': '喷火屎', '점보': '巨无霸', '무지개똥': '彩虹屎', '아이고, 물렸다': '哎哟，被咬了', '신기록': '新纪录', '못 뛰겠다': '跑不动了', '일사천리': '一泻千里', '잡식괴물이 더 많아졌다': '馋嘴怪更多了', '연발 방귀': '连珠屁', '팝콘 방귀': '爆米花屁', '기관총 방귀': '机关枪屁', '화끈 방귀': '火辣屁', '불 뿜는 방귀': '喷火龙屁', '엉덩이 탈 방귀': '烧腚屁', '얼음 방귀': '冰凉屁', '뼛속 시린 방귀': '透心凉屁', '민트 방귀': '薄荷屁', '천둥 방귀': '惊天响屁', '진동 방귀': '震楼屁', '산사태 방귀': '崩山屁', '우르릉 방귀': '闷雷屁', '구르는 벼락 방귀': '滚地雷屁', '대포 방귀': '大炮屁', '무지개 방귀': '彩虹屁', '오색 구름 방귀': '七彩祥云屁', '요정 방귀': '仙女屁', '참은 방귀': '憋屁', '무음 방귀': '哑屁', '트랙터 방귀': '拖拉机屁', '핵폭탄 방귀': '核弹屁' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[VOICE[text] || text], now = performance.now();
  if (!c || (gap && now - (sayLast[text] || 0) < gap) || (now < sayUntil && pri <= sayPri)) return;
  sayLast[text] = now; sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}

// ---------- 방귀 종류: 먹이마다 자기 방귀 이름과 소리가 있음 ----------
const FARTS = {
  corn: { names: ['연발 방귀', '팝콘 방귀', '기관총 방귀'], snd: (k) => { for (let i = 0; i < 3 * k; i++) fart(0.07, 0.24, rand(150, 210), i * 0.085, 0.7); } },                                  // 따다닥
  chili: { names: ['화끈 방귀', '불 뿜는 방귀', '엉덩이 탈 방귀'], snd: (k) => { fart(0.55 * k, 0.26, 95, 0, 2.2); hiss(0.6 * k, 0.16, 4200); } },                                                        // 갈수록 날카로워지며 쉿쉿 소리
  ice: { names: ['얼음 방귀', '뼛속 시린 방귀', '민트 방귀'], snd: (k) => { tone('sine', 2100, 620, 0.32 * k, 0.1); fart(0.16, 0.16, 320, 0.05, 0.6); } },                                              // 휘파람 소리
  bean: { names: ['천둥 방귀', '진동 방귀', '산사태 방귀'], snd: (k) => { fart(0.7 * k, 0.4, 82, 0, 0.35); tone('sine', 150, 38, 0.5, 0.36); hiss(0.4, 0.22, 1600); } },                             // 쾅 하는 소리
  melon: { names: ['우르릉 방귀', '구르는 벼락 방귀', '대포 방귀'], snd: (k) => { fart(0.9 * k, 0.36, 52, 0, 0.6); tone('sine', 70, 34, 0.9 * k, 0.3); } },                                                 // 낮고 길게
  candy: { names: ['무지개 방귀', '오색 구름 방귀', '요정 방귀'], snd: (k) => { [131, 165, 196, 262, 330, 392].slice(0, k > 1 ? 6 : 4).forEach((f, i) => fart(0.11, 0.2, f, i * 0.09, 0.92)); } },      // 올라가는 음계 한 줄
  rock: { names: ['참은 방귀', '무음 방귀'], snd: () => { fart(0.1, 0.1, 520, 0, 1.3); fart(0.06, 0.07, 640, 0.16, 1.2); } },                                                                         // 짜내듯 작은 소리
  release: { names: ['트랙터 방귀'], snd: () => { for (let i = 0; i < 9; i++) fart(0.08, 0.26, rand(70, 100), i * 0.11, 0.8); } },                                                             // 덜덜덜덜
};
let fartLast = '';
function fartFx(kind, sup) {
  const F = FARTS[kind]; let name = F.names[Math.floor(rand(F.names.length))]; if (name === fartLast && F.names.length > 1) name = F.names[(F.names.indexOf(name) + 1) % F.names.length];
  fartLast = name; limited('fart_' + kind, 90, () => F.snd(sup ? 1.6 : 1));
  const el = $('fart'); el.textContent = (sup ? '핵폭탄급 · ' : '') + name; el.style.color = FOODS[kind] ? FOODS[kind].css : '#ffe27a'; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  say(sup ? '핵폭탄 방귀' : name, 1, 1500);
}

// ---------- 화면 ----------
function banner(text, sec = 1.4) { $('banner').textContent = text; bannerT = sec; }
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  const list = '<div class="foods">' + FOOD_KEYS.map((k) => '<span><i style="background:' + FOODS[k].css + '"></i>' + FOODS[k].name + ' → ' + FOODS[k].poop + '</span>').join('') + '</div>';
  if (state === 'title') s.innerHTML = '<h1>먹는 대로 싸기</h1><div class="sub">메아리 · 제 3 기</div><div class="help"><b>좌우로 끌어서</b> 냠냠이를 먹이로 이동<br>먹는 대로 싸서 뒤쫓아오는 <b>잡식괴물</b>을 때리세요<br>같은 것 세 개를 연속으로 먹으면 <b>슈퍼 더블</b> 한 발</div>' + list +
    (best ? '<div class="sub" style="margin-top:12px">최고 점수 ' + best + '</div>' : '') + '<button class="go" data-act="start">먹 자</button>';
  else s.innerHTML = '<h1 class="red">잡혔다</h1><div class="sub">점수 ' + Math.floor(score) + '　' + kills + ' 마리 물리침<br>제 ' + stageN + ' 관문까지　최고 점수 ' + best + '</div><button class="go" data-act="start">한 판 더</button>';
}
function hud() {
  $('score').textContent = Math.floor(score); $('stageN').textContent = stageN; $('hearts').textContent = '♥'.repeat(Math.max(0, hearts)) + '♡'.repeat(Math.max(0, 5 - hearts));
  $('combo').innerHTML = combo >= 8 ? '×' + combo + '<small>콤보</small>' : '';
  for (let i = 0; i < 3; i++) { const el = $('b' + i), f = FOODS[belly[i]]; el.textContent = f ? f.ch : ''; el.style.background = f ? f.css : ''; el.className = f ? 'on' : ''; }
  $('tip').textContent = stuck > 0 ? '변비 중… 참아둔 게 한꺼번에 나옵니다(' + backlog.length + ')' : rainbowT > 0 ? '무지개 타임: 점수 2 배, 먹이가 알아서 날아옵니다' : '';
  $('hurt').style.opacity = hurt.toFixed(2); $('rainbow').style.opacity = rainbowT > 0 ? (0.6 + 0.3 * Math.sin(time * 10)).toFixed(2) : 0;
}

// ---------- 먹기 ----------
function eat(f) {
  const d = FOODS[f.type]; gulp = 1; sfx.eat(); score += (rainbowT > 0 ? 10 : 5); burst(me.x, 2.2, -1.6, 10, d.col, 9, 0.35, 1.1);
  if (f.type === 'rock') { stuck = 2.6; belly = []; banner('변비다…'); sfx.rock(); say('변비야', 2, 4000); fartFx('rock'); shake = Math.max(shake, 0.5); return; }
  belly.push(f.type); if (belly.length > 3) belly.shift();
  const sup = belly.length === 3 && belly[0] === belly[1] && belly[1] === belly[2];
  if (sup) { belly = []; banner('슈퍼 ' + d.poop, 1.6); say('슈퍼 더블', 2, 2500); shake = Math.max(shake, 0.7); }
  if (stuck > 0) backlog.push({ type: f.type, sup }); else pending.push({ type: f.type, sup, at: 0.16 });
}
// ---------- 싸기 ----------
function emit(type, sup) {
  const k = sup ? 2 : 1, x = me.x, d = FOODS[type]; squash = 1; fartFx(type, sup);
  burst(x, 1.2, 1.8, sup ? 26 : 12, d.col, 8, 0.4, 1.2);
  const mk = (o) => poops.push(Object.assign({ kind: type, x, z: 2.2, vx: 0, vz: 1, r: 1.0, s: 1, dmg: 16, n: 2, t: 0, id: ++hitId, col: d.col, y: 0 }, o));
  if (type === 'corn') for (let i = 0; i < (sup ? 9 : 3); i++) mk({ x: x + (sup ? (i % 3 - 1) * 1.9 : 0), z: 2.2 - Math.floor(i / (sup ? 3 : 1)) * 2.0, dmg: 18 * hs() ** 0.8, n: 2 });
  else if (type === 'chili') { flameT = sup ? 4.2 : 2.3; flameK = k; }
  else if (type === 'ice') mk({ r: 1.2 * k, s: 1.25 * k, dmg: 20 * hs(), n: 1, aoe: 5.2 * (sup ? 1.6 : 1) });
  else if (type === 'bean') {
    for (const f of foes) if (f.z < 16 * k) { f.z += (sup ? 12 : 7) / (f.def.r > 1.5 ? 2 : 1); damage(f, 10 * k * hs()); }
    gases.push({ x, z: 4, r: 4.2 * (sup ? 1.5 : 1), t: sup ? 5 : 3 }); addRing(x, 2, 14 * k, 34, [0.7, 1.0, 0.4]); shake = Math.max(shake, 0.5 * k);
    for (let i = 0; i < 24 * k; i++) spark(x + rand(-1, 1), rand(0.4, 2), 2, rand(-9, 9), rand(0, 4), rand(4, 16), [0.62, 0.82, 0.32], rand(0.5, 1.1), rand(1.8, 3.4), -1);
  }
  else if (type === 'melon') { mk({ r: 2.3 * (sup ? 1.5 : 1), s: 2.3 * (sup ? 1.5 : 1), dmg: 130 * k * hs() ** 0.8, n: 1e9, vz: 0.75, ball: true }); shake = Math.max(shake, 0.6); }
  else if (type === 'candy') {
    const n = sup ? 13 : 7; for (let i = 0; i < n; i++) mk({ vx: (i - (n - 1) / 2) * (sup ? 1.7 : 2.4), vz: 0.7 + rand(0.15), dmg: 34 * hs() ** 0.8, n: 3, hop: rand(6), rainbow: true });
    rainbowT = sup ? 9 : 5.5; sfx.rainbow(); banner(sup ? '슈퍼 무지개똥' : '무지개똥', 1.5); say('무지개똥', 2, 3000);
  }
}
function damage(f, d, fire) { if (!f.alive) return; f.hp -= d; f.flash = 0.1; if (fire) f.burn = 0.2; if (f.hp <= 0) kill(f); }
function kill(f) {
  f.alive = false; kills++; combo++; comboT = 2; score += f.def.pts * (rainbowT > 0 ? 2 : 1);
  if (STREAK[combo]) banner(STREAK[combo] + '　×' + combo, 1.5);
  const c = f.def.col, big = f.def.r > 1.5;
  burst(f.x, 1, f.z, big ? 30 : 8, [c[0] * 1.3, c[1] * 1.3, c[2] * 1.3], big ? 13 : 9, 0.5, big ? 1.5 : 1);
  for (let i = 0; i < (big ? 12 : 3); i++) if (gibs.length < 400) gibs.push({ x: f.x, y: 0.9, z: f.z, vx: rand(-6, 6), vy: rand(8, 18), vz: rand(2, 14), t: 0, life: rand(0.45, 0.8), s: rand(0.22, 0.42) * (big ? 1.7 : 1), col: c, spin: rand(5, 14) });
  if (big) { addRing(f.x, f.z, 6, 22, c); sfx.boom(); shake = Math.max(shake, 0.5); } else sfx.pop(combo);
}
function splat(p) { burst(p.x, 0.8, p.z, 14, p.col, 9, 0.4, 1.3); sfx.splat(); }
function iceBoom(p) {
  for (const f of foes) if (f.alive && (f.x - p.x) ** 2 + (f.z - p.z) ** 2 < p.aoe * p.aoe) { damage(f, p.dmg); f.frz = 3.2; }
  addRing(p.x, p.z, p.aoe, 26, [0.6, 1.0, 1.0]); burst(p.x, 1, p.z, 50, [0.75, 0.95, 1.0], 14, 0.6, 1.4); sfx.ice(); p.dead = true;
}
function bite(f) {
  hearts--; hurt = 1; safeT = 1.4; shake = Math.max(shake, 1); sfx.bite(); combo = 0; say('아이고, 물렸다', 2, 2500); banner('물렸다', 1);
  for (const o of foes) if ((o.x - me.x) ** 2 + o.z ** 2 < 64) o.z += 7;
  addRing(me.x, 0, 8, 30, [1, 0.4, 0.3]);
  if (hearts <= 0) endGame();
}
function endGame() {
  if (state !== 'play') return; state = 'over'; sfx.over(); const s = Math.floor(score);
  say(s > best && best > 0 ? '신기록' : '못 뛰겠다', 5);
  if (s > best) { best = s; try { localStorage.setItem('echo_eat_best', '' + best); } catch (e) { /* 무시 */ } }
  showScreen();
}
function newGame() {
  state = 'play'; time = score = kills = combo = comboT = shake = hurt = bannerT = stuck = rainbowT = flameT = squash = gulp = stageT = tipT = 0; hearts = 5; stageN = 1; foodT = 0.2; foeT = 2.5; safeT = 1;
  foods = []; foes = []; poops = []; gibs = []; gases = []; pending = []; backlog = []; belly = []; me.x = me.tx = 0;
  pLife.fill(0); pPos.fill(-999); for (const r of ringPool) { r.on = false; r.m.visible = false; }
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'eat'; (h.played = h.played || {}).eat = k; h.last = 'eat'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
  banner('먹자', 1.4); showScreen(); sayUntil = 0; say('먹자', 2);
}

// ---------- 매 프레임 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.8); squash = Math.max(0, squash - dt * 5); gulp = Math.max(0, gulp - dt * 6);
  for (const r of ringPool) if (r.on) { r.r += r.speed * dt; if (r.r >= r.max) { r.on = false; r.m.visible = false; } else { r.m.scale.setScalar(r.r); r.m.material.opacity = 0.9 * (1 - r.r / r.max); } }
  for (const g of gibs) { g.t += dt; g.vy -= 40 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; if (g.y < 0.15) { g.y = 0.15; g.vy *= -0.35; g.vx *= 0.6; } }
  gibs = gibs.filter((g) => g.t < g.life);
  if (state !== 'play') { updateParticles(dt); return; }
  time += dt; const RUN = run(), rb = rainbowT > 0;
  score += dt * RUN * 0.2 * (rb ? 2 : 1);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  if (safeT > 0) safeT -= dt; if (rainbowT > 0) rainbowT -= dt;
  roadTex.offset.y += RUN * dt / 26; grassTex.offset.y += RUN * dt / 26;
  for (const t of trees) { t.z += RUN * dt; if (t.z > 24) { t.z -= 94; t.x = (t.x > 0 ? 1 : -1) * rand(8.5, 17); } }
  stageT += dt;
  if (stageT >= STAGE_LEN) { stageT = 0; stageN++; sfx.stage(); banner('제 ' + stageN + ' 관문', 1.4); if (stageN % 2 === 0) say('잡식괴물이 더 많아졌다', 1); }
  // 먹이: 조금씩 떨어져 한 줄씩 오고, 줄마다 두세 개를 다른 차선에 놓음
  foodT -= dt;
  if (foodT <= 0) {
    foodT = rand(0.62, 0.9) * 15 / RUN; const ls = [...LANES].sort(() => Math.random() - 0.5), n = Math.random() < 0.45 ? 3 : 2;
    for (let i = 0; i < n; i++) if (foods.length < 38) foods.push({ type: FOOD_BAG[Math.floor(rand(FOOD_BAG.length))], x: ls[i], z: FOOD_Z, spin: rand(6) });
  }
  // 잡식괴물: 무리 지어 뒤에서 쫓아오고, 갈수록 많고 빨라짐
  foeT -= dt;
  if (foeT <= 0) {
    foeT = Math.max(0.4, 1.7 - stageN * 0.11) * rand(0.8, 1.2); const n = Math.min(30, 7 + Math.floor(stageN * 2.2)), cx = rand(-4.5, 4.5);
    for (let i = 0; i < n; i++) spawnFoe(stageN >= 2 && Math.random() < 0.2 ? 'fast' : 'small', clamp(cx + rand(-2.6, 2.6), -HALF + 0.8, HALF - 0.8), BACK_Z + rand(0, 6));
    if (stageN >= 2) for (let i = 0; i < Math.floor(stageN / 4) + (Math.random() < 0.4 ? 1 : 0); i++) spawnFoe('fat', rand(-4.5, 4.5), BACK_Z + rand(2, 6));
  }
  // 냠냠이
  if (auto) autoPlay();
  if (keys.l) me.tx -= 20 * dt; if (keys.r) me.tx += 20 * dt;
  me.tx = clamp(me.tx, -HALF + 1, HALF - 1); me.x += clamp(me.tx - me.x, -30 * dt, 30 * dt);
  for (const f of foods) {
    f.z += RUN * dt;
    if (rb && f.type !== 'rock' && f.z > -16) f.x += clamp(me.x - f.x, -14 * dt, 14 * dt);        // 무지개 타임: 맛있는 게 알아서 날아옴
    if (!f.dead && f.z > -2.4 && f.z < 1.2 && Math.abs(f.x - me.x) < 1.55) { f.dead = true; eat(f); }
    if (f.z > 8) f.dead = true;
  }
  foods = foods.filter((f) => !f.dead);
  if (stuck > 0) { stuck -= dt; if (Math.random() < 0.3) spark(me.x + rand(-1, 1), 3.2, rand(-0.5, 0.5), 0, 2, 0, [0.5, 0.6, 1.0], 0.5, 1.2, 0); if (stuck <= 0) { if (backlog.length) { banner('일사천리', 1.6); say('일사천리', 2); shake = Math.max(shake, 0.8); fartFx('release'); } backlog.forEach((b, i) => pending.push({ ...b, at: i * 0.13 })); backlog = []; } }
  for (const p of pending) { p.at -= dt; if (p.at <= 0) { p.done = true; emit(p.type, p.sup); } }
  pending = pending.filter((p) => !p.done);
  // 불 뿜기
  if (flameT > 0) {
    flameT -= dt; sfx.flame(); const len = 14 * (flameK > 1 ? 1.35 : 1), hw = flameK > 1 ? 3.4 : 2.1;
    for (const f of foes) if (f.alive && f.z > 0.5 && f.z < len && Math.abs(f.x - me.x) < hw * (0.45 + f.z / len * 0.55) + f.def.r * 0.5) damage(f, 75 * flameK * hs() ** 0.8 * dt, true);
    for (let i = 0; i < 5; i++) { const v = rand(22, 30); spark(me.x + rand(-0.3, 0.3), 1.3, 1.8, rand(-hw, hw) * 1.6, rand(0, 3), v, [1.0, rand(0.35, 0.7), 0.1], len / v * rand(0.7, 1), rand(1.6, 3.2), -3); }
  }
  for (const g of gases) { g.t -= dt; g.z += RUN * 0.12 * dt; for (const f of foes) if (f.alive && (f.x - g.x) ** 2 + (f.z - g.z) ** 2 < g.r * g.r) damage(f, 22 * hs() ** 0.8 * dt); if (Math.random() < 0.3) spark(g.x + rand(-g.r, g.r), rand(0.3, 2.2), g.z + rand(-g.r, g.r), rand(-1, 1), rand(0.5, 2), rand(-1, 1), [0.62, 0.82, 0.32], rand(0.5, 1), rand(1.6, 3), -1); }
  gases = gases.filter((g) => g.t > 0);
  // 잡식괴물 전진
  for (const f of foes) {
    if (!f.alive) continue;
    if (f.flash > 0) f.flash -= dt; if (f.burn > 0) f.burn -= dt; if (f.frz > 0) f.frz -= dt;
    const k = f.frz > 0 ? 0.12 : 1;
    f.z -= f.spd * k * dt; f.x += clamp(me.x - f.x, -2.4 * k * dt, 2.4 * k * dt);
    if (f.z > BACK_Z + 14) f.z = BACK_Z + 14;
    if (safeT <= 0 && Math.abs(f.z) < 1.0 + f.def.r * 0.5 && Math.abs(f.x - me.x) < 0.9 + f.def.r) { bite(f); if (state !== 'play') return; }
  }
  // 똥탄: 길에 남아 있어 추격자 입장에선 마주 부딪히는 셈
  for (const p of poops) {
    p.t += dt; p.z += RUN * p.vz * dt; p.x += p.vx * dt;
    if (p.rainbow) { if (Math.abs(p.x) > HALF - 0.8) { p.x = clamp(p.x, -HALF + 0.8, HALF - 0.8); p.vx *= -1; } p.y = Math.abs(Math.sin(p.t * 7 + p.hop)) * 1.6; if (Math.random() < 0.5) spark(p.x, 1 + p.y, p.z, 0, 1, 0, hue(p.t * 2 + p.hop), 0.35, 1.3, 0); }
    for (const f of foes) {
      if (!f.alive || f.pid === p.id || Math.abs(f.x - p.x) > p.r + f.def.r * 0.7 || Math.abs(f.z - p.z) > p.r + f.def.r * 0.7) continue;
      if (p.aoe) { iceBoom(p); break; }
      damage(f, p.dmg); f.pid = p.id; if (p.ball) f.z += 2; else splat(p);
      if (--p.n <= 0) { p.dead = true; break; }
    }
    if (!p.dead && p.aoe && p.z > 14) iceBoom(p);
    if (p.z > BACK_Z + 12) p.dead = true;
  }
  poops = poops.filter((p) => !p.dead);
  foes = foes.filter((f) => f.alive);
  updateParticles(dt);
}
function spawnFoe(type, x, z) { if (foes.length >= 300) return; const d = FOES[type], hp = d.hp * hs(); foes.push({ type, def: d, x, z, hp, max: hp, spd: d.spd * rand(0.85, 1.15) * Math.min(1.6, 1 + stageN * 0.035), alive: true, flash: 0, burn: 0, frz: 0, wob: rand(6), pid: 0 }); }
function hue(t) { return [0.6 + 0.6 * Math.sin(t), 0.6 + 0.6 * Math.sin(t + 2.1), 0.6 + 0.6 * Math.sin(t + 4.2)]; }
function autoPlay() {                                              // 자동 플레이(테스트용): 돌이 아닌 가장 가까운 걸 먹으러 감
  let bestF = null, bv = 1e9;
  for (const f of foods) { if (f.type === 'rock' || f.z > -1 || f.z < -34) continue; const need = Math.abs(f.x - me.x) / 30, tt = -f.z / run(); if (need > tt) continue; const v = -f.z + Math.abs(f.x - me.x) * 0.5; if (v < bv) { bv = v; bestF = f; } }
  if (bestF) me.tx = bestF.x;
  for (const f of foods) if (f.type === 'rock' && f.z > -7 && f.z < 1 && Math.abs(f.x - me.tx) < 1.7) me.tx = f.x + (f.x > 0 ? -2.4 : 2.4);
}
function draw() {
  for (const k in M) M[k].userData.n = 0;
  const t = time, bob = Math.abs(Math.sin(t * 11)) * 0.22;
  pet.position.set(me.x, bob, 0); pet.rotation.z = Math.sin(t * 11) * 0.06 + clamp(me.tx - me.x, -1, 1) * -0.12;
  pet.scale.set(1 + squash * 0.22 + gulp * 0.1, 1 - squash * 0.2 + gulp * 0.12, 1 + squash * 0.1); pet.visible = !(safeT > 0 && state === 'play' && Math.floor(t * 14) % 2 === 0);
  if (stuck > 0) pet.rotation.z += Math.sin(t * 40) * 0.05;
  for (const f of foods) { const d = FOODS[f.type], y = 0.3 + Math.sin(t * 4 + f.spin) * 0.18; put(M['f_' + f.type], f.x, y, f.z, t * 2 + f.spin, 1.05, 1.05, 1.05); put(M.glow, f.x, 0.06, f.z, 0, 1.25, 1, 1.25, d.col[0], d.col[1], d.col[2]); }
  for (const f of foes) {
    const d = f.def, bobf = Math.abs(Math.sin(t * d.spd * 3 + f.wob)) * 0.3; let [r, g, b] = d.col; if (f.frz > 0) { r = 0.45; g = 0.85; b = 1.3; } else if (f.burn > 0) { r = 1.5; g = 0.6; b = 0.2; } if (f.flash > 0) { r *= 2; g *= 2; b *= 2; }
    put(M.foe, f.x, f.frz > 0 ? 0 : bobf, f.z, Math.atan2(f.x - me.x, f.z) * 0.6, d.s, d.s * (1 + (f.frz > 0 ? 0 : bobf * 0.25)), d.s, r, g, b);
  }
  for (const p of poops) {
    const c = p.rainbow ? hue(p.t * 6 + p.hop) : p.col, w = 1 + Math.sin(p.t * 16) * 0.06;
    if (p.ball) put(M.ball, p.x, p.r, p.z, 0, p.r, p.r, p.r, 0.25, 0.7, 0.3, p.t * 9);
    else put(M.poop, p.x, p.y, p.z, p.t * 3, p.s * w, p.s / w, p.s * w, c[0], c[1], c[2]);
  }
  for (const g of gibs) { const s = g.s * (1 - (g.t / g.life) * 0.5); put(M.gib, g.x, g.y, g.z, g.spin * g.t, s, s, s, g.col[0], g.col[1], g.col[2], g.spin * g.t * 0.7); }
  for (const tr of trees) put(M.tree, tr.x, 0, tr.z, tr.z, tr.s, tr.s, tr.s);
  for (const k in M) { const m = M[k]; m.count = m.userData.n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  camera.position.set(CAM.x + me.x * 0.12 + rand(-1, 1) * shake * 0.5, CAM.y + rand(-1, 1) * shake * 0.4, CAM.z + rand(-1, 1) * shake * 0.3);
  hud(); composer.render();
}

// ---------- 입력 ----------
const keys = { l: false, r: false };
function pointerX(e) { const r = stage.getBoundingClientRect(); me.tx = ((e.clientX - r.left) / r.width * 2 - 1) * (HALF + 1.6); }
stage.addEventListener('pointermove', (e) => { if (state === 'play' && !auto) pointerX(e); });
stage.addEventListener('pointerdown', (e) => {
  initAudio(); const a = e.target.closest && e.target.closest('[data-act]');
  if (a && a.dataset.act === 'start') { newGame(); return; }
  if (state === 'play' && !auto) pointerX(e);
});
addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
  if (e.code === 'KeyM') muted = !muted;
  if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { e.preventDefault(); initAudio(); newGame(); }
});
addEventListener('keyup', (e) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false; });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 디버그 입구: 미리보기에서 시간 진행과 자동 플레이용
window.__eat = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on) { auto = on; },
  feed(type, n = 1) { for (let i = 0; i < n; i++) eat({ type }); }, spawn: spawnFoe, setStage(n) { stageN = n; stageT = 0; },
  get said() { return saidLog.slice(); }, get fart() { return $('fart').textContent; }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, time: +time.toFixed(1), stage: stageN, hearts, score: Math.floor(score), kills, foes: foes.length, foods: foods.length, poops: poops.length, belly: belly.join(','), stuck: +stuck.toFixed(1), combo }; },
};
