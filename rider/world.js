// 《메아리: 라이더》의 세계: 5×5 블록의 구도심, 낮밤과 날씨 포함. 바닥, 건물 창문, 하늘을 모두 셰이더에서 실시간으로 계산해 이미지 에셋이 전혀 없다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------- 블록 크기(미터) ----------
// 도로 중심선은 c(i) = -HALF + i * P, i = 0..NB; 노면 반폭 5(양방향 각 한 차선), 양쪽에 3m 인도, 그 안쪽이 블록
export const P = 72, NB = 5, HALF = P * NB / 2, ROAD = 5, WALK = 8;
export const c = (i) => -HALF + i * P;
export const WEATHER = {
  clear: { name: '맑음', cover: 0.12, fog: 0.0016, wet: 0, rain: 0 }, cloudy: { name: '흐림', cover: 0.62, fog: 0.0024, wet: 0, rain: 0 },
  drizzle: { name: '이슬비', cover: 0.9, fog: 0.0045, wet: 0.7, rain: 0.45 }, storm: { name: '폭우', cover: 1, fog: 0.0075, wet: 1, rain: 1 },
  fog: { name: '짙은 안개', cover: 0.75, fog: 0.019, wet: 0.3, rain: 0 },
};
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NOISE = `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;

export function createWorld(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1.6, 0.3, 1400); camera.layers.enable(2);
  const R = rng(20261116), rr = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
  const U = {                                                       // 모든 셰이더가 공유하는 환경 값, 매 프레임 한 번 갱신
    uTime: { value: 0 }, uWet: { value: 0 }, uRain: { value: 0 }, uNight: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
    uAmb: { value: new THREE.Color(0.4, 0.45, 0.5) }, uFogCol: { value: new THREE.Color(0.6, 0.7, 0.8) }, uFogDen: { value: 0.002 }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uCover: { value: 0.2 },
    tRefl: { value: null }, uReflVP: { value: new THREE.Matrix4() }, uHead: { value: new THREE.Vector4(0, 0, 0, 1) }, uHeadK: { value: 0 }, uFlash: { value: 0 },
  };

  // ---------- 하늘 ----------
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 uZen, uHor, uSunDir, uSunCol; uniform float uCover, uTime, uNight, uFlash; varying vec3 vD; ${NOISE}
      void main(){
        vec3 d = normalize(vD); float up = max(d.y, 0.0);
        vec3 col = mix(uHor, uZen, pow(up, 0.55));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunCol * (pow(sd, 900.0) * 30.0 + pow(sd, 12.0) * 0.35 + pow(sd, 3.0) * 0.12) * (1.0 - uCover * 0.92);            // 태양과 빛무리
        vec2 cp = d.xz / (up + 0.12) * 1.3 + uTime * 0.006;
        float cl = fbm(cp) * 0.65 + fbm(cp * 2.7 + 9.0) * 0.35; float cm = smoothstep(0.62 - uCover * 0.5, 0.86 - uCover * 0.42, cl);                // 구름
        vec3 cc = mix(uHor * 1.15 + uSunCol * 0.25 * pow(sd, 2.0), uZen * 0.55 + uHor * 0.25, smoothstep(0.3, 1.0, cl)) * (1.0 - uCover * 0.45);
        col = mix(col, cc + uFlash * vec3(0.9, 0.95, 1.2) * cl, cm * smoothstep(0.0, 0.12, up));
        float st = step(0.9985, h21(floor(d.xz / (up + 0.2) * 220.0))) * uNight * (1.0 - cm) * smoothstep(0.05, 0.4, up); col += vec3(st);     // 별
        col = mix(col, uHor, pow(1.0 - up, 9.0));                                                                                                     // 지평선의 아지랑이
        if (d.y < 0.0) col = mix(uHor, uHor * 0.5, min(1.0, -d.y * 4.0));
        gl_FragColor = vec4(col, 1.0);
      }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(sky.geometry, skyMat)); const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null, envT = 0;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 420 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06; scene.add(sun, sun.target);

  // ---------- 바닥: 아스팔트, 차선, 횡단보도, 인도 블록, 물웅덩이와 반사까지 전부 하나의 셰이더에서 ----------
  const groundMat = new THREE.ShaderMaterial({ uniforms: U, fog: false,
    vertexShader: 'varying vec3 vW; varying vec4 vR; uniform mat4 uReflVP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vR = uReflVP * w; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D tRefl; uniform vec3 uSunDir, uSunCol, uAmb, uFogCol; uniform float uTime, uWet, uRain, uNight, uFogDen, uHeadK; uniform vec4 uHead; varying vec3 vW; varying vec4 vR; ${NOISE}
      const float P = ${P}.0, HALF = ${HALF}.0;
      float ring(vec2 p, float t) {                                    // 빗방울이 수면에 만드는 동그란 파문
        vec2 g = floor(p), f = fract(p) - 0.5; float h = h21(g), ph = fract(t * (0.7 + h * 0.6) + h * 7.0), r = ph * 0.48;
        vec2 o = (vec2(h21(g + 3.1), h21(g + 7.7)) - 0.5) * 0.4; float d = length(f - o); return sin((d - r) * 60.0) * smoothstep(0.06, 0.0, abs(d - r)) * (1.0 - ph);
      }
      void main(){
        vec2 p = vW.xz; vec2 q = mod(p + HALF, P); vec2 d = min(q, P - q);                                         // d: 가장 가까운 세로 도로 / 가로 도로 중심선까지의 거리
        float inMap = step(abs(p.x), HALF + 8.5) * step(abs(p.y), HALF + 8.5);
        float rx = step(d.x, ${ROAD}.0), rz = step(d.y, ${ROAD}.0), road = max(rx, rz) * inMap, cross = rx * rz;
        float walk = (max(step(d.x, ${WALK}.0), step(d.y, ${WALK}.0)) - max(rx, rz)) * inMap;
        float n1 = fbm(p * 0.35), n2 = vn(p * 9.0), n3 = fbm(p * 0.045 + 3.0);
        // 아스팔트: 명암이 고르지 않고, 바퀴가 자주 지나는 자리가 더 밝고 반짝임
        vec3 alb = vec3(0.058, 0.06, 0.066) * (0.75 + 0.5 * n1) + vec3(0.02) * n2;
        float lane = mix(d.x, d.y, rz * (1.0 - rx));                                                                 // 도로 위일 때 이 도로 중심선까지의 거리
        alb *= 1.0 + 0.25 * exp(-pow((lane - 2.6) * 1.1, 2.0));
        float along = mix(p.y, p.x, rz * (1.0 - rx)), wear = 0.55 + 0.45 * vn(p * 1.7);
        float mid = smoothstep(0.16, 0.1, abs(lane - 0.22)) + smoothstep(0.16, 0.1, lane) * 0.0;                       // 이중 황색 실선
        float edge = smoothstep(0.09, 0.05, abs(lane - 4.55));
        float nearX = step(d.y, ${WALK}.0 + 4.0), nearZ = step(d.x, ${WALK}.0 + 4.0);                                 // 교차로 접근
        float nearI = mix(nearX, nearZ, rz * (1.0 - rx));
        vec3 paint = vec3(0.0);
        paint += vec3(0.75, 0.6, 0.12) * mid * (1.0 - nearI) * wear; paint += vec3(0.7) * edge * (1.0 - nearI) * wear;
        float zd = mix(d.y, d.x, rz * (1.0 - rx));                                                                     // 횡단보도와 정지선: 교차로 바깥 가장자리
        float zebra = step(${ROAD}.0 + 1.0, zd) * step(zd, ${ROAD}.0 + 4.0) * step(fract((mix(p.x, p.y, rz * (1.0 - rx))) * 0.85), 0.5) * (1.0 - cross);
        float stopl = smoothstep(0.22, 0.15, abs(zd - (${ROAD}.0 + 5.2))) * step(0.3, lane) * (1.0 - cross);
        paint += vec3(0.72) * (zebra + stopl) * wear;
        vec3 col = mix(alb, paint, clamp(max(max(paint.r, paint.g), paint.b) * 1.6, 0.0, 1.0)) ; col = mix(alb, col, road);
        // 인도 보도블록과 블록 안의 바닥 타일
        vec2 tg = abs(fract(p / 0.6) - 0.5); float tl = smoothstep(0.47, 0.5, max(tg.x, tg.y));
        vec3 walkC = vec3(0.21, 0.2, 0.19) * (0.8 + 0.4 * h21(floor(p / 0.6))) * (1.0 - tl * 0.45);
        float curb = smoothstep(0.25, 0.0, abs(min(d.x, d.y) - ${ROAD}.0 - 0.12)) ; walkC = mix(walkC, vec3(0.32), curb * 0.8);
        vec2 pg = abs(fract(p / 2.4) - 0.5); float pl = smoothstep(0.48, 0.5, max(pg.x, pg.y));
        vec3 plaza = vec3(0.15, 0.15, 0.155) * (0.8 + 0.4 * n1) * (1.0 - pl * 0.4);
        vec3 outside = vec3(0.05, 0.07, 0.045) * (0.7 + 0.6 * n1);
        col = mix(mix(plaza, outside, 1.0 - inMap), walkC, walk); col = mix(col, mix(alb, mix(alb, paint, clamp(max(max(paint.r, paint.g), paint.b) * 1.6, 0.0, 1.0)), 1.0), road);
        // 젖음: 웅덩이는 거울처럼 고이고 나머지는 축축함. 노면이 인도보다 물이 더 잘 고임
        float low = smoothstep(0.42, 0.62, n3 * 0.7 + n1 * 0.3 + road * 0.07 - walk * 0.05);
        float puddle = low * smoothstep(0.25, 0.9, uWet) * inMap, damp = uWet;
        col *= mix(1.0, 0.55, damp); col = mix(col, col * 0.5, puddle);
        float rough = mix(mix(0.92, 0.42, damp), 0.03, puddle);
        vec3 N = normalize(vec3((vn(p * 14.0) - 0.5) * 0.25 * (1.0 - puddle), 1.0, (vn(p * 14.0 + 5.0) - 0.5) * 0.25 * (1.0 - puddle)));
        if (uRain > 0.01) { float rp = (ring(p * 1.6, uTime) + ring(p * 2.3 + 4.0, uTime * 1.3)) * uRain * (0.25 + 0.75 * puddle); N = normalize(N + vec3(rp, 0.0, rp) * 0.5); }
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        // 빛: 하늘빛 + 태양 + 밤의 가로등이 바닥에 만드는 빛점 + 헤드라이트
        vec3 light = uAmb + uSunCol * max(dot(N, uSunDir), 0.0);
        vec2 lv = vec2(${ROAD}.0 + 1.6 - d.x, mod(p.y, 24.0) - 12.0), lh = vec2(mod(p.x, 24.0) - 12.0, ${ROAD}.0 + 1.6 - d.y);
        float pool = exp(-dot(lv, lv) / 55.0) * step(d.x, 14.0) + exp(-dot(lh, lh) / 55.0) * step(d.y, 14.0);
        light += vec3(1.0, 0.62, 0.28) * pool * uNight * 0.85 * inMap;
        vec2 hd = p - uHead.xy; float hl = length(hd), hc = dot(hd / max(hl, 0.01), uHead.zw);
        light += vec3(0.9, 0.95, 1.0) * uHeadK * smoothstep(0.86, 0.985, hc) * exp(-hl / 16.0) * 2.6;
        vec3 outc = col * light;
        vec3 Hh = normalize(V + uSunDir); outc += uSunCol * pow(max(dot(N, Hh), 0.0), mix(12.0, 600.0, 1.0 - rough)) * (1.0 - rough) * 0.9;
        // 반사: 물웅덩이는 선명한 거울상, 축축한 노면은 세로로 길게 번진 반사광
        vec2 ruv = vR.xy / vR.w * 0.5 + 0.5 + N.xz * 0.045;
        float blur = rough * 0.05 * (1.0 + 26.0 / (dist + 8.0));
        vec3 refl = texture2D(tRefl, ruv).rgb * 0.4;
        refl += (texture2D(tRefl, ruv + vec2(0.0, blur)).rgb + texture2D(tRefl, ruv + vec2(0.0, -blur * 0.6)).rgb + texture2D(tRefl, ruv + vec2(blur * 0.25, blur * 2.1)).rgb + texture2D(tRefl, ruv + vec2(-blur * 0.25, blur * 3.4)).rgb) * 0.15;
        float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float wk = mix(mix(0.06, 0.5, damp), 1.0, puddle) * inMap;
        outc = mix(outc, refl, clamp(F * wk * 1.25 + puddle * 0.1, 0.0, 1.0));
        outc = mix(uFogCol, outc, exp(-dist * uFogDen));
        gl_FragColor = vec4(outc, 1.0);
      }` });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800).rotateX(-Math.PI / 2), groundMat); ground.layers.set(2); scene.add(ground);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.5 })); shadowCatcher.position.y = 0.02; shadowCatcher.receiveShadow = true; shadowCatcher.layers.set(2); scene.add(shadowCatcher);

  // ---------- 건물: 인스턴싱된 상자 하나, 창문은 셰이더에서 그림. 밤엔 확률로 불이 켜짐 ----------
  const bldMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  bldMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.uNight; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vec4 wp4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp4 = instanceMatrix * wp4;\n#endif\n vWp = (modelMatrix * wp4).xyz;');
    sh.fragmentShader = 'varying vec3 vWp; uniform float uNight, uTime;\n float bh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 nW = normalize(cross(dFdx(vWp), dFdy(vWp))); float side = 1.0 - step(0.5, abs(nW.y));
        float fu = abs(nW.x) > 0.5 ? vWp.z : vWp.x, fv = vWp.y;
        vec2 wc = vec2(fu / 3.1, (fv - 4.6) / 3.3), wi = floor(wc), wf = fract(wc);
        float upper = step(4.6, fv) * side, win = upper * step(0.16, wf.x) * step(wf.x, 0.84) * step(0.2, wf.y) * step(wf.y, 0.82);
        float shop = (1.0 - step(4.6, fv)) * side * step(0.5, fv), glassS = shop * step(0.08, fract(fu / 4.2)) * step(fract(fu / 4.2), 0.92) * step(fv, 3.6);
        float wr = bh(wi + floor(vWp.xz * 0.02) * 7.0), lit = step(1.0 - (0.18 + 0.5 * uNight), wr) * win, band = step(0.94, fract(fv / 3.3 - 0.05)) * upper;
        diffuseColor.rgb *= 1.0 - band * 0.25; diffuseColor.rgb *= 0.9 + 0.2 * bh(floor(vec2(fu, fv) * 0.7));
        float frame = upper * step(0.1, wf.x) * step(wf.x, 0.9) * step(0.14, wf.y) * step(wf.y, 0.88) - win; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + 0.05, clamp(frame, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.03, 0.045), max(win, glassS));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, (1.0 - side) );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.06, max(win, glassS));')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 wcol = mix(vec3(1.0, 0.72, 0.38), vec3(0.75, 0.9, 1.0), step(0.72, bh(wi + 9.0))) * (0.5 + 0.7 * bh(wi + 3.0));
        float curtain = 0.55 + 0.45 * step(wf.y, 0.4 + 0.4 * bh(wi + 5.0));
        totalEmissiveRadiance += wcol * lit * curtain * uNight * 0.55;
        float shelf = 0.55 + 0.45 * step(0.5, fract(fv * 1.3)) * step(0.3, fract(fu * 0.9));                         // 가게 안 선반과 조명 간판, 통짜 흰색이 아님
        vec3 scol = mix(vec3(1.0, 0.8, 0.55), vec3(0.7, 0.9, 1.0), step(0.6, bh(floor(vec2(fu / 4.2, 2.0)) + floor(vWp.xz * 0.02))));
        totalEmissiveRadiance += scol * glassS * (0.04 + 0.5 * uNight) * shelf * (0.3 + 0.7 * bh(floor(vec2(fu / 4.2, 1.0)) + floor(vWp.xz * 0.02)));`);
  };
  const blds = [], signs = [], shops = [], homes = [], solids = [];
  const SHOP_NAMES = ['김밥천국', '할매 순대국', '심야 포차', '카페 온기', '한입 치킨', '따뜻한 죽집', '마라탕 대왕', '큰그릇 국수', '사천 볶음', '생과일 컷', '버거 공방', '만두 이야기', '골목 커피', '뚝배기 쌀국수', '족발 연구소', '샐러드 한끼'];
  const SIGN_COL = ['#ff3b5c', '#ffb02e', '#35e0a0', '#4ac8ff', '#ff7ae0', '#fff06a', '#ff6a3c', '#9a8cff'];
  const HOME_A = ['금호 타운', '햇살 아파트', '강변 파크', '학정 마을', '행복 주택', '버들 공관', '남쪽 이야기', '청호 자이'], HOME_B = ['창업 센터', '월드 타워', '시립 병원', '제일중학교', '테크 밸리', '방송국', '체육관', '청년 레지던스'];
  const WALLS = [[0.42, 0.36, 0.3], [0.3, 0.33, 0.38], [0.5, 0.42, 0.3], [0.24, 0.27, 0.33], [0.44, 0.3, 0.24], [0.52, 0.5, 0.46], [0.22, 0.27, 0.28], [0.4, 0.34, 0.4], [0.55, 0.35, 0.28], [0.3, 0.38, 0.36]];
  let shopI = 0;
  for (let bi = 0; bi < NB; bi++) for (let bj = 0; bj < NB; bj++) {
    const x0 = c(bi) + WALK, z0 = c(bj) + WALK, B = P - WALK * 2, central = 1 - Math.hypot(bi - 2, bj - 2) / 3;
    solids.push({ x0, z0, x1: x0 + B, z1: z0 + B });
    for (let li = 0; li < 2; li++) for (let lj = 0; lj < 2; lj++) {
      const w = rr(21, 25), d = rr(21, 25), h = R() < 0.22 + central * 0.25 ? rr(34, 60 + central * 30) : rr(11, 27), cx = x0 + (li ? B - w / 2 - 0.4 : w / 2 + 0.4), cz = z0 + (lj ? B - d / 2 - 0.4 : d / 2 + 0.4);
      blds.push({ x: cx, z: cz, w, d, h, col: pick(WALLS) });
      const faceX = R() < 0.5, nx = faceX ? (li ? 1 : -1) : 0, nz = faceX ? 0 : (lj ? 1 : -1), fx = cx + nx * w / 2, fz = cz + nz * d / 2;      // 길을 향한 벽면
      const door = { x: nx ? (li ? c(bi + 1) - 6.4 : c(bi) + 6.4) : cx, z: nz ? (lj ? c(bj + 1) - 6.4 : c(bj) + 6.4) : cz, nx, nz };
      if (R() < 0.62 && shopI < 40) { const k = shopI++ % SHOP_NAMES.length; signs.push({ x: fx + nx * 0.2, z: fz + nz * 0.2, nx, nz, k, w: Math.min(11, (nx ? d : w) * 0.6) }); shops.push({ name: SHOP_NAMES[k] + (shopI > 16 ? ' ' + '2345'[Math.floor((shopI - 1) / 16) - 1] + '호점' : ''), ...door }); }
      else homes.push({ name: (h > 30 ? pick(HOME_B) : pick(HOME_A) + ' ' + (1 + Math.floor(R() * 12)) + '동'), tall: h > 30, ...door });
    }
  }
  for (let i = -1; i <= NB; i++) for (let j = -1; j <= NB; j++) if (i < 0 || j < 0 || i >= NB || j >= NB) {     // 도심 바깥을 건물로 한 바퀴 둘러 멀리가 휑하지 않게
    for (let k = 0; k < 3; k++) { const w = rr(20, 34), d = rr(20, 34); blds.push({ x: c(i) + WALK + rr(w / 2, P - WALK * 2 - w / 2) + (i < 0 ? -6 : i >= NB ? 6 : 0), z: c(j) + WALK + rr(d / 2, P - WALK * 2 - d / 2) + (j < 0 ? -6 : j >= NB ? 6 : 0), w, d, h: rr(14, 70), col: pick(WALLS) }); }
  }
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  const bldMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bldMat, blds.length); bldMesh.castShadow = true; bldMesh.receiveShadow = true; bldMesh.frustumCulled = false;
  blds.forEach((b, i) => { dummy.position.set(b.x, b.h / 2, b.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); bldMesh.setMatrixAt(i, dummy.matrix); bldMesh.setColorAt(i, tc.setRGB(b.col[0], b.col[1], b.col[2])); });
  scene.add(bldMesh);

  // 간판: 16 개 상호가 그려진 그림 한 장, 간판마다 한 칸씩 사용
  const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 1024;
  { const g = atlas.getContext('2d'); g.fillStyle = '#05060a'; g.fillRect(0, 0, 1024, 1024);
    SHOP_NAMES.forEach((n, k) => { const x = (k % 2) * 512, y = Math.floor(k / 2) * 128, col = SIGN_COL[k % SIGN_COL.length]; g.fillStyle = '#0b0d14'; g.fillRect(x + 6, y + 6, 500, 116); g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(x + 10, y + 10, 492, 108);
      g.fillStyle = col; g.font = '900 72px "Noto Sans KR", "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 18; g.fillText(n, x + 256, y + 68); g.shadowBlur = 0; }); }
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
  const signGeo = new THREE.PlaneGeometry(1, 1); signGeo.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(signs.map((s) => s.k)), 1));
  const signMat = new THREE.ShaderMaterial({ uniforms: { ...U, tMap: { value: atlasTex } }, fog: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float aK; varying vec2 vUv; varying float vDist; void main(){ vUv = vec2((uv.x + mod(aK, 2.0)) * 0.5, 1.0 - (floor(aK / 2.0) + 1.0 - uv.y) / 8.0); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vDist = distance(w.xyz, cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform sampler2D tMap; uniform float uNight, uFogDen, uTime; uniform vec3 uFogCol; varying vec2 vUv; varying float vDist; void main(){ vec3 t = texture2D(tMap, vUv).rgb; vec3 col = t * (0.5 + 1.5 * uNight); gl_FragColor = vec4(mix(uFogCol, col, exp(-vDist * uFogDen)), 1.0); }' });
  const signMesh = new THREE.InstancedMesh(signGeo, signMat, signs.length); signMesh.frustumCulled = false;
  signs.forEach((s, i) => { dummy.position.set(s.x, 4.35, s.z); dummy.rotation.set(0, Math.atan2(s.nx, s.nz), 0); dummy.scale.set(s.w, s.w / 4, 1); dummy.updateMatrix(); signMesh.setMatrixAt(i, dummy.matrix); });
  scene.add(signMesh);

  // 가로등과 가로수: 도로 양쪽을 따라 24m 마다 등 하나, 등 사이에 나무 한 그루
  const lamps = [], trees = [];
  for (let i = 0; i <= NB; i++) for (let k = Math.ceil((-HALF - 4) / 24); k * 24 + 12 < HALF + 4; k++) for (const s of [-1, 1]) {
    const t = k * 24 + 12, off = ROAD + 1.6, nearCross = (v) => { const q = ((v + HALF) % P + P) % P; return Math.min(q, P - q) < WALK + 1; };
    if (!nearCross(t)) { lamps.push({ x: c(i) + s * off, z: t, ry: s > 0 ? Math.PI : 0 }); lamps.push({ x: t, z: c(i) + s * off, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 }); }
    if (!nearCross(t + 12)) { trees.push({ x: c(i) + s * (off + 0.6), z: t + 12, s: rr(0.8, 1.25) }); trees.push({ x: t + 12, z: c(i) + s * (off + 0.6), s: rr(0.8, 1.25) }); }
  }
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.5, metalness: 0.7 });
  const poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 7.4, 8).translate(0, 3.7, 0), metal, lamps.length), armM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.12, 0.14).translate(1.0, 7.35, 0), metal, lamps.length);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), headM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.12, 0.34).translate(1.75, 7.26, 0), headMat, lamps.length);
  const glowPos = new Float32Array(lamps.length * 3);
  lamps.forEach((l, i) => { dummy.position.set(l.x, 0, l.z); dummy.rotation.set(0, l.ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); poleM.setMatrixAt(i, dummy.matrix); armM.setMatrixAt(i, dummy.matrix); headM.setMatrixAt(i, dummy.matrix); glowPos.set([l.x + Math.cos(l.ry) * 1.75, 7.1, l.z - Math.sin(l.ry) * 1.75], i * 3); });
  poleM.castShadow = true; for (const m of [poleM, armM, headM]) { m.frustumCulled = false; scene.add(m); }
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  const glowMat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uFogDen; varying float vK; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vK = exp(mv.z * uFogDen * 0.6); gl_PointSize = (1.3 + uFogDen * 150.0) * 520.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uNight, uFogDen; varying float vK; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-d * d * 7.0) * 0.6 + exp(-d * 2.6) * (0.06 + uFogDen * 9.0); gl_FragColor = vec4(vec3(1.0, 0.66, 0.32) * a * uNight * vK, 1.0); }' });
  const glow = new THREE.Points(glowGeo, glowMat); glow.frustumCulled = false; scene.add(glow);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.9, flatShading: true });
  leafMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n float sw = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2; transformed.x += sin(uTime * 1.6 + sw + position.y) * 0.12 * position.y * 0.2; transformed.z += cos(uTime * 1.3 + sw) * 0.1 * position.y * 0.2;\n#endif'); };
  const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6).translate(0, 1.6, 0), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), trees.length);
  const leafG = new THREE.IcosahedronGeometry(1.9, 1); { const pa = leafG.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 0.82 + 0.36 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k * 0.85 + 4.4, pa.getZ(i) * k); } leafG.computeVertexNormals(); }
  const leafM = new THREE.InstancedMesh(leafG, leafMat, trees.length);
  trees.forEach((t, i) => { dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, i * 2.4, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix(); trunkM.setMatrixAt(i, dummy.matrix); leafM.setMatrixAt(i, dummy.matrix); leafM.setColorAt(i, tc.setHSL(0.29 + (i % 7) * 0.012, 0.5, 0.34 + (i % 5) * 0.03)); });
  for (const m of [trunkM, leafM]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }

  // ---------- 비: 카메라를 따라다니는 빗줄기 뭉치 ----------
  const RN = 5200, rainPos = new Float32Array(RN * 6), rainSeed = new Float32Array(RN * 2);
  for (let i = 0; i < RN; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); rainPos.set([x, y, z, x, y, z], i * 6); rainSeed.set([0, 1], i * 2); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3)); rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(rainSeed, 1));
  const rainMat = new THREE.ShaderMaterial({ uniforms: { ...U, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0.12, 0.05) } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aEnd; uniform float uTime, uRain; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
      void main(){ vec3 box = vec3(46.0, 26.0, 46.0); vec3 p = position * box; float sp = 24.0 + fract(position.x * 91.7) * 8.0; p.y -= uTime * sp; p.xz += uWind * (uTime * sp);
        p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam; p.y += aEnd * (0.5 + uRain * 0.6); p.xz -= uWind * aEnd * 0.9;
        vA = step(fract(position.z * 57.3), uRain * 0.95 + 0.03) * (0.25 + 0.4 * aEnd); vec4 mv = viewMatrix * vec4(p, 1.0); vA *= smoothstep(1.0, 4.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform vec3 uAmb; uniform float uNight; varying float vA; void main(){ gl_FragColor = vec4(mix(vec3(0.75, 0.82, 0.9), vec3(0.6, 0.66, 0.78), uNight) * (0.5 + length(uAmb)), vA * 0.5); }' });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.layers.set(2); scene.add(rain);

  // ---------- 반사용 미러 카메라와 캔버스 ----------
  const vcam = new THREE.PerspectiveCamera(), reflRT = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType }); U.tRefl.value = reflRT.texture;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpU = new THREE.Vector3();

  // ---------- 후처리: 블룸 → 앰비언트 오클루전, 톤, 비네트, 그레인, 고속 시 방사형 모션 블러 ----------
  const composer = new EffectComposer(renderer);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.depthTexture = new THREE.DepthTexture(1, 1); rt.depthTexture.type = THREE.UnsignedIntType; }
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.92); composer.addPass(bloom);
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uPI: { value: new THREE.Matrix4() }, uProjY: { value: 1 }, uAspect: { value: 1 }, uTime: { value: 0 }, uPx: { value: new THREE.Vector2() }, uSpeed: { value: 0 }, uHurt: { value: 0 }, uWetLens: { value: 0 }, uExpo: { value: 1 }, uSat: { value: 1.12 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform mat4 uPI; uniform float uProjY, uAspect, uTime, uSpeed, uHurt, uWetLens, uExpo, uSat; uniform vec2 uPx; varying vec2 vUv;
      float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 vpos(vec2 uv) { vec4 c = uPI * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
      float aoAt(vec2 uv) {
        vec3 P = vpos(uv); if (-P.z > 220.0 || fwidth(P.z) > 0.4) return 1.0; vec3 N = normalize(cross(dFdx(P), dFdy(P)));
        float rad = 1.1 * uProjY / max(1.0, -P.z) * 0.5, a0 = gh(vUv * vec2(913.0, 517.0)) * 6.2832, occ = 0.0;
        for (int i = 0; i < 10; i++) { float fi = float(i), an = a0 + fi * 2.39996, rr = sqrt((fi + 0.5) / 10.0); vec2 o = vec2(cos(an), sin(an)) * rr * rad; o.x /= uAspect; vec3 v = vpos(uv + o) - P; occ += max(0.0, dot(v, N) - 0.03) / (dot(v, v) + 0.25); }
        return clamp(1.0 - occ * 0.28, 0.0, 1.0);
      }
      void main(){
        vec2 uv = vUv, cc = uv - 0.5; float r = length(cc);
        uv += cc * sin(r * 40.0 - uTime * 3.0) * 0.0012 * uWetLens;                                           // 비 오는 날 렌즈 위 얇은 물기의 일렁임
        vec3 col = vec3(0.0); float tw = 0.0;
        for (int i = 0; i < 6; i++) { float k = float(i) / 5.0, s = 1.0 - k * uSpeed * 0.03 * smoothstep(0.2, 0.8, r); vec2 u2 = 0.5 + cc * s; float w = 1.0 - k * 0.5;                  // 빨라질수록 화면 가장자리가 바깥으로 늘어남
          col += vec3(texture2D(tDiffuse, u2 + cc * r * 0.006).r, texture2D(tDiffuse, u2).g, texture2D(tDiffuse, u2 - cc * r * 0.006).b) * w; tw += w; }
        col /= tw;
        float lum = dot(col, vec3(0.3, 0.6, 0.1)); col *= mix(vec3(0.3, 0.33, 0.42), vec3(1.0), mix(aoAt(vUv), 1.0, smoothstep(0.6, 1.4, lum)));
        col *= uExpo;
        vec3 x = col * 1.05; vec3 film = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); col = mix(col, film, 0.9);
        float l2 = dot(col, vec3(0.3, 0.6, 0.1)); col *= mix(vec3(0.93, 1.0, 1.08), vec3(1.05, 1.0, 0.94), smoothstep(0.05, 0.7, l2));
        col = mix(vec3(l2), col, uSat); col = max((col - 0.5) * 1.06 + 0.5, 0.0);
        col *= 1.0 - smoothstep(0.42, 1.0, r) * 0.55; col += vec3(0.5, 0.0, 0.0) * uHurt * smoothstep(0.25, 0.8, r);
        col += (gh(vUv * vec2(1733.0, 977.0) + fract(uTime) * 61.0) - 0.5) * 0.03;
        gl_FragColor = vec4(col, 1.0);
      }` });
  composer.addPass(grade); composer.addPass(new OutputPass());

  let W = 1, H = 1;
  function resize() { W = stage.clientWidth || innerWidth; H = stage.clientHeight || innerHeight; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); reflRT.setSize(Math.max(64, Math.floor(W * renderer.getPixelRatio() / 2)), Math.max(64, Math.floor(H * renderer.getPixelRatio() / 2))); }

  // ---------- 환경: 시각과 날씨로 태양, 하늘색, 안개, 습도 계산 ----------
  const env = { hour: 12, weather: 'clear', wet: 0, rain: 0, cover: 0.12, fog: 0.0016, night: 0, flash: 0 };
  const C = (r, g, b) => new THREE.Color(r, g, b), zenD = C(0.16, 0.38, 0.82), horD = C(0.62, 0.78, 0.95), zenK = C(0.16, 0.2, 0.42), horK = C(1.0, 0.46, 0.2), zenN = C(0.008, 0.012, 0.03), horN = C(0.075, 0.06, 0.07), grey = C(0.5, 0.52, 0.56);
  function setEnv(hour, weather, dt = 99) {
    env.hour = hour; env.weather = weather; const w = WEATHER[weather], k = Math.min(1, dt * 0.35);                 // 날씨는 서서히 바뀜
    env.wet += (w.wet - env.wet) * Math.min(1, dt * (w.wet > env.wet ? 0.25 : 0.04)); env.rain += (w.rain - env.rain) * k; env.cover += (w.cover - env.cover) * k; env.fog += (w.fog - env.fog) * k;
    const ang = (hour - 5.6) / 13.6 * Math.PI, el = Math.sin(ang), az = 0.9 + (hour - 12) * 0.12, dayK = THREE.MathUtils.smoothstep(el, -0.08, 0.22), duskK = Math.exp(-(((el - 0.02) / 0.2) ** 2)) * (hour > 12 ? 1 : 0.7);
    env.night = 1 - dayK;
    const sd = U.uSunDir.value; if (el > -0.05) sd.set(Math.cos(az) * Math.cos(ang * 0.5 + 0.3), Math.max(0.08, el), Math.sin(az) * 0.8).normalize(); else sd.set(-0.4, 0.75, 0.3).normalize();      // 밤에는 달의 방향으로 교체
    const ov = env.cover;
    U.uZen.value.copy(zenN).lerp(zenD, dayK).lerp(zenK, duskK * 0.7).lerp(grey.clone().multiplyScalar(0.25 + 0.6 * dayK), ov * 0.75);
    U.uHor.value.copy(horN).lerp(horD, dayK).lerp(horK, duskK * (1 - ov * 0.7)).lerp(grey.clone().multiplyScalar(0.3 + 0.75 * dayK), ov * 0.7);
    const sunI = (el > -0.05 ? dayK * 2.6 * (1 - ov * 0.82) : 0.16 * (1 - ov * 0.7));
    U.uSunCol.value.setRGB(1, 0.96 - duskK * 0.4, 0.9 - duskK * 0.62).multiplyScalar(sunI); if (el <= -0.05) U.uSunCol.value.setRGB(0.5, 0.6, 0.9).multiplyScalar(sunI);
    U.uAmb.value.copy(U.uZen.value).lerp(U.uHor.value, 0.5).multiplyScalar(0.42 + dayK * 0.3).addScalar(0.012 + env.night * 0.02);
    U.uFogCol.value.copy(U.uHor.value).lerp(U.uZen.value, 0.25).multiplyScalar(1 - env.night * 0.25); U.uFogDen.value = env.fog; U.uCover.value = ov;
    U.uWet.value = env.wet; U.uRain.value = env.rain; U.uNight.value = env.night; U.uFlash.value = env.flash;
    sun.color.copy(U.uSunCol.value); sun.intensity = 1; hemi.color.copy(U.uZen.value).lerp(U.uHor.value, 0.4); hemi.groundColor.copy(U.uHor.value).multiplyScalar(0.25); hemi.intensity = 0.55 + dayK * 0.5 + env.night * 0.35;
    scene.fog = scene.fog || new THREE.FogExp2(0, 0.002); scene.fog.color.copy(U.uFogCol.value); scene.fog.density = env.fog;
    headMat.color.setRGB(1, 0.75, 0.45).multiplyScalar(0.25 + 1.8 * env.night); bloom.strength = 0.35 + 0.22 * env.night + env.fog * 10; grade.uniforms.uWetLens.value = env.rain;
    grade.uniforms.uExpo.value = 1.0 + env.night * 0.25;
  }
  function refreshEnv() { if (envRT) envRT.dispose(); sky.position.set(0, 0, 0); envRT = pmrem.fromScene(envScene, 0, 1, 2000); scene.environment = envRT.texture; scene.environmentIntensity = 0.55; }

  function update(dt, focus, head) {
    U.uTime.value += dt; envT -= dt; if (envT <= 0) { envT = 4; refreshEnv(); }
    sky.position.copy(camera.position); rainMat.uniforms.uCam.value.copy(camera.position); rain.visible = env.rain > 0.02;
    sun.target.position.set(focus.x, 0, focus.z); sun.position.copy(sun.target.position).addScaledVector(U.uSunDir.value, 200); shadowCatcher.position.set(focus.x, 0.02, focus.z); shadowCatcher.material.opacity = 0.5 * Math.min(1, U.uSunCol.value.r * 0.6);
    if (head) { U.uHead.value.set(head.x, head.z, head.dx, head.dz); U.uHeadK.value = 0.15 + 0.85 * env.night; }
    if (env.flash > 0) env.flash = Math.max(0, env.flash - dt * 4);
  }
  function render() {
    // 수면 아래 미러 위치에서 한 장 찍어 바닥의 반사로 사용
    camera.updateMatrixWorld(); tmpA.setFromMatrixPosition(camera.matrixWorld); camera.getWorldDirection(tmpB); tmpB.add(tmpA); tmpU.set(0, 1, 0).transformDirection(camera.matrixWorld);
    vcam.position.set(tmpA.x, -tmpA.y, tmpA.z); vcam.up.set(tmpU.x, -tmpU.y, tmpU.z); vcam.lookAt(tmpB.x, -tmpB.y, tmpB.z); vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse); vcam.updateMatrixWorld();
    U.uReflVP.value.multiplyMatrices(vcam.projectionMatrix, vcam.matrixWorldInverse);
    sky.position.copy(vcam.position); renderer.setRenderTarget(reflRT); renderer.render(scene, vcam); renderer.setRenderTarget(null); sky.position.copy(camera.position);
    renderer.shadowMap.autoUpdate = true;
    const g = grade.uniforms; g.tDepth.value = composer.readBuffer.depthTexture; g.uPI.value.copy(camera.projectionMatrixInverse); g.uProjY.value = camera.projectionMatrix.elements[5]; g.uAspect.value = camera.aspect; g.uTime.value = U.uTime.value;
    composer.render();
  }
  resize(); setEnv(12, 'clear'); addEventListener('resize', resize);
  return { renderer, scene, camera, U, env, grade, setEnv, refreshEnv, update, render, resize, shops, homes, solids, lamps, blds };
                                          }
