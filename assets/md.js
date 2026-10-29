/*
 * md.js — tiny, dependency-free helpers for "AIに教えてもらった".
 *  - AITM.renderMarkdown(src): a small Markdown renderer (HTML is always escaped)
 *  - AITM.parsePost(text):     front matter + <!-- message ... --> blocks
 *  - AITM.enhance(root):       wires up the copy buttons on code blocks
 */
(function (global) {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  // Only allow safe link targets. Relative URLs are fine; schemes must be http(s)/mailto.
  function safeUrl(url) {
    var u = String(url).trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^(https?|mailto):/i.test(u)) return null;
    return u;
  }

  /* ------------------------------------------------------------------ */
  /* Inline                                                              */
  /* ------------------------------------------------------------------ */
  function inline(src) {
    var slots = [];
    function hold(html) { return '\u0000' + (slots.push(html) - 1) + '\u0000'; }

    var s = String(src).replace(/\u0000/g, '');

    // code spans — taken out first so nothing inside them is touched
    s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (_, ticks, code) {
      var c = code.length > 2 && code[0] === ' ' && code[code.length - 1] === ' ' ? code.slice(1, -1) : code;
      return hold('<code>' + esc(c) + '</code>');
    });

    // [text](url)
    s = s.replace(/\[([^\]\n]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g, function (m, text, url) {
      var u = safeUrl(url);
      if (u == null) return m;
      return hold('<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + inline(text) + '</a>');
    });

    // bare URLs
    s = s.replace(/https?:\/\/[^\s<>()\[\]「」『』、。，．！？]*[^\s<>()\[\]「」『』、。，．！？.,:;!?'"]/g, function (url) {
      return hold('<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>');
    });

    s = esc(s);

    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>');

    for (var guard = 0; guard < 5 && s.indexOf('\u0000') !== -1; guard++) {
      s = s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return slots[+n]; });
    }
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Syntax highlighting (ts / js family, plus a little bash & json)     */
  /* ------------------------------------------------------------------ */
  var KEYWORDS = toSet('const let var function return if else for while do switch case break continue new class ' +
    'extends implements interface type enum import export from default as async await yield try catch finally ' +
    'throw typeof instanceof in of void delete this super null undefined true false public private protected ' +
    'readonly static abstract declare namespace keyof infer is satisfies get set');
  var TYPES = toSet('number string boolean any unknown never object symbol bigint Array Promise Record Partial ' +
    'Readonly Map Set Date Error');
  function toSet(str) { var o = {}; str.split(' ').forEach(function (w) { o[w] = true; }); return o; }

  var TS_TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`)|(\b(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b)|([A-Za-z_$][\w$]*)/g;

  function span(cls, text) { return '<span class="tok-' + cls + '">' + esc(text) + '</span>'; }

  function highlightTS(code) {
    var out = '', last = 0, m;
    TS_TOKEN.lastIndex = 0;
    while ((m = TS_TOKEN.exec(code))) {
      out += esc(code.slice(last, m.index));
      last = TS_TOKEN.lastIndex;
      if (m[1]) out += span('comment', m[1]);
      else if (m[2]) out += span('string', m[2]);
      else if (m[3]) out += span('number', m[3]);
      else {
        var w = m[4];
        if (KEYWORDS[w]) out += span('keyword', w);
        else if (TYPES[w] || /^[A-Z]/.test(w)) out += span('type', w);
        else if (/^\s*(?:<[^>()]*>)?\s*\(/.test(code.slice(last))) out += span('fn', w);
        else out += esc(w);
      }
    }
    return out + esc(code.slice(last));
  }

  function highlightSimple(code, re) {
    var out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      out += esc(code.slice(last, m.index));
      last = re.lastIndex;
      if (m[1]) out += span('comment', m[1]);
      else if (m[2]) out += span('string', m[2]);
      else if (m[3]) out += span('number', m[3]);
      else out += esc(m[0]);
    }
    return out + esc(code.slice(last));
  }

  function highlight(code, lang) {
    var l = (lang || '').toLowerCase();
    if (/^(ts|tsx|typescript|js|jsx|javascript|mjs|cjs)$/.test(l)) return highlightTS(code);
    if (/^(sh|bash|zsh|fish|shell|console)$/.test(l)) return highlightSimple(code, /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'[^']*')/g);
    if (/^(json|jsonc)$/.test(l)) return highlightSimple(code, /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g);
    return esc(code);
  }

  var COPY_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 3.6V3.2c0-.9-.7-1.6-1.6-1.6H3.2c-.9 0-1.6.7-1.6 1.6v5.7c0 .9.7 1.6 1.6 1.6h.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

  function codeBlock(lang, code) {
    var label = lang || 'text';
    return '<div class="codeblock">' +
      '<div class="codeblock-head"><span class="codeblock-lang">' + esc(label) + '</span>' +
      '<button type="button" class="copy-btn" data-copy aria-label="コードをコピー">' + COPY_ICON +
      '<span class="copy-label">Copy</span></button></div>' +
      '<pre><code class="lang-' + esc(label) + '">' + highlight(code, lang) + '</code></pre></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Blocks                                                              */
  /* ------------------------------------------------------------------ */
  var RE = {
    fence: /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/,
    heading: /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/,
    hr: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
    item: /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/,
    emptyItem: /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]*$/,
    quote: /^ {0,3}>[ \t]?(.*)$/,
    tableSep: /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
    blank: /^[ \t]*$/
  };

  function indentOf(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      if (s[i] === ' ') n++;
      else if (s[i] === '\t') n += 4 - (n % 4);
      else break;
    }
    return n;
  }
  function dedent(s, n) {
    var i = 0, col = 0;
    while (i < s.length && col < n && (s[i] === ' ' || s[i] === '\t')) {
      col += s[i] === '\t' ? 4 - (col % 4) : 1;
      i++;
    }
    return s.slice(i);
  }

  function matchItem(line) {
    if (RE.hr.test(line)) return null;
    var m = RE.item.exec(line);
    var e = m ? null : RE.emptyItem.exec(line);
    if (!m && !e) return null;
    var marker = (m || e)[2];
    var ordered = /\d/.test(marker);
    var indent = indentOf((m || e)[1]);
    var gap = m ? Math.min(m[3].length, 4) : 1;
    return {
      indent: indent,
      ordered: ordered,
      start: ordered ? parseInt(marker, 10) : 1,
      text: m ? m[4] : '',
      contentIndent: indent + marker.length + gap
    };
  }

  function isTableStart(lines, i) {
    return i + 1 < lines.length && lines[i].indexOf('|') !== -1 &&
      RE.tableSep.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1;
  }

  function startsBlock(lines, i) {
    var l = lines[i];
    return RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) || RE.quote.test(l) ||
      !!matchItem(l) || isTableStart(lines, i);
  }

  function splitRow(line) {
    var s = line.trim();
    if (s[0] === '|') s = s.slice(1);
    if (s[s.length - 1] === '|' && s[s.length - 2] !== '\\') s = s.slice(0, -1);
    var cells = [], cur = '', inCode = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (c === '`') inCode = !inCode;
      if (c === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur.trim());
    return cells;
  }

  function renderTable(header, sep, rows) {
    var aligns = splitRow(sep).map(function (c) {
      var l = c[0] === ':', r = c[c.length - 1] === ':';
      return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
    });
    function cell(tag, text, idx) {
      var a = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : '';
      return '<' + tag + a + '>' + inline(text || '') + '</' + tag + '>';
    }
    var head = splitRow(header);
    var html = '<div class="table-wrap"><table><thead><tr>';
    head.forEach(function (h, i) { html += cell('th', h, i); });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var cells = splitRow(r);
      html += '<tr>';
      for (var i = 0; i < head.length; i++) html += cell('td', cells[i], i);
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function parseList(lines, i) {
    var first = matchItem(lines[i]);
    var base = first.indent, ordered = first.ordered;
    var items = [], cur = null, loose = false;

    while (i < lines.length) {
      var line = lines[i];
      var m = matchItem(line);

      if (m && m.indent <= base + 1 && m.indent >= base - 1) {
        if (m.ordered !== ordered) break;
        cur = { lines: [m.text], contentIndent: m.contentIndent };
        items.push(cur);
        i++;
        continue;
      }
      if (RE.blank.test(line)) {
        var j = i + 1;
        while (j < lines.length && RE.blank.test(lines[j])) j++;
        if (j >= lines.length) { i = j; break; }
        var nm = matchItem(lines[j]);
        if (nm && nm.indent <= base + 1 && nm.indent >= base - 1 && nm.ordered === ordered) { loose = true; i = j; continue; }
        if (indentOf(lines[j]) >= cur.contentIndent) {
          for (var k = i; k < j; k++) cur.lines.push('');
          i = j;
          continue;
        }
        break;
      }
      var ind = indentOf(line);
      if (ind > base + 1) {
        cur.lines.push(dedent(line, Math.min(ind, cur.contentIndent)));
        i++;
        continue;
      }
      // lazy continuation of the item's paragraph
      if (!startsBlock(lines, i) && cur.lines.length && !RE.blank.test(cur.lines[cur.lines.length - 1])) {
        cur.lines.push(line);
        i++;
        continue;
      }
      break;
    }

    var tag = ordered ? 'ol' : 'ul';
    var startAttr = ordered && first.start !== 1 ? ' start="' + first.start + '"' : '';
    var html = '<' + tag + startAttr + '>';
    items.forEach(function (it) {
      html += '<li>' + renderBlocks(it.lines, !loose) + '</li>';
    });
    html += '</' + tag + '>';
    return { html: html, next: i };
  }

  function renderBlocks(lines, tight) {
    var out = [], i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var m;

      if (RE.blank.test(line)) { i++; continue; }

      if ((m = RE.fence.exec(line))) {
        var fence = m[1], lang = m[2] || '';
        var fenceIndent = indentOf(line);
        var close = new RegExp('^ {0,3}' + (fence[0] === '~' ? '~' : '`') + '{' + fence.length + ',}\\s*$');
        var body = [];
        i++;
        while (i < lines.length) {
          if (close.test(lines[i])) { i++; break; }
          body.push(dedent(lines[i], fenceIndent));
          i++;
        }
        out.push(codeBlock(lang, body.join('\n')));
        continue;
      }

      if ((m = RE.heading.exec(line))) {
        var level = m[1].length;
        out.push('<h' + level + '>' + inline(m[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }

      if (RE.quote.test(line)) {
        var q = [];
        while (i < lines.length && !RE.blank.test(lines[i])) {
          var qm = RE.quote.exec(lines[i]);
          q.push(qm ? qm[1] : lines[i]);
          i++;
        }
        out.push('<blockquote>' + renderBlocks(q, false) + '</blockquote>');
        continue;
      }

      if (isTableStart(lines, i)) {
        var header = lines[i], sep = lines[i + 1], rows = [];
        i += 2;
        while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].indexOf('|') !== -1) {
          rows.push(lines[i]);
          i++;
        }
        out.push(renderTable(header, sep, rows));
        continue;
      }

      if (matchItem(line)) {
        var res = parseList(lines, i);
        out.push(res.html);
        i = res.next;
        continue;
      }

      // paragraph: consecutive lines until a blank line or another block; newlines become <br>
      var para = [line];
      i++;
      while (i < lines.length && !RE.blank.test(lines[i]) && !startsBlock(lines, i)) {
        para.push(lines[i]);
        i++;
      }
      var text = para.map(function (l) { return inline(l.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')); }).join('<br>');
      out.push(tight ? '<span class="li-text">' + text + '</span>' : '<p>' + text + '</p>');
    }
    return out.join('');
  }

  function renderMarkdown(src) {
    var lines = String(src).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    return renderBlocks(lines, false);
  }

  /* ------------------------------------------------------------------ */
  /* Post parsing                                                         */
  /* ------------------------------------------------------------------ */
  function unquote(s) {
    if (s.length > 1 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) return s.slice(1, -1);
    return s;
  }
  function parseValue(v) {
    var s = v.trim();
    if (/^\[.*\]$/.test(s)) {
      return s.slice(1, -1).split(',').map(function (x) { return unquote(x.trim()); }).filter(Boolean);
    }
    return unquote(s);
  }

  function parseAttrs(str) {
    var attrs = {}, re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g, m;
    while ((m = re.exec(str))) attrs[m[1]] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
    return attrs;
  }

  function parsePost(text) {
    var src = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var meta = {};
    var fm = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
    if (fm) {
      fm[1].split('\n').forEach(function (line) {
        var mm = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
        if (mm) meta[mm[1]] = parseValue(mm[2]);
      });
      src = src.slice(fm[0].length);
    }
    var re = /<!--\s*message\b([\s\S]*?)-->/g, marks = [], m;
    while ((m = re.exec(src))) marks.push({ attrs: parseAttrs(m[1]), start: m.index, end: re.lastIndex });
    var messages = marks.map(function (mk, idx) {
      var stop = idx + 1 < marks.length ? marks[idx + 1].start : src.length;
      var body = src.slice(mk.end, stop).replace(/^[ \t]*\n/, '').replace(/\s+$/, '');
      return {
        role: mk.attrs.role === 'user' ? 'user' : 'assistant',
        author: mk.attrs.author || (mk.attrs.role === 'user' ? 'You' : 'AI'),
        time: mk.attrs.time || '',
        markdown: body
      };
    });
    return { meta: meta, messages: messages };
  }

  /* ------------------------------------------------------------------ */
  /* Copy buttons                                                         */
  /* ------------------------------------------------------------------ */
  function copyText(text) {
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
      catch (e) { reject(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  function enhance(root) {
    root.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('[data-copy]');
      if (!btn || !root.contains(btn)) return;
      var code = btn.closest('.codeblock').querySelector('pre code');
      var label = btn.querySelector('.copy-label');
      copyText(code.textContent).then(function () {
        btn.classList.add('is-copied');
        label.textContent = 'Copied!';
      }, function () {
        label.textContent = 'Failed';
      }).then(function () {
        clearTimeout(btn._t);
        btn._t = setTimeout(function () { btn.classList.remove('is-copied'); label.textContent = 'Copy'; }, 1600);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Small shared bits                                                    */
  /* ------------------------------------------------------------------ */
  var ROBOT_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
    '<line x1="16" y1="5.5" x2="16" y2="9.5" stroke="#1b1f23" stroke-width="1.8" stroke-linecap="round"/>' +
    '<circle cx="16" cy="5" r="1.9" fill="#1b1f23"/>' +
    '<rect x="5.6" y="13.4" width="2.6" height="5.2" rx="1.3" fill="#1b1f23"/>' +
    '<rect x="23.8" y="13.4" width="2.6" height="5.2" rx="1.3" fill="#1b1f23"/>' +
    '<rect x="8" y="9.5" width="16" height="13.5" rx="4.5" fill="#1b1f23"/>' +
    '<circle cx="12.7" cy="15.3" r="1.9" fill="#e8c96a"/>' +
    '<circle cx="19.3" cy="15.3" r="1.9" fill="#e8c96a"/>' +
    '<path d="M12.8 19.3q3.2 2 6.4 0" stroke="#e8c96a" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return iso || '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return +m[1] + '年' + +m[2] + '月' + +m[3] + '日（' + WEEK[d.getDay()] + '）';
  }
  // Show the clock time exactly as written in the post (the author's local time), not the reader's.
  function formatTime(iso) {
    var m = /T(\d{2}):(\d{2})/.exec(iso || '');
    return m ? m[1] + ':' + m[2] : '';
  }

  global.AITM = {
    esc: esc,
    inline: inline,
    renderMarkdown: renderMarkdown,
    highlight: highlight,
    parsePost: parsePost,
    enhance: enhance,
    copyText: copyText,
    ROBOT_SVG: ROBOT_SVG,
    formatDate: formatDate,
    formatTime: formatTime
  };
})(window);
