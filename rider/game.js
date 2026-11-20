// 《메아리: 라이더》— 3 인칭으로 전동 바이크를 타고 배달하는 게임. 이번 판은 도심, 낮밤과 날씨, 주행까지. 플랫폼 배차는 sim.js 에.
import * as THREE from 'three';
import { createWorld, WEATHER, P, NB, HALF, ROAD, WALK, c } from './world.js?v=5';
import { startTraffic } from './traffic.js?v=5';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const world = createWorld($('stage')), { scene, camera } = world;

// ---------- 라이더와 전동 바이크 ----------
const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
function mk(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 14) => new THREE.CylinderGeometry(a, b, h, n), sph = (r) => new THREE.SphereGeometry(r, 18, 14), cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
const bike = new THREE.Group(), lean = new THREE.Group(); bike.add(lean); scene.add(bike);            // bike 는 위치와 방향, lean 은 좌우 기울기 담당. 앞쪽이 +z
const paint = S(0x1c6fd0, { roughness: 0.35, metalness: 0.3 }), dark = S(0x15171c, { roughness: 0.7 }), chrome = S(0xb8c0cc, { roughness: 0.25, metalness: 0.9 }), rubber = S(0x0c0c0e, { roughness: 0.9 });
const wheels = [];
for (const z of [0.78, -0.72]) { const w = new THREE.Group(); w.position.set(0, 0.3, z); lean.add(w); mk(w, new THREE.TorusGeometry(0.24, 0.085, 10, 20), rubber, 0, 0, 0, 0, Math.PI / 2); mk(w, cyl(0.17, 0.17, 0.09, 12), chrome, 0, 0, 0, 0, 0, Math.PI / 2); wheels.push(w); }
mk(lean, box(0.34, 0.12, 0.95), dark, 0, 0.34, 0.02);                                  // 발판
mk(lean, box(0.42, 0.5, 0.2), paint, 0, 0.62, 0.52, -0.25);                            // 앞 커버
mk(lean, cyl(0.045, 0.045, 0.95, 8), chrome, 0, 0.78, 0.66, -0.32);                    // 스티어링 칼럼
const barG = new THREE.Group(); barG.position.set(0, 1.2, 0.5); lean.add(barG);          // 핸들은 별도 그룹, 조향에 따라 돌아감
mk(barG, cyl(0.03, 0.03, 0.7, 8), dark, 0, 0, 0, 0, 0, Math.PI / 2);
for (const s of [-1, 1]) { mk(barG, cyl(0.04, 0.04, 0.16, 8), rubber, s * 0.34, 0, 0, 0, 0, Math.PI / 2); mk(barG, cyl(0.009, 0.009, 0.2, 6), dark, s * 0.28, 0.1, 0.02, 0, 0, s * -0.2); mk(barG, box(0.11, 0.07, 0.02), chrome, s * 0.31, 0.2, 0.02); }
{ const ph = new THREE.Group(); ph.position.set(0.1, 0.09, -0.03); ph.rotation.x = 0.55; barG.add(ph); mk(ph, box(0.09, 0.16, 0.014), dark); const scr = mk(ph, box(0.078, 0.145, 0.004), new THREE.MeshBasicMaterial({ color: 0x8fdcff }), 0, 0, -0.009); scr.castShadow = false; mk(barG, cyl(0.008, 0.008, 0.1, 6), dark, 0.1, 0.04, -0.01); }   // 핸들에 거치된 휴대폰
wheels[0].rotation.order = 'YXZ';
mk(lean, box(0.4, 0.34, 0.75), paint, 0, 0.56, -0.5);                                  // 뒷몸통
mk(lean, box(0.36, 0.1, 0.66), dark, 0, 0.8, -0.42);                                   // 안장
mk(lean, box(0.36, 0.06, 0.34), paint, 0, 0.5, 0.86, 0.2); mk(lean, box(0.34, 0.05, 0.4), paint, 0, 0.6, -0.86, -0.15);     // 흙받이
const headLamp = mk(lean, sph(0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.98, 0.68); headLamp.castShadow = false;
const tailLamp = mk(lean, box(0.2, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), 0, 0.66, -0.9); tailLamp.castShadow = false;
// 배달 박스: 노란 바탕, 옆면에 "메아리 배달" 인쇄
const boxTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#ffc61a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#1a1405'; g.font = '900 60px "Noto Sans KR", "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('메아리', 128, 92); g.fillText('배달', 128, 164); g.strokeStyle = '#1a1405'; g.lineWidth = 8; g.strokeRect(14, 14, 228, 228); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const cargo = mk(lean, box(0.56, 0.52, 0.5), S(0xffffff, { map: boxTex, roughness: 0.5 }), 0, 1.14, -0.72); mk(lean, box(0.58, 0.04, 0.52), S(0x1a1405), 0, 1.41, -0.72);
// 라이더(별도 그룹: 내려서 배달하러 들어갈 때는 탑승자를 숨김)
const riderG = new THREE.Group(); lean.add(riderG);
const skin = S(0xe8b88c), jacket = S(0xffc61a, { roughness: 0.7 }), pants = S(0x20242c), helmetM = S(0xffc61a, { roughness: 0.3, metalness: 0.1 });
const upper = new THREE.Group(); upper.position.set(0, 0.92, -0.4); riderG.add(upper);   // 상체는 골반을 중심으로 회전: 가속하면 앞으로 기울고 기분이 나쁘면 구부정
const torso = mk(upper, cap(0.19, 0.36), jacket, 0, 0.38, 0.1, 0.22); mk(upper, box(0.32, 0.05, 0.02), S(0xf4f6f8, { roughness: 0.3 }), 0, 0.46, -0.1, 0.22);
const headG = new THREE.Group(); headG.position.set(0, 0.8, 0.2); upper.add(headG); for (const s of [-1, 1]) mk(headG, new THREE.ConeGeometry(0.04, 0.1, 8), helmetM, s * 0.09, 0.2, -0.01, 0, 0, s * -0.25); mk(headG, sph(0.15), skin); mk(headG, new THREE.SphereGeometry(0.175, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetM, 0, 0.02, 0); mk(headG, box(0.3, 0.07, 0.03), S(0x101418, { roughness: 0.15, metalness: 0.6 }), 0, 0.0, 0.15);
const arms = [], legs = [];
for (const s of [-1, 1]) { arms.push(mk(upper, cap(0.06, 0.42), jacket, s * 0.26, 0.42, 0.48, 1.15, 0, s * -0.12)); legs.push({ th: mk(riderG, cap(0.075, 0.36), pants, s * 0.14, 0.82, -0.12, 1.25, 0, s * 0.1), sh: mk(riderG, cap(0.065, 0.36), pants, s * 0.16, 0.58, 0.18, 0.15), ft: mk(riderG, box(0.1, 0.07, 0.24), dark, s * 0.16, 0.39, 0.26) }); }
// 정차 시 한 발로 지탱: 주행 자세 → 지탱 자세, 위치와 각도가 한 세트씩
const LEG = { th: [[-0.14, 0.82, -0.12, 1.25, -0.1], [-0.2, 0.7, -0.3, -0.47, -0.28]], sh: [[-0.16, 0.58, 0.18, 0.15, 0], [-0.32, 0.29, -0.18, -0.09, -0.21]], ft: [[-0.16, 0.39, 0.26, 0, 0], [-0.37, 0.04, -0.1, 0, 0]] };
// 뒷바퀴가 튀기는 물보라와 급제동의 먼지
const SPN = 90, spPos = new Float32Array(SPN * 3).fill(-99), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN), spMat = new THREE.PointsMaterial({ size: 0.15, color: 0xcfdcea, transparent: true, opacity: 0.55, depthWrite: false });
const spray = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(spPos, 3)), spMat); spray.frustumCulled = false; scene.add(spray); let spI = 0, spAcc = 0;
// 머리 위에 뜨는 이모티콘
const emoCv = document.createElement('canvas'); emoCv.width = emoCv.height = 128; const emoTex = new THREE.CanvasTexture(emoCv); emoTex.colorSpace = THREE.SRGBColorSpace;
const emo = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoTex, transparent: true, depthWrite: false, depthTest: false, fog: false })); emo.visible = false; emo.renderOrder = 5; scene.add(emo); let emoT = 0;
function emote(ch) { const g = emoCv.getContext('2d'); g.clearRect(0, 0, 128, 128); g.font = '92px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); emoTex.needsUpdate = true; emoT = 2; }
const spot = new THREE.SpotLight(0xdfeaff, 0, 46, 0.5, 0.6, 1.2); spot.position.set(0, 1.0, 0.7); spot.target.position.set(0, 0.2, 14); bike.add(spot, spot.target);
const near = new THREE.PointLight(0xffb26a, 0, 26, 1.6); scene.add(near);                 // 라이더와 가장 가까운 가로등, 밤에 사람을 따뜻하게 비춤

// ---------- 상태 ----------
let state = 'title', held = false, hour = 10.5, weather = 'clear', shake = 0;
const me = { x: c(2) - 2.6, z: c(2) - 30, a: 0, v: 0, steer: 0, slip: 0, lean: 0, batt: 1, crashT: 0, lock: false, mood: 0.7 };
let pv = 0, accS = 0, footK = 1, moodS = 0.7;
const keys = {}, touch = { go: false, brake: false, sx: 0 };
const camPos = new THREE.Vector3(me.x, 6, me.z - 10), camLook = new THREE.Vector3(me.x, 1.2, me.z);

function inBlock(x, z, pad = 0.5) { for (const b of world.solids) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return b; return null; }
function drive(dt) {
  if (me.lock) { me.v = 0; me.steer = 0; me.lean *= 0.8; return; }                 // 내려서 음식을 받고 배달할 동안 바이크는 멈춤
  const wet = world.env.wet, grip = 1 - wet * 0.45, up = keys.KeyW || keys.ArrowUp || touch.go, down = keys.KeyS || keys.ArrowDown || keys.Space || touch.brake;
  const st = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) + touch.sx;
  if (me.crashT > 0) { me.crashT -= dt; me.v *= Math.max(0, 1 - dt * 4); }
  else {
    const top = (me.batt < 0.12 ? 6 : 13.5) * (me.mood < 0.25 ? 0.9 : 1);                                  // 13.5m/s ≈ 49km/h; 배터리가 거의 없으면 속도 제한
    if (up) me.v += (top - me.v) * Math.min(1, dt * 0.9) + 2.2 * dt; else me.v -= me.v * dt * 0.35;
    if (down) me.v -= (9 * grip + 2) * dt;                                    // 젖은 길에서는 제동 거리가 김
    me.v = clamp(me.v, down && me.v < 0.5 && !up ? -2.5 : 0, top + 1);
  }
  me.steer += (clamp(st, -1, 1) - me.steer) * Math.min(1, dt * 7);
  const turn = me.steer * (2.3 / (1 + Math.abs(me.v) * 0.11)) * Math.min(1, Math.abs(me.v) / 2.5 + 0.15) * Math.sign(me.v || 1);
  me.a += turn * dt;
  me.slip += (turn * me.v * 0.035 * wet - me.slip) * Math.min(1, dt * 3);     // 젖은 길에서 급하게 꺾으면 뒷부분이 미끄러짐
  const dx = Math.sin(me.a - me.slip), dz = Math.cos(me.a - me.slip); let nx = me.x + dx * me.v * dt, nz = me.z + dz * me.v * dt;
  const lim = HALF + WALK - 0.6; if (Math.abs(nx) > lim || Math.abs(nz) > lim) { nx = clamp(nx, -lim, lim); nz = clamp(nz, -lim, lim); me.v *= 0.6; }
  const b = inBlock(nx, nz);
  if (b) {                                                                    // 블록(건물)과 충돌: 벽을 따라 미끄러지고, 속도가 크면 낙차로 처리
    const px = Math.min(nx - b.x0, b.x1 - nx), pz = Math.min(nz - b.z0, b.z1 - nz);
    if (px < pz) nx = nx - b.x0 < b.x1 - nx ? b.x0 - 0.5 : b.x1 + 0.5; else nz = nz - b.z0 < b.z1 - nz ? b.z0 - 0.5 : b.z1 + 0.5;
    if (Math.abs(me.v) > 7) crash(b.why || '벽에 부딪혔다'); else me.v *= 0.5;
  }
  me.x = nx; me.z = nz; me.lean += (-turn * me.v * 0.05 - me.lean) * Math.min(1, dt * 6);
  me.batt = Math.max(0, me.batt - Math.abs(me.v) * dt * 0.000085);
}
const hooks = { onCrash: null };
function crash(why) { if (me.crashT > 0) return; me.crashT = 1.6; shake = 1; world.grade.uniforms.uHurt.value = 1; if (hooks.onCrash) hooks.onCrash(why, me.v); me.v = 0; }

// ---------- 매 프레임 ----------
function update(dt) {
  shake = Math.max(0, shake - dt * 2.5); world.grade.uniforms.uHurt.value = Math.max(0, world.grade.uniforms.uHurt.value - dt * 1.5);
  if (state === 'play') drive(dt);
  { const sp = Math.abs(me.v), wet = world.env.wet, brake = keys.KeyS || keys.Space || keys.ArrowDown || touch.brake;
    accS += (clamp((me.v - pv) / dt, -12, 12) - accS) * Math.min(1, dt * 6); pv = me.v; footK += ((sp < 0.5 && me.crashT <= 0 ? 1 : 0) - footK) * Math.min(1, dt * 7); moodS += (me.mood - moodS) * Math.min(1, dt * 1.5); emoT = Math.max(0, emoT - dt);
    // 젖은 길은 뒷바퀴 물보라, 마른 길은 급제동 먼지
    const dust = wet < 0.3 && brake && sp > 5; spAcc += (wet > 0.3 && sp > 4 ? sp * 5 * wet : dust ? 40 : 0) * dt; if (dust) spMat.color.setHex(0xa39a8c); else if (wet > 0.3) spMat.color.setHex(0xcfdcea);
    const bx = Math.sin(me.a), bz = Math.cos(me.a);
    while (spAcc >= 1) { spAcc -= 1; const i = spI = (spI + 1) % SPN; spPos[i * 3] = me.x - bx * 0.75 + rand(-0.1, 0.1); spPos[i * 3 + 1] = 0.12; spPos[i * 3 + 2] = me.z - bz * 0.75 + rand(-0.1, 0.1); spVel[i * 3] = -bx * sp * 0.22 + rand(-0.7, 0.7); spVel[i * 3 + 1] = rand(1.2, 2.6) * (dust ? 0.5 : 1); spVel[i * 3 + 2] = -bz * sp * 0.22 + rand(-0.7, 0.7); spLife[i] = dust ? 0.7 : 0.5; }
    for (let i = 0; i < SPN; i++) { if (spLife[i] <= 0) continue; spLife[i] -= dt; if (spLife[i] <= 0) { spPos[i * 3 + 1] = -99; continue; } spVel[i * 3 + 1] -= 9 * dt; spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] = Math.max(0.03, spPos[i * 3 + 1] + spVel[i * 3 + 1] * dt); spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt; }
    spray.geometry.attributes.position.needsUpdate = true; }
  world.setEnv(hour, weather, dt);
  { const hx = Math.sin(me.a), hz = Math.cos(me.a), sp = Math.abs(me.v);
  // 추적 카메라: 바이크 뒤쪽 위, 빠를수록 더 멀어지고 화각이 넓어짐; 세로 화면은 조금 더 뒤로
  const tall = camera.aspect < 1 ? 1.5 : 1, back = (7.2 + sp * 0.16) * tall, up = (3.1 + sp * 0.04) * tall;
  const tx = me.x - hx * back, tz = me.z - hz * back, k = 1 - Math.exp(-dt * 5.5), k2 = 1 - Math.exp(-dt * 10);
  camPos.x += (tx - camPos.x) * k; camPos.z += (tz - camPos.z) * k; camPos.y += (up - camPos.y) * k;
  camLook.x += (me.x + hx * 5 - camLook.x) * k2; camLook.z += (me.z + hz * 5 - camLook.z) * k2; camLook.y = 1.5;
  }
  const hx = Math.sin(me.a), hz = Math.cos(me.a);
  world.update(dt, me, { x: me.x + hx * 0.8, z: me.z + hz * 0.8, dx: hx, dz: hz });
}
function draw() {
  const t = performance.now() / 1000, hx = Math.sin(me.a), hz = Math.cos(me.a), sp = Math.abs(me.v);
  const ck = me.crashT > 0 ? Math.min(1, me.crashT / 0.6) : 0, cs = ck * ck * (3 - 2 * ck), slump = clamp((0.55 - moodS) / 0.55, 0, 1);      // 넘어지면 천천히 바이크를 일으켜 세움; 기분이 나쁠수록 등이 굽음
  bike.position.set(me.x, 0.02 * cs, me.z); bike.rotation.y = me.a - me.slip * 1.6;
  lean.rotation.z = (clamp(me.lean, -0.5, 0.5) + 0.05 * footK) * (1 - cs) + 1.35 * cs; lean.rotation.x = clamp(-accS * 0.006, -0.05, 0.07); lean.position.y = Math.sin(t * 34) * 0.004 * Math.min(1, sp / 6);
  for (const w of wheels) w.rotation.x += me.v * 0.055; wheels[0].rotation.y = me.steer * 0.4; barG.rotation.y = me.steer * 0.45;
  upper.rotation.x = 0.02 + sp * 0.012 + slump * 0.2 + clamp(-accS * 0.012, -0.08, 0.12) + Math.sin(t * 1.7) * 0.008;
  headG.rotation.set(slump * 0.3 - sp * 0.008, -me.steer * 0.35 + Math.sin(t * 0.6) * 0.3 * footK * (1 - slump), 0);
  arms.forEach((a, i) => { a.position.z = 0.48 - (i ? 1 : -1) * me.steer * 0.1; });
  for (const k in LEG) { const o = legs[0][k], [a, b] = LEG[k], L = (n) => a[n] + (b[n] - a[n]) * footK; o.position.set(L(0), L(1), L(2)); o.rotation.set(L(3), 0, L(4)); }
  emo.visible = emoT > 0; if (emoT > 0) { emo.position.set(me.x, 2.55 + (2 - emoT) * 0.35, me.z); emo.scale.setScalar(0.7 * Math.min(1, (2 - emoT) * 6 + 0.3)); emo.material.opacity = Math.min(1, emoT * 2); }
  const night = world.env.night; spot.intensity = 3 + 26 * night; headLamp.material.color.setScalar(1 + 3 * night); tailLamp.material.color.setRGB((keys.KeyS || keys.Space || touch.brake) ? 4 : 1.4, 0.1, 0.06);
  jacket.color.setHex(world.env.rain > 0.2 ? 0x2f7fe0 : 0xffc61a);                                                // 비가 오면 파란 우비 착용
  let bl = null, bd = 1e9; for (const l of world.lamps) { const d = (l.x - me.x) ** 2 + (l.z - me.z) ** 2; if (d < bd) { bd = d; bl = l; } }
  if (bl) { near.position.set(bl.x + Math.cos(bl.ry) * 1.75, 6.6, bl.z - Math.sin(bl.ry) * 1.75); near.intensity = 38 * night; }
  camera.position.set(camPos.x + rand(-1, 1) * shake * 0.3, camPos.y + rand(-1, 1) * shake * 0.2, camPos.z + rand(-1, 1) * shake * 0.3); camera.lookAt(camLook); camera.rotation.z += clamp(me.lean, -0.5, 0.5) * 0.12;
  camera.fov = (camera.aspect < 1 ? 68 : 56) + sp * 0.75; camera.updateProjectionMatrix();
  world.grade.uniforms.uSpeed.value = clamp((sp - 6) / 8, 0, 1);
  world.render();
}

// ---------- 입력 ----------
addEventListener('keydown', (e) => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); if (hooks.onKey) hooks.onKey(e.code); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
let dragId = null, dragX = 0;
$('stage').addEventListener('pointerdown', (e) => { if (hooks.onDown && hooks.onDown(e)) return; if (e.target.closest('#phone, #touch')) return; dragId = e.pointerId; dragX = e.clientX; if (e.pointerType !== 'mouse') touch.go = true; });
addEventListener('pointermove', (e) => { if (e.pointerId === dragId) touch.sx = clamp(-(e.clientX - dragX) / 70, -1, 1); });
const end = (e) => { if (e.pointerId === dragId) { dragId = null; touch.sx = 0; touch.go = false; } }; addEventListener('pointerup', end); addEventListener('pointercancel', end);
for (const [id, k] of [['tGo', 'go'], ['tBrake', 'brake']]) { const b = $(id); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); touch[k] = true; }); b.addEventListener('pointerup', () => { touch[k] = false; }); b.addEventListener('pointerleave', () => { touch[k] = false; }); }

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; if (hooks.tick) hooks.tick(dt); if (hooks.tick2) hooks.tick2(dt); if (hooks.tick3) hooks.tick3(dt); update(dt); draw(); }

export const G = { world, me, keys, touch, hooks, crash, inBlock, riderG, camera, emote, get state() { return state; }, set state(v) { state = v; }, get hour() { return hour; }, set hour(v) { hour = v; }, get weather() { return weather; }, set weather(v) { weather = v; }, $, rand, clamp };
// 디버그 입구
window.__rider = {
  G, step(sec, doDraw = true) { held = true; for (let t = 0; t < sec; t += 1 / 60) { if (hooks.tick) hooks.tick(1 / 60); if (hooks.tick2) hooks.tick2(1 / 60); if (hooks.tick3) hooks.tick3(1 / 60); update(1 / 60); } if (doDraw) { draw(); draw(); } },
  hold(on) { held = on; }, draw() { draw(); },
  set(h, w) { hour = h; weather = w; world.setEnv(h, w); world.env.wet = WEATHER[w].wet; world.env.rain = WEATHER[w].rain; world.env.cover = WEATHER[w].cover; world.env.fog = WEATHER[w].fog; world.setEnv(h, w); world.refreshEnv(); },
  tp(x, z, a = 0) { me.x = x; me.z = z; me.a = a; me.v = 0; camPos.set(x - Math.sin(a) * 8, 3.4, z - Math.cos(a) * 8); camLook.set(x, 1.5, z); },
  get s() { return { state, hour: +hour.toFixed(2), weather, x: +me.x.toFixed(1), z: +me.z.toFixed(1), v: +me.v.toFixed(1), night: +world.env.night.toFixed(2), wet: +world.env.wet.toFixed(2), shops: world.shops.length, homes: world.homes.length }; },
};
$('screen').style.display = 'none'; $('hud').style.display = 'block'; state = 'play';
G.traffic = startTraffic(G);
import('./sim.js?v=5').then((m) => { m.start(G); return import('./hazards.js?v=5'); }).then((h) => h.startHazards(G)).catch((e) => console.warn('sim 로드 실패', e));
requestAnimationFrame(frame);
