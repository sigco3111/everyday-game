// 《回声：骑手》路上的各种情况：交警查车、学校路段限速抓拍、逆行和人行道、过斑马线的行人、
// 突然窜出来的人、施工占道、路边停的车突然开门、高峰堵车。
// 约定和 traffic.js 一样：靠右行驶。朝 +z 走时右手边是 -x，朝 +x 走时右手边是 +z。
import * as THREE from 'three';
import { P, NB, HALF, ROAD, WALK, c } from './world.js?v=5';

export function startHazards(G) {
  const { world, me, hooks, rand, clamp, $ } = G, { scene } = world, ui = G.ui, pick = (a) => a[Math.floor(Math.random() * a.length)];
  const S = (col, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, ...o }), B = (col) => new THREE.MeshBasicMaterial({ color: col });
  const M = (parent, geo, mat, x = 0, y = 0, z = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; parent.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n);
  function plate(lines, bg, fg, round) {                              // 一块写着字的牌子
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    if (round) { g.fillStyle = '#d8281c'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(128, 128, 98, 0, 7); g.fill(); } else { g.fillStyle = bg; g.fillRect(0, 0, 256, 256); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 ' + (lines.length > 1 ? 84 : round ? 130 : 100) + 'px "PingFang SC", "Microsoft YaHei", sans-serif'; lines.forEach((t, n) => g.fillText(t, 128, 128 + (n - (lines.length - 1) / 2) * 96 + 6));
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
  }

  // ---------- 路段上的位置 ----------
  // 一个“路段点”：哪条路、沿路坐标 t、行驶方向 dir。d 是离路中线往右手边的距离
  const sideOf = (g) => (g.alongZ ? -g.dir : g.dir), yawOf = (g) => (g.alongZ ? (g.dir > 0 ? 0 : Math.PI) : (g.dir > 0 ? Math.PI / 2 : -Math.PI / 2));
  const pt = (g, t, d) => (g.alongZ ? [c(g.i) + sideOf(g) * d, t] : [t, c(g.i) + sideOf(g) * d]);
  function onRoad(x, z) {                                             // 这个点在哪条路上（路口里不算）
    const ix = Math.round((x + HALF) / P), jz = Math.round((z + HALF) / P), dx = x - c(ix), dz = z - c(jz), inX = Math.abs(dx) < WALK, inZ = Math.abs(dz) < WALK;
    if (inX === inZ) return null; return inX ? { alongZ: true, i: ix, s: z, lat: dx } : { alongZ: false, i: jz, s: x, lat: dz };
  }
  const used = [];
  const SWAPS = [[c(1) + 6.4, c(3) - 20], [c(4) - 6.4, c(1) + 20]];
  function freeSeg(gap = 18, doors = 11) {                            // 找一段空着的路边：离店门、小区门、换电站和别的东西都够远
    for (let n = 0; n < 200; n++) {
      const g = { alongZ: Math.random() < 0.5, i: Math.floor(rand(0, NB + 1)), dir: Math.random() < 0.5 ? 1 : -1 }; g.t = c(Math.floor(rand(0, NB))) + rand(24, 48); const [x, z] = pt(g, g.t, 5);
      if (Math.abs(x) > HALF + 4 || Math.abs(z) > HALF + 4) continue;
      if (used.some((u) => Math.hypot(u[0] - x, u[1] - z) < gap) || SWAPS.some((u) => Math.hypot(u[0] - x, u[1] - z) < 16)) continue;
      if ([...world.shops, ...world.homes].some((u) => Math.hypot(u.x - x, u.z - z) < doors)) continue;
      if (Math.hypot(x - me.x, z - me.z) < 30) continue;
      g.x = x; g.z = z; return g;
    }
    return null;
  }
  const rel = (g, r) => (r && r.alongZ === g.alongZ && r.i === g.i ? { ds: (g.t - r.s) * g.dir, lat: r.lat * sideOf(g) } : null);       // 骑手相对某个路段点：前方还有多远、偏在它那一侧多少
  function place(grp, g) { grp.position.set(g.alongZ ? c(g.i) : g.t, 0, g.alongZ ? g.t : c(g.i)); grp.rotation.y = yawOf(g); }          // 组的原点放在路中线上，本地 +z 是行驶方向，右手边是本地 -x

  // ---------- 施工占道：占掉靠边的半条车道和人行道，得并到机动车道里绕过去 ----------
  const coneGeo = new THREE.ConeGeometry(0.2, 0.62, 10).translate(0, 0.31, 0), coneMat = S(0xff6a1a, { roughness: 0.5 }), stripe = S(0xf4f4f4), barMat = S(0xffc21a), dirt = S(0x4a4036, { roughness: 1 });
  const workPlate = plate(['前方', '施工'], '#ffc21a', '#1a1405'), works = [];
  for (let n = 0; n < 3; n++) {
    const g = freeSeg(); if (!g) break; used.push([g.x, g.z]); const grp = new THREE.Group(); place(grp, g); scene.add(grp); const L = 12;
    for (const z of [-L / 2, L / 2]) { M(grp, box(3.4, 0.22, 0.12), barMat, -5.2, 0.95, z); M(grp, box(3.4, 0.22, 0.12), stripe, -5.2, 0.6, z); for (const x of [-3.6, -6.8]) M(grp, box(0.1, 1.1, 0.1), stripe, x, 0.55, z); }
    for (let z = -L / 2; z <= L / 2; z += 2) M(grp, coneGeo, coneMat, -3.5, 0, z); for (let k = 1; k <= 4; k++) M(grp, coneGeo, coneMat, -3.5 - k * 0.35, 0, -L / 2 - k * 1.6);
    M(grp, box(2.4, 0.5, 5), dirt, -5.6, 0.25, 0.5); M(grp, box(1.2, 0.9, 1.6), dirt, -5.2, 0.5, -2.5); M(grp, cyl(0.5, 0.5, 2.2, 12), S(0x6f7780, { roughness: 0.5 }), -4.6, 0.5, 3.6).rotation.z = Math.PI / 2;
    M(grp, box(0.08, 1.5, 0.08), stripe, -4.2, 0.75, -L / 2 - 7.5); M(grp, box(1.1, 1.1, 0.05), workPlate, -4.2, 1.7, -L / 2 - 7.5);
    const lamp = M(grp, new THREE.SphereGeometry(0.13, 10, 8), B(0xffa020), -3.6, 1.25, -L / 2); lamp.castShadow = false;
    const [x0, z0] = pt(g, g.t - L / 2, 3.4), [x1, z1] = pt(g, g.t + L / 2, 7.0);
    world.solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), why: '撞上施工围挡' });
    works.push({ ...g, lamp, cool: 0 });
  }

  // ---------- 路边停的车：一半压在人行道上，有的会突然开门 ----------
  const pkBody = box(1.86, 0.62, 4.3).translate(0, 0.62, 0), pkCab = box(1.7, 0.56, 2.3).translate(0, 1.2, -0.2), pkGlass = box(1.72, 0.44, 2.34).translate(0, 1.22, -0.2), pkWheel = box(2.0, 0.62, 0.7), doorGeo = box(0.07, 0.86, 1.1).translate(0, 0, -0.55);
  const glassM = S(0x0a0e14, { roughness: 0.05 }), tyreM = S(0x0b0b0d, { roughness: 0.9 }), parked = [];
  for (let n = 0; n < 8; n++) {
    const g = freeSeg(14, 9); if (!g) break; used.push([g.x, g.z]); const grp = new THREE.Group(); place(grp, g); scene.add(grp); const col = pick([0xb8bcc4, 0x16181c, 0x8a1818, 0x1d3a7a, 0xd9d9d9, 0x4d5560]), mat = S(col, { roughness: 0.25, metalness: 0.5 });
    const car = new THREE.Group(); car.position.x = -5; grp.add(car); M(car, pkBody, mat); M(car, pkCab, mat); M(car, pkGlass, glassM); M(car, pkWheel, tyreM, 0, 0.31, 1.35); M(car, pkWheel, tyreM, 0, 0.31, -1.35);
    const hinge = new THREE.Group(); hinge.position.set(0.94, 0.78, 0.75); car.add(hinge); M(hinge, doorGeo, mat);
    const [x0, z0] = pt(g, g.t - 2.15, 4.07), [x1, z1] = pt(g, g.t + 2.15, 5.93);
    world.solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), why: '撞上了路边停的车' });
    parked.push({ ...g, hinge, open: 0, openT: 0, armed: true, hit: false });
  }

  // ---------- 学校路段：限速 30，有测速抓拍 ----------
  const limPlate = plate(['30'], '#ffffff', '#111111', true), schPlate = plate(['学校', '慢行'], '#ffd21a', '#1a1405'), poleM = S(0x8a9098, { roughness: 0.4, metalness: 0.6 }), zones = [];
  for (let n = 0; n < 2; n++) {
    const g = freeSeg(40, 0); if (!g) break; used.push([g.x, g.z]); const grp = new THREE.Group(); place(grp, g); scene.add(grp); const L = 44;
    for (const s of [-1, 1]) { const x = -s * 5.6, z = -s * L / 2; M(grp, cyl(0.06, 0.06, 3.4), poleM, x, 1.7, z); M(grp, new THREE.CircleGeometry(0.55, 24), limPlate, x, 3.0, z - s * 0.05, s > 0 ? Math.PI : 0); M(grp, box(0.9, 0.9, 0.04), schPlate, x, 1.95, z - s * 0.05, s > 0 ? Math.PI : 0); }
    M(grp, cyl(0.09, 0.11, 5.6), poleM, -5.6, 2.8, 0); M(grp, box(5.2, 0.1, 0.1), poleM, -3.1, 5.5, 0); for (const x of [-2.5, 2.5 - 3.0]) M(grp, box(0.3, 0.22, 0.5), S(0x23272e), x, 5.3, 0);
    const flash = M(grp, new THREE.SphereGeometry(0.16, 10, 8), B(0x111111), -2.5, 5.05, 0.1); flash.castShadow = false;
    zones.push({ ...g, L, flash, caught: false, inside: false, over: 0, flashT: 0 });
  }

  // ---------- 交警查车点：一个交警、一辆警用摩托、一排锥桶。每隔一阵换个地方 ----------
  const copPlate = plate(['交警', '检查'], '#1a4fd0', '#ffffff'), cops = [];
  for (let n = 0; n < 2; n++) {
    const grp = new THREE.Group(); scene.add(grp);
    const man = new THREE.Group(); man.position.set(-4.3, 0, 0); grp.add(man);
    M(man, new THREE.CapsuleGeometry(0.15, 0.6, 5, 10), S(0x1a2233), 0, 0.46, 0); M(man, new THREE.CapsuleGeometry(0.2, 0.42, 5, 10), S(0xc8f03a, { roughness: 0.5 }), 0, 1.2, 0); M(man, box(0.44, 0.07, 0.42), stripe, 0, 1.22, 0);
    M(man, new THREE.SphereGeometry(0.15, 14, 10), S(0xe8b88c), 0, 1.68, 0); M(man, cyl(0.17, 0.18, 0.1, 14), stripe, 0, 1.83, 0); M(man, cyl(0.2, 0.2, 0.025, 14), S(0x10141c), 0, 1.78, -0.08);
    const arm = new THREE.Group(); arm.position.set(0.24, 1.42, 0); man.add(arm); M(arm, new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), S(0xc8f03a, { roughness: 0.5 }), 0, 0.3, 0); M(arm, box(0.06, 0.34, 0.02), B(0xff3a2a), 0, 0.72, 0);   // 举着的那只手拿着停车牌
    const moto = new THREE.Group(); moto.position.set(-6.2, 0, 3.2); grp.add(moto); M(moto, box(0.5, 0.5, 1.7), S(0xf2f4f6, { roughness: 0.3 }), 0, 0.65, 0); M(moto, box(0.52, 0.16, 0.9), S(0x1a4fd0, { roughness: 0.3 }), 0, 0.62, 0); for (const z of [-0.75, 0.75]) M(moto, cyl(0.3, 0.3, 0.16, 14), tyreM, 0, 0.3, z).rotation.z = Math.PI / 2; M(moto, box(0.5, 0.4, 0.06), glassM, 0, 1.15, 0.7);
    const l1 = M(moto, new THREE.SphereGeometry(0.1, 8, 6), B(0xff2a1a), -0.18, 1.0, -0.8), l2 = M(moto, new THREE.SphereGeometry(0.1, 8, 6), B(0x2a5aff), 0.18, 1.0, -0.8); l1.castShadow = l2.castShadow = false;
    for (let k = 0; k < 6; k++) M(grp, coneGeo, coneMat, -3.4, 0, -k * 2.2); M(grp, box(0.08, 1.4, 0.08), stripe, -5.6, 0.7, -17); M(grp, box(1.1, 1.1, 0.05), copPlate, -5.6, 1.6, -17);
    cops.push({ grp, arm, l1, l2, on: false, cool: 0, flag: 0, seen: false, checkT: 0 });
  }
  function moveCops(quiet) {
    for (const k of cops) { const i = used.indexOf(k.u); if (i >= 0) used.splice(i, 1); const g = freeSeg(22); if (!g) { k.on = false; k.grp.visible = false; continue; } Object.assign(k, g, { on: true, flag: 0, seen: false, checkT: 0, cool: 0 }); k.u = [g.x, g.z]; used.push(k.u); place(k.grp, g); k.grp.visible = true; }
    G.marks = cops.filter((k) => k.on).map((k) => ({ x: k.x, z: k.z, col: '#4a8cff' }));
    if (!quiet) ui.toast('骑手群消息：交警换地方查车了，地图上的蓝点', 'sys', 4.5);
  }
  const nearCop = (d) => cops.some((k) => k.on && Math.hypot(k.x - me.x, k.z - me.z) < d);
  // 闯红灯：附近有交警就是当场拦下，没有才是看电子眼拍没拍到
  const redOld = hooks.redLight; hooks.redLight = () => { if (nearCop(75)) { hooks.fine('闯红灯，被交警当场拦下', 30); ui.say('违章了，开罚单。', 2.5, 5, 0.6); } else if (redOld) redOld(); };

  // ---------- 行人 ----------
  const PN = 12, peds = [], dm = new THREE.Object3D(), tc = new THREE.Color(), CLOTH = [0xd94a3a, 0x2f6fd0, 0xe8e2d0, 0x2a2f38, 0x3a9a5a, 0xe0a030, 0x8a4ab0, 0x5a6470];
  const pBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.85, 5, 10).translate(0, 0.72, 0), S(0xffffff), PN), pHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 12, 9).translate(0, 1.55, 0), S(0xe8b88c), PN);
  for (const m of [pBody, pHead]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
  for (let n = 0; n < PN; n++) { peds.push({ kind: n < 2 ? 'jay' : 'zebra', st: 'off', x: 0, z: -999, tx: 0, tz: 0, sp: 1.4, k: 0, cool: n < 2 ? rand(25, 60) : rand(0, 4), col: pick(CLOTH), warned: false, last: -1 }); pBody.setColorAt(n, tc.setHex(peds[n].col)); }
  function spawnZebra(p) {                                            // 挑骑手附近的一个路口、一条斑马线，站在路边等灯
    for (let n = 0; n < 12; n++) {
      const i = Math.round((me.x + HALF) / P) + Math.floor(rand(-1, 2)), j = Math.round((me.z + HALF) / P) + Math.floor(rand(-1, 2)); if (i < 0 || i > NB || j < 0 || j > NB) continue;
      const ax = Math.random() < 0.5, s = Math.random() < 0.5 ? 1 : -1, d = Math.random() < 0.5 ? 1 : -1;
      const x0 = ax ? c(i) - d * 8.8 : c(i) + s * 7.5, z0 = ax ? c(j) + s * 7.5 : c(j) - d * 8.8, x1 = ax ? c(i) + d * 8.8 : x0, z1 = ax ? z0 : c(j) + d * 8.8;
      if (Math.max(Math.abs(x0), Math.abs(z0), Math.abs(x1), Math.abs(z1)) > HALF + WALK - 0.5 || Math.hypot(x0 - me.x, z0 - me.z) < 14) continue;
      Object.assign(p, { st: 'wait', x: x0, z: z0, tx: x1, tz: z1, i, j, roadZ: ax, sp: rand(1.25, 1.75), k: 0, warned: false, last: -1, waitT: 0, c0: ax ? c(i) : c(j) }); return;
    }
    p.st = 'off'; p.cool = 2;
  }

  // ---------- 每帧 ----------
  let T = 0, copT = 150, wrongT = 0, walkT = 0, wrongCool = 0, walkCool = 0, jamOn = false, lastCrash = 0;
  const limEl = $('lim');
  hooks.dayStart = () => { copT = 150; moveCops(true); wrongT = walkT = 0; jamOn = false; G.jam = 1; G.hold = null; for (const p of peds) { p.st = 'off'; p.cool = p.kind === 'jay' ? rand(25, 60) : rand(0, 4); } for (const z of zones) { z.caught = false; z.inside = false; } };
  moveCops(true);
  hooks.tick3 = (dt) => {
    T += dt;
    for (const w of works) w.lamp.material.color.setHex(Math.sin(T * 6) > 0 ? 0xffb030 : 0x3a2408);
    for (const k of cops) { if (!k.on) continue; const b = Math.sin(T * 9) > 0; k.l1.material.color.setHex(b ? 0xff2a1a : 0x300805); k.l2.material.color.setHex(b ? 0x08103a : 0x3a6aff); k.arm.rotation.z = k.flag === 1 ? -0.5 + Math.sin(T * 7) * 0.45 : -2.6; }
    if (G.state !== 'play') { syncPeds(); return; }
    const r = onRoad(me.x, me.z), sp = Math.abs(me.v), hz = Math.cos(me.a), hx = Math.sin(me.a), dir = r ? (Math.abs(r.alongZ ? hz : hx) > 0.6 ? Math.sign(r.alongZ ? hz : hx) : 0) : 0;
    const rl = r && dir ? r.lat * (r.alongZ ? -dir : dir) : 0;                                 // 正数：在自己行驶方向的右半边

    // 高峰堵车
    const peak = (G.hour > 11.5 && G.hour < 13) || (G.hour > 17.8 && G.hour < 19.8); G.jam = (G.jam || 1) + ((peak ? 0.5 : 1) - (G.jam || 1)) * Math.min(1, dt * 0.3);
    if (peak !== jamOn) { jamOn = peak; if (peak) { ui.toast((G.hour < 15 ? '午高峰' : '晚高峰') + '：路上堵起来了，机动车道走不快', 'sys', 4); ui.say('堵死了', 1, 60, 1.5); } }

    // 逆行、人行道上骑太快
    if (wrongCool > 0) wrongCool -= dt; if (walkCool > 0) walkCool -= dt;
    if (r && dir && sp > 4 && Math.abs(r.lat) < ROAD && rl < -1) { wrongT += dt; if (wrongT > 2.5 && wrongCool <= 0) { if (nearCop(50)) { hooks.fine('逆行，被交警拦下', 20); ui.say('违章了，开罚单。', 2.5, 5, 0.6); wrongCool = 20; } else if (Math.random() < 0.25) { hooks.fine('逆行被抓拍', 20); wrongCool = 20; } else { ui.toast('你在逆行：靠右边走，对面有车', 'bad', 2.5); wrongCool = 5; } } } else wrongT = Math.max(0, wrongT - dt * 2);
    if (r && sp > 6 && Math.abs(r.lat) > ROAD + 0.4) { walkT += dt; if (walkT > 1.5 && walkCool <= 0) { if (nearCop(50) || Math.random() < 0.25) { hooks.fine('在人行道上骑太快', 10); walkCool = 20; } else { ui.toast('人行道上慢点骑，超过 20 会被罚', 'bad', 2.5); walkCool = 6; } } } else walkT = Math.max(0, walkT - dt * 2);

    // 学校路段限速
    let lim = 0;
    for (const z of zones) {
      const q = rel(z, r), inside = !!q && Math.abs(q.ds) < z.L / 2 && Math.abs(q.lat) < ROAD + 0.5; if (z.flashT > 0) { z.flashT -= dt; z.flash.material.color.setScalar(z.flashT > 0 ? 6 : 0.07); }
      if (q && !inside && Math.abs(q.ds) < z.L / 2 + 26 && !z.near && sp > 5) { z.near = true; ui.toast('前方学校路段，限速 30，有测速', 'sys', 3); ui.say('前方学校路段，请减速慢行', 2, 20); } else if (!q || Math.abs(q.ds) > z.L / 2 + 40) z.near = false;
      if (inside) { lim = 30; if (sp * 3.6 > 33 && !z.caught) { z.over += dt; if (z.over > 0.5) { z.caught = true; z.flashT = 0.25; world.env.flash = Math.max(world.env.flash || 0, 0.5); hooks.fine('学校路段超速 ' + Math.round(sp * 3.6) + ' km/h，被抓拍', 30); ui.say('您已超速', 2, 5, 0.3); } } else z.over = 0; }
      else if (z.inside) { z.caught = false; z.over = 0; } z.inside = inside;
    }
    if (limEl) { limEl.style.display = lim ? 'flex' : 'none'; limEl.className = lim && sp * 3.6 > 33 ? 'over' : ''; }

    // 施工：快到了提醒一声
    for (const w of works) { if (w.cool > 0) w.cool -= dt; const q = rel(w, r); if (q && dir === w.dir && q.ds > 8 && q.ds < 42 && q.lat > 0 && sp > 4 && w.cool <= 0) { w.cool = 40; ui.toast('前方施工占道：往左并线绕过去，留意后面的车', 'sys', 3.5); ui.say('前方施工，请注意避让', 2, 15); } }

    // 路边的车开门
    for (const p of parked) {
      const q = rel(p, r);
      if (q && dir === p.dir && q.ds > 4.5 && q.ds < 10 && q.lat > 1.2 && q.lat < 4.4 && sp > 4) { if (p.armed) { p.armed = false; if (Math.random() < 0.4) { p.openT = 3.5; p.hit = false; } } } else if (!q || q.ds < -8 || q.ds > 30) p.armed = true;
      if (p.openT > 0) p.openT -= dt; p.open += ((p.openT > 0 ? 1 : 0) - p.open) * Math.min(1, dt * (p.openT > 0 ? 14 : 3)); p.hinge.rotation.y = -p.open * 1.15;
      if (q && p.open > 0.6 && !p.hit && Math.abs(q.ds + 0.3) < 0.75 && q.lat > 2.6 && q.lat < 4.3 && sp > 2.5 && me.crashT <= 0) { p.hit = true; G.crash('被突然打开的车门撞了'); ui.say('哎哟对不起对不起，没看到你！', 2.5, 5, 0.9); setTimeout(() => ui.pay(40, '车主全责，赔了你医药费'), 2600); }
      else if (q && p.open > 0.6 && !p.hit && Math.abs(q.ds) < 1.5 && q.lat < 2.6 && q.lat > 0 && sp > 4) { p.hit = true; ui.say('吓死我了', 1, 15, 0.2); ui.feel(-2, '😨'); }
    }

    // 交警查车
    copT -= dt; if (copT <= 0) { copT = rand(130, 190); if (!G.hold) moveCops(false); }
    let hold = null;
    for (const k of cops) {
      if (!k.on) continue; if (k.cool > 0) k.cool -= dt; const q = rel(k, r);
      if (!q || dir === -k.dir && !k.checkT) { if (!q || Math.abs(q.ds) > 60) { k.flag = 0; k.seen = false; } continue; }
      if (k.cool > 0) continue;
      if (!k.seen && q.ds > 6 && q.ds < 48 && dir === k.dir) {                                 // 远远看到了：这次拦不拦你
        k.seen = true; k.flag = Math.random() < 0.65 ? 1 : 2;
        if (k.flag === 1) { ui.toast('交警示意你靠边：在交警旁边停下接受检查', 'bad', 4); ui.say('完了，有交警', 1, 30, 0.2); ui.say('你好，例行检查，靠边停一下。', 2.5, 10, 1.6); } else ui.toast('前面有交警，这次没拦你，规矩点骑', 'sys', 3);
      }
      if (k.flag === 1) {
        if (Math.abs(q.ds) < 7 && sp < 1.5) {                                                  // 停下了：查证件、头盔、号牌、外卖箱
          if (!k.checkT) { k.checkT = 0.001; k.len = 3.2; }
          k.checkT += dt; hold = { text: '交警检查：证件、头盔、号牌、外卖箱…', k: k.checkT / k.len };
          if (k.checkT >= k.len) { k.checkT = 0; k.flag = 0; k.cool = 45; const x = Math.random();
            if (x < 0.7) { ui.toast('证件齐全，放行', 'good', 3); ui.say('没问题，走吧，注意安全。', 2.5, 5, 0.2); }
            else if (x < 0.86) { ui.toast('外卖箱超宽，口头警告一次', 'sys', 3.5); ui.say('这次给你警告，下次要罚款了。', 2.5, 5, 0.2); ui.feel(-2, '😓'); }
            else { hooks.fine('号牌被外卖箱挡住', 10); ui.say('违章了，开罚单。', 2.5, 5, 0.2); } }
        } else if (q.ds < -9) {                                                                // 没停，冲过去了
          k.flag = 0; k.cool = 45; k.checkT = 0; if (Math.random() < 0.7) { hooks.fine('不服从交警指挥，冲卡', 50); ui.feel(-4, '😱'); } else { ui.toast('冲卡了…这次交警没追上来', 'bad', 3); ui.say('吓死我了', 1, 15, 0.4); }
        }
      } else if (q.ds < -9) { k.seen = false; k.flag = 0; k.cool = 20; }
    }
    G.hold = hold;

    // 行人
    for (const p of peds) {
      if (p.st === 'off') {
        p.cool -= dt; if (p.cool > 0) continue;
        if (p.kind === 'zebra') spawnZebra(p);
        else if (r && dir && sp > 7 && rl > 0) {                                               // 前面二十几米的路边冒出来一个人，等你近了突然横穿
          const s0 = r.s + dir * 30, kk = Math.round((s0 + HALF) / P); if (Math.abs(s0 - c(kk)) < 18 || Math.abs(s0) > HALF) { p.cool = 3; continue; }
          const g = { alongZ: r.alongZ, i: r.i, dir }, [x0, z0] = pt(g, s0, 6.2), [x1, z1] = pt(g, s0, -6.4); if (world.solids.some((b) => x0 > b.x0 - 1 && x0 < b.x1 + 1 && z0 > b.z0 - 1 && z0 < b.z1 + 1)) { p.cool = 3; continue; }
          Object.assign(p, { st: 'lurk', x: x0, z: z0, tx: x1, tz: z1, sp: 3.0, k: 0, warned: false, g, s0, c0: c(r.i), roadZ: r.alongZ, waitT: 0 });
        } else p.cool = 1;
        continue;
      }
      p.k = Math.min(1, p.k + dt * 3);
      if (p.st === 'wait') { const ph = G.traffic.phase(p.i, p.j, p.roadZ); p.waitT += dt; if (ph === 2 && p.last !== 2 && p.last !== -1) { p.st = 'walk'; } p.last = ph; if (Math.hypot(p.x - me.x, p.z - me.z) > 190 || p.waitT > 60) { p.st = 'off'; p.cool = 1; } }
      else if (p.st === 'lurk') { const q = rel({ ...p.g, t: p.s0 }, r); p.waitT += dt; if (q && q.ds < 15 && q.ds > 4) { p.st = 'walk'; ui.say('看路啊大哥', 1, 20, 0.5); } else if (!q || q.ds <= 4 || p.waitT > 8) { p.st = 'off'; p.cool = rand(15, 30); } }
      else if (p.st === 'walk') {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz); if (d < 0.2) { p.st = 'gone'; p.k = 1; continue; } p.x += dx / d * p.sp * dt; p.z += dz / d * p.sp * dt;
        const onLane = Math.abs((p.roadZ ? p.x : p.z) - p.c0) < ROAD + 0.3, dm2 = Math.hypot(p.x - me.x, p.z - me.z);
        if (onLane) for (const car of G.traffic.cars) { const fx = car.alongZ ? 0 : car.dir, fz = car.alongZ ? car.dir : 0, ah = (p.x - car.x) * fx + (p.z - car.z) * fz, sd = Math.abs((p.x - car.x) * fz - (p.z - car.z) * fx); if (ah > 0 && ah < 9 && sd < 2.2) car.stopT = Math.max(car.stopT, 0.35); }
        if (dm2 < 0.85 && sp > 2 && me.crashT <= 0) { G.crash('撞到行人了'); ui.say('你怎么骑车的！', 2.5, 5, 0.7); setTimeout(() => hooks.fine('撞伤行人，垫付医药费', 80), 1500); p.st = 'gone'; p.k = 1; }
        else if (dm2 < 2.4 && sp > 5 && !p.warned && onLane) { p.warned = true; if (p.kind === 'zebra') { if (Math.random() < 0.4) hooks.fine('斑马线没让行人，被抓拍', 20); else ui.toast('差点撞到人：斑马线上要让行人', 'bad', 3); ui.say('你怎么骑车的！', 2.5, 20, 0.2); } else { ui.say('吓死我了', 1, 15, 0.3); ui.feel(-2, '😨'); } }
      }
      else if (p.st === 'gone') { p.k -= dt * 6; if (p.k <= 0) { p.st = 'off'; p.z = -999; p.cool = p.kind === 'jay' ? rand(40, 80) : rand(1, 5); } }
    }
    syncPeds();
  };
  function syncPeds() {
    peds.forEach((p, n) => { const on = p.st !== 'off', k = on ? clamp(p.k, 0.01, 1) : 0.0001, walking = p.st === 'walk'; dm.position.set(p.x, on ? (walking ? Math.abs(Math.sin(T * 9 + n)) * 0.07 : 0) : -50, p.z); dm.rotation.set(0, Math.atan2(p.tx - p.x, p.tz - p.z), walking ? Math.sin(T * 9 + n) * 0.06 : 0); dm.scale.setScalar(k); dm.updateMatrix(); pBody.setMatrixAt(n, dm.matrix); pHead.setMatrixAt(n, dm.matrix); });
    pBody.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true; if (pBody.instanceColor) pBody.instanceColor.needsUpdate = true;
  }
  syncPeds();
  // 调试入口
  window.__haz = { cops, zones, works, parked, peds, moveCops, onRoad, rel, pt, yawOf, get info() { return { cops: cops.map((k) => [k.on, k.alongZ, k.i, Math.round(k.t), k.dir, k.flag]), zones: zones.length, works: works.length, parked: parked.length, peds: peds.map((p) => p.kind[0] + ':' + p.st), jam: +(G.jam || 1).toFixed(2), hold: G.hold }; } };
}
