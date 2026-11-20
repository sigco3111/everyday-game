// 《메아리: 크리스탈 수호전》— 타워디펜스. 4 개의 맵이 순서대로 해금되고, 길가에 타워를 세워 스테이지마다 20 웨이브의 적을 막는다. 위급할 때는 6 개의 궁극기로 정리.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLS = 26, ROWS = 14, CS = 4, HX = COLS * CS / 2, HZ = ROWS * CS / 2, MAXR = 20;
const CAM_H = 66, CAM_D = 38, CAM_Z = 3;
const $ = (id) => document.getElementById(id);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cx = (c) => (c - COLS / 2 + 0.5) * CS, cz = (r) => (r - ROWS / 2 + 0.5) * CS;

// ---------- 저장: 스테이지별 획득 별 수 ----------
let dry = false;                      // 테스트 시 저장 안 함
const save = (() => { try { return JSON.parse(localStorage.getItem('echo_td')) || {}; } catch (e) { return {}; } })();
if (!Array.isArray(save.stars)) save.stars = [];
const persist = () => { if (dry) return; try { localStorage.setItem('echo_td', JSON.stringify(save)); } catch (e) { /* 저장이 안 되면 그냥 둠 */ } };
const unlocked = (i) => i === 0 || save.stars[i - 1] > 0;

// ---------- 맵(모두 오리지널) ----------
// 테마: 바닥, 물, 나무와 돌, 조명마다 색상 한 세트. tree/tuft 는 [색조 하한, 색조 상한, 채도, 명도 하한, 명도 상한]
const THEMES = [
  { css: '#3f9a52', bg: 0x040a10, sky: 0xcfe8ff, gnd: 0x24302a, hemi: 1.5, sun: 0xffe9c4, sunK: 2.3,
    g1: [0.06, 0.17, 0.09], g2: [0.14, 0.3, 0.13], g3: [0.22, 0.34, 0.12], s1: [0.3, 0.27, 0.22], s2: [0.48, 0.43, 0.35], dirt: [0.15, 0.11, 0.07],
    w1: [0.03, 0.17, 0.26], w2: [0.08, 0.36, 0.45], foam: [0.5, 0.75, 0.8], flow: 0.9, wild1: [0.025, 0.07, 0.05], wild2: [0.06, 0.13, 0.08], fog: [0.016, 0.04, 0.063],
    vein: [0, 0, 0], flower: 1, pine: 'pine', pines: 190, rocks: 70, shards: 26, tufts: 620, tree: [0.3, 0.42, 0.4, 0.1, 0.2], rock: [0.56, 0.12, 0.16, 0.3], tuft: [0.26, 0.36, 0.5, 0.2, 0.32],
    shardC: [[0.35, 1.2, 1.9], [1.3, 0.5, 1.8]], mote: { col: [0.3, 0.55, 0.22], p: 0.12, vy: [0.1, 0.9], y: [0.6, 5], life: [2, 4] } },
  { css: '#8fc4e8', bg: 0x070c14, sky: 0xdbeaff, gnd: 0x2a3440, hemi: 1.5, sun: 0xe4edff, sunK: 2.1,
    g1: [0.23, 0.28, 0.35], g2: [0.39, 0.45, 0.54], g3: [0.31, 0.4, 0.51], s1: [0.22, 0.25, 0.31], s2: [0.38, 0.42, 0.5], dirt: [0.2, 0.23, 0.29],
    w1: [0.2, 0.4, 0.56], w2: [0.42, 0.64, 0.78], foam: [0.75, 0.9, 1.0], flow: 0.05, wild1: [0.1, 0.14, 0.2], wild2: [0.2, 0.25, 0.33], fog: [0.03, 0.05, 0.09],
    vein: [0, 0, 0], flower: 0, pine: 'pineN', pines: 170, rocks: 80, shards: 34, tufts: 260, tree: [0.46, 0.56, 0.22, 0.26, 0.4], rock: [0.58, 0.14, 0.3, 0.5], tuft: [0.52, 0.6, 0.25, 0.42, 0.6],
    shardC: [[0.4, 1.3, 2.0], [0.9, 1.6, 2.2]], mote: { col: [0.7, 0.8, 0.95], p: 0.9, vy: [-7, -3], y: [10, 26], life: [2.5, 4] } },
  { css: '#e2622a', bg: 0x0c0605, sky: 0xffd9c2, gnd: 0x2c1610, hemi: 1.35, sun: 0xffc48a, sunK: 2.2,
    g1: [0.07, 0.055, 0.05], g2: [0.17, 0.12, 0.1], g3: [0.22, 0.11, 0.06], s1: [0.2, 0.17, 0.16], s2: [0.38, 0.31, 0.27], dirt: [0.1, 0.05, 0.03],
    w1: [0.75, 0.15, 0.02], w2: [1.25, 0.42, 0.05], foam: [1.1, 0.55, 0.1], flow: 0.35, wild1: [0.04, 0.03, 0.03], wild2: [0.11, 0.07, 0.05], fog: [0.05, 0.02, 0.015],
    vein: [0.9, 0.25, 0.03], flower: 0, pine: 'pineN', pines: 70, rocks: 150, shards: 30, tufts: 140, tree: [0.02, 0.06, 0.4, 0.05, 0.09], rock: [0.03, 0.15, 0.08, 0.18], tuft: [0.04, 0.1, 0.6, 0.1, 0.2],
    shardC: [[2.0, 0.7, 0.15], [1.8, 0.35, 0.1]], mote: { col: [1.0, 0.4, 0.08], p: 0.3, vy: [1.5, 4], y: [0.3, 3], life: [1.5, 3] } },
  { css: '#8a62e6', bg: 0x06040e, sky: 0xd6ccff, gnd: 0x1c1832, hemi: 1.5, sun: 0xdcd0ff, sunK: 2.1,
    g1: [0.07, 0.06, 0.16], g2: [0.16, 0.13, 0.32], g3: [0.08, 0.2, 0.3], s1: [0.2, 0.2, 0.3], s2: [0.38, 0.37, 0.52], dirt: [0.07, 0.05, 0.14],
    w1: [0.1, 0.1, 0.3], w2: [0.3, 0.3, 0.7], foam: [0.6, 0.5, 1.0], flow: 0.5, wild1: [0.03, 0.025, 0.07], wild2: [0.08, 0.06, 0.16], fog: [0.03, 0.02, 0.07],
    vein: [0.24, 0.15, 0.65], flower: 0, pine: 'pineN', pines: 120, rocks: 90, shards: 70, tufts: 420, tree: [0.72, 0.8, 0.45, 0.12, 0.2], rock: [0.72, 0.2, 0.14, 0.26], tuft: [0.72, 0.82, 0.5, 0.22, 0.36],
    shardC: [[0.5, 0.9, 2.2], [1.5, 0.5, 2.0]], mote: { col: [0.5, 0.3, 0.9], p: 0.3, vy: [0.2, 1.5], y: [0.6, 8], life: [2, 4] } },
];
// ways: 각 길의 꺾이는 점(열, 행), 시작은 맵 밖; 여러 길은 도중에 하나로 합쳐질 수도, 각자 갈 수도 있다. extra: 몇 웨이브에 추가되는 적
const MAPS = [
  { name: '푸른 골짜기', sub: '구불구불한 긴 길, 입문용', theme: 0, gold: 240, hp: 1, river: 14,
    ways: [[[-2, 2], [5, 2], [5, 10], [11, 10], [11, 3], [17, 3], [17, 10], [22, 10], [22, 6], [24, 6]]],
    decor: [[0, 13], [1, 13], [0, 12], [25, 0], [24, 0], [25, 13], [24, 13], [20, 0], [8, 13], [9, 13], [19, 13], [0, 7], [8, 0], [2, 6]], extra: {} },
  { name: '서리 평원', sub: '얼음길이 안으로 휘감김, 크리스탈은 중앙, 공습이 빠름', theme: 1, gold: 260, hp: 1.15, river: 11,
    ways: [[[-2, 7], [3, 7], [3, 2], [20, 2], [20, 11], [7, 11], [7, 6], [13, 6]]],
    decor: [[0, 0], [1, 0], [25, 0], [25, 13], [24, 13], [0, 13], [1, 13], [23, 6], [24, 7], [12, 13], [16, 8], [5, 4], [17, 4]],
    extra: { 4: [['flyer', 5, 1.0, 2]], 9: [['flyer', 10, 0.8, 5]], 13: [['phantom', 8, 1.0, 3]], 18: [['flyer', 14, 0.6, 4]] } },
  { name: '용암 협곡', sub: '위아래 두 입구가 하나로 합쳐짐, 길이 짧고 몹이 빠름', theme: 2, gold: 300, hp: 1.05, river: 16,
    ways: [[[-2, 2], [8, 2], [8, 7], [13, 7], [13, 3], [19, 3], [19, 10], [24, 10]],
      [[-2, 11], [8, 11], [8, 7], [13, 7], [13, 3], [19, 3], [19, 10], [24, 10]]],
    decor: [[0, 6], [0, 7], [1, 6], [25, 0], [24, 0], [25, 13], [11, 0], [4, 5], [4, 8], [22, 5], [10, 12], [21, 13], [12, 10]],
    extra: { 3: [['runner', 8, 0.5, 2]], 7: [['berserker', 3, 1.6, 4]], 12: [['berserker', 6, 1.3, 3]], 17: [['jugger', 1, 1, 5]] } },
  { name: '공허의 성소', sub: '좌우 협공, 크리스탈은 중앙, 양쪽 모두 수비', theme: 3, gold: 340, hp: 1, river: null, crystal: [13, 6],
    ways: [[[-2, 1], [9, 1], [9, 4], [3, 4], [3, 11], [10, 11], [10, 6], [13, 6]],
      [[27, 11], [17, 11], [17, 8], [23, 8], [23, 1], [16, 1], [16, 6], [13, 6]]],
    decor: [[0, 13], [1, 13], [25, 0], [24, 0], [0, 7], [25, 5], [12, 0], [13, 13], [6, 7], [20, 4], [13, 10], [13, 2], [6, 13], [20, 13]],
    extra: { 5: [['shield', 4, 1.4, 3]], 10: [['boss', 1, 1, 10]], 15: [['jugger', 1, 1, 4]], 20: [['boss', 1, 1, 12]] } },
];

// ---------- 경로와 칸(맵에 따라 재계산) ----------
const paths = [], blocked = new Uint8Array(COLS * ROWS), CRYSTAL = { x: 0, z: 0 }, SPOTS = [], BRIDGES = [];
let mapI = 0, MAP = MAPS[0], TH = THEMES[0], RIVER_X = 999;
const pathOut = { x: 0, z: 0, dx: 1, dz: 0 };
function pathAt(d, pi = 0) {
  const P = paths[pi] || paths[0];
  d = clamp(d, 0, P.len);
  let s = P.seg[P.seg.length - 1];
  for (const g of P.seg) if (d <= g.start + g.len) { s = g; break; }
  const k = d - s.start;
  pathOut.x = s.a.x + s.dx * k; pathOut.z = s.a.z + s.dz * k; pathOut.dx = s.dx; pathOut.dz = s.dz;
  return pathOut;
}
const pathData = new Uint8Array(COLS * ROWS * 4);
const pathTex = new THREE.DataTexture(pathData, COLS, ROWS, THREE.RGBAFormat);
pathTex.magFilter = pathTex.minFilter = THREE.LinearFilter;
function setupGrid(i) {
  mapI = i; MAP = MAPS[i]; TH = THEMES[MAP.theme];
  paths.length = 0; SPOTS.length = 0; BRIDGES.length = 0; blocked.fill(0);
  const first = new Uint8Array(COLS * ROWS);                    // 첫 번째 길이 차지하는 칸, 지선의 합류 지점을 찾는 데 사용
  MAP.ways.forEach((way, k) => {
    const pts = way.map(([c, r]) => ({ x: cx(c), z: cz(r) })), seg = [];
    let len = 0;
    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j], b = pts[j + 1], l = Math.hypot(b.x - a.x, b.z - a.z);
      seg.push({ a, b, len: l, start: len, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l });
      len += l;
      const [c0, r0] = way[j], [c1, r1] = way[j + 1], n = Math.abs(c1 - c0) + Math.abs(r1 - r0);
      for (let q = 0; q <= n; q++) {
        const c = c0 + Math.sign(c1 - c0) * q, r = r0 + Math.sign(r1 - r0) * q;
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) { blocked[r * COLS + c] = 1; if (!k) first[r * COLS + c] = 1; }
      }
    }
    const p0 = pts[0];
    paths.push({ pts, seg, len, own: len, ex: clamp(p0.x, -HX - 1.6, HX + 1.6), ez: clamp(p0.z, -HZ - 1.6, HZ + 1.6), edge: p0.x < -HX ? 'L' : p0.x > HX ? 'R' : 'T',
      fly: { ax: clamp(p0.x, -HX - 2, HX + 2), az: clamp(p0.z, -HZ - 2, HZ + 2), len: 1 } });   // fly: 비행 유닛은 입구에서 크리스탈로 직선 비행
  });
  for (let q = 0; q < COLS * ROWS; q++) { pathData[q * 4] = blocked[q] * 255; pathData[q * 4 + 3] = 255; }
  pathTex.needsUpdate = true;
  const ls = paths[0].seg[paths[0].seg.length - 1];
  if (MAP.crystal) { CRYSTAL.x = cx(MAP.crystal[0]); CRYSTAL.z = cz(MAP.crystal[1]); } else { CRYSTAL.x = ls.b.x + ls.dx * 1.5; CRYSTAL.z = ls.b.z + ls.dz * 1.5; }
  for (let k = 1; k < paths.length; k++) for (let d = 0; d < paths[k].len; d += 1) {       // own: 지선이 본선에 합류하기 전 자기 구간의 길이
    const p = pathAt(d, k), c = Math.floor((p.x + HX) / CS), r = Math.floor((p.z + HZ) / CS);
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS && first[r * COLS + c]) { paths[k].own = d; break; }
  }
  for (const P of paths) P.fly.len = Math.hypot(CRYSTAL.x - P.fly.ax, CRYSTAL.z - P.fly.az);
  RIVER_X = MAP.river == null ? 999 : cx(MAP.river);            // 강이 맵을 세로로 가로지르고, 길이 지나는 행에는 다리를 놓음
  if (MAP.river != null) for (let r = 0; r < ROWS; r++) { const q = r * COLS + MAP.river; if (blocked[q]) BRIDGES.push(cz(r)); else blocked[q] = 2; }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (Math.abs(cx(c) - CRYSTAL.x) < 5.2 && Math.abs(cz(r) - CRYSTAL.z) < 5.2) blocked[r * COLS + c] = 1;   // 크리스탈이 차지하는 면적
  for (const [c, r] of MAP.decor) if (!blocked[r * COLS + c]) blocked[r * COLS + c] = 3;                                // 맵 안의 나무와 돌, 칸을 차지해 건설 불가
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {                           // 건설 가능한 각 칸이 커버하는 노면의 양, 자동 플레이 시 이 값으로 위치 선택
    if (blocked[r * COLS + c]) continue;
    let n = 0;
    paths.forEach((P, k) => { for (let d = 0; d < (k ? P.own : P.len); d += 2) { const p = pathAt(d, k); if (Math.hypot(p.x - cx(c), p.z - cz(r)) < 10) n++; } });
    SPOTS.push({ c, r, n });
  }
  SPOTS.sort((a, b) => b.n - a.n);
}
setupGrid(MAPS[save.last | 0] && unlocked(save.last | 0) ? save.last | 0 : 0);

// ---------- 렌더러 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040a10);
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x24302a, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe9c4, 2.3);
sun.position.set(-34, 52, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 56, bottom: -56, near: 1, far: 160 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
scene.add(sun);
{ // 바닥은 커스텀 셰이더라 그림자를 받지 않음; 위에 그림자만 보이는 투명 면을 덮음
  const m = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2 + 70, HZ * 2 + 70).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.42 }));
  m.position.y = 0.03; m.receiveShadow = true; scene.add(m);
}
const composer = new EffectComposer(renderer);
for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.depthTexture = new THREE.DepthTexture(1, 1); rt.depthTexture.type = THREE.UnsignedIntType; }   // 장면의 깊이를 남겨 뒤의 앰비언트 오클루전 계산에 사용
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.8);
composer.addPass(bloom);
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uHurt: { value: 0 }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Vector3(1, 1, 1) },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uTintK: { value: 0 }, uAb: { value: 0 }, uDark: { value: 0 },
    uShock: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uAspect: { value: 1 }, uInv: { value: 0 }, uPx: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, uTime: { value: 0 }, tDepth: { value: null }, uPI: { value: new THREE.Matrix4() }, uProjY: { value: 1 }, uAoK: { value: 4.5 }, uDbg: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uHurt, uFlash, uTintK, uAb, uDark, uAspect, uInv, uTime; uniform vec3 uFlashC, uTint; uniform vec4 uShock; uniform vec2 uPx; varying vec2 vUv;
    float gHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 tap(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }
    uniform sampler2D tDepth; uniform mat4 uPI; uniform float uProjY, uAoK, uDbg;
    vec3 vpos(vec2 uv) { vec4 c = uPI * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0); return c.xyz / c.w; }   // 깊이에서 이 픽셀의 카메라 앞 위치를 복원
    // 앰비언트 오클루전: 주변 픽셀이 이 면보 얼마나 앞에 있는지 보고, 많이 가려질수록 어두워짐. 타워 밑, 돌 틈, 나무 뿌리 경계가 자연스럽게 어두워진다
    float aoAt(vec2 uv) {
      vec3 P = vpos(uv); if (fwidth(P.z) > 0.22) return 1.0;                     // 윤곽 가장자리나 풀잎처럼 잘린 부분은 방향 계산이 부정확하니 건너뛰어 검은 점 방지
      vec3 N = normalize(cross(dFdx(P), dFdy(P)));
      float rad = 1.5 * uProjY / max(1.0, -P.z) * 0.5, a0 = gHash(vUv * vec2(913.0, 517.0)) * 6.2832, occ = 0.0;
      for (int i = 0; i < 10; i++) {
        float fi = float(i), an = a0 + fi * 2.39996, rr = sqrt((fi + 0.5) / 10.0);
        vec2 o = vec2(cos(an), sin(an)) * rr * rad; o.x /= uAspect;
        vec3 v = vpos(uv + o) - P; occ += max(0.0, dot(v, N) - 0.05) / (dot(v, v) + 0.4);
      }
      return clamp(1.0 - occ * uAoK / 10.0, 0.0, 1.0);
    }
    void main() {
      vec2 uv = vUv;
      vec2 sd = uv - uShock.xy; sd.x *= uAspect; float sl = length(sd) + 0.0001;      // 충격파: 바깥으로 퍼지는 굴절 링
      vec2 so = sd / sl * uShock.w * exp(-pow((sl - uShock.z) * 10.0, 2.0)) * 0.07; so.x /= uAspect;
      uv -= so;
      vec2 c = uv - 0.5; float r = length(c);
      vec2 off = c * r * uAb;
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      float lum0 = dot(col, vec3(0.3, 0.6, 0.1));
      float ao = mix(aoAt(uv), 1.0, smoothstep(0.5, 1.0, lum0));                // 오클루전은 환경광만 누름: 이미 밝은 곳(광원 효과, 하이라이트)은 그대로
      col *= mix(vec3(0.2, 0.23, 0.32), vec3(1.0), ao);                         // 어두우면서 약간 차가운 색
      // 틸트시프트: 화면 위아래 두 띠를 살짝 흐려 미니어처 모형 같은 느낌; 가운데 선명한 부분은 살짝 샤픈
      float band = smoothstep(0.3, 0.52, abs(vUv.y - 0.52));
      if (band > 0.02) {
        vec2 br = uPx * band * 3.4;
        vec3 acc = col + tap(uv + br * vec2(1.0, 0.0)) + tap(uv + br * vec2(-1.0, 0.0)) + tap(uv + br * vec2(0.0, 1.0)) + tap(uv + br * vec2(0.0, -1.0))
          + tap(uv + br * vec2(0.7, 0.7)) + tap(uv + br * vec2(-0.7, 0.7)) + tap(uv + br * vec2(0.7, -0.7)) + tap(uv + br * vec2(-0.7, -0.7));
        col = mix(col, acc / 9.0, band);
      } else {
        vec3 nb = (tap(uv + vec2(uPx.x, 0.0)) + tap(uv - vec2(uPx.x, 0.0)) + tap(uv + vec2(0.0, uPx.y)) + tap(uv - vec2(0.0, uPx.y))) * 0.25;
        col = max(col + (col - nb) * 0.3, 0.0);
      }
      col *= 1.0 - smoothstep(0.5, 1.05, r) * 0.5;
      float lum = dot(col, vec3(0.3, 0.6, 0.1));                    // 색보정: 채도와 대비를 살짝 올리고 전체적으로 따뜻하게
      col = max(mix(vec3(lum), col, 1.2), 0.0); col = max((col - 0.5) * 1.08 + 0.5, 0.0) * vec3(1.04, 1.0, 0.95);
      // 시네마틱 톤 커브: 하이라이트를 하얗게 날리지 않고 눌러서, 궁극기가 겹쳐도 뭉개지지 않음
      vec3 fx = col * 1.16; vec3 film = clamp((fx * (2.51 * fx + 0.03)) / (fx * (2.43 * fx + 0.59) + 0.14), 0.0, 1.0);
      col = mix(col, film, 0.62);
      float l2 = dot(col, vec3(0.3, 0.6, 0.1));
      col *= mix(vec3(0.94, 1.0, 1.07), vec3(1.05, 1.0, 0.95), smoothstep(0.08, 0.75, l2));   // 스플릿 토닝: 어두운 곳은 청록 쪽, 밝은 곳은 따뜻한 쪽
      col += (gHash(vUv * vec2(1733.0, 977.0) + fract(uTime) * 61.0) - 0.5) * 0.034 * (1.0 - l2 * 0.6);   // 필름 그레인, 그러데이션 밴딩도 함께 제거
      col = mix(col, col * uTint * 1.25 + uTint * 0.05, uTintK);
      col *= 1.0 - uDark * (0.45 + 0.4 * smoothstep(0.1, 0.8, r));
      col = mix(col, vec3(1.0) - min(col, vec3(1.0)), uInv);                             // 명중 순간의 색반전 정지 프레임
      col += uFlashC * uFlash;
      col += vec3(0.4, 0.0, 0.0) * uHurt * smoothstep(0.3, 0.9, r);
      if (uDbg > 0.5) col = vec3(aoAt(vUv));                                       // 디버그: 오클루전만 보기
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
composer.addPass(lens);
composer.addPass(new OutputPass());
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- 바닥 ----------
const floorU = {
  uP: { value: Array.from({ length: MAXR }, () => new THREE.Vector4()) },
  uC: { value: Array.from({ length: MAXR }, () => new THREE.Vector3()) },
  uTime: { value: 0 }, uHalf: { value: new THREE.Vector2(HX, HZ) }, uGrid: { value: pathTex },
  uGlow: { value: 0 }, uFrost: { value: 0 }, uFrostR: { value: 0 }, uFrostC: { value: new THREE.Vector2() }, uShow: { value: 0 },
  uRiver: { value: new THREE.Vector2(999, 0.9) }, uFlower: { value: 1 },
};
const THEME_U = { uG1: 'g1', uG2: 'g2', uG3: 'g3', uS1: 's1', uS2: 's2', uDirt: 'dirt', uW1: 'w1', uW2: 'w2', uFoam: 'foam', uWild1: 'wild1', uWild2: 'wild2', uFog: 'fog', uVein: 'vein' };
for (const k in THEME_U) floorU[k] = { value: new THREE.Vector3() };
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(500, 400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: floorU,
  vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    #define MAXR ${MAXR}
    uniform vec4 uP[MAXR]; uniform vec3 uC[MAXR]; uniform float uTime, uGlow, uFrost, uFrostR, uShow; uniform vec2 uHalf, uFrostC;
    uniform vec3 uG1, uG2, uG3, uS1, uS2, uDirt, uW1, uW2, uFoam, uWild1, uWild2, uFog, uVein; uniform vec2 uRiver; uniform float uFlower;
    uniform sampler2D uGrid; varying vec3 vPos;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      vec2 p = vPos.xz;
      float n = noise(p * 0.22) * 0.55 + noise(p * 0.9) * 0.3 + noise(p * 3.1) * 0.15;
      float g = texture2D(uGrid, (p + uHalf) / (2.0 * uHalf)).r;
      float road = smoothstep(0.4, 0.6, g);
      // 잔디: 명암 초원 + 풀잎 입자 + 드문 꽃
      vec3 grass = mix(uG1, uG2, n);
      grass = mix(grass, uG3, smoothstep(0.5, 0.8, noise(p * 0.11 + 7.0)) * 0.6);
      grass *= 0.86 + 0.28 * hash(floor(p * 5.0));
      float fh = hash(floor(p * 2.2));
      float petal = uFlower * step(0.985, fh) * smoothstep(0.2, 0.1, length(fract(p * 2.2) - 0.5));                     // 작은 둥근 꽃
      grass = mix(grass, mix(vec3(0.8, 0.75, 0.35), vec3(0.75, 0.42, 0.6), hash(floor(p * 2.2) + 3.0)), petal);
      // 돌길: 엇갈려 깐 돌, 틈은 어둡게
      vec2 q = p * 0.85; q.x += floor(q.y) * 0.5;
      vec2 f = fract(q) - 0.5; float id = hash(floor(q));
      float gap = smoothstep(0.37, 0.49, max(abs(f.x), abs(f.y)));
      vec3 stone = mix(uS1, uS2, id * 0.7 + n * 0.3) * (1.0 - gap * 0.5);
      vec3 col = mix(grass, stone, road);
      col += uVein * pow(1.0 - abs(noise(p * 0.3 + 11.0) * 2.0 - 1.0), 30.0) * (1.0 - road) * (0.55 + 0.45 * sin(uTime * 1.3 + n * 9.0));   // 지면 틈의 희미한 빛(용암, 공허)
      col = mix(col, uDirt, pow(1.0 - abs(g - 0.5) * 2.0, 5.0) * 0.6);                // 길 가장자리 흙테두리
      vec2 gq = abs(fract(p / ${CS}.0 + 0.5) - 0.5);
      // 강: 흐르는 수면, 물가의 포말과 젖은 흙
      float rd = abs(p.x - (uRiver.x + sin(p.y * 0.16) * 1.1));
      float water = 1.0 - smoothstep(1.35, 1.75, rd);
      col = mix(col, uDirt * 1.3, (1.0 - smoothstep(1.7, 2.7, rd)) * 0.65);
      vec2 wp = vec2(p.x * 1.6, p.y * 0.5 + uTime * uRiver.y);
      float rip = noise(wp) * 0.6 + noise(wp * 2.7 + 3.0) * 0.4;
      vec3 wcol = mix(uW1, uW2, rip) + uFoam * smoothstep(0.7, 0.8, rip) * 0.5;
      wcol += uFoam * 1.1 * smoothstep(0.95, 1.35, rd) * 0.3 * (0.6 + 0.4 * sin(p.y * 3.0 + uTime * 2.0));
      wcol += uFoam * pow(noise(wp * 5.0 + vec2(0.0, uTime * 2.0)), 9.0) * 2.4;                    // 수면 위 반짝이는 잔빛
      col = mix(col, wcol, water);
      float line = 1.0 - smoothstep(0.008, 0.03, min(gq.x, gq.y));
      col += vec3(0.5, 0.9, 1.0) * line * (1.0 - road) * (1.0 - water) * (0.02 + 0.1 * uShow);
      float flow = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 9.0 - (p.x + p.y) * 0.5), 3.0);
      col += vec3(0.75, 0.42, 0.1) * road * uGlow * flow;
      float fd = distance(p, uFrostC);
      float fr = uFrost * (1.0 - smoothstep(uFrostR - 5.0, uFrostR, fd));
      vec3 ice = vec3(0.2, 0.4, 0.56) * (0.6 + 0.6 * noise(p * 1.4)) + vec3(0.5, 0.7, 0.8) * pow(noise(p * 5.0), 7.0);
      col = mix(col, ice, fr * 0.82);
      col += vec3(0.4, 1.0, 1.6) * uFrost * exp(-pow((fd - uFrostR) * 0.35, 2.0)) * step(uFrostR, 160.0);
      // 맵 밖: 어두운 수풀, 멀수록 안개 속으로
      vec2 e = smoothstep(uHalf - 0.3, uHalf + 0.3, abs(p));
      float outside = max(e.x, e.y);
      vec3 wild = mix(uWild1, uWild2, n) * (0.8 + 0.3 * hash(floor(p * 4.0)));
      col = mix(col, wild, outside * (1.0 - water));
      col *= 1.0 - 0.24 * smoothstep(0.42, 0.72, noise(p * 0.03 + vec2(uTime * 0.03, uTime * 0.016)));   // 스쳐 가는 구름 그림자
      float far = smoothstep(5.0, 48.0, max(abs(p.x) - uHalf.x, abs(p.y) - uHalf.y));
      col = mix(col, uFog, far);
      for (int i = 0; i < MAXR; i++) {
        float mx = uP[i].w;
        if (mx <= 0.0) continue;
        float d = distance(p, uP[i].xy), k = 1.0 - uP[i].z / mx;
        col += uC[i] * exp(-pow((d - uP[i].z) * 0.9, 2.0)) * k * 1.3;
      }
      vec2 edge = exp(-abs(abs(p) - uHalf) * 1.5);
      col += vec3(0.2, 0.5, 0.6) * max(edge.x * step(abs(p.y), uHalf.y + 1.0), edge.y * step(abs(p.x), uHalf.x + 1.0)) * 0.06;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
})));
function applyTheme() {                                         // 현재 맵의 테마 색을 바닥 셰이더와 조명에 주입
  for (const k in THEME_U) floorU[k].value.fromArray(TH[THEME_U[k]]);
  floorU.uRiver.value.set(RIVER_X, TH.flow); floorU.uFlower.value = TH.flower;
  scene.background.setHex(TH.bg); hemi.color.setHex(TH.sky); hemi.groundColor.setHex(TH.gnd); hemi.intensity = TH.hemi; sun.color.setHex(TH.sun); sun.intensity = TH.sunK;
}
applyTheme();

// ---------- 모델 조립 도구: 정점 색이 있는 부품들을 하나의 지오메트리로 합침 ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function part(geo, shade, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(_m4.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const n = g.attributes.position.count, c = new Float32Array(n * 3), col = Array.isArray(shade) ? shade : [shade, shade, shade];
  for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv');
  return g;
}
const model = (...parts) => { const g = mergeGeometries(parts); g.computeVertexNormals(); return g; };
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl: (a, b, h, n = 6) => new THREE.CylinderGeometry(a, b, h, n),
  cone: (r, h, n = 5) => new THREE.ConeGeometry(r, h, n), ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  octa: (r) => new THREE.OctahedronGeometry(r), dode: (r) => new THREE.DodecahedronGeometry(r),
  torus: (r, t, n = 16) => new THREE.TorusGeometry(r, t, 5, n),
};
// 재질에 윤곽광을 얹어 모서리가 빛나 입체감이 크게 살아남
// 텍스처 없이 셰이더에서 실시간으로 세 가지 디테일 계산: 고르지 않은 표면 마모, 바닥에 가까울수록 어두워짐(물체가 진짜 놓인 듯), 태양 쪽 하이라이트
const litU = { uSunV: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color(1, 1, 1) }, uT: { value: 0 } };
// 바람에 흔들림: 풀 끝으로 갈수록 많이 흔들리고, 포기마다 위치로 리듬을 어긋나게 해 바람이 맵을 쓸고 지나가는 느낌
function sway(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = litU.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  float swx = instanceMatrix[3].x, swz = instanceMatrix[3].z;\n  float gust = 0.6 + 0.4 * sin(uT * 0.7 + swx * 0.11 + swz * 0.07);\n  transformed.x += sin(uT * 2.3 + swx * 0.7 + swz * 0.5) * 0.3 * gust * position.y;\n  transformed.z += cos(uT * 1.7 + swx * 0.4) * 0.16 * gust * position.y;\n#endif');
  };
  return m;
}
function rim(m, k = 0.9) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSunV = litU.uSunV; sh.uniforms.uSunC = litU.uSunC; sh.uniforms.uRimK = { value: k };
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vec4 wp4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n  wp4 = instanceMatrix * wp4;\n#endif\n  vWp = (modelMatrix * wp4).xyz;');
    sh.fragmentShader = `varying vec3 vWp; uniform vec3 uSunV, uSunC; uniform float uRimK;
      float dHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float dNoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      ` + sh.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 dN = normalize(normal), dV = normalize(vViewPosition);
      float dn = dNoise(vWp * 2.3) * 0.6 + dNoise(vWp * 9.0) * 0.4;
      outgoingLight *= 0.84 + 0.3 * dn;
      outgoingLight *= 0.62 + 0.38 * smoothstep(-0.1, 1.4, vWp.y);
      outgoingLight += pow(max(dot(dN, normalize(dV + uSunV)), 0.0), 36.0) * uSunC * 0.26 * (0.35 + 0.65 * dn);
      outgoingLight += pow(1.0 - clamp(dot(dN, dV), 0.0, 1.0), 2.6) * (diffuseColor.rgb * uRimK + 0.06);
      #include <opaque_fragment>`);
  };
  return m;
}
const vcMat = () => rim(new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true }));

// ---------- 인스턴싱과 이펙트 기본 요소 ----------
const dummy = new THREE.Object3D(), tmpCol = new THREE.Color(), tmpV = new THREE.Vector3();
function instanced(geo, mat, max, cast) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.setColorAt(0, tmpCol.setRGB(1, 1, 1));
  m.count = 0; m.frustumCulled = false; m.castShadow = !!cast;
  scene.add(m);
  return m;
}
const lambert = () => new THREE.MeshLambertMaterial({ flatShading: true });
const glowMat = (o = {}) => new THREE.MeshBasicMaterial({ toneMapped: false, ...o });
const addMat = (o = {}) => glowMat({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...o });
const BAR_TILT = -Math.atan2(CAM_H, CAM_D - CAM_Z);
const meshes = {
  grunt: instanced(model(part(G.cyl(0.55, 0.72, 1.0, 6), 1, 0, 0.9, 0), part(G.ico(0.42), 1.25, 0, 1.7, 0.05),
    part(G.cone(0.12, 0.5, 4), 2.0, 0.3, 2.05, 0, 0, 0, -0.5), part(G.cone(0.12, 0.5, 4), 2.0, -0.3, 2.05, 0, 0, 0, 0.5),
    part(G.box(0.13, 0.09, 0.06), 4, 0.16, 1.74, 0.42), part(G.box(0.13, 0.09, 0.06), 4, -0.16, 1.74, 0.42),
    part(G.box(0.28, 0.42, 0.36), 0.4, 0.25, 0.21, 0), part(G.box(0.28, 0.42, 0.36), 0.4, -0.25, 0.21, 0),
    part(G.box(0.22, 0.62, 0.26), 0.62, 0.74, 0.95, 0.08), part(G.box(0.22, 0.62, 0.26), 0.62, -0.74, 0.95, 0.08),
    part(G.box(0.1, 0.95, 0.75), 0.3, -0.92, 0.95, 0.3), part(G.cyl(0.06, 0.09, 1.1, 5), 0.3, 0.86, 1.2, 0.35, 0.5, 0, 0)), vcMat(), 200, true),
  runner: instanced(model(part(G.box(0.55, 0.55, 1.5), 1, 0, 0.8, 0), part(G.cone(0.36, 0.85, 4), 1.2, 0, 0.95, 1.1, Math.PI / 2, 0, 0),
    part(G.cone(0.1, 0.34, 3), 1.8, 0.18, 1.27, 0.8), part(G.cone(0.1, 0.34, 3), 1.8, -0.18, 1.27, 0.8),
    part(G.cone(0.13, 1.0, 4), 0.6, 0, 1.05, -1.15, -2.0, 0, 0), part(G.box(0.2, 0.16, 1.1), 0.5, 0, 1.12, -0.1),
    part(G.box(0.16, 0.56, 0.16), 0.45, 0.23, 0.28, 0.52), part(G.box(0.16, 0.56, 0.16), 0.45, -0.23, 0.28, 0.52),
    part(G.box(0.16, 0.56, 0.16), 0.45, 0.23, 0.28, -0.52), part(G.box(0.16, 0.56, 0.16), 0.45, -0.23, 0.28, -0.52),
    part(G.box(0.09, 0.07, 0.06), 4, 0.15, 1.04, 1.18), part(G.box(0.09, 0.07, 0.06), 4, -0.15, 1.04, 1.18)), vcMat(), 200, true),
  brute: instanced(model(part(G.dode(1.1), 1, 0, 1.6, 0), part(G.box(1.25, 0.95, 0.3), 0.42, 0, 1.4, 0.88), part(G.box(0.62, 0.52, 0.62), 0.8, 0, 2.78, 0.25),
    part(G.box(0.15, 0.1, 0.06), 4, 0.17, 2.84, 0.58), part(G.box(0.15, 0.1, 0.06), 4, -0.17, 2.84, 0.58),
    part(G.cone(0.32, 0.85, 5), 1.9, 1.15, 2.45, 0, 0, 0, -0.6), part(G.cone(0.32, 0.85, 5), 1.9, -1.15, 2.45, 0, 0, 0, 0.6),
    part(G.box(0.5, 1.3, 0.56), 0.7, 1.32, 1.4, 0.1), part(G.box(0.5, 1.3, 0.56), 0.7, -1.32, 1.4, 0.1),
    part(G.ico(0.44), 0.5, 1.32, 0.66, 0.2), part(G.ico(0.44), 0.5, -1.32, 0.66, 0.2),
    part(G.box(0.56, 0.72, 0.62), 0.4, 0.5, 0.36, 0), part(G.box(0.56, 0.72, 0.62), 0.4, -0.5, 0.36, 0)), vcMat(), 120, true),
  swarm: instanced(model(part(G.octa(0.5), 1, 0, 0.5, 0, 0, 0, 0, 1, 0.6, 1.5), part(G.ico(0.23), 0.6, 0, 0.54, 0.7),
    part(G.box(0.08, 0.07, 0.05), 4, 0.1, 0.6, 0.88), part(G.box(0.08, 0.07, 0.05), 4, -0.1, 0.6, 0.88),
    part(G.box(0.75, 0.04, 0.42), 2.3, 0.5, 0.8, -0.1, 0, 0, 0.45), part(G.box(0.75, 0.04, 0.42), 2.3, -0.5, 0.8, -0.1, 0, 0, -0.45),
    part(G.cone(0.08, 0.5, 3), 0.5, 0, 0.5, -0.85, -Math.PI / 2, 0, 0)), vcMat(), 320, true),
  healer: instanced(model(part(G.cone(0.85, 1.9, 7), 1, 0, 0.95, 0), part(G.cyl(0.9, 0.9, 0.12, 7), 0.5, 0, 0.08, 0), part(G.ico(0.36), 1.5, 0, 2.15, 0.05),
    part(G.cone(0.42, 0.6, 6), 0.7, 0, 2.5, -0.08, -0.3, 0, 0), part(G.torus(0.5, 0.06, 12), 3.4, 0, 2.95, 0, Math.PI / 2, 0, 0),
    part(G.cyl(0.05, 0.05, 2.7, 4), 0.4, 0.8, 1.35, 0.25), part(G.ico(0.24), 3.6, 0.8, 2.8, 0.25),
    part(G.box(0.2, 0.2, 0.75), 0.7, 0.5, 1.5, 0.3), part(G.box(0.1, 0.07, 0.05), 4, 0.13, 2.18, 0.37), part(G.box(0.1, 0.07, 0.05), 4, -0.13, 2.18, 0.37)), vcMat(), 60, true),
  boss: instanced(model(part(G.ico(1.9), 1, 0, 2.6, 0), part(G.torus(2.0, 0.3, 10), 0.4, 0, 2.1, 0, Math.PI / 2, 0, 0), part(G.box(1.5, 1.6, 0.4), 0.45, 0, 2.6, 1.7),
    part(G.box(1.15, 0.95, 1.15), 0.8, 0, 4.6, 0.5), part(G.box(0.28, 0.17, 0.08), 5, 0.32, 4.7, 1.1), part(G.box(0.28, 0.17, 0.08), 5, -0.32, 4.7, 1.1),
    part(G.cone(0.3, 1.6, 5), 2.1, 0.78, 5.6, 0.3, 0, 0, -0.5), part(G.cone(0.3, 1.6, 5), 2.1, -0.78, 5.6, 0.3, 0, 0, 0.5),
    part(G.ico(0.95), 0.6, 2.15, 3.7, 0), part(G.ico(0.95), 0.6, -2.15, 3.7, 0),
    part(G.cone(0.36, 1.3, 5), 2.0, 2.6, 4.6, 0, 0, 0, -0.7), part(G.cone(0.36, 1.3, 5), 2.0, -2.6, 4.6, 0, 0, 0, 0.7),
    part(G.box(0.72, 2.1, 0.85), 0.75, 2.4, 2.2, 0.2), part(G.box(0.72, 2.1, 0.85), 0.75, -2.4, 2.2, 0.2), part(G.ico(0.6), 0.5, 2.4, 1.0, 0.3), part(G.ico(0.6), 0.5, -2.4, 1.0, 0.3),
    part(G.box(0.95, 1.2, 1.05), 0.4, 0.95, 0.6, 0), part(G.box(0.95, 1.2, 1.05), 0.4, -0.95, 0.6, 0),
    part(G.cone(0.3, 1.1, 4), 1.9, 0, 4.4, -1.4, -0.9, 0, 0), part(G.cone(0.26, 0.9, 4), 1.9, 0, 3.4, -1.9, -1.1, 0, 0)), vcMat(), 8, true),
  shield: instanced(model(part(G.cyl(0.6, 0.78, 1.2, 6), 1, 0, 1.0, 0), part(G.ico(0.42), 1.2, 0, 1.95, 0), part(G.cone(0.5, 0.6, 6), 0.55, 0, 2.4, 0),
    part(G.box(0.5, 0.1, 0.06), 4, 0, 1.98, 0.4), part(G.box(1.7, 2.0, 0.16), 0.5, 0, 1.25, 0.82), part(G.box(1.3, 1.6, 0.06), 1.5, 0, 1.25, 0.93), part(G.octa(0.26), 3.6, 0, 1.3, 1.0),
    part(G.cyl(0.05, 0.05, 3.2, 4), 0.35, 0.85, 1.6, 0.1), part(G.cone(0.14, 0.5, 4), 2.4, 0.85, 3.4, 0.1),
    part(G.box(0.3, 0.46, 0.4), 0.4, 0.27, 0.23, 0), part(G.box(0.3, 0.46, 0.4), 0.4, -0.27, 0.23, 0)), vcMat(), 80, true),
  splitter: instanced(model(part(G.ico(0.95, 1), 1, 0, 0.78, 0, 0, 0, 0, 1.1, 0.8, 1.1), part(G.ico(0.5, 1), 1.3, 0.75, 0.55, -0.3), part(G.ico(0.42, 1), 1.3, -0.7, 0.5, -0.45), part(G.ico(0.36, 1), 1.5, 0.1, 1.45, -0.2),
    part(G.ico(0.16), 4, 0.3, 0.95, 0.88), part(G.ico(0.16), 4, -0.3, 0.95, 0.88), part(G.ico(0.12), 4, 0, 1.25, 0.8), part(G.ico(0.22), 0.45, 0.45, 0.4, 0.75), part(G.ico(0.2), 0.45, -0.5, 0.35, 0.7)), vcMat(), 60, true),
  mite: instanced(model(part(G.ico(0.45, 1), 1, 0, 0.4, 0, 0, 0, 0, 1.1, 0.8, 1.1), part(G.ico(0.1), 4, 0.15, 0.48, 0.4), part(G.ico(0.1), 4, -0.15, 0.48, 0.4), part(G.ico(0.2, 1), 1.4, 0.05, 0.75, -0.1)), vcMat(), 160, true),
  phantom: instanced(model(part(G.cone(0.72, 2.2, 6), 1, 0, 1.3, 0, Math.PI, 0, 0), part(G.cyl(0.74, 0.5, 0.5, 6), 0.7, 0, 2.55, 0), part(G.ico(0.4), 0.25, 0, 2.85, 0.1), part(G.cone(0.55, 0.7, 6), 0.8, 0, 3.15, -0.05, -0.25, 0, 0),
    part(G.box(0.12, 0.08, 0.06), 5, 0.14, 2.9, 0.45), part(G.box(0.12, 0.08, 0.06), 5, -0.14, 2.9, 0.45),
    part(G.box(0.18, 0.18, 1.0), 0.75, 0.75, 2.1, 0.4, 0.3, 0, 0), part(G.box(0.18, 0.18, 1.0), 0.75, -0.75, 2.1, 0.4, 0.3, 0, 0),
    part(G.cyl(0.04, 0.04, 2.6, 4), 0.3, 0.8, 2.3, 0.85), part(G.box(0.08, 0.5, 1.2), 2.6, 0.8, 3.5, 0.4, -0.5, 0, 0)), vcMat(), 80, true),
  flyer: instanced(model(part(G.octa(0.55), 1, 0, 0.4, 0, 0, 0, 0, 0.9, 0.7, 2.0), part(G.cone(0.3, 0.8, 4), 1.2, 0, 0.45, 1.3, Math.PI / 2, 0, 0),
    part(G.box(2.2, 0.06, 1.1), 0.7, 1.35, 0.6, -0.1, 0, 0.25, 0.35), part(G.box(2.2, 0.06, 1.1), 0.7, -1.35, 0.6, -0.1, 0, -0.25, -0.35),
    part(G.box(1.0, 0.05, 0.6), 1.6, 2.5, 1.0, -0.5, 0, 0.5, 0.2), part(G.box(1.0, 0.05, 0.6), 1.6, -2.5, 1.0, -0.5, 0, -0.5, -0.2),
    part(G.cone(0.14, 1.3, 4), 0.6, 0, 0.4, -1.5, -Math.PI / 2, 0, 0), part(G.box(0.1, 0.07, 0.05), 5, 0.14, 0.55, 1.45), part(G.box(0.1, 0.07, 0.05), 5, -0.14, 0.55, 1.45),
    part(G.cone(0.1, 0.4, 3), 2.0, 0.15, 0.8, 1.0), part(G.cone(0.1, 0.4, 3), 2.0, -0.15, 0.8, 1.0)), vcMat(), 120, true),
  berserker: instanced(model(part(G.dode(0.8), 1, 0, 1.45, 0), part(G.box(0.55, 0.5, 0.55), 0.85, 0, 2.4, 0.15), part(G.box(0.1, 0.5, 0.7), 2.4, 0, 2.85, 0.05),
    part(G.box(0.34, 0.08, 0.06), 5, 0, 2.45, 0.44), part(G.box(0.36, 1.1, 0.4), 0.7, 1.0, 1.9, 0.2, -0.5, 0, -0.5), part(G.box(0.36, 1.1, 0.4), 0.7, -1.0, 1.9, 0.2, -0.5, 0, 0.5),
    part(G.cyl(0.06, 0.06, 1.6, 4), 0.35, 1.45, 2.7, 0.6, 0.5, 0, 0), part(G.box(0.08, 0.7, 0.8), 2.2, 1.45, 3.2, 1.0, 0.5, 0, 0),
    part(G.cyl(0.06, 0.06, 1.6, 4), 0.35, -1.45, 2.7, 0.6, 0.5, 0, 0), part(G.box(0.08, 0.7, 0.8), 2.2, -1.45, 3.2, 1.0, 0.5, 0, 0),
    part(G.cone(0.2, 0.5, 4), 1.9, 0.6, 2.15, -0.1, 0, 0, -0.7), part(G.cone(0.2, 0.5, 4), 1.9, -0.6, 2.15, -0.1, 0, 0, 0.7),
    part(G.box(0.4, 0.8, 0.46), 0.4, 0.35, 0.4, 0), part(G.box(0.4, 0.8, 0.46), 0.4, -0.35, 0.4, 0), part(G.box(1.3, 0.3, 1.0), 0.45, 0, 0.9, 0)), vcMat(), 80, true),
  jugger: instanced(model(part(G.box(2.3, 1.9, 3.6), 1, 0, 2.0, -0.2), part(G.box(2.6, 0.5, 3.0), 0.5, 0, 3.1, -0.3), part(G.box(1.5, 1.3, 1.5), 0.85, 0, 1.9, 2.2), part(G.box(1.7, 0.4, 0.9), 0.5, 0, 2.7, 2.3),
    part(G.cone(0.2, 1.1, 5), 2.4, 0.6, 1.6, 3.1, 1.2, 0, 0), part(G.cone(0.2, 1.1, 5), 2.4, -0.6, 1.6, 3.1, 1.2, 0, 0), part(G.cone(0.3, 1.2, 5), 2.2, 0, 3.2, 2.5, 0.5, 0, 0),
    part(G.box(0.2, 0.14, 0.06), 5, 0.4, 2.2, 2.96), part(G.box(0.2, 0.14, 0.06), 5, -0.4, 2.2, 2.96),
    part(G.cone(0.4, 1.1, 4), 1.9, 0, 3.8, 0.8), part(G.cone(0.45, 1.3, 4), 1.9, 0, 3.9, -0.3), part(G.cone(0.4, 1.1, 4), 1.9, 0, 3.8, -1.4),
    part(G.box(0.8, 1.2, 0.9), 0.45, 0.9, 0.6, 1.1), part(G.box(0.8, 1.2, 0.9), 0.45, -0.9, 0.6, 1.1), part(G.box(0.8, 1.2, 0.9), 0.45, 0.9, 0.6, -1.5), part(G.box(0.8, 1.2, 0.9), 0.45, -0.9, 0.6, -1.5),
    part(G.cone(0.3, 1.6, 4), 0.6, 0, 2.2, -2.6, -1.9, 0, 0), part(G.ico(0.4), 2.0, 0, 1.6, -3.3)), vcMat(), 12, true),
  bubble: instanced(new THREE.SphereGeometry(1, 14, 10), addMat({ opacity: 0.38 }), 90),
  shot: instanced(new THREE.SphereGeometry(1, 8, 6), glowMat(), 400),
  meteor: instanced(new THREE.IcosahedronGeometry(1, 1), glowMat(), 24),
  blade: instanced(model(part(G.cone(0.5, 5.2, 4), 1, 0, 2.6, 0, Math.PI, 0, 0, 1, 1, 0.3), part(G.box(2.3, 0.3, 0.5), 0.7, 0, 5.3, 0), part(G.cyl(0.14, 0.14, 1.3, 5), 0.5, 0, 6.1, 0), part(G.octa(0.3), 1, 0, 6.9, 0)),
    glowMat({ vertexColors: true }), 16),
  upArrow: instanced(model(part(G.cone(0.5, 0.7, 4), 1, 0, 0.6, 0), part(G.box(0.24, 0.5, 0.24), 0.8, 0, 0, 0)), glowMat({ vertexColors: true }), 60),
  spike: instanced(new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0), glowMat({ transparent: true, opacity: 0.9 }), 500),
  bolt: instanced(new THREE.BoxGeometry(1, 1, 1), addMat(), 900),
  pillar: instanced(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0), addMat({ side: THREE.DoubleSide }), 90),
  barBg: instanced(new THREE.PlaneGeometry(1, 1), glowMat({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false }), 400),
  bar: instanced(new THREE.PlaneGeometry(1, 1), glowMat({ depthTest: false }), 400),
};
meshes.barBg.renderOrder = 10; meshes.bar.renderOrder = 11;
const markPool = Array.from({ length: 24 }, () => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), addMat({ opacity: 0.3 }));
  m.position.y = 0.06; m.visible = false; scene.add(m);
  return m;
});
const runeTex = (() => {              // 마법진 텍스처: 동심원, 눈금, 육각별
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  ring(244, 7); ring(222, 2.5); ring(168, 4); ring(92, 2.5); ring(60, 5);
  g.lineWidth = 3;
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r0 = i % 4 ? 228 : 222; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 240, Math.sin(a) * 240); g.stroke(); }
  for (let k = 0; k < 2; k++) { g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3 + k / 6) * Math.PI * 2 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 168, Math.sin(a) * 168); } g.stroke(); }
  for (let k = 0; k < 2; k++) { g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= 4; i++) { const a = (i / 4 + k / 8) * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 92, Math.sin(a) * 92); } g.stroke(); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineWidth = 3; g.beginPath(); g.arc(Math.cos(a) * 196, Math.sin(a) * 196, 15, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(Math.cos(a) * 196, Math.sin(a) * 196, 5, 0, Math.PI * 2); g.fill(); }
  return new THREE.CanvasTexture(c);
})();
const runePool = Array.from({ length: 8 }, () => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), addMat({ map: runeTex, side: THREE.DoubleSide }));
  m.visible = false; scene.add(m);
  return m;
});
const orbPool = Array.from({ length: 14 }, () => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), addMat());
  m.visible = false; scene.add(m);
  return m;
});
const PMAX = 6000;
const pPos = new Float32Array(PMAX * 3).fill(-999), pCol = new Float32Array(PMAX * 3), pVel = new Float32Array(PMAX * 3),
  pBase = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pMaxL = new Float32Array(PMAX), pGrav = new Float32Array(PMAX);
let pNext = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pTex = (() => {                 // 둥근 소프트 빛 점
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const pPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 1.1, map: pTex, vertexColors: true, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
pPoints.frustumCulled = false;
scene.add(pPoints);
function spark(x, y, z, vx, vy, vz, col, life, grav = 16) {
  const i = pNext; pNext = (pNext + 1) % PMAX;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pBase[i * 3] = col[0]; pBase[i * 3 + 1] = col[1]; pBase[i * 3 + 2] = col[2];
  pLife[i] = pMaxL[i] = life; pGrav[i] = grav;
}
function burst(x, y, z, n, col, spd, life = 0.5, up = 0.9, grav = 16) {
  for (let k = 0; k < n; k++) {
    const a = rand(Math.PI * 2), s = spd * rand(0.25, 1);
    spark(x, y, z, Math.cos(a) * s, rand(spd * up), Math.sin(a) * s, col, life * rand(0.5, 1.2), grav);
  }
}
let rings = [], bolts = [], spikes = [], orbs = [], marks = [], meteors = [], burns = [], timers = [], pillars = [], gibs = [], runes = [], blades = [];
function addRing(x, z, max, speed, col) {
  if (rings.length >= MAXR) rings.shift();
  rings.push({ x, z, r: 0.5, max, speed, col });
}
function bolt(x1, y1, z1, x2, y2, z2, w, col, life = 0) { bolts.push({ x1, y1, z1, x2, y2, z2, w, col, life, max: life, one: life <= 0 }); }
function jag(x1, y1, z1, x2, y2, z2, w, col, life = 0.12, amp = 0.09) {   // 꺾은선 번개
  const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1), n = clamp(Math.ceil(len / 3.5), 2, 12), a = Math.min(len * amp, 2.4);
  let px = x1, py = y1, pz = z1;
  for (let i = 1; i <= n; i++) {
    const k = i / n, e = i === n ? 0 : 1;
    const nx = x1 + (x2 - x1) * k + rand(-a, a) * e, ny = y1 + (y2 - y1) * k + rand(-a, a) * e, nz = z1 + (z2 - z1) * k + rand(-a, a) * e;
    bolt(px, py, pz, nx, ny, nz, w, col, life);
    px = nx; py = ny; pz = nz;
  }
}
const after = (t, fn) => timers.push({ t, fn });

// ---------- 데이터: 타워, 적, 웨이브(모두 오리지널) ----------
const TOWERS = {
  arrow: { name: '석궁탑', key: '1', cost: 60, range: 13, dmg: 20, cd: 0.42, col: 0x7be08a, tip: '단일 대상 속사', my: 3.42 },
  cannon: { name: '대포탑', key: '2', cost: 110, range: 12, dmg: 48, cd: 1.5, aoe: 3.6, ground: true, col: 0xffa24a, tip: '범위 폭발, 지상 전용', my: 2.75 },
  frost: { name: '서리탑', key: '3', cost: 90, range: 9.5, dmg: 9, cd: 1.0, slow: 0.4, col: 0x7fd8ff, tip: '펄스 광역 감속', my: 3.3 },
  tesla: { name: '전기탑', key: '4', cost: 150, range: 11, dmg: 32, cd: 0.85, chain: 3, col: 0xc79bff, tip: '연쇄 번개', my: 4.2 },
  prism: { name: '프리즘탑', key: '5', cost: 220, range: 15, dmg: 50, col: 0xff7ac8, tip: '지속 조사, 갈수록 강력', my: 4.9 },
  flame: { name: '화염탑', key: '6', cost: 130, range: 7.5, dmg: 38, col: 0xff6a3a, tip: '근거리 화염, 지속 화상', my: 2.6 },
  mortar: { name: '박격포', key: '7', cost: 190, range: 24, minRange: 7, dmg: 95, cd: 2.6, aoe: 5.5, ground: true, col: 0xc9b27a, tip: '초장거리 광역, 지상 전용', my: 2.6 },
  sniper: { name: '저격탑', key: '8', cost: 170, range: 22, dmg: 150, cd: 2.2, col: 0xf2ecc0, tip: '초장거리 단일, 탱커 특화', my: 5.2 },
  beacon: { name: '증폭탑', key: '9', cost: 160, range: 6.5, dmg: 0, col: 0xffd24a, tip: '주변 타워 피해량 증가', my: 4.7 },
};
const TOWER_IDS = Object.keys(TOWERS);
const LV_DMG = [1, 1.7, 2.8], LV_RANGE = [1, 1.08, 1.16];
const upCost = (t) => Math.round(t.def.cost * (t.lv === 1 ? 0.9 : 1.6));
const FOES = {
  grunt: { name: '잡졸', hp: 58, speed: 5.5, gold: 6, r: 0.9, h: 2.2, col: [0.85, 0.34, 0.3], leak: 1 },
  runner: { name: '질주자', hp: 36, speed: 10, gold: 6, r: 0.7, h: 1.5, col: [0.95, 0.78, 0.28], leak: 1 },
  brute: { name: '중갑병', hp: 250, speed: 3.8, gold: 16, r: 1.35, h: 3.1, col: [0.5, 0.38, 0.68], armor: 7, leak: 2 },
  swarm: { name: '무리벌레', hp: 20, speed: 7, gold: 3, r: 0.6, h: 1.1, col: [0.55, 0.85, 0.35], leak: 1 },
  healer: { name: '사제', hp: 120, speed: 5, gold: 14, r: 0.9, h: 3.0, col: [0.35, 0.95, 0.7], heal: 1, leak: 1 },
  shield: { name: '방패병', hp: 150, speed: 4.6, gold: 14, r: 1.0, h: 2.7, col: [0.4, 0.6, 0.95], shield: 130, leak: 1 },        // 에너지 실드가 피해를 먼저 흡수하고, 실드 중에는 감속과 화상 면역
  splitter: { name: '분열체', hp: 140, speed: 4.8, gold: 10, r: 1.05, h: 1.8, col: [0.45, 0.62, 0.16], split: 3, leak: 2 },   // 죽으면 작은 것 셋으로 분열
  mite: { name: '작은 분열체', hp: 30, speed: 7.5, gold: 2, r: 0.5, h: 0.9, col: [0.5, 0.66, 0.2], leak: 1 },
  phantom: { name: '유령', hp: 95, speed: 6.5, gold: 12, r: 0.8, h: 3.0, col: [0.6, 0.45, 0.95], phase: 1, leak: 1 },           // 주기적으로 공허에 숨어 그동안 타워 공격을 받지 않음
  flyer: { name: '날짐승', hp: 90, speed: 7, gold: 10, r: 0.9, h: 1.3, col: [0.95, 0.5, 0.25], fly: 1, leak: 1 },                // 크리스탈로 직선 비행, 지상 전용 타워로는 못 맞춤
  berserker: { name: '광전사', hp: 190, speed: 4.2, gold: 14, r: 1.0, h: 2.7, col: [0.8, 0.3, 0.2], armor: 3, rage: 1, leak: 2 }, // 체력이 적을수록 빨라짐
  jugger: { name: '지진수', hp: 900, speed: 3.0, gold: 60, r: 2.0, h: 3.8, col: [0.6, 0.5, 0.35], armor: 6, stomp: 1, tough: 1, big: 4.6, leak: 4 },   // 발 구르기로 주변 타워를 마비시킴
  boss: { name: '보스', hp: 1750, speed: 3, gold: 120, r: 2.4, h: 6.2, col: [1.0, 0.22, 0.5], boss: 1, armor: 5, tough: 1, big: 6, leak: 8 },
};
// [종류, 수, 간격, 지연]
const WAVES = [
  [['grunt', 8, 1.0]],
  [['grunt', 12, 0.8]],
  [['grunt', 8, 0.8], ['runner', 6, 0.6, 4]],
  [['swarm', 26, 0.3]],
  [['brute', 4, 1.6], ['grunt', 10, 0.8, 2]],
  [['runner', 10, 0.5], ['flyer', 6, 1.2, 3]],
  [['grunt', 14, 0.7], ['healer', 2, 4, 3], ['shield', 4, 1.6, 5]],
  [['swarm', 40, 0.25], ['splitter', 4, 2.0, 4]],
  [['brute', 8, 1.3], ['healer', 3, 3, 2], ['phantom', 6, 1.2, 4]],
  [['grunt', 16, 0.7], ['boss', 1, 1, 6]],
  [['runner', 24, 0.4], ['flyer', 10, 0.9, 3], ['berserker', 5, 1.6, 6]],
  [['shield', 8, 1.2], ['healer', 4, 3, 2], ['grunt', 16, 0.6, 4]],
  [['swarm', 70, 0.2], ['splitter', 6, 1.8, 3]],
  [['jugger', 1, 1, 2], ['brute', 8, 1.2, 3], ['runner', 14, 0.5, 8], ['phantom', 8, 1.0, 5]],
  [['brute', 8, 1.3], ['healer', 4, 3, 2], ['berserker', 6, 1.4, 4], ['boss', 1, 1, 6]],
  [['runner', 36, 0.3], ['flyer', 16, 0.7, 2]],
  [['brute', 14, 0.9], ['shield', 10, 1.1, 2], ['healer', 6, 2.5, 2]],
  [['swarm', 90, 0.18], ['splitter', 8, 1.5, 2], ['grunt', 24, 0.5, 2]],
  [['jugger', 2, 6, 3], ['berserker', 10, 1.1, 2], ['runner', 24, 0.4, 2], ['healer', 6, 2.5, 3], ['phantom', 10, 0.9, 5]],
  [['brute', 12, 1.2], ['swarm', 60, 0.25, 2], ['flyer', 16, 0.7, 4], ['jugger', 1, 1, 8], ['boss', 2, 8, 6]],
];
const mapWaves = () => WAVES.map((w, q) => w.concat(MAP.extra[q + 1] || []));
let waves = mapWaves();
const MOB_N = 2, MOB_HP = 0.66;                                   // 잡몹 수 배율과 체력 배율(보스, 지진수는 그대로)
const hpMul = (w) => 1 + 0.3 * (w - 1) + 0.021 * (w - 1) * (w - 1);
const ULTS = [
  { key: 'Q', name: '운석 낙하', cd: 24, col: '#ff7a3a', tip: '마우스 위치로 낙하' },
  { key: 'W', name: '벼락 난무', cd: 30, col: '#a78bff', tip: '전장에 낙뢰 연발' },
  { key: 'E', name: '혹한의 영역', cd: 32, col: '#4ac8ff', tip: '전장을 얼렸다가 산산조각' },
  { key: 'R', name: '천공의 심판', cd: 55, col: '#ffcf4a', tip: '빛기둥이 길 전체를 휩씀' },
  { key: 'T', name: '공허의 특이점', cd: 40, col: '#c05cff', tip: '한곳에 모았다가 폭발' },
  { key: 'G', name: '유성 검진', cd: 36, col: '#5fe0ff', tip: '검진이 마우스 위치에 강림' },
];

// ---------- 상태 ----------
let state = 'title';                 // title | play | paused | over
let foes = [], towers = [], shots = [], queue = [];
let gold = 0, lives = 0, kills = 0, waveN = 0, phase = 'prep', nextT = 0, waveT = 0, time = 0, won = false;
let ultCd = ULTS.map(() => 0), speed = 1, slowT = 0, slowK = 1;
let shake = 0, hurtFx = 0, flash = 0, tintK = 0, tintTo = 0, ab = 0, dark = 0, darkTo = 0, glow = 0, roadGlow = 0, roadGlowTo = 0;
let zoom = 0, zoomTo = 0, zoomRate = 4, focusX = 0, focusZ = 0, shock = null, invUntil = 0;
let dbgCam = null;
let lowWarned = false, gotStars = 0;
let frost = null, judge = null, hole = null, storm = null, bannerT = 0, auto = null, autoT = 0, autoFlip = false;
const flashC = new THREE.Vector3(1, 1, 1), tintC = new THREE.Vector3(1, 1, 1);
const cellT = new Array(COLS * ROWS).fill(null);
const world = new THREE.Group();
scene.add(world);

// ---------- 장면의 고정 요소: 크리스탈, 입구, 인디케이터, 심판 빛기둥 ----------
const crystal = new THREE.Group();
{
  const stone = new THREE.MeshLambertMaterial({ color: 0x7a858c, flatShading: true }), stoneD = new THREE.MeshLambertMaterial({ color: 0x4d565c, flatShading: true });
  const blue = glowMat({ color: new THREE.Color(0.5, 1.5, 2.6) }), soft = glowMat({ color: new THREE.Color(0.4, 1.2, 2.0) });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !!mat.isMeshLambertMaterial; crystal.add(m); return m; };
  add(G.cyl(5.2, 5.6, 0.5, 8), stoneD, 0, 0.25, 0); add(G.cyl(4.2, 4.6, 0.5, 8), stone, 0, 0.75, 0); add(G.cyl(2.2, 2.8, 0.9, 8), stoneD, 0, 1.45, 0);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 4, z = Math.sin(a) * 4;
    add(G.cyl(0.36, 0.48, 3.4, 6), stone, x, 2.7, z); add(G.box(1.0, 0.3, 1.0), stoneD, x, 4.5, z); add(G.octa(0.36), blue, x, 5.2, z);
  }
  const gem = add(G.octa(2.3), blue, 0, 6, 0); gem.scale.y = 1.7;
  const halo = add(G.torus(3.3, 0.14, 40), soft, 0, 3.2, 0); halo.rotation.x = Math.PI / 2;
  const halo2 = add(G.torus(2.5, 0.08, 32), soft, 0, 6, 0);
  const shards = [0, 1, 2, 3, 4].map(() => add(G.octa(0.42), blue, 0, 0, 0));
  crystal.userData = { gem, halo, halo2, shards };
  crystal.position.set(CRYSTAL.x, 0, CRYSTAL.z);
  scene.add(crystal);
}
// ---------- 장면 오브젝트: 나무, 바위, 수정, 성벽, 돌등, 입구 아치, 나무다리. 맵 변경 시 그룹 전체 재생성 ----------
const scenery = { lamps: [], portals: [] };
const mapGroup = new THREE.Group();
scene.add(mapGroup);
const pineOf = (c1, c2, c3) => model(part(G.cyl(0.22, 0.32, 1.4, 5), [0.36, 0.24, 0.14], 0, 0.7, 0), part(G.cone(1.5, 2.2, 7), c1, 0, 2.2, 0), part(G.cone(1.15, 1.9, 7), c2, 0, 3.4, 0), part(G.cone(0.75, 1.6, 7), c3, 0, 4.5, 0));
const SG = {
  pine: pineOf([0.5, 1, 0.55], [0.6, 1.1, 0.6], [0.72, 1.2, 0.68]), pineN: pineOf(0.8, 1.0, 1.3),      // pineN 은 녹색 편향 없이 색은 전부 테마에서
  rock: model(part(G.dode(1), 1, 0, 0.5, 0), part(G.dode(0.6), 0.8, 0.9, 0.3, 0.3), part(G.dode(0.45), 0.7, -0.7, 0.2, -0.5)),
  shard: model(part(G.cone(0.45, 2.6, 5), 1, 0, 1.3, 0), part(G.cone(0.3, 1.7, 5), 0.8, 0.5, 0.8, 0.1, 0, 0, -0.45), part(G.cone(0.26, 1.4, 5), 0.7, -0.45, 0.7, -0.2, 0.3, 0, 0.5)),
  lamp: model(part(G.cyl(0.14, 0.2, 1.7, 5), 0.5, 0, 0.85, 0), part(G.box(0.55, 0.12, 0.55), 0.38, 0, 1.75, 0), part(G.cone(0.42, 0.4, 4), 0.38, 0, 2.5, 0, 0, Math.PI / 4, 0)),
  wall: part(G.box(1, 1, 1), 1, 0, 0.5, 0),
  post: model(part(G.cyl(0.8, 1.0, 3.4, 6), 1, 0, 1.7, 0), part(G.box(2.1, 0.4, 2.1), 0.75, 0, 3.5, 0), part(G.cone(1.2, 1.5, 4), 0.6, 0, 4.4, 0, 0, Math.PI / 4, 0)),
  tuft: model(part(G.cone(0.1, 0.7, 3), 1, 0, 0.35, 0), part(G.cone(0.09, 0.55, 3), 0.85, 0.16, 0.27, 0.05, 0, 0, -0.35), part(G.cone(0.09, 0.5, 3), 0.8, -0.14, 0.25, -0.08, 0.2, 0, 0.4)),
  fl: G.octa(0.24), gem: G.octa(0.4), swirl: new THREE.PlaneGeometry(5.8, 5.8), veil: new THREE.CircleGeometry(2.7, 24),
};
const SG_SET = new Set(Object.values(SG));
const SM = {
  vc: vcMat(), shard: new THREE.MeshBasicMaterial({ toneMapped: false, vertexColors: true }), lamp: new THREE.MeshLambertMaterial({ color: 0x8a949a, flatShading: true, vertexColors: true }),
  flame: glowMat({ color: new THREE.Color(2.6, 1.5, 0.45) }), tuft: sway(new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true })),
  wood: rim(new THREE.MeshLambertMaterial({ color: 0x8a6238, flatShading: true })), woodD: rim(new THREE.MeshLambertMaterial({ color: 0x5c4026, flatShading: true })),
  stone: new THREE.MeshLambertMaterial({ color: 0x7a858c, flatShading: true }), stoneD: new THREE.MeshLambertMaterial({ color: 0x4d565c, flatShading: true }),
  red: glowMat({ color: new THREE.Color(2.4, 0.4, 0.25) }), swirl: addMat({ map: runeTex, color: new THREE.Color(2.6, 0.45, 0.3), side: THREE.DoubleSide }),
  veil: addMat({ color: new THREE.Color(0.9, 0.12, 0.1), opacity: 0.5, side: THREE.DoubleSide }),
};
function buildScenery() {
  mapGroup.traverse((m) => { if (m.isInstancedMesh) m.dispose(); else if (m.geometry && !SG_SET.has(m.geometry)) m.geometry.dispose(); });
  mapGroup.clear(); scenery.lamps.length = 0; scenery.portals.length = 0;
  const o = new THREE.Object3D(), col = new THREE.Color(), t = TH;
  const inst = (geo, mat, list, cast = true) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      o.position.set(it.x, it.y || 0, it.z); o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); o.scale.set(it.sx || 1, it.sy || it.sx || 1, it.sz || it.sx || 1); o.updateMatrix();
      m.setMatrixAt(i, o.matrix); if (it.rgb) col.setRGB(it.rgb[0], it.rgb[1], it.rgb[2]); else col.setHSL(it.h, it.s, it.l); m.setColorAt(i, col);
    });
    m.castShadow = cast; mapGroup.add(m);
  };
  const one = (geo, mat, x, y, z, p = mapGroup) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !!mat.isMeshLambertMaterial; p.add(m); return m; };
  const ringPos = (min, max) => {                               // 맵 바깥 한 바퀴의 무작위 지점, 카메라 쪽은 적게; 입구, 강, 크리스탈 주변은 비움
    for (let n = 0; n < 500; n++) {
      const x = rand(-HX - max, HX + max), z = rand(-HZ - max, HZ + max * 0.7), d = Math.max(Math.abs(x) - HX, Math.abs(z) - HZ);
      if (d < min || d > max) continue;
      if (paths.some((P) => Math.hypot(x - P.ex, z - P.ez) < 10) || Math.abs(x - RIVER_X) < 5 || Math.hypot(x - CRYSTAL.x, z - CRYSTAL.z) < 14) continue;
      return [x, z, d];
    }
    return [-HX - max, -HZ - max, max];
  };
  const treeC = (up = 0) => ({ h: rand(t.tree[0], t.tree[1]), s: t.tree[2] * rand(0.8, 1.2), l: rand(t.tree[3], t.tree[4]) + up });
  const rockC = () => ({ h: t.rock[0] + rand(-0.04, 0.04), s: t.rock[1], l: rand(t.rock[2], t.rock[3]) });
  const trees = [], rocks = [], shards = [];
  for (let i = 0; i < t.pines; i++) { const [x, z, d] = ringPos(4.5, 32), sc = rand(1.1, 2.3) * (1 + d * 0.012); trees.push({ x, z, ry: rand(6.3), sx: sc, sy: sc * rand(0.9, 1.3), sz: sc, ...treeC() }); }
  for (let i = 0; i < t.rocks; i++) { const [x, z] = ringPos(1.5, 34), sc = rand(0.8, 3.2); rocks.push({ x, z, rx: rand(-0.2, 0.2), ry: rand(6.3), rz: rand(-0.2, 0.2), sx: sc, sy: sc * rand(0.6, 1.3), sz: sc, ...rockC() }); }
  for (let i = 0; i < t.shards; i++) { const [x, z] = ringPos(3, 26); shards.push({ x, z, ry: rand(6.3), sx: rand(0.7, 1.6), rgb: t.shardC[Math.random() < 0.7 ? 0 : 1] }); }
  MAP.decor.forEach(([c, r], i) => {                             // 칸을 차지하는 맵 안 나무와 돌
    if (blocked[r * COLS + c] !== 3) return;
    const x = cx(c), z = cz(r);
    if (i % 3 === 1) { rocks.push({ x, z, ry: rand(6.3), sx: rand(1.4, 1.9), sy: rand(1.1, 1.6), ...rockC() }); trees.push({ x: x + 1.1, z: z - 1.0, ry: rand(6.3), sx: 0.75, ...treeC(0.02) }); }
    else { trees.push({ x: x - 0.6, z: z + 0.4, ry: rand(6.3), sx: rand(1.0, 1.3), ...treeC(0.03) }); trees.push({ x: x + 1.0, z: z - 0.9, ry: rand(6.3), sx: rand(0.6, 0.85), ...treeC(0.04) }); rocks.push({ x: x + 0.9, z: z + 1.1, ry: rand(6.3), sx: 0.55, ...rockC() }); }
    if (MAP.theme >= 2 && i % 2 === 0) shards.push({ x: x - 1.0, z: z - 0.8, ry: rand(6.3), sx: rand(0.5, 0.8), rgb: t.shardC[i % 4 ? 0 : 1] });
  });
  inst(SG[t.pine], SM.vc, trees); inst(SG.rock, SM.vc, rocks); inst(SG.shard, SM.shard, shards, false);
  // 길목의 돌등
  const seen = new Set();
  for (const P of paths) for (let i = 1; i < P.pts.length - 1; i++) {
    const a = P.seg[i - 1], b = P.seg[i], x = P.pts[i].x + (a.dx - b.dx) * CS / 2, z = P.pts[i].z + (a.dz - b.dz) * CS / 2, key = Math.round(x) + ',' + Math.round(z);
    if (seen.has(key) || Math.abs(x) > HX || Math.abs(z) > HZ) continue;
    seen.add(key); one(SG.lamp, SM.lamp, x, 0, z); scenery.lamps.push(one(SG.fl, SM.flame, x, 2.08, z));
  }
  // 성벽: 맵 가장자리를 두르는 낮은 돌담, 입구와 강, 크리스탈 앞은 뚫고 네 모서리에 망루 기둥
  const wall = [], W = 1.4, wc = () => ({ h: 0.57, s: 0.08, l: rand(0.26, 0.36) });
  const open = (x, z) => paths.some((P) => Math.hypot(x - P.ex, z - P.ez) < 4.6) || Math.hypot(x - CRYSTAL.x, z - CRYSTAL.z) < 9.5;
  for (let x = -HX; x <= HX; x += 2.4) for (const sd of [-1, 1]) if (Math.abs(x - RIVER_X) >= 3.4 && !open(x, sd * (HZ + W))) wall.push({ x, z: sd * (HZ + W), sx: 2.3, sy: rand(0.9, 1.5), sz: 0.9, ...wc() });
  for (let z = -HZ; z <= HZ; z += 2.4) for (const sd of [-1, 1]) if (!open(sd * (HX + W), z)) wall.push({ x: sd * (HX + W), z, sx: 0.9, sy: rand(0.9, 1.5), sz: 2.3, ...wc() });
  inst(SG.wall, SM.vc, wall);
  const posts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) posts.push({ x: sx * (HX + W), z: sz * (HZ + W), sx: 1, h: 0.57, s: 0.08, l: 0.32 });
  inst(SG.post, SM.vc, posts);
  for (const it of posts) scenery.lamps.push(one(SG.gem, SM.flame, it.x, 5.7, it.z));
  // 입구: 길마다 돌 아치 하나, 안에는 돌아가는 붉은 마법진
  for (const P of paths) {
    const gate = new THREE.Group();
    for (const sd of [-1, 1]) { one(G.box(1.1, 6.4, 1.3), SM.stoneD, 0, 3.2, sd * 3.5, gate); one(G.box(1.4, 0.5, 1.6), SM.stone, 0, 0.25, sd * 3.5, gate); one(SG.gem, SM.red, 0, 7.2, sd * 3.5, gate); }
    one(G.box(1.3, 0.9, 8.6), SM.stone, 0, 6.6, 0, gate); one(G.cone(0.7, 1.2, 4), SM.stoneD, 0, 7.6, 0, gate);
    const swirl = one(SG.swirl, SM.swirl, 0.1, 3.3, 0, gate); swirl.rotation.y = Math.PI / 2;
    one(SG.veil, SM.veil, 0, 3.3, 0, gate).rotation.y = Math.PI / 2;
    gate.position.set(P.ex, 0, P.ez); gate.rotation.y = P.edge === 'L' ? -0.55 : P.edge === 'R' ? 0.55 : Math.PI / 2;   // 비스듬히 배치해 카메라에 정면이 보이게
    mapGroup.add(gate); scenery.portals.push(swirl);
  }
  // 나무다리
  for (const bz of BRIDGES) {
    const bridge = new THREE.Group();
    for (let i = 0; i < 9; i++) one(G.box(0.54, 0.16, 4.5), i % 2 ? SM.wood : SM.woodD, -2.4 + i * 0.6, 0.06 + (i % 2) * 0.02, 0, bridge);
    for (const sd of [-1, 1]) { one(G.box(5.6, 0.14, 0.16), SM.woodD, 0, 1.0, sd * 2.2, bridge); one(G.box(5.6, 0.1, 0.12), SM.wood, 0, 0.55, sd * 2.2, bridge); for (const px of [-2.7, -0.9, 0.9, 2.7]) one(G.box(0.2, 1.15, 0.2), SM.woodD, px, 0.55, sd * 2.2, bridge); }
    bridge.position.set(RIVER_X + Math.sin(bz * 0.16) * 1.1, 0, bz);
    mapGroup.add(bridge);
  }
  // 풀숲: 건설 가능한 땅에만 자람
  const tufts = [];
  for (let n = 0; tufts.length < t.tufts * (t.flower ? 5 : 2) && n < 30000; n++) {                  // 풀 밀도를 다섯 배로, 색도 밝게, 아니면 멀리서 검은 점밭처럼 보임
    const x = rand(-HX + 0.5, HX - 0.5), z = rand(-HZ + 0.5, HZ - 0.5), b = blocked[Math.floor((z + HZ) / CS) * COLS + Math.floor((x + HX) / CS)];
    if (b === 1 || b === 2) continue;
    tufts.push({ x, z, ry: rand(6.3), sx: rand(0.7, 1.5), h: rand(t.tuft[0], t.tuft[1]), s: t.tuft[2] * rand(0.8, 1.2), l: rand(t.tuft[3], t.tuft[4]) * 1.3 + 0.03 });
  }
  inst(SG.tuft, SM.tuft, tufts, false);
}
buildScenery();
function loadMap(i) {                                            // 맵 변경: 칸 재계산, 테마 색 교체, 장면 재생성
  setupGrid(i); applyTheme(); buildScenery(); crystal.position.set(CRYSTAL.x, 0, CRYSTAL.z); waves = mapWaves();
}
// 공허의 특이점 본체: 검은 구, 가장자리 빛무리, 두 강하 고리
const holeFx = new THREE.Group();
{
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.22, 28, 20), addMat({ color: new THREE.Color(0.8, 0.35, 1.8), opacity: 0.4, side: THREE.BackSide }));
  const d1 = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.26, 8, 56), glowMat({ color: new THREE.Color(2.0, 1.0, 3.0) }));
  const d2 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.1, 6, 56), glowMat({ color: new THREE.Color(1.0, 0.5, 2.4) }));
  d1.scale.z = 0.25; d2.scale.z = 0.25;
  holeFx.add(core, shell, d1, d2); holeFx.userData = { d1, d2 }; holeFx.visible = false; scene.add(holeFx);
}
const hoverMesh = new THREE.Mesh(new THREE.PlaneGeometry(CS - 0.3, CS - 0.3).rotateX(-Math.PI / 2), addMat({ opacity: 0.35 }));
hoverMesh.position.y = 0.07; hoverMesh.visible = false; scene.add(hoverMesh);
const rangeMesh = new THREE.Group();
rangeMesh.add(new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 72).rotateX(-Math.PI / 2), addMat({ opacity: 0.9, color: 0x9fe8ff })));
rangeMesh.add(new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2), addMat({ opacity: 0.07, color: 0x9fe8ff })));
rangeMesh.position.y = 0.08; rangeMesh.visible = false; scene.add(rangeMesh);
function makeBeam() {
  const beam = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 120, 28, 1, true), addMat({ color: new THREE.Color(1.3, 0.8, 0.25), opacity: 0.2, side: THREE.DoubleSide }));
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 120, 20, 1, true), addMat({ color: new THREE.Color(2.0, 1.3, 0.45), opacity: 0.3, side: THREE.DoubleSide }));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 120, 12), glowMat({ color: new THREE.Color(2.6, 2.2, 1.5) }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(8, 40).rotateX(-Math.PI / 2), addMat({ color: new THREE.Color(2.0, 1.2, 0.3), opacity: 0.35 }));
  for (const m of [outer, mid, core]) { m.position.y = 60; beam.add(m); }
  disc.position.y = 0.1; beam.add(disc);
  beam.userData = { outer, mid, core };
  beam.visible = false; scene.add(beam);
  return beam;
}
const beams = [makeBeam(), makeBeam()];

const tLamb = (o) => rim(new THREE.MeshLambertMaterial({ flatShading: true, ...o }), 0.6);
const TM_OLD = {
  stone: new THREE.MeshLambertMaterial({ color: 0x8a959c, flatShading: true }), stoneD: new THREE.MeshLambertMaterial({ color: 0x545e65, flatShading: true }),
  wood: new THREE.MeshLambertMaterial({ color: 0x8a6238, flatShading: true }), dark: new THREE.MeshLambertMaterial({ color: 0x2a2f36, flatShading: true }),
  gold: new THREE.MeshLambertMaterial({ color: 0xe0b548, emissive: 0x6a4a10, flatShading: true }),
};
const TM = { stone: tLamb({ color: 0x8a959c }), stoneD: tLamb({ color: 0x545e65 }), wood: tLamb({ color: 0x8a6238 }), dark: tLamb({ color: 0x2a2f36 }), gold: tLamb({ color: 0xe0b548, emissive: 0x6a4a10 }) };
const AURA = { rune: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), col: new THREE.CylinderGeometry(1.2, 2.0, 9, 18, 1, true).translate(0, 4.5, 0),
  ring: new THREE.TorusGeometry(2.25, 0.05, 5, 40).rotateX(Math.PI / 2), gem: new THREE.OctahedronGeometry(0.24) };
function litArr(hex) { const k = new THREE.Color(hex), s = 2.4 * Math.min(1, 0.42 / (k.r * 0.3 + k.g * 0.6 + k.b * 0.1)); return [k.r * s, k.g * s, k.b * s]; }
const add0 = (p, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; };
function towerMesh(type) {
  const d = TOWERS[type], g = new THREE.Group(), head = new THREE.Group(), lv2 = new THREE.Group(), lv3 = new THREE.Group(), h2 = new THREE.Group(), h3 = new THREE.Group();
  const acc = tLamb({ color: d.col, emissive: d.col, emissiveIntensity: 0.4 });
  add0(g, new THREE.CircleGeometry(2.5, 28).rotateX(-Math.PI / 2), addMat({ color: new THREE.Color(d.col), opacity: 0.11 }), 0, 0.06, 0);   // 타워 발밑의 빛고리 한 겹
  const lc = new THREE.Color(d.col), lum = lc.r * 0.3 + lc.g * 0.6 + lc.b * 0.1;
  const lit = glowMat({ color: lc.multiplyScalar(2.4 * Math.min(1, 0.42 / lum)) });      // 밝은 색 타워는 밝기를 눌러 하얗게 날아가지 않게
  const add = add0, H = Math.PI / 2;
  // 받침: 2 층 팔각 석대, 네 모서리에 눌러놓은 돌
  add(g, G.cyl(1.78, 1.92, 0.34, 8), TM.stoneD, 0, 0.17, 0); add(g, G.cyl(1.5, 1.66, 0.34, 8), TM.stone, 0, 0.5, 0);
  for (let i = 0; i < 4; i++) { const a = i * H + H / 2; add(g, G.box(0.34, 0.5, 0.34), TM.stoneD, Math.cos(a) * 1.6, 0.42, Math.sin(a) * 1.6, 0, -a, 0); }
  head.position.y = d.my; head.add(h2, h3); g.add(head, lv2, lv3);
  if (type === 'arrow') {                                        // 사각 망루 + 성벽 톱니 + 회전 석궁
    add(g, G.cyl(0.9, 1.15, 2.0, 4), TM.stone, 0, 1.67, 0, 0, H / 2, 0); add(g, G.box(1.9, 0.28, 1.9), TM.stoneD, 0, 2.8, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, G.box(0.42, 0.42, 0.42), TM.stone, sx * 0.74, 3.15, sz * 0.74);
    add(head, G.box(0.34, 0.26, 2.3), TM.wood, 0, 0, 0.25); add(head, G.box(0.5, 0.4, 0.5), TM.dark, 0, -0.1, -0.2);
    add(head, G.box(1.25, 0.12, 0.16), TM.dark, 0.56, 0.06, 0.95, 0, -0.42, 0); add(head, G.box(1.25, 0.12, 0.16), TM.dark, -0.56, 0.06, 0.95, 0, 0.42, 0);
    add(head, G.cyl(0.05, 0.05, 1.9, 4), lit, 0, 0.2, 0.5, H, 0, 0); add(head, G.cone(0.13, 0.4, 4), lit, 0, 0.2, 1.6, H, 0, 0);
    add(lv2, G.cyl(0.04, 0.04, 1.7, 4), TM.dark, -0.74, 4.1, -0.74); add(lv2, G.box(0.7, 0.42, 0.05), acc, -0.38, 4.7, -0.74);
    add(lv3, G.torus(1.28, 0.09), TM.gold, 0, 2.98, 0, H, 0, 0); add(lv3, G.cyl(0.04, 0.04, 1.7, 4), TM.dark, 0.74, 4.1, -0.74); add(lv3, G.box(0.7, 0.42, 0.05), TM.gold, 1.1, 4.7, -0.74);
    add(h3, G.cyl(0.04, 0.04, 1.7, 4), lit, 0.22, 0.2, 0.45, H, 0, 0); add(h3, G.cyl(0.04, 0.04, 1.7, 4), lit, -0.22, 0.2, 0.45, H, 0, 0);
  } else if (type === 'cannon') {                                // 원형 포좌 + 포탑 돔 + 포신
    add(g, G.cyl(1.3, 1.52, 1.4, 10), TM.stone, 0, 1.37, 0); add(g, G.torus(1.36, 0.13), TM.dark, 0, 2.0, 0, H, 0, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(g, G.box(0.16, 0.16, 0.16), TM.dark, Math.cos(a) * 1.44, 1.3, Math.sin(a) * 1.44); }
    add(head, new THREE.SphereGeometry(1.05, 10, 6, 0, Math.PI * 2, 0, H), acc, 0, -0.5, 0); add(head, G.cyl(1.08, 1.08, 0.18, 10), TM.dark, 0, -0.5, 0);
    add(head, G.cyl(0.4, 0.5, 2.3, 10), TM.dark, 0, 0, 1.2, H, 0, 0); add(head, G.torus(0.5, 0.11, 12), TM.dark, 0, 0, 2.3);
    add(h2, G.torus(0.52, 0.1, 12), acc, 0, 0, 1.2); add(h2, G.torus(0.56, 0.1, 12), acc, 0, 0, 0.6);
    add(h3, G.cyl(0.2, 0.25, 1.7, 8), TM.dark, 0.66, -0.05, 0.9, H, 0, 0); add(h3, G.cyl(0.2, 0.25, 1.7, 8), TM.dark, -0.66, -0.05, 0.9, H, 0, 0); add(h3, G.ico(0.3), TM.gold, 0, 0.62, 0);
  } else if (type === 'frost') {                                 // 얼음 수정탑: 돌받침 위에 고드름, 코어는 부유
    add(g, G.cyl(0.62, 1.12, 1.2, 6), TM.stone, 0, 1.27, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(g, G.cone(0.32, 1.7, 4), acc, Math.cos(a) * 0.95, 1.55, Math.sin(a) * 0.95, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
    const core = add(head, G.octa(0.95), lit, 0, 0, 0); core.scale.y = 1.5;
    add(head, G.torus(1.42, 0.08, 24), acc, 0, 0, 0, H, 0, 0);
    add(h2, G.torus(1.75, 0.06, 24), lit, 0, 0, 0, H + 0.55, 0, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 1; add(lv2, G.cone(0.22, 1.2, 4), acc, Math.cos(a) * 1.25, 1.1, Math.sin(a) * 1.25, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; add(h3, G.octa(0.3), lit, Math.cos(a) * 2.0, 0, Math.sin(a) * 2.0); }
  } else if (type === 'tesla') {                                 // 코일탑: 위로 갈수록 좁아지는 구리 고리, 꼭대기에 전기 구슬
    add(g, G.cyl(0.34, 0.78, 3.3, 6), TM.stoneD, 0, 2.3, 0);
    [[1.55, 0.98], [2.3, 0.8], [3.0, 0.62], [3.6, 0.46]].forEach(([y, r]) => add(g, G.torus(r, 0.12), acc, 0, y, 0, H, 0, 0));
    add(head, G.ico(0.62, 1), lit, 0, 0, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(lv2, G.cyl(0.06, 0.06, 1.5, 4), TM.dark, Math.cos(a) * 0.95, 3.5, Math.sin(a) * 0.95, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); add(lv2, G.ico(0.2), lit, Math.cos(a) * 1.3, 4.15, Math.sin(a) * 1.3); }
    add(h3, G.torus(1.05, 0.06, 24), lit, 0, 0, 0, H, 0, 0); add(h3, G.torus(0.85, 0.05, 24), lit, 0, 0, 0, 0.4, 0, 0);
  } else if (type === 'prism') {                                 // 프리즘탑: 오벨리스크가 돌아가는 프리즘을 받침
    add(g, G.cyl(0.32, 1.08, 3.7, 4), TM.stone, 0, 2.5, 0, 0, H / 2, 0); add(g, G.cyl(0.72, 0.8, 0.22, 4), TM.gold, 0, 2.0, 0, 0, H / 2, 0);
    const core = add(head, G.octa(0.82), lit, 0, 0, 0); core.scale.y = 1.6;
    add(head, G.torus(1.12, 0.07, 20), acc, 0, 0, 0);
    add(h2, G.torus(1.42, 0.05, 20), lit, 0, 0, 0, 0, H, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(h3, G.octa(0.28), lit, Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75); }
    add(lv3, G.cyl(0.9, 0.98, 0.2, 4), TM.gold, 0, 1.2, 0, 0, H / 2, 0);
  }
  else if (type === 'flame') {                                   // 화염탑: 돌받침 위의 쇠 화로, 분사구가 목표를 따라 회전
    add(g, G.cyl(1.1, 1.4, 1.3, 8), TM.stone, 0, 1.3, 0); add(g, G.cyl(1.35, 1.0, 0.7, 8), TM.dark, 0, 2.25, 0); add(g, G.torus(1.36, 0.1), acc, 0, 2.6, 0, H, 0, 0);
    add(head, G.cyl(0.5, 0.6, 0.6, 8), TM.dark, 0, 0.1, 0); add(head, G.cone(0.42, 1.5, 8), TM.dark, 0, 0.2, 1.0, -H, 0, 0); add(head, G.torus(0.36, 0.09, 12), acc, 0, 0.2, 1.65);
    add(head, G.octa(0.34), lit, 0, 0.75, 0); add(head, G.cyl(0.3, 0.3, 0.9, 8), TM.gold, 0, 0.1, -0.75, H, 0, 0);
    add(h2, G.torus(0.46, 0.08, 12), acc, 0, 0.2, 1.1); add(lv2, G.torus(1.5, 0.08), TM.gold, 0, 1.95, 0, H, 0, 0);
    add(h3, G.cone(0.26, 1.1, 6), TM.dark, 0.5, 0.2, 0.9, -H, 0, 0.25); add(h3, G.cone(0.26, 1.1, 6), TM.dark, -0.5, 0.2, 0.9, -H, 0, -0.25); add(h3, G.octa(0.24), lit, 0, 1.25, 0);
  } else if (type === 'mortar') {                                // 박격포: 납작한 포좌, 하늘을 향해 비껴선 굵은 포신
    add(g, G.cyl(1.45, 1.6, 0.9, 8), TM.stoneD, 0, 1.1, 0); add(g, G.torus(1.5, 0.12), TM.dark, 0, 1.55, 0, H, 0, 0);
    for (const sx of [-1, 1]) add(g, G.cyl(0.6, 0.6, 0.24, 10), TM.wood, sx * 1.45, 0.95, 0, 0, 0, H);
    add(head, G.box(1.5, 0.5, 1.5), TM.dark, 0, -0.75, 0); add(head, G.cyl(0.6, 0.72, 2.6, 10), TM.dark, 0, 0.2, 0.55, 0.7, 0, 0); add(head, G.torus(0.66, 0.12, 12), acc, 0, 1.0, 1.25, 0.7 - H, 0, 0);
    add(head, G.torus(0.72, 0.1, 12), acc, 0, -0.35, 0.1, 0.7 - H, 0, 0);
    add(h2, G.torus(0.7, 0.1, 12), TM.gold, 0, 0.3, 0.65, 0.7 - H, 0, 0); for (const sx of [-1, 1]) add(lv2, G.box(0.3, 0.9, 1.3), TM.wood, sx * 1.1, 1.9, -0.3);
    add(h3, G.cyl(0.7, 0.8, 0.5, 10), TM.gold, 0, 1.25, 1.45, 0.7, 0, 0); add(lv3, G.ico(0.4), TM.dark, 1.2, 0.95, 1.2); add(lv3, G.ico(0.4), TM.dark, 0.75, 0.95, 1.55); add(lv3, G.ico(0.4), TM.dark, 1.0, 1.5, 1.35);
  } else if (type === 'sniper') {                                // 저격탑: 가늘고 높은 감시대, 꼭대기에 긴 총 한 자루
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, G.cyl(0.1, 0.14, 4.2, 4), TM.wood, sx * 0.62, 2.7, sz * 0.62, sz * 0.12, 0, -sx * 0.12);
    add(g, G.box(1.5, 0.1, 0.1), TM.wood, 0, 2.2, 0.75, 0, 0, 0.5); add(g, G.box(1.5, 0.1, 0.1), TM.wood, 0, 3.4, -0.6, 0, 0, -0.5); add(g, G.box(1.7, 0.22, 1.7), TM.stoneD, 0, 4.75, 0);
    add(head, G.box(0.5, 0.45, 0.9), TM.dark, 0, 0, -0.1); add(head, G.cyl(0.09, 0.11, 3.4, 6), TM.dark, 0, 0.05, 1.9, H, 0, 0); add(head, G.cyl(0.16, 0.16, 0.5, 6), TM.dark, 0, 0.05, 3.5, H, 0, 0);
    add(head, G.cyl(0.13, 0.13, 0.9, 6), acc, 0, 0.38, 0.3, H, 0, 0); add(head, G.octa(0.14), lit, 0, 0.38, 0.8); add(head, G.box(0.2, 0.5, 0.2), TM.wood, 0, -0.3, -0.5);
    add(lv2, G.cone(1.5, 0.9, 4), acc, 0, 6.3, 0, 0, H / 2, 0); for (const sx of [-1, 1]) add(lv2, G.cyl(0.06, 0.06, 1.1, 4), TM.wood, sx * 0.7, 5.4, -0.7);
    add(h3, G.cyl(0.05, 0.05, 3.2, 4), lit, 0, 0.22, 2.0, H, 0, 0); add(lv3, G.torus(1.0, 0.08), TM.gold, 0, 4.95, 0, H, 0, 0);
  } else if (type === 'beacon') {                                // 증폭탑: 토템 기둥 + 떠 있는 금색 별 수정과 빛고리
    add(g, G.cyl(0.55, 0.9, 3.0, 6), TM.stone, 0, 2.2, 0); add(g, G.cyl(0.95, 0.95, 0.24, 6), TM.gold, 0, 1.4, 0); add(g, G.cyl(0.75, 0.75, 0.2, 6), TM.gold, 0, 2.9, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(g, G.box(0.16, 1.7, 0.6), acc, Math.cos(a) * 0.75, 2.2, Math.sin(a) * 0.75, 0, -a, 0); }
    add(head, G.octa(0.62), lit, 0, 0, 0); add(head, G.torus(1.15, 0.07, 24), lit, 0, 0, 0, H, 0, 0); add(head, G.torus(0.9, 0.05, 24), TM.gold, 0, 0, 0, 0.6, 0, 0);
    add(h2, G.torus(1.5, 0.05, 24), lit, 0, 0, 0, H - 0.5, 0, 0);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; add(h3, G.octa(0.22), lit, Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8); }
    add(lv3, G.cyl(1.3, 1.4, 0.16, 6), TM.gold, 0, 0.75, 0);
  }
  const pips = [-1, 0, 1].map((k) => { const p = add(g, G.octa(0.2), lit, k * 0.5, 0.78, 1.6); p.visible = false; return p; });
  // 2 성: 발밑에 도는 마법진; 3 성: 옅은 빛기둥, 금 고리, 세 개의 궤도 보석
  const ring = add(g, AURA.rune, addMat({ map: runeTex, color: lit.color.clone().multiplyScalar(0.5) }), 0, 0.09, 0);
  const crown = new THREE.Group(); g.add(crown);
  add(crown, AURA.col, addMat({ color: lit.color.clone().multiplyScalar(0.1), side: THREE.DoubleSide }), 0, 0.2, 0);
  add(crown, AURA.ring, TM.gold, 0, 0.95, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(crown, AURA.gem, lit, Math.cos(a) * 2.25, d.my * 0.45 + i * 0.55, Math.sin(a) * 2.25); }
  g.traverse((m) => { if (m.isMesh && m.material.isMeshLambertMaterial) m.castShadow = true; });
  g.userData = { head, pips, lv2: [lv2, h2, ring], lv3: [lv3, h3, crown], ring, crown };
  return g;
}

// ---------- 사운드 ----------
let ac = null, master = null, muted = false, noiseBuf = null, meter = null, meterBuf = null;
const lastSfx = {};
function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 1.0;
      const comp = ac.createDynamicsCompressor();               // 컴프레서, 궁극기가 겹쳐도 소리가 깨지지 않게
      comp.threshold.value = -16; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
      meter = ac.createAnalyser(); meter.fftSize = 2048; meterBuf = new Float32Array(2048);
      const out = ac.createGain(); out.gain.value = 0.62;         // 컴프레서 뒤 여유를 둬 피크 클리핑 방지
      master.connect(comp); comp.connect(out); out.connect(meter); meter.connect(ac.destination);
      const rv = ac.createConvolver(), rl = Math.floor(ac.sampleRate * 1.7), ib = ac.createBuffer(2, rl, ac.sampleRate);   // 리버브: 감쇠하는 노이즈를 공간의 메아리로 사용
      for (let ch = 0; ch < 2; ch++) { const dd = ib.getChannelData(ch); for (let i = 0; i < rl; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / rl) ** 2.6; }
      rv.buffer = ib; const send = ac.createGain(); send.gain.value = 0.2; master.connect(send); send.connect(rv); rv.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { console.error('오디오 초기화 실패', e); }
  }
  if (ac && ac.state !== 'running') ac.resume();
}
function audioPeak() { if (!meter) return 0; meter.getFloatTimeDomainData(meterBuf); let m = 0; for (const v of meterBuf) m = Math.max(m, Math.abs(v)); return +m.toFixed(3); }
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, vol, freq, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(120, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
function limited(name, gap, fn) {
  const now = performance.now();
  if (now - (lastSfx[name] || 0) < gap) return;
  lastSfx[name] = now; fn();
}
const sfx = {
  arrow: () => limited('arrow', 90, () => { tone('triangle', 1100, 520, 0.06, 0.07); hiss(0.03, 0.04, 5000); }),
  cannon: () => limited('cannon', 120, () => { tone('square', 240, 70, 0.2, 0.16); hiss(0.2, 0.2, 2600); }),
  frost: () => limited('frost', 200, () => tone('sine', 1500, 760, 0.2, 0.08)),
  zap: () => limited('zap', 90, () => { tone('sawtooth', 2200, 260, 0.14, 0.2); tone('square', 3200, 500, 0.1, 0.1); tone('sawtooth', 700, 120, 0.16, 0.12, 0.03); hiss(0.14, 0.3, 9000); }),
  flame: () => limited('flame', 130, () => hiss(0.22, 0.13, 3800)),
  mortar: () => { tone('sine', 190, 60, 0.3, 0.3); tone('square', 320, 90, 0.2, 0.14); hiss(0.3, 0.3, 2200); },
  snipe: () => limited('snipe', 60, () => { tone('sawtooth', 2600, 300, 0.12, 0.2); tone('square', 900, 120, 0.2, 0.16); hiss(0.25, 0.35, 9000); }),
  shieldBreak: () => limited('sb', 80, () => { tone('triangle', 2400, 600, 0.2, 0.16); hiss(0.2, 0.2, 8000); }),
  stomp: () => { tone('sine', 110, 35, 0.6, 0.6); tone('sawtooth', 220, 50, 0.4, 0.2); hiss(0.5, 0.3, 1500); },
  pop: (c = 0) => limited('pop', 40, () => {                    // 연속 처치가 높을수록 음이 올라감: 펜타토닉 스케일로 세 옥타브 상승
    const st = Math.min(14, Math.floor(c / 3)), f = 330 * 2 ** (([0, 2, 4, 7, 9][st % 5] + 12 * Math.floor(st / 5)) / 12);
    tone('triangle', f, f * 0.6, 0.09, 0.11); tone('square', f * 0.5, f * 0.25, 0.06, 0.05); tone('sine', 150, 55, 0.08, 0.1);
  }),
  coin: () => limited('coin', 55, () => tone('triangle', 1760, 2500, 0.05, 0.045)),
  build: () => { tone('triangle', 330, 660, 0.1, 0.22); tone('triangle', 660, 990, 0.14, 0.18, 0.08); hiss(0.08, 0.1, 3000); },
  up: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.02, 0.16, 0.18, i * 0.06)),
  sell: () => tone('triangle', 760, 320, 0.16, 0.18),
  deny: () => tone('square', 200, 150, 0.12, 0.12),
  wave: () => { tone('sawtooth', 220, 330, 0.5, 0.16); tone('sawtooth', 330, 440, 0.55, 0.14, 0.22); tone('square', 110, 165, 0.6, 0.1); },
  leak: () => { tone('sawtooth', 520, 130, 0.45, 0.28); tone('square', 260, 90, 0.45, 0.16); hiss(0.3, 0.2, 1800); },
  bossDie: () => { tone('sawtooth', 300, 40, 1.0, 0.35); tone('sine', 160, 30, 1.0, 0.5); hiss(0.9, 0.5, 4000); },
  boom: (big) => { tone('sine', big ? 130 : 170, 30, big ? 1.2 : 0.4, big ? 0.9 : 0.3); tone('sawtooth', big ? 360 : 300, 50, big ? 0.7 : 0.25, big ? 0.4 : 0.14);
    hiss(big ? 1.3 : 0.4, big ? 0.9 : 0.3, big ? 6000 : 3000); if (big) hiss(2.2, 0.25, 900, 0.2); },
  det: () => limited('det', 40, () => { tone('sawtooth', 420, 70, 0.25, 0.22); hiss(0.25, 0.3, 4500); }),
  cast: () => { hiss(0.45, 0.35, 8000); tone('triangle', 220, 1760, 0.32, 0.25); tone('square', 110, 880, 0.32, 0.08); },
  meteor: () => { tone('sine', 2600, 260, 1.0, 0.22); tone('sawtooth', 1300, 130, 1.0, 0.12); hiss(1.0, 0.35, 2500); },
  freeze: () => { [2637, 2093, 1568, 1319, 1047, 784].forEach((f, i) => { tone('sine', f, f * 0.5, 0.7, 0.16, i * 0.06); tone('triangle', f * 1.5, f, 0.3, 0.06, i * 0.06); }); hiss(1.6, 0.4, 9000); tone('sine', 220, 110, 1.6, 0.25); },
  shatter: () => { for (let i = 0; i < 12; i++) tone('triangle', rand(2000, 4200), rand(700, 1400), 0.14, 0.14, i * 0.025); hiss(0.5, 0.6, 9000); tone('sawtooth', 500, 90, 0.4, 0.3); },
  charge: () => { tone('sawtooth', 110, 1320, 1.0, 0.3); tone('square', 220, 2640, 1.0, 0.1); tone('sine', 55, 440, 1.0, 0.3); hiss(1.0, 0.15, 1200); },
  judge: () => { [110, 165, 220, 330, 440, 660].forEach((f, i) => tone('sawtooth', f, f * 1.015, 3.0, 0.13 - i * 0.012)); [880, 1320].forEach((f) => tone('sine', f, f * 0.99, 3.0, 0.07));
    hiss(3.0, 0.4, 5000); tone('sine', 150, 35, 1.3, 0.8); tone('sawtooth', 400, 60, 0.7, 0.4); },
  upMax: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone('triangle', f, f * 1.01, 0.5, 0.2, i * 0.07)); [261, 392, 523].forEach((f) => tone('sawtooth', f, f, 0.9, 0.09, 0.42)); hiss(0.5, 0.25, 8000, 0.42); tone('sine', 130, 50, 0.6, 0.4, 0.42); },
  storm: () => { hiss(4.4, 0.22, 700); tone('sine', 60, 45, 4.4, 0.35); tone('sawtooth', 90, 180, 1.2, 0.15); },
  thunder: () => limited('thunder', 60, () => { hiss(0.35, 0.5, 7000); tone('sawtooth', rand(140, 220), 40, 0.4, 0.35); tone('square', 2400, 200, 0.08, 0.14); }),
  hole: () => { tone('sine', 220, 38, 3.4, 0.5); tone('sawtooth', 110, 30, 3.4, 0.16); tone('triangle', 300, 2400, 3.4, 0.1); hiss(3.4, 0.25, 1200); },
  blades: () => { [1319, 1568, 2093, 2637].forEach((f, i) => tone('triangle', f, f * 1.01, 0.5, 0.12, i * 0.07)); hiss(0.6, 0.2, 9000); },
  blade: (big) => limited('blade' + big, 50, () => { tone('triangle', big ? 1800 : 3200, big ? 300 : 900, big ? 0.5 : 0.18, 0.2); tone('sawtooth', 5200, 1800, 0.1, 0.07); hiss(0.2, 0.25, 9000); tone('sine', 200, 60, 0.2, 0.25); }),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.6, 0.25, i * 0.14)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.7, 0.2, i * 0.22)),
};
// 배경음악: 네 코드 순환의 아르페지오, 전투 중엔 비트 한 겹 추가
const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
let musT = 0, musI = 0;
// 프리즘탑의 레이저는 지속 조사, 상주 오실레이터 묶음을 '조사 중인 탑 수'로 음량 조절
let hum = null, beamN = 0, beamRamp = 0;
function laserHum(n, ramp) {
  if (!ac) return;
  if (!hum) {
    const g = ac.createGain(); g.gain.value = 0; g.connect(master);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2; f.connect(g);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 440; o2.frequency.value = 663;
    lfo.frequency.value = 23; lg.gain.value = 30; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);   // 살짝 떨림을 줘 지직거리는 느낌
    o1.connect(f); o2.connect(f); o1.start(); o2.start(); lfo.start();
    hum = { g, o1, o2, f };
  }
  const t = ac.currentTime, on = !muted && n > 0;
  hum.g.gain.setTargetAtTime(on ? Math.min(0.26, 0.12 + n * 0.035) : 0, t, 0.05);
  if (on) { hum.o1.frequency.setTargetAtTime(420 + ramp * 160, t, 0.1); hum.o2.frequency.setTargetAtTime(633 + ramp * 240, t, 0.1); hum.f.frequency.setTargetAtTime(1300 + ramp * 700, t, 0.1); }
}
// 음성 안내: 브라우저 내장 음성 합성으로 오리지널 대사를 읽음
let voice = null, sayUntil = 0, sayPri = 0;
const lastSay = {};
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang));
  voice = vs.find((v) => /ko[-_]KR/i.test(v.lang)) || vs[0] || null;
}
const canSpeak = 'speechSynthesis' in window;
if (canSpeak) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
// 미리 생성된 음성 파일(tools/gen_voice.py 로 합성): 페이지가 열리면 다운로드 시작, 없는 문장만 브라우저 음성 합성으로 대체
const VOICE = { '운석이여, 떨어져라!': '陨星，坠落！', '벼락이여, 쏟아져라!': '雷霆，万钧！', '만물이여, 얼어라!': '万物，冰封！', '천공의, 심판!': '天穹，裁决！', '공허여, 집어삼켜라!': '虚空，吞噬！', '검진이여, 내려와라!': '剑阵，落！', '운석 낙하, 준비 완료': '陨星坠，就绪', '벼락 난무, 준비 완료': '雷霆万钧，就绪', '혹한의 영역, 준비 완료': '极寒领域，就绪', '천공의 심판, 준비 완료': '天穹裁决，就绪', '공허의 특이점, 준비 완료': '虚空奇点，就绪', '유성 검진, 준비 완료': '流光剑阵，就绪', '석궁탑, 각성': '弩塔，觉醒', '대포탑, 각성': '炮塔，觉醒', '서리탑, 각성': '霜塔，觉醒', '전기탑, 각성': '电塔，觉醒', '프리즘탑, 각성': '光棱塔，觉醒', '화염탑, 각성': '焰塔，觉醒', '박격포, 각성': '迫击炮，觉醒', '저격탑, 각성': '狙击塔，觉醒', '증폭탑, 각성': '增幅塔，觉醒' };
const clips = {};                                               // 대사 -> { raw: Promise<ArrayBuffer>, dur, buf }
let clipSrc = null, sayTok = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => {
  for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) };
}).catch(() => {});
function clipBuf(c) { return c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b))); }
function stopSay() { sayTok++; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 끝남 */ } clipSrc = null; } if (canSpeak) speechSynthesis.cancel(); }
function say(text, pri = 1, gap = 0) {                          // pri 가 높으면 낮은 것을 끊을 수 있음; gap 은 같은 문장의 최소 간격(밀리초)
  if (muted || !ac) return;
  const now = performance.now();
  if (gap && now - (lastSay[text] || 0) < gap) return;
  if (now < sayUntil && pri <= sayPri) return;
  lastSay[text] = now;
  stopSay();
  const c = clips[VOICE[text] || text], tok = sayTok;
  sayPri = pri;
  if (c) {
    sayUntil = now + 250 + c.dur * 1000;
    clipBuf(c).then((buf) => {
      if (tok !== sayTok || muted || performance.now() - now > 600) return;   // 디코딩이 너무 느리거나 다른 문장이 밀어냈으면 재생 안 함
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; g.gain.value = 1.3; src.connect(g); g.connect(master); src.start(); clipSrc = src; saidLog.push(text); if (saidLog.length > 30) saidLog.shift();
    }).catch(() => {});
    return;
  }
  if (!canSpeak) return;
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = 'ko-KR'; u.rate = pri >= 3 ? 1.05 : 1.2; u.pitch = pri >= 3 ? 0.75 : 0.95; u.volume = 1;
  speechSynthesis.speak(u);
  sayUntil = now + 350 + text.length * 210;
}
const saidLog = [];
const STREAK = { 10: '10 연속 처치', 25: '전장 휩쓸기', 50: '막을 수 없다', 100: '천하무적', 200: '전설의 수호자' };
const ULT_LINE = ['운석이여, 떨어져라!', '벼락이여, 쏟아져라!', '만물이여, 얼어라!', '천공의, 심판!', '공허여, 집어삼켜라!', '검진이여, 내려와라!'];
let combo = 0, comboT = 0;

function music() {
  if (!ac || muted || state !== 'play') { musT = 0; return; }
  if (!musT || musT < ac.currentTime - 0.5) musT = ac.currentTime + 0.05;
  while (musT < ac.currentTime + 0.3) {
    const d = musT - ac.currentTime, b = musI % 16, ch = CHORDS[Math.floor(musI / 16) % 4], fight = phase === 'wave';
    if (b % 8 === 0) { tone('triangle', ch[0] / 2, ch[0] / 2, 1.4, 0.13, d); tone('sine', ch[0], ch[0], 1.4, 0.05, d); }
    if (b % 2 === 0) tone('triangle', ch[(b / 2) % 3] * (b % 8 >= 4 ? 2 : 1), ch[(b / 2) % 3] * (b % 8 >= 4 ? 2 : 1), 0.32, fight ? 0.07 : 0.05, d);
    if (fight) { hiss(0.04, b % 4 === 2 ? 0.1 : 0.04, 9000, d); if (b % 4 === 0) tone('sine', 160, 60, 0.12, 0.16, d); }
    musT += 0.19; musI++;
  }
}

// ---------- 진행 ----------
function banner(text, dur = 1.8, cls = '') { const c = $('center'); c.textContent = text; c.className = cls; bannerT = dur; }
function resetField() {
  foes = []; towers = []; shots = []; queue = []; rings = []; bolts = []; spikes = []; orbs = []; marks = []; meteors = []; burns = []; timers = []; pillars = []; gibs = []; runes = []; blades = []; coins = [];
  cellT.fill(null); world.clear();
  slowT = 0; frost = null; judge = null; hole = null; storm = null; for (const b of beams) b.visible = false;
  shake = hurtFx = flash = tintK = tintTo = ab = dark = darkTo = glow = roadGlow = roadGlowTo = zoom = zoomTo = 0; shock = null;
  buildType = null; selected = null; crystal.visible = true; combo = 0;
}
function newGame(i = mapI) {
  if (i !== mapI) loadMap(i);
  save.last = mapI; persist();
  if (!dry) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'td'; (h.played = h.played || {}).td = k; h.last = 'td'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장이 안 되면 그냥 둠 */ }   // 홈에 플레이 기록 한 번 남김
  resetField();
  gold = MAP.gold; lives = 20; kills = 0; waveN = 0; phase = 'prep'; nextT = 15; time = 0; won = false;
  ultCd = [0, 6, 0, 18, 12, 9]; speed = 1;
  state = 'play';
  $('screen').style.display = 'none'; $('hud').style.display = 'block'; $('paused').style.display = 'none';
  banner(MAP.name + ' · 길가에 타워를 세워 크리스탈을 지키세요', 3); lowWarned = false; say('크리스탈을 지켜라', 1);
}
function startWave() {
  if (phase !== 'prep' || waveN >= waves.length) return;
  if (nextT > 0.5) gold += Math.ceil(nextT) * 2;
  waveN++; phase = 'wave'; waveT = 0; queue = [];
  let boss = false;
  const cur = waves[waveN - 1];
  cur.forEach(([type, n, gap, delay = 0], gi) => {                // 길이 여러 개일 때: 한 웨이브가 한 그룹이면 한 마리씩 번갈아, 아니면 그룹마다 길 하나
    const k = FOES[type].big ? 1 : MOB_N;                          // 잡몹은 무리로: 수는 두 배, 간격은 절반, 체력은 spawn 에서 절반으로
    for (let i = 0; i < n * k; i++) queue.push({ t: delay + i * gap / k, type, path: (gi + (cur.length === 1 ? i : 0)) % paths.length });
    if (type === 'boss') boss = true;
  });
  queue.sort((a, b) => a.t - b.t);
  banner(waveN + ' 웨이브' + (boss ? ' · 보스 등장' : waveN === waves.length ? ' · 마지막 웨이브' : ''), 2.2);
  const has = (k) => cur.some((g) => g[0] === k);
  sfx.wave(); say(waveN === waves.length ? '마지막 웨이브, 버텨라' : boss ? '보스 등장' : has('jugger') ? '지진수 등장, 타워 조심' : has('flyer') ? '공중 적 접근' : '적군 접근', 2);
}
function spawn(type, d0, off0, pi = 0) {
  if (!paths[pi]) pi = 0;
  const d = FOES[type], mob = d.big ? 1 : 1 / MOB_N, m = hpMul(waveN) * MAP.hp, hp = d.hp * m * (d.big ? 1 : MOB_HP), alt = d.fly ? 5.5 : 0;
  const e = { type, def: d, d: d0 === undefined ? rand(0, 1.5) : d0, off: off0 === undefined ? rand(-1.2, 1.2) : off0, x: 0, z: 0, hp, maxHp: hp, speed: d.speed * rand(0.94, 1.06), gold: d.gold * mob, leak: d.leak * mob, r: d.r, h: d.h, col: d.col,
    armor: (d.armor || 0) * Math.sqrt(m), boss: !!d.boss, big: d.big || 0, heal: !!d.heal, healT: rand(1, 2), slowT: 0, slowK: 0, frozenT: 0, flash: 0, alive: true, spin: rand(6), judgeId: 0, dx: 1, dz: 0,
    fly: !!d.fly, alt, cy: alt + d.h * 0.55, path: pi, len: d.fly ? paths[pi].fly.len : paths[pi].len, bx: 0, bz: 0, ox: 0, oz: 0, holdT: 0, zapN: 0, shield: (d.shield || 0) * m, maxShield: (d.shield || 0) * m, phased: false, phaseT: rand(1.5, 3.2), burnT: 0, burnD: 0, stompT: rand(3, 5), rage: 0 };
  if (e.big) e.off = 0;
  if (e.fly) e.off = rand(-4, 4);
  place(e); foes.push(e);
  return e;
}
function place(e) {                                             // 먼저 길 위 위치(bx, bz)를 구하고 특이점에 끌린 만큼을 더함
  if (e.fly) {                                                   // 비행 유닛은 길을 걷지 않고 입구에서 크리스탈로 직선 비행
    const F = paths[e.path].fly, k = e.d / F.len, ux = (CRYSTAL.x - F.ax) / F.len, uz = (CRYSTAL.z - F.az) / F.len, w = Math.sin(Math.min(1, k) * Math.PI);
    e.bx = F.ax + (CRYSTAL.x - F.ax) * k - uz * e.off * w; e.bz = F.az + (CRYSTAL.z - F.az) * k + ux * e.off * w; e.dx = ux; e.dz = uz;
  } else {
    const p = pathAt(e.d, e.path);
    e.bx = p.x - p.dz * e.off; e.bz = p.z + p.dx * e.off; e.dx = p.dx; e.dz = p.dz;
  }
  e.x = e.bx + e.ox; e.z = e.bz + e.oz;
}
function hurt(e, dmg, o = {}) {
  if (!e.alive) return;
  if (e.phased && !o.ult) return;                               // 공허에 숨은 동안엔 궁극기만 맞힐 수 있음
  if (e.shield > 0) {                                           // 에너지 실드가 먼저 버팀
    const a = Math.min(e.shield, dmg); e.shield -= a; dmg -= a;
    if (e.shield <= 0) { burst(e.x, e.cy, e.z, 26, [0.6, 1.4, 3], 12, 0.5); addRing(e.x, e.z, 5, 18, [0.3, 0.8, 1.8]); sfx.shieldBreak(); }
    if (dmg <= 0) { if (!o.quiet) e.flash = 0.08; return; }
  }
  if (o.armor && e.armor) dmg = Math.max(dmg - e.armor, dmg * 0.35);
  if (e.frozenT > 0) dmg *= 1.4;
  e.hp -= dmg;
  if (!o.quiet) e.flash = 0.12;
  if (e.hp <= 0) {
    e.alive = false; gold += e.gold; kills++;
    combo++; comboT = 2.2;                                       // 연속 처치: 2 초 안에 이어서 잡으면 누적
    if (STREAK[combo]) { banner(STREAK[combo] + '　×' + combo, 1.8, 'big'); say(STREAK[combo], 2); }
    else if (kills === 1) say('첫 처치', 1);
    if (o.ult) o.ult.n++;
    if (e.def.split) { for (let i = 0; i < e.def.split; i++) spawn('mite', Math.max(0, e.d - i * 0.9), rand(-1.4, 1.4), e.path); burst(e.x, 0.8, e.z, 20, [1.6, 2.2, 0.5], 10, 0.5); }
    const c = [e.col[0] * 2.2, e.col[1] * 2.2, e.col[2] * 2.2];
    if (gibs.length < 200) {                                    // 적은 죽을 때마다 조각나 튀고, 궁극기에 죽으면 더 높이 멀리 날아감
      const u = !!o.ult, ax = e.x - (o.fx === undefined ? e.x : o.fx), az = e.z - (o.fz === undefined ? e.z : o.fz), al = Math.hypot(ax, az) || 1, sp = u ? rand(8, 22) : rand(2, 7), sd = u ? 5 : 6;
      gibs.push({ type: e.type, x: e.x, y: e.h * 0.5, z: e.z, vx: ax / al * sp + rand(-sd, sd), vy: u ? rand(18, 38) : rand(11, 20), vz: az / al * sp + rand(-sd, sd), spin: rand(4, 12), t: 0, life: u ? rand(0.9, 1.4) : rand(0.55, 0.85),
        col: o.ice ? [0.7, 1.3, 1.9] : [e.col[0] * 1.6 + 0.3, e.col[1] * 1.6 + 0.2, e.col[2] * 1.6] });
    }
    if (e.boss) { pillar(e.x, e.z, 5, 60, c, 0.8); shockAt(e.x, e.z, 1); burst(e.x, 2.5, e.z, 240, c, 26, 1.0); addRing(e.x, e.z, 26, 34, c); addRing(e.x, e.z, 16, 18, [2, 2, 2]); shake = Math.max(shake, 2); flash = Math.max(flash, 0.3); sfx.bossDie(); say('보스 처치 완료', 3); }
    else { burst(e.x, e.h * 0.5, e.z, 12, c, 10, 0.45); sfx.pop(combo); }
    for (let i = 0; i < (e.big ? 8 : 3); i++) spark(e.x + rand(-e.r, e.r), e.alt + e.h * 0.6, e.z + rand(-e.r, e.r), rand(-0.6, 0.6), rand(4, 8), rand(-0.6, 0.6), [c[0] * 0.5 + 0.7, c[1] * 0.5 + 0.7, c[2] * 0.5 + 0.7], rand(0.6, 1.1), -1);
    if (e.big && !e.fly) { if (marks.length < 22) marks.push({ x: e.x, z: e.z, r: e.r * 2.4, t: 0, life: 3.2, col: [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45], op: 0.3 }); if (rings.length < 12) addRing(e.x, e.z, 9, 22, c); }
    coinDrop(e.x, e.h * 0.6, e.z, e.boss ? 10 : e.big ? 5 : 1);
    chargeUlts(e.big ? 3 : 0.22 + Math.min(combo, 60) * 0.008);
    const bx = e.x, bz = e.z, bd = e.maxHp * (e.big ? 0.15 : CHAIN_K), bR = e.big ? 9 : 2.4 + e.r, bc = [e.col[0] * 0.9 + 0.3, e.col[1] * 0.9 + 0.2, e.col[2] * 0.9 + 0.1];
    after(0.08, () => chainBlast(bx, bz, bd, bR, bc));          // 연쇄 폭발: 한 박자 늦게 옆의 적을 터뜨려, 밀집하면 연달아 번짐
  }
}
const CHAIN_K = 0.22;
function chainBlast(x, z, dmg, R, col) {
  if (state !== 'play') return;
  for (const f of foes) if (f.alive && (f.x - x) ** 2 + (f.z - z) ** 2 < (R + f.r) ** 2) hurt(f, dmg, { quiet: false });
  burst(x, 0.8, z, 7, col, R * 3.4, 0.28, 0.25, 4);
  if (rings.length < 12) addRing(x, z, R, 24, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5]);
}
function chargeUlts(sec) {                                      // 처치가 모든 궁극기를 충전, 연속 처치가 높을수록 빨리 참
  for (let i = 0; i < ULTS.length; i++) if (ultCd[i] > 0) { ultCd[i] = Math.max(0, ultCd[i] - sec); if (ultCd[i] === 0) say(ULTS[i].name + ', 준비 완료', 0); }
}
// 골드: 적에게서 튀어 나와 잠시 떨어졌다가 왼쪽 위 골드 숫자로 날아감
let coins = [], goldPop = 0, coinNx = -0.8, coinNy = 0.9, coinTick = 0;
const coinTo = new THREE.Vector3();
function coinDrop(x, y, z, n) {
  for (let i = 0; i < n && coins.length < 90; i++) coins.push({ x, y, z, vx: rand(-4, 4), vy: rand(10, 16), vz: rand(-4, 4), t: 0, d: rand(0.28, 0.45), sx: 0, sy: 0, sz: 0, go: false });
}
function updateCoins(dt) {
  goldPop = Math.max(0, goldPop - dt * 5);
  if (!coins.length) return;
  if (!(coinTick++ % 30)) { const r = $('gold').getBoundingClientRect(); if (r.width) { coinNx = (r.left + r.width / 2) / innerWidth * 2 - 1; coinNy = 1 - (r.top + r.height / 2) / innerHeight * 2; } }
  coinTo.set(coinNx, coinNy, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(34).add(camera.position);
  for (const c of coins) {
    c.t += dt;
    if (c.t < c.d) { c.vy -= 34 * dt; c.x += c.vx * dt; c.y = Math.max(0.4, c.y + c.vy * dt); c.z += c.vz * dt; }
    else {
      if (!c.go) { c.go = true; c.sx = c.x; c.sy = c.y; c.sz = c.z; }
      const k = Math.min(1, (c.t - c.d) / 0.42), q = k * k;
      c.x = c.sx + (coinTo.x - c.sx) * q; c.y = c.sy + (coinTo.y - c.sy) * q + Math.sin(k * Math.PI) * 3; c.z = c.sz + (coinTo.z - c.sz) * q;
      if (k >= 1) { c.t = 99; goldPop = 1; sfx.coin(); }
    }
    spark(c.x, c.y, c.z, 0, 0, 0, [2.4, 1.7, 0.3], 0.14, 0);
  }
  coins = coins.filter((c) => c.t < 99);
}
function leak(e) {
  e.alive = false; lives -= e.leak; hurtFx = 1; shake = Math.max(shake, 1.2);
  burst(CRYSTAL.x, 4, CRYSTAL.z, 50, [2.4, 0.4, 0.3], 14, 0.6); addRing(CRYSTAL.x, CRYSTAL.z, 12, 22, [2, 0.3, 0.2]); sfx.leak();
  if (lives <= 6 && lives > 0 && !lowWarned) { lowWarned = true; say('크리스탈 위기', 3); } else say('크리스탈이 공격받고 있다', 1, 7000);
  if (lives <= 0) { lives = 0; endGame(false); }
}
function endGame(win) {
  if (state !== 'play') return;
  won = win; state = 'over'; buildType = null; selected = null;
  if (win) { gotStars = lives >= 18 ? 3 : lives >= 10 ? 2 : 1; save.stars[mapI] = Math.max(save.stars[mapI] || 0, gotStars); persist(); }
  say(win ? '승리' : '패배', 4);
  if (win) { sfx.win(); for (let i = 0; i < 6; i++) after(i * 0.25, () => { const x = rand(-HX + 10, HX - 10), z = rand(-HZ + 6, HZ - 6); burst(x, 14, z, 120, [rand(1, 3), rand(1, 3), rand(1, 3)], 20, 1.2); }); }
  else { sfx.lose(); sfx.boom(true); crystal.visible = false; burst(CRYSTAL.x, 5, CRYSTAL.z, 400, [0.6, 1.6, 3], 30, 1.4); addRing(CRYSTAL.x, CRYSTAL.z, 60, 40, [0.6, 1.4, 2.6]); shake = 3; flash = 0.8; flashC.set(0.7, 0.9, 1); }
  setTimeout(() => { if (state === 'over') showScreen(); }, 1800);
}

// ---------- 건설 ----------
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
function refresh(t) {
  const d = t.def, m = LV_DMG[t.lv - 1];
  t.dmg = d.dmg * m * (t.buff || 1); t.range = d.range * LV_RANGE[t.lv - 1];
  t.aoe = d.aoe ? d.aoe + (t.lv - 1) * 0.7 : 0; t.slow = d.slow ? d.slow + (t.lv - 1) * 0.1 : 0; t.chain = d.chain ? [3, 4, 6][t.lv - 1] : 0;
  const ud = t.mesh.userData;
  ud.pips.forEach((p, i) => { p.visible = i < t.lv; });
  ud.lv2.forEach((o) => { o.visible = t.lv >= 2; }); ud.lv3.forEach((o) => { o.visible = t.lv >= 3; });
  ud.head.scale.setScalar(1 + (t.lv - 1) * 0.1); ud.ring.scale.setScalar(t.lv >= 3 ? 3.3 : 2.7);
}
function rebuff() {                                             // 증폭탑이 범위 안 타워의 피해를 올림, 가장 높은 것 하나만 적용하고 중첩 안 됨
  for (const t of towers) { t.buff = 1; t.buffBy = null; refresh(t); }
  for (const b of towers) if (b.type === 'beacon') for (const t of towers) {
    if (t === b || t.type === 'beacon' || Math.hypot(t.x - b.x, t.z - b.z) > b.range + 0.1) continue;
    const k = 1.2 + (b.lv - 1) * 0.1;
    if (k > t.buff) { t.buff = k; t.buffBy = b; }
  }
  for (const t of towers) refresh(t);
}
function build(type, c, r, silent) {
  const d = TOWERS[type], i = r * COLS + c;
  if (!inGrid(c, r) || blocked[i] || cellT[i]) { if (!silent) { banner('여기에는 지을 수 없습니다', 0.9); sfx.deny(); } return null; }
  if (gold < d.cost) { if (!silent) { banner('골드 부족', 0.9); sfx.deny(); } return null; }
  gold -= d.cost;
  const t = { type, def: d, c, r, x: cx(c), z: cz(r), lv: 1, cdT: 0.2, face: 0, spin: rand(6), ramp: 0, target: null, spent: d.cost, mesh: towerMesh(type), fxc: litArr(d.col), pop: 0.25, rise: 0, kick: 0, stunT: 0, buff: 1, buffBy: null };
  t.mesh.position.set(t.x, 0, t.z); world.add(t.mesh);
  cellT[i] = t; towers.push(t); rebuff();
  burst(t.x, 0.5, t.z, 24, [1.2, 1.6, 2], 9, 0.5); addRing(t.x, t.z, 6, 16, [0.4, 0.9, 1.2]); sfx.build();
  return t;
}
function upgrade(t, silent) {
  if (!t || t.lv >= 3) return false;
  const c = upCost(t);
  if (gold < c) { if (!silent) { banner('골드 부족', 0.9); sfx.deny(); } return false; }
  gold -= c; t.spent += c; t.lv++; rebuff(); upgradeFx(t);
  return true;
}
function upgradeFx(t) {                                          // 등급 업 연출: 빛기둥, 마법진, 소용돌이치며 오르는 빛점; 만랩은 하늘의 번개 빛과 충격파 추가
  const max = t.lv === 3, c = t.fxc, my = t.def.my, dim = [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
  t.pop = max ? 0.45 : 0.3;
  pillar(t.x, t.z, max ? 2.0 : 1.4, max ? 30 : 16, dim, max ? 0.9 : 0.55); pillar(t.x, t.z, 0.4, max ? 34 : 18, [1.8, 1.6, 1.2], 0.4);
  rune(t.x, 0.12, t.z, max ? 7.5 : 5, dim, max ? 1.5 : 1.0, max ? 5 : 3);
  addRing(t.x, t.z, max ? 16 : 9, 22, dim); if (max) addRing(t.x, t.z, 26, 40, [1.6, 1.2, 0.3]);
  orbs.push({ x: t.x, y: my * 0.6, z: t.z, r0: 0.5, r1: max ? 4.5 : 3, t: 0, life: 0.35, col: [c[0] * 0.22, c[1] * 0.22, c[2] * 0.22] });
  for (let i = 0; i < (max ? 90 : 44); i++) {
    const a = i * 0.5, r = 1.9 + (i % 3) * 0.3;
    spark(t.x + Math.cos(a) * r, 0.2 + i * 0.03, t.z + Math.sin(a) * r, -Math.sin(a) * 6, rand(8, 15), Math.cos(a) * 6, i % 4 ? c : [3.2, 2.6, 0.8], rand(0.6, 1.1), 4);
  }
  burst(t.x, my, t.z, max ? 70 : 30, [3, 2.4, 0.8], 13, 0.7, 1.2);
  if (max) {
    for (let i = 0; i < 5; i++) after(i * 0.07, () => jag(t.x + rand(-6, 6), 60, t.z - rand(4, 12), t.x, my, t.z, 0.32, [2.4, 2.0, 0.9], 0.2, 0.06));
    after(0.35, () => { burst(t.x, my + 1, t.z, 80, c, 18, 0.9, 1.6); addRing(t.x, t.z, 12, 26, c); });
    shake = Math.max(shake, 1.4); flash = Math.max(flash, 0.06); flashC.set(1, 0.92, 0.7); shockAt(t.x, t.z, 0.7, 0.6);
    banner(t.def.name + ' · 각성', 1.6, 'big'); sfx.upMax(); say(t.def.name + ', 각성', 2);
  } else { shake = Math.max(shake, 0.5); sfx.up(); say('업그레이드 완료', 0, 5000); }
}
function sell(t) {
  if (!t) return;
  gold += Math.round(t.spent * 0.7);
  world.remove(t.mesh); cellT[t.r * COLS + t.c] = null; towers = towers.filter((o) => o !== t); rebuff();
  if (selected === t) selected = null;
  burst(t.x, 1, t.z, 20, [2, 1.6, 0.5], 8, 0.5); sfx.sell();
}

// ---------- 타워 공격 ----------
const canHit = (t, e) => e.alive && !e.phased && !(t.def.ground && e.fly);
function pickTarget(t, strongest) {
  let best = null, bv = -1;
  for (const e of foes) {
    if (!canHit(t, e)) continue;
    const dd = Math.hypot(e.x - t.x, e.z - t.z);
    if (dd > t.range + e.r || (t.def.minRange && dd < t.def.minRange)) continue;
    const v = strongest ? e.hp + e.shield : e.d / e.len;
    if (v > bv) { best = e; bv = v; }
  }
  return best;
}
function splash(x, z, r, dmg, o = {}) { for (const e of foes) if (e.alive && !(o.ground && e.fly) && Math.hypot(e.x - x, e.z - z) <= r + e.r) hurt(e, dmg, o); }
function slowFoe(e, k, dur) { if (e.shield > 0) return; e.slowT = dur; e.slowK = Math.max(e.slowK, e.def.tough ? k * 0.5 : k); }
function updateTowers(dt) {
  for (const t of towers) {
    t.cdT -= dt; t.spin += dt; if (t.pop > 0) t.pop -= dt; if (t.kick > 0) t.kick = Math.max(0, t.kick - dt * 3.5); if (t.rise < 1) t.rise = Math.min(1, t.rise + dt * 3.2);
    const d = t.def, my = d.my;
    if (t.lv === 3 && Math.random() < 0.1) spark(t.x + rand(-1.7, 1.7), rand(0.3, 1.5), t.z + rand(-1.7, 1.7), 0, rand(2.5, 5), 0, t.fxc, rand(0.5, 1), 0);   // 만랩 타워는 계속 빛점을 뿜음
    if (t.stunT > 0) {                                           // 마비 상태: 불꽃만 튀고 발사 안 함
      t.stunT -= dt;
      if (Math.random() < 0.25) { const a = rand(6.3); jag(t.x, my, t.z, t.x + Math.cos(a) * 1.6, rand(0.5, my), t.z + Math.sin(a) * 1.6, 0.1, [2.6, 2.2, 0.6], 0.08, 0.2); }
      continue;
    }
    if (t.type === 'tesla' && Math.random() < 0.04 * t.lv) { const a = rand(6.3); jag(t.x, my, t.z, t.x + Math.cos(a) * 1.3, my - rand(0.4, 1.6), t.z + Math.sin(a) * 1.3, 0.1, [1.6, 1.1, 2.6], 0.08, 0.2); }
    if (t.type === 'beacon') {                                   // 증폭탑: 공격하지 않고 주기적으로 수혜 타워에 금빛 줄기를 보냄
      if (t.cdT <= 0) {
        t.cdT = 2.2;
        if (rings.length < 12) addRing(t.x, t.z, t.range, 14, [0.9, 0.65, 0.15]);
        for (const o of towers) if (o.buffBy === t) { jag(t.x, my, t.z, o.x, o.def.my, o.z, 0.12, [2.6, 1.9, 0.5], 0.2, 0.05); burst(o.x, o.def.my, o.z, 4, [3, 2.2, 0.6], 4, 0.4); }
      }
      continue;
    }
    if (t.type === 'prism') {
      let e = t.target;
      if (!e || !canHit(t, e) || Math.hypot(e.x - t.x, e.z - t.z) > t.range + e.r) { e = pickTarget(t); t.ramp = 0; t.target = e; }
      if (e) {
        t.ramp = Math.min(2.5, t.ramp + dt);
        hurt(e, t.dmg * (1 + t.ramp) * dt, { quiet: true });
        const k = 1 + t.ramp;
        bolt(t.x, my, t.z, e.x, e.cy, e.z, 0.14 * k, [2.6 * k, 0.5 * k, 1.5 * k]);
        beamN++; beamRamp = Math.max(beamRamp, t.ramp / 2.5);
        if (Math.random() < 0.5) spark(e.x, e.cy, e.z, rand(-6, 6), rand(2, 8), rand(-6, 6), [3, 0.8, 2], 0.3);
      }
      continue;
    }
    if (t.type === 'frost') {
      if (t.cdT > 0) continue;
      let any = false;
      for (const e of foes) if (canHit(t, e) && Math.hypot(e.x - t.x, e.z - t.z) <= t.range + e.r) { any = true; hurt(e, t.dmg, { quiet: true }); slowFoe(e, t.slow, 1.6); }
      if (any) { t.cdT = d.cd; if (rings.length < 12) addRing(t.x, t.z, t.range, 30, [0.25, 0.6, 0.9]); burst(t.x, my, t.z, 6, [0.8, 1.6, 2.4], 6, 0.4); sfx.frost(); }
      continue;
    }
    if (t.type === 'flame') {                                    // 화염탑: 목표를 향해 부채꼴 화염을 뿜어 닿으면 지속 화상
      const e = pickTarget(t);
      t.target = e;
      if (!e) continue;
      t.face = Math.atan2(e.x - t.x, e.z - t.z);
      const fx = Math.sin(t.face), fz = Math.cos(t.face), dist = Math.hypot(e.x - t.x, e.z - t.z);
      for (let i = 0; i < 4; i++) { const a = t.face + rand(-0.3, 0.3), sp = rand(15, 24); spark(t.x + fx * 1.8, my + 0.2, t.z + fz * 1.8, Math.sin(a) * sp, (e.cy - my) / Math.max(0.3, dist / sp) + rand(-1.5, 2.5), Math.cos(a) * sp, [3.2, 1.0 + rand(1.2), 0.2], rand(0.22, 0.42), -5); }
      sfx.flame();
      if (t.cdT <= 0) {
        t.cdT = 0.15;
        for (const o of foes) {
          if (!canHit(t, o) || Math.hypot(o.x - t.x, o.z - t.z) > t.range + o.r) continue;
          let da = Math.abs(Math.atan2(o.x - t.x, o.z - t.z) - t.face); if (da > Math.PI) da = Math.PI * 2 - da;
          if (da > 0.6) continue;
          hurt(o, t.dmg * 0.15, { quiet: true });
          if (o.alive && o.shield <= 0) { o.burnT = 2.5; o.burnD = Math.max(o.burnD, t.dmg * 0.4); }
        }
      }
      continue;
    }
    const e = pickTarget(t, t.type === 'sniper');
    t.target = e;
    if (!e) continue;
    t.face = Math.atan2(e.x - t.x, e.z - t.z);
    if (t.cdT > 0) continue;
    t.cdT = d.cd;
    const mx = t.x + Math.sin(t.face) * 2, mz = t.z + Math.cos(t.face) * 2;
    if (t.type === 'arrow') { t.kick = 0.35; burst(mx, my, mz, 3, [0.9, 2.6, 1.2], 5, 0.18, 0.5); shots.push({ kind: 'arrow', x: t.x, y: my, z: t.z, e, tx: e.x, ty: e.cy, tz: e.z, dmg: t.dmg, lv: t.lv }); sfx.arrow(); }
    else if (t.type === 'cannon' || t.type === 'mortar') {
      const big = t.type === 'mortar', dist = Math.hypot(e.x - t.x, e.z - t.z), T = big ? 1.0 + dist / 60 : dist / 34 + 0.15, sp = e.frozenT > 0 ? 0 : e.speed * (e.slowT > 0 ? 1 - e.slowK : 1);
      t.kick = big ? 0.9 : 0.7;
      shots.push({ kind: 'shell', x0: t.x, y0: my + (big ? 1.2 : 0), z0: t.z, x: t.x, y: my, z: t.z, tx: e.x + e.dx * sp * T, tz: e.z + e.dz * sp * T, t: 0, T, dmg: t.dmg, aoe: t.aoe, hi: big ? 18 : 6, big });
      burst(mx, my + (big ? 1.5 : 0), mz, big ? 14 : 5, [2.4, 1.4, 0.5], big ? 9 : 5, 0.3, big ? 2.5 : 0.9);
      if (big) sfx.mortar(); else sfx.cannon();
    } else if (t.type === 'sniper') {                            // 저격: 즉발 빛줄기, 방어력 무시
      t.kick = 1.0;
      const sx = t.x + Math.sin(t.face) * 3.6, sz = t.z + Math.cos(t.face) * 3.6;
      bolt(sx, my, sz, e.x, e.cy, e.z, 0.3, [3.6, 3.2, 1.8], 0.2); bolt(sx, my, sz, e.x, e.cy, e.z, 0.7, [0.8, 0.7, 0.3], 0.35);
      burst(sx, my, sz, 8, [3.4, 3, 1.6], 7, 0.25); burst(e.x, e.cy, e.z, 14, [3.4, 3, 1.6], 12, 0.35);
      hurt(e, t.dmg); sfx.snipe();
    } else {                                                     // 전기탑: 연쇄 번개
      const hit = [e], col = [2.0, 1.4, 3.2]; t.kick = 0.25; burst(t.x, my + 0.4, t.z, 6, col, 6, 0.2, 0.8);
      let cur = e, px = t.x, py = my, pz = t.z, dmg = t.dmg;
      for (let n = 0; n < t.chain; n++) {
        jag(px, py, pz, cur.x, cur.cy, cur.z, 0.16 + t.lv * 0.06, col, 0.13);
        burst(cur.x, cur.cy, cur.z, 4, col, 7, 0.25);
        px = cur.x; py = cur.cy; pz = cur.z;
        hurt(cur, dmg, { armor: true }); dmg *= 0.8;
        let nx = null, nd = 7.5;
        for (const o of foes) { if (!canHit(t, o) || hit.includes(o)) continue; const dd = Math.hypot(o.x - px, o.z - pz); if (dd < nd) { nd = dd; nx = o; } }
        if (!nx) break;
        hit.push(nx); cur = nx;
      }
      sfx.zap();
    }
  }
}
function updateShots(dt) {
  for (const s of shots) {
    if (s.kind === 'arrow') {
      if (s.e.alive) { s.tx = s.e.x; s.ty = s.e.cy; s.tz = s.e.z; }
      const dx = s.tx - s.x, dz = s.tz - s.z, dy = s.ty - s.y, d = Math.hypot(dx, dy, dz), step = 62 * dt;
      if (d <= step + 0.8) { s.dead = true; if (s.e.alive) { hurt(s.e, s.dmg, { armor: true }); spark(s.tx, s.ty, s.tz, rand(-4, 4), rand(2, 6), rand(-4, 4), [1, 2.4, 1.2], 0.25); } }
      else { s.x += dx / d * step; s.y += dy / d * step; s.z += dz / d * step; }
    } else {
      s.t += dt;
      const k = Math.min(1, s.t / s.T);
      s.x = s.x0 + (s.tx - s.x0) * k; s.z = s.z0 + (s.tz - s.z0) * k; s.y = s.y0 * (1 - k) + Math.sin(k * Math.PI) * s.hi;
      spark(s.x, s.y, s.z, rand(-1, 1), rand(0, 2), rand(-1, 1), [1.6, 0.8, 0.25], s.big ? 0.6 : 0.35, -3);
      if (k >= 1) {
        s.dead = true; splash(s.tx, s.tz, s.aoe, s.dmg, { ground: true });
        burst(s.tx, 0.6, s.tz, s.big ? 60 : 22, [2.6, 1.3, 0.4], s.big ? 18 : 12, s.big ? 0.6 : 0.4); addRing(s.tx, s.tz, s.aoe + 1.5, 26, [1.4, 0.7, 0.2]);
        if (s.big) { addRing(s.tx, s.tz, s.aoe * 1.8, 40, [1.8, 0.8, 0.2]); orbs.push({ x: s.tx, y: 0.8, z: s.tz, r0: 0.5, r1: s.aoe * 0.8, t: 0, life: 0.35, col: [1.6, 0.7, 0.15] }); pillar(s.tx, s.tz, 1.6, 12, [2.4, 1.0, 0.2], 0.4); shake = Math.max(shake, 0.6); sfx.boom(false); }
      }
    }
  }
  shots = shots.filter((s) => !s.dead);
}

// ---------- 궁극기 ----------
const ultPow = () => hpMul(Math.max(1, waveN)) * Math.sqrt(MAP.hp);
const track = (name) => ({ name, n: 0 });
function report(tr) { if (tr.n > 0 && state === 'play') { banner(tr.name + ' · 처치 ' + tr.n, 2, 'big'); if (tr.n >= 15) say(tr.n >= 40 ? '대승리' : '멋지다', 1); } }
function shockAt(x, z, str = 1, life = 0.8) { shock = { x, z, t: 0, life, str }; }
function impactFrame(ms = 70) { invUntil = performance.now() + ms; }
function pillar(x, z, r, h, col, life = 0.6) { if (pillars.length < 86) pillars.push({ x, z, r, h: Math.min(h, 34) * (0.8 + Math.random() * 0.4), col, t: 0, life }); }   // 너무 높으면 카메라에 걸림
function rune(x, y, z, r, col, life, spin) { const o = { x, y, z, r, col, life, spin, t: 0 }; if (runes.length >= 8) runes.shift(); runes.push(o); return o; }
function look(x, z, k, rate = 4) { focusX = x; focusZ = z - CAM_Z; zoomTo = k; zoomRate = rate; }
function cutIn(i) {                                             // 화면을 가로지르는 스킬 이름
  const c = $('cut');
  c.style.setProperty('--c', ULTS[i].col); c.firstChild.textContent = ULTS[i].name;
  c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
}
function castUlt(i, x, z) {
  if (state !== 'play' || ultCd[i] > 0) { if (state === 'play') sfx.deny(); return false; }
  ultCd[i] = ULTS[i].cd;
  cutIn(i); sfx.cast(); say(ULT_LINE[i], 3); slowT = 0.32; slowK = 0.12;              // 시전 시 잠깐 멈칫
  [castMeteor, castStorm, castFrost, castJudge, castHole, castBlades][i](clamp(x, -HX, HX), clamp(z, -HZ, HZ));
  return true;
}
// Q 운석 낙하: 마법진 조준 → 거대 운석 낙하 → 부서진 별똥비 → 여진의 불기둥
function impact(x, z, R, dmg, tr, big) {
  for (const e of foes) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d <= R + e.r) hurt(e, dmg * (d < R * 0.5 ? 1 : 1 - 0.5 * (d - R * 0.5) / (R * 0.5 + e.r)), { ult: tr, fx: x, fz: z });
  }
  const s = big ? 1 : 0.4;
  burst(x, 0.8, z, 220 * s, [2.6, 1.0, 0.2], 32 * (big ? 1 : 0.6), 0.9, 0.7);
  burst(x, 0.8, z, 110 * s, [3.4, 2.6, 1.0], 14, 0.7, 3.4);
  burst(x, 0.5, z, 70 * s, [0.9, 0.25, 0.1], 22, 1.3, 1.3, 26);
  addRing(x, z, R * 1.8, 46, [2.4, 0.9, 0.2]); addRing(x, z, R * 1.2, 24, [2.6, 2.0, 0.6]);
  orbs.push({ x, y: 1, z, r0: 1, r1: R * 0.95, t: 0, life: 0.42, col: [2.6, 1.1, 0.25] });
  pillar(x, z, R * 0.45, big ? 80 : 26, [2.6, 1.0, 0.2], big ? 0.8 : 0.4);
  if (big) {
    addRing(x, z, R * 3.4, 72, [1.2, 0.3, 0.1]); addRing(x, z, R * 5, 110, [0.8, 0.25, 0.1]);
    pillar(x, z, R * 0.2, 90, [4, 3.2, 2], 0.6);
    orbs.push({ x, y: 1, z, r0: 0.5, r1: R * 0.55, t: 0, life: 0.6, col: [4, 3.4, 2.2] });
    orbs.push({ x, y: 1, z, r0: 2, r1: R * 1.5, t: 0, life: 0.7, col: [0.6, 0.2, 0.05] });
    for (let i = 0; i < 16; i++) {                               // 지면 균열, 계속 붉게 빛남
      const a = i / 16 * Math.PI * 2 + rand(0.3), len = R * rand(1.1, 2.1);
      jag(x, 0.15, z, x + Math.cos(a) * len, 0.15, z + Math.sin(a) * len, 0.55, [3, 1.1, 0.2], rand(1.8, 3), 0.13);
    }
    burns.push({ x, z, r: R * 0.85, t: 0, life: 4.5, tick: 0, dmg: dmg * 0.07, tr });
    for (let i = 0; i < 20; i++) after(0.4 + i * 0.2, () => { for (let k = 0; k < 6; k++) { const a = rand(6.28), d = rand(R * 0.9); spark(x + Math.cos(a) * d, 0.2, z + Math.sin(a) * d, rand(-1, 1), rand(3, 9), rand(-1, 1), [3, rand(0.8, 1.8), 0.2], rand(0.8, 1.6), -1.5); } });   // 구덩이 속 잔불
    marks.push({ x, z, r: R * 0.85, t: 0, life: 4.5, col: [1.0, 0.3, 0.05], op: 0.35 });
    flash = Math.max(flash, 0.5); flashC.set(1, 0.85, 0.6); shake = Math.max(shake, 4.5); ab = Math.max(ab, 0.14); glow = 1; slowT = 0.22; slowK = 0.08;
    shockAt(x, z, 1.5, 0.9); impactFrame(80); look(x, z, 0, 7);
  } else { shake = Math.max(shake, 1.1); flash = Math.max(flash, 0.1); }
  sfx.boom(big);
}
function castMeteor(x, z) {
  const tr = track('운석 낙하'), dmg = 230 * ultPow();
  rune(x, 0.12, z, 11, [2.4, 0.6, 0.15], 1.25, 3);
  marks.push({ x, z, r: 9, t: 0, life: 1.05, col: [1.6, 0.4, 0.1], op: 0.22, pulse: true });
  meteors.push({ sx: x + 52, sy: 90, sz: z - 30, tx: x, tz: z, t: 0, dur: 1.05, size: 4.2, hit: () => impact(x, z, 9, dmg, tr, true) });
  sfx.meteor(); darkTo = 0.6; look(x, z, 1, 3.5); after(1.5, () => { darkTo = 0; });
  for (let i = 0; i < 14; i++) after(1.25 + i * 0.1, () => {
    const a = rand(Math.PI * 2), d = rand(5, 17), mx = clamp(x + Math.cos(a) * d, -HX, HX), mz = clamp(z + Math.sin(a) * d, -HZ, HZ);
    marks.push({ x: mx, z: mz, r: 4.5, t: 0, life: 0.45, col: [1.6, 0.5, 0.1], op: 0.25 });
    meteors.push({ sx: mx + 26, sy: 48, sz: mz - 15, tx: mx, tz: mz, t: 0, dur: 0.45, size: 1.4, hit: () => impact(mx, mz, 4.5, dmg * 0.45, tr, false) });
  });
  after(3.4, () => {                                             // 여진: 균열에서 불기둥이 한 바퀴 솟음
    shake = Math.max(shake, 2.2); shockAt(x, z, 0.8, 0.7); sfx.boom(false); addRing(x, z, 30, 50, [2.4, 0.9, 0.2]);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, px = x + Math.cos(a) * 12, pz = z + Math.sin(a) * 12;
      after(i * 0.03, () => { pillar(px, pz, 2.6, 46, [2.8, 1.0, 0.2], 0.7); burst(px, 0.5, pz, 30, [3.2, 1.4, 0.3], 16, 0.7, 2.6); splash(px, pz, 5, dmg * 0.25, { ult: tr, fx: x, fz: z }); sfx.det(); });
    }
  });
  after(6, () => report(tr));
}
// E 혹한의 영역: 얼음 고리가 전장을 쓸고 길 전체에 얼음 가시가 돋아 적이 하나씩 얼어붙음; 끝나면 전부 산산조각
function castFrost(x, z) {
  const tr = track('혹한의 영역'), pw = ultPow(), id = time, DUR = 3.8;
  frost = { x, z, t: 0, dur: DUR, id };
  floorU.uFrostC.value.set(x, z);
  flash = Math.max(flash, 0.3); flashC.set(0.6, 0.85, 1); tintC.set(0.6, 0.85, 1.25); tintK = 0.5; tintTo = 0.2; ab = Math.max(ab, 0.08); glow = 0.8; shake = Math.max(shake, 2);
  shockAt(x, z, 1.1, 0.9); look(x, z, 0.7, 9); after(0.3, () => look(x, z, 0, 3));
  rune(x, 0.14, z, 24, [0.5, 1.4, 2.4], DUR, 0.7); rune(x, 0.16, z, 9, [1.2, 2.2, 3], DUR, -1.6);
  addRing(x, z, 150, 110, [0.6, 1.4, 2.2]); addRing(x, z, 150, 80, [0.3, 0.8, 1.4]);
  orbs.push({ x, y: 1, z, r0: 1, r1: 10, t: 0, life: 0.45, col: [0.15, 0.5, 1.0] });
  pillar(x, z, 2.4, 30, [0.5, 1.4, 2.6], 0.7);
  burst(x, 1, z, 140, [0.9, 1.9, 2.8], 34, 0.9, 0.5, 4);
  [[6, 9], [11, 14], [17, 20]].forEach(([rad, n], k) => after(0.06 + k * 0.09, () => {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k * 0.4; spikes.push({ x: x + Math.cos(a) * rad, z: z + Math.sin(a) * rad, h: rand(5, 8) + k * 1.5, r: rand(1.0, 1.6), t: 0, life: DUR - 0.4, rot: rand(6), lean: rand(-0.25, 0.25) }); }
    shake = Math.max(shake, 1);
  }));
  for (let pi = 0; pi < paths.length; pi++) for (let d = 3; d < (pi ? paths[pi].own : paths[pi].len - 8); d += 5) {   // 길 양옆의 얼음 가시가 얼음 고리를 따라 차례로 솟음
    const p = pathAt(d, pi), px = p.x, pz = p.z, nx = -p.dz, nz = p.dx, wait = Math.hypot(px - x, pz - z) / 110 + 0.05;
    after(wait, () => { for (const sd of [-1, 1]) spikes.push({ x: px + nx * sd * 2.8 + rand(-0.4, 0.4), z: pz + nz * sd * 2.8 + rand(-0.4, 0.4), h: rand(3, 6), r: rand(0.7, 1.1), t: 0, life: DUR - wait, rot: rand(6), lean: rand(-0.3, 0.3) }); });
  }
  for (const e of foes) if (e.alive) after(Math.hypot(e.x - x, e.z - z) / 110, () => {
    if (!e.alive) return;
    e.frozenT = e.boss ? 1.8 : DUR - Math.hypot(e.x - x, e.z - z) / 110; e.frostId = id;
    hurt(e, 45 * pw, { ult: tr, ice: true });
    if (spikes.length < 480) spikes.push({ x: e.x, z: e.z, h: e.h * 1.5 + 1, r: e.r * 1.3, t: 0, life: e.frozenT, rot: rand(6), lean: 0, on: e });
    burst(e.x, e.h * 0.5, e.z, 10, [1.4, 2.6, 3.4], 8, 0.5);
  });
  sfx.freeze();
  after(DUR, () => {                                             // 얼음 파편
    let n = 0;
    for (const e of foes) if (e.alive && e.frostId === id) {
      if (n++ < 16) pillar(e.x, e.z, 1.6, 30, [0.7, 1.7, 2.8], 0.5);
      burst(e.x, e.h * 0.6, e.z, 22, [1.6, 2.8, 3.6], 16, 0.6); hurt(e, 70 * pw, { ult: tr, ice: true });
    }
    for (const s of spikes) if (!s.on) burst(s.x, s.h * 0.5, s.z, 8, [1.4, 2.6, 3.4], 16, 0.7, 1.4);
    flash = Math.max(flash, 0.4); flashC.set(0.7, 0.9, 1); shake = Math.max(shake, 3); ab = Math.max(ab, 0.1); shockAt(x, z, 1.4, 0.9); impactFrame(60);
    addRing(x, z, 150, 130, [0.8, 1.6, 2.4]);
    sfx.shatter(); tintTo = 0;
    after(0.6, () => report(tr));
  });
}
// R 천공의 심판: 마법진 충전 → 빛기둥이 크리스탈에서 길을 따라 입구까지 역주 → 길 전체 연쇄 폭발
function castJudge() {
  judge = { t: 0, r: 0, id: time + 1, tr: track('천공의 심판'), fired: false, ringT: 0, dmg: 340 * ultPow(), sky: null };
  darkTo = 1; sfx.charge(); tintC.set(1.3, 1.0, 0.6);
  rune(CRYSTAL.x, 0.14, CRYSTAL.z, 17, [2.6, 1.8, 0.5], 1.4, 2.4); rune(CRYSTAL.x, 12, CRYSTAL.z, 9, [3, 2.4, 1], 1.4, -4);
  look(CRYSTAL.x, CRYSTAL.z, 0.9, 3);
}
function updateJudge(dt) {
  const j = judge;
  j.t += dt;
  if (!j.fired) {
    const k = j.t / 1.0;
    for (let i = 0; i < 10; i++) { const a = rand(Math.PI * 2), r = rand(8, 24); spark(CRYSTAL.x + Math.cos(a) * r, rand(1, 18), CRYSTAL.z + Math.sin(a) * r, -Math.cos(a) * r * 2.2, rand(2, 8), -Math.sin(a) * r * 2.2, [3, 2.2, 0.8], 0.42, 0); }
    bolt(CRYSTAL.x, 7.5, CRYSTAL.z, CRYSTAL.x, 130, CRYSTAL.z, 0.3 + k * 1.6, [4, 3, 1.4]);
    if (Math.random() < 0.25) { const a = rand(Math.PI * 2); jag(CRYSTAL.x, 8, CRYSTAL.z, CRYSTAL.x + Math.cos(a) * 14, 0.2, CRYSTAL.z + Math.sin(a) * 14, 0.3, [4, 3, 1.2], 0.12, 0.14); }
    if (rings.length < 14 && Math.random() < 0.3) addRing(CRYSTAL.x, CRYSTAL.z, 16, 30, [1.4, 1.0, 0.3]);
    shake = Math.max(shake, 0.4 + k * 0.8);
    if (j.t >= 1.0) {
      j.fired = true; roadGlowTo = 1; tintK = 0.35; tintTo = 0.35;
      flash = 0.6; flashC.set(1, 0.92, 0.7); shake = 4.5; ab = 0.16; glow = 1; sfx.judge(); slowT = 0.25; slowK = 0.1;
      shockAt(CRYSTAL.x, CRYSTAL.z, 1.6, 1.0); impactFrame(80);
      j.sky = rune(CRYSTAL.x, 30, CRYSTAL.z, 15, [3, 2.2, 0.8], 99, 2.2);
      for (let i = 0; i < 3; i++) addRing(CRYSTAL.x, CRYSTAL.z, 50 + i * 30, 50 + i * 25, [2.4, 1.6, 0.5]);
      burst(CRYSTAL.x, 2, CRYSTAL.z, 300, [3.4, 2.4, 0.8], 36, 1.0, 1.4);
    }
    return;
  }
  const maxLen = Math.max(...paths.map((P) => P.len));
  j.r += maxLen / 2.7 * dt;                                      // r: 빛기둥이 크리스탈에서 얼마나 멀리 훑었나; 합류 구간은 본선의 빛기둥만 사용
  j.ringT -= dt;
  const ring = j.ringT <= 0;
  if (ring) j.ringT = 0.09;
  let lead = true;
  beams.forEach((bm, pi) => {
    const P = paths[pi], d = P ? P.len - j.r : -99;
    bm.visible = !!P && d > -4 && (pi === 0 || d <= P.own);
    if (!bm.visible) return;
    const p = pathAt(Math.max(0, d), pi), bx = p.x, bz = p.z;
    bm.position.set(bx, 0, bz);
    if (lead) { lead = false; if (j.sky) { j.sky.x = bx; j.sky.z = bz; } look(bx, bz, 0.5, 3); }
    for (const e of foes) {
      if (!e.alive || e.judgeId === j.id || Math.hypot(e.x - bx, e.z - bz) > 6.5 + e.r) continue;
      e.judgeId = j.id;
      jag(bx, rand(6, 20), bz, e.x, e.h * 0.5, e.z, 0.35, [4, 3, 1.2], 0.18);
      burst(e.x, e.h * 0.5, e.z, 16, [3.4, 2.4, 0.8], 14, 0.5, 1.6);
      hurt(e, j.dmg * (e.boss ? 1.6 : 1), { ult: j.tr, fx: bx, fz: bz });
    }
    for (let i = 0; i < 10; i++) { const a = rand(Math.PI * 2), r = rand(0, 5); spark(bx + Math.cos(a) * r, 0.3, bz + Math.sin(a) * r, Math.cos(a) * rand(4, 16), rand(10, 46), Math.sin(a) * rand(4, 16), [3.4, 2.3 + rand(0.8), 0.7], rand(0.4, 0.9), 22); }
    if (ring) { if (rings.length < 18) addRing(bx, bz, 15, 34, [2.2, 1.4, 0.4]); if (marks.length < 22) marks.push({ x: bx, z: bz, r: 4.2, t: 0, life: 2.2, col: [1.6, 0.9, 0.2], op: 0.5 }); }
    if (Math.random() < 0.6) { const a = rand(Math.PI * 2), r = rand(7, 18); jag(bx, rand(14, 40), bz, bx + Math.cos(a) * r, 0.2, bz + Math.sin(a) * r, 0.28, [4, 3, 1.4], 0.12, 0.14); }
  });
  shake = Math.max(shake, 1.3); glow = Math.max(glow, 1);
  if (j.r >= maxLen + 4) {
    const tr = j.tr, dmg = j.dmg;
    let maxN = 0;
    for (const b of beams) b.visible = false;
    if (j.sky) j.sky.life = j.sky.t + 0.35;
    judge = null; look(0, 0, 0.25, 3);
    flash = Math.max(flash, 0.35); flashC.set(1, 0.92, 0.7);
    paths.forEach((P, pi) => {                                   // 연쇄 폭발: 각 입구에서 크리스탈까지 줄줄이 폭발
      const N = Math.floor(((pi ? P.own : P.len) - 6) / 8);
      maxN = Math.max(maxN, N);
      for (let i = 0; i <= N; i++) {
        const q = pathAt(i * 8, pi), px = q.x, pz = q.z;
        after(0.2 + i * 0.045, () => {
          pillar(px, pz, 3.4, 64, [2.8, 1.8, 0.5], 0.55); pillar(px, pz, 1.3, 70, [4, 3.4, 2.2], 0.4);
          if (rings.length < 18) addRing(px, pz, 13, 36, [2.2, 1.4, 0.4]);
          burst(px, 0.5, pz, 36, [3.4, 2.4, 0.8], 18, 0.7, 2.4);
          splash(px, pz, 7, dmg * 0.4, { ult: tr, fx: px, fz: pz });
          shake = Math.max(shake, 1.6); flash = Math.max(flash, 0.08); sfx.det();
        });
      }
    });
    after(0.2 + maxN * 0.045 + 0.2, () => {                       // 마무리: 크리스탈 위에 섬광 한 발
      darkTo = 0; roadGlowTo = 0; tintTo = 0; look(0, 0, 0, 3);
      flash = Math.max(flash, 0.55); flashC.set(1, 0.92, 0.7); shake = Math.max(shake, 3.5); ab = Math.max(ab, 0.12);
      shockAt(CRYSTAL.x, CRYSTAL.z, 1.5, 1.0); impactFrame(60);
      pillar(CRYSTAL.x, CRYSTAL.z, 6, 90, [2.8, 1.9, 0.6], 0.9);
      for (let i = 0; i < 3; i++) addRing(CRYSTAL.x, CRYSTAL.z, 70 + i * 40, 60 + i * 30, [2.4, 1.6, 0.5]);
      burst(CRYSTAL.x, 3, CRYSTAL.z, 320, [3.4, 2.4, 0.8], 40, 1.2, 1.2);
      orbs.push({ x: CRYSTAL.x, y: 4, z: CRYSTAL.z, r0: 2, r1: 20, t: 0, life: 0.6, col: [0.9, 0.6, 0.2] });
      sfx.boom(true);
      after(0.5, () => report(tr));
    });
  }
}
// W 벼락 난무: 하늘이 어두워지고 낙뢰가 적 무리에 연달아 떨어지며 적 사이를 튐, 마지막 천둥번개는 가장 강한 적에게
function thunder(x, z, dmg, tr, big) {
  const sx = x + rand(-9, 9), sz = z - rand(4, 16), c = [2.4, 1.9, 4];
  jag(sx, 74, sz, x, 0.2, z, big ? 1.8 : 0.8, c, big ? 0.4 : 0.2, 0.05); jag(sx, 74, sz, x, 0.2, z, big ? 0.7 : 0.3, [4, 4, 4.4], big ? 0.3 : 0.14, 0.03);
  pillar(x, z, big ? 2.2 : 0.9, big ? 34 : 22, c, big ? 0.5 : 0.22);
  if (rings.length < 16) addRing(x, z, big ? 20 : 8, big ? 44 : 28, [1.1, 0.8, 2.2]);
  burst(x, 0.6, z, big ? 120 : 22, [2.6, 2.2, 4], big ? 26 : 13, 0.5, 1.4);
  if (marks.length < 22) marks.push({ x, z, r: big ? 7 : 3, t: 0, life: 0.9, col: [0.7, 0.5, 1.6], op: 0.4 });
  const R = big ? 9 : 4.5;
  let hops = 0;
  for (const e of foes) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d <= R + e.r) { hurt(e, dmg / (1 + 0.35 * e.zapN), { ult: tr, fx: x, fz: z }); e.zapN++; if (e.alive && !e.def.tough) e.holdT = Math.max(e.holdT, 0.45); }   // 같은 적이 계속 맞으면 피해가 줄어듦
    else if (!big && d < 11 && hops < 3) { hops++; jag(x, 1.5, z, e.x, e.cy, e.z, 0.24, [2, 1.5, 3.4], 0.16); hurt(e, dmg * 0.5 / (1 + 0.35 * e.zapN), { ult: tr, fx: x, fz: z }); }
  }
  flash = Math.max(flash, big ? 0.5 : 0.1); flashC.set(0.8, 0.75, 1); shake = Math.max(shake, big ? 4 : 0.9);
  if (big) {
    shockAt(x, z, 1.5, 0.9); impactFrame(70); ab = Math.max(ab, 0.14); sfx.boom(true);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + rand(0.3), r = rand(10, 18); jag(x, 0.2, z, x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r, 0.4, c, rand(0.5, 1), 0.14); }
  }
  sfx.thunder();
}
function castStorm() {
  storm = { t: 0, dur: 4.4, next: 0.55, tr: track('벼락 난무'), dmg: 60 * ultPow() };
  for (const e of foes) e.zapN = 0;
  darkTo = 0.8; tintC.set(0.78, 0.72, 1.35); tintK = 0.15; tintTo = 0.4; sfx.storm(); look(0, 0, 0.3, 2);
  rune(0, 0.15, 0, 42, [0.32, 0.22, 0.85], 4.6, 0.4);
}
function updateStorm(dt) {
  const s = storm;
  s.t += dt; s.next -= dt;
  for (let i = 0; i < 5; i++) spark(rand(-HX, HX), rand(26, 36), rand(-HZ, HZ), rand(-8, 8), rand(-1, 1), rand(-3, 3), [0.5, 0.4, 1.1], rand(0.3, 0.7), 0);   // 구름 속의 전광
  const live = foes.filter((e) => e.alive);
  if (s.t >= s.dur) {
    let best = null;
    for (const e of live) if (!best || e.hp + e.shield > best.hp + best.shield) best = e;
    thunder(best ? best.x : CRYSTAL.x - 14, best ? best.z : CRYSTAL.z, s.dmg * 4, s.tr, true);
    storm = null; darkTo = 0; tintTo = 0; look(0, 0, 0, 3);
    after(0.7, () => report(s.tr));
    return;
  }
  if (s.next > 0) return;
  s.next = 0.12;
  if (live.length) {                                             // 무작위 셋 중 가장 적게 맞은 적에게 떨어뜨림
    let e = live[Math.floor(rand(live.length))];
    for (let i = 0; i < 2; i++) { const o = live[Math.floor(rand(live.length))]; if (o.zapN < e.zapN) e = o; }
    thunder(e.x, e.z, s.dmg, s.tr, false);
  } else { const pi = Math.floor(rand(paths.length)), p = pathAt(rand(paths[pi].len), pi); thunder(p.x, p.z, s.dmg, s.tr, false); }
}
// T 공허의 특이점: 마우스 위치에 블랙홀을 열어 주변 적을 끌어당겨 묶고, 마지막에 붕괴 폭발
function castHole(x, z) {
  hole = { x, z, t: 0, dur: 3.4, R: 16, tr: track('공허의 특이점'), dmg: 300 * ultPow() };
  darkTo = 0.75; tintC.set(0.85, 0.6, 1.35); tintK = 0.1; tintTo = 0.4; look(x, z, 0.9, 3); sfx.hole();
  rune(x, 0.13, z, 16, [0.7, 0.3, 1.7], 3.5, -2.5); rune(x, 0.16, z, 8, [0.5, 0.25, 1.1], 3.5, 5);
  addRing(x, z, 30, 50, [0.8, 0.3, 1.8]); shockAt(x, z, 0.8, 0.6); shake = Math.max(shake, 1.5);
}
function updateHole(dt) {
  const h = hole;
  h.t += dt;
  for (let i = 0; i < 14; i++) {                                 // 빨려 들어가는 빛먼지, 소용돌이치며 들어감
    const a = rand(Math.PI * 2), r = rand(5, h.R + 4), sp = rand(14, 26), cs = Math.cos(a), sn = Math.sin(a);
    spark(h.x + cs * r, rand(0.5, 9), h.z + sn * r, -cs * sp + sn * sp * 0.7, rand(-1, 3), -sn * sp - cs * sp * 0.7, [1.3, 0.6, 2.6], Math.max(0.1, (r - 4.5) / sp), 0);
  }
  if (Math.random() < 0.3) { const a = rand(Math.PI * 2), r = rand(6, h.R); jag(h.x + Math.cos(a) * 3.2, 4.2, h.z + Math.sin(a) * 3.2, h.x + Math.cos(a) * r, 0.3, h.z + Math.sin(a) * r, 0.16, [1.6, 0.8, 3.2], 0.1, 0.16); }
  shake = Math.max(shake, 0.5 + Math.min(1, h.t / h.dur) * 0.9);
  for (const e of foes) {
    if (!e.alive || Math.hypot(e.bx - h.x, e.bz - h.z) > h.R + e.r) continue;
    const pull = (e.def.tough ? 0.3 : 0.88) * Math.min(1, h.t / 0.9), q = Math.min(1, dt * 5);
    e.ox += ((h.x - e.bx) * pull - e.ox) * q; e.oz += ((h.z - e.bz) * pull - e.oz) * q;
    if (!e.def.tough) e.holdT = Math.max(e.holdT, 0.12);
    e.x = e.bx + e.ox; e.z = e.bz + e.oz;
    hurt(e, h.dmg * 0.1 * dt, { ult: h.tr, quiet: true, fx: h.x, fz: h.z });
  }
  if (h.t < h.dur) return;
  const x = h.x, z = h.z, c = [1.8, 0.9, 3.4];                   // 붕괴
  hole = null;
  for (const e of foes) if (e.alive && Math.hypot(e.x - x, e.z - z) <= h.R * 0.6 + e.r) hurt(e, h.dmg, { ult: h.tr, fx: x, fz: z });
  flash = Math.max(flash, 0.5); flashC.set(0.8, 0.6, 1); shake = Math.max(shake, 4.5); ab = Math.max(ab, 0.16); shockAt(x, z, 1.7, 1.0); impactFrame(80);
  pillar(x, z, 3, 34, [1.6, 0.7, 3], 0.7); pillar(x, z, 1, 34, [3.4, 3, 4], 0.45);
  orbs.push({ x, y: 4, z, r0: 1, r1: 13, t: 0, life: 0.5, col: [1.2, 0.5, 2.4] }); orbs.push({ x, y: 4, z, r0: 0.5, r1: 6, t: 0, life: 0.6, col: [3, 2.6, 3.6] });
  addRing(x, z, 24, 44, c); addRing(x, z, 44, 80, [0.9, 0.4, 1.8]); addRing(x, z, 14, 20, [2.6, 2.2, 3.2]);
  burst(x, 4, z, 220, [0.9, 0.45, 1.7], 40, 1.0, 0.6); burst(x, 4, z, 60, [2.2, 1.9, 2.8], 18, 0.7, 1.2);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + rand(0.3), r = rand(12, 22); jag(x, 0.2, z, x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r, 0.45, c, rand(0.6, 1.2), 0.13); }
  darkTo = 0; tintTo = 0; look(x, z, 0, 6); sfx.boom(true); sfx.shatter();
  after(0.6, () => report(h.tr));
}
// G 유성 검진: 빛의 검 열 자루가 마우스 위치에 원을 그리고 차례로 내리꽂힘, 마지막 거대 검이 중심에 떨어짐
function bladeHit(x, z, R, dmg, tr, big) {
  splash(x, z, R, dmg, { ult: tr, fx: x, fz: z });
  pillar(x, z, big ? 2 : 0.8, big ? 34 : 20, big ? [0.5, 1.2, 1.9] : [0.7, 1.7, 2.6], big ? 0.7 : 0.3);
  if (rings.length < 17) addRing(x, z, R + 3, 30, [0.5, 1.2, 1.9]);
  burst(x, 0.5, z, big ? 110 : 26, big ? [0.45, 0.95, 1.4] : [1.2, 2.4, 3.4], big ? 38 : 14, big ? 0.9 : 0.45, big ? 0.6 : 1.4);
  if (marks.length < 22) marks.push({ x, z, r: R * 0.7, t: 0, life: 1.2, col: [0.4, 1.0, 1.6], op: big ? 0.16 : 0.3 });
  shake = Math.max(shake, big ? 4.2 : 1.0); sfx.blade(big);
  if (!big) return;
  flash = Math.max(flash, 0.18); flashC.set(0.7, 0.95, 1); ab = Math.max(ab, 0.12); shockAt(x, z, 1.6, 0.9); impactFrame(70); sfx.boom(true);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, L = i % 2 ? 15 : 28; jag(x, 0.2, z, x + Math.cos(a) * L, 0.2, z + Math.sin(a) * L, i % 2 ? 0.4 : 0.8, [0.9, 1.8, 2.6], i % 2 ? 0.5 : 0.8, 0.02); }   // 십자 빛 자국
  addRing(x, z, 40, 70, [0.6, 1.4, 2.2]); addRing(x, z, 22, 36, [1.4, 2.4, 3]);
  orbs.push({ x, y: 2, z, r0: 1, r1: R * 0.6, t: 0, life: 0.45, col: [0.1, 0.3, 0.55] });
}
function castBlades(x, z) {
  const tr = track('유성 검진'), dmg = 150 * ultPow(), N = 10, R = 11, tEnd = 0.55 + N * 0.11 + 0.3, tAll = tEnd + 1.1;
  rune(x, 0.13, z, R + 4, [0.3, 0.8, 1.3], tAll, 1.5); rune(x, 0.16, z, 5, [0.35, 0.8, 1.2], tAll, -4);
  darkTo = 0.6; look(x, z, 0.9, 3.5); sfx.blades();
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, bx = x + Math.cos(a) * R, bz = z + Math.sin(a) * R, wait = 0.55 + i * 0.11;
    blades.push({ x: bx, z: bz, y0: 15, size: 1.5, t: 0, wait, fall: 0.14, stay: tAll - wait - 0.14, rot: -a, hit: () => bladeHit(bx, bz, 5.5, dmg, tr, false) });
  }
  blades.push({ x, z, y0: 24, size: 2.4, t: 0, wait: tEnd, fall: 0.2, stay: tAll - tEnd - 0.2, rot: 0, big: true, hit: () => bladeHit(x, z, R + 4, dmg * 2.4, tr, true) });
  after(tAll, () => { darkTo = 0; look(x, z, 0, 4); });
  after(tAll + 0.5, () => report(tr));
}

// ---------- 자동 플레이(테스트용) ----------
const AUTO_ORDER = ['arrow', 'arrow', 'cannon', 'frost', 'arrow', 'tesla', 'flame', 'sniper', 'prism', 'mortar', 'tesla', 'frost', 'beacon', 'cannon', 'prism', 'sniper', 'arrow'];
function autoPlay() {
  const type = AUTO_ORDER[towers.length % AUTO_ORDER.length];
  const ups = towers.filter((t) => t.lv < 3).sort((a, b) => upCost(a) - upCost(b));
  if (autoFlip && ups.length) { if (gold >= upCost(ups[0])) { upgrade(ups[0], true); autoFlip = false; } }
  else if (towers.length < 44) { if (gold >= TOWERS[type].cost) { const s = SPOTS.find((p) => !cellT[p.r * COLS + p.c]); if (s && build(type, s.c, s.r, true)) autoFlip = towers.length >= 4; } }
  else autoFlip = true;
  if (!auto.ults) return;
  const live = foes.filter((e) => e.alive);
  if (live.length < 6) return;
  let best = live[0], bn = 0;
  for (const a of live) { let n = 0; for (const b of live) if (Math.hypot(a.x - b.x, a.z - b.z) < 9) n++; if (n > bn) { bn = n; best = a; } }
  if (ultCd[0] <= 0) castUlt(0, best.x, best.z);
  else if (ultCd[5] <= 0) castUlt(5, best.x, best.z);
  else if (live.length >= 8 && ultCd[4] <= 0) castUlt(4, best.x, best.z);
  else if (live.length >= 8 && ultCd[1] <= 0) castUlt(1, 0, 0);
  else if (live.length >= 10 && ultCd[2] <= 0) castUlt(2, live[0].x, live[0].z);
  else if (live.length >= 12 && ultCd[3] <= 0) castUlt(3, 0, 0);
}

// ---------- 매 프레임 갱신 ----------
function updateFx(dt) {
  for (const r of rings) r.r += r.speed * dt;
  rings = rings.filter((r) => r.r < r.max);
  for (const b of bolts) if (!b.one) b.life -= dt;
  bolts = bolts.filter((b) => b.one ? bolts.length < 600 : b.life > 0);
  for (const s of spikes) { s.t += dt; if (s.on && !s.on.alive) s.life = Math.min(s.life, s.t + 0.1); }
  spikes = spikes.filter((s) => s.t < s.life);
  for (const o of orbs) o.t += dt;
  orbs = orbs.filter((o) => o.t < o.life);
  for (const m of marks) m.t += dt;
  marks = marks.filter((m) => m.t < m.life);
  for (const m of meteors) {
    m.t += dt;
    const k = Math.min(1, m.t / m.dur), kk = k * k;
    m.x = m.sx + (m.tx - m.sx) * kk; m.y = m.sy * (1 - kk); m.z = m.sz + (m.tz - m.sz) * kk;
    const n = m.size > 2 ? 14 : 5;
    for (let i = 0; i < n; i++) spark(m.x + rand(-1, 1) * m.size, m.y + rand(-1, 1) * m.size, m.z + rand(-1, 1) * m.size, rand(-3, 3), rand(-2, 5), rand(-3, 3), [3.2, 1.2 + rand(1.2), 0.25], rand(0.3, 0.8), 2);
    if (k >= 1) { m.dead = true; m.hit(); }
  }
  meteors = meteors.filter((m) => !m.dead);
  for (const b of blades) { b.t += dt; if (!b.done && b.t >= b.wait + b.fall) { b.done = true; b.hit(); } }
  blades = blades.filter((b) => { if (b.t < b.wait + b.fall + b.stay) return true; burst(b.x, 2.5 * b.size, b.z, 20 * b.size, [1.2, 2.4, 3.4], 12, 0.5, 1.2); return false; });
  for (const b of burns) {
    b.t += dt; b.tick -= dt;
    for (let i = 0; i < 12; i++) { const a = rand(Math.PI * 2), r = Math.sqrt(Math.random()) * b.r; spark(b.x + Math.cos(a) * r, 0.2, b.z + Math.sin(a) * r, rand(-1, 1), rand(4, 11), rand(-1, 1), [3, 1.0 + rand(1), 0.2], rand(0.3, 0.7), -2); }
    if (b.tick <= 0) { b.tick = 0.4; splash(b.x, b.z, b.r, b.dmg, { ult: b.tr, quiet: true }); }
  }
  burns = burns.filter((b) => b.t < b.life);
  for (const p of pillars) p.t += dt;
  pillars = pillars.filter((p) => p.t < p.life);
  for (const g of gibs) { g.t += dt; g.vy -= 46 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; if (g.y < 0.3) g.t = g.life; }
  gibs = gibs.filter((g) => g.t < g.life);
  updateCoins(dt);
  for (const r of runes) r.t += dt;
  runes = runes.filter((r) => r.t < r.life);
  if (shock) { shock.t += dt; if (shock.t >= shock.life) shock = null; }
  zoom += (zoomTo - zoom) * Math.min(1, dt * zoomRate);
  if (frost) {
    frost.t += dt;
    if (frost.t < frost.dur) for (let i = 0; i < 6; i++) spark(rand(-HX, HX), rand(14, 30), rand(-HZ, HZ), rand(-2, 2), rand(-9, -4), rand(-1, 3), [0.8, 1.2, 1.6], rand(1.2, 2.2), 1);
    if (frost.t > frost.dur + 1) frost = null;
  }
  const kf = Math.min(1, dt * 5);
  flash = Math.max(0, flash - dt * 2.4); ab = Math.max(0, ab - dt * 0.12); glow = Math.max(0, glow - dt * 0.9);
  shake = Math.max(0, shake - dt * 3.2); hurtFx = Math.max(0, hurtFx - dt * 1.6);
  dark += (darkTo - dark) * kf; tintK += (tintTo - tintK) * Math.min(1, dt * 2); roadGlow += (roadGlowTo - roadGlow) * kf;
  const mo = TH.mote;                                            // 맵 위를 떠다니는 것들: 반딧불, 눈, 불티, 공허의 먼지
  if (Math.random() < mo.p) spark(rand(-HX, HX), rand(mo.y[0], mo.y[1]), rand(-HZ, HZ), rand(-0.6, 0.6), rand(mo.vy[0], mo.vy[1]), rand(-0.6, 0.6), mo.col, rand(mo.life[0], mo.life[1]), 0);
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    const j = i * 3;
    if (pLife[i] <= 0) { pPos[j + 1] = -999; continue; }
    pVel[j + 1] -= pGrav[i] * dt;
    pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
    if (pPos[j + 1] < 0.08) { pPos[j + 1] = 0.08; pVel[j + 1] *= -0.4; }
    const k = pLife[i] / pMaxL[i];
    pCol[j] = pBase[j] * k; pCol[j + 1] = pBase[j + 1] * k; pCol[j + 2] = pBase[j + 2] * k;
  }
}
function update(dt) {
  floorU.uTime.value += dt;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('center').textContent = ''; }
  if (state === 'paused') return;
  if (state !== 'play') { for (const tm of timers) tm.t -= dt; const due = timers.filter((tm) => tm.t <= 0); timers = timers.filter((tm) => tm.t > 0); due.forEach((tm) => tm.fn()); updateFx(dt); return; }
  if (slowT > 0) { slowT -= dt; dt *= slowK; }
  time += dt;
  for (let i = 0; i < ULTS.length; i++) { const was = ultCd[i]; ultCd[i] = Math.max(0, was - dt); if (was > 0 && ultCd[i] === 0) say(ULTS[i].name + ', 준비 완료', 0); }
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  beamN = 0; beamRamp = 0;
  for (const tm of timers) tm.t -= dt;
  if (timers.some((tm) => tm.t <= 0)) { const due = timers.filter((tm) => tm.t <= 0); timers = timers.filter((tm) => tm.t > 0); due.forEach((tm) => tm.fn()); }
  if (phase === 'prep') { nextT -= dt; if (nextT <= 0) startWave(); }
  else {
    waveT += dt;
    while (queue.length && queue[0].t <= waveT) { const q = queue.shift(); spawn(q.type, undefined, undefined, q.path); }
    if (!queue.length && !foes.length) {
      if (waveN >= waves.length) { endGame(true); return; }
      gold += 25 + waveN * 6; phase = 'prep'; nextT = 8;
      banner(waveN + ' 웨이브 클리어　+' + (25 + waveN * 6) + ' 골드', 1.6);
    }
  }
  for (const e of foes) {
    if (!e.alive) continue;
    if (e.flash > 0) e.flash -= dt;
    e.spin += dt * (e.frozenT > 0 ? 0 : 2);
    if (e.burnT > 0) {                                           // 화상
      e.burnT -= dt; hurt(e, e.burnD * dt, { quiet: true });
      if (!e.alive) continue;
      if (Math.random() < 0.35) spark(e.x + rand(-0.4, 0.4), e.cy, e.z + rand(-0.4, 0.4), rand(-1, 1), rand(3, 7), rand(-1, 1), [3, 1.2, 0.2], 0.35, -2);
      if (e.burnT <= 0) e.burnD = 0;
    }
    if (e.frozenT > 0) { e.frozenT -= dt; e.phased = false; continue; }
    if (e.holdT > 0) { e.holdT -= dt; place(e); continue; }       // 낙뢰에 마비됐거나 특이점에 붙잡힘
    if (e.ox || e.oz) { const k = Math.max(0, 1 - dt * 4); e.ox *= k; e.oz *= k; if (Math.abs(e.ox) + Math.abs(e.oz) < 0.05) e.ox = e.oz = 0; }
    if (e.def.phase) { e.phaseT -= dt; if (e.phaseT <= 0) { e.phased = !e.phased; e.phaseT = e.phased ? 1.6 : 3.2; burst(e.x, e.cy, e.z, 12, [0.9, 0.5, 2.2], 7, 0.4); } }
    let sp = e.speed;
    if (e.def.rage) { e.rage = 1 - e.hp / e.maxHp; sp *= 1 + e.rage * 1.4; if (e.rage > 0.35 && Math.random() < 0.35) spark(e.x, 0.3, e.z, rand(-2, 2), rand(2, 5), rand(-2, 2), [3, 0.5, 0.2], 0.3); }
    if (e.slowT > 0) { e.slowT -= dt; sp *= 1 - e.slowK; if (e.slowT <= 0) e.slowK = 0; }
    e.d += sp * dt; place(e);
    if (e.heal) { e.healT -= dt; if (e.healT <= 0) { e.healT = 2.2; if (rings.length < 12) addRing(e.x, e.z, 8, 16, [0.2, 1.0, 0.5]); for (const o of foes) if (o.alive && o !== e && Math.hypot(o.x - e.x, o.z - e.z) < 8) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.big ? 0.02 : 0.07)); } }
    if (e.def.stomp) {                                           // 지진수 발 구르기: 주변 타워 마비
      e.stompT -= dt;
      if (e.stompT <= 0) {
        e.stompT = 6.5;
        let any = false;
        for (const t of towers) if (Math.hypot(t.x - e.x, t.z - e.z) < 9.5) { t.stunT = 2.2; any = true; burst(t.x, t.def.my, t.z, 10, [2.4, 2, 0.5], 8, 0.4); }
        addRing(e.x, e.z, 9.5, 26, [1.6, 1.1, 0.3]); addRing(e.x, e.z, 6, 16, [1.2, 0.6, 0.2]); burst(e.x, 0.3, e.z, 40, [1.4, 1.0, 0.5], 14, 0.6);
        shake = Math.max(shake, 1.3); sfx.stomp();
        if (any) say('타워가 마비됐다', 1, 15000);
      }
    }
    if (e.d >= e.len - 3) leak(e);
    if (state !== 'play') break;
  }
  updateTowers(dt);
  updateShots(dt);
  if (judge) updateJudge(dt);
  if (storm) updateStorm(dt);
  if (hole) updateHole(dt);
  updateFx(dt);
  foes = foes.filter((e) => e.alive);
  if (auto) { autoT -= dt; if (autoT <= 0) { autoT = 0.4; autoPlay(); } }
}

// ---------- 입력 ----------
const mouse = new THREE.Vector2(9, 9), aim = new THREE.Vector3(999, 0, 999);
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let hoverC = -1, hoverR = -1, buildType = null, selected = null;
function updateAim() {
  ray.setFromCamera(mouse, camera);
  if (ray.ray.intersectPlane(ground, tmpV)) { aim.copy(tmpV); hoverC = Math.floor((aim.x + HX) / CS); hoverR = Math.floor((aim.z + HZ) / CS); }
}
const setMouse = (e) => mouse.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
window.addEventListener('mousemove', setMouse);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  audio();
  if (state !== 'play') return;
  if (e.button === 2) { buildType = null; selected = null; return; }
  setMouse(e); updateAim();
  if (!inGrid(hoverC, hoverR)) { selected = null; return; }
  const t = cellT[hoverR * COLS + hoverC];
  if (t) { selected = t; buildType = null; }
  else if (buildType) build(buildType, hoverC, hoverR);
  else selected = null;
});
function togglePause() {
  if (state === 'play') state = 'paused'; else if (state === 'paused') state = 'play'; else return;
  $('paused').style.display = state === 'paused' ? 'flex' : 'none';
}
function act(name, arg) {
  audio();
  if (name === 'start') { const i = typeof arg === 'number' ? arg : mapI; if (unlocked(i)) newGame(i); return; }
  if (name === 'pause') return togglePause();
  if (name === 'menu') {                                         // 스테이지 선택 화면으로
    if (state === 'title') return;
    resetField(); state = 'title'; $('paused').style.display = 'none';
    stopSay();
    showScreen();
    return;
  }
  if (state !== 'play') return;
  if (name === 'build') { buildType = buildType === arg ? null : arg; selected = null; }
  else if (name === 'ult') { updateAim(); castUlt(arg, Math.abs(aim.x) > HX + 20 ? 0 : aim.x, Math.abs(aim.z) > HZ + 20 ? 0 : aim.z); }
  else if (name === 'next') startWave();
  else if (name === 'speed') speed = speed === 1 ? 2 : 1;
  else if (name === 'up') upgrade(selected);
  else if (name === 'sell') sell(selected);
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  let k = e.key.toLowerCase();
  if (/^Key[A-Z]$/.test(e.code)) k = e.code[3].toLowerCase(); else if (/^Digit\d$/.test(e.code)) k = e.code[5];   // 물리 키 기준으로 인식해 입력기 상태와 무관하게 동작
  if (state === 'title' || state === 'over') { if (k === 'enter' || k === ' ') { e.preventDefault(); if ($('screen').style.display !== 'none') act('start'); } return; }
  if (k === 'p') return togglePause();
  if (k === 'm') { muted = !muted; if (muted) stopSay(); return; }
  if (k === 'escape') { if (buildType || selected) { buildType = null; selected = null; } else togglePause(); return; }
  const ti = TOWER_IDS.findIndex((id) => TOWERS[id].key === k);
  if (ti >= 0) act('build', TOWER_IDS[ti]);
  else if (ULTS.some((u) => u.key.toLowerCase() === k)) act('ult', ULTS.findIndex((u) => u.key.toLowerCase() === k));
  else if (k === ' ') { e.preventDefault(); act('next'); }
  else if (k === 'f') act('speed'); else if (k === 'u') act('up'); else if (k === 'x') act('sell');
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el) act(el.dataset.act, el.dataset.arg !== undefined && /^\d+$/.test(el.dataset.arg) ? +el.dataset.arg : el.dataset.arg);
});

// ---------- 화면 ----------
$('towers').innerHTML = TOWER_IDS.map((id) => { const d = TOWERS[id];
  return '<div class="tw" id="tw_' + id + '" data-act="build" data-arg="' + id + '" style="--c:#' + d.col.toString(16).padStart(6, '0') + '"><i>' + d.key + '</i><b>' + d.name + '</b><span>' + d.cost + '</span><small>' + d.tip + '</small></div>'; }).join('');
$('ults').innerHTML = ULTS.map((u, i) => '<div class="ult" id="ult_' + i + '" data-act="ult" data-arg="' + i + '" style="--c:' + u.col + '"><u></u><i>' + u.key + '</i><b>' + u.name + '</b><small>' + u.tip + '</small><em></em></div>').join('');
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setHtml(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function setClass(id, v) { if (hudCache['c_' + id] !== v) { hudCache['c_' + id] = v; $(id).className = v; } }
function updateHud() {
  setText('mapn', MAP.name); setText('wave', waveN + ' / ' + waves.length); setText('lives', '' + Math.ceil(lives)); setText('gold', '' + Math.floor(gold)); $('gold').style.transform = goldPop > 0.02 ? 'scale(' + (1 + goldPop * 0.4).toFixed(2) + ')' : ''; setText('kills', '' + kills);
  if (phase === 'prep') { setHtml('next', '다음 웨이브 <b>' + Math.ceil(nextT) + '</b>초 후　<b>스페이스</b>로 먼저 시작 <b>+' + Math.ceil(nextT) * 2 + '</b> 골드'); setClass('next', 'box go'); }
  else { setHtml('next', waveN + ' 웨이브　남은 적 <b>' + (foes.length + queue.length) + '</b>'); setClass('next', 'box'); }
  setHtml('combo', combo >= 5 ? '×' + combo + '<small>연속 처치</small>' : '');
  setText('speed', 'F 배속 ×' + speed); setClass('speed', 'box' + (speed > 1 ? ' on' : ''));
  for (const id of TOWER_IDS) setClass('tw_' + id, 'tw' + (buildType === id ? ' sel' : '') + (gold < TOWERS[id].cost ? ' off' : ''));
  ULTS.forEach((u, i) => {
    const cd = ultCd[i], key = 'u' + i, v = cd > 0 ? Math.ceil(cd) : 0;
    setClass('ult_' + i, 'ult' + (cd > 0 ? ' off' : ' ready'));
    if (hudCache[key] !== v) { hudCache[key] = v; $('ult_' + i).querySelector('em').textContent = v || ''; }
    $('ult_' + i).firstChild.style.height = (cd / u.cd * 100).toFixed(1) + '%';
  });
  const t = selected;
  if (t) {
    const c = t.lv < 3 ? upCost(t) : 0;
    setHtml('info', '<h4>' + t.def.name + '　' + '★'.repeat(t.lv) + '</h4><div class="st">피해 ' + Math.round(t.dmg) + (t.type === 'prism' || t.type === 'flame' ? ' /초' : '') + '　사거리 ' + t.range.toFixed(1) + (t.type === 'beacon' ? '　증폭 +' + (20 + (t.lv - 1) * 10) + '%' : '') + (t.buff > 1 ? '　<b style="color:#ffd66e">증폭 적용</b>' : '') + (t.def.ground ? '　지상 전용' : '') +
      (t.slow ? '　감속 ' + Math.round(t.slow * 100) + '%' : '') + (t.chain ? '　연쇄 ' + t.chain : '') + '</div>' +
      (c && t.def.dmg ? '<div class="st">다음 등급 ' + '★'.repeat(t.lv + 1) + ': 피해 <b style="color:#9fe8a0">' + Math.round(t.def.dmg * LV_DMG[t.lv] * t.buff) + '</b>' + (t.lv === 2 ? '　만랩 각성' : '') + '</div>' : '') +
      (c ? '<span class="btn' + (gold < c ? ' off' : '') + '" data-act="up">U 업그레이드 ' + c + '</span>' : '<span class="st">최대 레벨　</span>') +
      '<span class="btn sell" data-act="sell">X 판매 +' + Math.round(t.spent * 0.7) + '</span>');
    $('info').style.display = 'block';
  } else if (hudCache.info !== '') { hudCache.info = ''; $('info').style.display = 'none'; }
}
const starStr = (n) => '<span class="stars">' + '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i></span>';
function showScreen() {
  const s = $('screen');
  s.style.display = 'flex'; $('hud').style.display = state === 'over' ? 'block' : 'none';
  const help = '<div class="help"><b>1 – 9</b> 타워 선택, <b>클릭</b>으로 빈 땅에 건설; 기존 타워를 누르면 <b>업그레이드 U</b> / <b>판매 X</b>, 3 성이 되면 각성<br>' +
    '<b>Q</b> 운석 낙하　<b>W</b> 벼락 난무　<b>E</b> 혹한의 영역　<b>R</b> 천공의 심판　<b>T</b> 공허의 특이점　<b>G</b> 유성 검진 — 6 개의 궁극기, 쿨타임이 차면 사용<br>' +
    '<b>스페이스</b> 웨이브 조기 시작으로 보너스　<b>F</b> 배속　<b>P</b> 일시정지　<b>M</b> 음소거　<b>우클릭 / Esc</b> 취소</div>';
  if (state === 'over') {
    const next = won && mapI + 1 < MAPS.length;
    s.innerHTML = '<h1 class="' + (won ? 'gold' : 'red') + '">' + (won ? '막 아 냈 다' : '크리스탈 함락') + '</h1><div class="sub">' + MAP.name + '　' +
      (won ? waves.length + '웨이브 전부 격퇴, 남은 생명 ' + Math.ceil(lives) : waveN + '웨이브에서 무너짐') + '　처치 ' + kills + '　소요 ' + Math.floor(time / 60) + ' 분 ' + Math.floor(time % 60) + ' 초</div>' +
      (won ? '<div class="sub">' + starStr(gotStars) + '</div>' : '') +
      '<div class="row">' + (next ? '<div class="go" data-act="start" data-arg="' + (mapI + 1) + '">다음 스테이지 · ' + MAPS[mapI + 1].name + '</div>' : '') +
      '<div class="go' + (next ? ' alt' : '') + '" data-act="start">다시 하기</div><div class="go alt" data-act="menu">스테이지 선택</div></div>';
  } else {
    s.innerHTML = '<h1>메아리</h1><div class="sub">크리스탈 수호전 · 타워디펜스　스테이지를 고르세요, 클리어하면 다음 해금</div><div class="maps">' + MAPS.map((m, i) => {
      const ok = unlocked(i);
      return '<div class="map' + (ok ? '' : ' lock') + '"' + (ok ? ' data-act="start" data-arg="' + i + '"' : '') + ' style="--c:' + THEMES[m.theme].css + '"><em>스테이지 ' + (i + 1) + ' · ' + waves.length + ' 웨이브</em><b>' + m.name + '</b><small>' + m.sub + '</small>' +
        (ok ? starStr(save.stars[i] || 0) : '<span class="stars">이전 스테이지 클리어 시 해금</span>') + '</div>';
    }).join('') + '</div>' + help;
  }
}

// ---------- 화면 동기화 ----------
const counts = {}, SPINNY = { frost: 1, tesla: 1, prism: 1, beacon: 1 };
function put(name, x, y, z, rx, ry, sx, sy, sz, r, g, b) {
  const m = meshes[name];
  if (counts[name] >= m.instanceMatrix.count) return;
  const i = counts[name]++;
  dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
  m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, tmpCol.setRGB(r, g, b));
}
function sync() {
  const T = floorU.uTime.value;
  for (const k in meshes) counts[k] = 0;
  for (const e of foes) {
    if (!e.alive) continue;
    let [r, g, b] = e.col;
    if (e.rage) { r += e.rage * 0.7; g *= 1 - e.rage * 0.5; b *= 1 - e.rage * 0.5; }
    if (e.burnT > 0) { r += 0.5; g += 0.12; }
    if (e.frozenT > 0) { r = r * 0.3 + 0.55; g = g * 0.3 + 0.8; b = b * 0.3 + 1.0; }
    else if (e.slowT > 0) { r *= 0.7; g = g * 0.8 + 0.1; b = b * 0.8 + 0.3; }
    if (e.phased) { r = 0.1; g = 0.08; b = 0.28; }
    if (e.flash > 0) { r += 1.2; g += 1.2; b += 1.2; }
    const tp = e.type, step = e.frozenT > 0 ? 0 : Math.sin(e.spin * 4), face = Math.atan2(e.dx, e.dz), fly = tp === 'swarm' || e.fly, blob = tp === 'splitter' || tp === 'mite';
    const y = e.alt + (fly ? 0.5 + step * 0.25 : tp === 'phantom' ? 0.45 + Math.sin(e.spin * 1.5) * 0.2 : Math.abs(step) * (tp === 'runner' ? 0.3 : e.big ? 0.1 : 0.18));
    const sy = fly ? 1 + step * 0.35 : blob ? 1 + step * 0.14 : 1, sx = e.phased ? 0.5 : blob ? 1 - step * 0.07 : 1;
    const age = T - (e.t0 === undefined ? (e.t0 = T) : e.t0), grow = age < 0.35 ? 0.15 + 0.85 * (1 - (1 - age / 0.35) ** 2) : 1, punch = e.flash > 0 ? Math.min(0.2, e.flash * 1.5) : 0;   // 등장 직후 작았다가 커짐; 맞는 순간 뒤로 젖혀지며 몸이 부픔
    const big2 = e.big ? 1 + 0.03 * Math.sin(T * 5 + e.spin) : 1;
    put(tp, e.x, y, e.z, (tp === 'runner' ? step * 0.14 : e.fly ? -0.12 : step * 0.05) - punch * 1.4, face, sx * grow * (1 + punch) * big2, sy * grow * (1 - punch * 0.6), sx * grow * (1 + punch) * big2, r, g, b);
    if (state === 'play') {                                      // 상태가 한눈에 보임: 타는 것은 불꽃, 언 것은 얼음 결정 반짝임, 감속은 물방울, 보스는 검은 기운이 솟음
      if (e.burnT > 0 && Math.random() < 0.35) spark(e.x + rand(-e.r, e.r), e.alt + rand(0.3, e.h), e.z + rand(-e.r, e.r), 0, rand(3, 6), 0, [3, rand(0.9, 1.6), 0.2], rand(0.25, 0.5), -2);
      if (e.frozenT > 0) { if (Math.random() < 0.12) spark(e.x + rand(-e.r, e.r), e.alt + rand(0.2, e.h), e.z + rand(-e.r, e.r), 0, rand(0.4, 1.4), 0, [1.4, 2.2, 3], rand(0.3, 0.5), 0); }
      else if (e.slowT > 0 && Math.random() < 0.1) spark(e.x + rand(-e.r, e.r), e.alt + e.h * 0.5, e.z + rand(-e.r, e.r), 0, 0.5, 0, [0.5, 1.2, 2.4], 0.4, 9);
      if (e.boss && Math.random() < 0.5) spark(e.x + rand(-e.r, e.r) * 1.3, rand(0.2, e.h), e.z + rand(-e.r, e.r) * 1.3, 0, rand(2, 5), 0, [e.col[0] * 2.2 + 0.2, e.col[1] * 1.1, e.col[2] * 2.2 + 0.2], rand(0.5, 1), 0);
      if (e.big && !fly && e.frozenT <= 0) { const sg = step > 0; if (e.ls !== undefined && sg !== e.ls) burst(e.x, 0.2, e.z, e.boss ? 10 : 5, [0.55, 0.5, 0.42], 4, 0.45, 0.5); e.ls = sg; }   // 덩치 큰 적은 걸을 때마다 작은 흙먼지
    }
    if (e.shield > 0) put('bubble', e.x, e.alt + e.h * 0.5, e.z, 0, T * 1.5, e.r * 1.9, e.h * 0.62, e.r * 1.9, 0.12, 0.4 + 0.1 * Math.sin(T * 6), 0.95);
    if (!e.phased && (e.hp < e.maxHp || e.shield < e.maxShield || e.shield > 0)) {
      const w = e.big || 1.6 + e.r, k = clamp(e.hp / e.maxHp, 0, 1), y2 = e.alt + e.h + 1.2, hgt = e.big ? 0.6 : 0.36;
      put('barBg', e.x, y2, e.z, BAR_TILT, 0, w + 0.2, hgt + 0.16, 1, 0, 0, 0);
      if (k > 0) put('bar', e.x - w * (1 - k) / 2, y2 + 0.01, e.z + 0.01, BAR_TILT, 0, w * k, hgt, 1, e.big ? 1.6 : 1.3, e.big ? 0.3 : 0.25, e.big ? 0.6 : 0.2);
      if (e.shield > 0) { const ks = e.shield / e.maxShield; put('bar', e.x - w * (1 - ks) / 2, y2 + 0.5, e.z - 0.3, BAR_TILT, 0, w * ks, 0.22, 1, 0.5, 1.2, 2.6); }
    }
  }
  for (const g of gibs) { const k = g.t / g.life, sc = 1 - k * 0.6, f = 1 + (1 - k); put(g.type, g.x, g.y, g.z, g.spin * g.t, g.spin * g.t * 0.7, sc, sc, sc, g.col[0] * f, g.col[1] * f, g.col[2] * f); }
  for (const p of pillars) { const k = p.t / p.life, w = Math.max(0.01, p.r * (1 - k * k)), f = (1 - k) * 0.4; put('pillar', p.x, 0, p.z, 0, k * 3, w, p.h * Math.min(1, k * 8 + 0.15), w, p.col[0] * f, p.col[1] * f, p.col[2] * f); }
  for (const s of shots) {
    if (s.kind === 'arrow') { const dx = s.tx - s.x, dz = s.tz - s.z, dy = s.ty - s.y, dl = Math.hypot(dx, dy, dz) || 1, L = Math.min(2.6, dl);   // 석궁 화살: 꼬리가 달린 빛살
      bolt(s.x, s.y, s.z, s.x - dx / dl * L, s.y - dy / dl * L, s.z - dz / dl * L, 0.13 + (s.lv || 1) * 0.07, [0.9, 2.6, 1.2]); put('shot', s.x, s.y, s.z, 0, 0, 0.2, 0.2, 0.2, 2.4, 3.2, 2.4); }
    else { const q = s.big ? 0.95 : 0.6; put('shot', s.x, s.y, s.z, 0, 0, q, q, q, 3.0, 1.6, 0.5); }
  }
  for (const m of meteors) {
    put('meteor', m.x, m.y, m.z, m.t * 9, m.t * 7, m.size, m.size, m.size, 4, 1.8, 0.4);
    const k = Math.min(1, m.t / m.dur), len = 0.16 * (1 - k * k) + 0.05, bx = m.x + (m.sx - m.tx) * len, by = m.y + m.sy * len, bz = m.z + (m.sz - m.tz) * len;
    bolt(m.x, m.y, m.z, bx, by, bz, m.size * 1.2, [2.6, 0.9, 0.15]); bolt(m.x, m.y, m.z, (m.x + bx) / 2, (m.y + by) / 2, (m.z + bz) / 2, m.size * 0.7, [4, 2.6, 1]);
  }
  for (const b of blades) {                                     // 빛의 검: 떠 있을 때 천천히 자전하며 낙하 지점 선을 비추고 곧바로 땅에 꽂힘
    if (b.big && b.t < b.wait - 0.3) continue;
    const k = clamp((b.t - b.wait) / b.fall, 0, 1), ap = Math.min(1, (b.big ? b.t - b.wait + 0.3 : b.t) / 0.25) * b.size, hover = b.t < b.wait;
    const y = b.y0 * (1 - k * k) + (hover ? Math.sin(T * 5 + b.x) * 0.5 : 0) - (k >= 1 ? 1.2 * b.size : 0), f = k >= 1 ? 0.6 + 0.15 * Math.sin(T * 14 + b.x) : 0.8;
    put('blade', b.x, y, b.z, 0, b.rot + (hover ? T * 3 : 0), ap, ap, ap, 1.3 * f, 2.1 * f, 2.7 * f);
    if (hover) bolt(b.x, y, b.z, b.x, 0.1, b.z, 0.05 * b.size, [0.2, 0.55, 0.85]);
  }
  for (const t of towers) {
    if (t.rise < 1) continue; const c = t.fxc || [1.2, 1.8, 2.4], my = t.def.my;
    for (let i = 0; i < (t.lv === 3 ? 3 : t.lv === 2 ? 1 : 0); i++) { const a = T * 2.2 + i * 2.094 + t.x, q = 0.14 + 0.03 * Math.sin(T * 6 + i); put('shot', t.x + Math.cos(a) * 1.9, my + 0.7 + Math.sin(T * 3 + i * 2) * 0.3, t.z + Math.sin(a) * 1.9, 0, 0, q, q, q, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5); }   // 2 성엔 하나, 3 성엔 세 개의 빛구슬이 타워를 공전
    if ((t.type === 'cannon' || t.type === 'mortar' || t.type === 'sniper') && t.target && t.stunT <= 0 && t.cdT > 0 && t.cdT < 0.45) { const k = 1 - t.cdT / 0.45, q = 0.12 + 0.3 * k, r2 = t.type === 'sniper' ? 3.6 : 2; put('shot', t.x + Math.sin(t.face) * r2, my + (t.type === 'mortar' ? 1.2 : 0), t.z + Math.cos(t.face) * r2, 0, 0, q, q, q, 3 * k, 2.2 * k, 1.0 * k); }   // 포구가 발사 직전에 빛남
  }
  if (state === 'play') for (const t of towers) if (t.lv < 3 && gold >= upCost(t)) put('upArrow', t.x, t.def.my + 2.6 + Math.sin(T * 4 + t.x) * 0.25, t.z, 0, T * 2.5, 1, 1, 1, 0.5, 2.2, 0.8);   // 골드가 충분해 업그레이드 가능한 타워 머리 위에 초록 화살표
  for (const s of spikes) {
    const k = Math.min(1, s.t / 0.14) * Math.min(1, (s.life - s.t) / 0.2), x = s.on ? s.on.x : s.x, z = s.on ? s.on.z : s.z;
    const m = meshes.spike;
    if (counts.spike < m.instanceMatrix.count) {
      const i = counts.spike++;
      dummy.position.set(x, 0, z); dummy.rotation.set(s.lean, s.rot, s.lean * 0.7); dummy.scale.set(s.r, Math.max(0.01, s.h * k), s.r); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, tmpCol.setRGB(0.4, 0.95, 1.5));
    }
  }
  for (const b of bolts) {
    const m = meshes.bolt;
    if (counts.bolt >= m.instanceMatrix.count) break;
    const i = counts.bolt++, k = b.one ? 1 : b.life / b.max, len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1, b.z2 - b.z1);
    dummy.position.set((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, (b.z1 + b.z2) / 2); dummy.lookAt(b.x2, b.y2, b.z2);
    dummy.scale.set(b.w * (0.4 + 0.6 * k), b.w * (0.4 + 0.6 * k), Math.max(0.01, len)); dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, tmpCol.setRGB(b.col[0] * k, b.col[1] * k, b.col[2] * k));
  }
  bolts = bolts.filter((b) => !b.one);                           // 한 프레임짜리 빛줄기는 그리고 버림
  for (const k in meshes) { const m = meshes[k]; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  markPool.forEach((m, i) => {
    const o = marks[i];
    m.visible = !!o;
    if (!o) return;
    const k = 1 - o.t / o.life;
    m.position.x = o.x; m.position.z = o.z; m.scale.setScalar(o.r * (o.pulse ? 1 - 0.25 * k : 1));
    m.material.color.setRGB(o.col[0], o.col[1], o.col[2]); m.material.opacity = o.op * (o.pulse ? 0.6 + 0.4 * Math.sin(T * 30) : Math.min(1, k * 2));
  });
  runePool.forEach((m, i) => {
    const o = runes[i];
    m.visible = !!o;
    if (!o) return;
    const a = Math.min(1, o.t / 0.3), e = 1 - (1 - a) * (1 - a);
    m.position.set(o.x, o.y, o.z); m.scale.setScalar(o.r * e); m.rotation.y = o.spin * o.t;
    m.material.color.setRGB(o.col[0], o.col[1], o.col[2]); m.material.opacity = Math.min(1, (o.life - o.t) / 0.35);
  });
  orbPool.forEach((m, i) => {
    const o = orbs[i];
    m.visible = !!o;
    if (!o) return;
    const k = o.t / o.life, e = 1 - (1 - k) * (1 - k);
    m.position.set(o.x, o.y, o.z); m.scale.setScalar(o.r0 + (o.r1 - o.r0) * e);
    m.material.color.setRGB(o.col[0], o.col[1], o.col[2]); m.material.opacity = (1 - k) * 0.85;
  });
  for (const t of towers) {
    const ud = t.mesh.userData, h = ud.head;
    ud.ring.rotation.y = T * 0.7; ud.crown.rotation.y = -T * 1.1;
    if (t.stunT > 0) continue;
    if (!SPINNY[t.type]) { h.rotation.y = t.face + (t.target ? 0 : Math.sin(T * 0.7 + t.x * 1.3 + t.z) * 0.55); const kk = t.kick || 0; h.position.set(-Math.sin(t.face) * kk, t.def.my, -Math.cos(t.face) * kk); }
    else { h.rotation.y = t.spin * 1.5; h.position.y = t.def.my + Math.sin(t.spin * 2) * 0.15; }
    const sc = (1 + Math.max(0, t.pop) * 1.2) * (1 + (t.lv - 1) * 0.07), rk = 1 - (1 - t.rise) * (1 - t.rise); t.mesh.scale.set(sc, sc * Math.max(0.02, rk), sc);   // 새로 지은 타워는 땅에서 솟아오름
  }
  const cu = crystal.userData;
  cu.gem.rotation.y = T * 0.8; cu.gem.position.y = 6 + Math.sin(T * 1.6) * 0.4; cu.halo.rotation.z = -T * 0.5;
  cu.halo2.rotation.set(T * 0.9, T * 0.6, 0); cu.halo2.position.y = cu.gem.position.y;
  cu.shards.forEach((m, i) => { const a = T * 0.9 + i / 5 * Math.PI * 2; m.position.set(Math.cos(a) * 3.4, 6 + Math.sin(T * 1.3 + i * 1.7) * 1.1, Math.sin(a) * 3.4); m.rotation.set(T * 2 + i, T * 1.5, 0); });
  for (const m of scenery.portals) m.rotation.x = T * 0.8;
  scenery.lamps.forEach((m, i) => { m.rotation.y = T * 2 + i; m.scale.setScalar(1 + 0.18 * Math.sin(T * 9 + i * 2.3)); });
  for (const beam of beams) if (beam.visible) { const w = 1 + 0.1 * Math.sin(T * 40); beam.userData.outer.scale.set(w, 1, w); beam.userData.mid.scale.set(2 - w, 1, 2 - w); beam.userData.outer.rotation.y = T * 3; }
  holeFx.visible = !!hole;
  if (hole) {
    const k = hole.t / hole.dur, sc = (0.6 + 1.5 * Math.min(1, hole.t / 0.5) + k * 0.9) * (k > 0.93 ? Math.max(0.05, (1 - k) / 0.07) : 1) * (1 + 0.05 * Math.sin(T * 30));
    holeFx.position.set(hole.x, 5, hole.z); holeFx.scale.setScalar(sc);
    holeFx.userData.d1.rotation.set(Math.PI / 2 - 0.45 + Math.sin(T * 3) * 0.2, 0, T * 6); holeFx.userData.d2.rotation.set(Math.PI / 2 - 0.2 + Math.cos(T * 2.3) * 0.3, Math.sin(T * 2) * 0.3, -T * 4);
  }
  const tall = Math.max(1, (16 / 9) / camera.aspect);
  const sx = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake;
  const zk = 1 - 0.24 * zoom, fx = focusX * 0.5 * zoom + sx, fz = focusZ * 0.5 * zoom + sz;          // 궁극기 사용 시 카메라가 초점으로 밀림
  camera.position.set(fx, CAM_H * tall * zk, CAM_D * tall * zk + CAM_Z + fz);
  camera.lookAt(fx, 0, CAM_Z + fz);
  if (dbgCam) { camera.position.set(dbgCam.x, dbgCam.h, dbgCam.z + dbgCam.h * 0.75); camera.lookAt(dbgCam.x, 1, dbgCam.z); }
  camera.updateMatrixWorld();
  updateAim();
  const playing = state === 'play', ok = inGrid(hoverC, hoverR), i = hoverR * COLS + hoverC;
  hoverMesh.visible = playing && ok && (!!buildType || !!cellT[i]);
  if (hoverMesh.visible) {
    hoverMesh.position.x = cx(hoverC); hoverMesh.position.z = cz(hoverR);
    const good = buildType ? !blocked[i] && !cellT[i] && gold >= TOWERS[buildType].cost : true;
    hoverMesh.material.color.setRGB(good ? 0.3 : 1.4, good ? 1.4 : 0.25, good ? 0.8 : 0.2);
  }
  const rt = playing && selected ? selected : null, showB = playing && buildType && ok && !blocked[i] && !cellT[i];
  rangeMesh.visible = !!rt || !!showB;
  if (rt) { rangeMesh.position.x = rt.x; rangeMesh.position.z = rt.z; rangeMesh.scale.setScalar(rt.range); }
  else if (showB) { rangeMesh.position.x = cx(hoverC); rangeMesh.position.z = cz(hoverR); rangeMesh.scale.setScalar(TOWERS[buildType].range); }
  for (let k = 0; k < MAXR; k++) {
    const r = rings[k];
    if (r) { floorU.uP.value[k].set(r.x, r.z, r.r, r.max); floorU.uC.value[k].set(r.col[0], r.col[1], r.col[2]); }
    else floorU.uP.value[k].w = 0;
  }
  floorU.uShow.value = playing && buildType ? 1 : 0;
  floorU.uGlow.value = roadGlow;
  if (frost) { floorU.uFrostR.value = frost.t * 110; floorU.uFrost.value = frost.t < frost.dur ? 1 : Math.max(0, 1 - (frost.t - frost.dur)); } else floorU.uFrost.value = 0;
  const lu = lens.uniforms;
  if (shock) { const k = shock.t / shock.life; tmpV.set(shock.x, 0, shock.z).project(camera); lu.uShock.value.set(tmpV.x * 0.5 + 0.5, tmpV.y * 0.5 + 0.5, k * 0.95, shock.str * (1 - k)); } else if (hole) { tmpV.set(hole.x, 4.2, hole.z).project(camera); lu.uShock.value.set(tmpV.x * 0.5 + 0.5, tmpV.y * 0.5 + 0.5, 0.075 + 0.012 * Math.sin(T * 9), -1.2); }   // 특이점 주변의 공간 왜곡 링
  else lu.uShock.value.w = 0;
  lu.tDepth.value = composer.readBuffer.depthTexture; lu.uPI.value.copy(camera.projectionMatrixInverse); lu.uProjY.value = camera.projectionMatrix.elements[5];
  lu.uAspect.value = camera.aspect; lu.uTime.value = performance.now() / 1000; renderer.getDrawingBufferSize(lu.uPx.value); lu.uPx.value.set(1 / lu.uPx.value.x, 1 / lu.uPx.value.y);
  litU.uT.value = performance.now() / 1000; litU.uSunV.value.copy(sun.position).normalize().transformDirection(camera.matrixWorldInverse); litU.uSunC.value.copy(sun.color);
  lu.uInv.value = performance.now() < invUntil ? 1 : 0;
  lu.uHurt.value = hurtFx; lu.uFlash.value = flash; lu.uFlashC.value.copy(flashC); lu.uTint.value.copy(tintC); lu.uTintK.value = tintK; lu.uAb.value = ab; lu.uDark.value = dark;
  bloom.strength = 0.7 + glow * 0.25;
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  if (state !== 'title') updateHud();
}

// ---------- 메인 루프 ----------
showScreen();
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  for (let i = 0; i < (state === 'play' ? speed : 1); i++) update(dt);
  music(); laserHum(state === 'play' ? beamN : 0, beamRamp);
  sync();
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버그 훅: 자동화 테스트가 상태를 읽고 진행하기 편하게
window.__echo = {
  get s() { return { state, won, time: +time.toFixed(1), wave: waveN, phase, lives, gold: Math.floor(gold), kills, foes: foes.length, towers: towers.length,
    lv: towers.reduce((a, t) => a + t.lv, 0), ultCd: ultCd.map((c) => +c.toFixed(1)) }; },
  get audio() { return ac ? { state: ac.state, muted, peak: audioPeak(), hum: hum ? +hum.g.gain.value.toFixed(3) : null, voice: voice ? voice.name + ' ' + voice.lang : null, canSpeak, speaking: canSpeak && speechSynthesis.speaking, combo, clips: Object.keys(clips).length, said: saidLog.slice() } : null; }, sfx, say,
  get foes() { return foes; }, get towers() { return towers; },
  step(seconds, draw = true) { if (state === 'paused') state = 'play'; for (let t = 0; t < seconds && state === 'play'; t += 1 / 60) update(1 / 60); if (draw && state === 'play') state = 'paused'; if (draw) { sync(); composer.render(); } },
  draw() { sync(); composer.render(); }, lens: lens.uniforms,
  newGame, build, upgrade, sell, castUlt, startWave, pathAt, loadMap, showScreen, act,
  get map() { return { i: mapI, name: MAP.name, paths: paths.map((P) => ({ len: P.len, own: P.own, edge: P.edge })), spots: SPOTS.length, stars: save.stars }; },
  dry(on) { dry = on; },
  hold(on) { if (on && state === 'play') state = 'paused'; else if (!on && state === 'paused') state = 'play'; },
  inspect(x, z, h) { dbgCam = h ? { x, z, h } : null; }, spawn,
  setGold(v) { gold = v; }, setWave(v) { waveN = v; },
  autopilot(on, ults = true) { auto = on ? { ults } : null; },
};
