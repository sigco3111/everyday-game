// 광저우 드리프트 · 게임플레이: 전동 스쿠터 드리프트 감각, 픽업·배달, 타이머, 화면, 소리
import { createWorld, W, ZNAME } from './world.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const world = createWorld($('stage')), T = world.track, fx = world.fx;

const GF = [.055, .18, .30, .43, .555, .68, .80, .925];
const PICK = [['다리머리 디저트 카트', '양즈간루'], ['주장 신성 밀크티 가게', '양즈간루'], ['화청 광장 차찬텡', '보로야우'], ['노포 차시우 가게', '구운 거위 덮밥'], ['다리 밑 곱창 포차', '무 곱창 조림'], ['치러우 청펀 가게', '새우 청펀'], ['마을 어귀 보자이판', '라취미 보자이판'], ['타워 아래 디저트 가게', '쌍피나이']];
const DROP = ['다리에서 야경 보는 커플', '야근 중인 오피스빌딩', '광장의 밤 달리기 팀', '기념당 앞 경비실', '다리 밑 낚시하는 아저씨', '치러우 2층 할머니', '다닥다닥 붙은 건물 7층(엘리베이터 없음)', '타워 아래 줄 서는 관광객'];
const LV = [[.25, 1.1, 2.6], [.3, .6, 3], [3, 1.3, .2], [2.4, .4, 3]], LVCSS = ['#39b6ff', '#39b6ff', '#ff9a2a', '#d05aff'], LVT = [.9, 2.0, 3.3];
const TOP = 22, TOPB = 31;

let state = 'title', muted = false, auto = false, best = 0; try { best = +localStorage.getItem('echo_gz_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
const S = {}; const key = {}; const inp = { steer: 0, raw: 0, drift: false, brake: false, tSteer: 0, tDrift: false, tBrake: false };
const cars = []; const loc = {}, tp = {}; let camYaw = 0, shake = 0, tAll = 0, readyT = 0, overT = 0, lastZone = -1, zoneT = 0;

// ---------- 소리 ----------
let ac = null, master = null, eng = null;
function audio() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ac.createGain(); master.gain.value = muted ? 0 : .9; master.connect(ac.destination);
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const mk = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const o1 = mk('sawtooth', 80), o2 = mk('square', 160), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const g = ac.createGain(); g.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
  const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true; ns.start(); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 5; const sg = ac.createGain(); sg.gain.value = 0; ns.connect(bp); bp.connect(sg); sg.connect(master);
  const ns2 = ac.createBufferSource(); ns2.buffer = nb; ns2.loop = true; ns2.start(); const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 500; hp.Q.value = .6; const wg = ac.createGain(); wg.gain.value = 0; ns2.connect(hp); hp.connect(wg); wg.connect(master);
  eng = { o1, o2, lp, g, bp, sg, hp, wg, nb }; music(); }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol, freq, delay = 0, q = 1) { if (!ac || muted) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = eng.nb; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .02); }
const sfx = { pick: () => [784, 988, 1319].forEach((f, i) => tone('triangle', f, f, .14, .16, i * .06)), drop: () => { [659, 784, 988, 1319, 1568].forEach((f, i) => tone('triangle', f, f, .2, .15, i * .07)); noise(.3, .12, 5000, .1); },
  crash: () => { noise(.35, .5, 300); tone('sawtooth', 160, 50, .3, .3); noise(.2, .2, 3000); }, scrape: () => noise(.12, .12, 2600, 0, 3), boost: (l) => { noise(.6, .3, 900 + l * 500); tone('sawtooth', 180 + l * 60, 720 + l * 240, .45, .13); },
  lvl: (l) => tone('square', 500 + l * 250, 700 + l * 300, .09, .08), near: () => tone('sine', 1400, 2200, .12, .1), tick: () => tone('square', 880, 880, .06, .09), beep: (hi) => tone('square', hi ? 1320 : 660, hi ? 1320 : 660, hi ? .4 : .15, .12),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * .97, .4, .2, i * .2)), bank: () => [1047, 1568].forEach((f, i) => tone('sine', f, f, .12, .1, i * .05)) };
function music() { // 한 곡 루프의 일렉트로닉 킥과 베이스
  const BASS = [55, 55, 55, 55, 65.4, 65.4, 49, 49], ARP = [220, 261.6, 329.6, 392, 329.6, 261.6, 440, 329.6]; let step = 0, next = ac.currentTime + .1;
  const mg = ac.createGain(); mg.gain.value = .5; mg.connect(master);
  setInterval(() => { if (!ac || ac.state !== 'running') return; while (next < ac.currentTime + .2) { const on = state === 'play' || state === 'ready', t = next, b = Math.floor(step / 4) % 8;
    if (on) { if (step % 4 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.connect(g); g.connect(mg); o.start(t); o.stop(t + .22); }
      if (step % 4 === 2) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = eng.nb; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); s.connect(f); f.connect(g); g.connect(mg); s.start(t, Math.random()); s.stop(t + .07); }
      if (step % 2 === 1 || step % 4 === 0) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = BASS[b] * (step % 4 === 3 ? 2 : 1); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + .16); g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .18); o.connect(f); f.connect(g); g.connect(mg); o.start(t); o.stop(t + .2); }
      if (S.boostT > 0 || S.charge > .9) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = ARP[step % 8] * (b % 2 ? 1.5 : 1); g.gain.setValueAtTime(.045, t); g.gain.exponentialRampToValueAtTime(.001, t + .1); o.connect(g); g.connect(mg); o.start(t); o.stop(t + .12); } }
    step++; next += 60 / 132 / 4; } }, 50); }
// 한국어 문구 -> 원본 음성 라인(광둥어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
const VOICE = { '출근!': '开工啦', '퇴근!': '收工啦', '아이고, 부딪혔다': '哎呀，撞亲啦', '국물 다 쏟았네': '啲汤倒泻晒啦', '서둘러요': '快啲啦', '잘했어': '好嘢', '대단해': '犀利', '드리프트!': '漂移啊', '배달 왔어요': '你嘅外卖到啦', '고마워요': '多谢晒' };
const clips = {}, sayLast = {}, saidLog = []; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) { const c = clips[VOICE[text] || text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; sayLast[text] = now; if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift(); const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; } if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.6; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {}); }

// ---------- 화면 ----------
function toast(text, cls = '') { const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = text; $('toasts').prepend(d); setTimeout(() => d.remove(), 1700); while ($('toasts').children.length > 3) $('toasts').lastChild.remove(); }
function zoneBanner(z) { $('zone').innerHTML = ZNAME[z] + '<small>GUANGZHOU</small>'; zoneT = 2.2; }
const mini = $('mini').getContext('2d'), miniBg = document.createElement('canvas'); miniBg.width = 224; miniBg.height = 200; const MS = 224 / 830, mx = (x) => (x + 395) * MS + 3, mz = (z) => (z + 345) * MS + 4;
{ const g = miniBg.getContext('2d'); g.fillStyle = 'rgba(40,110,170,.5)'; g.fillRect(0, mz(-48), 224, 96 * MS); g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= T.N; i += 4) { const k = i % T.N; g.lineTo(mx(T.px[k]), mz(T.pz[k])); } g.closePath(); g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 9; g.stroke(); g.strokeStyle = '#e9f2ff'; g.lineWidth = 4; g.stroke(); }
function drawMini() { mini.clearRect(0, 0, 224, 200); mini.drawImage(miniBg, 0, 0); T.at(S.gateDist, 0, tp); mini.fillStyle = S.carrying ? '#ffb040' : '#4dffa0'; mini.beginPath(); mini.arc(mx(tp.x), mz(tp.z), 9 + Math.sin(tAll * 8) * 2, 0, 7); mini.fill();
  mini.fillStyle = '#ff3ad0'; mini.strokeStyle = '#fff'; mini.lineWidth = 3; mini.beginPath(); mini.arc(mx(S.x), mz(S.z), 7, 0, 7); mini.fill(); mini.stroke(); }

// ---------- 시작 ----------
function setGateN(n) { S.gateN = n; const lap = Math.floor(n / 8), k = n % 8, d = (lap + GF[k]) * T.LEN; S.legLen = d - (n ? S.gateDist : 0); S.gateDist = d; S.gateFrom = n ? S.prog : 0; T.at(d, 0, tp); const z = T.zn[tp.i]; S.carrying = k % 2 === 1;
  const label = S.carrying ? DROP[z] : PICK[z][0]; if (!S.carrying) S.item = PICK[z][1]; world.setGate(d, label, !S.carrying);
  $('order').className = 'panel' + (S.carrying ? ' drop' : ''); $('oTag').textContent = S.carrying ? '배달' : '픽업'; $('oName').textContent = label; $('oItem').textContent = S.carrying ? '싣고 있음: ' + S.item : '다음 주문: ' + S.item; $('food').style.display = S.carrying ? 'block' : 'none'; }
function newGame() { T.at(4, 0, tp); Object.assign(S, { x: tp.x, z: tp.z, yaw: Math.atan2(tp.tx, tp.tz), vx: 0, vz: 0, idx: tp.i, prog: 4, lastS: 4, time: 24, money: 0, tips: 0, tipsAll: 0, intact: 100, delivered: 0, dPts: 0, dTime: 0, dShow: 0, mult: 1, charge: 0, lv: 0, boostT: 0, boostLv: 0, drift: false, grip: 8, slip: 0, vl: 0, speed: 0, lean: 0, hit: 0, maxKmh: 0, longest: 0, bestDrift: 0, crashes: 0, near: 0, yr: 0, inv: 0, stuck: 0, lastTick: 9 });
  setGateN(0); camYaw = S.yaw; lastZone = -1; world.trail.reset();
  const kinds = ['taxi', 'car', 'van', 'bus', 'car', 'taxi', 'car', 'van', 'bus', 'taxi']; while (cars.length < kinds.length) { const k = kinds[cars.length]; cars.push({ mesh: world.makeCar(k, k === 'taxi' ? pick([.14, .58, .0]) : Math.random()), kind: k }); }
  cars.forEach((c, i) => { c.s = 150 + i * (T.LEN - 200) / cars.length + rand(-20, 20); c.lat = [-3.9, 0, 3.9][(i * 2 + 1) % 3] * (c.kind === 'bus' ? .95 : 1); c.v = c.kind === 'bus' ? rand(7, 9) : rand(9, 13); c.near = 0; }); }
function start() { audio(); newGame(); state = 'ready'; readyT = 2.6; $('screen').style.display = 'none'; $('hud').style.display = 'block'; say('출근!', 2);
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'gz'; (h.played = h.played || {}).gz = k; h.last = 'gz'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ } }
function title() { state = 'title'; $('hud').style.display = 'none'; const s = $('screen'); s.style.display = 'flex';
  s.innerHTML = `<div class="tag">광저우 · 비 오는 밤</div><h1>광저우 드리프트</h1><div class="sub">비 갠 광저우에서 전동 스쿠터로 배달합니다: 주장을 건너고, 치러우를 지나고, 성중촌을 누비세요<br>드리프트로 팁을 모으고, 놓으면 부스트, 타이머가 끝나기 전에 더 많이 배달하세요</div>
  <div class="help"><b>자동 가속</b>　<b>A D / ← →</b> 조향　<b>스페이스</b> 누르면 드리프트, 놓으면 부스트　<b>S</b> 브레이크<br>모바일: 왼쪽 절반을 좌우로 밀어 조향, 오른쪽 아래 <b>드리프트</b> 길게 누르기</div>
  ${best ? `<div class="sub" style="margin:10px 0 0">최고 수입 <b style="color:#ffd84a">₩${best}</b></div>` : ''}<button class="go" id="go">출 근</button>`; $('go').onclick = start; }
function finish() { state = 'over'; overT = 0; sfx.over(); say('퇴근!', 3); const m = Math.round(S.money); const nb = m > best && !auto; if (nb) { best = m; try { localStorage.setItem('echo_gz_best', '' + best); } catch (e) { /* 무시 */ } }
  const rank = m >= 170 ? '주장 신성 차신' : m >= 120 ? '전동킥 드리프트 왕' : m >= 70 ? '안정 라이더' : m >= 30 ? '동네 라이더' : '초보 출발';
  setTimeout(() => { if (state !== 'over') return; $('hud').style.display = 'none'; const s = $('screen'); s.style.display = 'flex';
    s.innerHTML = `<div class="tag">시간 끝 · 퇴근</div><div class="sub" style="margin:0">오늘 밤 수입</div><div class="big">₩${m}</div><div class="sub" style="margin:0;color:#ff9ae8;font-weight:800;letter-spacing:4px">${rank}${nb ? '　신기록!' : ''}</div>
    <table><tr><td>배달 완료</td><td>${S.delivered} 건</td></tr><tr><td>드리프트 팁</td><td>₩${Math.round(S.tipsAll)}</td></tr><tr><td>가장 긴 드리프트</td><td>${S.longest.toFixed(1)} 초</td></tr><tr><td>최고 속도</td><td>${Math.round(S.maxKmh)} km/h</td></tr><tr><td>스치듯 통과</td><td>${S.near} 회</td></tr><tr><td>충돌</td><td>${S.crashes} 회</td></tr></table>
    <button class="go" id="go">한 번 더 달리기</button>`; $('go').onclick = start; }, 1500); }

// ---------- 매 프레임 ----------
function crash(power, nx, nz) { S.hit = Math.min(1, .35 + power * .06); shake = Math.min(1, .3 + power * .07); S.crashes++; sfx.crash(); if (S.carrying) { const l = Math.min(30, 4 + power * 1.6); S.intact = Math.max(20, S.intact - l); toast(pick(['국물 쏟았다', '용기가 기울었다', '부딪혔다']) + ' -' + Math.round(l) + '%', 'bad'); } else toast('부딪혔다', 'bad');
  if (S.dPts > 30) toast('드리프트 점수 소실', 'bad'); S.dPts = 0; S.dTime = 0; S.charge = 0; S.lv = 0; S.mult = 1; say(pick(['아이고, 부딪혔다', '국물 다 쏟았네']), 1, 5000);
  for (let i = 0; i < 26; i++) fx.add.spawn(S.x + nx * .5, rand(.2, 1), S.z + nz * .5, -nx * rand(1, 7) + rand(-3, 3), rand(1, 6), -nz * rand(1, 7) + rand(-3, 3), rand(.3, .8), rand(.08, .16), 3, rand(1, 2), .3, 1, 0, 1, 14); }
function bank() { if (S.dPts < 20) { S.dPts = 0; S.dTime = 0; return; } const tip = S.dPts / 42; S.tips += tip; S.tipsAll += tip; S.longest = Math.max(S.longest, S.dTime); S.bestDrift = Math.max(S.bestDrift, S.dPts); toast(`드리프트 ${Math.round(S.dPts)}　팁 +₩${tip.toFixed(1)}`, 'gold'); sfx.bank(); if (S.dPts > 900) say(pick(['잘했어', '대단해']), 1, 6000); S.dPts = 0; S.dTime = 0; S.mult = 1; }
function bot() { const L = 7 + S.speed * .4; T.at(S.prog + L, clamp(-loc.d * .0, -3, 3), tp); let want = 0; for (const c of cars) { const ds = ((c.s - S.prog) % T.LEN + T.LEN) % T.LEN; if (ds < 30 && ds > 0 && Math.abs(c.lat - loc.d) < 2.6) want = c.lat > 0 ? -3.6 : 3.6; } if (want) T.at(S.prog + L, want, tp);
  const err = wrap(Math.atan2(tp.x - S.x, tp.z - S.z) - S.yaw); inp.steer = clamp(-err * 2.6, -1, 1); let cv = 0; for (let k = 2; k < 14; k++) cv = Math.max(cv, Math.abs(T.curv[(S.idx + k) % T.N])); inp.drift = cv > .027 && S.speed > 12; inp.brake = false; }
function step(dt) { tAll += dt;
  if (state === 'ready') { readyT -= dt; const n = Math.ceil(readyT / .8); $('count').textContent = readyT > 0 ? n : ''; if (n !== S.lastTick && readyT > 0) { S.lastTick = n; sfx.beep(false); } if (readyT <= 0) { state = 'play'; sfx.beep(true); $('count').textContent = '출발!'; setTimeout(() => $('count').textContent = '', 600); S.lastTick = 9; } }
  const playing = state === 'play';
  if (auto && playing) bot(); else { const raw = clamp((key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0) + inp.tSteer, -1, 1); inp.steer += clamp(raw - inp.steer, -dt * 7, dt * 7); inp.drift = !!(key.Space || key.ShiftLeft || key.ShiftRight || key.KeyJ || inp.tDrift); inp.brake = !!(key.KeyS || key.ArrowDown || inp.tBrake); }
  let fxs = Math.sin(S.yaw), fzs = Math.cos(S.yaw); let vf = S.vx * fxs + S.vz * fzs, vl = S.vx * -fzs + S.vz * fxs; S.speed = Math.hypot(S.vx, S.vz);
  if (playing) { S.time -= dt; if (S.time <= 0) { S.time = 0; bank(); finish(); }
    const wasDrift = S.drift; S.drift = inp.drift && S.speed > 7 && !inp.brake;
    if (S.drift && !wasDrift) { S.yaw -= inp.steer * .16; }
    if (!S.drift && wasDrift) { let l = 0; for (let i = 0; i < 3; i++) if (S.charge >= LVT[i]) l = i + 1; if (l) { S.boostT = [0, .9, 1.5, 2.3][l]; S.boostLv = l; sfx.boost(l); shake = Math.max(shake, .25 + l * .1); if (l === 3) say(pick(['드리프트!', '대단해']), 1, 4000); } S.charge = 0; S.lv = 0; bank(); }
    const sp = S.speed, rate = S.drift ? 1.5 * Math.min(1, sp / 7) : Math.min(1.6 * Math.min(1, sp / 5), 15 / Math.max(sp, 1)); const dy = -inp.steer * rate * dt; S.yaw += dy; S.yr = lerp(S.yr, -dy / dt, Math.min(1, dt * 10));
    fxs = Math.sin(S.yaw); fzs = Math.cos(S.yaw); vf = S.vx * fxs + S.vz * fzs; vl = S.vx * -fzs + S.vz * fxs;
    S.grip = lerp(S.grip, S.drift ? 2.2 : 8.5, Math.min(1, dt * (S.drift ? 12 : 5)));
    const top = (S.boostT > 0 ? TOPB : TOP) * (S.drift ? .95 : 1);
    if (inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 24 * dt); else vf += (vf < top ? 9 * (1 - vf / top) + 2.2 + (S.boostT > 0 ? 16 : 0) : -6 * (vf / top - 1) - 1.5) * dt;
    vl *= Math.exp(-S.grip * dt); if (S.boostT > 0) S.boostT -= dt; if (S.drift && sp < 17 && sp > 1) { const a = 7 * dt / sp; vf += vf * a; vl += vl * a; }
    S.vx = fxs * vf - fzs * vl; S.vz = fzs * vf + fxs * vl; S.x += S.vx * dt; S.z += S.vz * dt; }
  S.vl = vl; S.slip = Math.atan2(Math.abs(vl), Math.max(vf, 1)); S.speed = Math.hypot(S.vx, S.vz);
  // 트랙 위치 파악, 가드레일
  T.locate(S.x, S.z, S.idx, loc); const i = loc.i, nx = -T.tz[i], nz = T.tx[i]; S.idx = i;
  let ds = loc.s - S.lastS; if (ds > T.LEN / 2) ds -= T.LEN; if (ds < -T.LEN / 2) ds += T.LEN; S.prog += ds; S.lastS = loc.s;
  if (playing) { const lim = W - .5; if (Math.abs(loc.d) > lim) { const sg = Math.sign(loc.d), over = Math.abs(loc.d) - lim; S.x -= nx * sg * over; S.z -= nz * sg * over; const vn = (S.vx * nx + S.vz * nz) * sg;
      if (vn > 0) { S.vx -= nx * sg * vn * 1.3; S.vz -= nz * sg * vn * 1.3; const k = 1 - Math.min(.35, vn * .03); S.vx *= k; S.vz *= k; if (vn > 3.2) crash(vn, nx * sg, nz * sg); else { if (Math.random() < .3) sfx.scrape(); fx.add.spawn(S.x + nx * sg * .5, .5, S.z + nz * sg * .5, rand(-2, 2), rand(1, 3), rand(-2, 2), .3, .08, 3, 1.6, .4, 1, 0, 1, 12); S.vx *= 1 - dt * .8; S.vz *= 1 - dt * .8; } }
      const ty = Math.atan2(T.tx[i], T.tz[i]); S.yaw += wrap(ty - S.yaw) * Math.min(1, dt * 5); }
    if (S.speed < 5 && Math.abs(wrap(Math.atan2(T.tx[i], T.tz[i]) - S.yaw)) > 1.4) S.yaw += wrap(Math.atan2(T.tx[i], T.tz[i]) - S.yaw) * Math.min(1, dt * 4);
    // 드리프트 점수와 차지
    const sliding = S.slip > .14 && S.speed > 8;
    if (sliding) { S.dTime += dt; S.mult = Math.min(5, 1 + Math.floor(S.dTime / 1.4)); S.dPts += S.speed * (.5 + S.slip * 2.4) * dt * S.mult * 3; S.dShow = 1; S.idle = 0; } else if (S.dPts > 0 && !S.drift) { S.idle = (S.idle || 0) + dt; if (S.idle > .5) bank(); }
    if (S.drift && S.slip > .1) { S.charge = Math.min(4, S.charge + dt * (.75 + S.slip * 1.3)); let l = 0; for (let k = 0; k < 3; k++) if (S.charge >= LVT[k]) l = k + 1; if (l > S.lv) { S.lv = l; sfx.lvl(l); } }
    // 차량 흐름
    S.inv -= dt; for (const c of cars) { const dx = S.x - c.mesh.position.x, dz = S.z - c.mesh.position.z, al = dx * c.tx + dz * c.tz, sd = dx * -c.tz + dz * c.tx, u = c.mesh.userData;
      if (S.inv <= 0 && Math.abs(al) < u.hl + .75 && Math.abs(sd) < u.hw + .4) { let sg = Math.sign(sd) || 1; if (Math.abs(c.lat + sg * (u.hw + 1.6)) > W - .6) sg = -sg; const push = sg * sd > 0 ? u.hw + .45 - Math.abs(sd) : u.hw + .45 + Math.abs(sd); S.x += -c.tz * sg * push; S.z += c.tx * sg * push; const rel = Math.max(3, S.speed - c.v); S.vx = c.tx * c.v * .55 + -c.tz * sg * 2; S.vz = c.tz * c.v * .55 + c.tx * sg * 2; S.inv = 1.2; crash(rel * .6, -(-c.tz) * sg, -c.tx * sg); c.near = -1; }
      else if (Math.abs(al) < u.hl + 1.5 && Math.abs(sd) < u.hw + 1.7 && S.speed - c.v > 5 && c.near === 0) c.near = 1;
      else if (c.near === 1 && al > u.hl + 1.5) { c.near = 0; S.near++; S.dPts += 120; S.dShow = 1; S.tips += 1; S.tipsAll += 1; toast('스치듯 통과 +₩1', 'good'); sfx.near(); } else if (Math.abs(al) > 14) c.near = 0; }
    // 광문 통과
    if (S.prog >= S.gateDist) { const fac = Math.max(.75, 1.04 - S.gateN * .02), add = S.legLen / 22 * fac; S.time += add; $('tadd').textContent = '+' + add.toFixed(1) + ' 초'; $('tadd').style.transition = 'none'; $('tadd').style.opacity = 1; setTimeout(() => { $('tadd').style.transition = 'opacity .8s'; $('tadd').style.opacity = 0; }, 900);
      for (let k = 0; k < 40; k++) fx.add.spawn(S.x + rand(-5, 5), rand(.5, 5), S.z + rand(-5, 5), rand(-4, 4) + S.vx * .5, rand(2, 8), rand(-4, 4) + S.vz * .5, rand(.5, 1.1), rand(.1, .22), ...(S.carrying ? [3, 1.5, .2] : [.3, 3, 1.2]), 1, 0, .8, 9);
      if (S.carrying) { const pay = (6 + S.legLen / 45 + S.tips) * S.intact / 100; S.money += pay; S.delivered++; S.tips = 0; toast(`배달 완료! +₩${pay.toFixed(1)}` + (S.intact < 100 ? `（온전함 ${Math.round(S.intact)}%）` : ''), 'gold'); sfx.drop(); say(pick(['배달 왔어요', '고마워요']), 2, 0); S.intact = 100; }
      else { toast('픽업: ' + S.item, 'good'); sfx.pick(); }
      setGateN(S.gateN + 1); }
    if (S.time < 6) { const n = Math.ceil(S.time); if (n !== S.lastTick) { S.lastTick = n; sfx.tick(); if (n === 5) say('서둘러요', 2, 8000); } } else S.lastTick = 9;
    S.maxKmh = Math.max(S.maxKmh, S.speed * 3.6); const z = T.zn[i]; if (z !== lastZone) { lastZone = z; zoneBanner(z); } }
  if (state === 'over') { overT += dt; const k = Math.exp(-dt * 1.6); S.vx *= k; S.vz *= k; S.x += S.vx * dt; S.z += S.vz * dt; }
  for (const c of cars) { c.s += c.v * dt; T.at(c.s, c.lat, tp); c.mesh.position.set(tp.x, 0, tp.z); c.mesh.rotation.y = Math.atan2(tp.tx, tp.tz); c.tx = tp.tx; c.tz = tp.tz; }
  visuals(dt); }
function visuals(dt) { const sp = S.speed, fxs = Math.sin(S.yaw), fzs = Math.cos(S.yaw), rx = -fzs, rz = fxs, boosting = S.boostT > 0, lvc = LV[boosting ? S.boostLv : S.lv];
  S.lean = lerp(S.lean, clamp(S.yr * sp * .028 + (S.drift ? Math.sign(S.yr) * .1 : 0), -.46, .46), Math.min(1, dt * 7)); S.hit = Math.max(0, S.hit - dt * 1.6); shake = Math.max(0, shake - dt * 1.8);
  world.bike.position.set(S.x, 0, S.z); world.bike.rotation.y = S.yaw; world.lean.rotation.z = S.lean; world.lean.rotation.x = boosting ? -.1 : 0; world.front.rotation.y = -inp.steer * .35;
  world.U.uBike.value.set(S.x, 0, S.z); world.U.uBikeDir.value.set(fxs, fzs);
  world.under.material.color.setRGB(lvc[0], lvc[1], lvc[2]); world.under.material.opacity = .3 + (S.drift ? .25 : 0) + (boosting ? .2 : 0); world.aura.color.setRGB(lvc[0] / 3, lvc[1] / 3, lvc[2] / 3); world.aura.intensity = S.charge * 6 + (boosting ? 10 : 0);
  const bx = S.x - fxs * .66, bz = S.z - fzs * .66;
  if (state === 'play' || state === 'over') { if (S.slip > .12 && sp > 7) { for (let k = 0; k < 2; k++) fx.smoke.spawn(bx + rand(-.2, .2), .15, bz + rand(-.2, .2), S.vx * .25 + rand(-1, 1), rand(.6, 1.8), S.vz * .25 + rand(-1, 1), rand(.4, .7), rand(.16, .28), .62, .68, .8, .09, 1.5, 1.4, 0);
      if (S.drift && S.lv > 0) for (let k = 0; k < 2; k++) fx.add.spawn(bx, .08, bz, -fxs * rand(2, 6) + rx * rand(-3, 3), rand(1, 4), -fzs * rand(2, 6) + rz * rand(-3, 3), rand(.2, .5), rand(.07, .14), lvc[0] * 1.5, lvc[1] * 1.5, lvc[2] * 1.5, 1, 0, 1, 10); }
    else if (sp > 12 && Math.random() < .5) fx.smoke.spawn(bx, .1, bz, S.vx * .4 + rand(-.6, .6), rand(.5, 1.2), S.vz * .4 + rand(-.6, .6), .45, .22, .6, .66, .78, .13, 1.6, 1, 0);
    if (boosting) for (let k = 0; k < 2; k++) fx.add.spawn(bx + rand(-.08, .08), rand(.3, .5), bz + rand(-.08, .08), -fxs * rand(3, 9) + S.vx * .5, rand(-.3, .6), -fzs * rand(3, 9) + S.vz * .5, rand(.1, .22), rand(.08, .15), lvc[0] * .7, lvc[1] * .7, lvc[2] * .7, 1, -.2, 2, 0); }
  const tc = world.trail.mat.uniforms.uCol.value; if (boosting || (S.drift && S.lv)) tc.setRGB(lvc[0] * 1.3, lvc[1] * 1.3, lvc[2] * 1.3); else tc.setRGB(.9, .06, .03); world.trail.push(S.x - fxs * .9, .74, S.z - fzs * .9, rx, rz, dt);
  // 카메라
  const P = world.isPortrait(), sn = clamp(sp / TOP, 0, 1.5);
  if (state === 'title') { const a = tAll * .16 + 2.4; world.setCam(S.x + Math.sin(a) * 6.5, 1.5 + Math.sin(tAll * .2) * .5, S.z + Math.cos(a) * 6.5, S.x, 1.05, S.z, P ? 62 : 46); }
  else { const vh = sp > 3 ? Math.atan2(S.vx, S.vz) : S.yaw, tgt = S.yaw + wrap(vh - S.yaw) * .6; camYaw += wrap(tgt - camYaw) * Math.min(1, dt * (state === 'ready' ? 2 : 6.5));
    const dist = (P ? 6.4 : 4.7) + sn * .8 - (boosting ? .7 : 0), h = (P ? 3.1 : 2.05) + sn * .2, sx = (Math.random() - .5) * shake * .5, sy = (Math.random() - .5) * shake * .4, cx = Math.sin(camYaw), cz = Math.cos(camYaw);
    world.setCam(S.x - cx * dist + sx, h + sy, S.z - cz * dist, S.x + cx * 7 + sx, 1.1 + (P ? .5 : 0), S.z + cz * 7, (P ? 82 : 58) + sn * 11 + (boosting ? 9 : 0)); }
  const g = world.grade.uniforms; g.uSpeed.value = lerp(g.uSpeed.value, state === 'title' ? 0 : clamp(sp / TOPB, 0, 1) ** 2, Math.min(1, dt * 4)); g.uBoost.value = lerp(g.uBoost.value, boosting ? 1 : 0, Math.min(1, dt * 8)); g.uHit.value = S.hit;
  if (eng && ac) { const t = ac.currentTime, on = state === 'play' || state === 'ready'; eng.o1.frequency.setTargetAtTime(70 + sp * 7.5 + (boosting ? 40 : 0), t, .05); eng.o2.frequency.setTargetAtTime(140 + sp * 15, t, .05); eng.lp.frequency.setTargetAtTime(300 + sp * 60, t, .05); eng.g.gain.setTargetAtTime(on && !muted ? .035 + sp * .0018 : 0, t, .08);
    eng.sg.gain.setTargetAtTime(on && S.slip > .12 && sp > 7 ? Math.min(.11, S.slip * .2) : 0, t, .05); eng.bp.frequency.setTargetAtTime(1500 + sp * 30, t, .1); eng.wg.gain.setTargetAtTime(on ? Math.min(.09, sp * .003) : 0, t, .1); }
  if (state !== 'title') hud(dt); }
function hud(dt) { const t = $('timer'); t.innerHTML = S.time.toFixed(1) + '<small>초</small>'; t.className = S.time < 6 && state === 'play' ? 'low' : ''; $('money').textContent = '₩' + Math.round(S.money); $('cnt').textContent = `배달 ${S.delivered} 건`; $('kmh').textContent = Math.round(S.speed * 3.6);
  const left = Math.max(0, S.gateDist - S.prog); $('oDist').textContent = Math.round(left) + ' m'; $('oBar').firstChild.style.width = clamp(1 - left / Math.max(1, S.gateDist - S.gateFrom), 0, 1) * 100 + '%'; $('foodB').style.width = S.intact + '%'; $('foodB').style.background = S.intact > 70 ? '#5dffb0' : S.intact > 45 ? '#ffc84a' : '#ff6a5a';
  const c = $('charge').firstChild; c.style.width = clamp(S.boostT > 0 ? S.boostT / 2.3 : S.charge / LVT[2], 0, 1) * 100 + '%'; c.style.background = c.style.color = LVCSS[S.boostT > 0 ? S.boostLv : S.lv];
  S.dShow = Math.max(0, S.dShow - dt * (S.dPts > 0 ? 0 : 3)); $('drift').style.opacity = S.dPts > 15 ? 1 : 0; if (S.dPts > 0) { $('dPts').textContent = Math.round(S.dPts); $('dMul').textContent = S.mult > 1 ? '×' + S.mult : ''; }
  zoneT = Math.max(0, zoneT - dt); $('zone').style.opacity = clamp(zoneT, 0, 1); drawMini(); }

// ---------- 입력 ----------
addEventListener('keydown', (e) => { if (e.repeat) return; key[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); audio();
  if (e.code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : .9; } if ((e.code === 'Enter' || e.code === 'Space') && (state === 'title' || (state === 'over' && overT > 1.6))) start(); });
addEventListener('keyup', (e) => { key[e.code] = false; });
let steerId = null, steerX = 0;
$('stage').addEventListener('pointerdown', (e) => { audio(); if (e.target.closest('button,a')) return; if (state !== 'play' && state !== 'ready') return; if (e.pointerType === 'mouse') return; steerId = e.pointerId; steerX = e.clientX; });
addEventListener('pointermove', (e) => { if (e.pointerId === steerId) { inp.tSteer = clamp((e.clientX - steerX) / 60, -1, 1); if (Math.abs(e.clientX - steerX) > 60) steerX = e.clientX - Math.sign(e.clientX - steerX) * 60; } });
const pup = (e) => { if (e.pointerId === steerId) { steerId = null; inp.tSteer = 0; } }; addEventListener('pointerup', pup); addEventListener('pointercancel', pup);
const hold = (id, k) => { const b = $(id), on = (v) => (e) => { e.preventDefault(); inp[k] = v; b.classList.toggle('on', v); }; b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointercancel', on(false)); b.addEventListener('pointerleave', on(false)); };
hold('tDrift', 'tDrift'); hold('tBrake', 'tBrake');
addEventListener('resize', () => world.resize());

let last = performance.now(), held = false, fAcc = 0, fN = 0;
function frame(now) { requestAnimationFrame(frame); if (held) { last = now; return; } const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; step(dt); world.render(dt);
  if (raw < .2 && document.visibilityState === 'visible') { fAcc += raw; if (++fN >= 80) { if (fAcc / fN > .024) world.lowerQuality(); fAcc = fN = 0; } } } // 프레임이 모자라면 자동으로 해상도 낮춤
newGame(); title(); requestAnimationFrame(frame);
window.__gz = { S, world, cars, inp, start, title, hold: (v) => { held = v; }, auto: (v) => { auto = v; }, step: (sec, draw = true) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) step(1 / 60); if (draw) world.render(1 / 60); return { t: +S.time.toFixed(1), money: Math.round(S.money), n: S.delivered, prog: Math.round(S.prog), state, kmh: Math.round(S.speed * 3.6) }; },
  tp: (f) => { T.at(f * T.LEN, 0, tp); S.x = tp.x; S.z = tp.z; S.yaw = camYaw = Math.atan2(tp.tx, tp.tz); S.vx = S.vz = 0; S.idx = tp.i; S.lastS = tp.i * T.seg; }, said: saidLog, clips, state: () => state };
