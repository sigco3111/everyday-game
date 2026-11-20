// 《메아리: 물결 소탕》—— 세로 화면 소대 슈팅: 왼쪽에서 얼음 블록을 깨서 강화를 얻고, 오른쪽에서 밀려오는 침식의 물결을 소탕. 타워 디펜스 버전과 완전히 독립.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 필드 크기 ----------
const HALF = 8;              // 통로 반폭: x<0 은 얼음 블록 레인, x>0 은 침식 물결 레인
const LINE_Z = 1.6;          // 방어선: 침식체가 넘으면 방어선 생명 감소
const SPAWN_Z = -80;
const STAGE_LEN = 26;        // 단계 하나의 초 수

// ---------- 렌더링 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.Fog(0x070a12, 62, 104);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 260);
const CAM = new THREE.Vector3(0, 37, 13.5), LOOK = new THREE.Vector3(0, 0, -17);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.82);
composer.addPass(bloom); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() {
  H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62));
  stage.style.width = W + 'px';
  renderer.setSize(W, H); composer.setSize(W, H);
  camera.aspect = W / H; camera.fov = W / H < 0.5 ? 56 : 50; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = H * renderer.getPixelRatio() * 0.85;
}

// ---------- 조명과 장면 ----------
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x20222c, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
sun.position.set(-14, 40, 12); sun.target.position.set(0, 0, -30); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 50, bottom: -14, near: 5, far: 110 });
sun.shadow.bias = -0.0015;

function stoneTex(base, line) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) {
    const x = q * 128 + (r % 2) * 64, y = r * 64, v = Math.floor(rand(-10, 10));
    g.fillStyle = `rgba(${128 + v * 6},${128 + v * 6},${128 + v * 6},0.10)`; g.fillRect(x + 2, y + 2, 124, 60); g.fillRect(x - 254, y + 2, 124, 60);
    g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, 125, 61); g.strokeRect(x - 254.5, y + 1.5, 125, 61);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function lane(x0, x1, base, line) {
  const t = stoneTex(base, line); t.repeat.set((x1 - x0) / 5.4, 21);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 112), new THREE.MeshLambertMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0, -44); m.receiveShadow = true; scene.add(m);
}
lane(-HALF, 0, '#4a6078', '#243446'); lane(0, HALF, '#5a5560', '#2c2832');
const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a4050 });
for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5, 112), wallMat); w.position.set(s * (HALF + 0.7), 2.5, -44); w.receiveShadow = true; scene.add(w); }
const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 96), new THREE.MeshLambertMaterial({ color: 0x2a3340, emissive: 0x16303c }));
rail.position.set(0, 0.25, -52); scene.add(rail);
const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 2.2), toneMapped: false, transparent: true, opacity: 0.8 });
const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 0.35), lineMat); lineMesh.rotation.x = -Math.PI / 2; lineMesh.position.set(0, 0.05, LINE_Z); scene.add(lineMesh);
const torchMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.2, 0.3), toneMapped: false });
for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), torchMat); t.position.set(s * (HALF + 0.1), 5.3, -4 - i * 15); scene.add(t);
  if (i % 3 === 1) { const l = new THREE.PointLight(0xff8a3a, 60, 26, 1.6); l.position.set(s * (HALF - 1), 5, -4 - i * 15); scene.add(l); }
}

// ---------- 모델(병합 지오메트리 + 정점 색) ----------
const m4 = new THREE.Matrix4(), eul = new THREE.Euler(), quat = new THREE.Quaternion(), v3a = new THREE.Vector3(), v3b = new THREE.Vector3();
function part(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(m4.compose(v3a.set(x, y, z), quat.setFromEuler(eul.set(rx, ry, rz)), v3b.set(sx, sy, sz)));
  const n = g.attributes.position.count, c = new Float32Array(n * 3), k = typeof col === 'number' ? [col, col, col] : col;
  for (let i = 0; i < n; i++) { c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv');
  return g;
}
const model = (...ps) => mergeGeometries(ps);
const G = {
  box: (a, b, c) => new THREE.BoxGeometry(a, b, c), cyl: (a, b, h, n = 6) => new THREE.CylinderGeometry(a, b, h, n),
  ico: (r) => new THREE.IcosahedronGeometry(r, 0), cone: (r, h, n = 5) => new THREE.ConeGeometry(r, h, n),
  octa: (r) => new THREE.OctahedronGeometry(r, 0), dode: (r) => new THREE.DodecahedronGeometry(r, 0),
};
const vcMat = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...o });
const dummy = new THREE.Object3D();
function inst(geo, mat, max, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  m.count = 0; m.frustumCulled = false; m.castShadow = !!shadow; m.userData.n = 0; m.userData.max = max; scene.add(m);
  return m;
}
function put(m, x, y, z, ry, sx, sy, sz, r, g, b, rx = 0, rz = 0) {
  const i = m.userData.n; if (i >= m.userData.max) return; m.userData.n++;
  dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
  dummy.matrix.toArray(m.instanceMatrix.array, i * 16);
  const c = m.instanceColor.array; c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
}
const soldierGeo = model(
  part(G.cyl(0.4, 0.5, 0.95), [0.22, 0.42, 1.0], 0, 0.95, 0), part(G.ico(0.3), [0.95, 0.8, 0.68], 0, 1.7, 0), part(G.cone(0.36, 0.42, 6), [0.3, 0.55, 1.2], 0, 1.98, 0),
  part(G.box(0.3, 0.26, 0.42), [0.5, 0.75, 1.3], 0.52, 1.3, 0), part(G.box(0.3, 0.26, 0.42), [0.5, 0.75, 1.3], -0.52, 1.3, 0),
  part(G.box(0.26, 0.5, 0.3), [0.14, 0.2, 0.42], 0.2, 0.25, 0), part(G.box(0.26, 0.5, 0.3), [0.14, 0.2, 0.42], -0.2, 0.25, 0),
  part(G.box(0.18, 0.2, 1.25), [0.2, 0.22, 0.28], 0.3, 1.1, -0.62), part(G.box(0.24, 0.26, 0.2), [1.6, 2.4, 3.0], 0.3, 1.1, -1.28),
  part(G.box(0.5, 0.6, 0.24), [0.16, 0.26, 0.6], 0, 1.05, 0.38));
const foeGeo = model(
  part(G.box(0.62, 0.8, 0.5), 1, 0, 0.85, 0, 0.25), part(G.ico(0.3), 0.8, 0, 1.45, 0.2), part(G.box(0.1, 0.07, 0.06), 4, 0.12, 1.5, 0.47), part(G.box(0.1, 0.07, 0.06), 4, -0.12, 1.5, 0.47),
  part(G.box(0.16, 0.16, 0.7), 0.7, 0.42, 1.05, 0.4, -0.3), part(G.box(0.16, 0.16, 0.7), 0.7, -0.42, 1.05, 0.4, -0.3),
  part(G.box(0.2, 0.5, 0.22), 0.5, 0.17, 0.25, 0), part(G.box(0.2, 0.5, 0.22), 0.5, -0.17, 0.25, 0), part(G.cone(0.14, 0.4, 4), 0.55, 0, 1.3, -0.3, -0.9));
const bruteGeo = model(
  part(G.dode(0.95), 1, 0, 1.35, 0), part(G.box(0.55, 0.5, 0.55), 0.75, 0, 2.4, 0.25), part(G.box(0.13, 0.09, 0.06), 4, 0.15, 2.46, 0.54), part(G.box(0.13, 0.09, 0.06), 4, -0.15, 2.46, 0.54),
  part(G.cone(0.26, 0.8, 5), 1.7, 0.9, 2.2, 0, 0, 0, -0.6), part(G.cone(0.26, 0.8, 5), 1.7, -0.9, 2.2, 0, 0, 0, 0.6),
  part(G.box(0.44, 1.2, 0.5), 0.65, 1.15, 1.25, 0.2), part(G.box(0.44, 1.2, 0.5), 0.65, -1.15, 1.25, 0.2),
  part(G.box(0.48, 0.6, 0.55), 0.4, 0.42, 0.3, 0), part(G.box(0.48, 0.6, 0.55), 0.4, -0.42, 0.3, 0));
const golemGeo = model(
  part(G.dode(1.6), [0.35, 0.6, 0.8], 0, 3.2, 0), part(G.octa(1.0), [1.2, 2.2, 2.8], 0, 3.3, -1.0), part(G.box(1.1, 1.0, 1.1), [0.4, 0.7, 0.9], 0, 5.2, 0),
  part(G.box(0.26, 0.16, 0.1), [2.4, 3.2, 3.6], 0.3, 5.3, -0.56), part(G.box(0.26, 0.16, 0.1), [2.4, 3.2, 3.6], -0.3, 5.3, -0.56),
  part(G.octa(0.9), [0.7, 1.5, 2.0], 2.2, 4.3, 0), part(G.octa(0.9), [0.7, 1.5, 2.0], -2.2, 4.3, 0),
  part(G.box(0.8, 2.4, 0.9), [0.3, 0.5, 0.7], 2.3, 2.6, 0), part(G.box(0.8, 2.4, 0.9), [0.3, 0.5, 0.7], -2.3, 2.6, 0),
  part(G.box(1.0, 1.6, 1.1), [0.25, 0.4, 0.55], 0.8, 0.8, 0), part(G.box(1.0, 1.6, 1.1), [0.25, 0.4, 0.55], -0.8, 0.8, 0));
const M = {
  soldier: inst(soldierGeo, vcMat(), 12, true),
  foe: inst(foeGeo, vcMat(), 1600, true),
  brute: inst(bruteGeo, vcMat(), 60, true),
  bolt: inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 1100),
  orb: inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 240),
  gib: inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 400),
};
// 캐릭터 스프라이트: assets/ 에 그림이 있으면 사용(항상 카메라를 보는 평면), 없으면 위의 3D 박스 캐릭터로
const TILT = -0.6;                                                 // 스프라이트를 뒤로 기울여 비스듬한 위의 카메라를 정면으로
const SPR = {
  soldier: { file: 'soldier.png', s: 4.8, max: 12 }, small: { file: 'small.png', s: 3.3, max: 2000 }, runner: { file: 'runner.png', s: 3.4, max: 1000 }, bomb: { file: 'bomber.png', s: 4.4, max: 260 },
  user: { file: 'user_monster.png', s: 16, max: 12 }, brute: { file: 'brute.png', s: 6.4, max: 80 }, boss: { file: 'boss.png', s: 11, max: 8 }, golem: { file: 'golem.png', s: 12, max: 24 },
  drake: { file: 'ally_drake.png', s: 17, max: 6 }, whale: { file: 'ally_whale.png', s: 14, max: 6 }, sentinel: { file: 'ally_sentinel.png', s: 12, max: 6 }, turtle: { file: 'ally_turtle.png', s: 12, max: 6 }, archer: { file: 'ally_archer.png', s: 12, max: 6 },
};
const sprGeo = new THREE.PlaneGeometry(1, 1); sprGeo.translate(0, 0.38, 0);   // 발바닥이 캔버스 아래에서 12% 위
for (const k in SPR) new THREE.TextureLoader().load('assets/' + SPR[k].file, (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; SPR[k].tex = tex;
  SPR[k].mesh = M['spr_' + k] = inst(sprGeo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide }), SPR[k].max);
}, undefined, () => { /* 이 그림이 없음: 3D 모델 계속 사용 */ });
// 얼음 블록 안에 언 보상 그림: assets/weapon_<무기 id>.png 와 assets/reward_<rate|power|nova>.png, 그림이 없으면 빛나는 작은 결정 표시
const ICON = {};
function loadIcon(key) { new THREE.TextureLoader().load('assets/' + key + '.png', (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; ICON[key] = tex; }, undefined, () => {}); }
{ const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); M.shadow = inst(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false }), 2200); }
const golemMesh = new THREE.Mesh(golemGeo, vcMat({ emissive: 0x0e3a52 })); golemMesh.castShadow = true; golemMesh.visible = false; scene.add(golemMesh);

// ---------- 파티클 ----------
const PMAX = 6000;
const pPos = new Float32Array(PMAX * 3).fill(-999), pVel = new Float32Array(PMAX * 3), pBase = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
const pLife = new Float32Array(PMAX), pMaxL = new Float32Array(PMAX), pGrav = new Float32Array(PMAX), pSize = new Float32Array(PMAX);
let pNext = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: 'attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC * a, 1.0); }',
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; scene.add(pPoints);
function spark(x, y, z, vx, vy, vz, col, life, size = 1, grav = 16) {
  const i = pNext; pNext = (pNext + 1) % PMAX;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pBase[i * 3] = col[0]; pBase[i * 3 + 1] = col[1]; pBase[i * 3 + 2] = col[2]; pLife[i] = pMaxL[i] = life; pGrav[i] = grav; pSize[i] = size;
}
function burst(x, y, z, n, col, spd, life = 0.5, size = 1, up = 0.9) {
  for (let k = 0; k < n; k++) { const a = rand(Math.PI * 2), s = spd * rand(0.25, 1); spark(x, y, z, Math.cos(a) * s, rand(spd * up), Math.sin(a) * s, col, life * rand(0.5, 1.2), size * rand(0.6, 1.3)); }
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
    pVel[i * 3 + 1] -= pGrav[i] * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    const k = pLife[i] / pMaxL[i];
    pCol[i * 3] = pBase[i * 3] * k; pCol[i * 3 + 1] = pBase[i * 3 + 1] * k * k; pCol[i * 3 + 2] = pBase[i * 3 + 2] * k * k;
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aCol.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
}
// 바닥 광륜
const ringPool = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); ringPool.push({ m, on: false, r: 0, max: 1, speed: 1 });
}
function addRing(x, z, max, speed, col) {
  const r = ringPool.find((q) => !q.on) || ringPool[0];
  r.on = true; r.r = 0.5; r.max = max; r.speed = speed; r.m.position.set(x, 0.12, z); r.m.material.color.setRGB(col[0], col[1], col[2]); r.m.visible = true;
}

// ---------- 데이터 ----------
const WEAPONS = [   // kind 가 탄도를 정함: bolt 직사 / shot 산사 / boom 회전 관통 / orb 낙점 폭발 / lance 관통 감속 / missile 유도 / zap 연쇄 / flame, laser 지속 조사
  { name: '수정 석궁', id: 'crossbow', kind: 'bolt', rate: 4, dmg: 12, pierce: 2, speed: 62, hw: 0.3, col: [0.6, 1.8, 2.6], size: [0.26, 0.26, 2.2] },
  { name: '연발 석궁', id: 'repeater', kind: 'bolt', rate: 8.5, dmg: 12, pierce: 3, speed: 72, hw: 0.3, col: [0.7, 2.6, 1.2], size: [0.26, 0.26, 2.4] },
  { name: '산탄총', id: 'scatter', kind: 'shot', rate: 2.6, dmg: 12, pellets: 7, pierce: 2, est: 120, speed: 58, hw: 0.4, col: [2.6, 2.0, 0.5], size: [0.36, 0.36, 0.8] },
  { name: '부메랑 칼날', id: 'blade', kind: 'boom', rate: 1.2, dmg: 30, speed: 40, reach: 36, pierce: 1e9, hw: 1.2, blockMul: 3.2, col: [2.6, 0.7, 1.9] },
  { name: '뇌광포', id: 'cannon', kind: 'orb', rate: 2.8, dmg: 44, speed: 56, aoe: 3.4, hw: 0.5, col: [1.9, 1.0, 3.0] },
  { name: '빙정 장창', id: 'lance', kind: 'lance', rate: 2.2, dmg: 46, speed: 80, pierce: 7, hw: 0.45, blockMul: 1.4, col: [1.6, 2.4, 3.0], size: [0.32, 0.32, 4.4] },
  { name: '유도 미사일', id: 'missile', kind: 'missile', rate: 3.4, dmg: 34, speed: 44, aoe: 2.4, hw: 0.45, col: [3.0, 1.3, 0.4] },
  { name: '연쇄 번개', id: 'chain', kind: 'zap', rate: 2.6, dmg: 52, chain: 5, col: [1.6, 1.9, 3.2] },
  { name: '화염 방사', id: 'flame', kind: 'flame', dps: 135, range: 31 },
  { name: '프리즘 광선', id: 'prism', kind: 'laser', dps: 210, range: 90, col: [3.0, 1.0, 2.2] },
];
for (const w of WEAPONS) loadIcon('weapon_' + w.id);
for (const k of ['rate', 'power', 'nova']) loadIcon('reward_' + k);
const FOES = {
  small: { hp: 11, spd: 4.8, r: 0.62, leak: 1, s: 1.5, col: [0.74, 0.44, 0.9] },
  runner: { hp: 8, spd: 8.4, r: 0.55, leak: 1, s: 1.25, col: [1.0, 0.78, 0.3] },
  bomb: { hp: 20, spd: 4.8, r: 0.8, leak: 1, s: 1.9, col: [1.6, 0.6, 0.15], bomb: 1 },   // 폭렬괴: 죽을 때 한 바퀴 폭발하고 연달아 터질 수 있음
  user: { hp: 680, spd: 1.9, r: 3.0, leak: 3, s: 4.6, col: [0.5, 0.75, 0.55], big: 1, giant: 1 },
  brute: { hp: 170, spd: 2.7, r: 1.5, leak: 3, s: 1.4, col: [0.9, 0.36, 0.3], big: 1 },
  boss: { hp: 2600, spd: 1.7, r: 2.9, leak: 10, s: 2.7, col: [1.0, 0.25, 0.6], big: 1, boss: 1 },
};
const ALLIES = {   // 얼음 블록에 얼어 있는 거대한 조력자; 자기 그림이 없으면 골렘 그림을 빌려 색조를 바꿈
  golem: { name: '수정 골렘', tint: [1.1, 1.1, 1.1], col: [0.6, 1.8, 2.4] },      // 침식 물결 레인을 따라 짓밟으며 감
  drake: { name: '화염 날개 드레이크', tint: [1.6, 0.8, 0.55], col: [2.6, 1.0, 0.3] },     // 저공으로 스쳐 지나며 불을 뿜음
  turtle: { name: '뇌고 거북', tint: [0.75, 1.35, 0.8], col: [1.0, 2.4, 1.2] },   // 방어선 앞을 지키며 한 번씩 적을 밀쳐냄
  archer: { name: '별활 거신', tint: [1.4, 1.2, 0.6], col: [2.6, 2.0, 0.6] },     // 자리 잡고 전장을 꿰뚫는 거대한 화살 연사
  whale: { name: '얼음 해일 고래', tint: [0.7, 0.9, 1.6], col: [0.6, 1.5, 2.8] },      // 바닥에 붙어 돌진하며 지나가는 적을 밀어내고 얼려 느리게 함
  sentinel: { name: '수정 방패 수호자', tint: [0.9, 1.0, 1.4], col: [0.9, 1.6, 2.6] },   // 소대 앞에서 방패를 들어 막고, 정기적으로 달라붙은 적을 밀어냄
};
const ALLY_KINDS = Object.keys(ALLIES);
const ARROW = { kind: 'lance', hw: 1.1, speed: 74, pierce: 40, col: [2.6, 2.0, 0.6], size: [0.7, 0.7, 7] };
const REWARDS = {
  squad: { label: '대원 +1', col: [0.4, 0.9, 2.2] },
  weapon: { label: '무기 업그레이드', col: [2.2, 1.5, 0.3] },
  rate: { label: '연사 속도 +20%', col: [0.5, 2.2, 1.0] },
  power: { label: '데미지 +25%', col: [2.4, 0.6, 0.4] },
  nova: { label: '전면 소탕', col: [2.0, 0.8, 2.4] },
};
for (const k of ALLY_KINDS) REWARDS[k] = { label: ALLIES[k].name, col: ALLIES[k].col };
const STREAK = { 30: '파죽지세', 100: '천군 쓸기', 250: '패도의 기세', 600: '만부부적', 1200: '천하무적' };

// ---------- 상태 ----------
let state = 'title', held = false;
let time = 0, kills = 0, life = 20, stageN = 1, stageT = 0, spawnT = 0, combo = 0, comboT = 0, shake = 0, hurt = 0, slowT = 0, bannerT = 0, fireT = 0, blockT = 0, blockCount = 0, auto = false;
let best = 0; try { best = +localStorage.getItem('echo_tide_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
let foes = [], bolts = [], gibs = [], novas = [], zaps = [], beams = [], allies = [], booms = [], corpses = [], giantT = 14, flameAcc = 0, boltId = 0, fever = 0, feverT = 0, boomN = 0, boomT = 0;
const squad = { x: 4, tx: 4, n: 1, tier: 0, power: 1, rate: 1, kick: 0 };
const grid = Array.from({ length: 18 }, () => []);
const cell = (x) => clamp(Math.floor(x + 9), 0, 17);
const hs = () => 1.3 ** (stageN - 1);
const slots = () => { const o = []; for (let i = 0; i < squad.n; i++) { const row = Math.floor(i / 3), inRow = Math.min(3, squad.n - row * 3); o.push([squad.x + ((i % 3) - (inRow - 1) / 2) * 1.9, -row * 1.9]); } return o; };
const dps = () => { const w = WEAPONS[squad.tier]; return (w.est || w.dps || w.rate * w.dmg * (w.pellets || 1) * (w.blockMul || 1)) * squad.n * squad.power * squad.rate; };

// ---------- 소리(전부 실시간 합성) ----------
let ac = null, master = null, noiseBuf = null, muted = false; const lastSfx = {};
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
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(140, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const sfx = {
  shot: (k) => limited('shot', 70, () => {
    if (k === 'orb') { tone('sawtooth', 900, 140, 0.16, 0.14); hiss(0.12, 0.12, 5000); }
    else if (k === 'shot') { hiss(0.14, 0.3, 4200); tone('square', 260, 90, 0.1, 0.12); }
    else if (k === 'boom') { tone('sine', 300, 900, 0.22, 0.12); hiss(0.2, 0.08, 6000); }
    else if (k === 'lance') { tone('triangle', 2400, 700, 0.12, 0.1); hiss(0.08, 0.1, 9000); }
    else if (k === 'missile') { hiss(0.25, 0.16, 2600); tone('sine', 220, 520, 0.18, 0.07); }
    else if (k === 'zap') { tone('sawtooth', 2400, 300, 0.12, 0.14); tone('square', 3300, 600, 0.08, 0.07); hiss(0.1, 0.2, 9000); }
    else tone('triangle', 1150, 480, 0.05, 0.06);
  }),
  laser: () => limited('laser', 140, () => { tone('sawtooth', 620, 640, 0.16, 0.035); tone('sine', 1240, 1260, 0.16, 0.03); }),
  flame: () => limited('flame', 110, () => hiss(0.22, 0.11, 3200)),
  ice: () => limited('ice', 80, () => tone('triangle', rand(2200, 3000), 1200, 0.05, 0.05)),
  shatter: () => { hiss(0.5, 0.4, 9000); [1568, 2093, 2637, 3136].forEach((f, i) => tone('triangle', f, f * 0.5, 0.25, 0.14, i * 0.03)); tone('sine', 180, 50, 0.4, 0.4); },
  reward: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f * 1.02, 0.18, 0.17, i * 0.06)),
  pop: (c) => limited('pop', 38, () => { const st = Math.min(14, Math.floor(c / 8)), f = 330 * 2 ** (([0, 2, 4, 7, 9][st % 5] + 12 * Math.floor(st / 5)) / 12); tone('triangle', f, f * 0.6, 0.08, 0.1); tone('sine', 150, 55, 0.07, 0.09); }),
  boom: () => limited('boom', 90, () => { tone('sine', 170, 45, 0.3, 0.3); hiss(0.25, 0.25, 2400); }),
  leak: () => limited('leak', 120, () => { tone('sawtooth', 200, 60, 0.3, 0.3); hiss(0.2, 0.2, 1200); }),
  nova: () => { tone('sine', 90, 30, 1.0, 0.6); tone('sawtooth', 400, 1600, 0.5, 0.15); hiss(0.9, 0.4, 7000); },
  stomp: () => limited('stomp', 220, () => { tone('sine', 110, 35, 0.4, 0.5); hiss(0.3, 0.25, 1500); }),
  boss: () => { tone('sawtooth', 110, 55, 1.2, 0.3); tone('square', 82, 41, 1.2, 0.2); },
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
  stage: () => { tone('triangle', 660, 880, 0.14, 0.16); tone('triangle', 880, 1320, 0.2, 0.14, 0.1); },
};

// 음성: tools/gen_voice.py --set tide 로 미리 생성한 광시 억양 mp3(voice/index.json 은 대사 -> 파일); 없는 문구는 말하지 않음
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '물결이다, 버텨!': '蚀潮来了，顶住！', '거인이다!': '巨人来了！', '거인이 쓰러졌다!': '巨人倒下了！', '우두머리 습격!': '首领来袭！', '우두머리를 물리쳤다!': '首领已被击败！', '광열! 베어라!': '狂热！杀！', '연쇄 폭발!': '连环爆炸！', '방어선 위기!': '防线告急！', '방어선이 뚫렸다': '防线失守了', '신기록!': '新纪录！', '얼음 블록이 미끄러져 갔다': '冰块滑走了', '물결이 더 거세졌다!': '蚀潮更猛了！', '대원 추가!': '队员加一！', '연사 속도 상승!': '射速提升！', '데미지 상승!': '伤害提升！', '전면 소탕!': '清场冲击！', '파죽지세!': '势如破竹！', '천군 쓸기!': '横扫千军！', '패도의 기세!': '所向披靡！', '만부부적!': '万夫莫敌！', '천하무적!': '天下无双！', '새 무기, 연발 석궁!': '新武器，连弩！', '새 무기, 산탄총!': '新武器，散射铳！', '새 무기, 부메랑 칼날!': '新武器，回旋刃！', '새 무기, 뇌광포!': '新武器，雷光炮！', '새 무기, 빙정 장창!': '新武器，冰晶长枪！', '새 무기, 유도 미사일!': '新武器，追踪飞弹！', '새 무기, 연쇄 번개!': '新武器，连锁闪电！', '새 무기, 화염 방사!': '新武器，烈焰喷射！', '새 무기, 프리즘 광선!': '新武器，棱光射线！', '수정 골렘, 출격!': '晶石巨像，出击！', '화염 날개 드레이크, 출격!': '炎翼飞龙，出击！', '뇌고 거북, 출격!': '雷鼓巨龟，出击！', '별활 거신, 출격!': '星弓巨灵，出击！', '얼음 해일 고래, 출격!': '冰潮巨鲸，出击！', '수정 방패 수호자, 출격!': '晶盾卫士，出击！' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {                              // pri 가 높아야 말하는 중인 걸 끊을 수 있음; gap 은 같은 문구의 최소 간격(밀리초)
  const c = clips[VOICE[text] || text], now = performance.now();
  if (!c || (gap && now - (sayLast[text] || 0) < gap) || (now < sayUntil && pri <= sayPri)) return;
  sayLast[text] = now; sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => {
    if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src;
  }).catch(() => {});
}

// ---------- 화면 ----------
function banner(text, sec = 1.6) { $('banner').textContent = text; bannerT = sec; }
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  if (state === 'title') {
    s.innerHTML = '<h1>물결 소탕</h1><div class="sub">메아리 · 소대 슈팅</div><div class="help"><b>좌우로 끌어서</b> 소대 이동, 자동 발사<br>왼쪽: <b>얼음 블록</b>을 깨서 대원, 무기, 강화 획득<br>오른쪽: 밀려오는 <b>침식의 물결</b> 소탕, 방어선을 넘기지 마세요<br>빛나는 <b>폭렬괴</b>를 터뜨리면 연쇄 폭발; 충분히 죽이면 <b>광열</b> 돌입<br>화력은 한쪽으로만, 선택은 몫</div>' +
      (best ? '<div class="sub" style="margin-top:14px">최다 처치 ' + best + '</div>' : '') + '<div class="go" data-act="start">시 작</div>';
  } else {
    s.innerHTML = '<h1 class="red">방어선 붕괴</h1><div class="sub">제 ' + stageN + ' 단계까지 버팀　처치 ' + kills + '<br>최다 처치 ' + best + '</div><div class="go" data-act="start">한 판 더</div>';
  }
}
function hud() {
  $('kills').textContent = kills; $('stageN').textContent = stageN; $('life').textContent = Math.max(0, life);
  $('combo').innerHTML = combo >= 10 ? '×' + combo + '<small>연속 처치</small>' : '';
  $('weapon').innerHTML = '무기 <b>' + WEAPONS[squad.tier].name + '</b>　데미지 <b>' + Math.round(squad.power * 100) + '%</b>　연사 <b>' + Math.round(squad.rate * 100) + '%</b>';
  $('squadN').innerHTML = '대원 <b>' + squad.n + '</b>';
  $('hurt').style.opacity = hurt.toFixed(2);
  $('ffill').style.width = Math.round(fever * 100) + '%'; $('fbar').className = feverT > 0 ? 'on' : '';
  $('fever').style.opacity = feverT > 0 ? (0.6 + 0.25 * Math.sin(time * 12)).toFixed(2) : 0;
}

// ---------- 얼음 블록 ----------
const blockMat = new THREE.MeshLambertMaterial({ color: 0xa8e2ff, transparent: true, opacity: 0.5, emissive: 0x1c5878, depthWrite: false });   // 깊이를 쓰지 않아야 안에 언 그림이 얼음 위에 그려짐
const block = { on: false, x: -4, z: 0, w: 6.4, d: 3.2, h: 4.4, hp: 0, max: 1, kind: 'squad', shown: -1, jolt: 0, group: new THREE.Group() };
{
  block.ice = new THREE.Mesh(new THREE.BoxGeometry(block.w, block.h, block.d), blockMat); block.ice.position.y = block.h / 2; block.ice.castShadow = true;
  block.icon = new THREE.Mesh(G.octa(1.2), new THREE.MeshBasicMaterial({ toneMapped: false })); block.icon.position.y = block.h / 2;
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; block.cv = c; block.tex = new THREE.CanvasTexture(c); block.tex.colorSpace = THREE.SRGBColorSpace;
  block.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: block.tex, depthTest: false, transparent: true })); block.tag.scale.set(5.6, 3.5, 1); block.tag.position.y = block.h + 2.4; block.tag.renderOrder = 10;
  block.pic = new THREE.Mesh(sprGeo, new THREE.MeshBasicMaterial({ alphaTest: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.93 })); block.pic.rotation.x = TILT; block.pic.visible = false; block.pic.renderOrder = 5;
  block.group.add(block.ice, block.icon, block.pic, block.tag); block.group.visible = false; scene.add(block.group);
}
function drawTag() {
  const n = Math.ceil(block.hp); if (n === block.shown) return; block.shown = n;
  const g = block.cv.getContext('2d'); g.clearRect(0, 0, 256, 160);
  g.fillStyle = '#e0261c'; g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.roundRect(28, 6, 200, 96, 16); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.font = '900 76px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n > 9999 ? Math.round(n / 1000) + 'k' : '' + n, 128, 58);
  g.font = '700 36px "Noto Sans KR", "Malgun Gothic", sans-serif'; g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(block.label, 128, 134); g.fillStyle = '#ffe9a8'; g.fillText(block.label, 128, 134);
  block.tex.needsUpdate = true;
}
function pickReward() {
  if (blockCount === 0) return 'squad'; if (blockCount === 1 || blockCount === 3) return 'weapon'; if (blockCount === 2) return 'squad';
  const bag = []; const add = (k, n) => { for (let i = 0; i < n; i++) bag.push(k); };
  if (squad.n < 9) add('squad', 4); if (squad.tier < WEAPONS.length - 1) add('weapon', squad.tier < 3 ? 7 : 3); else add('power', 2);
  if (squad.rate < 2.4) add('rate', 2); add('power', 2); if (stageN >= 2) { add(ALLY_KINDS[Math.floor(rand(ALLY_KINDS.length))], 2); add('nova', 1); }
  return bag[Math.floor(rand(bag.length))];
}
function spawnBlock(force) {
  block.on = true; block.kind = force || pickReward(); blockCount++; block.z = -50; block.max = block.hp = Math.max(60, Math.round(dps() * (rand(5.5, 7.5) + Math.min(6, blockCount * 0.22)) * (ALLIES[block.kind] ? 1.6 : 1))); block.shown = -1; block.jolt = 0;
  block.next = Math.min(WEAPONS.length - 1, squad.tier + (Math.random() < 0.4 ? 2 : 1)); block.label = block.kind === 'weapon' ? WEAPONS[block.next].name : REWARDS[block.kind].label;
  const c = REWARDS[block.kind].col; block.icon.material.color.setRGB(c[0], c[1], c[2]); block.group.visible = true; drawTag();
  const al = ALLIES[block.kind], own = al && SPR[block.kind].tex, tex = al ? (own || SPR.golem.tex) : block.kind === 'squad' ? SPR.soldier.tex : block.kind === 'weapon' ? ICON['weapon_' + WEAPONS[block.next].id] : ICON['reward_' + block.kind], tall = al ? 2.3 : 1, wide = al ? 1.19 : 1, deep = al ? 1.9 : 1;
  block.pic.visible = !!tex; block.icon.visible = !tex; block.w = 6.4 * wide; block.d = 3.2 * deep; block.ice.scale.set(wide, tall, deep); block.ice.position.y = block.h * tall / 2; block.tag.position.y = block.h * tall + 2.4;   // 조력자의 블록은 더 높고, 안에는 본인이 얼어 있음
  if (tex) { const m = block.pic.material, t = al ? (own ? [1.0, 1.08, 1.15] : al.tint) : [1.0, 1.08, 1.15], sc = al ? 10.5 : block.kind === 'squad' ? 4.8 : 5.6; m.map = tex; m.color.setRGB(t[0], t[1], t[2]); m.needsUpdate = true; block.pic.scale.set(sc, sc, 1); block.pic.position.set(0, 0.1, 0.2); }
}
function hitBlock(dmg, x) {
  if (!block.on) return;
  block.hp -= dmg; block.jolt = 0.12;
  if (Math.random() < 0.5) spark(x + rand(-0.4, 0.4), rand(0.6, 3.6), block.z + block.d / 2 + 0.1, rand(-5, 5), rand(2, 9), rand(3, 10), [0.9, 1.8, 2.6], rand(0.25, 0.5), 0.7);
  sfx.ice();
  if (block.hp <= 0) breakBlock(true);
}
function breakBlock(won) {
  block.on = false; block.group.visible = false; blockT = rand(2.2, 3.6);
  const z = block.z, c = REWARDS[block.kind].col;
  const huge = !!ALLIES[block.kind];
  burst(block.x, huge ? 5 : 2.4, z, won ? (huge ? 320 : 150) : 40, [0.9, 1.8, 2.6], huge ? 30 : 20, 0.8, 1.4);
  for (let i = 0; i < (won ? (huge ? 80 : 36) : 10); i++) gibs.push({ x: block.x + rand(-3, 3), y: rand(0.5, huge ? 11 : 4), z: z + rand(-1.5, 1.5), vx: rand(-9, 9), vy: rand(6, 20), vz: rand(-4, 12), t: 0, life: rand(0.6, 1.1), s: rand(0.3, 0.8), col: [0.75, 1.3, 1.7], spin: rand(4, 12) });
  if (!won) { banner('얼음 블록이 미끄러져 갔다', 1.2); say('얼음 블록이 미끄러져 갔다'); return; }
  sfx.shatter(); sfx.reward(); shake = Math.max(shake, 0.9); slowT = 0.22; addRing(block.x, z, 12, 30, c); burst(block.x, 2.4, z, 60, c, 14, 0.9, 1.6);
  const k = block.kind;
  if (k === 'squad') { squad.n = Math.min(9, squad.n + 1); banner('대원 +1　현재 ' + squad.n + ' 명'); say('대원 추가!'); }
  else if (k === 'weapon') { squad.tier = block.next; fireT = 0; banner('새 무기 · ' + WEAPONS[squad.tier].name, 2); say('새 무기, ' + WEAPONS[squad.tier].name + '!', 2); }
  else if (k === 'rate') { squad.rate *= 1.2; banner('연사 속도 +20%'); say('연사 속도 상승!'); }
  else if (k === 'power') { squad.power += 0.25; banner('데미지 +25%'); say('데미지 상승!'); }
  else if (ALLIES[k]) { allies.push({ kind: k, x: 4, z: k === 'turtle' ? -7 : k === 'archer' ? -3 : k === 'sentinel' ? -9 : 2, t: 0, cd: 0 }); banner(ALLIES[k].name + ' · 출격', 2); sfx.boss(); say(ALLIES[k].name + ', 출격!', 2); }
  else if (k === 'nova') { novas.push({ r: 0, id: time }); banner('전면 소탕', 2); sfx.nova(); shake = 1.6; say('전면 소탕!', 2); }
}

// ---------- 침식의 물결 ----------
function spawnFoe(type, x, z) {
  if (foes.length >= 1500) return;
  const d = FOES[type], hp = d.hp * hs() * (d.giant ? Math.min(1, 0.5 + 0.15 * stageN) : 1);   // 초반 거인은 약하게, 시작부터 압도하지 않게
  foes.push({ type, def: d, x, z, hp, max: hp, spd: d.spd * rand(0.9, 1.1) * (d.big ? 1 : Math.min(1.5, 1 + stageN * 0.03)), r: d.r * (d.boss ? 1 : 1), flash: 0, burn: 0, alive: true, wob: rand(6), nova: -1, bid: 0, slow: 0 });
}
function spawnCluster() {
  const n = Math.min(320, 42 + stageN * 16), type = stageN >= 2 && Math.random() < 0.3 ? 'runner' : 'small', cx = rand(1.8, 6.2), hw = rand(1.3, 3.2);
  for (let i = 0; i < n; i++) spawnFoe(type, clamp(cx + rand(-hw, hw), 0.7, HALF - 0.7), SPAWN_Z - rand(0, 3 + n * 0.1));
  for (let i = 0; i < 1 + Math.floor(n / 60); i++) { spawnFoe('bomb', clamp(cx + rand(-hw, hw) * 0.7, 0.9, HALF - 0.9), SPAWN_Z - rand(1, 2 + n * 0.09)); const b = foes[foes.length - 1]; if (b.def.bomb) b.spd = FOES[type].spd * rand(0.92, 1.05); }
  if (stageN >= 2 && Math.random() < 0.6) for (let i = 0; i < Math.min(8, Math.ceil(stageN / 2)); i++) spawnFoe('brute', rand(1.6, 6.4), SPAWN_Z - rand(2, 10));
}
function damage(f, d, fire) { f.hp -= d; if (fire) f.burn = 0.2; else f.flash = 0.1; if (f.hp <= 0) kill(f, fire); }
function kill(f, fire) {
  if (!f.alive) return; f.alive = false; kills++; combo++; comboT = 1.6;
  if (STREAK[combo]) { banner(STREAK[combo] + '　×' + combo, 1.6); say(STREAK[combo] + '!'); }
  if (feverT <= 0) { fever += 1 / (150 + stageN * 60); if (fever >= 1) startFever(); }
  if (f.def.bomb) booms.push({ x: f.x, z: f.z, t: 0.07 });
  else if (!f.def.big && corpses.length < 260) corpses.push({ type: f.type, x: f.x, y: 0.4, z: f.z, vx: rand(-7, 7), vy: rand(9, 17), vz: rand(-16, -5), t: 0, life: rand(0.42, 0.6), spin: rand(-14, 14), fire });
  const c = fire ? [0.9, 0.36, 0.08] : [f.def.col[0] * 2.2, f.def.col[1] * 2.2, f.def.col[2] * 2.2], big = f.def.big;
  burst(f.x, 1, f.z, f.def.boss ? 220 : big ? 40 : fire ? 4 : 7, c, f.def.boss ? 26 : big ? 14 : 9, 0.5, big ? 1.4 : 0.9);
  for (let i = 0; i < (f.def.boss ? 40 : big ? 8 : 1); i++) if (gibs.length < 380) gibs.push({ x: f.x, y: 0.9, z: f.z, vx: rand(-6, 6), vy: rand(8, 18), vz: rand(-9, 3), t: 0, life: rand(0.45, 0.8), s: rand(0.22, 0.42) * (big ? 1.8 : 1), col: fire ? [0.25, 0.2, 0.2] : f.def.col, spin: rand(5, 14) });
  if (f.def.giant) { addRing(f.x, f.z, 16, 30, c); shake = Math.max(shake, 1.4); slowT = 0.3; burst(f.x, 3, f.z, 120, c, 22, 0.8, 1.6); banner('거인이 쓰러졌다', 1.6); sfx.nova(); say('거인이 쓰러졌다!', 2); }
  else if (f.def.boss) { addRing(f.x, f.z, 22, 34, c); shake = Math.max(shake, 2); slowT = 0.5; banner('우두머리를 물리쳤다', 2); sfx.nova(); say('우두머리를 물리쳤다!', 3); } else if (big) { addRing(f.x, f.z, 6, 22, c); sfx.boom(); } else sfx.pop(combo);
}
function startFever() { fever = 1; feverT = 7; banner('광 열', 1.6); say('광열! 베어라!', 2); shake = Math.max(shake, 0.8); sfx.stage(); sfx.nova(); addRing(squad.x, 0, 14, 40, [2.6, 1.8, 0.4]); }
function explode(x, z) {                                           // 폭렬괴 폭발: 한 바퀴 데미지, 범위 안의 동료는 한 박자 뒤에 연쇄 폭발
  for (const o of foes) if (o.alive && (o.x - x) ** 2 + (o.z - z) ** 2 < 20) damage(o, 30 * hs() ** 0.6, true);   // 괴물 체력보다 느리게 커서 10 단계 이후엔 한꺼번에 못 죽임
  addRing(x, z, 4.5, 30, [2.4, 1.1, 0.3]); burst(x, 1.2, z, 34, [1.1, 0.45, 0.1], 16, 0.5, 1.7); shake = Math.max(shake, 0.45); sfx.boom();
  boomT = 0.6; if (++boomN === 4) { banner('연쇄 폭발', 1.2); say('연쇄 폭발!', 1, 5000); }
}
function leak(f) {
  f.alive = false; life -= f.def.leak; hurt = 1; shake = Math.max(shake, 0.8); sfx.leak(); burst(f.x, 1, LINE_Z, 16, [2.4, 0.4, 0.3], 10, 0.5);
  if (life <= 0) endGame(); else if (life <= 6) say('방어선 위기!', 2, 9000);
}
function endGame() {
  if (state !== 'play') return; state = 'over'; sfx.over();
  say(kills > best && best > 0 ? '신기록!' : '방어선이 뚫렸다', 5);
  if (kills > best) { best = kills; try { localStorage.setItem('echo_tide_best', '' + best); } catch (e) { /* 무시 */ } }
  showScreen();
}
function newGame() {
  state = 'play'; time = kills = combo = comboT = shake = hurt = slowT = fireT = blockCount = 0; life = 20; stageN = 1; stageT = 0; spawnT = 1.2; blockT = 1.5;
  foes = []; bolts = []; gibs = []; novas = []; zaps = []; beams = []; allies = []; booms = []; corpses = []; fever = feverT = 0; giantT = 14; block.on = false; block.group.visible = false; golemMesh.visible = false;
  Object.assign(squad, { x: 4, tx: 4, n: 1, tier: 0, power: 1, rate: 1, kick: 0 });
  pLife.fill(0); pPos.fill(-999); for (const r of ringPool) { r.on = false; r.m.visible = false; }
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'tide'; (h.played = h.played || {}).tide = k; h.last = 'tide'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
  banner('제 1 단계', 1.6); showScreen(); sayUntil = 0; say('물결이다, 버텨!', 2);
}

// ---------- 매 프레임 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.8);
  for (const r of ringPool) if (r.on) { r.r += r.speed * dt; if (r.r >= r.max) { r.on = false; r.m.visible = false; } else { r.m.scale.setScalar(r.r); r.m.material.opacity = 1 - r.r / r.max; } }
  for (const g of gibs) { g.t += dt; g.vy -= 40 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; if (g.y < 0.15) { g.y = 0.15; g.vy *= -0.35; g.vx *= 0.6; g.vz *= 0.6; } }
  gibs = gibs.filter((g) => g.t < g.life);
  for (const c of corpses) { c.t += dt; c.vy -= 40 * dt; c.x += c.vx * dt; c.y = Math.max(0.1, c.y + c.vy * dt); c.z += c.vz * dt; }
  corpses = corpses.filter((c) => c.t < c.life);
  if (state !== 'play') { updateParticles(dt); return; }
  if (slowT > 0) { slowT -= dt; dt *= 0.3; }
  time += dt;
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  if (feverT > 0) { feverT -= dt; fever = Math.max(0, feverT / 7); }
  const fm = feverT > 0 ? 2 : 1;                                   // 광열: 연사 2 배, 총알이 두 개 더 관통
  // 단계와 적 출현
  stageT += dt;
  if (stageT >= STAGE_LEN) {
    stageT = 0; stageN++; sfx.stage();
    if (stageN % 5 === 0) { spawnFoe('boss', 4, SPAWN_Z); banner('제 ' + stageN + ' 단계 · 우두머리 습격', 2.2); sfx.boss(); say('우두머리 습격!', 3); } else { banner('제 ' + stageN + ' 단계', 1.6); if (stageN % 2 === 0) say('물결이 더 거세졌다!'); }
  }
  giantT -= dt; if (giantT <= 0) { giantT = STAGE_LEN; spawnFoe('user', rand(3.2, 4.8), SPAWN_Z); banner('거인이다', 1.8); sfx.boss(); say('거인이다!', 2); }
  spawnT -= dt; if (spawnT <= 0) { spawnCluster(); spawnT = Math.max(1.1, 3.1 - stageN * 0.17) * rand(0.8, 1.2); }
  if (!block.on) { blockT -= dt; if (blockT <= 0) spawnBlock(); }
  // 소대
  if (auto) autoPlay();
  if (keys.l) squad.tx -= 22 * dt; if (keys.r) squad.tx += 22 * dt;
  { const lim = HALF - 1.3 - (Math.min(3, squad.n) - 1) * 0.95; squad.tx = clamp(squad.tx, -lim, lim); }
  squad.x += clamp(squad.tx - squad.x, -46 * dt, 46 * dt); squad.kick = Math.max(0, squad.kick - dt * 8);
  const S = slots(), w = WEAPONS[squad.tier];
  // 얼음 블록
  if (block.on) {
    block.z += (ALLIES[block.kind] ? 1.6 : 2.3) * dt; block.jolt = Math.max(0, block.jolt - dt);
    if (block.z > -4.5) breakBlock(false);
  }
  // 적 전진
  for (const c of grid) c.length = 0;
  for (const f of foes) {
    if (!f.alive) continue;
    f.z += f.spd * (f.slow > 0 ? 0.45 : 1) * dt; if (f.slow > 0) f.slow -= dt; if (f.flash > 0) f.flash -= dt; if (f.burn > 0) f.burn -= dt;
    if (f.z >= LINE_Z) { leak(f); if (state !== 'play') return; continue; }
    grid[cell(f.x)].push(f);
  }
  // 발사
  const bf = block.z + block.d / 2, inBlock = (x) => block.on && Math.abs(x - block.x) < block.w / 2;
  beams.length = 0;
  if (w.kind === 'flame' || w.kind === 'laser') {
    const fl = w.kind === 'flame', fd = w.dps * squad.power * squad.rate * fm * dt, hw = fl ? 1.2 : 0.6;
    if (fl) sfx.flame(); else sfx.laser();
    const fr = Math.min(70, 300 / squad.n), fk = 0.8 * 70 / fr / Math.sqrt(Math.ceil(squad.n / 3) * Math.min(3, squad.n));
    for (const [sx, sz] of S) {
      let lim = w.range, onIce = false;
      if (inBlock(sx) && sz - bf < w.range) { lim = Math.max(1, sz - bf); hitBlock(fd, sx); onIce = true; }
      const c0 = cell(sx - 1.5), c1 = cell(sx + 1.5);
      for (let c = c0; c <= c1; c++) for (const f of grid[c]) if (f.alive && Math.abs(f.x - sx) < hw + f.r * 0.6 && f.z > sz - lim && f.z < sz + 1) { damage(f, fd, fl); if (!fl && Math.random() < 0.08) spark(f.x, 1.6, f.z, rand(-4, 4), rand(2, 8), rand(-4, 4), w.col, 0.25, 0.9); }
      if (fl) {
        flameAcc += fr * dt;                                     // 사람이 많을수록 1 인당 입자가 적고 어두워야 겹쳐도 새하얗게 안 됨
        for (; flameAcc >= 1; flameAcc--) { const v = 34 * rand(0.85, 1.15); spark(sx + rand(-0.12, 0.12), 1.9, sz - 2.2, rand(-1.8, 1.8), rand(0, 2.2), -v, [fk, fk * rand(0.36, 0.52), fk * 0.09], lim / v * rand(0.75, 1), rand(2.2, 4.6), -4); }
      } else {
        beams.push({ x: sx, z: sz - 2.2, len: Math.max(1, lim - 2.2) });
        if (onIce && Math.random() < 0.5) spark(sx, 1.9, bf + 0.2, rand(-6, 6), rand(2, 9), rand(2, 9), w.col, 0.3, 1.1);
      }
    }
  } else {
    fireT -= dt;
    while (fireT <= 0) {
      fireT += 1 / (w.rate * squad.rate * fm); squad.kick = 1; sfx.shot(w.kind);
      for (const [sx, sz] of S) fire(w, sx, sz - 2.3);
    }
  }
  if (feverT > 0) for (const [sx, sz] of S) if (Math.random() < 0.5) spark(sx + rand(-0.7, 0.7), 0.3, sz + rand(-0.5, 0.5), rand(-1, 1), rand(5, 11), rand(-1, 1), [1.3, 0.85, 0.2], 0.4, 1.1, 4);
  // 탄도
  for (const b of bolts) {
    const bw = b.w, k = bw.kind, z0 = b.z; b.t += dt;
    if (k === 'missile') {                                        // 유도: 소대가 얼음 레인이면 얼음을, 아니면 가장 가까운 적을 노림
      b.seek -= dt;
      if (b.seek <= 0) {
        b.seek = 0.12; b.tgt = null;
        if (inBlock(squad.x)) b.tgt = block;
        else { let best = 1e9; for (const f of foes) if (f.alive) { const q = (f.x - b.x) ** 2 + (f.z - b.z) ** 2 + (f.z > b.z ? 500 : 0); if (q < best) { best = q; b.tgt = f; } } }
      }
      if (b.tgt && (b.tgt === block ? block.on : b.tgt.alive)) {
        const tx = b.tgt === block ? clamp(b.x, block.x - 2.6, block.x + 2.6) : b.tgt.x, tz = b.tgt === block ? bf : b.tgt.z, dx = tx - b.x, dz = tz - b.z, l = Math.hypot(dx, dz) || 1, a = Math.min(1, dt * 9);
        b.vx += (dx / l * bw.speed - b.vx) * a; b.vz += (dz / l * bw.speed - b.vz) * a;
      }
      if (Math.random() < 0.6) spark(b.x, 1.9, b.z, rand(-1, 1), rand(0, 2), rand(-1, 1), [0.55, 0.3, 0.1], 0.3, 1.3, -2);
    } else if (k === 'boom') {                                    // 부메랑 칼날: 끝까지 날았다가 돌아오며 왕복으로 한 번씩 자름
      if (!b.back && b.z < b.z0 - bw.reach) { b.back = true; b.id = ++boltId; }
      if (b.back) b.vz = Math.min(bw.speed, b.vz + bw.speed * 3 * dt);
      if (Math.random() < 0.4) spark(b.x + rand(-1, 1), 1.9, b.z, rand(-2, 2), rand(0, 2), rand(-2, 2), [0.8, 0.2, 0.6], 0.2, 1);
    } else if (k === 'lance' && Math.random() < 0.6) spark(b.x, 1.9, b.z + 2, rand(-1, 1), rand(0, 1.5), rand(2, 6), [0.5, 0.9, 1.3], 0.25, 0.9, 0);
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (inBlock(b.x) && b.vz < 0 && z0 >= bf - 0.6 && b.z <= bf) {
      hitBlock(b.dmg * (bw.blockMul || 1), b.x);
      if (bw.aoe) boomFx(b.x, bf + 0.3, bw);
      if (k === 'boom') { b.back = true; b.z = bf + 0.1; b.vz = 0; b.id = ++boltId; } else b.dead = true;
      continue;
    }
    const zl = Math.min(z0, b.z), zh = Math.max(z0, b.z), c0 = cell(b.x - bw.hw - 1.5), c1 = cell(b.x + bw.hw + 1.5);
    hit: for (let c = c0; c <= c1; c++) for (const f of grid[c]) {
      if (!f.alive || f.bid === b.id || Math.abs(f.x - b.x) > f.r + bw.hw || f.z > zh + f.r || f.z < zl - f.r) continue;
      damage(f, b.dmg);
      if (bw.aoe) { for (const o of foes) if (o.alive && o !== f && (o.x - f.x) ** 2 + (o.z - f.z) ** 2 < bw.aoe * bw.aoe) damage(o, b.dmg * 0.7); boomFx(f.x, f.z, bw); b.dead = true; break hit; }
      spark(f.x, 1.5, f.z, rand(-3, 3), rand(2, 6), rand(-2, 6), bw.col, 0.15, 0.8);
      if (bw.pierce || b.n > 1) { f.bid = b.id; if (k === 'lance') f.slow = 1.4; if (--b.n <= 0) { b.dead = true; break hit; } } else { b.dead = true; break hit; }
    }
    if (b.z < -88 || b.z > 2.5 || Math.abs(b.x) > HALF + 0.5 || b.t > (k === 'shot' ? 0.7 : 5)) b.dead = true;
  }
  bolts = bolts.filter((b) => !b.dead);
  for (const z of zaps) z.t -= dt;
  zaps = zaps.filter((z) => z.t > 0);
  // 전면 소탕
  for (const nv of novas) {
    nv.r += 70 * dt;
    for (const f of foes) if (f.alive && f.nova !== nv.id && Math.hypot(f.x - squad.x, f.z) < nv.r) { f.nova = nv.id; damage(f, 420 * hs()); }
    if (Math.random() < 0.6) addRing(squad.x, 0, nv.r + 2, 80, [2.0, 0.8, 2.4]);
  }
  novas = novas.filter((nv) => nv.r < 100);
  for (const b of booms) { b.t -= dt; if (b.t <= 0 && !b.done) { b.done = true; explode(b.x, b.z); } }
  booms = booms.filter((b) => !b.done);
  if (boomT > 0) { boomT -= dt; if (boomT <= 0) boomN = 0; }
  // 골렘
  for (const a of allies) {
    a.t += dt; const col = ALLIES[a.kind].col, beat = (hz) => Math.floor(a.t * hz) !== Math.floor((a.t - dt) * hz);
    if (a.kind === 'golem') {                                     // 골렘: 짓밟으며 전진
      a.z -= 6.5 * dt;
      for (const f of foes) if (f.alive && Math.abs(f.z - a.z) < 4.5 && Math.abs(f.x - a.x) < 5.5) damage(f, 1400 * hs() * dt);
      if (beat(3)) { addRing(a.x, a.z, 9, 26, col); shake = Math.max(shake, 0.6); sfx.stomp(); burst(a.x, 0.5, a.z, 30, [0.7, 1.6, 2.2], 14, 0.5, 1.2); }
      if (a.z < -84) a.dead = true;
    } else if (a.kind === 'drake') {                              // 드레이크: 전장을 빠르게 스치며 아래로 불바다
      a.z -= 26 * dt;
      for (const f of foes) if (f.alive && f.z > a.z - 9 && f.z < a.z + 3 && f.x > 0) damage(f, 2600 * hs() * dt, true);
      for (let i = 0; i < 5; i++) spark(rand(0.6, HALF - 0.6), rand(0.5, 3), a.z - rand(0, 8), rand(-3, 3), rand(2, 9), rand(-6, 2), [0.9, 0.36, 0.08], rand(0.3, 0.7), rand(2.5, 5), -5);
      sfx.flame(); if (beat(4)) shake = Math.max(shake, 0.4);
      if (a.z < -90) { if ((a.pass = (a.pass || 0) + 1) < 3) a.z = 10; else a.dead = true; }   // 왕복 세 번 스침
    } else if (a.kind === 'turtle') {                             // 거북: 방어선 앞을 지키고, 한 번마다 주변 적에 피해·밀침·둔화
      if (beat(1.25)) {
        for (const f of foes) if (f.alive && (f.x - a.x) ** 2 + (f.z - a.z) ** 2 < 18 * 18) { damage(f, 240 * hs()); if (f.alive && !f.def.big) f.z -= 5; f.slow = 1.2; }
        addRing(a.x, a.z, 18, 46, col); addRing(a.x, a.z, 10, 30, [1.6, 2.6, 1.8]); shake = Math.max(shake, 0.9); sfx.stomp(); burst(a.x, 0.6, a.z, 50, col, 20, 0.5, 1.3);
      }
      if (a.t > 20) a.dead = true;
    } else if (a.kind === 'whale') {                              // 고래: 돌진하며 지나가는 잡몹을 밀어내고 전부 둔화
      a.z -= 17 * dt;
      for (const f of foes) if (f.alive && f.x > 0 && f.z > a.z - 5 && f.z < a.z + 3) { damage(f, 650 * hs() * dt); if (f.alive) { f.slow = 2.2; if (!f.def.big) f.z = Math.min(f.z, a.z - 4.5 + rand(-0.6, 0.6)); } }
      for (let i = 0; i < 4; i++) spark(rand(0.6, HALF - 0.6), rand(0.3, 2), a.z + rand(-2, 5), rand(-4, 4), rand(1, 7), rand(2, 9), [0.5, 1.1, 1.9], rand(0.3, 0.7), rand(1.4, 3), 4);
      if (beat(3)) { addRing(a.x, a.z - 3, 9, 28, col); shake = Math.max(shake, 0.4); sfx.boom(); }
      if (a.z < -86) { if ((a.pass = (a.pass || 0) + 1) < 2) a.z = 8; else a.dead = true; }    // 두 번 돌진
    } else if (a.kind === 'sentinel') {                           // 수호자: 방패 앞은 벽이라 잡몹이 못 지나감; 2 초마다 달라붙은 무리를 밀어냄
      const wall = a.z - 3;
      for (const f of foes) if (f.alive && f.x > 0 && f.z > wall && f.z < a.z + 2) { if (f.def.big) f.z -= f.spd * dt * 0.6; else f.z = wall; }
      if (beat(0.5)) {
        for (const f of foes) if (f.alive && f.x > 0 && f.z > wall - 11 && f.z < a.z + 2) { damage(f, 200 * hs()); if (f.alive) { f.z -= f.def.big ? 3 : 10; f.slow = 0.8; } }
        addRing(a.x, wall, 13, 40, col); shake = Math.max(shake, 0.8); sfx.stomp(); burst(a.x, 1.5, wall, 60, col, 22, 0.5, 1.3); a.push = 0.25;
      }
      a.push = Math.max(0, (a.push || 0) - dt);
      if (a.t > 20) a.dead = true;
    } else {                                                      // 거신: 자리 잡고 전장을 꿰뚫는 거대한 화살 연사
      a.cd -= dt;
      while (a.cd <= 0) { a.cd += 0.22; const x = rand(0.9, HALF - 0.9); bolts.push({ x, z: a.z - 3, z0: a.z, vx: 0, vz: -ARROW.speed, dmg: 130 * hs(), w: ARROW, t: 0, id: ++boltId, n: ARROW.pierce, back: false, tgt: null, seek: 0, dead: false }); sfx.shot('lance'); }
      if (a.t > 20) a.dead = true;
    }
    if (a.dead) burst(a.x, 4, a.z, 40, col, 14, 0.7, 1.4);
  }
  allies = allies.filter((a) => !a.dead);
  foes = foes.filter((f) => f.alive);
  updateParticles(dt);
}
function boomFx(x, z, w) { addRing(x, z, w.aoe, 20, [w.col[0] * 0.7, w.col[1] * 0.7, w.col[2] * 0.7]); burst(x, 1.2, z, 14, w.col, 12, 0.35, 1.2); sfx.boom(); }
function fire(w, x, z) {
  const d = w.dmg * squad.power;
  spark(x, 1.9, z, rand(-2, 2), rand(1, 4), rand(-8, -3), w.col, 0.12, 0.9, 0);
  if (w.kind === 'zap') { zap(x, z, d, w); return; }
  if (bolts.length > 700) return;
  const mk = (vx, vz) => bolts.push({ x, z, z0: z, vx, vz, dmg: d, w, t: 0, id: ++boltId, n: (w.pierce || 1) + (feverT > 0 && !w.aoe ? 2 : 0), back: false, tgt: null, seek: 0, dead: false });
  if (w.kind === 'shot') for (let i = 0; i < w.pellets; i++) { const a = (i - (w.pellets - 1) / 2) * 0.065 + rand(-0.02, 0.02); mk(Math.sin(a) * w.speed, -Math.cos(a) * w.speed); }
  else mk(w.kind === 'missile' ? rand(-16, 16) : 0, -w.speed);
}
function zap(x, z, d, w) {                                          // 연쇄 번개: 가장 가까운 목표를 때리고 적 사이를 뛰어다님
  const pts = [[x, z]];
  if (block.on && Math.abs(x - block.x) < block.w / 2) { pts.push([x + rand(-0.6, 0.6), block.z + block.d / 2]); hitBlock(d, x); }
  else {
    let cur = null, best = 1e9;
    for (const f of foes) if (f.alive && f.z < z && z - f.z < 48 && Math.abs(f.x - x) < 4) { const q = z - f.z + Math.abs(f.x - x) * 2; if (q < best) { best = q; cur = f; } }
    const seen = new Set();
    for (let j = 0; cur && j <= w.chain; j++) {
      seen.add(cur); pts.push([cur.x, cur.z]); damage(cur, d * (j ? 0.7 : 1)); burst(cur.x, 1.4, cur.z, 3, w.col, 8, 0.2, 0.9);
      let nx = null, nb = 49; for (const f of foes) if (f.alive && !seen.has(f)) { const q = (f.x - cur.x) ** 2 + (f.z - cur.z) ** 2; if (q < nb) { nb = q; nx = f; } }
      cur = nx;
    }
    if (pts.length === 1) pts.push([x + rand(-1.5, 1.5), z - 12]);
  }
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; let px = ax, pz = az;
    for (let q = 1; q <= 3; q++) { const kx = q === 3 ? bx : ax + (bx - ax) * q / 3 + rand(-0.7, 0.7), kz = q === 3 ? bz : az + (bz - az) * q / 3 + rand(-0.7, 0.7); segs.push([px, pz, kx, kz]); px = kx; pz = kz; }
  }
  if (zaps.length < 40) zaps.push({ segs, t: 0.17 });
}
function autoPlay() {                                              // 자동 플레이(테스트용): 물결이 멀면 얼음을 깨고, 가까우면 돌아와 적 소탕
  let near = null; for (const f of foes) if (f.alive && (!near || f.z > near.z)) near = f;
  const flame = WEAPONS[squad.tier].kind === 'flame', danger = near && near.z > (flame ? -24 : -34);
  if (block.on && !danger) squad.tx = block.x + Math.sin(time * 2) * 1.5;
  else if (near) squad.tx = near.x - 0.3; else squad.tx = 4;
}
function draw() {
  for (const k in M) M[k].userData.n = 0;
  const t = time;
  for (const [i, [sx, sz]] of slots().entries()) {
    const sp = SPR.soldier, hop = Math.abs(Math.sin(t * 9 + i)) * 0.06;
    if (sp.mesh) { put(sp.mesh, sx, hop, sz + squad.kick * 0.2, 0, sp.s, sp.s * (1 - squad.kick * 0.05), 1, 1, 1, 1, TILT); put(M.shadow, sx, 0.06, sz, 0, 1.0, 1, 0.6, 1, 1, 1); }
    else put(M.soldier, sx, hop, sz + squad.kick * 0.16, 0, 1.75, 1.75, 1.75, 1, 1, 1);
  }
  for (const f of foes) {
    const d = f.def, k = f.flash > 0 ? 2.2 : 1, m = d.big ? M.brute : M.foe, bob = Math.abs(Math.sin(t * (d.spd * 1.8) + f.wob)) * 0.18;
    let r = d.col[0] * k, g = d.col[1] * k, b = d.col[2] * k; if (f.burn > 0) { r = 1.5; g = 0.6; b = 0.16; } else if (f.slow > 0) { r *= 0.6; g = g * 0.8 + 0.3; b = b * 0.8 + 0.6; }
    const sp0 = SPR[f.type], sp = sp0.mesh || !d.bomb ? sp0 : SPR.small, ss = sp0.s;   // 폭렬괴는 자기 그림이 없으면 잡몹 그림을 빌려 깜빡이는 주황으로 염색
    if (sp.mesh) {                                                 // 스프라이트: 통통 튀며 걷고 좌우로 살짝 흔들리고, 맞으면 밝아짐
      const ph = t * d.spd * 1.8 + f.wob, hop = Math.abs(Math.sin(ph)), flip = f.wob > 3 ? -1 : 1, q = f.flash > 0 ? 2.3 : 1;
      let cr = q, cg = q, cb = q; if (d.bomb) { const p = 0.7 + 0.3 * Math.sin(t * 10 + f.wob); if (sp0.mesh) cr = cg = cb = q * (0.85 + p * 0.4); else { cr = q * (1.3 + p); cg = q * 0.8 * p; cb = q * 0.25; } }
      if (!d.bomb && f.burn > 0) { cr = 1.7; cg = 0.8; cb = 0.45; } else if (f.slow > 0) { cr = 0.6; cg = 0.9; cb = 1.4; }
      put(sp.mesh, f.x, hop * 0.3 * d.r, f.z, 0, ss * flip * (1.04 - hop * 0.06), ss * (0.95 + hop * 0.08), 1, cr, cg, cb, TILT, Math.sin(ph) * 0.09 * flip);
      put(M.shadow, f.x, 0.06, f.z, 0, d.r * 1.5, 1, d.r * 0.85, 1, 1, 1);
    } else put(m, f.x, bob, f.z, Math.sin(t * 5 + f.wob) * 0.25, d.s, d.s, d.s, r, g, b);
    if (d.giant || d.boss) {                                       // 거인과 우두머리의 체력바
      const W = d.r * 2.6, k2 = clamp(f.hp / f.max, 0, 1), bz = f.z + d.r * 0.9 + 1;   // 발 앞 바닥에 붙어 어디로 가든 보임
      put(M.bolt, f.x, 0.2, bz, 0, W + 0.3, 0.1, 0.8, 0.05, 0.05, 0.07); put(M.bolt, f.x - W * (1 - k2) / 2, 0.3, bz, 0, W * k2, 0.1, 0.52, 2.4, 0.45 + k2 * 0.9, 0.3);
    }
  }
  for (const c of corpses) {                                         // 날아가는 잡몹: 공중제비하며 뒤로 날고 점점 작아짐
    const sp0 = SPR[c.type], sp = sp0.mesh ? sp0 : c.type === 'bomb' ? SPR.small : sp0; if (!sp.mesh) continue;
    const k = 1 - c.t / c.life * 0.55, q = c.fire ? 0.4 : 1.5;
    put(sp.mesh, c.x, c.y, c.z, 0, sp0.s * k, sp0.s * k, 1, q, q * (c.fire ? 0.7 : 1), q * (c.fire ? 0.6 : 1), TILT, c.spin * c.t);
  }
  for (const b of bolts) {
    const w = b.w, c = w.col, k = w.kind;
    if (k === 'boom') { const a = b.t * 22; put(M.bolt, b.x, 1.9, b.z, a, 2.4, 0.14, 0.5, c[0], c[1], c[2]); put(M.bolt, b.x, 1.9, b.z, a + Math.PI / 2, 2.4, 0.14, 0.5, c[0], c[1], c[2]); }
    else if (k === 'orb') put(M.orb, b.x, 1.9, b.z, b.t * 8, 0.6, 0.6, 0.6, c[0], c[1], c[2]);
    else if (k === 'missile') { const a = Math.atan2(b.vx, b.vz); put(M.bolt, b.x, 1.9, b.z, a, 0.36, 0.36, 1.2, 0.9, 0.9, 1.0); put(M.orb, b.x - Math.sin(a) * 0.7, 1.9, b.z - Math.cos(a) * 0.7, 0, 0.3, 0.3, 0.3, c[0], c[1], c[2]); }
    else put(M.bolt, b.x, 1.9, b.z, Math.atan2(b.vx, b.vz), w.size[0], w.size[1], w.size[2], c[0], c[1], c[2]);
  }
  for (const z of zaps) for (const [ax, az, bx, bz] of z.segs) put(M.bolt, (ax + bx) / 2, 1.9, (az + bz) / 2, Math.atan2(bx - ax, bz - az), 0.3, 0.3, Math.hypot(bx - ax, bz - az), 1.6 * z.t / 0.17 + 0.3, 1.9 * z.t / 0.17 + 0.3, 3.2);
  for (const bm of beams) { const fw = 0.34 + Math.sin(t * 40 + bm.x) * 0.08; put(M.bolt, bm.x, 1.9, bm.z - bm.len / 2, 0, fw, fw, bm.len, 2.2, 0.6, 1.6); put(M.bolt, bm.x, 1.9, bm.z - bm.len / 2, 0, fw * 0.4, fw * 1.2, bm.len, 3, 2.4, 3); }
  for (const g of gibs) { const s = g.s * (1 - (g.t / g.life) * 0.5); put(M.gib, g.x, g.y, g.z, g.spin * g.t, s, s, s, g.col[0], g.col[1], g.col[2], g.spin * g.t * 0.7); }
  if (block.on) {
    const j = block.jolt > 0 ? rand(-0.08, 0.08) : 0;
    block.group.position.set(block.x + j, 0, block.z); block.icon.rotation.y = t * 1.6; block.icon.rotation.x = t * 0.7;
    blockMat.opacity = 0.34 + 0.3 * (block.hp / block.max); drawTag();
  }
  golemMesh.visible = false;
  for (const a of allies) {                                          // 자기 그림이 있으면 그걸, 없으면 골렘 그림을 빌려 색조 변경, 그것도 없으면 3D 모델
    const own = SPR[a.kind].mesh, sp = own ? SPR[a.kind] : SPR.golem, c = own ? [1.1, 1.1, 1.1] : ALLIES[a.kind].tint, fly = a.kind === 'drake' || a.kind === 'whale';
    const hop = fly ? (a.kind === 'drake' ? 4 : 1.2) + Math.sin(a.t * 5) * 0.5 : Math.abs(Math.sin(a.t * (a.kind === 'golem' ? 9.4 : 3.9))) * 0.5;
    if (sp.mesh) { put(sp.mesh, a.x, hop, a.z, 0, sp.s, sp.s * (1 - (fly ? 0 : hop * 0.06)), 1, c[0], c[1], c[2], TILT, Math.sin(a.t * 4.7) * 0.06); put(M.shadow, a.x, 0.06, a.z, 0, 4, 1, 2.4, 1, 1, 1); }
    else { golemMesh.visible = true; golemMesh.position.set(a.x, hop, a.z); }
  }
  for (const k in M) { const m = M[k]; m.count = m.userData.n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  lineMat.opacity = 0.55 + Math.sin(performance.now() * 0.004) * 0.2 + hurt * 0.4;
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.5, CAM.y + rand(-1, 1) * shake * 0.4, CAM.z + rand(-1, 1) * shake * 0.3);
  hud();
  composer.render();
}

// ---------- 입력 ----------
const keys = { l: false, r: false };
function pointerX(e) { const r = stage.getBoundingClientRect(); squad.tx = ((e.clientX - r.left) / r.width * 2 - 1) * (HALF + 1.5); }
stage.addEventListener('pointermove', (e) => { if (state === 'play' && !auto) pointerX(e); });
stage.addEventListener('pointerdown', (e) => {
  initAudio();
  const a = e.target.closest && e.target.closest('[data-act]');
  if (a && a.dataset.act === 'start') { newGame(); return; }
  if (state === 'play' && !auto) pointerX(e);
});
addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
  if (e.code === 'KeyM') muted = !muted;
  if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { initAudio(); newGame(); }
});
addEventListener('keyup', (e) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false; });
addEventListener('resize', resize);

// ---------- 메인 루프 ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (held) return;
  update(dt); draw();
}
resize(); showScreen(); requestAnimationFrame(frame);

// 디버그 입구: 미리보기에서 시간 진행과 자동 플레이용
window.__tide = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { auto = true; newGame(); auto = false; },   // 디버그 시작은 체크인으로 안 침
   draw, auto(on) { auto = on; },
  get iconArt() { return WEAPONS.map((w) => w.id + ':' + (ICON['weapon_' + w.id] ? 'own' : 'none')).join(' '); },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get allyArt() { return ALLY_KINDS.map((k) => k + ':' + (SPR[k].mesh ? 'own' : 'fallback')).join(' '); }, showBlock(kind, tier) { if (tier !== undefined) squad.tier = Math.max(0, tier - 1); spawnBlock(kind); block.z = -26; },
  spawn: (type, x, z) => spawnFoe(type, x, z),
  give(kind) { block.on = true; block.kind = kind; block.z = -20; block.next = Math.min(WEAPONS.length - 1, squad.tier + 1); breakBlock(true); }, weapon(i) { squad.tier = i; fireT = 0; }, fever: () => startFever(), setStage(n) { stageN = n; stageT = 0; },
  get s() { return { state, time: +time.toFixed(1), stage: stageN, life, kills, foes: foes.length, n: squad.n, tier: squad.tier, power: +squad.power.toFixed(2), rate: +squad.rate.toFixed(2), dps: Math.round(dps()), blocks: blockCount, combo, bolts: bolts.length, fever: +fever.toFixed(2), allies: allies.map((a) => a.kind + ':' + a.t.toFixed(0)).join(' '), giantZ: (foes.find((f) => f.def.giant) || {}).z }; },
};
