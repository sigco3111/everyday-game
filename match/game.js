// 《回声：相亲角速配》—— 竖屏：大妈报出择偶条件，候选人卡片一张张出来。全都符合往右划（合适），有一条不符合就往左划（不合适）。
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const ri = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const PER_AUNT = 8;                                                 // 每位委托人看几张卡

// ---------- 背景：公园相亲角（一排挂着征婚启事的伞） ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.domElement.className = 'bg'; stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fd8b0); scene.fog = new THREE.Fog(0x9fd8b0, 26, 60);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 100); camera.position.set(0, 9, 16); camera.lookAt(0, 3, -4);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a9a6a, 1.1)); { const d = new THREE.DirectionalLight(0xfff2d8, 1.2); d.position.set(-6, 14, 8); scene.add(d); }
const L = (c) => new THREE.MeshLambertMaterial({ color: c });
function mk(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
{ const g = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), L(0x6fb87a)); g.rotation.x = -Math.PI / 2; scene.add(g); const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 80), L(0xd9c8a8)); p.rotation.x = -Math.PI / 2; p.position.y = 0.02; scene.add(p); }
const umbrellas = [];
for (let i = 0; i < 12; i++) { const s = i % 2 ? 1 : -1, z = 6 - Math.floor(i / 2) * 5.5, g = new THREE.Group(); g.position.set(s * (6.2 + (i % 3) * 0.6), 0, z); mk(g, new THREE.ConeGeometry(2.2, 1.1, 10), L([0xff6a8a, 0x5ab8ff, 0xffd23a, 0x9a7bff, 0x4fd0a0, 0xff9a4a][i % 6]), 0, 1.3, 0).rotation.z = s * 1.2; mk(g, new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), -s * 0.6, 1.3, 0.3).rotation.y = s * 0.5; scene.add(g); umbrellas.push(g); }
for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1, g = new THREE.Group(); g.position.set(s * rand(11, 17), 0, 4 - i * 4); mk(g, new THREE.CylinderGeometry(0.35, 0.45, 2.4, 6), L(0x7a5a3a), 0, 1.2, 0); mk(g, new THREE.IcosahedronGeometry(2.3, 1), L(0x3f9a55), 0, 3.8, 0); scene.add(g); }
// 大妈：站在路中间，说话时会晃
const aunt = new THREE.Group(); aunt.position.set(0, 0, -7); scene.add(aunt);
const auntBody = mk(aunt, new THREE.CapsuleGeometry(1, 1, 6, 12), L(0xd84a8a), 0, 2.2, 0, 1.25, 1.0, 0.95); const auntHead = new THREE.Group(); auntHead.position.y = 4.6; aunt.add(auntHead);
mk(auntHead, new THREE.SphereGeometry(1, 18, 12), L(0xf2c9a4), 0, 0, 0, 0.95, 1.0, 0.95); const auntHair = mk(auntHead, new THREE.SphereGeometry(1, 18, 12), L(0x3a2414), 0, 0.45, -0.15, 1.15, 0.8, 1.1);
for (const x of [-0.34, 0.34]) { mk(auntHead, new THREE.SphereGeometry(1, 10, 8), L(0xffffff), x, 0.05, 0.84, 0.2, 0.22, 0.1); mk(auntHead, new THREE.SphereGeometry(1, 10, 8), L(0x111111), x, 0.05, 0.92, 0.1, 0.11, 0.06); }
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); layout(); }
function layout() { const w = $('want'); $('deck').style.top = (w.offsetTop + w.offsetHeight + 12) + 'px'; $('card').style.top = '18px'; }

// ---------- 候选人 ----------
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'], STAR = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const JOBS = ['程序员', '老师', '医生', '厨师', '主播', '公务员', '外卖骑手', '小老板', '健身教练', '会计'], HAIR = ['光头', '头发稀疏', '头发茂密'];
const NAMES = ['小王', '小李', '小张', '小刘', '小陈', '小杨', '小赵', '小黄', '小周', '小吴', '小林', '小徐', '小孙', '小马', '小朱', '小胡', '小郭', '小何', '小高', '小罗'];
const SKIN = ['#f2c9a4', '#e8b88c', '#d9a273', '#f6d6b8'], SHIRT = ['#3f7fe0', '#e0703f', '#55aa77', '#9a6fd8', '#d8b23f', '#d84a8a', '#2f9db4'];
function person() {
  return { name: pick(NAMES), job: pick(JOBS), age: ri(22, 40), height: ri(155, 190), pay: pick([4000, 5000, 6000, 8000, 9000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 50000]),
    zodiac: pick(ZODIAC), star: pick(STAR), house: Math.random() < 0.5, car: Math.random() < 0.5, cook: Math.random() < 0.5, smoke: Math.random() < 0.4, game: Math.random() < 0.5, sport: Math.random() < 0.5,
    cat: Math.random() < 0.4, hair: ri(0, 2), glasses: Math.random() < 0.45, spicy: Math.random() < 0.5, early: Math.random() < 0.5, skin: pick(SKIN), shirt: pick(SHIRT) };
}
// 卡片上每一项怎么写：[小标题, 内容]
const SHOW = {
  age: (c) => ['年龄', c.age + ' 岁'], height: (c) => ['身高', c.height + ' cm'], pay: (c) => ['月薪', c.pay >= 10000 ? c.pay / 10000 + ' 万' : c.pay / 1000 + ' 千'], zodiac: (c) => ['属相', '属' + c.zodiac], star: (c) => ['星座', c.star + '座'],
  house: (c) => ['房子', c.house ? '有房' : '没房'], car: (c) => ['车子', c.car ? '有车' : '没车'], cook: (c) => ['厨艺', c.cook ? '会做饭' : '不会做饭'], smoke: (c) => ['抽烟', c.smoke ? '抽烟' : '不抽烟'], game: (c) => ['游戏', c.game ? '爱打游戏' : '不打游戏'],
  sport: (c) => ['运动', c.sport ? '爱运动' : '不爱动'], cat: (c) => ['宠物', c.cat ? '养猫' : '不养猫'], hair: (c) => ['发量', HAIR[c.hair]], glasses: (c) => ['眼镜', c.glasses ? '戴眼镜' : '不戴眼镜'], spicy: (c) => ['口味', c.spicy ? '能吃辣' : '不吃辣'], early: (c) => ['作息', c.early ? '早睡早起' : '夜猫子'],
};
// 条件库：每条有文字 t、判断 f、涉及哪一项 k（同一位大妈不会对同一项提两个条件）
function reqPool(lv) {
  const z = pick(ZODIAC), z2 = pick(ZODIAC.filter((q) => q !== z)), s = pick(STAR), j = pick(JOBS), j2 = pick(JOBS.filter((q) => q !== j)), h = pick([165, 170, 175, 180]), a = pick([28, 30, 32, 35]), p = pick([8000, 10000, 15000, 20000]), pt = p >= 10000 ? p / 10000 + ' 万' : p / 1000 + ' 千';
  const base = [
    { t: '要有房', k: ['house'], f: (c) => c.house }, { t: '要有车', k: ['car'], f: (c) => c.car }, { t: '要会做饭', k: ['cook'], f: (c) => c.cook }, { t: '不能抽烟', k: ['smoke'], f: (c) => !c.smoke },
    { t: '不能打游戏', k: ['game'], f: (c) => !c.game }, { t: '要爱运动', k: ['sport'], f: (c) => c.sport }, { t: '头发要多', k: ['hair'], f: (c) => c.hair === 2 }, { t: '不能是光头', k: ['hair'], f: (c) => c.hair > 0 },
    { t: '身高 ' + h + ' 以上', k: ['height'], f: (c) => c.height >= h }, { t: '年龄不超过 ' + a, k: ['age'], f: (c) => c.age <= a }, { t: '月薪 ' + pt + ' 以上', k: ['pay'], f: (c) => c.pay >= p },
  ];
  const more = [
    { t: '不要属' + z + '的', k: ['zodiac'], f: (c) => c.zodiac !== z }, { t: '不要' + s + '座', k: ['star'], f: (c) => c.star !== s }, { t: '不要' + j, k: ['job'], f: (c) => c.job !== j }, { t: '要养猫', k: ['cat'], f: (c) => c.cat },
    { t: '不能养猫（我过敏）', k: ['cat'], f: (c) => !c.cat }, { t: '要戴眼镜（斯文）', k: ['glasses'], f: (c) => c.glasses }, { t: '要能吃辣', k: ['spicy'], f: (c) => c.spicy }, { t: '要早睡早起', k: ['early'], f: (c) => c.early }, { t: '年龄 26 以上', k: ['age'], f: (c) => c.age >= 26 },
  ];
  const hard = [
    { t: '有房，或者月薪 2 万以上', k: ['house', 'pay'], f: (c) => c.house || c.pay >= 20000 }, { t: '要属' + z + '或属' + z2, k: ['zodiac'], f: (c) => c.zodiac === z || c.zodiac === z2 }, { t: '要' + j + '或' + j2, k: ['job'], f: (c) => c.job === j || c.job === j2 },
    { t: '会做饭，或者有车', k: ['cook', 'car'], f: (c) => c.cook || c.car }, { t: '身高 165 到 180 之间', k: ['height'], f: (c) => c.height >= 165 && c.height <= 180 }, { t: '打游戏可以，但不能抽烟', k: ['smoke'], f: (c) => !c.smoke },
  ];
  return lv < 1 ? base : lv < 3 ? [...base, ...more] : [...base, ...more, ...hard];
}
const AUNTS = ['张阿姨', '李大妈', '王婶', '刘姨', '陈阿姨', '赵大爷', '周叔', '吴奶奶', '黄姨', '林阿姨'];
const WHO = ['给闺女找', '给儿子找', '给侄女找', '给外甥找', '给邻居家孩子找', '给自己找'];

// ---------- 状态 ----------
let state = 'title', held = false, auto = false, muted = false;
let score = 0, lives = 3, auntN = 0, cardN = 0, reqs = [], cur = null, curOk = false, timeLeft = 0, limit = 6, combo = 0, bestCombo = 0, matched = 0, hurt = 0, bannerT = 0, fly = null, enterT = 0, botT = 0, talk = 0, lock = 0;
let best = 0; try { best = +localStorage.getItem('echo_match_best') || 0; } catch (e) { /* 存不了就算了 */ }
const drag = { on: false, sx: 0, dx: 0 };

// ---------- 声音 ----------
let ac = null, master = null;
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination); } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
const sfx = {
  swipe: () => tone('sine', 500, 900, 0.08, 0.08), deal: () => tone('triangle', 900, 600, 0.05, 0.06),
  good: (c) => { const f = 523 * 2 ** (Math.min(12, c) / 12); tone('triangle', f, f, 0.1, 0.14); tone('triangle', f * 1.5, f * 1.5, 0.14, 0.12, 0.08); },
  love: () => [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.2, 0.12, i * 0.07)),
  bad: () => { tone('sawtooth', 240, 130, 0.3, 0.2); tone('sawtooth', 200, 110, 0.3, 0.16, 0.12); },
  tick: () => tone('square', 1200, 1200, 0.03, 0.05), next: () => [660, 880].forEach((f, i) => tone('triangle', f, f, 0.14, 0.12, i * 0.1)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
};
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text); sayLast[text] = now; talk = 1;
  if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 已经放完 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
function banner(text, sec = 1.2) { $('banner').textContent = text; bannerT = sec; }

// ---------- 界面 ----------
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; layout(); return; }
  s.style.display = 'flex'; $('hud').style.display = 'none';
  if (state === 'title') s.innerHTML = '<h1>相亲角速配</h1><div class="sub">回声 · 第 9 期</div><div class="help">大妈在上面报出<b>择偶条件</b><br>候选人<b>全都符合</b>：往右划（合适）<br><b>有一条不符合</b>：往左划（不合适）<br>也可以点下面的按钮，或按键盘左右键<br>越往后条件越多、越绕，时间越紧<br>判错三次，大妈就不找你了</div>' +
    (best ? '<div class="sub" style="margin-top:12px">最高得分 ' + best + '</div>' : '') + '<button class="go" data-act="start">开始牵线</button>';
  else s.innerHTML = '<h1 class="red">大妈走了</h1><div class="sub">得分 ' + score + '　接待 ' + auntN + ' 位委托人<br>牵成 ' + matched + ' 对　最多连对 ' + bestCombo + '<br>最高得分 ' + best + '</div><button class="go" data-act="start">再牵一次</button>';
}
function drawFace(c) {
  const g = $('face').getContext('2d'); g.clearRect(0, 0, 152, 152); g.fillStyle = '#e8f0f6'; g.fillRect(0, 0, 152, 152);
  g.fillStyle = c.shirt; g.beginPath(); g.ellipse(76, 160, 62, 50, 0, 0, 7); g.fill();
  g.fillStyle = c.skin; g.beginPath(); g.arc(76, 74, 42, 0, 7); g.fill(); g.beginPath(); g.arc(34, 78, 8, 0, 7); g.arc(118, 78, 8, 0, 7); g.fill();
  g.fillStyle = '#2a2018';
  if (c.hair === 2) { g.beginPath(); g.arc(76, 62, 45, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(100, 50, 76, 54); g.quadraticCurveTo(50, 50, 31, 62); g.fill(); }
  else if (c.hair === 1) { g.lineWidth = 3; g.strokeStyle = '#2a2018'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(52 + i * 12, 40); g.quadraticCurveTo(58 + i * 12, 24, 66 + i * 12, 38); g.stroke(); } }
  else { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(60, 44, 12, 6, -0.5, 0, 7); g.fill(); g.fillStyle = '#2a2018'; }
  g.beginPath(); g.arc(60, 76, 4.5, 0, 7); g.arc(92, 76, 4.5, 0, 7); g.fill();
  if (c.glasses) { g.lineWidth = 3; g.strokeStyle = '#2a2230'; g.beginPath(); g.arc(60, 76, 12, 0, 7); g.moveTo(104, 76); g.arc(92, 76, 12, 0, 7); g.moveTo(72, 76); g.lineTo(80, 76); g.stroke(); }
  g.lineWidth = 3; g.strokeStyle = '#7a3a2a'; g.beginPath(); g.arc(76, 90, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  if (c.smoke) { g.fillStyle = '#fff'; g.fillRect(88, 100, 26, 5); g.fillStyle = '#ff7a3c'; g.fillRect(112, 100, 5, 5); g.strokeStyle = 'rgba(120,120,120,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(116, 98); g.quadraticCurveTo(124, 88, 116, 80); g.stroke(); }
  if (c.cat) { g.fillStyle = '#f0a04a'; g.beginPath(); g.arc(128, 128, 15, 0, 7); g.moveTo(116, 120); g.lineTo(118, 106); g.lineTo(127, 116); g.moveTo(140, 120); g.lineTo(138, 106); g.lineTo(129, 116); g.fill(); g.fillStyle = '#2a2018'; g.beginPath(); g.arc(123, 127, 2, 0, 7); g.arc(133, 127, 2, 0, 7); g.fill(); }
}
function showCard() {
  const c = cur; $('cname').textContent = c.name; $('cjob').textContent = c.job; drawFace(c);
  const need = new Set(reqs.flatMap((r) => r.k).filter((k) => k !== 'job')), keys = [...need], rest = Object.keys(SHOW).filter((k) => !need.has(k)).sort(() => Math.random() - 0.5);
  while (keys.length < Math.max(6, need.size + (need.size % 2))) keys.push(rest.pop()); keys.sort(() => Math.random() - 0.5);          // 用得上的都在，再混几项没用的
  $('attrs').innerHTML = keys.map((k) => { const [a, b] = SHOW[k](c); return '<li><small>' + a + '</small>' + b + '</li>'; }).join('');
  const el = $('card'); el.style.transition = 'none'; el.style.transform = 'translateY(-30px) scale(.9)'; el.style.opacity = '0'; void el.offsetWidth; el.style.transition = 'transform .18s ease-out, opacity .18s'; el.style.transform = ''; el.style.opacity = '1';
  for (const s of el.querySelectorAll('.stamp')) s.style.opacity = 0;
}
function hud() {
  $('score').textContent = score; $('auntN').textContent = '第 ' + auntN + ' 位'; $('lives').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  $('leftN').textContent = '第 ' + Math.min(PER_AUNT, cardN) + ' / ' + PER_AUNT + ' 个'; const tb = $('tbar'); tb.firstChild.style.width = clamp(timeLeft / limit, 0, 1) * 100 + '%'; tb.className = timeLeft < 1.5 ? 'low' : '';
  $('combo').innerHTML = combo >= 3 ? '×' + combo + '<small>连对</small>' : ''; $('hurt').style.opacity = hurt.toFixed(2);
}

// ---------- 流程 ----------
function newAunt() {
  auntN++; cardN = 0; const lv = auntN - 1, n = Math.min(4, 1 + Math.floor((lv + 1) / 2)), pool = reqPool(lv).sort(() => Math.random() - 0.5), used = new Set(); reqs = [];
  for (const r of pool) { if (reqs.length >= n) break; if (r.k.some((k) => used.has(k))) continue; r.k.forEach((k) => used.add(k)); reqs.push(r); }
  const name = AUNTS[(auntN - 1) % AUNTS.length]; $('who').textContent = name + ' · ' + pick(WHO) + '对象，要求：'; $('reqs').innerHTML = reqs.map((r, i) => '<span id="rq' + i + '">' + r.t + '</span>').join('');
  auntBody.material.color.setHex(pick([0xd84a8a, 0x9a4ad8, 0xd8793a, 0x3a9ad8, 0x4ab86a])); auntHair.material.color.setHex(pick([0x3a2414, 0x8a8a8a, 0x5a2a1a, 0x222222]));
  layout(); sfx.next(); banner(name + '来了', 1.1); say(auntN === 1 ? '我要求不高的' : pick(['我要求不高的', '换个要求']), 2); nextCard();
}
function nextCard() {
  cardN++; if (cardN > PER_AUNT) { newAunt(); return; }
  const want = Math.random() < 0.5; let c = null;
  for (let i = 0; i < 400; i++) { c = person(); const fails = reqs.filter((r) => !r.f(c)).length; if (want ? fails === 0 : fails === 1) break; if (i > 300 && !want && fails > 0) break; }   // 不合适的尽量只差一条，才考眼力
  cur = c; curOk = reqs.every((r) => r.f(c)); limit = Math.max(2.6, 6.2 - auntN * 0.32) + reqs.length * 0.7; timeLeft = limit; lock = 0.18; showCard(); sfx.deal();
}
function decide(yes, timeout) {
  if (state !== 'play' || !cur || fly || lock > 0) return;
  const right = !timeout && yes === curOk, el = $('card'); sfx.swipe();
  fly = { t: 0, dir: timeout ? 0 : yes ? 1 : -1 }; el.style.transition = 'transform .22s ease-in, opacity .22s'; el.style.transform = timeout ? 'translateY(60px) scale(.8)' : 'translateX(' + (yes ? 130 : -130) + '%) rotate(' + (yes ? 24 : -24) + 'deg)'; el.style.opacity = '0';
  if (right) {
    combo++; bestCombo = Math.max(bestCombo, combo); const pts = Math.round((10 + Math.ceil(timeLeft / limit * 10)) * (1 + Math.min(2, combo * 0.1))); score += pts; sfx.good(combo);
    if (yes) { matched++; sfx.love(); if (combo % 3 === 0) say('成了成了', 1, 3000); }
    if (combo === 10) banner('金牌红娘', 1.2); else if (combo === 20) banner('月老转世', 1.2);
  } else {
    combo = 0; lives--; hurt = 1; sfx.bad(); reqs.forEach((r, i) => { if (!r.f(cur)) { const s = $('rq' + i); s.classList.remove('bad'); void s.offsetWidth; s.classList.add('bad'); } });
    if (timeout) { banner('太慢了', 0.9); say('快点嘛', 2); } else if (yes) { banner('不符合条件', 0.9); say('你这什么眼神', 2); } else { banner('明明很合适', 0.9); say('这么好的你不要', 2); }
  }
  cur = null;
}
function endGame() { state = 'over'; sfx.over(); if (score > best) { best = score; try { localStorage.setItem('echo_match_best', '' + best); } catch (e) { /* 忽略 */ } } say('不找了，回家', 5); showScreen(); }
function newGame() {
  state = 'play'; score = combo = bestCombo = matched = auntN = hurt = bannerT = 0; lives = 3; fly = null; cur = null;
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'match'; (h.played = h.played || {}).match = k; h.last = 'match'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 存不了就算了 */ }   // 给首页记一次打卡
  sayUntil = 0; showScreen(); newAunt();
}
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  hurt = Math.max(0, hurt - dt * 1.8); talk = Math.max(0, talk - dt * 1.2);
  if (state !== 'play') return;
  if (lock > 0) lock -= dt;
  if (fly) { fly.t += dt; if (fly.t > 0.26) { fly = null; if (lives <= 0) { endGame(); return; } nextCard(); } return; }
  const t0 = timeLeft; timeLeft -= dt; if (timeLeft < 1.5 && Math.floor(t0 * 4) !== Math.floor(timeLeft * 4)) sfx.tick();
  if (auto) { botT += dt; if (botT > botDelay) { botT = 0; decide(Math.random() < botAcc ? curOk : !curOk); } }
  if (timeLeft <= 0 && cur) decide(false, true);
}
let botDelay = 1.2, botAcc = 0.95;
function draw() {
  const t = performance.now() / 1000; aunt.rotation.z = Math.sin(t * 12) * 0.05 * talk; aunt.position.y = Math.abs(Math.sin(t * 2.4)) * 0.12; auntHead.rotation.z = Math.sin(t * 9) * 0.12 * talk;
  umbrellas.forEach((u, i) => { u.rotation.z = Math.sin(t * 1.2 + i) * 0.03; });
  hud(); renderer.render(scene, camera);
}

// ---------- 输入：拖卡片，或点按钮，或按左右键 ----------
const card = $('card');
card.addEventListener('pointerdown', (e) => { if (state !== 'play' || auto || fly) return; drag.on = true; drag.sx = e.clientX; drag.dx = 0; card.style.transition = 'none'; try { card.setPointerCapture(e.pointerId); } catch (er) { /* 没有也行 */ } });
card.addEventListener('pointermove', (e) => { if (!drag.on) return; drag.dx = e.clientX - drag.sx; card.style.transform = 'translateX(' + drag.dx + 'px) rotate(' + drag.dx * 0.06 + 'deg)'; const k = clamp(Math.abs(drag.dx) / 70, 0, 1); card.querySelector('.yes').style.opacity = drag.dx > 0 ? k : 0; card.querySelector('.no').style.opacity = drag.dx < 0 ? k : 0; });
const dropCard = () => { if (!drag.on) return; drag.on = false; if (Math.abs(drag.dx) > Math.min(90, W * 0.22)) decide(drag.dx > 0); else { card.style.transition = 'transform .15s'; card.style.transform = ''; for (const s of card.querySelectorAll('.stamp')) s.style.opacity = 0; } };
card.addEventListener('pointerup', dropCard); card.addEventListener('pointercancel', dropCard);
$('bYes').addEventListener('click', () => { if (!auto) decide(true); }); $('bNo').addEventListener('click', () => { if (!auto) decide(false); });
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') newGame(); });
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if (state !== 'play') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); initAudio(); newGame(); } return; } if (auto) return; if (e.code === 'ArrowRight' || e.code === 'KeyD') decide(true); if (e.code === 'ArrowLeft' || e.code === 'KeyA') decide(false); });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 调试入口
window.__match = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on, delay, acc) { auto = on; if (delay) botDelay = delay; if (acc) botAcc = acc; }, decide,
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, score, lives, aunt: auntN, card: cardN, reqs: reqs.map((r) => r.t), ok: curOk, timeLeft: +timeLeft.toFixed(1), limit: +limit.toFixed(1), combo, matched }; },
};
