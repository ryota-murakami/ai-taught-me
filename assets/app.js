/* index page: post list + mock calendar + tag search (all client-side, from posts/index.json) */
(function () {
  'use strict';
  var A = window.AITM, esc = A.esc;

  var CHAT_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  var els = {
    list: document.getElementById('post-list'),
    empty: document.getElementById('empty'),
    count: document.getElementById('result-count'),
    active: document.getElementById('active-filters'),
    search: document.getElementById('search'),
    cloud: document.getElementById('tag-cloud'),
    calTitle: document.getElementById('cal-title'),
    calGrid: document.getElementById('cal-grid'),
    calPrev: document.getElementById('cal-prev'),
    calNext: document.getElementById('cal-next')
  };

  var params = new URLSearchParams(location.search);
  var today = new Date();
  var state = {
    posts: [],
    q: params.get('q') || '',
    tags: params.getAll('tag').filter(Boolean),
    date: /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : null,
    year: today.getFullYear(),
    month: today.getMonth() // the mock calendar opens on the current month
  };
  if (state.date) {
    state.year = +state.date.slice(0, 4);
    state.month = +state.date.slice(5, 7) - 1;
  }
  els.search.value = state.q;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayStr() { return ymd(today.getFullYear(), today.getMonth(), today.getDate()); }

  function matches(p) {
    if (state.date && p.date !== state.date) return false;
    for (var i = 0; i < state.tags.length; i++) if ((p.tags || []).indexOf(state.tags[i]) === -1) return false;
    var q = state.q.trim().toLowerCase();
    if (q) {
      var hay = [p.title, p.summary, (p.tags || []).join(' '), p.date].join(' ').toLowerCase();
      var words = q.split(/\s+/);
      for (var j = 0; j < words.length; j++) {
        var w = words[j].replace(/^#/, '');
        if (w && hay.indexOf(w) === -1) return false;
      }
    }
    return true;
  }

  function tagButton(t, extraClass) {
    var on = state.tags.indexOf(t) !== -1;
    return '<button type="button" class="tag' + (on ? ' is-active' : '') + (extraClass || '') + '" data-tag="' + esc(t) +
      '" aria-pressed="' + on + '">#' + esc(t) + '</button>';
  }

  function renderList(list) {
    els.list.innerHTML = list.map(function (p) {
      var href = 'post.html?slug=' + encodeURIComponent(p.slug);
      return '<li class="post-card">' +
        '<div class="card-meta"><time datetime="' + esc(p.date) + '">' + esc(A.formatDate(p.date)) + '</time></div>' +
        '<h3><a href="' + href + '">' + esc(p.title) + '</a></h3>' +
        '<p class="summary">' + esc(p.summary || '') + '</p>' +
        '<div class="card-foot"><ul class="tags">' +
        (p.tags || []).map(function (t) { return '<li>' + tagButton(t) + '</li>'; }).join('') +
        '</ul><span class="msg-count">' + CHAT_ICON + (p.messageCount != null ? esc(p.messageCount) + ' メッセージ' : '') + '</span></div>' +
        '</li>';
    }).join('');
    els.empty.hidden = list.length > 0;
    els.count.textContent = list.length + ' / ' + state.posts.length + ' 件';
  }

  function renderActive() {
    var pills = [];
    if (state.date) pills.push(pill('📅 ' + A.formatDate(state.date), 'date', ''));
    state.tags.forEach(function (t) { pills.push(pill('#' + t, 'tag', t)); });
    if (state.q.trim()) pills.push(pill('「' + state.q.trim() + '」', 'q', ''));
    els.active.hidden = pills.length === 0;
    els.active.innerHTML = pills.length
      ? '<span>絞り込み中：</span>' + pills.join('') + '<button type="button" class="link-btn" data-clear-all>すべて解除</button>'
      : '';
  }
  function pill(label, kind, value) {
    return '<span class="filter-pill">' + esc(label) +
      '<button type="button" data-clear="' + kind + '" data-value="' + esc(value) + '" aria-label="' + esc(label) + ' を解除">×</button></span>';
  }

  function renderCloud() {
    var counts = {};
    state.posts.forEach(function (p) { (p.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, 'ja'); });
    var q = state.q.trim().toLowerCase().replace(/^#/, '');
    els.cloud.innerHTML = tags.map(function (t) {
      var dim = q && t.toLowerCase().indexOf(q) === -1 && state.tags.indexOf(t) === -1;
      return '<li' + (dim ? ' style="opacity:.45"' : '') + '>' + tagButton(t) + '</li>';
    }).join('');
  }

  function renderCalendar() {
    var y = state.year, m = state.month;
    var byDay = {};
    state.posts.forEach(function (p) { byDay[p.date] = (byDay[p.date] || 0) + 1; });
    els.calTitle.textContent = y + '年' + (m + 1) + '月';
    var html = WEEK.map(function (w, i) {
      return '<span class="cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</span>';
    }).join('');
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < first; i++) html += '<span class="cal-day is-out" aria-hidden="true"></span>';
    var t = todayStr();
    for (var d = 1; d <= days; d++) {
      var key = ymd(y, m, d);
      var cls = 'cal-day' + (key === t ? ' is-today' : '');
      if (byDay[key]) {
        var sel = state.date === key;
        html += '<button type="button" class="' + cls + ' has-post' + (sel ? ' is-selected' : '') + '" data-date="' + key +
          '" aria-pressed="' + sel + '" aria-label="' + (m + 1) + '月' + d + '日 ' + byDay[key] + '件の会話">' + d + '</button>';
      } else {
        html += '<span class="' + cls + '">' + d + '</span>';
      }
    }
    els.calGrid.innerHTML = html;
  }

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    state.tags.forEach(function (t) { p.append('tag', t); });
    if (state.date) p.set('date', state.date);
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function render() {
    renderList(state.posts.filter(matches));
    renderActive();
    renderCloud();
    renderCalendar();
    syncUrl();
  }

  function toggleTag(t) {
    var i = state.tags.indexOf(t);
    if (i === -1) state.tags.push(t); else state.tags.splice(i, 1);
    render();
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-tag],[data-date],[data-clear],[data-clear-all]') : null;
    if (!el) return;
    if (el.hasAttribute('data-tag')) { ev.preventDefault(); toggleTag(el.getAttribute('data-tag')); return; }
    if (el.hasAttribute('data-date')) {
      var d = el.getAttribute('data-date');
      state.date = state.date === d ? null : d;
      render();
      return;
    }
    if (el.hasAttribute('data-clear-all')) {
      state.date = null; state.tags = []; state.q = ''; els.search.value = '';
      render();
      return;
    }
    var kind = el.getAttribute('data-clear');
    if (kind === 'date') state.date = null;
    else if (kind === 'tag') toggleTag(el.getAttribute('data-value'));
    else if (kind === 'q') { state.q = ''; els.search.value = ''; }
    render();
  });

  els.search.addEventListener('input', function () { state.q = els.search.value; render(); });
  els.calPrev.addEventListener('click', function () {
    state.month--; if (state.month < 0) { state.month = 11; state.year--; } renderCalendar();
  });
  els.calNext.addEventListener('click', function () {
    state.month++; if (state.month > 11) { state.month = 0; state.year++; } renderCalendar();
  });

  fetch('posts/index.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      state.posts = (data.posts || []).slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
      render();
    })
    .catch(function (err) {
      els.empty.hidden = false;
      els.empty.textContent = '記事一覧を読み込めませんでした（' + err.message + '）';
    });
})();
