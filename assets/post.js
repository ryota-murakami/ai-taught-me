/* post page: renders posts/<slug>.md as a chat snapshot */
(function () {
  'use strict';
  var A = window.AITM, esc = A.esc;

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status'), chat = $('chat'), article = $('post');
  var slug = new URLSearchParams(location.search).get('slug') || '';

  function fail(msg) {
    statusEl.innerHTML = esc(msg) + '<br><a href="./">一覧へ戻る</a>';
    article.setAttribute('aria-busy', 'false');
  }

  if (!/^[\w.-]+$/.test(slug) || slug.indexOf('..') !== -1) {
    fail('記事が見つかりませんでした。');
    return;
  }

  var indexReq = fetch('posts/index.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : { posts: [] }; })
    .catch(function () { return { posts: [] }; });
  var mdReq = fetch('posts/' + encodeURIComponent(slug) + '.md', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? '記事が見つかりませんでした。' : 'HTTP ' + r.status); return r.text(); });

  Promise.all([indexReq, mdReq]).then(function (res) {
    var entry = (res[0].posts || []).filter(function (p) { return p.slug === slug; })[0] || {};
    var parsed = A.parsePost(res[1]);
    var fm = parsed.meta, msgs = parsed.messages;

    var title = fm.title || entry.title || slug;
    var date = fm.date || entry.date || '';
    var tags = (Array.isArray(fm.tags) ? fm.tags : null) || entry.tags || [];
    var summary = fm.summary || entry.summary || '';
    var note = entry.note || fm.note || '';
    var ai = entry.ai || fm.ai || '';

    document.title = title + ' | AIに教えてもらった';
    var desc = document.querySelector('meta[name="description"]');
    if (desc && summary) desc.setAttribute('content', summary);

    $('post-title').textContent = title;
    $('post-date').textContent = A.formatDate(date);
    $('post-date').setAttribute('datetime', date);
    $('post-count').textContent = msgs.length + ' メッセージ';
    $('post-tags').innerHTML = tags.map(function (t) {
      return '<li><a class="tag" href="./?tag=' + encodeURIComponent(t) + '">#' + esc(t) + '</a></li>';
    }).join('');
    $('post-summary').textContent = summary;
    $('post-summary').hidden = !summary;
    $('post-note').textContent = note ? '※ ' + note : '';
    $('post-note').hidden = !note;
    if (ai) $('ai-credit').textContent = 'この会話の AI：' + ai;

    var html = date ? '<div class="chat-day">' + esc(A.formatDate(date)) + '</div>' : '';
    var lastUser = 'Ryota Murakami';
    msgs.forEach(function (m, i) {
      var id = 'm' + (i + 1);
      var time = A.formatTime(m.time);
      var timeHtml = time ? '<time datetime="' + esc(m.time) + '">' + time + '</time>' : '';
      var body = A.renderMarkdown(m.markdown);
      if (m.role === 'user') {
        lastUser = m.author;
        html += '<div class="msg msg-user" id="' + id + '">' +
          '<div class="bubble md">' + body + '</div>' +
          '<div class="msg-meta"><span class="author">' + esc(m.author) + '</span>' + timeHtml + '</div></div>';
      } else {
        html += '<div class="msg msg-assistant" id="' + id + '">' +
          '<div class="reply-to">Replying to <b>' + esc(lastUser) + '</b></div>' +
          '<div class="msg-row"><span class="avatar avatar-lg" title="' + esc(m.author) + '">' + A.ROBOT_SVG + '</span>' +
          '<div class="msg-main"><div class="md">' + body + '</div>' +
          '<div class="msg-meta"><span class="author">' + esc(m.author) + '</span>' + timeHtml + '</div></div></div></div>';
      }
    });

    chat.innerHTML = html;
    chat.hidden = false;
    $('post-header').hidden = false;
    statusEl.hidden = true;
    article.setAttribute('aria-busy', 'false');
    A.enhance(chat);

    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }).catch(function (err) {
    fail(err.message || '読み込みに失敗しました。');
  });
})();
