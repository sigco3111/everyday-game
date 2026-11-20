// 메아리 게임장 홈: 오늘의 게임, 신작 캘린더, 전체 게임(검색/필터/정렬), 내 기록.
// 게임 목록은 games.js 에 있고, 체크인 기록은 각 게임이 시작할 때 localStorage 의 echo_hub 에 기록:
//   { days: { '2026-11-15': 'tide' }, played: { tide: '2026-11-15' }, last: 'tide' }
// 디버그: 주소 뒤에 ?date=2026-11-20 을 붙이면 그날인 척해서 로테이션과 캘린더를 볼 수 있음.
import { GAMES } from './games.js';

const $ = (id) => document.getElementById(id);
const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const dayNo = (k) => Math.round(parse(k).getTime() / 864e5);
const WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const label = (k) => { const d = parse(k); return WEEK[d.getDay()] + ' ' + d.getDate() + '일'; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const fake = new URLSearchParams(location.search).get('date');
const TODAY = fake && /^\d{4}-\d{2}-\d{2}$/.test(fake) ? fake : key(new Date());
const hub = (() => { try { return JSON.parse(localStorage.getItem('echo_hub')) || {}; } catch (e) { return {}; } })();
hub.days = hub.days || {}; hub.played = hub.played || {};

const byNo = [...GAMES].sort((a, b) => a.no - b.no);
const released = (k) => byNo.filter((g) => g.date <= k);
// 어떤 날의 게임: 당일 신작이 있으면 그것(같은 날 두 개면 기수가 최신인 것); 아니면 공개된 게임을 날짜별 로테이션; 아직 오지 않은 날은 일정이 없으면 null
function gameOn(k) {
  const fresh = byNo.findLast((g) => g.date === k); if (fresh) return { g: fresh, fresh: true };
  if (k > TODAY) return null;
  const pool = released(k); return pool.length ? { g: pool[dayNo(k) % pool.length], fresh: false } : null;
}
function streak() {
  let k = hub.days[TODAY] ? TODAY : shift(TODAY, -1), n = 0;
  while (hub.days[k]) { n++; k = shift(k, -1); }
  return n;
}
const LOCK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA7BD" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6FE0A0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="체크인 완료"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>';
const meta = (g) => [...g.tags, g.screen, '약 ' + g.mins + '분'].join(' · ');

// ---------- 오늘의 게임 ----------
const today = gameOn(TODAY) || (byNo.length ? { g: byNo[0], fresh: false } : null);
function drawToday() {
  if (!today) { $('today').innerHTML = '<p class="empty" style="flex:1">첫 게임이 아직 오는 중입니다.</p>'; return; }
  const g = today.g, rec = g.record(), done = hub.days[TODAY];
  $('today').innerHTML =
    '<a class="cover" href="' + g.url + '" aria-label="플레이: ' + esc(g.name) + '"><img src="' + g.cover + '" alt="' + esc(g.name) + ' 실기 화면" style="object-position:' + g.pos + '">' +
    '<span class="pills"><span class="pill hot">오늘의 게임</span><span class="pill">제 ' + g.no + ' 기' + (today.fresh ? ' · 오늘 공개' : ' · 다시 보기') + '</span></span></a>' +
    '<div class="info"><div><p class="kicker">매일 미니게임 하나</p><h1>' + esc(g.name) + '</h1></div><p class="intro">' + esc(g.intro) + '</p>' +
    '<div class="tags">' + [...g.tags, g.screen, g.more, '한 판 약 ' + g.mins + '분'].filter(Boolean).map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>' +
    '<div class="cta"><a class="play" href="' + g.url + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="#1A1405" aria-hidden="true"><path d="M7 4.500v15l13-7.500z"/></svg>' + (hub.played[g.id] ? '이어하기' : '시작') + '</a></div>' +
    '<p class="rec">' + [rec && rec, done ? '오늘 체크인 완료' : '오늘 아직 안 함'].filter(Boolean).join('　·　') + '</p></div>';
}

// ---------- 신작 캘린더: 그제부터 4일 뒤까지 총 7일 ----------
function drawDays() {
  const first = byNo.length ? byNo[0].date : TODAY; let start = shift(TODAY, -2); if (start < first) start = first;
  let html = '';
  for (let i = 0; i < 7; i++) {
    const k = shift(start, i), on = gameOn(k), now = k === TODAY;
    if (on && k <= TODAY) html += '<a class="day' + (now ? ' now' : '') + '" href="' + on.g.url + '"><span class="when">' + label(k) + (now ? '<span>오늘</span>' : hub.days[k] ? CHECK : '') + '</span><img src="' + on.g.cover + '" alt="" style="object-position:' + on.g.pos + '"><b>' + esc(on.g.name) + '</b></a>';
    else html += '<div class="day soon"><span class="when">' + label(k) + '</span><span class="lock">' + LOCK + '</span><b>' + (on ? '제 ' + on.g.no + ' 기 · 새 게임' : '기대해 주세요') + '</b></div>';
  }
  $('days').innerHTML = html;
}

// ---------- 전체 게임 ----------
const view = { q: '', tag: '전체', sort: 'new' };
const TAGS = ['전체', ...new Set(released(TODAY).flatMap((g) => [...g.tags, g.screen])), '안 해 본'];
function drawChips() { $('chips').innerHTML = TAGS.map((t) => '<button type="button" aria-pressed="' + (t === view.tag) + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>').join(''); }
function drawGrid() {
  const q = view.q.trim().toLowerCase(), all = released(TODAY);
  let list = all.filter((g) => (view.tag === '전체' || (view.tag === '안 해 본' ? !hub.played[g.id] : g.tags.includes(view.tag) || g.screen === view.tag)) &&
    (!q || (g.name + ' ' + g.tags.join(' ') + ' ' + g.screen + ' ' + g.intro).toLowerCase().includes(q)));
  if (view.sort === 'new') list.sort((a, b) => b.no - a.no);
  else if (view.sort === 'short') list.sort((a, b) => a.mins - b.mins);
  else list.sort((a, b) => (hub.played[b.id] || '').localeCompare(hub.played[a.id] || '') || b.no - a.no);
  $('count').textContent = (list.length === all.length ? all.length : list.length + ' / ' + all.length) + ' 개';
  let html = list.map((g) => {
    const rec = g.record(), isToday = today && today.g === g, played = hub.played[g.id];
    return '<a class="card" href="' + g.url + '"><div class="pic"><img src="' + g.cover + '" alt="' + esc(g.name) + ' 실기 화면" loading="lazy" style="object-position:' + g.pos + '">' +
      (isToday ? '<span class="badge hot">오늘</span>' : played ? '<span class="badge">플레이함</span>' : '') + '</div>' +
      '<div class="body"><div class="t"><h3>' + esc(g.name) + '</h3><span class="no">제 ' + g.no + ' 기</span></div><p class="meta">' + esc(meta(g)) + '</p>' +
      '<div class="foot"><span>' + (rec || '아직 안 해 봄') + '</span><span class="btn' + (played ? ' again' : '') + '">' + (played ? '이어하기' : '시작') + '</span></div></div></a>';
  }).join('');
  if (!list.length) html = '<p class="empty">조건에 맞는 게임이 없습니다. 다른 키워드나 필터를 써 보세요.</p>';
  else if (view.tag === '전체' && !q) {                                // 끝에 「다음 기획」 예고 카드를 하나 둠
    const next = byNo.find((g) => g.date > TODAY);
    html += '<div class="card soon"><span class="lock">' + LOCK + '</span><div class="body"><div class="t"><h3>' + (next ? '곧 공개' : '다음 기획') + '</h3><span class="no">제 ' + (next ? next.no : byNo.length + 1) + ' 기</span></div>' +
      '<p class="meta">' + (next ? label(next.date) + ' 공개' : '새 게임 제작 중입니다. 기대해 주세요') + '</p></div></div>';
  }
  $('grid').innerHTML = html;
}

// ---------- 내 기록 ----------
function drawMe() {
  const n = streak(), all = released(TODAY), played = all.filter((g) => hub.played[g.id]).length, last = GAMES.find((g) => g.id === hub.last);
  $('streak').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFD66E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.500.500-2.500 1.500-3.500C9.500 10 12 8 12 3z"/><path d="M6 14a6 6 0 0 0 12 0"/></svg>' + (n ? '연속 ' + n + '일' : '오늘부터 체크인');
  $('stats').innerHTML =
    '<div class="stat"><p>연속 체크인</p><p class="n gold">' + n + ' <small>일</small></p></div>' +
    '<div class="stat"><p>플레이한 게임</p><p class="n">' + played + ' <small>/ ' + all.length + ' 개</small></p></div>' +
    '<div class="stat"><p>마지막으로 한 게임</p>' + (last ? '<p class="n s">' + esc(last.name) + '</p><a href="' + last.url + '">이어하기</a>' : '<p class="n s">아직 시작 전</p><a href="#today">오늘의 게임으로 시작</a>') + '</div>';
}

$('q').addEventListener('input', (e) => { view.q = e.target.value; drawGrid(); if (view.q) $('games').scrollIntoView({ block: 'nearest' }); });
$('sort').addEventListener('change', (e) => { view.sort = e.target.value; drawGrid(); });
$('chips').addEventListener('click', (e) => { const b = e.target.closest('[data-tag]'); if (!b) return; view.tag = b.dataset.tag; drawChips(); drawGrid(); });
// 어느 구간으로 스크롤했는지에 따라 상단 바 항목을 밝힘
const links = [...document.querySelectorAll('nav a')];
const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }, { rootMargin: '-45% 0px -50% 0px' });
for (const id of ['today', 'week', 'games', 'me']) io.observe($(id));
// 게임에서 돌아올 때(브라우저 뒤로가기 캐시 포함) 기록을 다시 읽음
addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

drawToday(); drawDays(); drawChips(); drawGrid(); drawMe();
