// 《回声：骑手》的交通：每个路口的红绿灯、沿路行驶的车流、撞车和闯红灯。
// 靠右行驶：朝 +z 走时右手边是 -x，朝 +x 走时右手边是 +z。
import * as THREE from 'three';
import { NB, HALF, ROAD, WALK, c } from './world.js?v=5';

export function startTraffic(G) {
  const { world, me, hooks, rand, clamp } = G, { scene } = world, dummy = new THREE.Object3D(), tc = new THREE.Color();
  const CYCLE = 28, STOP = ROAD + 5.6;
  // 某个路口、某个行驶方向（沿 z 或沿 x）现在是什么灯：0 绿 1 黄 2 红
  const phase = (i, j, alongZ, t) => { const p = ((t + (i * 7 + j * 13) % CYCLE) % CYCLE + CYCLE) % CYCLE, q = alongZ ? p : (p + 14) % CYCLE; return q < 11.5 ? 0 : q < 14 ? 1 : 2; };
  let T = 0;

  // ---------- 红绿灯：每个路口四个方向各一根杆 ----------
  const heads = [];
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const rx = -dz, rz = dx, x = c(i) - dx * (STOP + 0.6) + rx * (ROAD + 1.0), z = c(j) - dz * (STOP + 0.6) + rz * (ROAD + 1.0);
    if (Math.abs(x) > HALF + WALK || Math.abs(z) > HALF + WALK) continue;
    heads.push({ i, j, alongZ: dz !== 0, x, z, ry: Math.atan2(-dx, -dz) });
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.5, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8).translate(0, 2.3, 0), poleMat, heads.length), boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 1.15, 0.3).translate(0, 4.7, 0), poleMat, heads.length);
  const bulbGeo = new THREE.SphereGeometry(0.14, 10, 8), bulbs = [0, 1, 2].map((k) => { const m = new THREE.InstancedMesh(bulbGeo.clone().translate(0, 5.05 - k * 0.36, 0.17), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length); m.frustumCulled = false; scene.add(m); return m; });   // 上红 中黄 下绿
  heads.forEach((h, n) => { dummy.position.set(h.x, 0, h.z); dummy.rotation.set(0, h.ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); poles.setMatrixAt(n, dummy.matrix); boxes.setMatrixAt(n, dummy.matrix); for (const b of bulbs) { b.setMatrixAt(n, dummy.matrix); b.setColorAt(n, tc.setRGB(0.05, 0.05, 0.05)); } });
  poles.castShadow = true; for (const m of [poles, boxes]) { m.frustumCulled = false; scene.add(m); }
  const ON = [[4.5, 0.25, 0.15], [4.2, 2.6, 0.2], [0.2, 4.2, 0.9]], OFF = [[0.1, 0.02, 0.02], [0.1, 0.08, 0.01], [0.02, 0.1, 0.04]];

  // ---------- 车 ----------
  const N = 30, cars = [], COLS = [[0.75, 0.75, 0.78], [0.08, 0.08, 0.1], [0.55, 0.08, 0.08], [0.1, 0.2, 0.5], [0.85, 0.85, 0.85], [0.3, 0.33, 0.36], [0.6, 0.45, 0.1], [0.12, 0.35, 0.3]];
  const part = (g, x, y, z) => g.translate(x, y, z);
  const bodyGeo = (() => { const a = part(new THREE.BoxGeometry(1.86, 0.62, 4.3), 0, 0.62, 0), b = part(new THREE.BoxGeometry(1.7, 0.56, 2.3), 0, 1.2, -0.2); const g = new THREE.BufferGeometry(); const pos = [], nor = [], idx = []; let off = 0; for (const s of [a, b]) { pos.push(...s.attributes.position.array); nor.push(...s.attributes.normal.array); for (const k of s.index.array) idx.push(k + off); off += s.attributes.position.count; } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g; })();
  const carMat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.55 });
  const bodies = new THREE.InstancedMesh(bodyGeo, carMat, N); bodies.castShadow = true; bodies.frustumCulled = false; scene.add(bodies);
  const glass = new THREE.InstancedMesh(part(new THREE.BoxGeometry(1.72, 0.44, 2.34), 0, 1.22, -0.2), new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.05, metalness: 0.2 }), N); glass.frustumCulled = false; scene.add(glass);
  const wheelsM = new THREE.InstancedMesh((() => { const g = new THREE.BoxGeometry(2.0, 0.62, 0.7); const g2 = g.clone().translate(0, 0.31, 1.35), g3 = g.clone().translate(0, 0.31, -1.35); const out = new THREE.BufferGeometry(); const pos = [...g2.attributes.position.array, ...g3.attributes.position.array], nor = [...g2.attributes.normal.array, ...g3.attributes.normal.array], idx = [...g2.index.array, ...Array.from(g3.index.array, (k) => k + g2.attributes.position.count)]; out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx); return out; })(), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9 }), N); wheelsM.frustumCulled = false; scene.add(wheelsM);
  const lampGeo = (() => { const g = new THREE.BoxGeometry(0.36, 0.16, 0.06); const l = g.clone().translate(0.62, 0.72, 0), r = g.clone().translate(-0.62, 0.72, 0); const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute([...l.attributes.position.array, ...r.attributes.position.array], 3)); out.setIndex([...l.index.array, ...Array.from(r.index.array, (k) => k + l.attributes.position.count)]); return out; })();
  const headL = new THREE.InstancedMesh(lampGeo.clone().translate(0, 0, 2.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), N), tailL = new THREE.InstancedMesh(lampGeo.clone().translate(0, 0, -2.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  for (const m of [headL, tailL]) { m.frustumCulled = false; scene.add(m); }
  const glowPos = new Float32Array(N * 3), glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  const glow = new THREE.Points(glowGeo, new THREE.ShaderMaterial({ uniforms: world.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uFogDen; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (1.6 + uFogDen * 120.0) * 520.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uNight; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * (exp(-d * d * 6.0) * 0.7 + exp(-d * 3.0) * 0.1) * (0.15 + 0.85 * uNight), 1.0); }' }));
  glow.frustumCulled = false; scene.add(glow);
  function respawn(car, anywhere) {
    car.alongZ = Math.random() < 0.5; car.line = Math.floor(rand(0, NB + 1)); car.dir = Math.random() < 0.5 ? 1 : -1; car.s = anywhere ? rand(-HALF, HALF) : -car.dir * (HALF + 30);
    car.v = rand(6, 10); car.top = rand(8.5, 12.5); car.col = COLS[Math.floor(rand(COLS.length))]; car.yaw = 0; car.stopT = 0; car.turned = -99;
    const [x, z] = pos(car); if (Math.hypot(x - me.x, z - me.z) < 30) car.s -= car.dir * 60;
  }
  const pos = (car) => { const off = (car.alongZ ? -car.dir : car.dir) * 2.5, a = c(car.line) + off; return car.alongZ ? [a, car.s] : [car.s, a]; };
  for (let n = 0; n < N; n++) { const car = {}; respawn(car, true); const [x, z] = pos(car); car.x = x; car.z = z; car.yaw = car.alongZ ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2); cars.push(car); }

  let inCross = false, honkT = 0;
  hooks.tick2 = (dt) => {
    T += dt;
    heads.forEach((h, n) => { const ph = phase(h.i, h.j, h.alongZ, T); for (let k = 0; k < 3; k++) { const on = (k === 0 && ph === 2) || (k === 1 && ph === 1) || (k === 2 && ph === 0), col = on ? ON[k] : OFF[k]; bulbs[k].setColorAt(n, tc.setRGB(col[0], col[1], col[2])); } });
    for (const b of bulbs) b.instanceColor.needsUpdate = true;
    if (G.state !== 'play') { sync(); return; }
    const wet = world.env.wet;
    for (const car of cars) {
      if (car.stopT > 0) { car.stopT -= dt; car.v = 0; continue; }
      let want = car.top * (1 - wet * 0.25) * (G.jam || 1);
      // 前面的路口：红灯或黄灯就在停车线前停住
      const k = Math.round((car.s + HALF) / (HALF * 2 / NB)), cs = c(clamp(k, 0, NB)), dd = (cs - car.s) * car.dir;                  // 到下一个路口中心还有多远（沿行驶方向）
      const nextI = dd >= 0 ? clamp(k, 0, NB) : clamp(k + car.dir, 0, NB), nc = c(nextI), toC = (nc - car.s) * car.dir, toStop = toC - STOP;
      if (nextI >= 0 && nextI <= NB && toStop > -1.5 && toStop < 26) { const ph = car.alongZ ? phase(car.line, nextI, true, T) : phase(nextI, car.line, false, T); if (ph !== 0) want = Math.min(want, Math.max(0, toStop) * 0.9); }
      // 跟车：同一条路同方向前面有车就减速；骑手在车道上也让
      for (const o of cars) { if (o === car || o.alongZ !== car.alongZ || o.line !== car.line || o.dir !== car.dir) continue; const gap = (o.s - car.s) * car.dir; if (gap > 0 && gap < 16) want = Math.min(want, Math.max(0, gap - 6.5) * 1.1); }
      const [cx, cz] = pos(car), fx = car.alongZ ? 0 : car.dir, fz = car.alongZ ? car.dir : 0, mx = me.x - cx, mz = me.z - cz, ahead = mx * fx + mz * fz, side = Math.abs(mx * fz - mz * fx);
      if (ahead > 0 && ahead < 14 && side < 1.9) { want = Math.min(want, Math.max(0, ahead - 5) * 1.2); if (ahead < 8 && honkT <= 0 && hooks.honk) { honkT = 2.5; hooks.honk(); } }
      car.v += clamp(want - car.v, -14 * dt * (1 - wet * 0.3), 4.5 * dt); car.s += car.v * dt * car.dir;
      // 到路口中心：有一定概率拐弯，换到横着的那条路上
      if (Math.abs(toC) < 0.6 && T - car.turned > 4 && Math.random() < 0.3) { const nl = nextI, ns = c(car.line); car.turned = T; car.alongZ = !car.alongZ; car.line = nl; car.s = ns; car.dir = Math.random() < 0.5 ? 1 : -1; }
      else if (Math.abs(toC) < 0.6) car.turned = T;
      if (Math.abs(car.s) > HALF + 34) respawn(car, false);
      const [x, z] = pos(car); car.x += (x - car.x) * Math.min(1, dt * 6); car.z += (z - car.z) * Math.min(1, dt * 6);
      const ty = car.alongZ ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2); let dy = ty - car.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; car.yaw += dy * Math.min(1, dt * 5);
      // 撞到骑手
      const lx = (me.x - car.x) * Math.cos(car.yaw) - (me.z - car.z) * Math.sin(car.yaw), lz = (me.x - car.x) * Math.sin(car.yaw) + (me.z - car.z) * Math.cos(car.yaw);
      if (Math.abs(lx) < 1.35 && Math.abs(lz) < 2.7 && me.crashT <= 0 && (Math.abs(me.v) > 2.5 || car.v > 2.5)) { G.crash(car.v > Math.abs(me.v) ? '被车撞了' : '撞上了汽车'); car.stopT = 2.2; me.x += Math.sign(lx || 1) * Math.cos(car.yaw) * 1.6; me.z -= Math.sign(lx || 1) * Math.sin(car.yaw) * 1.6; }
    }
    if (honkT > 0) honkT -= dt;
    // 骑手闯红灯：进路口那一刻，自己行驶方向的灯是红的
    const qi = Math.round((me.x + HALF) / (HALF * 2 / NB)), qj = Math.round((me.z + HALF) / (HALF * 2 / NB)), inside = Math.abs(me.x - c(qi)) < ROAD + 0.5 && Math.abs(me.z - c(qj)) < ROAD + 0.5;
    if (inside && !inCross && Math.abs(me.v) > 3) { const alongZ = Math.abs(Math.cos(me.a)) > Math.abs(Math.sin(me.a)); if (phase(clamp(qi, 0, NB), clamp(qj, 0, NB), alongZ, T) === 2) { if (hooks.redLight) hooks.redLight(); } }
    inCross = inside;
    sync();
  };
  function sync() {
    const night = world.env.night;
    cars.forEach((car, n) => {
      dummy.position.set(car.x, 0, car.z); dummy.rotation.set(0, car.yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      for (const m of [bodies, glass, wheelsM, headL, tailL]) m.setMatrixAt(n, dummy.matrix);
      bodies.setColorAt(n, tc.setRGB(car.col[0], car.col[1], car.col[2])); headL.setColorAt(n, tc.setRGB(1 + 4 * night, 1 + 3.6 * night, 0.9 + 3 * night)); tailL.setColorAt(n, tc.setRGB(car.v < 1.5 ? 4.5 : 1.2 + night, 0.08, 0.05));
      glowPos.set([car.x + Math.sin(car.yaw) * 2.3, 0.75, car.z + Math.cos(car.yaw) * 2.3], n * 3);
    });
    for (const m of [bodies, glass, wheelsM, headL, tailL]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    glowGeo.attributes.position.needsUpdate = true;
  }
  sync();
  return { cars, phase: (i, j, z) => phase(i, j, z, T) };
}
