// 《메아리: 뽁뽁이 터뜨리기》—— 세로 화면: 손가락으로 쓸어넘기면 뽁뽁뽁 터짐. 제한 시간 안에 한 장을 다 터뜨리면 다음 장; 금색은 시간 추가, 연쇄는 한꺼번에 폭발, 방귀는 금지.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand(a.length))];
const GAP = 1.42, START_TIME = 30, FEVER_AT = 40;

// ---------- 렌더링 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a2c22);
const camera = new THREE.PerspectiveCamera(50, 0.6, 1, 120);
const CAM = new THREE.Vector3(0, 23.5, 7), LOOK = new THREE.Vector3(0, 0, 1.6);
camera.position.copy(CAM); camera.lookAt(LOOK);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88)); composer.addPass(new OutputPass());
let W = 0, H = 0;
function resize() { H = innerHeight; W = Math.round(Math.min(innerWidth, H * 0.62)); stage.style.width = W + 'px'; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.fov = W / H < 0.5 ? 56 : 50; camera.updateProjectionMatrix(); pMat.uniforms.uScale.value = H * renderer.getPixelRatio() * 0.42; }
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(-7, 20, 9); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: 2, far: 50 }); sun.shadow.bias = -0.002;
{                                                                   // 나무 탁상
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#9a6b42'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '70,40,20' : '190,140,90') + ',' + rand(0.08, 0.22) + ')'; g.lineWidth = rand(1, 4); const y = rand(256); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + rand(-8, 8), 170, y + rand(-8, 8), 256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 4); t.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(50, 60), new THREE.MeshLambertMaterial({ map: t })); f.rotation.x = -Math.PI / 2; f.position.y = -0.12; f.receiveShadow = true; scene.add(f);
}
// 뽁뽁이: 반투명 비닐 한 장 + 하나하나의 뽁뽁이(인스턴스)
const sheet = new THREE.Group(); scene.add(sheet);
const film = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshPhongMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.4, shininess: 90, specular: 0xffffff })); film.rotation.x = -Math.PI / 2; film.receiveShadow = true; sheet.add(film);
const NMAX = 140, dummy = new THREE.Object3D();
const bubGeo = new THREE.SphereGeometry(0.6, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
const bubM = new THREE.InstancedMesh(bubGeo, new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, shininess: 120, specular: 0xffffff }), NMAX);
bubM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NMAX * 3).fill(1), 3); bubM.castShadow = true; bubM.frustumCulled = false; bubM.count = 0; sheet.add(bubM);
const glintM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), NMAX); glintM.frustumCulled = false; glintM.count = 0; sheet.add(glintM);
// 손가락이 닿는 자리의 빛 고리
const cursor = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, depthTest: false })); cursor.rotation.x = -Math.PI / 2; cursor.renderOrder = 5; cursor.visible = false; scene.add(cursor);

// ---------- 파티클 ----------
const PMAX = 2400;
const pPos = new Float32Array(PMAX * 3).fill(-999), pVel = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pGrav = new Float32Array(PMAX), pSize = new Float32Array(PMAX);
let pNext = 0; const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, toneMapped: false,
  vertexShader: 'attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.25, d); gl_FragColor = vec4(vC, a * 0.85); }' });
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 6; scene.add(pPoints);
function spark(x, y, z, vx, vy, vz, col, life, size = 1, grav = 22) { const i = pNext; pNext = (pNext + 1) % PMAX; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz; pCol[i * 3] = col[0]; pCol[i * 3 + 1] = col[1]; pCol[i * 3 + 2] = col[2]; pLife[i] = life; pGrav[i] = grav; pSize[i] = size; }
function burst(x, z, n, col, spd, size = 1) { for (let k = 0; k < n; k++) { const a = rand(Math.PI * 2), s = spd * rand(0.3, 1); spark(x, 0.5, z, Math.cos(a) * s, rand(3, 9), Math.sin(a) * s, col, rand(0.25, 0.55), size * rand(0.6, 1.3)); } }
function updateParticles(dt) { for (let i = 0; i < PMAX; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; } pVel[i * 3 + 1] -= pGrav[i] * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; } pGeo.attributes.position.needsUpdate = pGeo.attributes.aCol.needsUpdate = pGeo.attributes.aSize.needsUpdate = true; }

// ---------- 데이터 ----------
// 뽁뽁이 종류: norm 일반 / gold 금색(시간 추가) / chain 연쇄(주변까지 폭발) / tough 두꺼움(두 번 터뜨림) / stink 방귀(금지, 시간 감점)
const KIND = {
  norm: { col: [0.86, 0.95, 1.0], pts: 10 }, gold: { col: [1.0, 0.82, 0.25], pts: 30 }, chain: { col: [1.0, 0.5, 0.85], pts: 20 },
  tough: { col: [0.45, 0.62, 0.95], pts: 25, s: 1.18 }, stink: { col: [0.55, 0.72, 0.25], pts: 0 },
};
const SHAPES = {                                                    // 장마다의 모양: u, v 는 -1 에서 1 사이 위치
  full: () => true, round: (u, v) => u * u + v * v < 1.02, diamond: (u, v) => Math.abs(u) + Math.abs(v) < 1.08, ring: (u, v) => { const r = Math.hypot(u, v); return r < 1.02 && r > 0.42; },
  heart: (u, v) => { const x = u * 1.25, y = -v * 1.25 + 0.25; return (x * x + y * y - 1) ** 3 - x * x * y * y * y < 0; }, cross: (u, v) => Math.abs(u) < 0.4 || Math.abs(v) < 0.34,
};
const SHAPE_NAME = { full: '한 장 가득', round: '원형', diamond: '마름모', ring: '도넛', heart: '하트', cross: '십자' };
const STREAK = { 20: '뽁뽁뽁', 50: '멈출 수 없어', 100: '손속도 괴인', 200: '뽁뽁이 종결자' };

// ---------- 상태 ----------
let state = 'title', held = false, auto = false, muted = false;
let phase = 'in', phaseT = 0, sheetN = 0, score = 0, timeLeft = START_TIME, combo = 0, comboT = 0, bestCombo = 0, feverT = 0, shake = 0, hurt = 0, bannerT = 0, popped = 0, left = 0, sheetX = 0, tipT = 0;
let best = 0; try { best = +localStorage.getItem('echo_pop_best') || 0; } catch (e) { /* 저장 못 해도 그냥 둠 */ }
let bubs = [], waves = [];
const ptr = { x: 0, z: 0, lx: 0, lz: 0, down: false, has: false };

// ---------- 소리 ----------
let ac = null, master = null, noiseBuf = null; const lastSfx = {};
function initAudio() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination); noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
function tone(type, f0, f1, dur, vol, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function click(vol, freq, dur = 0.035, delay = 0) { if (!ac || muted) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, rand(0.8), dur + 0.02); }
function fart(dur, vol, f0) { if (!ac || muted) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + dur); l.frequency.value = rand(26, 40); lg.gain.value = vol * 0.6; l.connect(lg); lg.connect(g.gain); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05); }
function limited(name, gap, fn) { const now = performance.now(); if (now - (lastSfx[name] || 0) < gap) return; lastSfx[name] = now; fn(); }
const SCALE = [0, 2, 4, 7, 9];
const sfx = {
  pop: (c) => limited('pop', 22, () => { const st = Math.min(19, Math.floor(c / 4)), f = 420 * 2 ** ((SCALE[st % 5] + 12 * Math.floor(st / 5)) / 12); click(0.5, rand(1800, 3200)); tone('sine', f * 1.6, f * 0.7, 0.05, 0.16); }),   // 뽁: 가벼운 소리에 음높이를 얹고, 연속일수록 점점 높아짐
  dud: () => limited('dud', 60, () => { click(0.25, 900, 0.05); tone('sine', 220, 180, 0.05, 0.1); }),            // 두꺼운 건 첫 타격: 뭉툭하게
  gold: () => { tone('triangle', 1320, 1760, 0.12, 0.14); tone('triangle', 1760, 2640, 0.16, 0.12, 0.07); },
  chain: () => { for (let i = 0; i < 5; i++) click(0.35, rand(1500, 3000), 0.04, i * 0.035); tone('sine', 300, 90, 0.25, 0.2); },
  stink: () => { fart(0.4, 0.32, rand(90, 130)); },
  done: () => [660, 880, 1100, 1320].forEach((f, i) => tone('triangle', f, f, 0.14, 0.14, i * 0.07)),
  sheet: () => { click(0.3, 600, 0.25); },
  fever: () => [523, 784, 1047, 1568].forEach((f, i) => tone('square', f, f, 0.1, 0.08, i * 0.05)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.22, i * 0.22)),
};
// 한국어 문구 -> 원본 음성 라인(중국어) 대응표. 음성 파일은 원본을 그대로 두고, 문구만 이 표로 연결한다.
const VOICE = { '터뜨리기 시작': '开捏', '시원해': '爽', '손속도 괴인': '手速狂魔', '연쇄 폭발': '连环爆', '냄새나': '臭死了', '그건 터뜨리지 마': '别捏那个', '다 터뜨렸다': '捏完了', '다음 장': '下一张', '시간 끝': '时间到' };
const clips = {}, saidLog = [], sayLast = {}; let sayTok = 0, clipSrc = null, sayUntil = 0, sayPri = 0;
/* 음성 비활성화(사용자 선택): 원본 중국어 음성 클립을 불러오지 않음 */ false && fetch('voice/index.json').then((r) => r.json()).then((idx) => { for (const t in idx) clips[t] = { dur: idx[t].dur, raw: fetch('voice/' + idx[t].id + '.mp3').then((r) => r.arrayBuffer()) }; }).catch(() => {});
function say(text, pri = 1, gap = 0) {
  const c = clips[VOICE[text] || text], now = performance.now(); if (gap && now - (sayLast[text] || 0) < gap) return; bubble(text); sayLast[text] = now;
  if (!c || (now < sayUntil && pri <= sayPri)) return;
  sayUntil = now + c.dur * 1000; sayPri = pri; saidLog.push(text); if (saidLog.length > 40) saidLog.shift();
  const tok = ++sayTok; if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* 이미 다 재생됨 */ } clipSrc = null; }
  if (!ac || muted) return;
  (c.buf || (c.buf = c.raw.then((b) => ac.decodeAudioData(b)))).then((buf) => { if (tok !== sayTok) return; const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = 1.5; src.connect(g); g.connect(master); src.start(); clipSrc = src; }).catch(() => {});
}
function bubble(text) { const el = $('bubble'); el.textContent = text; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

// ---------- 화면 ----------
function banner(text, sec = 1.2) { $('banner').textContent = text; bannerT = sec; }
function showScreen() {
  const s = $('screen');
  if (state === 'play') { s.style.display = 'none'; $('hud').style.display = 'block'; return; }
  s.style.display = 'flex'; $('hud').style.display = state === 'title' ? 'none' : 'block';
  const dot = (k) => '<i style="display:inline-block;width:14px;height:14px;border-radius:50%;margin:0 5px 0 12px;vertical-align:-2px;background:rgb(' + KIND[k].col.map((v) => Math.round(v * 255)).join(',') + ')"></i>';
  if (state === 'title') s.innerHTML = '<h1>뽁뽁이 터뜨리기</h1><div class="sub">메아리 · 제 7 기</div><div class="help"><b>눌러서 쓸어넘기면</b> 뽁뽁뽁 터집니다<br>시간이 끝나기 전에 한 장씩 이어서 터뜨리세요<br>' + dot('gold') + '금색은 1초 추가' + dot('chain') + '연쇄는 한꺼번에 펑<br>' + dot('tough') + '두꺼운 건 두 번' + dot('stink') + '<b>방귀는 건드리지 마세요</b><br>연속 ' + FEVER_AT + ' 개로 피버 돌입: 한 번에 와르르, 점수 2배</div>' +
    (best ? '<div class="sub" style="margin-top:12px">최고 점수 ' + best + '</div>' : '') + '<button class="go" data-act="start">시 작</button>';
  else s.innerHTML = '<h1 class="red">시간 끝</h1><div class="sub">점수 ' + score + '　완주 ' + (sheetN - 1) + ' 장<br>총 ' + popped + ' 개 터뜨림　최고 연속 ' + bestCombo + '<br>최고 점수 ' + best + '</div><button class="go" data-act="start">한 판 더</button>';
}
function hud() {
  $('money').textContent = score; $('clock').textContent = sheetN + ' 번째 장'; $('bad').textContent = bestCombo;
  const tb = $('tbar'); tb.firstChild.style.width = clamp(timeLeft / START_TIME, 0, 1) * 100 + '%'; tb.className = 'bar' + (timeLeft < 6 ? ' max' : ''); $('ttxt').textContent = '남음 ' + Math.max(0, timeLeft).toFixed(1) + ' 초';
  $('name').textContent = '남은 ' + left + ' 개'; $('flow').innerHTML = combo >= 5 ? '×' + combo + '<small>' + (feverT > 0 ? '피버 중' : '연속') + '</small>' : '';
  $('tip').textContent = sheetN === 1 && tipT < 5 ? '누른 채 뽁뽁이 위를 쓸어넘기세요' : '';
  $('hurt').style.opacity = hurt.toFixed(2); $('foam').style.opacity = feverT > 0 ? 0.75 : 0;
}

// ---------- 뽁뽁이 한 장 ----------
function newSheet() {
  sheetN++; phase = 'in'; phaseT = 0; bubs = []; waves = []; sfx.sheet();
  const lv = sheetN - 1, C = Math.min(8, 6 + Math.floor(lv / 3)), Rw = Math.min(11, 8 + Math.floor(lv / 2)), key = lv < 2 ? 'full' : pick(Object.keys(SHAPES)), inShape = SHAPES[key];
  const w = (C - 0.5) * GAP, h = (Rw - 1) * GAP * 0.88;
  for (let j = 0; j < Rw; j++) for (let i = 0; i < C; i++) {
    const x = (i - (C - 1) / 2 + (j % 2 ? 0.25 : -0.25)) * GAP, z = (j - (Rw - 1) / 2) * GAP * 0.88; if (!inShape(x / (w / 2), z / (h / 2))) continue;
    bubs.push({ x, z, k: 'norm', hp: 1, on: true, t: 0, wob: rand(6), dent: 0 });
  }
  const set = (k, n) => { for (let q = 0; q < n; q++) { const b = pick(bubs); if (b.k === 'norm') { b.k = k; if (k === 'tough') b.hp = 2; } } };
  set('gold', 2); if (lv >= 1) set('chain', Math.min(4, 1 + Math.floor(lv / 2))); if (lv >= 2) set('tough', Math.min(14, 3 + lv)); if (lv >= 1) set('stink', Math.min(9, lv));
  film.scale.set(w + 2.2, h + 2.2, 1); left = bubs.filter((b) => b.k !== 'stink').length;
  if (lv >= 2) banner(sheetN + ' 번째 장 · ' + SHAPE_NAME[key], 1.1); else banner(sheetN + ' 번째 장', 1);
}
function pop(b, byChain) {
  if (!b.on) return;
  if (b.k === 'stink') { if (byChain) return; b.on = false; timeLeft -= 3; combo = 0; feverT = 0; hurt = 0.9; shake = 0.8; sfx.stink(); banner('방귀 뽁뽁이　−3초', 1.1); say(pick(['냄새나', '그건 터뜨리지 마']), 2, 1500); for (let i = 0; i < 26; i++) spark(b.x + sheetX, 0.5, b.z + 1.2, rand(-3, 3), rand(2, 7), rand(-3, 3), [0.6, 0.72, 0.25], rand(0.5, 1.1), rand(2, 4), -1); return; }
  if (b.hp > 1 && !byChain) { b.hp--; b.dent = 1; sfx.dud(); return; }
  b.on = false; b.t = 0; popped++; left--; combo++; comboT = 0.7; bestCombo = Math.max(bestCombo, combo);
  const d = KIND[b.k]; score += Math.round(d.pts * (feverT > 0 ? 2 : 1) * (1 + Math.min(2, combo / 50)));
  burst(b.x + sheetX, b.z + 1.2, b.k === 'norm' ? 5 : 12, [Math.min(1, d.col[0] + 0.2), Math.min(1, d.col[1] + 0.2), Math.min(1, d.col[2] + 0.2)], 7, 1.1);
  if (b.k === 'gold') { timeLeft = Math.min(START_TIME + 5, timeLeft + 1); sfx.gold(); banner('+1초', 0.7); }
  else if (b.k === 'chain') { sfx.chain(); shake = Math.max(shake, 0.5); waves.push({ x: b.x, z: b.z, r: 0, max: GAP * 2.6 }); say('연쇄 폭발', 1, 4000); }
  else sfx.pop(combo);
  if (STREAK[combo]) { banner(STREAK[combo] + '　×' + combo, 1.2); if (combo === 100) say('손속도 괴인', 2); else if (combo === 20) say('시원해', 1, 6000); }
  if (combo === FEVER_AT || (combo > FEVER_AT && combo % 60 === 0)) { feverT = 6; sfx.fever(); banner('피버', 1.2); }
}
function press(x, z) {                                              // 손가락이 (x, z) 를 누름: 닿는 뽁뽁이를 터뜨림
  const rr = feverT > 0 ? 1.35 : 0.78;
  for (const b of bubs) if (b.on && (b.x - x) ** 2 + (b.z - z) ** 2 < rr * rr && b.last !== strokeId) { b.last = strokeId; pop(b); }
}
let strokeId = 1;
function stroke(x0, z0, x1, z1) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.3)); for (let i = 1; i <= n; i++) press(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); }   // 아무리 빨리 쓸어도 빠뜨리지 않음
function endGame() { state = 'over'; sfx.over(); if (score > best) { best = score; try { localStorage.setItem('echo_pop_best', '' + best); } catch (e) { /* 무시 */ } } say('시간 끝', 5); showScreen(); }
function newGame() {
  state = 'play'; score = sheetN = combo = comboT = bestCombo = feverT = shake = hurt = bannerT = popped = tipT = 0; timeLeft = START_TIME;
  if (!auto) try { const h = JSON.parse(localStorage.getItem('echo_hub')) || {}, d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (h.days = h.days || {})[k] = 'pop'; (h.played = h.played || {}).pop = k; h.last = 'pop'; localStorage.setItem('echo_hub', JSON.stringify(h)); } catch (e) { /* 저장 못 해도 그냥 둠 */ }   // 홈에 체크인 한 번 기록
  sayUntil = 0; newSheet(); say('터뜨리기 시작', 2); showScreen();
}

// ---------- 매 프레임 ----------
function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').textContent = ''; }
  shake = Math.max(0, shake - dt * 3); hurt = Math.max(0, hurt - dt * 1.8);
  for (const b of bubs) { if (!b.on) b.t += dt; b.dent = Math.max(0, b.dent - dt * 4); }
  updateParticles(dt);
  if (state !== 'play') return;
  phaseT += dt; tipT += dt;
  if (phase === 'in') { sheetX = -24 * (1 - Math.min(1, phaseT / 0.35)) ** 2; if (phaseT >= 0.35) { phase = 'play'; sheetX = 0; } }
  else if (phase === 'out') { sheetX = 26 * (phaseT / 0.3) ** 2; if (phaseT >= 0.3) newSheet(); }
  else {
    timeLeft -= dt; if (feverT > 0) feverT -= dt;
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
    for (const w of waves) { const r0 = w.r; w.r += 22 * dt; for (const b of bubs) { if (!b.on) continue; const d = Math.hypot(b.x - w.x, b.z - w.z); if (d > r0 && d <= w.r && d <= w.max) pop(b, true); } }   // 연쇄: 바깥으로 한 겹씩 폭발
    waves = waves.filter((w) => w.r < w.max);
    if (auto) autoPlay(dt);
    if (left <= 0 && !waves.length) { const bonus = 50 + sheetN * 10, add = Math.max(1, 5 - sheetN * 0.35); score += bonus; timeLeft = Math.min(START_TIME + 5, timeLeft + add); phase = 'out'; phaseT = 0; sfx.done(); banner('다 터뜨림　+' + add.toFixed(1) + '초', 1); say(pick(['다 터뜨렸다', '다음 장']), 1); }
    else if (timeLeft <= 0) endGame();
  }
}
function autoPlay(dt) {                                            // 자동 플레이(테스트용): 가장 가까운 뽁뽁이로, 방귀는 피함
  let t = null, bd = 1e9; for (const b of bubs) if (b.on && b.k !== 'stink') { const d = (b.x - ptr.x) ** 2 + (b.z - ptr.z) ** 2; if (d < bd) { bd = d; t = b; } }
  if (!t) return; const dx = t.x - ptr.x, dz = t.z - ptr.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, 16 * dt), nx = ptr.x + dx / d * st, nz = ptr.z + dz / d * st, rr = (feverT > 0 ? 1.35 : 0.78) + 0.1;
  const risky = bubs.some((b) => b.on && b.k === 'stink' && (b.x - nx) ** 2 + (b.z - nz) ** 2 < rr * rr);
  if (!risky) { strokeId++; stroke(ptr.x, ptr.z, nx, nz); } ptr.x = nx; ptr.z = nz; ptr.has = true; ptr.down = !risky;
}
function draw() {
  const t = performance.now() / 1000; let n = 0, g = 0;
  sheet.position.set(sheetX, 0, 1.2);
  for (const b of bubs) {
    const d = KIND[b.k], s = (d.s || 1) * (b.hp > 1 ? 1 : b.k === 'tough' ? 0.92 : 1);
    if (b.on) {
      const pulse = b.k === 'gold' || b.k === 'chain' ? 1 + Math.sin(t * 6 + b.wob) * 0.06 : 1, sy = (1 - b.dent * 0.4) * (b.k === 'tough' && b.hp === 1 ? 0.7 : 1), wig = b.k === 'stink' ? Math.sin(t * 9 + b.wob) * 0.05 : 0;
      dummy.position.set(b.x + wig, 0.02, b.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s * pulse, s * sy * pulse, s * pulse); dummy.updateMatrix(); bubM.setMatrixAt(n, dummy.matrix);
      const c = bubM.instanceColor.array; c[n * 3] = d.col[0]; c[n * 3 + 1] = d.col[1]; c[n * 3 + 2] = d.col[2]; n++;
      dummy.position.set(b.x - 0.2 * s, 0.5 * s * sy, b.z - 0.2 * s); dummy.scale.setScalar(s); dummy.updateMatrix(); glintM.setMatrixAt(g++, dummy.matrix);
    } else {                                                        // 터진 것: 쭈글쭈글한 껍질로
      const k = Math.min(1, b.t / 0.08); dummy.position.set(b.x, 0.02, b.z); dummy.rotation.set(0, b.wob, 0); dummy.scale.set(s * (1 - k * 0.3), s * (1 - k * 0.92), s * (1 - k * 0.45)); dummy.updateMatrix(); bubM.setMatrixAt(n, dummy.matrix);
      const c = bubM.instanceColor.array; c[n * 3] = d.col[0] * 0.4; c[n * 3 + 1] = d.col[1] * 0.4; c[n * 3 + 2] = d.col[2] * 0.42; n++;
    }
  }
  bubM.count = n; bubM.instanceMatrix.needsUpdate = true; bubM.instanceColor.needsUpdate = true; glintM.count = g; glintM.instanceMatrix.needsUpdate = true;
  const on = state === 'play' && phase === 'play' && ptr.has; cursor.visible = on; if (on) { cursor.position.set(ptr.x, 0.9, ptr.z + 1.2); cursor.scale.setScalar((feverT > 0 ? 1.75 : 1) * (ptr.down ? 0.9 : 1.15)); cursor.material.opacity = ptr.down ? 0.95 : 0.5; }
  camera.position.set(CAM.x + rand(-1, 1) * shake * 0.35, CAM.y + rand(-1, 1) * shake * 0.3, CAM.z + rand(-1, 1) * shake * 0.3);
  hud(); composer.render();
}

// ---------- 입력: 포인터를 탁상 위로 투사 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35), hitV = new THREE.Vector3();
function locate(e) { const r = stage.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(ground, hitV)) return; ptr.x = hitV.x; ptr.z = hitV.z - 1.2; ptr.has = true; }
stage.addEventListener('pointerdown', (e) => { initAudio(); const a = e.target.closest && e.target.closest('[data-act]'); if (a && a.dataset.act === 'start') { newGame(); return; } if (state !== 'play' || auto) return; locate(e); ptr.down = true; ptr.lx = ptr.x; ptr.lz = ptr.z; strokeId++; if (phase === 'play') press(ptr.x, ptr.z); try { stage.setPointerCapture(e.pointerId); } catch (er) { /* 없어도 됨 */ } });
stage.addEventListener('pointermove', (e) => { if (state !== 'play' || auto) return; locate(e); if (ptr.down && phase === 'play') stroke(ptr.lx, ptr.lz, ptr.x, ptr.z); ptr.lx = ptr.x; ptr.lz = ptr.z; });
const up = () => { if (!auto) ptr.down = false; }; stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') muted = !muted; if ((e.code === 'Space' || e.code === 'Enter') && state !== 'play') { e.preventDefault(); initAudio(); newGame(); } });
addEventListener('resize', resize);

let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held) return; update(dt); draw(); }
resize(); showScreen(); requestAnimationFrame(frame);

// 디버그 입구
window.__pop = {
  step(sec, doDraw) { held = true; for (let t = 0; t < sec && state === 'play'; t += 1 / 60) update(1 / 60); if (doDraw) draw(); },
  hold(on) { held = on; }, start() { const a = auto; auto = true; newGame(); auto = a; }, draw, auto(on) { auto = on; }, fever() { feverT = 6; },
  get said() { return saidLog.slice(); }, get clips() { return Object.keys(clips).length; },
  get s() { return { state, phase, sheet: sheetN, score, timeLeft: +timeLeft.toFixed(1), left, popped, combo, bestCombo, bubs: bubs.length, stink: bubs.filter((b) => b.k === 'stink' && b.on).length }; },
};
