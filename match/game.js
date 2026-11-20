// 《메아리: 맞선 코너 스피드 매칭》—— 세로 화면: 아주머니가 배우자 조건을 말하고 후보 카드가 한 장씩 나옴. 전부 맞으면 오른쪽으로(적합), 하나라도 안 맞으면 왼쪽으로(부적합).
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const ri = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const PER_AUNT = 8;                                                 // 의뢰인 한 명당 보는 카드 수

// ---------- 배경: 공원 맞선 코너(구혼 광고를 걸어둔 우산 한 줄) ----------
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
// 아주머니: 길 한가운데 서서 말할 때 흔들림
const aunt = new THREE.Group(); aunt.position.set(0, 0, -7); scene.add(aunt);
const auntBody = mk(aunt, new THREE.CapsuleGeometry(1, 1, 6, 12), L(0xd84a8a), 0, 2.2, 0, 1.25, 1.0, 0.95); const auntHead = new THREE.Group(); auntHead.position.y = 4.6; aunt.add(auntHead);
mk(auntHead, new THREE.SphereGeometry(1, 18, 12), L(0xf2c9a4), 0, 0, 0, 0.95, 1.0, 0.95); const auntHair = mk(auntHead, new THREE.SphereGeometry(1, 18, 12), L(0x3a2414), 0, 0.45, -0.15, 1.15, 0.8, 1.1);
for (const x of [-0.34, 0.34]) { mk(auntHead, new THREE.SphereGeometry(1, 10, 8), L(0xffffff), x, 0.05, 0.84, 0.2, 0.22, 0.1); mk(auntHead, new THREE.SphereGeometry(1, 10, 8), L(0x111111), x, 0.05, 0.92, 0.1, 0.11, 0.06); }
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); layout(); }
function layout() { const w = $('want'); $('deck').style.top = (w.offsetTop + w.offsetHeight + 12) + 'px'; $('card').style.top = '18px'; }

// ---------- 후보 ----------
const ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'], STAR = ['양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리', '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리'];
const JOBS = ['개발자', '교사', '의사', '요리사', '스트리머', '공무원', '배달 라이더', '자영업자', '헬스 트레이너', '회계사'], HAIR = ['대머리', '머리숱 적음', '머리숱 많음'];
const NAMES = ['김 씨', '이 씨', '박 씨', '최 씨', '정 씨', '강 씨', '조 씨', '윤 씨', '장 씨', '임 씨', '한 씨', '오 씨', '서 씨', '신 씨', '권 씨', '황 씨', '안 씨', '송 씨', '류 씨', '홍 씨'];
const SKIN = ['#f2c9a4', '#e8b88c', '#d9a273', '#f6d6b8'], SHIRT = ['#3f7fe0', '#e0703f', '#55aa77', '#9a6fd8', '#d8b23f', '#d84a8a', '#2f9db4'];
function person() {
  return { name: pick(NAMES), job: pick(JOBS), age: ri(22, 40), height: ri(155, 190), pay: pick([4000, 5000, 6000, 8000, 9000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 50000]),
    zodiac: pick(ZODIAC), star: pick(STAR), house: Math.random() < 0.5, car: Math.random() < 0.5, cook: Math.random() < 0.5, smoke: Math.random() < 0.4, game: Math.random() < 0.5, sport: Math.random() < 0.5,
    cat: Math.random() < 0.4, hair: ri(0, 2), glasses: Math.random() < 0.45, spicy: Math.random() < 0.5, early: Math.random() < 0.5, skin: pick(SKIN), shirt: pick(SHIRT) };
}
// 카드의 각 항목 표기법: [소제목, 내용]
const SHOW = {
  age: (c) => ['나이', c.age + ' 세'], height: (c) => ['키', c.height + ' cm'], pay: (c) => ['월급', c.pay >= 10000 ? c.pay / 10000 + ' 만' : c.pay / 1000 + ' 천'], zodiac: (c) => ['띠', c.zodiac + '띠'], star: (c) => ['별자리', c.star],
  house: (c) => ['집', c.house ? '있음' : '없음'], car: (c) => ['차', c.car ? '있음' : '없음'], cook: (c) => ['요리', c.cook ? '요리 함' : '요리 못 함'], smoke: (c) => ['흡연', c.smoke ? '흡연' : '비흡연'], game: (c) => ['게임', c.game ? '게임 좋아함' : '게임 안 함'],
  sport: (c) => ['운동', c.sport ? '운동 좋아함' : '운동 안 함'], cat: (c) => ['반려동물', c.cat ? '고양이 키움' : '안 키움'], hair: (c) => ['머리숱', HAIR[c.hair]], glasses: (c) => ['안경', c.glasses ? '씀' : '안 씀'], spicy: (c) => ['매운맛', c.spicy ? '잘 먹음' : '못 먹음'], early: (c) => ['생활 패턴', c.early ? '아침형' : '올빼미'],
};
// 조건 라이브러리: 각 조건은 문구 t, 판정 f, 관련 항목 k 를 가짐(같은 아주머니는 같은 항목에 조건 두 개를 걸지 않음)
function reqPool(lv) {
  const z = pick(ZODIAC), z2 = pick(ZODIAC.filter((q) => q !== z)), s = pick(STAR), j = pick(JOBS), j2 = pick(JOBS.filter((q) => q !== j)), h = pick([165, 170, 175, 180]), a = pick([28, 30, 32, 35]), p = pick([8000, 10000, 15000, 20000]), pt = p >= 10000 ? p / 10000 + ' 만' : p / 1000 + ' 천';
  const base = [
    { t: '집 있어야 해요', k: ['house'], f: (c) => c.house }, { t: '차 있어야 해요', k: ['car'], f: (c) => c.car }, { t: '요리할 줄 알아야 해요', k: ['cook'], f: (c) => c.cook }, { t: '담배는 안 돼요', k: ['smoke'], f: (c) => !c.smoke },
    { t: '게임은 안 돼요', k: ['game'], f: (c) => !c.game }, { t: '운동 좋아해야 해요', k: ['sport'], f: (c) => c.sport }, { t: '머리숱 많아야 해요', k: ['hair'], f: (c) => c.hair === 2 }, { t: '대머리는 안 돼요', k: ['hair'], f: (c) => c.hair > 0 },
    { t: '키 ' + h + ' 이상', k: ['height'], f: (c) => c.height >= h }, { t: '나이 ' + a + ' 세 이하', k: ['age'], f: (c) => c.age <= a }, { t: '월급 ' + pt + ' 이상', k: ['pay'], f: (c) => c.pay >= p },
  ];
  const more = [
    { t: z + '띠는 안 돼요', k: ['zodiac'], f: (c) => c.zodiac !== z }, { t: s + '는 안 돼요', k: ['star'], f: (c) => c.star !== s }, { t: j + '는 안 돼요', k: ['job'], f: (c) => c.job !== j }, { t: '고양이 키워야 해요', k: ['cat'], f: (c) => c.cat },
    { t: '고양이는 안 돼요(알레르기)', k: ['cat'], f: (c) => !c.cat }, { t: '안경 써야 해요(단정해 보여서)', k: ['glasses'], f: (c) => c.glasses }, { t: '매운 거 잘 먹어야 해요', k: ['spicy'], f: (c) => c.spicy }, { t: '아침형이어야 해요', k: ['early'], f: (c) => c.early }, { t: '나이 26 세 이상', k: ['age'], f: (c) => c.age >= 26 },
  ];
  const hard = [
    { t: '집이 있거나 월급 2 만 이상', k: ['house', 'pay'], f: (c) => c.house || c.pay >= 20000 }, { t: z + '띠 또는 ' + z2 + '띠', k: ['zodiac'], f: (c) => c.zodiac === z || c.zodiac === z2 }, { t: j + ' 아니면 ' + j2, k: ['job'], f: (c) => c.job === j || c.job === j2 },
    { t: '요리하거나 차가 있거나', k: ['cook', 'car'], f: (c) => c.cook || c.car }, { t: '키 165~180 사이', k: ['height'], f: (c) => c.height >= 165 && c.height <= 180 }, { t: '게임은 괜찮지만 담배는 안 돼요', k: ['smoke'], f: (c) => !c.smoke },
  ];
  return lv < 1 ? base : lv < 3 ? [...base, ...more] : [...base, ...more, ...hard];
}
const AUNTS = ['김 아주머니', '이 아줌마', '박 아주머니', '최 아주머니', '정 아주머니', '조 어르신', '강 아저씨', '오 할머니', '윤 아주머니', '임 아주머니'];
const WHO = ['딸의 짝', '아들의 짝', '조카의 짝', '외조카의 짝', '이웃집 아이의 짝', '본인의 짝'];

// ---------- 상태 ----------
let state = 'title', held = false, auto = false, muted = false;
let score = 0, lives = 3, auntN = 0, cardN = 0, reqs = [], cur = null, curOk = false, timeLeft = 0, limit = 6, combo = 0, bestCombo = 0, matched = 0, hurt = 0, bannerT = 0, fly = null, enterT = 0, botT = 0, talk = 0, lock = 0;
let best = 0; try { best = +localStorage.getItem('echo_match_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
const drag = { on: false, sx: 0, dx: 0 };

// ---------- 소리 ----------
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
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '조건 많지 않아요': '我要求不高的', '조건 바꿀게요': '换个要求', '됐다 됐어': '成了成了', '눈이 어떻게 된 거야': '你这什么眼神', '이렇게 좋은 걸 안 돼?': '这么好的你不要', '빨리 좀': '快点嘛', '그만 찾자, 집에 가': '不找了，回家' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[VOICE[text] || text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text); sayLast[text] = now; talk = 1;
  if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
function banner(text, sec = 1.2) { $('banner').textContent = text; bannerT = sec; }

// ---------- 화면 ----------
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; layout(); return; }
  s.style.display = 'flex'; $('hud').style.display = 'none';
  if (state === 'title') s.innerHTML = '<h1>맞선 코너 스피드 매칭</h1><div class="sub">메아리 · 제 9 기</div><div class="help">위에서 아주머니가 <b>배우자 조건</b>을 말합니다<br>후보가 <b>전부 맞으면</b>: 오른쪽으로 밀기(적합)<br><b>하나라도 안 맞으면</b>: 왼쪽으로 밀기(부적합)<br>아래 버튼이나 키보드 좌우 키로도 됩니다<br>뒤로 갈수록 조건이 많고 복잡해지고 시간은 촉박해집니다<br>세 번 틀리면 아주머니가 떠납니다</div>' +
    (best ? '<div class="sub" style="margin-top:12px">최고 점수 ' + best + '</div>' : '') + '<button class="go" data-act="start">중매 시작</button>';
  else s.innerHTML = '<h1 class="red">아주머니가 떠났습니다</h1><div class="sub">점수 ' + score + '　의뢰인 ' + auntN + ' 명 응대<br>' + matched + ' 쌍 성사　최다 연속 ' + bestCombo + '<br>최고 점수 ' + best + '</div><button class="go" data-act="start">다시 중매</button>';
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
  while (keys.length < Math.max(6, need.size + (need.size % 2))) keys.push(rest.pop()); keys.sort(() => Math.random() - 0.5);          // 필요한 건 다 넣고, 안 쓰는 것도 몇 개 섞음
  $('attrs').innerHTML = keys.map((k) => { const [a, b] = SHOW[k](c); return '<li><small>' + a + '</small>' + b + '</li>'; }).join('');
  const el = $('card'); el.style.transition = 'none'; el.style.transform = 'translateY(-30px) scale(.9)'; el.style.opacity = '0'; void el.offsetWidth; el.style.transition = 'transform .18s ease-out, opacity .18s'; el.style.transform = ''; el.style.opacity = '1';
  for (const s of el.querySelectorAll('.stamp')) s.style.opacity = 0;
}
function hud() {
  $('score').textContent = score; $('auntN').textContent = auntN + ' 번째'; $('lives').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  $('leftN').textContent = Math.min(PER_AUNT, cardN) + ' / ' + PER_AUNT + ' 번째'; const tb = $('tbar'); tb.firstChild.style.width = clamp(timeLeft / limit, 0, 1) * 100 + '%'; tb.className = timeLeft < 1.5 ? 'low' : '';
  $('combo').innerHTML = combo >= 3 ? '×' + combo + '<small>연속</small>' : ''; $('hurt').style.opacity = hurt.toFixed(2);
}

// ---------- 흐름 ----------
function newAunt() {
  auntN++; cardN = 0; const lv = auntN - 1, n = Math.min(4, 1 + Math.floor((lv + 1) / 2)), pool = reqPool(lv).sort(() => Math.random() - 0.5), used = new Set(); reqs = [];
  for (const r of pool) { if (reqs.length >= n) break; if (r.k.some((k) => used.has(k))) continue; r.k.forEach((k) => used.add(k)); reqs.push(r); }
  const name = AUNTS[(auntN - 1) % AUNTS.length]; $('who').textContent = name + ' · ' + pick(WHO) + ' 찾는 중, 조건:'; $('reqs').innerHTML = reqs.map((r, i) => '<span id="rq' + i + '">' + r.t + '</span>').join('');
  auntBody.material.color.setHex(pick([0xd84a8a, 0x9a4ad8, 0xd8793a, 0x3a9ad8, 0x4ab86a])); auntHair.material.color.setHex(pick([0x3a2414, 0x8a8a8a, 0x5a2a1a, 0x222222]));
  layout(); sfx.next(); banner(name + ' 입장', 1.1); say(auntN === 1 ? '조건 많지 않아요' : pick(['조건 많지 않아요', '조건 바꿀게요']), 2); nextCard();
}
function nextCard() {
  cardN++; if (cardN > PER_AUNT) { newAunt(); return; }
  const want = Math.random() < 0.5; let c = null;
  for (let i = 0; i < 400; i++) { c = person(); const fails = reqs.filter((r) => !r.f(c)).length; if (want ? fails === 0 : fails === 1) break; if (i > 300 && !want && fails > 0) break; }   // 안 맞는 건 최대한 한 가지만 틀리게, 그래야 눈썰미 게임
  cur = c; curOk = reqs.every((r) => r.f(c)); limit = Math.max(2.6, 6.2 - auntN * 0.32) + reqs.length * 0.7; timeLeft = limit; lock = 0.18; showCard(); sfx.deal();
}
function decide(yes, timeout) {
  if (state !== 'play' || !cur || fly || lock > 0) return;
  const right = !timeout && yes === curOk, el = $('card'); sfx.swipe();
  fly = { t: 0, dir: timeout ? 0 : yes ? 1 : -1 }; el.style.transition = 'transform .22s ease-in, opacity .22s'; el.style.transform = timeout ? 'translateY(60px) scale(.8)' : 'translateX(' + (yes ? 130 : -130) + '%) rotate(' + (yes ? 24 : -24) + 'deg)'; el.style.opacity = '0';
  if (right) {
    combo++; bestCombo = Math.max(bestCombo, combo); const pts = Math.round((10 + Math.ceil(timeLeft / limit * 10)) * (1 + Math.min(2, combo * 0.1))); score += pts; sfx.good(combo);
    if (yes) { matched++; sfx.love(); if (combo % 3 === 0) say('됐다 됐어', 1, 3000); }
    if (combo === 10) banner('골드 중매쟁이', 1.2); else if (combo === 20) banner('월하노인 환생', 1.2);
  } else {
    combo = 0; lives--; hurt = 1; sfx.bad(); reqs.forEach((r, i) => { if (!r.f(cur)) { const s = $('rq' + i); s.classList.remove('bad'); void s.offsetWidth; s.classList.add('bad'); } });
    if (timeout) { banner('너무 느려요', 0.9); say('빨리 좀', 2); } else if (yes) { banner('조건 미달', 0.9); say('눈이 어떻게 된 거야', 2); } else { banner('딱 맞았는데', 0.9); say('이렇게 좋은 걸 안 돼?', 2); }
  }
  cur = null;
}
function endGame() { state = 'over'; sfx.over(); if (score > best) { best = score; try { localStorage.setItem('echo_match_best', '' + best); } catch (e) { /* 무시 */ } } say('그만 찾자, 집에 가', 5); showScreen(); }
function newGame() {
  state = 'play'; score = combo = bestCombo = matched = auntN = hurt = bannerT = 0; lives = 3; fly = null; cur = null;
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'match'; (h.played = h.played || {}).match = k; h.last = 'match'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
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

// ---------- 입력: 카드 끌기, 버튼 클릭, 좌우 키 ----------
const card = $('card');
card.addEventListener('pointerdown', (e) => { if (state !== 'play' || auto || fly) return; drag.on = true; drag.sx = e.clientX; drag.dx = 0; card.style.transition = 'none'; try { card.setPointerCapture(e.pointerId); } catch (er) { /* 없어도 됨 */ } });
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

// 디버그 입구
window.__match = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on, delay, acc) { auto = on; if (delay) botDelay = delay; if (acc) botAcc = acc; }, decide,
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, score, lives, aunt: auntN, card: cardN, reqs: reqs.map((r) => r.t), ok: curOk, timeLeft: +timeLeft.toFixed(1), limit: +limit.toFixed(1), combo, matched }; },
};
