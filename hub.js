// 回声游戏厅首页：今日游戏、上新日历、全部游戏（搜索 / 筛选 / 排序）、我的记录。
// 游戏清单在 games.js；打卡记录由各个游戏在开局时写进 localStorage 的 echo_hub：
//   { days: { '2026-11-15': 'tide' }, played: { tide: '2026-11-15' }, last: 'tide' }
// 调试：地址后面加 ?date=2026-11-20 可以假装今天是那一天，看轮换和日历。
import { GAMES } from './games.js';

const $ = (id) => document.getElementById(id);
const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const dayNo = (k) => Math.round(parse(k).getTime() / 864e5);
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const label = (k) => { const d = parse(k); return WEEK[d.getDay()] + ' ' + d.getDate() + ' 日'; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const fake = new URLSearchParams(location.search).get('date');
const TODAY = fake && /^\d{4}-\d{2}-\d{2}$/.test(fake) ? fake : key(new Date());
const hub = (() => { try { return JSON.parse(localStorage.getItem('echo_hub')) || {}; } catch (e) { return {}; } })();
hub.days = hub.days || {}; hub.played = hub.played || {};

const byNo = [...GAMES].sort((a, b) => a.no - b.no);
const released = (k) => byNo.filter((g) => g.date <= k);
// 某一天的游戏：当天有新游戏上线就是它（同一天上了两个就取期数最新的）；否则在已上线的游戏里按天轮换；还没到的日子没有排期就返回 null
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
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6FE0A0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="已打卡"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>';
const meta = (g) => [...g.tags, g.screen, '约 ' + g.mins + ' 分钟'].join(' · ');

// ---------- 今日游戏 ----------
const today = gameOn(TODAY) || (byNo.length ? { g: byNo[0], fresh: false } : null);
function drawToday() {
  if (!today) { $('today').innerHTML = '<p class="empty" style="flex:1">第一个游戏还在路上。</p>'; return; }
  const g = today.g, rec = g.record(), done = hub.days[TODAY];
  $('today').innerHTML =
    '<a class="cover" href="' + g.url + '" aria-label="开始玩 ' + esc(g.name) + '"><img src="' + g.cover + '" alt="' + esc(g.name) + ' 实机画面" style="object-position:' + g.pos + '">' +
    '<span class="pills"><span class="pill hot">今日游戏</span><span class="pill">第 ' + g.no + ' 期' + (today.fresh ? ' · 今天上线' : ' · 重温') + '</span></span></a>' +
    '<div class="info"><div><p class="kicker">每天一个小游戏</p><h1>' + esc(g.name) + '</h1></div><p class="intro">' + esc(g.intro) + '</p>' +
    '<div class="tags">' + [...g.tags, g.screen, g.more, '一局约 ' + g.mins + ' 分钟'].filter(Boolean).map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>' +
    '<div class="cta"><a class="play" href="' + g.url + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="#1A1405" aria-hidden="true"><path d="M7 4.500v15l13-7.500z"/></svg>' + (hub.played[g.id] ? '继续' : '开始') + '</a></div>' +
    '<p class="rec">' + [rec && '你的' + rec, done ? '今天已打卡' : '今天还没玩'].filter(Boolean).join('　·　') + '</p></div>';
}

// ---------- 上新日历：从前天到往后四天，共七天 ----------
function drawDays() {
  const first = byNo.length ? byNo[0].date : TODAY; let start = shift(TODAY, -2); if (start < first) start = first;
  let html = '';
  for (let i = 0; i < 7; i++) {
    const k = shift(start, i), on = gameOn(k), now = k === TODAY;
    if (on && k <= TODAY) html += '<a class="day' + (now ? ' now' : '') + '" href="' + on.g.url + '"><span class="when">' + label(k) + (now ? '<span>今天</span>' : hub.days[k] ? CHECK : '') + '</span><img src="' + on.g.cover + '" alt="" style="object-position:' + on.g.pos + '"><b>' + esc(on.g.name) + '</b></a>';
    else html += '<div class="day soon"><span class="when">' + label(k) + '</span><span class="lock">' + LOCK + '</span><b>' + (on ? '第 ' + on.g.no + ' 期 · 新游戏' : '敬请期待') + '</b></div>';
  }
  $('days').innerHTML = html;
}

// ---------- 全部游戏 ----------
const view = { q: '', tag: '全部', sort: 'new' };
const TAGS = ['全部', ...new Set(released(TODAY).flatMap((g) => [...g.tags, g.screen])), '没玩过的'];
function drawChips() { $('chips').innerHTML = TAGS.map((t) => '<button type="button" aria-pressed="' + (t === view.tag) + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>').join(''); }
function drawGrid() {
  const q = view.q.trim().toLowerCase(), all = released(TODAY);
  let list = all.filter((g) => (view.tag === '全部' || (view.tag === '没玩过的' ? !hub.played[g.id] : g.tags.includes(view.tag) || g.screen === view.tag)) &&
    (!q || (g.name + ' ' + g.tags.join(' ') + ' ' + g.screen + ' ' + g.intro).toLowerCase().includes(q)));
  if (view.sort === 'new') list.sort((a, b) => b.no - a.no);
  else if (view.sort === 'short') list.sort((a, b) => a.mins - b.mins);
  else list.sort((a, b) => (hub.played[b.id] || '').localeCompare(hub.played[a.id] || '') || b.no - a.no);
  $('count').textContent = (list.length === all.length ? all.length : list.length + ' / ' + all.length) + ' 个';
  let html = list.map((g) => {
    const rec = g.record(), isToday = today && today.g === g, played = hub.played[g.id];
    return '<a class="card" href="' + g.url + '"><div class="pic"><img src="' + g.cover + '" alt="' + esc(g.name) + ' 实机画面" loading="lazy" style="object-position:' + g.pos + '">' +
      (isToday ? '<span class="badge hot">今日</span>' : played ? '<span class="badge">玩过</span>' : '') + '</div>' +
      '<div class="body"><div class="t"><h3>' + esc(g.name) + '</h3><span class="no">第 ' + g.no + ' 期</span></div><p class="meta">' + esc(meta(g)) + '</p>' +
      '<div class="foot"><span>' + (rec || '还没玩过') + '</span><span class="btn' + (played ? ' again' : '') + '">' + (played ? '继续' : '开始') + '</span></div></div></a>';
  }).join('');
  if (!list.length) html = '<p class="empty">没有找到符合的游戏，换个关键词或筛选试试。</p>';
  else if (view.tag === '全部' && !q) {                                // 末尾放一张「下一期」的预告卡
    const next = byNo.find((g) => g.date > TODAY);
    html += '<div class="card soon"><span class="lock">' + LOCK + '</span><div class="body"><div class="t"><h3>' + (next ? '即将上线' : '下一期') + '</h3><span class="no">第 ' + (next ? next.no : byNo.length + 1) + ' 期</span></div>' +
      '<p class="meta">' + (next ? label(next.date) + ' 上线' : '新游戏制作中，敬请期待') + '</p></div></div>';
  }
  $('grid').innerHTML = html;
}

// ---------- 我的记录 ----------
function drawMe() {
  const n = streak(), all = released(TODAY), played = all.filter((g) => hub.played[g.id]).length, last = GAMES.find((g) => g.id === hub.last);
  $('streak').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFD66E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.500.500-2.500 1.500-3.500C9.500 10 12 8 12 3z"/><path d="M6 14a6 6 0 0 0 12 0"/></svg>' + (n ? '连续 ' + n + ' 天' : '今天开始打卡');
  $('stats').innerHTML =
    '<div class="stat"><p>连续打卡</p><p class="n gold">' + n + ' <small>天</small></p></div>' +
    '<div class="stat"><p>玩过的游戏</p><p class="n">' + played + ' <small>/ ' + all.length + ' 个</small></p></div>' +
    '<div class="stat"><p>上次玩的</p>' + (last ? '<p class="n s">' + esc(last.name) + '</p><a href="' + last.url + '">接着玩</a>' : '<p class="n s">还没开始</p><a href="#today">从今日游戏开始</a>') + '</div>';
}

$('q').addEventListener('input', (e) => { view.q = e.target.value; drawGrid(); if (view.q) $('games').scrollIntoView({ block: 'nearest' }); });
$('sort').addEventListener('change', (e) => { view.sort = e.target.value; drawGrid(); });
$('chips').addEventListener('click', (e) => { const b = e.target.closest('[data-tag]'); if (!b) return; view.tag = b.dataset.tag; drawChips(); drawGrid(); });
// 滚到哪一段，顶栏就点亮哪一项
const links = [...document.querySelectorAll('nav a')];
const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }, { rootMargin: '-45% 0px -50% 0px' });
for (const id of ['today', 'week', 'games', 'me']) io.observe($(id));
// 从游戏里返回时（包括浏览器的后退缓存）重新读一遍记录
addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

drawToday(); drawDays(); drawChips(); drawGrid(); drawMe();
