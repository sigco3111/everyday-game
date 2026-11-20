// 광저우 드리프트 · 장면과 렌더링: 트랙, 랜드마크, 젖은 노면 반사, 후처리
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
export const W = 6.5;                       // 노면 반폭
export const ZNAME = ['례더 대교', '주장 신성', '화청 광장', '중산기념당', '해주교', '치러우 옛거리', '성중촌', '광저우 타워'];
const LAMP = [[.7, .85, 1], [.75, .9, 1], [.9, .88, 1], [1, .72, .42], [1, .8, .5], [1, .66, .34], [1, .6, .3], [.8, .8, 1]];
const NEON = [[.3, .6, 1], [.1, .9, 1], [1, .2, .8], [1, .6, .1], [1, .7, .25], [1, .22, .1], [.2, 1, .45], [.6, .3, 1]];
export function zone(x, z) {
  if (Math.abs(z) < 50) return x > 0 ? 0 : 4;
  if (z < 0) return x > 100 ? 1 : x > -150 ? 2 : 3;
  return x < -30 ? 5 : x < 150 ? 6 : 7;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const CP = [[300, 40], [300, -40], [305, -130], [250, -230], [140, -290], [30, -240], [-40, -150], [-130, -120], [-210, -190], [-190, -290], [-290, -320], [-360, -240], [-340, -130], [-295, -60], [-290, -40], [-290, 40], [-295, 110], [-250, 190], [-140, 180], [-50, 215], [0, 300], [75, 325], [110, 255], [55, 190], [95, 125], [190, 135], [250, 210], [340, 235], [390, 160], [350, 85], [302, 60]];

const NOISE = `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*noise(p); p = p*2.03+7.1; a *= 0.5; } return s; }
`;
const FOGV = `uniform vec3 uFog; uniform float uFogDen; vec3 fogged(vec3 c, float d){ return mix(uFog, c, exp(-d*uFogDen)); }`;

function buildTrack() {
  const curve = new THREE.CatmullRomCurve3(CP.map((p) => new V3(p[0], 0, p[1])), true, 'centripetal');
  curve.arcLengthDivisions = 4000;
  const LEN = curve.getLength(), N = Math.round(LEN / 2), seg = LEN / N, P = curve.getSpacedPoints(N);
  const px = new Float32Array(N), pz = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N), curv = new Float32Array(N), zn = new Uint8Array(N);
  for (let i = 0; i < N; i++) { px[i] = P[i].x; pz[i] = P[i].z; }
  for (let i = 0; i < N; i++) { const a = (i + N - 1) % N, b = (i + 1) % N; let dx = px[b] - px[a], dz = pz[b] - pz[a]; const l = Math.hypot(dx, dz); tx[i] = dx / l; tz[i] = dz / l; zn[i] = zone(px[i], pz[i]); }
  for (let i = 0; i < N; i++) { const a = (i + N - 4) % N, b = (i + 4) % N; curv[i] = (tx[a] * tz[b] - tz[a] * tx[b]) / (8 * seg); } // 부호 있는 곡률, 양수가 오른쪽
  const grid = new Map(), CELL = 16, key = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);
  for (let i = 0; i < N; i++) { const k = key(px[i], pz[i]); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  const T = { N, LEN, seg, px, pz, tx, tz, curv, zn };
  // 모든 노면 중심선과의 최소 거리가 r 보다 큰지
  T.clear = (x, z, r) => { const R = r + W, n = Math.ceil(R / CELL); const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = grid.get((cx + a) * 4096 + cz + b); if (!l) continue; for (const i of l) if ((px[i] - x) ** 2 + (pz[i] - z) ** 2 < R * R) return false; } return true; };
  T.at = (s, lat, o) => { s = ((s % LEN) + LEN) % LEN; const f = s / seg, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
    const ax = tx[i] + (tx[j] - tx[i]) * u, az = tz[i] + (tz[j] - tz[i]) * u, l = Math.hypot(ax, az) || 1; o.tx = ax / l; o.tz = az / l;
    o.x = px[i] + (px[j] - px[i]) * u - o.tz * lat; o.z = pz[i] + (pz[j] - pz[i]) * u + o.tx * lat; o.i = i; return o; };
  T.locate = (x, z, hint, o) => { let bi = hint, bd = 1e9; for (let k = -25; k <= 25; k++) { const i = (hint + k + N) % N, d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
    const dx = x - px[bi], dz = z - pz[bi]; o.i = bi; o.s = bi * seg + dx * tx[bi] + dz * tz[bi]; o.d = dx * -tz[bi] + dz * tx[bi]; return o; };
  T.ribbon = (offA, yA, offB, yB, col) => { const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), c = new Float32Array((N + 1) * 6), idx = [];
    for (let k = 0; k <= N; k++) { const i = k % N, nx = -tz[i], nz = tx[i], o = k * 6;
      pos[o] = px[i] + nx * offA; pos[o + 1] = yA; pos[o + 2] = pz[i] + nz * offA; pos[o + 3] = px[i] + nx * offB; pos[o + 4] = yB; pos[o + 5] = pz[i] + nz * offB;
      uv[k * 4] = 0; uv[k * 4 + 1] = k * seg; uv[k * 4 + 2] = 1; uv[k * 4 + 3] = k * seg; const cc = col[zn[i]]; c.set(cc, o); c.set(cc, o + 3);
      if (k < N) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  return T;
}

// 버텍스 컬러 부품, 차 한 대를 두세 개 메시로 조립하는 데 사용
export function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, mul = 1) {
  const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
  let g = geo.clone().applyMatrix4(m); if (g.index) g = g.toNonIndexed();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * mul; a[i * 3 + 1] = c.g * mul; a[i * 3 + 2] = c.b * mul; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), SPH = new THREE.SphereGeometry(1, 16, 12);
const merged = (list, mat) => new THREE.Mesh(mergeGeometries(list), mat);

class Batch { // 같은 머티리얼의 인스턴스를 한데 모음
  constructor(geo, mat, layer = 0) { this.geo = geo; this.mat = mat; this.m = []; this.c = []; this.layer = layer; }
  add(x, y, z, sx, sy, sz, ry = 0, col = null, rx = 0, rz = 0) { this.m.push(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz))); this.c.push(col); return this; }
  beam(a, b, r, col = null) { const d = new V3().subVectors(b, a), l = d.length(); this.m.push(new THREE.Matrix4().compose(new V3().addVectors(a, b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()), new V3(r, l, r))); this.c.push(col); return this; }
  build(scene) { if (!this.m.length) return null; const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length); const col = new THREE.Color();
    this.m.forEach((m, i) => { im.setMatrixAt(i, m); if (this.c[i]) im.setColorAt(i, col.setRGB(...this.c[i])); else if (this.c.some(Boolean)) im.setColorAt(i, col.setRGB(1, 1, 1)); });
    im.frustumCulled = false; im.layers.set(this.layer); scene.add(im); return im; }
}

function textTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const FONT = '"Noto Sans KR","Malgun Gothic",sans-serif';

export function createWorld(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(); const FOG = new THREE.Color().setRGB(.028, .026, .048);
  scene.fog = new THREE.FogExp2(FOG, .0021);
  const camera = new THREE.PerspectiveCamera(64, 1, .3, 2600); camera.layers.enable(1);
  const mirrorCam = new THREE.PerspectiveCamera(64, 1, .3, 2600);
  const mirrorRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const U = { uTime: { value: 0 }, uFog: { value: FOG }, uFogDen: { value: .0021 }, tRefl: { value: mirrorRT.texture }, uRes: { value: new THREE.Vector2(1, 1) },
    uBike: { value: new V3() }, uBikeDir: { value: new THREE.Vector2(0, 1) }, uCam: { value: new V3() } };
  const R = rng(20261116), rr = (a, b) => a + (b - a) * R();
  const T = buildTrack(); const tmp = {};

  // ---------- 조명과 환경 맵 ----------
  scene.add(new THREE.HemisphereLight(0x4a5c8c, 0x2a2018, .55));
  const moon = new THREE.DirectionalLight(0x8aa0e0, .35); moon.position.set(-60, 120, 40); scene.add(moon);
  { const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(.03, .03, .06), side: THREE.BackSide })));
    const eb = (x, y, z, sx, sy, sz, c) => { const m = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...c) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); es.add(m); };
    eb(-30, 6, 0, 2, 14, 40, [6, .8, 3]); eb(30, 8, 0, 2, 18, 40, [.6, 4, 7]); eb(0, 5, -34, 40, 8, 2, [7, 4, 1.4]); eb(0, 4, 34, 30, 6, 2, [1, 5, 2]); eb(0, 30, 0, 26, 1, 26, [1.5, 1.6, 2.4]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .03).texture; scene.environmentIntensity = .85; pm.dispose(); }

  // ---------- 하늘과 원경 스카이라인 ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; uniform float uTime; uniform vec3 uFog; ${NOISE}
    void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.0);
      vec3 col = mix(uFog*1.5 + vec3(.05,.015,.03), vec3(.004,.006,.016), pow(h, .42));
      vec2 q = d.xz/(h+.18)*1.3; float c = fbm(q + uTime*.008); c = smoothstep(.42,.8,c);
      col = mix(col, vec3(.085,.05,.075)*(1.2-h), c*.75*smoothstep(0.0,.15,h));
      float st = step(.9985, hash(floor(d.xz/(h+.3)*220.0)))*h*(1.0-c); col += st*.6;
      gl_FragColor = vec4(col, 1.0); }` }));
  sky.frustumCulled = false; scene.add(sky);
  const skyline = new THREE.Mesh(new THREE.CylinderGeometry(1300, 1300, 300, 96, 1, true), new THREE.ShaderMaterial({ side: THREE.BackSide, fog: false, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uFog; ${NOISE}
    void main(){ float x = vUv.x*900.0, y = vUv.y;
      float b1 = floor(x/3.0), b2 = floor(x/1.3+40.0);
      float h = max(.12+.5*hash(vec2(b1,3.0))*hash(vec2(b1,9.0)), .1+.3*hash(vec2(b2,5.0)));
      h *= .55+.45*noise(vec2(vUv.x*14.0, 2.0));
      if (y > h) discard;
      vec2 cell = floor(vec2(x*9.0, y*150.0)); float lit = step(.78, hash(cell))*step(.25, fract(x*9.0))*step(.3, fract(y*150.0));
      vec3 wc = mix(vec3(1.0,.7,.35), vec3(.6,.8,1.0), hash(cell+7.0));
      vec3 col = vec3(.012,.013,.028) + lit*wc*.5; col = mix(uFog*1.3, col, .42);
      gl_FragColor = vec4(col, 1.0); }` }));
  skyline.position.y = 150; skyline.frustumCulled = false; scene.add(skyline);

  // ---------- 노면: 아스팔트, 차선, 물웅덩이, 실제 거울 반사 ----------
  const nl = 2 * Math.round(T.LEN / 60), LS = T.LEN / nl;
  const roadMat = new THREE.ShaderMaterial({ uniforms: { ...U, uLS: { value: LS } }, vertexColors: true,
    vertexShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vC; void main(){ vUv = uv; vC = color; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vC; uniform sampler2D tRefl; uniform vec2 uRes; uniform float uTime, uLS; uniform vec3 uBike; uniform vec2 uBikeDir;
    ${NOISE} ${FOGV}
    void main(){ vec2 wp = vW.xz; float across = (vUv.x-.5)*${(2 * W).toFixed(1)}; float along = vUv.y;
      float gr = noise(wp*13.0)*.5 + noise(wp*41.0)*.5;
      vec3 base = vec3(.020,.022,.026)*(.65+.7*gr);
      float edge = smoothstep(.13,.06,abs(abs(across)-${(W - .55).toFixed(2)}));
      float lane = smoothstep(.10,.04,abs(abs(across)-2.1))*step(.5, fract(along/9.0));
      float mark = max(edge, lane)*(.7+.3*gr)*(.55+.45*noise(wp*1.7));
      float pud = smoothstep(.50,.66, fbm(wp*.075+3.0));
      float k = floor(along/uLS+.5), dv = along-k*uLS, side = mod(k,2.0)*2.0-1.0, du = across-side*${(W + 1).toFixed(1)};
      float pool = exp(-(dv*dv*.010+du*du*.016));
      vec3 light = vec3(.05,.06,.10) + vC*pool*2.4;
      vec2 tb = wp-uBike.xz; float fd = dot(tb,uBikeDir), sd = dot(tb, vec2(-uBikeDir.y,uBikeDir.x));
      light += vec3(1.0,.93,.8)*smoothstep(.2,3.0,fd)*exp(-fd*.055)*exp(-sd*sd/(1.2+fd*fd*.07))*2.4;
      vec3 col = (base + mark*vec3(.26,.26,.24))*light*(1.0-.45*pud);
      vec3 V = cameraPosition - vW; float dist = length(V); float cosT = max(V.y/dist, 0.0);
      float fres = .05 + .95*pow(1.0-cosT, 5.0);
      vec2 suv = gl_FragCoord.xy/uRes; vec2 ruv = vec2(suv.x, 1.0-suv.y);
      vec2 nrm = vec2(noise(wp*31.0+3.1), noise(wp*31.0+7.7))-.5; float jit = hash(gl_FragCoord.xy+fract(uTime))-.5;
      vec2 rc = floor(wp*1.4); float rt = fract(uTime*.9+hash(rc)*7.0); vec2 rp = fract(wp*1.4)-.5-(vec2(hash(rc+1.3),hash(rc+2.7))-.5)*.5;
      float rip = sin(clamp((length(rp)-rt*.5)*40.0,-3.14,3.14))*(1.0-rt)*pud*step(.55,hash(rc+5.0));
      float att = 1.0/(1.0+dist*.04);
      vec2 dis = nrm*vec2(.35,1.0)*mix(.012,.001,pud)*att + rip*.003*att;
      float sp = mix(.07,.004,pud)*(.35+.65*att*3.0);
      vec3 refl = vec3(0.0);
      for(int j=0;j<7;j++){ float t = (float(j)-3.0+jit)/3.0; refl += texture2D(tRefl, ruv + dis + vec2(0.0, t*sp)).rgb; }
      refl /= 7.0;
      col += refl*mix(.5,1.0,pud)*clamp(fres*2.6+.08, 0.0, 1.0)*(1.0-mark*.5);
      gl_FragColor = vec4(fogged(col, dist), 1.0); }` });
  const road = new THREE.Mesh(T.ribbon(-W, 0, W, 0, LAMP), roadMat); road.frustumCulled = false; road.layers.set(1); scene.add(road); // 1번 레이어에 둠: 미러 패스에서는 노면을 그리지 않음. 아니면 반사 맵을 읽으며 쓰게 됨

  // 가드레일: 콘크리트 블록에 상부 라이트 벨트
  const wallMat = new THREE.ShaderMaterial({ uniforms: U, vertexColors: true, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vC; varying float vD; void main(){ vUv = uv; vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC; varying float vD; ${NOISE} ${FOGV}
    void main(){ float ch = step(.5, fract(vUv.y/2.4 + vUv.x*.5));
      vec3 col = mix(vec3(.03,.03,.035), vec3(.11,.105,.10), ch)*(.7+.5*noise(vUv.yx*vec2(3.0,9.0)));
      col = mix(col, vC*2.4, smoothstep(.88,.93,vUv.x));
      col += vC*.05*smoothstep(.3,.9,vUv.x);
      gl_FragColor = vec4(fogged(col, vD), 1.0); }` });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(T.ribbon(s * W, 0, s * (W + .25), .95, NEON), wallMat); m.frustumCulled = false; scene.add(m); }
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: .5, metalness: .1 });
  const w1 = new THREE.Mesh(T.ribbon(-W - 5, .16, -W - .25, .16, LAMP), walkMat), w2 = new THREE.Mesh(T.ribbon(W + .25, .16, W + 5, .16, LAMP), walkMat); w1.frustumCulled = w2.frustumCulled = false; scene.add(w1, w2);

  // 지면, 주장 강, 제방
  const gMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(.012, .013, .018) });
  for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(3400, 1500), gMat); g.rotation.x = -Math.PI / 2; g.position.set(0, -.06, s * (48 + 750)); scene.add(g); }
  const river = new THREE.Mesh(new THREE.PlaneGeometry(3400, 96), new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vW; uniform sampler2D tRefl; uniform vec2 uRes; uniform float uTime; ${NOISE} ${FOGV}
    void main(){ vec2 wp = vW.xz; vec3 V = cameraPosition-vW; float dist = length(V);
      vec2 n = vec2(noise(wp*vec2(.35,1.1)+uTime*.7), noise(wp*vec2(.3,.9)-uTime*.5+9.0))-.5;
      vec2 suv = gl_FragCoord.xy/uRes; vec2 ruv = vec2(suv.x, 1.0-suv.y) + n*.09/(1.0+dist*.01) + vec2(0.0,-.03);
      vec3 refl = vec3(0.0); for(int j=0;j<5;j++) refl += texture2D(tRefl, ruv + vec2(0.0,(float(j)-2.0)*.022)).rgb; refl /= 5.0;
      float fres = .1+.9*pow(1.0-max(V.y/dist,0.0), 4.0);
      vec3 col = vec3(.006,.012,.018) + refl*fres*1.1 + vec3(.008,.012,.02)*smoothstep(.2,.8,n.x+n.y+.5);
      gl_FragColor = vec4(fogged(col, dist), 1.0); }` }));
  river.rotation.x = -Math.PI / 2; river.position.y = -5; river.layers.set(1); river.frustumCulled = false; scene.add(river);

  // ---------- 공용 머티리얼과 배치 ----------
  const stdMat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, metalness: .1, ...o });
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r, g, b) });
  const B = { conc: new Batch(BOX, stdMat(0xffffff, { roughness: .75 })), conc1: new Batch(BOX, stdMat(0x3a3d46, { roughness: .8 }), 1), steel: new Batch(CYL, stdMat(0x2a2e36, { metalness: .7, roughness: .4 })),
    cable: new Batch(CYL, glow(.45, .55, .9)), gold: new Batch(CYL, glow(2.6, 1.6, .5)), goldBox: new Batch(BOX, glow(2.4, 1.5, .5)), bulb: new Batch(BOX, glow(1, 1, 1)), wire: new Batch(CYL, new THREE.MeshBasicMaterial({ color: 0x050506 })),
    lantern: new Batch(SPH, glow(1.5, .1, .04)), blue: new Batch(BOX, glow(.4, .9, 2.6)), red: new Batch(SPH, glow(4, .2, .1)), trunk: new Batch(CYL, stdMat(0x2a1c12, { roughness: 1 })),
    leaf: new Batch(new THREE.IcosahedronGeometry(1, 2), stdMat(0xffffff, { roughness: .95 })) };

  // 제방과 물가 라이트 벨트
  for (const s of [-1, 1]) { B.conc1.add(0, -2.4, s * 48.5, 3400, 5.6, 1.2); B.goldBox.add(0, .5, s * 48.2, 3400, .08, .08); }

  // ---------- 빌딩군: 인스턴싱 + 절차적 창문 ----------
  const bGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const bl = { m: [], dim: [], tint: [], parm: [] };
  const excl = [[305, 150, 40], [-280, -225, 52], [-40, 85, 40], [200, -205, 24], [190, -140, 22]];
  function addB(x, z, ry, w, h, d, tint, lit, style) { // w 는 길 방향, d 는 깊이
    const r = Math.hypot(w, d) * .5; if (Math.abs(z) < 52 + r) return false; if (!T.clear(x, z, r * .82 + 4.5)) return false;
    for (const e of excl) if ((x - e[0]) ** 2 + (z - e[1]) ** 2 < (e[2] + r) ** 2) return false;
    pushB(x, z, ry, w, h, d, tint, lit, style); return true; }
  function pushB(x, z, ry, w, h, d, tint, lit, style) { bl.m.push(new THREE.Matrix4().compose(new V3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(d, h, w))); bl.dim.push(d, h, w); bl.tint.push(...tint); bl.parm.push(R() * 100, lit, style, R()); }
  const ZB = [null, { gap: 30, w: [22, 34], d: [20, 30], h: [70, 190], lit: .3, style: 1 }, { gap: 34, w: [20, 30], d: [18, 26], h: [30, 90], lit: .35, style: 1 }, { gap: 22, w: [14, 22], d: [12, 18], h: [14, 34], lit: .4, style: 0 },
    null, { gap: 14, w: [10, 14], d: [10, 14], h: [16, 30], lit: .5, style: 0 }, { gap: 8.5, w: [7, 9.5], d: [8, 11], h: [20, 38], lit: .62, style: 0 }, { gap: 30, w: [18, 28], d: [16, 24], h: [30, 100], lit: .3, style: 1 }];
  const TINT = [[.7, .8, 1], [.2, .9, 1], [1, .3, .8], [1, .75, .5], [1, 1, 1], [1, .8, .6], [.9, .75, .6], [.6, .5, 1]];
  for (let row = 0; row < 3; row++) for (const side of [-1, 1]) { let next = 0;
    for (let i = 0; i < T.N; i++) { const z = T.zn[i], c = ZB[z]; if (!c || i * T.seg < next) continue; if (row === 0 && (z === 5)) continue;
      const w = rr(...c.w), d = rr(...c.d), h = rr(...c.h) * (row ? rr(.8, 1.5) : 1); next = i * T.seg + w + rr(.5, c.gap - w > 0 ? c.gap - w : 2);
      const off = W + (z === 6 ? 5.3 : 7.5) + d / 2 + row * rr(26, 40) + (row ? 0 : rr(0, z === 6 ? .8 : 5));
      const style = c.style === 1 && R() < .22 ? 2 : c.style; const tn = style ? (R() < .5 ? TINT[z] : NEON[Math.floor(R() * 8)]) : [rr(.5, 1), rr(.45, .8), rr(.4, .7)];
      addB(T.px[i] - T.tz[i] * side * off, T.pz[i] + T.tx[i] * side * off, Math.atan2(T.tx[i], T.tz[i]), w, h, d, tn, c.lit, style); } }
  for (let k = 0; k < 520; k++) { const x = rr(-760, 760), z = rr(60, 620) * (R() < .5 ? -1 : 1), far = Math.max(Math.abs(x) - 420, Math.abs(z) - 360, 0); const zz = zone(x, z), c = ZB[zz] || ZB[1];
    addB(x, z, rr(0, 3.14), rr(...c.w) * 1.2, rr(...c.h) * (far > 0 ? rr(.8, 1.9) : rr(.6, 1.1)), rr(...c.d) * 1.2, c.style ? TINT[zz] : [rr(.5, 1), rr(.45, .8), rr(.4, .7)], c.lit * .8, c.style === 1 && R() < .15 ? 2 : c.style); }
  // 동탑·서탑과 안테나 두 개 달린 고층
  pushB(200, -205, .3, 34, 330, 34, [.3, .8, 1], .22, 1); pushB(190, -140, .3, 30, 270, 30, [1, .7, .3], .25, 1); pushB(200, -205, .3, 22, 356, 22, [.3, .8, 1], .2, 1);
  pushB(70, -360, 0, 30, 240, 30, [.5, .6, 1], .25, 1); B.steel.add(64, 262, -360, .6, 44, .6).add(76, 262, -360, .6, 44, .6); B.red.add(64, 285, -360, 1.2, 1.2, 1.2).add(76, 285, -360, 1.2, 1.2, 1.2);
  { const im = new THREE.InstancedMesh(bGeo, new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `attribute vec3 aDim; attribute vec3 aTint; attribute vec4 aParm; varying vec3 vL; varying vec3 vN; varying vec3 vT; varying vec4 vP; varying float vD; varying vec3 vDim;
      void main(){ vL = position*aDim; vN = normal; vT = aTint; vP = aParm; vDim = aDim; vec4 mv = viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0); vD = length(mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vL; varying vec3 vN; varying vec3 vT; varying vec4 vP; varying float vD; varying vec3 vDim; uniform float uTime; ${NOISE} ${FOGV}
      void main(){ vec3 col;
        if (vN.y > .5) { col = vec3(.012,.013,.018) + vT*.25*step(.47, max(abs(vL.x)/vDim.x, abs(vL.z)/vDim.z)); }
        else { bool xf = abs(vN.x) > .5; float hx = xf ? vL.z : vL.x; float half_ = (xf ? vDim.z : vDim.x)*.5; float sd = vP.x + (xf ? 13.0 : 0.0) + (vN.x+vN.z > 0.0 ? 5.0 : 0.0);
          float st = vP.z; vec2 cs = st < .5 ? vec2(2.4,3.1) : vec2(1.25,3.5);
          vec2 f = vec2(hx+half_, vL.y)/cs; vec2 id = floor(f), q = fract(f);
          float rnd = hash(id+sd), rn2 = hash(id*1.7+sd+3.0);
          float fl = hash(vec2(id.y, sd));
          float lit = step(1.0-vP.y*(.25+.75*fl), rnd);
          vec3 wc = rn2 < .6 ? vec3(1.0,.72,.40) : rn2 < .88 ? vec3(.75,.88,1.0) : vec3(.45,.6,1.0);
          if (st < .5) { float win = step(.25,q.x)*step(q.x,.75)*step(.3,q.y)*step(q.y,.75);
            vec3 wall = vT*.035*(.6+.6*noise(vec2(hx,vL.y)*.8));
            col = mix(wall, wc*lit*(.3+.9*rn2) + vec3(.004,.006,.01), win);
            col += vec3(1.0,.5,.2)*.05*smoothstep(8.0,0.0,vL.y); }
          else if (st < 1.5) { float win = step(.1,q.x)*step(.2,q.y);
            vec3 glass = vec3(.012,.02,.035) + vec3(.03,.035,.06)*smoothstep(0.0,1.0,vL.y/vDim.y);
            col = mix(vec3(.006), glass + wc*lit*(.15+.55*rn2), win);
            float edgeL = smoothstep(.6,.15,half_-abs(hx)); float crown = smoothstep(4.0,1.0,vDim.y-vL.y);
            float band = step(.92, fract(vL.y/29.6))*.6;
            col += vT*(edgeL*1.1 + crown*2.0 + band*.6); }
          else { float y = vL.y/vDim.y; float wv = sin(y*14.0 - uTime*1.6 + vP.x) * sin(hx*.18 + uTime*.7 + vP.x*2.0);
            float px = step(.15,q.x)*step(.2,q.y);
            vec3 a = vT, b = vT.zxy; col = mix(a,b,.5+.5*sin(y*5.0+uTime*.5+vP.x))*(.12+.75*smoothstep(-.2,.9,wv))*px*.8 + vec3(.01); } }
        gl_FragColor = vec4(fogged(col, vD), 1.0); }` }), bl.m.length);
    bl.m.forEach((m, i) => im.setMatrixAt(i, m)); im.geometry = bGeo.clone();
    im.geometry.setAttribute('aDim', new THREE.InstancedBufferAttribute(new Float32Array(bl.dim), 3)); im.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(bl.tint), 3)); im.geometry.setAttribute('aParm', new THREE.InstancedBufferAttribute(new Float32Array(bl.parm), 4));
    im.frustumCulled = false; scene.add(im); }

  // ---------- 가로등 ----------
  const coneB = new Batch(new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, -.5, 0), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying float vY; varying vec3 vC; void main(){ vY = -position.y; vC = instanceColor; gl_Position = projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying float vY; varying vec3 vC; void main(){ gl_FragColor = vec4(vC*.09*pow(1.0-vY, 1.8), 1.0); }` }), 1);
  for (let k = 0; k < nl; k++) { const side = (k % 2) * 2 - 1; T.at(k * LS, side * (W + 1), tmp); const c = LAMP[T.zn[tmp.i]], ry = Math.atan2(tmp.tx, tmp.tz);
    const ox = -tmp.tz * side, oz = tmp.tx * side; // 바깥쪽 방향
    B.steel.add(tmp.x + ox * 1.4, 4.5, tmp.z + oz * 1.4, .1, 9, .1); B.steel.add(tmp.x + ox * .3, 8.9, tmp.z + oz * .3, .06, 2.4, .06, ry, null, 0, Math.PI / 2 * 1);
    B.steel.m[B.steel.m.length - 1].compose(new V3(tmp.x + ox * .3, 8.9, tmp.z + oz * .3), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(ox, 0, oz)), new V3(.06, 2.4, .06));
    B.bulb.add(tmp.x - ox * .7, 8.8, tmp.z - oz * .7, .9, .14, .35, ry + Math.PI / 2, c.map((v) => v * 5));
    coneB.add(tmp.x - ox * .7, 8.7, tmp.z - oz * .7, 6.5, 8.7, 6.5, 0, c); }

  // ---------- 다리 두 개 ----------
  { // 례더 대교: 사장교, 중앙에 합궁 형태의 주탑
    const x0 = 300, hw = W + 5.5; B.conc1.add(x0, -.75, 0, hw * 2 + 1, 1.3, 104); for (const z of [-30, 0, 30]) B.conc1.add(x0, -3.4, z, 6, 4, 3);
    const top = new V3(x0, 78, 0); const pyl = new Batch(CYL, glow(.16, .2, .36));
    for (const s of [-1, 1]) { let prev = new V3(x0 + s * (hw + 1.5), -1, 0); for (let k = 1; k <= 10; k++) { const t = k / 10, p = new V3(x0 + s * (hw + 1.5) * (1 - t * t), -1 + 79 * Math.sin(t * Math.PI / 2), 0); pyl.beam(prev, p, 1.7 - t * .7); prev = p; }
      for (let k = 1; k <= 9; k++) for (const d of [-1, 1]) B.cable.beam(new V3(x0 + s * hw * (1 - .1 * k) * .3, 78 - k * 3.3, 0), new V3(x0 + s * hw, 1.1, d * (k * 5 + 2)), .05); }
    pyl.build(scene); B.red.add(x0, 80.5, 0, 1, 1, 1);
    for (const s of [-1, 1]) B.blue.add(x0 + s * (hw + .2), 1.25, 0, .1, .1, 100); }
  { // 해주교: 3경간 강 트러스 아치
    const x0 = -290, hw = W + 5.5; B.conc1.add(x0, -.75, 0, hw * 2 + 1, 1.3, 104); for (const z of [-17, 17]) B.conc1.add(x0, -3.4, z, hw * 2, 4, 3.4);
    for (const s of [-1, 1]) { const x = x0 + s * hw; for (let sp = 0; sp < 3; sp++) { const z0 = -49 + sp * 32.7, L = 32.7, H = sp === 1 ? 15 : 11; let prev = null;
      for (let k = 0; k <= 8; k++) { const t = k / 8, p = new V3(x, 1 + H * Math.sin(t * Math.PI) ** .8 + .6, z0 + L * t); if (prev) B.gold.beam(prev, p, .16); if (k > 0 && k < 8) { B.steel.beam(new V3(x, .2, p.z), p, .13); if (s > 0 && H * Math.sin(t * Math.PI) > 7) B.steel.beam(p, new V3(x - hw * 2, p.y, p.z), .13); } if (prev && k > 1 && k < 8) B.steel.beam(new V3(x, .2, prev.z), p, .09); prev = p; } }
      B.gold.beam(new V3(x, 1.1, -49), new V3(x, 1.1, 49), .07); } }

  // ---------- 광저우 타워 ----------
  { const tx0 = 305, tz0 = 150, H = 240, rb = 25, rt = 17, tw = 2.2; const mat = new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `varying float vY; varying float vD; void main(){ vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0); vY = w.y; vec4 mv = viewMatrix*w; vD = length(mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vY; varying float vD; uniform float uTime; ${FOGV}
      void main(){ float h = vY/240.0; float t = h*1.3 - uTime*.07; vec3 col = .55+.45*cos(6.2832*(t+vec3(0.0,.33,.67)));
        float pulse = .6+.4*sin(h*40.0 - uTime*3.0); gl_FragColor = vec4(fogged(col*col*2.6*pulse, vD*.45), 1.0); }` });
    const st = new Batch(CYL, mat), ring = new Batch(new THREE.TorusGeometry(1, .014, 6, 48).rotateX(Math.PI / 2), mat);
    const pt = (a, t) => new V3(tx0 + Math.cos(a) * rb * (1 - t) + Math.cos(a + tw) * rt * t, H * t, tz0 + Math.sin(a) * rb * (1 - t) + Math.sin(a + tw) * rt * t);
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; st.beam(pt(a, 0), pt(a, 1), .42); }
    for (let k = 0; k <= 26; k++) { const t = k / 26, r = Math.sqrt(rb * rb * (1 - t) ** 2 + rt * rt * t * t + 2 * rb * rt * t * (1 - t) * Math.cos(tw)); ring.add(tx0, H * t, tz0, r, 1, r, 0, null, 0, 0); ring.m[ring.m.length - 1].makeScale(r, 28, r).setPosition(tx0, H * t, tz0); }
    st.build(scene); ring.build(scene);
    B.steel.add(tx0, H / 2, tz0, 7, H, 7); B.steel.add(tx0, H + 40, tz0, .9, 80, .9); B.red.add(tx0, H + 81, tz0, 1.6, 1.6, 1.6); B.blue.add(tx0, H + 3, tz0, 20, 1.2, 20); }

  // ---------- 광저우 서클(강변의 황금 링 빌딩) ----------
  { const m = new THREE.Mesh(new THREE.TorusGeometry(30, 11, 20, 64), new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = length(mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec2 vUv; varying float vD; ${NOISE} ${FOGV}
      void main(){ vec2 g = vUv*vec2(150.0,26.0); float lit = step(.35, hash(floor(g)))*step(.2,fract(g.x))*step(.25,fract(g.y));
        vec3 col = vec3(1.0,.62,.16)*(.12+1.5*lit) + vec3(1.0,.8,.4)*step(.94,fract(vUv.y*2.0+.03))*1.5; gl_FragColor = vec4(fogged(col, vD), 1.0); }` }));
    m.scale.z = .34; m.position.set(-40, 41, 86); scene.add(m); }

  // ---------- 중산기념당(팔각 푸른 기와) ----------
  { const hx = -280, hz = -225, g = new THREE.Group(); g.position.set(hx, 0, hz); g.rotation.y = -.5;
    const red = stdMat(0x7a1a10, { emissive: 0x3a0c05, emissiveIntensity: .7 }), blue = stdMat(0x1450a8, { roughness: .28, metalness: .35, emissive: 0x0a2c70, emissiveIntensity: 1.1 }), wht = stdMat(0xd8d2c4, { emissive: 0x6a6050, emissiveIntensity: .6 }), gld = glow(2.4, 1.6, .4);
    const add = (geo, mat, y, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.y = ry; g.add(m); return m; };
    add(new THREE.CylinderGeometry(36, 38, 3, 8), stdMat(0x8a8478, { roughness: .8 }), 1.5, Math.PI / 8); add(new THREE.CylinderGeometry(26, 26, 13, 8), red, 9.5, Math.PI / 8);
    for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; const c = add(new THREE.CylinderGeometry(.55, .55, 13, 8), wht, 9.5); c.position.x = Math.cos(a) * 27.2; c.position.z = Math.sin(a) * 27.2; const w = add(new THREE.BoxGeometry(1.6, 5, .3), gld, 9); w.material = glow(1.6, 1.0, .4); w.position.set(Math.cos(a + .098) * 25.6, 9, Math.sin(a + .098) * 25.6); w.rotation.y = -a - .098 + Math.PI / 2; }
    add(new THREE.CylinderGeometry(20, 31, 6, 8), blue, 19, Math.PI / 8); add(new THREE.CylinderGeometry(17, 17, 6, 8), red, 25, Math.PI / 8);
    add(new THREE.CylinderGeometry(4, 22, 13, 8), blue, 34.5, Math.PI / 8); add(new THREE.SphereGeometry(2.2, 12, 10), gld, 42.5);
    const por = add(new THREE.BoxGeometry(26, 10, 9), red, 8); por.position.z = 28; const pr = add(new THREE.CylinderGeometry(1, 16, 7, 4), blue, 16.5, Math.PI / 4); pr.position.z = 28; pr.scale.z = .5;
    for (let k = 0; k < 6; k++) { const c = add(new THREE.CylinderGeometry(.8, .8, 10, 10), wht, 8); c.position.set(-11 + k * 4.4, 8, 33); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; const l = add(new THREE.BoxGeometry(.5, .5, .5), gld, 16); l.position.set(Math.cos(a) * 31, 16, Math.sin(a) * 31); }
    scene.add(g); }

  // ---------- 치러우 거리 ----------
  { const fa = textTex(512, 512, (g) => { g.scale(2, 2); g.fillStyle = '#e9e2d2'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 700; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 1, 6 + Math.random() * 26);
      for (let f = 0; f < 3; f++) { const y = 14 + f * 82; g.fillStyle = '#cfc6b2'; g.fillRect(0, y + 66, 256, 8); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 74, 256, 2); g.fillStyle = '#b9b09c'; for (let k = 0; k < 4; k++) g.fillRect(k * 78 - 6 + 9, y - 4, 7, 70); for (let k = 0; k < 3; k++) { const x = 26 + k * 78; g.fillStyle = '#1c2a2a'; g.beginPath(); g.moveTo(x, y + 60); g.lineTo(x, y + 22); g.arc(x + 24, y + 22, 24, Math.PI, 0); g.lineTo(x + 48, y + 60); g.fill(); g.strokeStyle = '#3d6e5a'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.moveTo(x + 24, y); g.lineTo(x + 24, y + 60); g.stroke(); } } });
    const em = textTex(512, 512, (g) => { g.scale(2, 2); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); for (let f = 0; f < 3; f++) for (let k = 0; k < 3; k++) if (Math.random() < .55) { const x = 26 + k * 78, y = 14 + f * 82; g.fillStyle = Math.random() < .7 ? '#ffb45a' : '#9fd0ff'; g.beginPath(); g.moveTo(x + 3, y + 58); g.lineTo(x + 3, y + 22); g.arc(x + 24, y + 22, 21, Math.PI, 0); g.lineTo(x + 45, y + 58); g.fill(); } });
    const up = new Batch(BOX, new THREE.MeshStandardMaterial({ map: fa, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: .8 })), col = new Batch(BOX, stdMat(0xd9d2c2, { roughness: .6, emissive: 0x3a2a18, emissiveIntensity: .5 }));
    const SHOP = ['청펀', '완탕면', '디저트', '량차', '곱창', '차시우', '찻집', '쌍피나이', '구멍가게', '보자이판'];
    const shops = SHOP.map((t, k) => new Batch(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.5, 1.5, 1.5), map: textTex(256, 128, (g) => {
      const gr = g.createLinearGradient(0, 34, 0, 128); gr.addColorStop(0, ['#ffd9a0', '#fff0c8', '#c8ecff', '#ffe0b0'][k % 4]); gr.addColorStop(1, '#6a4a22'); g.fillStyle = gr; g.fillRect(0, 34, 256, 94);
      g.fillStyle = 'rgba(40,20,5,.55)'; for (let i = 0; i < 5; i++) g.fillRect(14 + i * 50, 70 + (i % 2) * 8, 30, 58); g.fillStyle = ['#a01818', '#0d5a36', '#1a2e78', '#7a3a08'][k % 4]; g.fillRect(0, 0, 256, 36);
      g.fillStyle = '#ffe9a0'; g.font = `900 28px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 128, 19); }) })));
    const PAS = [[1, .86, .6], [.95, .7, .68], [.7, .9, .78], [.98, .95, .85], [.75, .82, .95], [1, .78, .5]]; let n = 0;
    for (const side of [-1, 1]) for (let s = 0; s < T.LEN; s += 9) { T.at(s, 0, tmp); if (T.zn[tmp.i] !== 5 || Math.abs(T.curv[tmp.i]) > .014) continue; const nx = -tmp.tz * side, nz = tmp.tx * side, ry = Math.atan2(tmp.tx, tmp.tz);
      const cx = tmp.x + nx * (W + 6.2), cz = tmp.z + nz * (W + 6.2); if (!T.clear(cx, cz, 5.2)) continue; const h = 10 + (n * 7 % 3) * 3.2; n++;
      up.add(cx, 4.4 + h / 2, cz, 11, h, 9, ry, PAS[n % 6]); for (const o of [-4.1, 4.1]) col.add(tmp.x + nx * (W + 1.2) + tmp.tx * o, 2.2, tmp.z + nz * (W + 1.2) + tmp.tz * o, .8, 4.4, .8, ry);
      shops[n % 10].add(tmp.x + nx * (W + 5), 2.1, tmp.z + nz * (W + 5), 8.6, 4.1, 1, ry + side * Math.PI / 2); col.add(tmp.x + nx * (W + 8.5), 2.2, tmp.z + nz * (W + 8.5), 6.6, 4.4, 9, ry, [.35, .3, .25]);
      if (side > 0 && n % 2) { const a = new V3(tmp.x - nx * (W + 1.5), 7.6, tmp.z - nz * (W + 1.5)), b = new V3(tmp.x + nx * (W + 1.5), 7.6, tmp.z + nz * (W + 1.5)); B.wire.beam(a, b, .025); for (let k = 1; k < 8; k++) { const p = a.clone().lerp(b, k / 8); B.lantern.add(p.x, 7.6 - Math.sin(k / 8 * Math.PI) * .7 - .35, p.z, .33, .4, .33); } } }
    up.build(scene); col.build(scene); shops.forEach((b) => b.build(scene)); }

  // ---------- 네온 사인 ----------
  { const SIGN = [['청펀', '#ff4a3a'], ['완탕면', '#ffd23a'], ['디저트', '#ff6ad0'], ['량차', '#5affb0'], ['곱창', '#ff8a2a'], ['보자이판', '#ffe45a'], ['차시우', '#ff4a3a'], ['찻집', '#5ad0ff'], ['쌍피나이', '#ffffff'], ['구멍가게', '#5aff7a'], ['족발덮밥', '#ff8a2a'], ['소고기 볶음면', '#ffd23a'], ['포장마차', '#ff3a6a'], ['숙박', '#5ad0ff'], ['택배', '#ffe45a'], ['이발소', '#ff6ad0'], ['약국', '#5aff7a'], ['보양탕', '#ff8a2a']];
    const bs = SIGN.map(([t, c]) => new Batch(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: new THREE.Color().setRGB(2.4, 2.4, 2.4), map: textTex(96, 96 + t.length * 84, (g, w, h) => {
      g.fillStyle = '#07060a'; g.fillRect(0, 0, w, h); g.strokeStyle = c; g.lineWidth = 5; g.shadowColor = c; g.shadowBlur = 14; g.strokeRect(7, 7, w - 14, h - 14); g.fillStyle = c; g.font = `900 66px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...t].forEach((ch, i) => { g.fillText(ch, w / 2, 70 + i * 84); g.fillText(ch, w / 2, 70 + i * 84); }); }) })));
    let n = 0; for (const side of [-1, 1]) for (let s = 3; s < T.LEN; s += 5.5) { T.at(s, 0, tmp); const z = T.zn[tmp.i]; if (z !== 5 && z !== 6) continue; if (R() < (z === 6 ? .25 : .5)) continue;
      const k = Math.floor(R() * SIGN.length), len = SIGN[k][0].length, hh = (1 + len * .875) * (z === 6 ? 1.15 : 1), off = W + (z === 6 ? rr(1.6, 3.6) : rr(.9, 1.6)), y = (z === 6 ? rr(5.5, 15) : rr(5.6, 8.5)) + hh / 2;
      bs[k].add(tmp.x - tmp.tz * side * off, y, tmp.z + tmp.tx * side * off, z === 6 ? 1.15 : 1, hh, 1, Math.atan2(tmp.tx, tmp.tz) + Math.PI); n++; }
    bs.forEach((b) => b.build(scene));
    // 성중촌의 어지러운 전선
    for (let s = 0; s < T.LEN; s += 7) { T.at(s, 0, tmp); if (T.zn[tmp.i] !== 6) continue; const h = rr(8, 13); const a = new V3(tmp.x + tmp.tz * (W + 4.5), h, tmp.z - tmp.tx * (W + 4.5)), b = new V3(tmp.x - tmp.tz * (W + 4.5) + tmp.tx * rr(-5, 5), h + rr(-2, 2), tmp.z + tmp.tx * (W + 4.5) + tmp.tz * rr(-5, 5)); B.wire.beam(a, b, .035); if (R() < .5) B.wire.beam(a.clone().setY(h - .5), b.clone().setY(h + .3), .03); } }

  // ---------- 도로 표지 gantry ----------
  const gantries = [];
  for (let i = 0; i < T.N; i++) { const z = T.zn[i], zp = T.zn[(i + T.N - 1) % T.N]; if (z === zp) continue; T.at(i * T.seg - 26, 0, tmp); const ry = Math.atan2(tmp.tx, tmp.tz), nx = -tmp.tz, nz = tmp.tx;
    const EN = ['Liede Bridge', 'Zhujiang New Town', 'Huacheng Square', 'Sun Yat-sen Memorial Hall', 'Haizhu Bridge', 'Qilou Old Street', 'Urban Village', 'Canton Tower'];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.25, 1.25, 1.25), map: textTex(512, 160, (g) => { g.fillStyle = '#0a5f36'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(8, 8, 496, 144);
      g.fillStyle = '#fff'; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('↑ ' + ZNAME[z], 256, 66); g.font = `600 24px ${FONT}`; g.fillText(EN[z], 256, 122); }) }));
    m.position.set(tmp.x, 7.6, tmp.z); m.rotation.y = ry + Math.PI; scene.add(m); gantries.push(m);
    B.steel.add(tmp.x + nx * (W + .9), 4.6, tmp.z + nz * (W + .9), .16, 9.2, .16).add(tmp.x - nx * (W + .9), 4.6, tmp.z - nz * (W + .9), .16, 9.2, .16);
    B.steel.beam(new V3(tmp.x + nx * (W + .9), 9.1, tmp.z + nz * (W + .9)), new V3(tmp.x - nx * (W + .9), 9.1, tmp.z - nz * (W + .9)), .12); B.steel.beam(new V3(tmp.x + nx * (W + .9), 6.1, tmp.z + nz * (W + .9)), new V3(tmp.x - nx * (W + .9), 6.1, tmp.z - nz * (W + .9)), .1); }

  // ---------- 가로수(반얀과 꽃 피는 카폭) ----------
  for (const side of [-1, 1]) for (let s = 6; s < T.LEN; s += 13) { T.at(s, side * (W + 3.6), tmp); const z = T.zn[tmp.i]; if (z !== 2 && z !== 3 && z !== 7 && z !== 1) continue; if (!T.clear(tmp.x, tmp.z, 2)) continue;
    const kapok = (z === 3 || z === 2) && R() < .45, h = rr(4.5, 6.5); B.trunk.add(tmp.x, h / 2, tmp.z, .22, h, .22);
    for (let k = 0; k < 4; k++) B.leaf.add(tmp.x + rr(-1.4, 1.4), h + rr(-.2, 1.6), tmp.z + rr(-1.4, 1.4), rr(1.3, 2.2), rr(1.1, 1.7), rr(1.3, 2.2), rr(0, 3), kapok ? [rr(.45, .6), rr(.04, .09), .03] : [.025, rr(.07, .12), .035]); }
  for (let k = 0; k < 60; k++) { const a = rr(0, 6.28), r = rr(44, 75), x = -280 + Math.cos(a) * r, z = -225 + Math.sin(a) * r; if (!T.clear(x, z, 3)) continue; const h = rr(5, 8); B.trunk.add(x, h / 2, z, .3, h, .3); for (let j = 0; j < 4; j++) B.leaf.add(x + rr(-2, 2), h + rr(0, 2), z + rr(-2, 2), rr(2, 3), rr(1.5, 2.2), rr(2, 3), 0, R() < .4 ? [rr(.45, .6), .06, .03] : [.025, rr(.07, .12), .035]); }
  Object.values(B).forEach((b) => b.build(scene)); coneB.build(scene);

  // ---------- 주장 야간 유람선 ----------
  const boat = new THREE.Group(); { const hull = new THREE.Mesh(BOX, stdMat(0xe8e8f0)); hull.scale.set(26, 2.4, 6); hull.position.y = -3.9; boat.add(hull);
    [[22, .5, 5.4, -2.3, [2.5, .5, 1.6]], [18, .4, 4.6, -.6, [.4, 2.2, 2.6]], [13, .4, 3.8, 1, [2.6, 1.9, .4]]].forEach(([l, h, d, y, c]) => { const m = new THREE.Mesh(BOX, glow(...c)); m.scale.set(l, h, d); m.position.y = y; boat.add(m); const cab = new THREE.Mesh(BOX, stdMat(0x202430)); cab.scale.set(l - .6, 1.3, d - .5); cab.position.y = y - .85; boat.add(cab); });
    boat.traverse((o) => o.layers.set(1)); scene.add(boat); }

  // ---------- 빗줄기 ----------
  { const K = 900, pos = new Float32Array(K * 6), en = new Float32Array(K * 2); for (let i = 0; i < K; i++) { const x = R() * 60, y = R() * 40, z = R() * 60; pos.set([x, y, z, x, y, z], i * 6); en[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(en, 1));
    const rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uTime*34.0, 40.0) - 4.0 + aEnd*1.3; p.xz = mod(p.xz - uCam.xz, 60.0) - 30.0 + uCam.xz; p.x += aEnd*.12; vA = 1.0-aEnd*.7; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0); }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(.5,.6,.8)*.16*vA, 1.0); }` })); rain.frustumCulled = false; rain.layers.set(1); scene.add(rain); }

  // ---------- 파티클 ----------
  function makePool(n, additive) { const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n), vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n), par = new Float32Array(n * 4); let head = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 500 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize*uScale/max(-mv.z, .5); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord-.5)*2.0; float a = smoothstep(1.0, ${additive ? '.0' : '.2'}, d); gl_FragColor = vec4(vC.rgb${additive ? '*a*vC.a' : ''}, ${additive ? '1.0' : 'a*vC.a'}); }` }));
    m.frustumCulled = false; scene.add(m); for (let i = 0; i < n; i++) pos[i * 3 + 1] = -99;
    return { mesh: m, spawn(x, y, z, vx, vy, vz, lf, sz, r, gg, b, a = 1, grow = 0, drag = 0, grav = 0) { const i = head; head = (head + 1) % n; pos.set([x, y, z], i * 3); vel.set([vx, vy, vz], i * 3); life[i] = max[i] = lf; size[i] = sz; col.set([r, gg, b, a], i * 4); par.set([grow, drag, grav, a], i * 4); },
      update(dt) { for (let i = 0; i < n; i++) { if (life[i] <= 0) continue; life[i] -= dt; const o = i * 3; if (life[i] <= 0) { pos[o + 1] = -99; continue; }
        const dr = Math.exp(-par[i * 4 + 1] * dt); vel[o] *= dr; vel[o + 1] = vel[o + 1] * dr - par[i * 4 + 2] * dt; vel[o + 2] *= dr; pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt; if (pos[o + 1] < .03 && par[i * 4 + 2] > 0) { pos[o + 1] = .03; vel[o + 1] *= -.35; }
        size[i] += par[i * 4] * dt; col[i * 4 + 3] = par[i * 4 + 3] * Math.min(1, life[i] / max[i] * 2); }
        g.attributes.position.needsUpdate = g.attributes.aCol.needsUpdate = g.attributes.aSize.needsUpdate = true; } }; }
  const fx = { add: makePool(700, true), smoke: makePool(260, false) };

  // 테일라이트 잔상
  function makeTrail(M, width) { const pos = new Float32Array(M * 6), al = new Float32Array(M * 2), idx = []; for (let i = 0; i < M - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color().setRGB(3, .2, .1) } },
      vertexShader: `attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`, fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol*vA*vA*vA, 1.0); }` });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m); const pts = []; let acc = 0;
    return { mat, reset() { pts.length = 0; }, push(x, y, z, rx, rz, dt) { acc += dt; if (acc > .016 || !pts.length) { acc = 0; pts.unshift([x, y, z, rx, rz]); if (pts.length > M) pts.pop(); } else { pts[0] = [x, y, z, rx, rz]; }
      for (let i = 0; i < M; i++) { const p = pts[Math.min(i, pts.length - 1)], o = i * 6; pos[o] = p[0] - p[3] * width; pos[o + 1] = p[1]; pos[o + 2] = p[2] - p[4] * width; pos[o + 3] = p[0] + p[3] * width; pos[o + 4] = p[1]; pos[o + 5] = p[2] + p[4] * width; al[i * 2] = al[i * 2 + 1] = i < pts.length ? 1 - i / M : 0; }
      g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = true; } }; }
  const trail = makeTrail(26, .07);

  // ---------- 전동 스쿠터와 라이더 ----------
  const paint = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .32, metalness: .2, clearcoat: 1, clearcoatRoughness: .12 }), matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 }), lightM = new THREE.MeshBasicMaterial({ vertexColors: true });
  const TOR = new THREE.TorusGeometry(.25, .085, 10, 22).rotateY(Math.PI / 2);
  const bike = new THREE.Group(), lean = new THREE.Group(); bike.add(lean);
  { const P = [], M = [], L = []; const C = 0x17c8d8, K = 0x101216;
    P.push(part(BOX, C, 0, .36, -.05, 0, 0, 0, .34, .1, .78), part(BOX, C, 0, .58, -.52, .25, 0, 0, .36, .34, .62), part(BOX, C, 0, .72, .42, -.32, 0, 0, .4, .62, .1), part(SPH, C, 0, .44, .62, 0, 0, 0, .13, .1, .2), part(SPH, C, 0, .47, -.72, 0, 0, 0, .14, .1, .22));
    M.push(part(BOX, K, 0, .84, -.42, .05, 0, 0, .3, .1, .6), part(TOR, K, 0, .3, -.62), part(CYL, 0x555a66, 0, .3, -.62, 0, 0, Math.PI / 2, .16, .12, .16), part(BOX, K, 0, .26, 0, 0, 0, 0, .2, .1, .5));
    // 배달통
    P.push(part(BOX, 0xffc400, 0, 1.14, -.72, 0, 0, 0, .5, .42, .46)); M.push(part(BOX, K, 0, 1.36, -.72, 0, 0, 0, .52, .03, .48), part(BOX, K, 0, .92, -.72, 0, 0, 0, .44, .05, .4));
    L.push(part(BOX, 0xff2010, 0, .74, -.86, 0, 0, 0, .3, .05, .04, 5), part(BOX, 0x30f0ff, 0, 1.14, -.955, 0, 0, 0, .36, .03, .01, 3), part(BOX, 0x30f0ff, .255, 1.14, -.72, 0, 0, 0, .01, .03, .32, 3), part(BOX, 0x30f0ff, -.255, 1.14, -.72, 0, 0, 0, .01, .03, .32, 3));
    // 라이더
    const J = 0xffd400, SK = 0xe0a882;
    M.push(part(SPH, J, 0, 1.2, -.22, .25, 0, 0, .22, .3, .17), part(SPH, 0x22262e, 0, .92, -.2, 0, 0, 0, .2, .13, .2), part(SPH, SK, 0, 1.5, -.1, 0, 0, 0, .1, .1, .1));
    P.push(part(SPH, J, 0, 1.6, -.08, .1, 0, 0, .16, .15, .175)); M.push(part(BOX, K, 0, 1.58, .07, .25, 0, 0, .22, .09, .03));
    for (const s of [-1, 1]) { M.push(part(CYL, J, s * .24, 1.24, .08, -1.05, 0, s * .12, .055, .5, .055), part(SPH, K, s * .27, 1.1, .33, 0, 0, 0, .06, .06, .06), part(CYL, 0x22262e, s * .15, .78, .06, -1.25, 0, 0, .075, .46, .075), part(CYL, 0x22262e, s * .15, .56, .27, .15, 0, 0, .06, .4, .06), part(BOX, 0xf0f0f0, s * .15, .4, .32, 0, 0, 0, .1, .07, .24)); }
    lean.add(merged(P, paint), merged(M, matte), merged(L, lightM)); }
  const front = new THREE.Group(); front.position.set(0, 0, .6); lean.add(front);
  front.add(merged([part(TOR, 0x101216, 0, .3, .12), part(CYL, 0x555a66, 0, .3, .12, 0, 0, Math.PI / 2, .16, .12, .16), part(CYL, 0x8a8f9a, 0, .7, .0, -.3, 0, 0, .03, .86, .03), part(CYL, 0x101216, 0, 1.12, -.12, 0, 0, Math.PI / 2, .025, .62, .025)], matte), merged([part(SPH, 0xfff2d0, 0, .86, .0, 0, 0, 0, .09, .07, .05, 6)], lightM));
  const under = new THREE.Mesh(new THREE.PlaneGeometry(.9, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0, 2.2, 2.6), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, map: textTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }) }));
  under.rotation.x = -Math.PI / 2; under.position.y = .05; bike.add(under);
  const head = new THREE.SpotLight(0xfff0d8, 70, 45, .45, .7, 1.6); head.position.set(0, 1.0, .7); head.target.position.set(0, .2, 12); bike.add(head, head.target);
  const aura = new THREE.PointLight(0x30e0ff, 0, 14, 1.8); aura.position.set(0, 1.2, -.4); bike.add(aura);
  const keyL = new THREE.PointLight(0xffe2c0, 14, 9, 1.6); keyL.position.set(.6, 3.2, -2.4); bike.add(keyL);
  scene.add(bike);

  // ---------- 도로 위의 차 ----------
  function makeCar(kind, hue) { const g = new THREE.Group(), P = [], D = [], L = []; const c = new THREE.Color().setHSL(hue, .65, .45).getHex();
    if (kind === 'bus') { P.push(part(BOX, 0x1f8f4e, 0, 1.7, 0, 0, 0, 0, 2.5, 2.7, 10.5), part(BOX, 0xe8e8e8, 0, 3.0, 0, 0, 0, 0, 2.52, .25, 10.52)); D.push(part(BOX, 0x0a0c10, 0, .4, 0, 0, 0, 0, 2.3, .5, 9.6));
      L.push(part(BOX, 0xffe9b0, 0, 2.1, 0, 0, 0, 0, 2.54, .85, 9.4, 1.3), part(BOX, 0xff2010, 0, 1.0, -5.27, 0, 0, 0, 2.2, .18, .04, 5), part(BOX, 0xffb020, 0, 2.75, -5.27, 0, 0, 0, 1.5, .3, .04, 3), part(BOX, 0xfff0d0, 0, .9, 5.27, 0, 0, 0, 2.1, .18, .04, 5)); g.userData = { hl: 5.3, hw: 1.3 }; }
    else { const van = kind === 'van'; P.push(part(BOX, c, 0, .62, 0, 0, 0, 0, 1.8, .6, van ? 4.4 : 4.3), part(BOX, c, 0, van ? 1.35 : 1.14, van ? -.1 : -.2, 0, 0, 0, 1.68, van ? .9 : .52, van ? 3.9 : 2.3));
      D.push(part(BOX, 0x06080c, 0, van ? 1.4 : 1.15, van ? -.1 : -.2, 0, 0, 0, 1.7, van ? .5 : .42, van ? 3.7 : 2.1), part(BOX, 0x06080c, 0, .28, 0, 0, 0, 0, 1.7, .36, 3.9));
      L.push(part(BOX, 0xff2010, 0, .78, -2.16, 0, 0, 0, 1.6, .12, .04, 5), part(BOX, 0xfff0d0, 0, .7, 2.16, 0, 0, 0, 1.5, .12, .04, 5)); if (kind === 'taxi') L.push(part(BOX, 0xffe040, 0, 1.5, -.2, 0, 0, 0, .5, .16, .2, 3)); g.userData = { hl: 2.2, hw: .95 }; }
    g.add(merged(P, paint), merged(D, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .15, metalness: .8 })), merged(L, lightM)); scene.add(g); return g; }

  // ---------- 픽업/배달 광문 ----------
  const gate = new THREE.Group(); const gateMat = glow(1, 1, 1), gateTexC = document.createElement('canvas'); gateTexC.width = 512; gateTexC.height = 128; const gateTex = new THREE.CanvasTexture(gateTexC); gateTex.colorSpace = THREE.SRGBColorSpace;
  { for (const s of [-1, 1]) { const p = new THREE.Mesh(BOX, gateMat); p.scale.set(.35, 6.4, .35); p.position.set(s * (W - .2), 3.2, 0); gate.add(p); } const b = new THREE.Mesh(BOX, gateMat); b.scale.set(W * 2, .3, .35); b.position.y = 6.4; gate.add(b);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), new THREE.MeshBasicMaterial({ map: gateTex, transparent: true, side: THREE.DoubleSide, color: new THREE.Color().setRGB(1.7, 1.7, 1.7) })); t.position.y = 8.2; t.rotation.y = Math.PI; gate.add(t);
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 6.2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color() }, uTime: U.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`, fragmentShader: `varying vec2 vUv; uniform vec3 uCol; uniform float uTime; void main(){ float s = .5+.5*sin(vUv.y*30.0 - uTime*6.0); gl_FragColor = vec4(uCol*(.10+.25*s*pow(1.0-vUv.y,2.0) + .5*pow(1.0-vUv.y, 6.0)), 1.0); }` })); cur.position.y = 3.1; gate.add(cur); gate.userData.cur = cur; scene.add(gate); }
  function setGate(s, label, pick) { T.at(s, 0, tmp); gate.position.set(tmp.x, 0, tmp.z); gate.rotation.y = Math.atan2(tmp.tx, tmp.tz); const c = pick ? [.3, 2.6, 1.0] : [2.8, 1.3, .2]; gateMat.color.setRGB(...c); gate.userData.cur.material.uniforms.uCol.value.setRGB(...c);
    const g = gateTexC.getContext('2d'); g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(6,8,14,.82)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 22); g.fill(); g.strokeStyle = pick ? '#4dffa0' : '#ffb040'; g.lineWidth = 6; g.stroke();
    g.fillStyle = pick ? '#4dffa0' : '#ffb040'; g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pick ? '픽 업' : '배 달', 256, 34); g.fillStyle = '#fff'; g.font = `900 46px ${FONT}`; g.fillText(label, 256, 86, 480); gateTex.needsUpdate = true; }

  // ---------- 후처리 ----------
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .65, .9); composer.addPass(bloom);
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uBoost: { value: 0 }, uHit: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed, uBoost, uHit, uTime, uFade; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    void main(){ vec2 c = vUv-vec2(.5,.56); float r2 = dot(c,c); float amt = (uSpeed*.026 + uBoost*.06)*smoothstep(.015,.3,r2); float ca = .0025+.004*uBoost+.006*uHit;
      vec3 col = vec3(0.0); for(int i=0;i<8;i++){ float t = float(i)/7.0; vec2 uv = vUv - c*amt*t; col += vec3(texture2D(tDiffuse, uv + c*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c*ca).b); } col /= 8.0;
      float l = dot(col, vec3(.2126,.7152,.0722)); col = mix(col, col*vec3(.86,1.0,1.16), smoothstep(.35,0.0,l)*.7); col = mix(vec3(l), col, 1.14);
      col *= 1.0 - dot(vUv-.5, vUv-.5)*1.1; col += vec3(1.0,.15,.08)*uHit*r2*2.0; col += (hash(vUv*900.0+uTime)-.5)*.014; gl_FragColor = vec4(col*uFade, 1.0); }` });
  composer.addPass(grade); composer.addPass(new OutputPass());

  const look = new V3(); let portrait = false, qLevel = 0; const QL = [1.5, 1.2, 1, .8, .65];
  function resize() { const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight, pr = Math.min(devicePixelRatio || 1, QL[qLevel]);
    renderer.setPixelRatio(pr); renderer.setSize(w, h); composer.setPixelRatio(pr); composer.setSize(w, h); camera.aspect = mirrorCam.aspect = w / h; portrait = h > w;
    mirrorRT.setSize(Math.max(2, Math.round(w * pr * .45)), Math.max(2, Math.round(h * pr * .45))); U.uRes.value.set(w * pr, h * pr); fx.add.mesh.material.uniforms.uScale.value = fx.smoke.mesh.material.uniforms.uScale.value = h * pr * .9; }
  function setCam(px, py, pz, lx, ly, lz, fov) { camera.position.set(px, py, pz); look.set(lx, ly, lz); camera.fov = fov; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); camera.lookAt(look); }
  function render(dt) { U.uTime.value += dt; grade.uniforms.uTime.value = U.uTime.value; U.uCam.value.copy(camera.position);
    sky.position.set(camera.position.x, 0, camera.position.z); skyline.position.set(camera.position.x * .6, 150, camera.position.z * .6);
    boat.position.set(((U.uTime.value * 6 + 300) % 900) - 450, 0, 14);
    fx.add.update(dt); fx.smoke.update(dt);
    mirrorCam.fov = camera.fov; mirrorCam.updateProjectionMatrix(); mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z); mirrorCam.up.set(0, 1, 0); mirrorCam.lookAt(look.x, -look.y, look.z);
    under.visible = false; renderer.setRenderTarget(mirrorRT); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null); under.visible = true;
    composer.render(dt); }
  resize();
  const lowerQuality = () => { if (qLevel < QL.length - 1 && (devicePixelRatio || 1) > QL[qLevel + 1] - .01) { qLevel++; resize(); return true; } if (qLevel < QL.length - 1) { qLevel = QL.length - 1; } return false; };
  return { renderer, scene, camera, lowerQuality, quality: () => qLevel, track: T, U, grade, bloom, fx, trail, bike, lean, front, under, aura, head, makeCar, setGate, gate, setCam, render, resize, isPortrait: () => portrait };
      }
