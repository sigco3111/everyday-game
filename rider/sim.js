// 《메아리: 라이더》의 플랫폼 시뮬레이션: 배차, 시간제한 알고리즘, 조리 대기, 전달, 초과 차감, 평가와 서비스 점수, 목표 보너스, 일일 정산.
// 시간: 현실 1 초 = 게임 1 분. 하루는 10:30 부터 22:30 까지 총 12 분. 지도의 1 m 는 8 m 로 환산해 "킬로미터"로 표시.
import * as THREE from 'three';
import { WEATHER, P, NB, HALF, c } from './world.js?v=5';

export function start(G) {
  const { world, me, hooks, $, rand, clamp } = G, { scene } = world;
  const pick = (a) => a[Math.floor(Math.random() * a.length)], KM = 8 / 1000, yuan = (v) => (v < 0 ? '−¥' : '¥') + Math.abs(v).toFixed(1);
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);                     // 도시에서는 길을 따라서만 이동, 직각 거리로 계산
  const SWAP = [{ name: '배터리 교환소', x: c(1) + 6.4, z: c(3) - 20 }, { name: '배터리 교환소', x: c(4) - 6.4, z: c(1) + 20 }];
  // 전달 시 만날 수 있는 상황: 이름, 추가 초, 등장 가중치
  const HANDOFF = [['고객이 문 앞에서 기다림', 2, 5], ['문 앞에 두고 사진 촬영', 3, 4], ['단지에 오토바이 못 들어감, 뛰어감', 7, 3], ['엘리베이터 없음, 6 층 계단', 9, 2], ['오피스텔 엘리베이터 대기', 7, 2], ['고객 전화 안 받음', 8, 1], ['경비실 출입 등록', 5, 2]];
  const HBAG = HANDOFF.flatMap((h) => Array(h[2]).fill(h));
  const LEVELS = [[0, '브론즈 라이더'], [15, '실버 라이더'], [40, '골드 라이더'], [80, '다이아 라이더'], [150, '마스터 라이더']];

  // ---------- 저장에는 다음 날로 넘길 것만 ----------
  const save = (() => { try { return JSON.parse(localStorage.getItem('echo_rider')) || {}; } catch (e) { return {}; } })();
  save.day = save.day || 1; save.algo = save.algo || 0.85; save.rating = save.rating === undefined ? 90 : save.rating; save.total = save.total || 0; save.best = save.best || 0; save.orders = save.orders || 0;
  const persist = () => { try { localStorage.setItem('echo_rider', JSON.stringify(save)); } catch (e) { /* 저장 못 해도 그냥 둠 */ } };

  // ---------- 하루의 상태 ----------
  let orders = [], offer = null, offerT = 3, oid = 0, cur = null, wxPlan = [], wxI = 0, banT = 0, wait = null, muted = false, swapT = 0, lastWx = '';
  const day = { fee: 0, tip: 0, bonus: 0, cut: 0, fine: 0, spill: 0, done: 0, late: 0, good: 0, bad: 0, reject: 0, offers: 0, sec: 0, bonusAt: 0, crashes: 0, swap: 0, up: 0, down: 0, comp: 0 };
  const demand = (h) => 0.55 + 1.1 * Math.exp(-(((h - 12) / 1.1) ** 2)) + 1.25 * Math.exp(-(((h - 18.7) / 1.3) ** 2)) + (h > 21 ? 0.2 : 0);      // 점심 피크, 저녁 피크
  const wxMul = () => ({ clear: 1, cloudy: 1, drizzle: 1.35, storm: 1.8, fog: 1.15 }[G.weather]), wxSub = () => ({ clear: 0, cloudy: 0, drizzle: 1.5, storm: 3.5, fog: 1 }[G.weather]);
  const level = () => { let n = LEVELS[0][1]; for (const [k, v] of LEVELS) if (save.orders >= k) n = v; return n; };

  // ---------- 소리 ----------
  let ac = null, master = null, motor = null, motorG = null, rainG = null;
  function audio() {
    if (ac) { if (ac.state !== 'running') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
      motor = ac.createOscillator(); motor.type = 'sawtooth'; motorG = ac.createGain(); motorG.gain.value = 0; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; motor.connect(lp); lp.connect(motorG); motorG.connect(master); motor.start();
      const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const rs = ac.createBufferSource(); rs.buffer = nb; rs.loop = true; const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800; rainG = ac.createGain(); rainG.gain.value = 0; rs.connect(rf); rf.connect(rainG); rainG.connect(master); rs.start(); } catch (e) { ac = null; }
  }
  function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
  const sfx = { ding: () => { tone('sine', 1320, 1320, 0.12, 0.2); tone('sine', 1760, 1760, 0.25, 0.2, 0.12); }, cash: () => [988, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.12, 0.16, i * 0.07)), bad: () => { tone('sawtooth', 300, 150, 0.3, 0.2); }, tick: () => tone('square', 1000, 1000, 0.04, 0.06), ok: () => tone('triangle', 660, 990, 0.12, 0.14), crash: () => { tone('sawtooth', 200, 40, 0.5, 0.35); tone('square', 900, 200, 0.2, 0.2); }, msg: () => { tone('sine', 880, 880, 0.1, 0.16); tone('sine', 1175, 1175, 0.18, 0.16, 0.11); } };

  // ---------- 음성: voice_sys 는 플랫폼 시스템 여성 음성, voice 는 라이더 혼잣말(광시 억양). 시스템 안내 우선 ----------
  // 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본 유지, 문구만 이 표로 연결.
  const VOICE = { '새로운 메아리 배달 주문입니다': '您有新的回声外卖订单', '예상 배달 시간을 최적화했습니다': '已为您优化预计送达时间', '부정 평가가 접수됐습니다': '您收到一条差评', '팁을 받았습니다': '您收到一笔打赏', '오늘의 목표 달성 보너스가 입금됐습니다': '今日冲单奖励已到账', '픽업 지점 도착': '到达取餐点', '배달 지점 도착': '到达送餐点', '주문 시간이 곧 초과됩니다, 빨리 배달하세요': '订单即将超时，请尽快送达', '주문 시간이 초과됐습니다': '订单已超时', '배터리 부족, 배터리를 교체하세요': '电量不足，请及时换电', '속도를 줄이세요, 목적지가 근처입니다': '请减速，目的地就在附近', '온라인 상태입니다, 주문 접수 시작': '您已上线，开始接单', '날씨가 나쁩니다, 안전에 주의하세요': '天气恶劣，请注意安全', '이렇게 먼데 이것밖에': '这么远才给这点', '또 주문이다': '又来单了', '이 건 괜찮네': '这单舒服', '끝, 다음 건': '搞定，下一单', '또 초과야': '又超时了', '또 돈을 깎네': '又扣我钱', '이 시스템, 갈수록 빠듯해져': '这系统，越跑越紧', '고맙습니다 사장님': '谢谢老板', '좋은 사람도 있네': '还是有好人的', '아이고, 넘어졌다': '哎哟，摔了', '망했다, 국물 쏟았다': '完了，汤洒了', '빨리 나와라 사장님': '出餐快点嘛老板', '계단 오르러 간다': '爬楼去咯', '배달 왔습니다': '您的外卖到了', '비 오니까 주문이 늘었네': '下雨了，单多起来了', '좀 쉬었다 가자': '歇口气先', '오늘 운이 좋네': '今天手气不错', '버틸 만해': '顶得住', '휴, 그만뛰고 싶다': '唉，不想跑了', '힘들다': '好累啊', '에라, 한 건만 더': '算了，再跑一单', '재촉은, 나도 빨리 가고 싶다고': '催什么催，我也想快', '죽겠다, 퇴근': '累死了，收工', '엄마, 먹었어. 걱정 마': '妈，我吃了，你别操心', '고마워요, 이렇게 비가 오는데도.': '谢谢你啊，这么大雨还送。', '고생했어요, 물 한 병 챙겼어요.': '辛苦了，给你拿了瓶水。', '왜 아직도 안 와요? 배고파 죽겠네!': '怎么还没到啊？我都饿死了！', '더 늦으면 신고할 거예요!': '再不到我就投诉了啊！', '비 오니까 천천히 와도 돼요, 안전이 먼저예요.': '下雨天慢点没关系，注意安全。', '밥은 먹었니? 너무 무리하지 말고 일찍 끝내.': '吃饭没？别太拼了，早点收工。', '돈은 부족하지 않니? 모자라면 엄마한테 말해.': '钱够不够用？不够跟妈讲。', '비 오니까 천천히 타, 안전이 최고야.': '下雨了，慢点骑，安全第一。', '이번 주 정시율이 떨어졌어. 계속 이러면 강등이야.': '你这周准时率掉了啊，再这样要降级了。', '위반입니다, 벌금 부과합니다.': '违章了，开罚单。', '꽉 막혔네': '堵死了', '앞에 학교 구역, 서행하세요': '前方学校路段，请减速慢行', '아이고 죄송죄송, 못 봤어요!': '哎哟对不起对不起，没看到你！', '깜짝이야': '吓死我了', '큰일이다, 교통경찰이다': '完了，有交警', '안녕하세요, 정기 검문입니다. 갓길에 세워 주세요.': '你好，例行检查，靠边停一下。', '이상 없네요, 가세요. 안전 운전하세요.': '没问题，走吧，注意安全。', '이번은 경고, 다음엔 벌금입니다.': '这次给你警告，下次要罚款了。', '앞 좀 봐요 아저씨': '看路啊大哥', '운전 똑바로 해요!': '你怎么骑车的！', '과속입니다': '您已超速', '앞에 공사 구간, 주의해서 피해 가세요': '前方施工，请注意避让' };
  const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
  for (const dir of ['voice_sys', 'voice', 'voice_npc']) fetch(dir + '/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, sys: dir !== 'voice', raw: fetch(dir + '/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
  function say(text, pri = 1, gap = 0, delay = 0) {
    if (delay) { setTimeout(() => say(text, pri, gap), delay * 1000); return; }
    const cl = clips[VOICE[text] || text], now = performance.now(); if (!cl || G.state === 'title' || (gap && now - (sayLast[text] || 0) < gap * 1000) || (now < sayUntil && pri <= sayPri)) return;
    sayLast[text] = now; sayUntil = now + cl.dur * 1000 + 150; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
    const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
    if (!ac || muted) return;
    (cl.buf || (cl.buf = cl.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = buf; gn.gain.value = cl.sys ? 1.5 : 1.7; src.connect(gn); gn.connect(master); src.start(); clipSrc = src; }).catch(() => {});
  }

  // ---------- 화면 소품 ----------
  function toast(text, cls = '', sec = 3.2) { const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; $('toasts').appendChild(el); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); setTimeout(() => el.remove(), sec * 1000); }
  function banner(text, sec = 1.6) { $('banner').textContent = text; banT = sec; }
  // ---------- 기분: 0 에서 100. 재촉, 초과, 악평, 벌금에 깎이고, 호평, 팁, 집 전화에 오름. 주문 없을 때 쉬면 회복 ----------
  let mood = 70, moodT = 0, mutterT = 30, restT = 0, msgT = 0, calls = [], rainCall = false, bossCall = false, lowWarn = false;
  const face = (m) => (m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 20 ? '😣' : '😫');
  function feel(d, emo) { if (G.state !== 'play') return; mood = clamp(mood + d, 0, 100); if (d > 0) day.up += d; else day.down -= d; const el = $('moodD'); el.textContent = (d > 0 ? '+' : '−') + Math.abs(d); el.className = d > 0 ? 'up' : 'dn'; moodT = 1.8; if (emo && G.emote) G.emote(emo); }
  function msg(who, text, cls, d, emo, reply) {                        // 전화와 고객 메시지: 카드 한 장 + 상대방 목소리, 라이더가 가끔 답함
    if (G.state !== 'play') return; const el = $('msg'); el.className = 'panel ' + cls; el.innerHTML = '<b>' + who + '</b>' + text; el.style.display = 'block'; msgT = 6; sfx.msg(); say(text, 2.5, 0, 0.35); if (d) feel(d, emo);
    if (reply) say(reply, 1, 0, 0.35 + ((clips[VOICE[text] || text] || {}).dur || 2.5) + 0.6);
  }
  G.ui = { toast, say, feel, banner, pay(amt, text) { if (G.state !== 'play') return; day.comp += amt; sfx.cash(); toast(text + '　' + yuan(amt), 'good', 4); } };       // hazards.js 용
  const hhmm = (h) => Math.floor(h) + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
  const beacons = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.position.y = 30; m.visible = false; scene.add(m); const r = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); r.position.y = -29.9; m.add(r); return m; });

  // ---------- 내비게이션 ----------
  const M8 = (d) => { const m = Math.round(d * 8 / 10) * 10; return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m'; };
  const onV = (p) => { const i = Math.round((p.x + HALF) / P); return Math.abs(p.x - c(i)) < 8.6 ? i : -1; }, onH = (p) => { const j = Math.round((p.z + HALF) / P); return Math.abs(p.z - c(j)) < 8.6 ? j : -1; };
  function route(a, b) {                                              // 길을 따라 목표까지: 최대 두 번 회전
    const pts = [{ x: a.x, z: a.z }], ai = onV(a), aj = onH(a), bi = onV(b), bj = onH(b);
    const via = (from, to) => { let best = 0, bv = 1e9; for (let k = 0; k <= NB; k++) { const v = Math.abs(from - c(k)) + Math.abs(c(k) - to); if (v < bv) { bv = v; best = k; } } return best; };
    if (bi >= 0) { if (ai === bi) { /* 같은 세로 길, 직진 */ } else if (aj >= 0) pts.push({ x: c(bi), z: c(aj) }); else { const k = via(a.z, b.z), i0 = ai >= 0 ? ai : Math.round((a.x + HALF) / P); pts.push({ x: c(i0), z: c(k) }, { x: c(bi), z: c(k) }); } }
    else if (bj >= 0) { if (aj === bj) { /* 같은 가로 길 */ } else if (ai >= 0) pts.push({ x: c(ai), z: c(bj) }); else { const k = via(a.x, b.x), j0 = aj >= 0 ? aj : Math.round((a.z + HALF) / P); pts.push({ x: c(k), z: c(j0) }, { x: c(k), z: c(bj) }); } }
    pts.push({ x: b.x, z: b.z }); return pts;
  }
  const CHN = 26, chevGeo = new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(0, 0.9); sh.lineTo(0.95, -0.5); sh.lineTo(0.5, -0.5); sh.lineTo(0, 0.25); sh.lineTo(-0.5, -0.5); sh.lineTo(-0.95, -0.5); sh.closePath(); return sh; })()).rotateX(Math.PI / 2);
  const chevMat = new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }), chev = new THREE.InstancedMesh(chevGeo, chevMat, CHN); chev.frustumCulled = false; chev.count = 0; chev.renderOrder = 3; scene.add(chev);
  const cd = new THREE.Object3D(), v3 = new THREE.Vector3(); let path = null, navT = 0;
  // 내려서 뛰어 들어가는 작은 사람
  const runner = new THREE.Group(); { const mat = new THREE.MeshStandardMaterial({ color: 0xffc61a, roughness: 0.7 }), mk2 = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; runner.add(o); return o; };
    mk2(new THREE.CapsuleGeometry(0.2, 0.5, 6, 10), mat, 1.05); mk2(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffc61a, roughness: 0.3 }), 1.62); mk2(new THREE.CapsuleGeometry(0.16, 0.5, 6, 10), new THREE.MeshStandardMaterial({ color: 0x20242c }), 0.45); const bag = mk2(new THREE.BoxGeometry(0.3, 0.26, 0.22), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0.95); bag.position.x = 0.3; runner.userData.bag = bag; }
  runner.visible = false; scene.add(runner);
  function runTo(t, k, carry) {                                       // k 는 0 에서 1: 문 앞으로 → 들어감 → 돌아옴
    const dx = t.x - t.nx * 1.7, dz = t.z - t.nz * 1.7, out = k < 0.3 ? k / 0.3 : k > 0.72 ? (1 - k) / 0.28 : 1, inside = k >= 0.3 && k <= 0.72;
    runner.visible = !inside; G.riderG.visible = false; runner.position.set(me.x + (dx - me.x) * out, Math.abs(Math.sin(performance.now() / 70)) * 0.12, me.z + (dz - me.z) * out); runner.rotation.y = Math.atan2(dx - me.x, dz - me.z) + (k > 0.72 ? Math.PI : 0); runner.userData.bag.visible = carry ? k < 0.5 : k > 0.5;
  }
  function updateNav(dt) {
    const o = cur, nav = $('nav'), pin = $('pin'), cta = $('cta');
    if (!o) { nav.style.display = pin.style.display = cta.style.display = 'none'; chev.count = 0; path = null; return; }
    const t = target(o), go = o.st === 'deliver' || o.st === 'hand', col = go ? 0x5aff9a : 0xffb02e; navT -= dt; if (navT <= 0 || !path) { navT = 0.25; path = route(me, t); }
    path[0].x = me.x; path[0].z = me.z;
    // 노면에 앞으로 흐르는 화살표 줄
    let n = 0, acc = (performance.now() / 1000 * 7) % 4.5 + 3, tot = 0; chevMat.color.setHex(col);
    for (let i = 0; i + 1 < path.length && n < CHN; i++) { const a = path[i], b = path[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(b.x - a.x, b.z - a.z); while (acc < len && n < CHN && tot + acc < 120) { cd.position.set(a.x + (b.x - a.x) * acc / len, 0.09, a.z + (b.z - a.z) * acc / len); cd.rotation.set(0, ang, 0); cd.scale.setScalar(1.25); cd.updateMatrix(); chev.setMatrixAt(n++, cd.matrix); acc += 4.5; } acc -= len; tot += len; }
    chev.count = n; chev.instanceMatrix.needsUpdate = true;
    // 위쪽의 회전 안내
    const p1 = path[1], d1 = Math.hypot(p1.x - me.x, p1.z - me.z), hx = Math.sin(me.a), hz = Math.cos(me.a), ux = (p1.x - me.x) / (d1 || 1), uz = (p1.z - me.z) / (d1 || 1), cr = hx * uz - hz * ux, dot = hx * ux + hz * uz;
    let main; const sub = (go ? '배달: ' : '픽업: ') + t.name;
    if (path.length === 2) main = (go ? '배달 지점 ' : '픽업 지점 ') + M8(d1); else { const p2 = path[2], tc2 = (p1.x - path[0].x) * (p2.z - p1.z) - (p1.z - path[0].z) * (p2.x - p1.x); main = M8(d1) + ' 후 ' + (tc2 < 0 ? '좌회전' : '우회전'); }
    if (dot < -0.35 && d1 > 10) main = '유턴하세요';
    if (o.st === 'wait' || o.st === 'hand') main = go ? '배달 지점 도착' : '픽업 지점 도착';
    $('navT').textContent = main; $('navS').textContent = sub + '　남은 거리 ' + M8(dist(me, t)); $('navA').firstChild.style.transform = 'rotate(' + (Math.atan2(cr, dot) * 180 / Math.PI).toFixed(0) + 'deg)'; nav.style.display = 'flex'; nav.className = 'panel' + (go ? ' go' : '');
    // 목표 위의 라벨: 화면에 계속 붙이고, 벗어나면 가장자리에 붙임
    v3.set(t.x, 7.5, t.z).project(G.camera); let sx = v3.x, sy = v3.y; const behind = v3.z > 1; if (behind) { sx = -sx; sy = -1; }
    sx = clamp(sx, -0.9, 0.9); sy = clamp(sy, -0.72, 0.84); const r = $('stage').getBoundingClientRect();
    pin.style.display = (o.st === 'wait' || o.st === 'hand') ? 'none' : 'block'; pin.className = go ? 'go' : ''; pin.style.left = ((sx + 1) / 2 * r.width) + 'px'; pin.style.top = ((1 - sy) / 2 * r.height) + 'px'; pin.innerHTML = (go ? '배달 ' : '픽업 ') + t.name + '<i>' + M8(Math.hypot(t.x - me.x, t.z - me.z)) + '</i>';
    // 거의 도착: 해야 할 일을 알려 줌
    const dd = Math.hypot(t.x - me.x, t.z - me.z), busy = o.st === 'wait' || o.st === 'hand';
    if (!busy && dd < 22) { cta.style.display = 'block'; cta.innerHTML = (dd < 6.5 ? '엑셀에서 손 떼고 정지' : '도착, 브레이크 잡고 원 안에 정차') + '<small>정지하면 자동으로 ' + (go ? '내려서 배달' : '내려서 픽업') + ', 다른 키는 필요 없습니다</small>'; say('속도를 줄이세요, 목적지가 근처입니다', 1, 14); }
    else if (busy && me.lock) { cta.style.display = 'block'; cta.innerHTML = (go ? '배달 중, 잠시만요' : '픽업 중, 잠시만요') + '<small>차는 세워 뒀고, 끝나면 자동으로 돌아옵니다</small>'; }
    else if (o.st === 'wait') { cta.style.display = 'block'; cta.innerHTML = '가게가 아직 조리 중, 출식 대기<small>기다리기 싫으면 다른 주문부터 배달하고 돌아오세요</small>'; }
    else cta.style.display = 'none';
  }

  // ---------- 배차 ----------
  function makeOffer() {
    const shop = pick(world.shops), home = pick(world.homes), d1 = dist(me, shop), d2 = dist(shop, home); if (d2 < 60) return null;
    const far = d1 > 260, km = d2 * KM, peak = demand(G.hour) > 1.25, night = G.hour >= 21;
    const prepEst = rand(5, 13), prep = prepEst * (Math.random() < 0.22 ? rand(1.5, 2.6) : rand(0.6, 1.2));                 // 2 할의 가게는 조리가 느린데 플랫폼은 신경 안 씀
    const pay = +(3.2 + km * 1.15 + wxSub() + (peak ? 1 : 0) + (night ? 1.5 : 0) + (km > 2.6 ? 1.2 : 0)).toFixed(1);
    // 시간제한: 플랫폼이 "네가 얼마나 빨리 뛸 수 있다"고 보는 대로 계산. 정시일수록 더 빠르다고 봄
    const limit = Math.round((d1 + d2) / (10.5 * save.algo) + prepEst + 9);
    return { id: ++oid, shop, home, d1, d2, km, pay, limit, prep, prepEst, hand: pick(HBAG), far, peak };
  }
  function showOffer(o) {
    offer = o; o.ttl = 12; day.offers++; sfx.ding(); say('새로운 메아리 배달 주문입니다', 2, 5, 0.35);
    $('oText').innerHTML = '<small>새 주문' + (o.peak ? ' · 피크' : '') + (wxSub() ? ' · 날씨 수당 ' + yuan(wxSub()) : '') + '</small><br><b>' + yuan(o.pay) + '</b>　' + o.limit + ' 분 안에 배달<br>픽업: ' + o.shop.name + '　' + (o.d1 * KM).toFixed(1) + ' km<br>배달: ' + o.home.name + '　' + o.km.toFixed(1) + ' km';
    $('offer').style.display = 'block';
  }
  function answer(yes) {
    if (!offer) return; const o = offer; offer = null; $('offer').style.display = 'none';
    if (!yes) { day.reject++; save.rating = Math.max(0, save.rating - 0.8); toast('거절함　수락률 하락, 서비스 점수 −0.8', 'bad'); offerT = rand(4, 8); return; }
    orders.push({ ...o, st: 'pickup', t: 0, spilled: false }); sfx.ok(); if (o.pay < 5.5 && o.km > 1.6) say('이렇게 먼데 이것밖에', 1, 40, 1.4); else if (Math.random() < 0.35) say('또 주문이다', 1, 30, 1.4); toast('수락함: ' + o.shop.name + ' 으로 픽업', 'sys'); if (!cur) cur = orders[orders.length - 1]; offerT = rand(5, 10);
  }
  const target = (o) => (o.st === 'pickup' || o.st === 'wait' ? o.shop : o.home);
  function finish(o) {
    const over = o.t - o.limit; let k = 1, verdict = '정시 배달', cls = 'good';
    if (over > 8) { k = 0; verdict = '심각한 초과 ' + Math.ceil(over) + ' 분, 이 건 배달료 0 원'; cls = 'bad'; } else if (over > 3) { k = 0.4; verdict = '초과 ' + Math.ceil(over) + ' 분, 60% 차감'; cls = 'bad'; } else if (over > 0) { k = 0.7; verdict = '초과 ' + Math.ceil(over) + ' 분, 30% 차감'; cls = 'bad'; }
    const fee = +(o.pay * k).toFixed(1); day.fee += fee; day.cut += o.pay - fee; day.done++; save.orders++; day.sec += o.t;
    if (over > 0) { day.late++; save.rating -= over > 8 ? 6 : over > 3 ? 4 : 2; save.algo = Math.max(0.7, save.algo - 0.004); sfx.bad(); say(Math.random() < 0.5 ? '또 초과야' : '또 돈을 깎네', 1, 20, 0.8); feel(over > 8 ? -12 : over > 3 ? -8 : -5, '😞'); if (day.late === 3 && !bossCall) { bossCall = true; setTimeout(() => msg('스테이션장 · 전화', '이번 주 정시율이 떨어졌어. 계속 이러면 강등이야.', 'bad', -8, '😰'), 4000); } }
    else { save.rating += 0.4; sfx.cash(); feel(3); const before = save.algo; save.algo = Math.min(1.3, save.algo + 0.012); if (Math.floor(save.algo * 20) > Math.floor(before * 20)) { toast('시스템이 과거 속도에 맞춰 예상 배달 시간을 최적화했습니다', 'sys', 4.5); say('예상 배달 시간을 최적화했습니다', 2, 10, 0.8); say('이 시스템, 갈수록 빠듯해져', 1, 60, 3.6); setTimeout(() => feel(-4, '😑'), 900); } else if (Math.random() < 0.45) say(o.pay >= 8 ? '이 건 괜찮네' : '끝, 다음 건', 1, 18, 0.6); }
    toast(o.home.name + '：' + verdict + '　' + yuan(fee), cls);
    // 고객 평가: 정시면 대체로 호평, 초과나 음식 엎지름은 악평이 쉬움
    const pBad = (over > 8 ? 0.6 : over > 3 ? 0.35 : over > 0 ? 0.15 : 0.02) + (o.spilled ? 0.45 : 0), r = Math.random();
    if (o.spilled) { const pen = +(rand(8, 20)).toFixed(1); day.spill += pen; toast('음식을 엎질러 고객에게 ' + yuan(pen) + ' 배상', 'bad'); feel(-8, '😖'); }
    if (r < pBad) { day.bad++; save.rating -= 8; setTimeout(() => { feel(-12, '😭'); say('부정 평가가 접수됐습니다', 2, 5); toast('악평 도착: "' + pick(['국물 다 쏟았어요', '한참 기다렸어요', '음식이 다 식었어요', '태도가 별로예요']) + '"　서비스 점수 −8', 'bad', 4); }, 1200); }
    else if (r > 0.62) { day.good++; save.rating += 0.6; const who = '고객 · ' + o.home.name, r2 = Math.random();
      if (r2 > 0.55 && world.env.rain > 0.3) setTimeout(() => msg(who, '고마워요, 이렇게 비가 오는데도.', 'good', 6, '🥹', Math.random() < 0.5 ? '좋은 사람도 있네' : null), 1500);
      else if (r2 > 0.86) setTimeout(() => msg(who, '고생했어요, 물 한 병 챙겼어요.', 'good', 7, '🥤', '좋은 사람도 있네'), 1500);
      else if (Math.random() < 0.2 + (wxSub() ? 0.2 : 0)) { const tip = Math.ceil(rand(1, wxSub() ? 10 : 5)); day.tip += tip; setTimeout(() => { feel(8, '🥰'); say('팁을 받았습니다', 2, 5); say(Math.random() < 0.5 ? '고맙습니다 사장님' : '좋은 사람도 있네', 1, 20, 2.2); toast('고객 팁 ' + yuan(tip) + ': "' + pick(['고생했어요', '비 오는데 조심하세요', '빨랐어요, 고마워요']) + '"', 'good', 4); }, 1200); } }
    save.rating = clamp(save.rating, 0, 100);
    for (const [n, b] of [[8, 15], [15, 30], [25, 60]]) if (day.done === n && day.bonusAt < n) { day.bonusAt = n; day.bonus += b; banner('목표 보너스 +₩' + b, 2); say('오늘의 목표 달성 보너스가 입금됐습니다', 2, 5, 1); feel(10, '🤑'); toast('오늘 ' + n + ' 건 달성, 목표 보너스 ' + yuan(b), 'good', 4); }
    orders = orders.filter((x) => x !== o); if (cur === o) cur = orders[0] || null; persist();
    if (save.rating < 60) endDay('서비스 점수 60 미만, 계정의 주문 수신이 제한됐습니다');
  }
  hooks.onCrash = (why, v) => { sfx.crash(); day.crashes++; save.rating = Math.max(0, save.rating - 1); toast(why + '　몇 분 지각', 'bad'); say('아이고, 넘어졌다', 2, 3, 0.3); feel(-7, '😵'); for (const o of orders) if (o.st === 'deliver' && !o.spilled && Math.random() < 0.6) { o.spilled = true; toast('박스 안 음식이 쏟아졌다…', 'bad'); say('망했다, 국물 쏟았다', 2, 3, 1.8); } };
  hooks.redLight = () => { day.red = (day.red || 0) + 1; if (Math.random() < 0.35) hooks.fine('신호 위반이 단속 카메라에 찍힘', 20); else toast('신호 위반(이번엔 안 찍힘)', 'bad', 2); };
  hooks.honk = () => { tone('square', 420, 420, 0.25, 0.12); tone('square', 520, 520, 0.25, 0.1); };
  hooks.fine = (why, amt) => { day.fine += amt; sfx.bad(); toast(why + '　벌금 ' + yuan(amt), 'bad', 4); feel(-8, '😤'); say('또 돈을 깎네', 1, 20, 1); };
  hooks.onKey = (code) => { audio(); if (code === 'KeyY') answer(true); else if (code === 'KeyN') answer(false); else if (code === 'Tab' && orders.length) cur = orders[(orders.indexOf(cur) + 1) % orders.length]; else if (code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; } else if ((code === 'Enter' || code === 'Space') && G.state !== 'play') begin(); };
  hooks.onDown = (e) => { audio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a) { begin(); return true; } return false; };
  $('oYes').addEventListener('click', () => answer(true)); $('oNo').addEventListener('click', () => answer(false));

  // ---------- 하루의 시작과 끝 ----------
  function begin() {
    G.state = 'play'; G.hour = 10.5; orders = []; offer = null; cur = null; wait = null; offerT = 2.5; Object.keys(day).forEach((k) => { day[k] = 0; }); me.batt = 1; me.v = 0; me.crashT = 0;
    mood = clamp(45 + (save.mood === undefined ? 70 : save.mood) * 0.4, 50, 82); mutterT = 25; restT = 0; rainCall = bossCall = lowWarn = false; $('msg').style.display = 'none';
    calls = [{ h: rand(12.3, 13.4), text: '밥은 먹었니? 너무 무리하지 말고 일찍 끝내.', reply: '엄마, 먹었어. 걱정 마' }, { h: rand(19.6, 20.9), text: '돈은 부족하지 않니? 모자라면 엄마한테 말해.' }];
    wxPlan = []; let h = 10.5; const bag = ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'drizzle', 'drizzle', 'storm', 'fog']; if (save.day === 1) { wxPlan.push([10.5, 'clear']); h = 12.6; }
    while (h < 22.5) { wxPlan.push([h, pick(bag)]); h += rand(1.4, 2.6); } wxI = 0; G.weather = wxPlan[0][1]; lastWx = '';
    $('offer').style.display = 'none'; $('toasts').innerHTML = ''; $('screen').style.display = 'none'; $('hud').style.display = 'block';
    try { const hb = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (hb.days = hb.days || {})[k] = 'rider'; (hb.played = hb.played || {}).rider = k; hb.last = 'rider'; localStorage.setItem('echo_hub', JSON.stringify(hb)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }
    if (hooks.dayStart) hooks.dayStart(); banner(save.day + ' 일차 · 온라인 접수', 2); sayUntil = 0; say('온라인 상태입니다, 주문 접수 시작', 2, 0, 0.6); toast('메아리 배달: 온라인 상태입니다, 배차 중', 'sys', 4);
  }
  function endDay(why) {
    if (G.state !== 'play') return; G.state = 'over'; const rent = 25, meal = 18, gross = day.fee + day.tip + day.bonus + day.comp, net = gross - day.fine - day.spill - day.swap - rent - meal, hrs = Math.max(0.5, G.hour - 10.5);
    save.total += net; save.best = Math.max(save.best, net); save.day++; save.mood = mood; persist(); me.lock = false; $('msg').style.display = 'none'; $('hud').style.display = 'none';
    const think = mood <= 1 ? '그런 날도 있는 법. 자고 내일 다시 하자.' : net < 0 ? '하루 종일 뛰고 오히려 적자.' : day.bad >= 2 ? '악평이 비보다 차갑다.' : mood >= 75 ? '오늘은 괜찮았다. 집에 가서 엄마한테 전화해야지.' : mood < 35 ? '돈은 벌었는데 몸이 녹초다.' : '내일도 계속 뛰어야지.'; runner.visible = false; G.riderG.visible = true; say('죽겠다, 퇴근', 3); $('nav').style.display = $('pin').style.display = $('cta').style.display = 'none'; chev.count = 0;
    const row = (a, b) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>';
    $('screen').innerHTML = '<h1 style="font-size:44px;letter-spacing:6px">' + (why ? '강제 오프라인' : '퇴근') + '</h1><div class="sub">' + (why || hhmm(G.hour) + ' 오프라인') + '　' + day.done + ' 건 완료, 정시율 ' + (day.done ? Math.round((1 - day.late / day.done) * 100) : 0) + '%</div><table>' +
      row('배달료', yuan(day.fee)) + row('초과 차감', yuan(-day.cut)) + row('고객 팁', yuan(day.tip)) + row('목표 보너스', yuan(day.bonus)) + (day.comp ? row('사고 배상', yuan(day.comp)) : '') + row('교통 벌금', yuan(-day.fine)) + row('음식 배상', yuan(-day.spill)) + row('차 렌트와 배터리', yuan(-rent - day.swap)) + row('식비', yuan(-meal)) +
      row('<b>오늘 번 돈</b>', '<b style="color:#ffd66e">' + yuan(net) + '</b>') + row('시급 환산', yuan(net / hrs) + ' / 시간') + row('호평 / 악평', day.good + ' / ' + day.bad) + row('서비스 점수', save.rating.toFixed(1)) + row('퇴근 때 기분', face(mood) + ' ' + Math.round(mood)) + row('플랫폼이 본 내 속도', (10.5 * save.algo * 3.6).toFixed(0) + ' km/h') + '</table>' +
      '<div class="sub" style="margin:14px 0 0;font-style:italic;color:#ffe9a8">"' + think + '"</div><div class="sub" style="margin-top:6px;font-size:13px">' + level() + '　누적 ' + save.orders + ' 건　최고 일당 ' + yuan(save.best) + '</div><button class="go" data-act="start">하루 더 뛰기</button>';
    if (save.rating < 60) save.rating = 75; persist(); $('screen').style.display = 'flex';
  }
  function title() {
    G.state = 'title'; $('hud').style.display = 'none'; $('screen').style.display = 'flex';
    $('screen').innerHTML = '<h1>라이더</h1><div class="sub">메아리 · 제 11 기　오늘은 배달 ' + save.day + ' 일차</div><div class="help"><b>W</b> 가속　<b>S</b> 브레이크　<b>A D</b> 핸들(모바일: 화면을 누르면 전진, 좌우로 끌어 핸들)<br><b>Y</b> 수락　<b>N</b> 거절　<b>Tab</b> 목표 전환<br>가게에서 픽업 → 고객에게 배달. <b>노면의 화살표</b>와 위쪽 회전 안내를 따라가고, 도착하면 <b>브레이크 잡고 원 안에 정차</b>. 자동으로 내려서 픽업·배달합니다<br>플랫폼은 건마다 <b>시간제한</b>을 둡니다: 초과하면 차감, 심각한 초과는 0 원에 악평까지<br>정시일수록 시스템은 당신이 더 빠르다고 보고 <b>제한이 점점 빠듯해집니다</b><br>비 오면 주문이 많고 수당이 있지만 길이 미끄럽고 잘 안 섭니다. 넘어지면 음식이 쏟아집니다<br>길에는 <b>교통경찰 단속</b>(걸리면 경찰 옆에 정차), <b>스쿨존 30km 제한</b>, 횡단보도 보행자, 공사 구간, 갑자기 열리는 차문이 있습니다. 역주행, 단속 무시, 과속은 전부 벌금<br><b>기분</b>을 챙기세요: 재촉, 초과, 악평, 벌금에 깎이고 호평, 팁, 집 전화에 오릅니다. 주문이 없을 때 <b>잠시 쉬면</b> 회복됩니다<br>서비스 점수가 60 아래로 떨어지면 계정이 제한됩니다</div><button class="go" data-act="start">온라인 접수</button>';
  }

  // ---------- 미니맵 ----------
  const mc = $('map').getContext('2d');
  function drawMap() {
    const S = 360, k = S / (HALF * 2 + 40), o = S / 2, X = (x) => o + x * k, Z = (z) => o + z * k;
    mc.fillStyle = '#10151e'; mc.fillRect(0, 0, S, S); mc.fillStyle = '#232c3a'; for (const b of world.solids) mc.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
    for (const s of SWAP) { mc.fillStyle = '#4ac8ff'; mc.fillRect(X(s.x) - 5, Z(s.z) - 5, 10, 10); }
    for (const m of G.marks || []) { mc.fillStyle = Math.floor(performance.now() / 400) % 2 ? '#ff4a3a' : m.col; mc.beginPath(); mc.arc(X(m.x), Z(m.z), 6, 0, 7); mc.fill(); }
    orders.forEach((od) => { const t = target(od), isCur = od === cur; mc.fillStyle = od.st === 'deliver' || od.st === 'hand' ? '#5aff9a' : '#ffb02e'; mc.beginPath(); mc.arc(X(t.x), Z(t.z), isCur ? 10 : 6, 0, 7); mc.fill();
      if (isCur) { mc.strokeStyle = mc.fillStyle; mc.lineWidth = 3; mc.setLineDash([8, 6]); mc.beginPath(); const pp = path || [me, t]; pp.forEach((q, n) => (n ? mc.lineTo(X(q.x), Z(q.z)) : mc.moveTo(X(q.x), Z(q.z)))); mc.stroke(); mc.setLineDash([]); } });
    mc.save(); mc.translate(X(me.x), Z(me.z)); mc.rotate(-me.a); mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(0, 11); mc.lineTo(7, -8); mc.lineTo(0, -4); mc.lineTo(-7, -8); mc.closePath(); mc.fill(); mc.restore();
  }

  // ---------- 매 프레임 ----------
  let mapT = 0, uiT = 0;
  hooks.tick = (dt) => {
    if (banT > 0) { banT -= dt; if (banT <= 0) $('banner').textContent = ''; }
    if (motorG) { const sp = Math.abs(me.v); motor.frequency.value = 55 + sp * 9; motorG.gain.value = muted || G.state !== 'play' ? 0 : 0.012 + Math.min(0.05, sp * 0.004); rainG.gain.value = muted ? 0 : world.env.rain * 0.09; }
    if (G.state !== 'play') return;
    G.hour += dt / 60;
    if (wxI + 1 < wxPlan.length && G.hour >= wxPlan[wxI + 1][0]) { wxI++; G.weather = wxPlan[wxI][1]; }
    if (G.weather !== lastWx) { if (lastWx) { toast('날씨 변화: ' + WEATHER[G.weather].name + (wxSub() ? '　건당 수당 ' + yuan(wxSub()) + ', 주문 증가' : ''), 'sys', 4); if (G.weather === 'storm' || G.weather === 'fog') say('날씨가 나쁩니다, 안전에 주의하세요', 2, 20, 0.5); else if (G.weather === 'drizzle') say('비 오니까 주문이 늘었네', 1, 60, 0.5); if (WEATHER[G.weather].rain > 0.2 && !rainCall) { rainCall = true; setTimeout(() => msg('엄마 · 전화', '비 오니까 천천히 타, 안전이 최고야.', 'mom', 6, '🥹'), 7000); } } lastWx = G.weather; }
    if (G.weather === 'storm' && Math.random() < dt * 0.12) world.env.flash = 1;
    if (G.hour >= 22.5) { endDay(''); return; }
    // 배차: 피크와 비에 주문이 많고, 점수가 낮거나 거절이 잦으면 줄어듦
    if (offer) { offer.ttl -= dt; $('oBar').style.width = clamp(offer.ttl / 12, 0, 1) * 100 + '%'; if (offer.ttl <= 0) { toast('주문 응답 시간 초과, 다른 라이더에게 넘어갔습니다', 'bad'); answer(false); } }
    else if (orders.length < 3) { offerT -= dt * demand(G.hour) * wxMul() * (0.5 + save.rating / 180) * (orders.length ? 0.6 : 1.2); if (offerT <= 0) { const o = makeOffer(); if (o) showOffer(o); else offerT = 0.5; } }
    // 주문 진행: 목표에 도착해 정지하면 자동으로 내림. 픽업은 출식을 기다리고, 배달은 상황에 따라 뛰어 들어감
    wait = null; let acting = false, drain = 0.012 + (G.hour > 20.5 ? 0.01 : 0) + world.env.rain * 0.012;
    for (const o of [...orders]) {
      o.t += dt; if (o.st === 'pickup' || o.st === 'wait') o.prep -= dt;
      const t = target(o), dd = Math.hypot(me.x - t.x, me.z - t.z), near = dd < 6 && Math.abs(me.v) < 3, left = o.limit - o.t;
      if (o.st === 'deliver' && msgT <= 0) { const who = '고객 · ' + o.home.name;
        if (!o.nag && left < 5 && left > 0 && Math.random() < dt * 0.25) { o.nag = 1; msg(who, '왜 아직도 안 와요? 배고파 죽겠네!', 'bad', -4, '💢', Math.random() < 0.5 ? '재촉은, 나도 빨리 가고 싶다고' : null); }
        else if (o.nag !== 2 && left < -2 && Math.random() < dt * 0.3) { o.nag = 2; msg(who, '더 늦으면 신고할 거예요!', 'bad', -6, '💢'); }
        else if (!o.nag && !o.kind && world.env.rain > 0.3 && left > 5 && Math.random() < dt * 0.03) { o.kind = 1; msg(who, '비 오니까 천천히 와도 돼요, 안전이 먼저예요.', 'good', 5, '🥹'); } }
      drain += o.st === 'hand' ? 0 : left < 0 ? 0.3 : left < 4 ? 0.15 : 0; if (o.st === 'wait' && o.prep > 0) drain += 0.1;
      if (o.st === 'pickup' && near) { o.st = 'wait'; o.grab = 2.2; o.g0 = 2.2; me.v = 0; say('픽업 지점 도착', 1, 8); if (o.prep > 2) { toast(o.shop.name + ' 아직 조리 중, 조금만요', 'sys'); say('빨리 나와라 사장님', 1, 30, 2); } }
      if (o.st === 'wait') {
        if (dd > 7.5) { o.st = 'pickup'; continue; }
        if (o.prep > 0) wait = { text: o.shop.name + ' 출식 대기…', k: 1 - clamp(o.prep / (o.prepEst * 2), 0, 1) };
        else { acting = true; o.grab -= dt; runTo(t, 1 - o.grab / o.g0, false); wait = { text: '내려서 픽업', k: 1 - o.grab / o.g0 }; if (o.grab <= 0) { o.st = 'deliver'; sfx.ok(); toast('픽업 완료, ' + o.home.name + ' 으로 배달', 'sys'); if (cur === o || !cur) cur = o; path = null; } }
      }
      else if (o.st === 'deliver' && near) { o.st = 'hand'; o.handT = (o.hand[1] + 1.5) * (1.2 - 0.35 * mood / 100); o.h0 = o.handT; me.v = 0; toast(o.hand[0], 'sys'); say('배달 지점 도착', 1, 8); if (o.hand[1] >= 9) say('계단 오르러 간다', 1, 20, 1.6); else say('배달 왔습니다', 1, 12, o.h0 * 0.45); }
      else if (o.st === 'hand') { acting = true; o.handT -= dt; runTo(t, 1 - o.handT / o.h0, true); wait = { text: o.hand[0], k: 1 - o.handT / o.h0 }; if (o.handT <= 0) { finish(o); path = null; } }
      if (o.st !== 'hand' && Math.abs(o.limit - o.t - 3) < dt / 2) { sfx.tick(); toast(o.home.name + ' 초과까지 3 분', 'bad'); say('주문 시간이 곧 초과됩니다, 빨리 배달하세요', 2, 6); }
      if (o.st !== 'hand' && Math.abs(o.limit - o.t) < dt / 2) say('주문 시간이 초과됐습니다', 2, 6);
    }
    me.lock = acting || !!G.hold; if (G.hold) wait = G.hold; if (!acting) { runner.visible = false; G.riderG.visible = true; }
    if (cur && !orders.includes(cur)) cur = orders[0] || null;
    // 기분
    if (!orders.length && Math.abs(me.v) < 0.5) { restT += dt; if (mood < 85) mood = Math.min(85, mood + dt * 0.9); if (restT > 2.5 && mood < 70) say('좀 쉬었다 가자', 1, 90); } else { restT = 0; mood = Math.max(0, mood - drain * dt); }
    for (const cl of calls) if (!cl.done && G.hour >= cl.h && !me.lock && msgT <= 0) { cl.done = true; msg('엄마 · 전화', cl.text, 'mom', 7, '🥹', cl.reply); }
    mutterT -= dt; if (mutterT <= 0) { mutterT = rand(28, 45); if (!me.lock) say(mood > 78 ? pick(['오늘 운이 좋네', '버틸 만해']) : mood < 32 ? pick(['휴, 그만뛰고 싶다', '힘들다']) : mood < 55 ? '에라, 한 건만 더' : '', 1, 50); }
    if (mood < 18 && !lowWarn) { lowWarn = true; toast('한계에 가깝습니다: 주문 없을 때 잠시 쉬면 기분이 회복됩니다', 'bad', 5.5); say('힘들다', 1, 20); if (G.emote) G.emote('😫'); } else if (mood > 35) lowWarn = false;
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.display = 'none'; } if (moodT > 0) { moodT -= dt; if (moodT <= 0) $('moodD').textContent = ''; }
    me.mood = mood / 100; { const u = world.grade.uniforms.uSat; u.value += (0.8 + 0.36 * me.mood - u.value) * Math.min(1, dt * 0.8); }      // 기분이 나쁘면 도시 전체의 색이 옅어짐
    if (mood <= 0) { endDay('멘탈이 무너졌다, 오늘은 못 뛰겠다'); return; }
    // 배터리 교체
    const st = SWAP.find((s) => Math.hypot(me.x - s.x, me.z - s.z) < 4.5 && Math.abs(me.v) < 2);
    if (st && me.batt < 0.9) { swapT += dt; wait = { text: '배터리 교체 중…', k: swapT / 3 }; if (swapT >= 3) { me.batt = 1; swapT = 0; day.swap += 3; sfx.ok(); toast('배터리 교체 완료, ₩3.0', 'sys'); } } else swapT = 0;
    if (me.batt < 0.12 && Math.random() < dt * 0.2) { toast('배터리 12% 미만, 속도 제한, 파란 배터리 교환소로', 'bad'); say('배터리 부족, 배터리를 교체하세요', 2, 25); }
    // 화면
    uiT -= dt; if (uiT <= 0) { uiT = 0.2;
      $('clock').textContent = hhmm(G.hour); $('wx').textContent = WEATHER[G.weather].name + (demand(G.hour) > 1.25 ? ' · 피크' : ''); $('money').textContent = yuan(day.fee + day.tip + day.bonus + day.comp - day.fine - day.spill - day.swap); $('rating').textContent = save.rating.toFixed(1); $('done').textContent = day.done; $('mood').textContent = face(mood) + ' ' + Math.round(mood); $('lvl').textContent = level();
      $('kmh').textContent = Math.round(Math.abs(me.v) * 3.6); $('batt').textContent = '배터리 ' + Math.round(me.batt * 100) + '%';
      $('orders').innerHTML = orders.length ? orders.map((o) => { const left = o.limit - o.t, t = target(o), d = (dist(me, t) * KM).toFixed(1); return '<div class="ord' + (o === cur ? ' cur' : '') + (left < 0 ? ' late' : left < 4 ? ' warn' : '') + '"><span class="t">' + (left < 0 ? '초과 ' + Math.ceil(-left) : Math.ceil(left)) + '′</span><b>' + (o.st === 'pickup' || o.st === 'wait' ? '픽업 ' + o.shop.name : '배달 ' + o.home.name) + '</b><br><small>' + d + ' km　' + yuan(o.pay) + (o.spilled ? '　음식 엎음' : '') + '</small></div>'; }).join('') : '<div class="ord"><small>주문 없음, 배차 대기 중…</small></div>';
      $('prog').style.display = wait ? 'block' : 'none'; if (wait) { $('progT').textContent = wait.text; $('progB').style.width = clamp(wait.k, 0, 1) * 100 + '%'; } }
    updateNav(dt);
    mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMap(); }
    const tt = performance.now() / 1000; beacons.forEach((b, i) => { const o = orders[i]; b.visible = !!o; if (!o) return; const t = target(o), isCur = o === cur, col = o.st === 'deliver' || o.st === 'hand' ? 0x5aff9a : 0xffb02e; b.position.set(t.x, 30, t.z); b.material.color.setHex(col); b.children[0].material.color.setHex(col); b.material.opacity = (isCur ? 0.4 : 0.14) + 0.08 * Math.sin(tt * 4); b.children[0].scale.setScalar(1 + 0.15 * Math.sin(tt * 5)); });
  };
  title();
  // 디버그 입구
  window.__sim = { begin, endDay, answer, toast, feel, msg, get mood() { return mood; }, set mood(v) { mood = v; }, get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; }, get path() { return path; }, get nav() { return $('navT').textContent + ' | ' + $('navS').textContent + ' | ' + $('cta').textContent; },
    get s() { return { state: G.state, hour: +G.hour.toFixed(2), weather: G.weather, orders: orders.map((o) => o.st + ':' + Math.round(o.limit - o.t)), offer: offer ? offer.pay + '/' + offer.limit : null, done: day.done, late: day.late, fee: +day.fee.toFixed(1), rating: +save.rating.toFixed(1), algo: +save.algo.toFixed(3), batt: +me.batt.toFixed(2) }; }, get cur() { return cur ? target(cur) : null; }, day, save, orders: () => orders };
                         }
