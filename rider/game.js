// 《回声：骑手》—— 第三人称骑电动车送外卖。这一版先有：城区、昼夜天气、骑行。平台派单在 sim.js。
import * as THREE from 'three';
import { createWorld, WEATHER, P, NB, HALF, ROAD, WALK, c } from './world.js?v=3';
import { startTraffic } from './traffic.js?v=3';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const world = createWorld($('stage')), { scene, camera } = world;

// ---------- 骑手和电动车 ----------
const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
function mk(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 14) => new THREE.CylinderGeometry(a, b, h, n), sph = (r) => new THREE.SphereGeometry(r, 18, 14), cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
const bike = new THREE.Group(), lean = new THREE.Group(); bike.add(lean); scene.add(bike);            // bike 管位置和朝向，lean 管左右压弯。车头朝 +z
const paint = S(0x1c6fd0, { roughness: 0.35, metalness: 0.3 }), dark = S(0x15171c, { roughness: 0.7 }), chrome = S(0xb8c0cc, { roughness: 0.25, metalness: 0.9 }), rubber = S(0x0c0c0e, { roughness: 0.9 });
const wheels = [];
for (const z of [0.78, -0.72]) { const w = new THREE.Group(); w.position.set(0, 0.3, z); lean.add(w); mk(w, new THREE.TorusGeometry(0.24, 0.085, 10, 20), rubber, 0, 0, 0, 0, Math.PI / 2); mk(w, cyl(0.17, 0.17, 0.09, 12), chrome, 0, 0, 0, 0, 0, Math.PI / 2); wheels.push(w); }
mk(lean, box(0.34, 0.12, 0.95), dark, 0, 0.34, 0.02);                                  // 脚踏板
mk(lean, box(0.42, 0.5, 0.2), paint, 0, 0.62, 0.52, -0.25);                            // 前挡
mk(lean, cyl(0.045, 0.045, 0.95, 8), chrome, 0, 0.78, 0.66, -0.32);                    // 转向柱
mk(lean, cyl(0.03, 0.03, 0.7, 8), dark, 0, 1.2, 0.5, 0, 0, Math.PI / 2);               // 车把
for (const s of [-1, 1]) { mk(lean, cyl(0.04, 0.04, 0.16, 8), rubber, s * 0.34, 1.2, 0.5, 0, 0, Math.PI / 2); mk(lean, box(0.1, 0.06, 0.02), chrome, s * 0.3, 1.36, 0.52); }
mk(lean, box(0.4, 0.34, 0.75), paint, 0, 0.56, -0.5);                                  // 后身
mk(lean, box(0.36, 0.1, 0.66), dark, 0, 0.8, -0.42);                                   // 座垫
mk(lean, box(0.36, 0.06, 0.34), paint, 0, 0.5, 0.86, 0.2); mk(lean, box(0.34, 0.05, 0.4), paint, 0, 0.6, -0.86, -0.15);     // 挡泥板
const headLamp = mk(lean, sph(0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.98, 0.68); headLamp.castShadow = false;
const tailLamp = mk(lean, box(0.2, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), 0, 0.66, -0.9); tailLamp.castShadow = false;
// 外卖箱：黄底，侧面印着“回声外卖”
const boxTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#ffc61a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#1a1405'; g.font = '900 60px "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('回声', 128, 92); g.fillText('外卖', 128, 164); g.strokeStyle = '#1a1405'; g.lineWidth = 8; g.strokeRect(14, 14, 228, 228); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const cargo = mk(lean, box(0.56, 0.52, 0.5), S(0xffffff, { map: boxTex, roughness: 0.5 }), 0, 1.14, -0.72); mk(lean, box(0.58, 0.04, 0.52), S(0x1a1405), 0, 1.41, -0.72);
// 骑手（单独成组：下车跑进去送餐时，车上的人要藏起来）
const riderG = new THREE.Group(); lean.add(riderG);
const skin = S(0xe8b88c), jacket = S(0xffc61a, { roughness: 0.7 }), pants = S(0x20242c), helmetM = S(0xffc61a, { roughness: 0.3, metalness: 0.1 });
const torso = mk(riderG, cap(0.19, 0.36), jacket, 0, 1.3, -0.3, 0.22);
const headG = new THREE.Group(); headG.position.set(0, 1.72, -0.2); riderG.add(headG); mk(headG, sph(0.15), skin); mk(headG, new THREE.SphereGeometry(0.175, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetM, 0, 0.02, 0); mk(headG, box(0.3, 0.07, 0.03), S(0x101418, { roughness: 0.15, metalness: 0.6 }), 0, 0.0, 0.15);
for (const s of [-1, 1]) { mk(riderG, cap(0.06, 0.42), jacket, s * 0.26, 1.34, 0.08, 1.15, 0, s * -0.12); mk(riderG, cap(0.075, 0.36), pants, s * 0.14, 0.82, -0.12, 1.25, 0, s * 0.1); mk(riderG, cap(0.065, 0.36), pants, s * 0.16, 0.58, 0.18, 0.15); mk(riderG, box(0.1, 0.07, 0.24), dark, s * 0.16, 0.39, 0.26); }
const spot = new THREE.SpotLight(0xdfeaff, 0, 46, 0.5, 0.6, 1.2); spot.position.set(0, 1.0, 0.7); spot.target.position.set(0, 0.2, 14); bike.add(spot, spot.target);
const near = new THREE.PointLight(0xffb26a, 0, 26, 1.6); scene.add(near);                 // 离骑手最近的那盏路灯，夜里把人照暖

// ---------- 状态 ----------
let state = 'title', held = false, hour = 10.5, weather = 'clear', shake = 0;
const me = { x: c(2) - 2.6, z: c(2) - 30, a: 0, v: 0, steer: 0, slip: 0, lean: 0, batt: 1, crashT: 0, lock: false };
const keys = {}, touch = { go: false, brake: false, sx: 0 };
const camPos = new THREE.Vector3(me.x, 6, me.z - 10), camLook = new THREE.Vector3(me.x, 1.2, me.z);

function inBlock(x, z, pad = 0.5) { for (const b of world.solids) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return b; return null; }
function drive(dt) {
  if (me.lock) { me.v = 0; me.steer = 0; me.lean *= 0.8; return; }                 // 下车取餐、送餐的时候车停着不动
  const wet = world.env.wet, grip = 1 - wet * 0.45, up = keys.KeyW || keys.ArrowUp || touch.go, down = keys.KeyS || keys.ArrowDown || keys.Space || touch.brake;
  const st = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) + touch.sx;
  if (me.crashT > 0) { me.crashT -= dt; me.v *= Math.max(0, 1 - dt * 4); }
  else {
    const top = (me.batt < 0.12 ? 6 : 13.5);                                  // 13.5 米/秒 ≈ 49 km/h；快没电时限速
    if (up) me.v += (top - me.v) * Math.min(1, dt * 0.9) + 2.2 * dt; else me.v -= me.v * dt * 0.35;
    if (down) me.v -= (9 * grip + 2) * dt;                                    // 湿路刹车距离更长
    me.v = clamp(me.v, down && me.v < 0.5 && !up ? -2.5 : 0, top + 1);
  }
  me.steer += (clamp(st, -1, 1) - me.steer) * Math.min(1, dt * 7);
  const turn = me.steer * (2.3 / (1 + Math.abs(me.v) * 0.11)) * Math.min(1, Math.abs(me.v) / 2.5 + 0.15) * Math.sign(me.v || 1);
  me.a += turn * dt;
  me.slip += (turn * me.v * 0.035 * wet - me.slip) * Math.min(1, dt * 3);     // 湿路上转急了车尾会甩
  const dx = Math.sin(me.a - me.slip), dz = Math.cos(me.a - me.slip); let nx = me.x + dx * me.v * dt, nz = me.z + dz * me.v * dt;
  const lim = HALF + WALK - 0.6; if (Math.abs(nx) > lim || Math.abs(nz) > lim) { nx = clamp(nx, -lim, lim); nz = clamp(nz, -lim, lim); me.v *= 0.6; }
  const b = inBlock(nx, nz);
  if (b) {                                                                    // 撞到街区（楼）：沿墙滑开，速度大就算摔车
    const px = Math.min(nx - b.x0, b.x1 - nx), pz = Math.min(nz - b.z0, b.z1 - nz);
    if (px < pz) nx = nx - b.x0 < b.x1 - nx ? b.x0 - 0.5 : b.x1 + 0.5; else nz = nz - b.z0 < b.z1 - nz ? b.z0 - 0.5 : b.z1 + 0.5;
    if (Math.abs(me.v) > 7) crash('撞墙了'); else me.v *= 0.5;
  }
  me.x = nx; me.z = nz; me.lean += (-turn * me.v * 0.05 - me.lean) * Math.min(1, dt * 6);
  me.batt = Math.max(0, me.batt - Math.abs(me.v) * dt * 0.000085);
}
const hooks = { onCrash: null };
function crash(why) { if (me.crashT > 0) return; me.crashT = 1.6; shake = 1; world.grade.uniforms.uHurt.value = 1; if (hooks.onCrash) hooks.onCrash(why, me.v); me.v = 0; }

// ---------- 每帧 ----------
function update(dt) {
  shake = Math.max(0, shake - dt * 2.5); world.grade.uniforms.uHurt.value = Math.max(0, world.grade.uniforms.uHurt.value - dt * 1.5);
  if (state === 'play') drive(dt);
  world.setEnv(hour, weather, dt);
  { const hx = Math.sin(me.a), hz = Math.cos(me.a), sp = Math.abs(me.v);
  // 跟拍镜头：在车后上方，速度越快拉得越远、视野越宽；竖屏再往后退一点
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
  bike.position.set(me.x, me.crashT > 0 ? 0.02 : 0, me.z); bike.rotation.y = me.a - me.slip * 1.6;
  lean.rotation.z = me.crashT > 0 ? 1.35 : clamp(me.lean, -0.5, 0.5); lean.position.y = Math.sin(t * 34) * 0.004 * Math.min(1, sp / 6);
  for (const w of wheels) w.rotation.x += me.v * 0.055; headG.rotation.y = -me.steer * 0.35;
  const night = world.env.night; spot.intensity = 3 + 26 * night; headLamp.material.color.setScalar(1 + 3 * night); tailLamp.material.color.setRGB((keys.KeyS || keys.Space || touch.brake) ? 4 : 1.4, 0.1, 0.06);
  jacket.color.setHex(world.env.rain > 0.2 ? 0x2f7fe0 : 0xffc61a);                                                // 下雨披上蓝雨衣
  let bl = null, bd = 1e9; for (const l of world.lamps) { const d = (l.x - me.x) ** 2 + (l.z - me.z) ** 2; if (d < bd) { bd = d; bl = l; } }
  if (bl) { near.position.set(bl.x + Math.cos(bl.ry) * 1.75, 6.6, bl.z - Math.sin(bl.ry) * 1.75); near.intensity = 38 * night; }
  camera.position.set(camPos.x + rand(-1, 1) * shake * 0.3, camPos.y + rand(-1, 1) * shake * 0.2, camPos.z + rand(-1, 1) * shake * 0.3); camera.lookAt(camLook); camera.rotation.z += clamp(me.lean, -0.5, 0.5) * 0.12;
  camera.fov = (camera.aspect < 1 ? 68 : 56) + sp * 0.75; camera.updateProjectionMatrix();
  world.grade.uniforms.uSpeed.value = clamp((sp - 6) / 8, 0, 1);
  world.render();
}

// ---------- 输入 ----------
addEventListener('keydown', (e) => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); if (hooks.onKey) hooks.onKey(e.code); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
let dragId = null, dragX = 0;
$('stage').addEventListener('pointerdown', (e) => { if (hooks.onDown && hooks.onDown(e)) return; if (e.target.closest('#phone, #touch')) return; dragId = e.pointerId; dragX = e.clientX; if (e.pointerType !== 'mouse') touch.go = true; });
addEventListener('pointermove', (e) => { if (e.pointerId === dragId) touch.sx = clamp(-(e.clientX - dragX) / 70, -1, 1); });
const end = (e) => { if (e.pointerId === dragId) { dragId = null; touch.sx = 0; touch.go = false; } }; addEventListener('pointerup', end); addEventListener('pointercancel', end);
for (const [id, k] of [['tGo', 'go'], ['tBrake', 'brake']]) { const b = $(id); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); touch[k] = true; }); b.addEventListener('pointerup', () => { touch[k] = false; }); b.addEventListener('pointerleave', () => { touch[k] = false; }); }

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; if (hooks.tick) hooks.tick(dt); if (hooks.tick2) hooks.tick2(dt); update(dt); draw(); }

export const G = { world, me, keys, touch, hooks, crash, inBlock, riderG, camera, get state() { return state; }, set state(v) { state = v; }, get hour() { return hour; }, set hour(v) { hour = v; }, get weather() { return weather; }, set weather(v) { weather = v; }, $, rand, clamp };
// 调试入口
window.__rider = {
  G, step(sec, doDraw = true) { held = true; for (let t = 0; t < sec; t += 1 / 60) { if (hooks.tick) hooks.tick(1 / 60); if (hooks.tick2) hooks.tick2(1 / 60); update(1 / 60); } if (doDraw) { draw(); draw(); } },
  hold(on) { held = on; }, draw() { draw(); },
  set(h, w) { hour = h; weather = w; world.setEnv(h, w); world.env.wet = WEATHER[w].wet; world.env.rain = WEATHER[w].rain; world.env.cover = WEATHER[w].cover; world.env.fog = WEATHER[w].fog; world.setEnv(h, w); world.refreshEnv(); },
  tp(x, z, a = 0) { me.x = x; me.z = z; me.a = a; me.v = 0; camPos.set(x - Math.sin(a) * 8, 3.4, z - Math.cos(a) * 8); camLook.set(x, 1.5, z); },
  get s() { return { state, hour: +hour.toFixed(2), weather, x: +me.x.toFixed(1), z: +me.z.toFixed(1), v: +me.v.toFixed(1), night: +world.env.night.toFixed(2), wet: +world.env.wet.toFixed(2), shops: world.shops.length, homes: world.homes.length }; },
};
$('screen').style.display = 'none'; $('hud').style.display = 'block'; state = 'play';
G.traffic = startTraffic(G);
import('./sim.js?v=3').then((m) => m.start(G)).catch((e) => console.warn('sim 未加载', e));
requestAnimationFrame(frame);
