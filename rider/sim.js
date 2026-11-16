// 《回声：骑手》的平台模拟：派单、时限算法、出餐等待、交付、超时扣款、评价和服务分、冲单奖励、日结。
// 时间：现实 1 秒 = 游戏里 1 分钟。一天从 10:30 跑到 22:30，共 12 分钟。地图上 1 米按 8 米算成“公里数”显示。
import * as THREE from 'three';
import { WEATHER, P, NB, HALF, c } from './world.js?v=3';

export function start(G) {
  const { world, me, hooks, $, rand, clamp } = G, { scene } = world;
  const pick = (a) => a[Math.floor(Math.random() * a.length)], KM = 8 / 1000, yuan = (v) => (v < 0 ? '−¥' : '¥') + Math.abs(v).toFixed(1);
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);                     // 城里只能沿路走，按横平竖直算路程
  const SWAP = [{ name: '换电站', x: c(1) + 6.4, z: c(3) - 20 }, { name: '换电站', x: c(4) - 6.4, z: c(1) + 20 }];
  // 交付时可能遇到的情况：名字、要多花的秒数、出现的权重
  const HANDOFF = [['顾客在门口等你', 2, 5], ['放门口，拍照', 3, 4], ['小区不让电动车进，跑进去', 7, 3], ['没电梯，爬 6 楼', 9, 2], ['写字楼等电梯', 7, 2], ['顾客电话打不通', 8, 1], ['保安要登记', 5, 2]];
  const HBAG = HANDOFF.flatMap((h) => Array(h[2]).fill(h));
  const LEVELS = [[0, '青铜骑手'], [15, '白银骑手'], [40, '黄金骑手'], [80, '钻石骑手'], [150, '王者骑手']];

  // ---------- 存档里只留跨天的东西 ----------
  const save = (() => { try { return JSON.parse(localStorage.getItem('echo_rider')) || {}; } catch (e) { return {}; } })();
  save.day = save.day || 1; save.algo = save.algo || 0.85; save.rating = save.rating === undefined ? 90 : save.rating; save.total = save.total || 0; save.best = save.best || 0; save.orders = save.orders || 0;
  const persist = () => { try { localStorage.setItem('echo_rider', JSON.stringify(save)); } catch (e) { /* 存不了就算了 */ } };

  // ---------- 一天的状态 ----------
  let orders = [], offer = null, offerT = 3, oid = 0, cur = null, wxPlan = [], wxI = 0, banT = 0, wait = null, muted = false, swapT = 0, lastWx = '';
  const day = { fee: 0, tip: 0, bonus: 0, cut: 0, fine: 0, spill: 0, done: 0, late: 0, good: 0, bad: 0, reject: 0, offers: 0, sec: 0, bonusAt: 0, crashes: 0, swap: 0 };
  const demand = (h) => 0.55 + 1.1 * Math.exp(-(((h - 12) / 1.1) ** 2)) + 1.25 * Math.exp(-(((h - 18.7) / 1.3) ** 2)) + (h > 21 ? 0.2 : 0);      // 午高峰、晚高峰
  const wxMul = () => ({ clear: 1, cloudy: 1, drizzle: 1.35, storm: 1.8, fog: 1.15 }[G.weather]), wxSub = () => ({ clear: 0, cloudy: 0, drizzle: 1.5, storm: 3.5, fog: 1 }[G.weather]);
  const level = () => { let n = LEVELS[0][1]; for (const [k, v] of LEVELS) if (save.orders >= k) n = v; return n; };

  // ---------- 声音 ----------
  let ac = null, master = null, motor = null, motorG = null, rainG = null;
  function audio() {
    if (ac) { if (ac.state !== 'running') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
      motor = ac.createOscillator(); motor.type = 'sawtooth'; motorG = ac.createGain(); motorG.gain.value = 0; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; motor.connect(lp); lp.connect(motorG); motorG.connect(master); motor.start();
      const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const rs = ac.createBufferSource(); rs.buffer = nb; rs.loop = true; const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800; rainG = ac.createGain(); rainG.gain.value = 0; rs.connect(rf); rf.connect(rainG); rainG.connect(master); rs.start(); } catch (e) { ac = null; }
  }
  function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
  const sfx = { ding: () => { tone('sine', 1320, 1320, 0.12, 0.2); tone('sine', 1760, 1760, 0.25, 0.2, 0.12); }, cash: () => [988, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.12, 0.16, i * 0.07)), bad: () => { tone('sawtooth', 300, 150, 0.3, 0.2); }, tick: () => tone('square', 1000, 1000, 0.04, 0.06), ok: () => tone('triangle', 660, 990, 0.12, 0.14), crash: () => { tone('sawtooth', 200, 40, 0.5, 0.35); tone('square', 900, 200, 0.2, 0.2); } };

  // ---------- 配音：voice_sys 是平台的系统女声，voice 是骑手自己的碎碎念（广西口音）。系统播报优先 ----------
  const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
  for (const dir of ['voice_sys', 'voice']) fetch(dir + '/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, sys: dir === 'voice_sys', raw: fetch(dir + '/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
  function say(text, pri = 1, gap = 0, delay = 0) {
    if (delay) { setTimeout(() => say(text, pri, gap), delay * 1000); return; }
    const cl = clips[text], now = performance.now(); if (!cl || G.state === 'title' || (gap && now - (sayLast[text] || 0) < gap * 1000) || (now < sayUntil && pri <= sayPri)) return;
    sayLast[text] = now; sayUntil = now + cl.dur * 1000 + 150; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
    const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 已经放完 */ } clipSrc = null; }
    if (!ac || muted) return;
    (cl.buf || (cl.buf = cl.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = buf; gn.gain.value = cl.sys ? 1.5 : 1.7; src.connect(gn); gn.connect(master); src.start(); clipSrc = src; }).catch(() => {});
  }

  // ---------- 界面小件 ----------
  function toast(text, cls = '', sec = 3.2) { const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; $('toasts').appendChild(el); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); setTimeout(() => el.remove(), sec * 1000); }
  function banner(text, sec = 1.6) { $('banner').textContent = text; banT = sec; }
  const hhmm = (h) => Math.floor(h) + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
  const beacons = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.position.y = 30; m.visible = false; scene.add(m); const r = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); r.position.y = -29.9; m.add(r); return m; });

  // ---------- 导航 ----------
  const M8 = (d) => { const m = Math.round(d * 8 / 10) * 10; return m >= 1000 ? (m / 1000).toFixed(1) + ' 公里' : m + ' 米'; };
  const onV = (p) => { const i = Math.round((p.x + HALF) / P); return Math.abs(p.x - c(i)) < 8.6 ? i : -1; }, onH = (p) => { const j = Math.round((p.z + HALF) / P); return Math.abs(p.z - c(j)) < 8.6 ? j : -1; };
  function route(a, b) {                                              // 沿路走到目标：最多拐两个弯
    const pts = [{ x: a.x, z: a.z }], ai = onV(a), aj = onH(a), bi = onV(b), bj = onH(b);
    const via = (from, to) => { let best = 0, bv = 1e9; for (let k = 0; k <= NB; k++) { const v = Math.abs(from - c(k)) + Math.abs(c(k) - to); if (v < bv) { bv = v; best = k; } } return best; };
    if (bi >= 0) { if (ai === bi) { /* 同一条竖路，直走 */ } else if (aj >= 0) pts.push({ x: c(bi), z: c(aj) }); else { const k = via(a.z, b.z), i0 = ai >= 0 ? ai : Math.round((a.x + HALF) / P); pts.push({ x: c(i0), z: c(k) }, { x: c(bi), z: c(k) }); } }
    else if (bj >= 0) { if (aj === bj) { /* 同一条横路 */ } else if (ai >= 0) pts.push({ x: c(ai), z: c(bj) }); else { const k = via(a.x, b.x), j0 = aj >= 0 ? aj : Math.round((a.z + HALF) / P); pts.push({ x: c(k), z: c(j0) }, { x: c(k), z: c(bj) }); } }
    pts.push({ x: b.x, z: b.z }); return pts;
  }
  const CHN = 26, chevGeo = new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(0, 0.9); sh.lineTo(0.95, -0.5); sh.lineTo(0.5, -0.5); sh.lineTo(0, 0.25); sh.lineTo(-0.5, -0.5); sh.lineTo(-0.95, -0.5); sh.closePath(); return sh; })()).rotateX(Math.PI / 2);
  const chevMat = new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }), chev = new THREE.InstancedMesh(chevGeo, chevMat, CHN); chev.frustumCulled = false; chev.count = 0; chev.renderOrder = 3; scene.add(chev);
  const cd = new THREE.Object3D(), v3 = new THREE.Vector3(); let path = null, navT = 0;
  // 下车跑进去的小人
  const runner = new THREE.Group(); { const mat = new THREE.MeshStandardMaterial({ color: 0xffc61a, roughness: 0.7 }), mk2 = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; runner.add(o); return o; };
    mk2(new THREE.CapsuleGeometry(0.2, 0.5, 6, 10), mat, 1.05); mk2(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffc61a, roughness: 0.3 }), 1.62); mk2(new THREE.CapsuleGeometry(0.16, 0.5, 6, 10), new THREE.MeshStandardMaterial({ color: 0x20242c }), 0.45); const bag = mk2(new THREE.BoxGeometry(0.3, 0.26, 0.22), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0.95); bag.position.x = 0.3; runner.userData.bag = bag; }
  runner.visible = false; scene.add(runner);
  function runTo(t, k, carry) {                                       // k 从 0 到 1：跑到门口 → 进去 → 跑回来
    const dx = t.x - t.nx * 1.7, dz = t.z - t.nz * 1.7, out = k < 0.3 ? k / 0.3 : k > 0.72 ? (1 - k) / 0.28 : 1, inside = k >= 0.3 && k <= 0.72;
    runner.visible = !inside; G.riderG.visible = false; runner.position.set(me.x + (dx - me.x) * out, Math.abs(Math.sin(performance.now() / 70)) * 0.12, me.z + (dz - me.z) * out); runner.rotation.y = Math.atan2(dx - me.x, dz - me.z) + (k > 0.72 ? Math.PI : 0); runner.userData.bag.visible = carry ? k < 0.5 : k > 0.5;
  }
  function updateNav(dt) {
    const o = cur, nav = $('nav'), pin = $('pin'), cta = $('cta');
    if (!o) { nav.style.display = pin.style.display = cta.style.display = 'none'; chev.count = 0; path = null; return; }
    const t = target(o), go = o.st === 'deliver' || o.st === 'hand', col = go ? 0x5aff9a : 0xffb02e; navT -= dt; if (navT <= 0 || !path) { navT = 0.25; path = route(me, t); }
    path[0].x = me.x; path[0].z = me.z;
    // 路面上一串往前流动的箭头
    let n = 0, acc = (performance.now() / 1000 * 7) % 4.5 + 3, tot = 0; chevMat.color.setHex(col);
    for (let i = 0; i + 1 < path.length && n < CHN; i++) { const a = path[i], b = path[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(b.x - a.x, b.z - a.z); while (acc < len && n < CHN && tot + acc < 120) { cd.position.set(a.x + (b.x - a.x) * acc / len, 0.09, a.z + (b.z - a.z) * acc / len); cd.rotation.set(0, ang, 0); cd.scale.setScalar(1.25); cd.updateMatrix(); chev.setMatrixAt(n++, cd.matrix); acc += 4.5; } acc -= len; tot += len; }
    chev.count = n; chev.instanceMatrix.needsUpdate = true;
    // 顶上的转向提示
    const p1 = path[1], d1 = Math.hypot(p1.x - me.x, p1.z - me.z), hx = Math.sin(me.a), hz = Math.cos(me.a), ux = (p1.x - me.x) / (d1 || 1), uz = (p1.z - me.z) / (d1 || 1), cr = hx * uz - hz * ux, dot = hx * ux + hz * uz;
    let main; const sub = (go ? '送：' : '取：') + t.name;
    if (path.length === 2) main = (go ? '送餐点 ' : '取餐点 ') + M8(d1); else { const p2 = path[2], tc2 = (p1.x - path[0].x) * (p2.z - p1.z) - (p1.z - path[0].z) * (p2.x - p1.x); main = M8(d1) + '后' + (tc2 < 0 ? '左转' : '右转'); }
    if (dot < -0.35 && d1 > 10) main = '请掉头';
    if (o.st === 'wait' || o.st === 'hand') main = go ? '已到达送餐点' : '已到达取餐点';
    $('navT').textContent = main; $('navS').textContent = sub + '　全程还有 ' + M8(dist(me, t)); $('navA').firstChild.style.transform = 'rotate(' + (Math.atan2(cr, dot) * 180 / Math.PI).toFixed(0) + 'deg)'; nav.style.display = 'flex'; nav.className = 'panel' + (go ? ' go' : '');
    // 目标头顶的标签：一直贴在屏幕上，出了画面就贴到边上
    v3.set(t.x, 7.5, t.z).project(G.camera); let sx = v3.x, sy = v3.y; const behind = v3.z > 1; if (behind) { sx = -sx; sy = -1; }
    sx = clamp(sx, -0.9, 0.9); sy = clamp(sy, -0.72, 0.84); const r = $('stage').getBoundingClientRect();
    pin.style.display = (o.st === 'wait' || o.st === 'hand') ? 'none' : 'block'; pin.className = go ? 'go' : ''; pin.style.left = ((sx + 1) / 2 * r.width) + 'px'; pin.style.top = ((1 - sy) / 2 * r.height) + 'px'; pin.innerHTML = (go ? '送 ' : '取 ') + t.name + '<i>' + M8(Math.hypot(t.x - me.x, t.z - me.z)) + '</i>';
    // 快到了：告诉人该干什么
    const dd = Math.hypot(t.x - me.x, t.z - me.z), busy = o.st === 'wait' || o.st === 'hand';
    if (!busy && dd < 22) { cta.style.display = 'block'; cta.innerHTML = (dd < 6.5 ? '松开油门，停稳' : '到了，刹车停进光圈') + '<small>停稳后自动' + (go ? '下车送餐' : '下车取餐') + '，不用按别的键</small>'; say('请减速，目的地就在附近', 1, 14); }
    else if (busy && me.lock) { cta.style.display = 'block'; cta.innerHTML = (go ? '正在送餐，稍等' : '正在取餐，稍等') + '<small>车已停好，送完会自动回到车上</small>'; }
    else if (o.st === 'wait') { cta.style.display = 'block'; cta.innerHTML = '商家还在做，等出餐<small>不想干等可以先骑走去送别的单，回来再取</small>'; }
    else cta.style.display = 'none';
  }

  // ---------- 派单 ----------
  function makeOffer() {
    const shop = pick(world.shops), home = pick(world.homes), d1 = dist(me, shop), d2 = dist(shop, home); if (d2 < 60) return null;
    const far = d1 > 260, km = d2 * KM, peak = demand(G.hour) > 1.25, night = G.hour >= 21;
    const prepEst = rand(5, 13), prep = prepEst * (Math.random() < 0.22 ? rand(1.5, 2.6) : rand(0.6, 1.2));                 // 两成的店会出餐慢，平台不管
    const pay = +(3.2 + km * 1.15 + wxSub() + (peak ? 1 : 0) + (night ? 1.5 : 0) + (km > 2.6 ? 1.2 : 0)).toFixed(1);
    // 时限：平台按“它认为你能跑多快”来算。你越准时，它越觉得你还能更快
    const limit = Math.round((d1 + d2) / (10.5 * save.algo) + prepEst + 9);
    return { id: ++oid, shop, home, d1, d2, km, pay, limit, prep, prepEst, hand: pick(HBAG), far, peak };
  }
  function showOffer(o) {
    offer = o; o.ttl = 12; day.offers++; sfx.ding(); say('您有新的回声外卖订单', 2, 5, 0.35);
    $('oText').innerHTML = '<small>新订单' + (o.peak ? ' · 高峰' : '') + (wxSub() ? ' · 天气补贴 ' + yuan(wxSub()) : '') + '</small><br><b>' + yuan(o.pay) + '</b>　' + o.limit + ' 分钟内送达<br>取：' + o.shop.name + '　' + (o.d1 * KM).toFixed(1) + ' km<br>送：' + o.home.name + '　' + o.km.toFixed(1) + ' km';
    $('offer').style.display = 'block';
  }
  function answer(yes) {
    if (!offer) return; const o = offer; offer = null; $('offer').style.display = 'none';
    if (!yes) { day.reject++; save.rating = Math.max(0, save.rating - 0.8); toast('已拒单　接单率下降，服务分 −0.8', 'bad'); offerT = rand(4, 8); return; }
    orders.push({ ...o, st: 'pickup', t: 0, spilled: false }); sfx.ok(); if (o.pay < 5.5 && o.km > 1.6) say('这么远才给这点', 1, 40, 1.4); else if (Math.random() < 0.35) say('又来单了', 1, 30, 1.4); toast('已接单：去 ' + o.shop.name + ' 取餐', 'sys'); if (!cur) cur = orders[orders.length - 1]; offerT = rand(5, 10);
  }
  const target = (o) => (o.st === 'pickup' || o.st === 'wait' ? o.shop : o.home);
  function finish(o) {
    const over = o.t - o.limit; let k = 1, msg = '准时送达', cls = 'good';
    if (over > 8) { k = 0; msg = '严重超时 ' + Math.ceil(over) + ' 分钟，本单配送费清零'; cls = 'bad'; } else if (over > 3) { k = 0.4; msg = '超时 ' + Math.ceil(over) + ' 分钟，扣 60%'; cls = 'bad'; } else if (over > 0) { k = 0.7; msg = '超时 ' + Math.ceil(over) + ' 分钟，扣 30%'; cls = 'bad'; }
    const fee = +(o.pay * k).toFixed(1); day.fee += fee; day.cut += o.pay - fee; day.done++; save.orders++; day.sec += o.t;
    if (over > 0) { day.late++; save.rating -= over > 8 ? 6 : over > 3 ? 4 : 2; save.algo = Math.max(0.7, save.algo - 0.004); sfx.bad(); say('又超时了', 1, 20, 0.8); }
    else { save.rating += 0.4; sfx.cash(); const before = save.algo; save.algo = Math.min(1.3, save.algo + 0.012); if (Math.floor(save.algo * 20) > Math.floor(before * 20)) { toast('系统已根据你的历史速度，优化预计送达时间', 'sys', 4.5); say('已为您优化预计送达时间', 2, 10, 0.8); say('这系统，越跑越紧', 1, 60, 3.6); } else if (Math.random() < 0.4) say('搞定，下一单', 1, 18, 0.6); }
    toast(o.home.name + '：' + msg + '　' + yuan(fee), cls);
    // 顾客评价：准时多半好评，超时、餐洒了容易差评
    const pBad = (over > 8 ? 0.6 : over > 3 ? 0.35 : over > 0 ? 0.15 : 0.02) + (o.spilled ? 0.45 : 0), r = Math.random();
    if (o.spilled) { const pen = +(rand(8, 20)).toFixed(1); day.spill += pen; toast('餐洒了，赔付顾客 ' + yuan(pen), 'bad'); }
    if (r < pBad) { day.bad++; save.rating -= 8; setTimeout(() => { say('您收到一条差评', 2, 5); toast('收到差评：“' + pick(['汤都洒了', '等了半天', '饭都凉了', '态度一般']) + '”　服务分 −8', 'bad', 4); }, 1200); }
    else if (r > 0.62) { day.good++; save.rating += 0.6; if (Math.random() < 0.2 + (wxSub() ? 0.2 : 0)) { const tip = Math.ceil(rand(1, wxSub() ? 10 : 5)); day.tip += tip; setTimeout(() => { say('您收到一笔打赏', 2, 5); say('谢谢老板', 1, 20, 2.2); toast('顾客打赏 ' + yuan(tip) + '：“' + pick(['辛苦了', '下雨天注意安全', '很快，谢谢']) + '”', 'good', 4); }, 1200); } }
    save.rating = clamp(save.rating, 0, 100);
    for (const [n, b] of [[8, 15], [15, 30], [25, 60]]) if (day.done === n && day.bonusAt < n) { day.bonusAt = n; day.bonus += b; banner('冲单奖励 +¥' + b, 2); say('今日冲单奖励已到账', 2, 5, 1); toast('今日完成 ' + n + ' 单，冲单奖励 ' + yuan(b), 'good', 4); }
    orders = orders.filter((x) => x !== o); if (cur === o) cur = orders[0] || null; persist();
    if (save.rating < 60) endDay('服务分低于 60，账号被限制接单');
  }
  hooks.onCrash = (why, v) => { sfx.crash(); day.crashes++; save.rating = Math.max(0, save.rating - 1); toast(why + '　耽误了几分钟', 'bad'); say('哎哟，摔了', 2, 3, 0.3); for (const o of orders) if (o.st === 'deliver' && !o.spilled && Math.random() < 0.6) { o.spilled = true; toast('箱子里的餐洒了…', 'bad'); say('完了，汤洒了', 2, 3, 1.8); } };
  hooks.redLight = () => { day.red = (day.red || 0) + 1; if (Math.random() < 0.35) hooks.fine('闯红灯被电子眼拍到', 20); else toast('闯红灯（这次没被拍到）', 'bad', 2); };
  hooks.honk = () => { tone('square', 420, 420, 0.25, 0.12); tone('square', 520, 520, 0.25, 0.1); };
  hooks.fine = (why, amt) => { day.fine += amt; sfx.bad(); toast(why + '　罚款 ' + yuan(amt), 'bad', 4); };
  hooks.onKey = (code) => { audio(); if (code === 'KeyY') answer(true); else if (code === 'KeyN') answer(false); else if (code === 'Tab' && orders.length) cur = orders[(orders.indexOf(cur) + 1) % orders.length]; else if (code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; } else if ((code === 'Enter' || code === 'Space') && G.state !== 'play') begin(); };
  hooks.onDown = (e) => { audio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a) { begin(); return true; } return false; };
  $('oYes').addEventListener('click', () => answer(true)); $('oNo').addEventListener('click', () => answer(false));

  // ---------- 一天的开始和结束 ----------
  function begin() {
    G.state = 'play'; G.hour = 10.5; orders = []; offer = null; cur = null; wait = null; offerT = 2.5; Object.keys(day).forEach((k) => { day[k] = 0; }); me.batt = 1; me.v = 0; me.crashT = 0;
    wxPlan = []; let h = 10.5; const bag = ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'drizzle', 'drizzle', 'storm', 'fog']; if (save.day === 1) { wxPlan.push([10.5, 'clear']); h = 12.6; }
    while (h < 22.5) { wxPlan.push([h, pick(bag)]); h += rand(1.4, 2.6); } wxI = 0; G.weather = wxPlan[0][1]; lastWx = '';
    $('offer').style.display = 'none'; $('toasts').innerHTML = ''; $('screen').style.display = 'none'; $('hud').style.display = 'block';
    try { const hb = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (hb.days = hb.days || {})[k] = 'rider'; (hb.played = hb.played || {}).rider = k; hb.last = 'rider'; localStorage.setItem('echo_hub', JSON.stringify(hb)); } catch (e) { /* 存不了就算了 */ }
    banner('第 ' + save.day + ' 天 · 上线接单', 2); sayUntil = 0; say('您已上线，开始接单', 2, 0, 0.6); toast('回声外卖：您已上线，系统正在为您派单', 'sys', 4);
  }
  function endDay(why) {
    if (G.state !== 'play') return; G.state = 'over'; const rent = 25, meal = 18, gross = day.fee + day.tip + day.bonus, net = gross - day.fine - day.spill - day.swap - rent - meal, hrs = Math.max(0.5, G.hour - 10.5);
    save.total += net; save.best = Math.max(save.best, net); save.day++; persist(); me.lock = false; runner.visible = false; G.riderG.visible = true; say('累死了，收工', 3); $('nav').style.display = $('pin').style.display = $('cta').style.display = 'none'; chev.count = 0;
    const row = (a, b) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>';
    $('screen').innerHTML = '<h1 style="font-size:44px;letter-spacing:6px">' + (why ? '被迫下线' : '收工') + '</h1><div class="sub">' + (why || hhmm(G.hour) + ' 下线') + '　完成 ' + day.done + ' 单，准时 ' + (day.done ? Math.round((1 - day.late / day.done) * 100) : 0) + '%</div><table>' +
      row('配送费', yuan(day.fee)) + row('超时被扣', yuan(-day.cut)) + row('顾客打赏', yuan(day.tip)) + row('冲单奖励', yuan(day.bonus)) + row('交通罚款', yuan(-day.fine)) + row('餐损赔付', yuan(-day.spill)) + row('租车和换电', yuan(-rent - day.swap)) + row('吃饭', yuan(-meal)) +
      row('<b>今天到手</b>', '<b style="color:#ffd66e">' + yuan(net) + '</b>') + row('折合时薪', yuan(net / hrs) + ' / 小时') + row('好评 / 差评', day.good + ' / ' + day.bad) + row('服务分', save.rating.toFixed(1)) + row('平台预估你的时速', (10.5 * save.algo * 3.6).toFixed(0) + ' km/h') + '</table>' +
      '<div class="sub" style="margin-top:12px;font-size:13px">' + level() + '　累计 ' + save.orders + ' 单　最高日入 ' + yuan(save.best) + '</div><button class="go" data-act="start">再跑一天</button>';
    if (save.rating < 60) save.rating = 75; persist(); $('screen').style.display = 'flex';
  }
  function title() {
    G.state = 'title'; $('hud').style.display = 'none'; $('screen').style.display = 'flex';
    $('screen').innerHTML = '<h1>骑 手</h1><div class="sub">回声 · 第 11 期　今天是你跑单的第 ' + save.day + ' 天</div><div class="help"><b>W</b> 加速　<b>S</b> 刹车　<b>A D</b> 转向（手机：按住屏幕前进，左右拖动转向）<br><b>Y</b> 接单　<b>N</b> 拒单　<b>Tab</b> 切换要去的目标<br>到店取餐 → 送到顾客手里，跟着<b>路面上的箭头</b>和顶上的转向提示走；到了<b>刹车停进光圈</b>，会自动下车取餐、送餐<br>平台给每单一个<b>时限</b>：超时扣钱，严重超时清零还可能吃差评<br>你越准时，系统越觉得你还能更快，<b>时限会越来越紧</b><br>下雨订单多、有补贴，但路滑、刹不住；摔车会洒餐<br>服务分掉到 60 以下，账号会被限制接单</div><button class="go" data-act="start">上线接单</button>';
  }

  // ---------- 小地图 ----------
  const mc = $('map').getContext('2d');
  function drawMap() {
    const S = 360, k = S / (HALF * 2 + 40), o = S / 2, X = (x) => o + x * k, Z = (z) => o + z * k;
    mc.fillStyle = '#10151e'; mc.fillRect(0, 0, S, S); mc.fillStyle = '#232c3a'; for (const b of world.solids) mc.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
    for (const s of SWAP) { mc.fillStyle = '#4ac8ff'; mc.fillRect(X(s.x) - 5, Z(s.z) - 5, 10, 10); }
    orders.forEach((od) => { const t = target(od), isCur = od === cur; mc.fillStyle = od.st === 'deliver' || od.st === 'hand' ? '#5aff9a' : '#ffb02e'; mc.beginPath(); mc.arc(X(t.x), Z(t.z), isCur ? 10 : 6, 0, 7); mc.fill();
      if (isCur) { mc.strokeStyle = mc.fillStyle; mc.lineWidth = 3; mc.setLineDash([8, 6]); mc.beginPath(); const pp = path || [me, t]; pp.forEach((q, n) => (n ? mc.lineTo(X(q.x), Z(q.z)) : mc.moveTo(X(q.x), Z(q.z)))); mc.stroke(); mc.setLineDash([]); } });
    mc.save(); mc.translate(X(me.x), Z(me.z)); mc.rotate(-me.a); mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(0, 11); mc.lineTo(7, -8); mc.lineTo(0, -4); mc.lineTo(-7, -8); mc.closePath(); mc.fill(); mc.restore();
  }

  // ---------- 每帧 ----------
  let mapT = 0, uiT = 0;
  hooks.tick = (dt) => {
    if (banT > 0) { banT -= dt; if (banT <= 0) $('banner').textContent = ''; }
    if (motorG) { const sp = Math.abs(me.v); motor.frequency.value = 55 + sp * 9; motorG.gain.value = muted || G.state !== 'play' ? 0 : 0.012 + Math.min(0.05, sp * 0.004); rainG.gain.value = muted ? 0 : world.env.rain * 0.09; }
    if (G.state !== 'play') return;
    G.hour += dt / 60;
    if (wxI + 1 < wxPlan.length && G.hour >= wxPlan[wxI + 1][0]) { wxI++; G.weather = wxPlan[wxI][1]; }
    if (G.weather !== lastWx) { if (lastWx) { toast('天气变了：' + WEATHER[G.weather].name + (wxSub() ? '　每单补贴 ' + yuan(wxSub()) + '，订单变多' : ''), 'sys', 4); if (G.weather === 'storm' || G.weather === 'fog') say('天气恶劣，请注意安全', 2, 20, 0.5); else if (G.weather === 'drizzle') say('下雨了，单多起来了', 1, 60, 0.5); } lastWx = G.weather; }
    if (G.weather === 'storm' && Math.random() < dt * 0.12) world.env.flash = 1;
    if (G.hour >= 22.5) { endDay(''); return; }
    // 派单：高峰和雨天单多；服务分低、总拒单，单就少
    if (offer) { offer.ttl -= dt; $('oBar').style.width = clamp(offer.ttl / 12, 0, 1) * 100 + '%'; if (offer.ttl <= 0) { toast('订单超时未响应，已被其他骑手抢走', 'bad'); answer(false); } }
    else if (orders.length < 3) { offerT -= dt * demand(G.hour) * wxMul() * (0.5 + save.rating / 180) * (orders.length ? 0.6 : 1.2); if (offerT <= 0) { const o = makeOffer(); if (o) showOffer(o); else offerT = 0.5; } }
    // 订单推进：到了目标、停稳，就自动下车。取餐要等商家出餐；送餐按情况跑进去
    wait = null; let acting = false;
    for (const o of [...orders]) {
      o.t += dt; if (o.st === 'pickup' || o.st === 'wait') o.prep -= dt;
      const t = target(o), dd = Math.hypot(me.x - t.x, me.z - t.z), near = dd < 6 && Math.abs(me.v) < 3;
      if (o.st === 'pickup' && near) { o.st = 'wait'; o.grab = 2.2; o.g0 = 2.2; me.v = 0; say('到达取餐点', 1, 8); if (o.prep > 2) { toast(o.shop.name + ' 还没出餐，等一下', 'sys'); say('出餐快点嘛老板', 1, 30, 2); } }
      if (o.st === 'wait') {
        if (dd > 7.5) { o.st = 'pickup'; continue; }
        if (o.prep > 0) wait = { text: '等 ' + o.shop.name + ' 出餐…', k: 1 - clamp(o.prep / (o.prepEst * 2), 0, 1) };
        else { acting = true; o.grab -= dt; runTo(t, 1 - o.grab / o.g0, false); wait = { text: '下车取餐', k: 1 - o.grab / o.g0 }; if (o.grab <= 0) { o.st = 'deliver'; sfx.ok(); toast('已取餐，送往 ' + o.home.name, 'sys'); if (cur === o || !cur) cur = o; path = null; } }
      }
      else if (o.st === 'deliver' && near) { o.st = 'hand'; o.handT = o.hand[1] + 1.5; o.h0 = o.handT; me.v = 0; toast(o.hand[0], 'sys'); say('到达送餐点', 1, 8); if (o.hand[1] >= 9) say('爬楼去咯', 1, 20, 1.6); else say('您的外卖到了', 1, 12, o.h0 * 0.45); }
      else if (o.st === 'hand') { acting = true; o.handT -= dt; runTo(t, 1 - o.handT / o.h0, true); wait = { text: o.hand[0], k: 1 - o.handT / o.h0 }; if (o.handT <= 0) { finish(o); path = null; } }
      if (o.st !== 'hand' && Math.abs(o.limit - o.t - 3) < dt / 2) { sfx.tick(); toast(o.home.name + ' 还有 3 分钟超时', 'bad'); say('订单即将超时，请尽快送达', 2, 6); }
      if (o.st !== 'hand' && Math.abs(o.limit - o.t) < dt / 2) say('订单已超时', 2, 6);
    }
    me.lock = acting; if (!acting) { runner.visible = false; G.riderG.visible = true; }
    if (cur && !orders.includes(cur)) cur = orders[0] || null;
    // 换电
    const st = SWAP.find((s) => Math.hypot(me.x - s.x, me.z - s.z) < 4.5 && Math.abs(me.v) < 2);
    if (st && me.batt < 0.9) { swapT += dt; wait = { text: '换电池…', k: swapT / 3 }; if (swapT >= 3) { me.batt = 1; swapT = 0; day.swap += 3; sfx.ok(); toast('电池已换，花费 ¥3.0', 'sys'); } } else swapT = 0;
    if (me.batt < 0.12 && Math.random() < dt * 0.2) { toast('电量不足 12%，车速受限，去蓝色的换电站', 'bad'); say('电量不足，请及时换电', 2, 25); }
    // 界面
    uiT -= dt; if (uiT <= 0) { uiT = 0.2;
      $('clock').textContent = hhmm(G.hour); $('wx').textContent = WEATHER[G.weather].name + (demand(G.hour) > 1.25 ? ' · 高峰' : ''); $('money').textContent = yuan(day.fee + day.tip + day.bonus - day.fine - day.spill - day.swap); $('rating').textContent = save.rating.toFixed(1); $('done').textContent = day.done; $('lvl').textContent = level();
      $('kmh').textContent = Math.round(Math.abs(me.v) * 3.6); $('batt').textContent = '电量 ' + Math.round(me.batt * 100) + '%';
      $('orders').innerHTML = orders.length ? orders.map((o) => { const left = o.limit - o.t, t = target(o), d = (dist(me, t) * KM).toFixed(1); return '<div class="ord' + (o === cur ? ' cur' : '') + (left < 0 ? ' late' : left < 4 ? ' warn' : '') + '"><span class="t">' + (left < 0 ? '超 ' + Math.ceil(-left) : Math.ceil(left)) + '′</span><b>' + (o.st === 'pickup' || o.st === 'wait' ? '取 ' + o.shop.name : '送 ' + o.home.name) + '</b><br><small>' + d + ' km　' + yuan(o.pay) + (o.spilled ? '　餐已洒' : '') + '</small></div>'; }).join('') : '<div class="ord"><small>暂无订单，等待系统派单…</small></div>';
      $('prog').style.display = wait ? 'block' : 'none'; if (wait) { $('progT').textContent = wait.text; $('progB').style.width = clamp(wait.k, 0, 1) * 100 + '%'; } }
    updateNav(dt);
    mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMap(); }
    const tt = performance.now() / 1000; beacons.forEach((b, i) => { const o = orders[i]; b.visible = !!o; if (!o) return; const t = target(o), isCur = o === cur, col = o.st === 'deliver' || o.st === 'hand' ? 0x5aff9a : 0xffb02e; b.position.set(t.x, 30, t.z); b.material.color.setHex(col); b.children[0].material.color.setHex(col); b.material.opacity = (isCur ? 0.4 : 0.14) + 0.08 * Math.sin(tt * 4); b.children[0].scale.setScalar(1 + 0.15 * Math.sin(tt * 5)); });
  };
  title();
  // 调试入口
  window.__sim = { begin, endDay, answer, toast, get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; }, get path() { return path; }, get nav() { return $('navT').textContent + ' | ' + $('navS').textContent + ' | ' + $('cta').textContent; },
    get s() { return { state: G.state, hour: +G.hour.toFixed(2), weather: G.weather, orders: orders.map((o) => o.st + ':' + Math.round(o.limit - o.t)), offer: offer ? offer.pay + '/' + offer.limit : null, done: day.done, late: day.late, fee: +day.fee.toFixed(1), rating: +save.rating.toFixed(1), algo: +save.algo.toFixed(3), batt: +me.batt.toFixed(2) }; }, get cur() { return cur ? target(cur) : null; }, day, save, orders: () => orders };
}
