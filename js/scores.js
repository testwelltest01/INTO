/* =====================================================================
 * 찬양팀 악보 + 콘티
 *  - 찬양팀(관리자 지정) + 관리자만 열람, 업로드는 관리자만
 *  - 악보 라이브러리: 곡 하나 = PDF 원본 또는 페이지 이미지 묶음
 *  - 여러 곡이 든 PDF → 페이지를 그림으로 잘라 곡별로 나누고 이름 붙이기 (제목 자동 인식)
 *  - 콘티: 날짜별 곡 순서(끌어서 정렬), 곡마다 이번 키·메모
 *  - 뷰어: 페이지별 선명하게, 세로 스크롤/한 장씩, 확대, 콘티 순서대로 다음 곡
 *  - 한 번 연 악보는 이 기기에 보관 → 예배 장소 인터넷이 약해도 열림 (로그아웃 시 삭제)
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon;
  var CACHE = 'into-scores-v1';
  var PDFJS = 'assets/vendor/pdfjs/';
  var KEY_RE = /[\(\[]\s*([A-G][#b♭♯]?m?(?:\s*[-→>]\s*[A-G][#b♭♯]?m?)?)\s*[\)\]]\s*$/;
  var SVG = {
    scissors: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/></svg>',
    grip: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    up: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    zoom: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg>',
    merge: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
  };

  var Scores = window.Scores = {};

  App.inTeam = function (t) {
    var p = App.profile();
    return !!(p && p.status === 'active' && (p.role === 'admin' || (p.teams || []).indexOf(t) >= 0));
  };

  /* ---------- 기기 보관 (Cache Storage) ---------- */
  function cacheKey(path) { return location.origin + '/__scores/' + encodeURIComponent(path); }
  function filesOf(row) { return row && row.pages && row.pages.length ? row.pages : (row && row.file_path ? [row.file_path] : []); }
  Scores.filesOf = filesOf;
  Scores.clearCache = function () { try { if (window.caches) caches.delete(CACHE); } catch (e) { } };
  Scores.isCached = async function (row) {
    var paths = filesOf(row); if (!paths.length || !window.caches) return false;
    try { var c = await caches.open(CACHE); for (var i = 0; i < paths.length; i++) if (!(await c.match(cacheKey(paths[i])))) return false; return true; } catch (e) { return false; }
  };
  // 파일 하나 받기: 기기에 있으면 그것, 없으면 내려받아 보관
  Scores.fetch = async function (path) {
    var key = cacheKey(path), c = null;
    try { c = await caches.open(CACHE); var hit = await c.match(key); if (hit) return hit.blob(); } catch (e) { }
    var blob = await App.api.scores.fetchBlob(path);
    try { if (c) await c.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || (/\.pdf$/i.test(path) ? 'application/pdf' : 'image/jpeg') } })); } catch (e) { }
    return blob;
  };
  Scores.saveOffline = async function (row) { var p = filesOf(row); for (var i = 0; i < p.length; i++) await Scores.fetch(p[i]); };
  Scores.load = async function (row) { return (await Scores.fetch(row.file_path)).arrayBuffer(); };

  /* ---------- pdf.js ---------- */
  var pdfjsReady = null;
  Scores.pdfjs = function () {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(window.pdfjsLib); };
      s.onerror = function () { pdfjsReady = null; reject(new Error('PDF 보기 도구를 불러오지 못했어요.')); };
      document.head.appendChild(s);
    });
    return pdfjsReady;
  };
  Scores.open = async function (buf) {
    var lib = await Scores.pdfjs();
    return lib.getDocument({ data: new Uint8Array(buf), cMapUrl: PDFJS + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS + 'standard_fonts/' }).promise;
  };
  Scores.countPages = async function (file) {
    try { var doc = await Scores.open(await file.arrayBuffer()); var n = doc.numPages; doc.destroy(); return n; } catch (e) { return null; }
  };

  /* ---------- 공통 도우미 ---------- */
  Scores.parseName = function (name) {
    var base = String(name || '').replace(/\.(pdf|jpe?g|png|webp|heic|gif)$/i, '').replace(/_/g, ' ').trim();
    var m = base.match(KEY_RE);
    return { title: (m ? base.slice(0, m.index) : base).trim() || base, key: m ? m[1].replace(/\s+/g, '') : '' };
  };
  function today() { return U.ymd(new Date()); }
  // 카톡으로 받은 파일·스캔·사진 이름은 곡 제목이 아님
  function genericName(t) {
    t = String(t || '');
    var digits = (t.match(/\d/g) || []).length;
    return /talkfile|kakaotalk|카카오톡|scan|camscanner|^img|^image|^photo|^dsc|screenshot|스크린샷|document|문서|콘티|악보|setlist|^\d+$/i.test(t.replace(/\s+/g, '')) || digits > t.length * 0.4;
  }
  function dateLabel(d) {
    var x = U.toDate(d); if (!x) return '';
    if (x.getDay() === 0) return U.weekLabel(d);
    return (x.getMonth() + 1) + '월 ' + x.getDate() + '일 (' + '일월화수목금토'.charAt(x.getDay()) + ')';
  }
  // 다가오는 콘티(가까운 날짜 먼저) → 지난 콘티(최근 먼저)
  function sortSetlists(list) {
    var t = today();
    return list.slice().sort(function (a, b) {
      var af = a.worship_date >= t, bf = b.worship_date >= t;
      if (af !== bf) return af ? -1 : 1;
      if (a.worship_date === b.worship_date) return (a.id > b.id ? 1 : -1) * (af ? 1 : -1);
      return (a.worship_date < b.worship_date ? -1 : 1) * (af ? 1 : -1);
    });
  }
  function setTitleHTML(sl, nextId) {
    var t = today();
    return esc(dateLabel(sl.worship_date)) + (sl.title ? ' · ' + esc(sl.title) : '') +
      (sl.id === nextId ? ' <span class="chip chip-dark">다음 예배</span>' : sl.worship_date < t ? ' <span class="chip">지난 콘티</span>' : ' <span class="chip">예정</span>');
  }
  function byId(list) { var m = {}; list.forEach(function (s) { m[String(s.id)] = s; }); return m; }
  function entries(sl, map) {
    return (sl.items || []).map(function (it, i) { return { item: it, score: map[String(it.score_id)], i: i }; }).filter(function (e) { return e.score; });
  }
  function keyOf(e) { return (e.item && e.item.key) || e.score.song_key || ''; }
  function noTeam() {
    return '<div class="card login-card">' + icon('lock') + '<p><b>찬양팀만 볼 수 있어요</b></p><p class="muted small">찬양팀이라면 관리자에게 "찬양팀 지정"을 요청해 주세요.</p></div>';
  }
  function pickFiles(multiple, accept) {
    return new Promise(function (resolve) {
      var inp = document.createElement('input'); inp.type = 'file';
      inp.accept = accept || 'application/pdf,.pdf,image/*'; if (multiple) inp.multiple = true;
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.onchange = function () { var f = Array.prototype.slice.call(inp.files || []); inp.remove(); resolve(f); };
      inp.click();
    });
  }
  Scores.pickFiles = pickFiles;
  function isPdf(f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''); }
  function isImg(f) { return /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|gif)$/i.test(f.name || ''); }
  function demo() { return App.api.mode === 'demo'; }
  function batchId() { return new Date().getFullYear() + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8); }

  /* =====================================================================
   *  찬양팀 화면: 콘티 | 전체 악보
   * ===================================================================== */
  App.route('/scores', async function (ctx) {
    if (!App.inTeam('worship')) { ctx.el.innerHTML = App.pageHead('찬양팀 악보') + '<section class="container narrow">' + noTeam() + '</section>'; return; }
    var r = await Promise.all([App.api.scores.list(), App.api.setlists.list()]);
    if (!ctx.alive()) return;
    var scores = r[0], map = byId(scores), sets = sortSetlists(r[1]);
    var t = today(), upcoming = sets.filter(function (s) { return s.worship_date >= t; });
    var nextId = upcoming.length ? upcoming[0].id : null;
    var tab = ctx.query.tab === 'all' ? 'all' : 'sets', q = '', showPast = false, cached = {};

    function row(e, href, no) {
      var s = e.score, k = keyOf(e);
      return '<a class="list-row score-row" href="' + href + '"><span class="sr-no">' + no + '</span>' +
        '<span class="lr-body"><span class="lr-title">' + esc(s.title) + '</span><span class="lr-sub">' +
        [s.artist, (s.page_count || filesOf(s).length) ? (s.page_count || filesOf(s).length) + '쪽' : '', e.item && e.item.memo].filter(Boolean).map(esc).join(' · ') + '</span></span>' +
        (k ? '<span class="key-chip">' + esc(k) + '</span>' : '') +
        (cached[s.id] ? '<span class="saved-dot" title="이 기기에 저장됨">' + icon('check') + '</span>' : '') + '</a>';
    }
    function drawSets() {
      var past = sets.filter(function (s) { return s.worship_date < t; });
      var shown = upcoming.concat(showPast ? past : past.slice(0, upcoming.length ? 2 : 4));
      if (!sets.length) return '<div class="empty">아직 올라온 콘티가 없어요.<br><small>관리자가 콘티를 만들면 여기에 순서대로 보여요.</small></div>';
      return shown.map(function (sl) {
        var es = entries(sl, map);
        return '<section class="score-group"><div class="sg-head"><h2>' + setTitleHTML(sl, nextId) + '</h2>' +
          (es.length ? '<button class="btn btn-sm btn-ghost" data-save-set="' + sl.id + '">' + icon('download') + '오프라인 저장</button>' : '') + '</div>' +
          (sl.memo ? '<p class="sl-memo">' + U.text(sl.memo) + '</p>' : '') +
          '<div class="list-card">' + (es.length ? es.map(function (e, n) { return row(e, '#/scores/' + e.score.id + '?set=' + sl.id + '&i=' + e.i, n + 1); }).join('') : '<div class="empty sm">곡이 아직 없어요.</div>') + '</div></section>';
      }).join('') + (past.length > shown.length - upcoming.length ? '<button class="btn btn-ghost btn-block" data-more>지난 콘티 더 보기 (' + (past.length - (shown.length - upcoming.length)) + ')</button>' : '');
    }
    function drawAll() {
      var list = scores.filter(function (s) { return !q || (s.title + ' ' + (s.artist || '') + ' ' + (s.song_key || '')).toLowerCase().indexOf(q) >= 0; });
      return '<div class="list-card">' + (list.length ? list.map(function (s) { return row({ score: s }, '#/scores/' + s.id, icon('music')); }).join('') :
        '<div class="empty sm">' + (q ? '검색 결과가 없어요.' : '아직 올라온 악보가 없어요.') + '</div>') + '</div>';
    }
    function draw() {
      var box = U.$('#score-body', ctx.el);
      U.$$('[data-tab]', ctx.el).forEach(function (a) { a.classList.toggle('on', a.dataset.tab === tab); });
      U.$('#score-q', ctx.el).style.display = tab === 'all' ? '' : 'none';
      box.innerHTML = tab === 'all' ? drawAll() : drawSets();
      var more = U.$('[data-more]', box); if (more) more.onclick = function () { showPast = true; draw(); };
      U.$$('[data-save-set]', box).forEach(function (b) {
        b.onclick = async function () {
          var sl = sets.filter(function (x) { return String(x.id) === b.dataset.saveSet; })[0], es = entries(sl, map), okN = 0;
          U.busy(b, true);
          for (var i = 0; i < es.length; i++) { try { await Scores.saveOffline(es[i].score); cached[es[i].score.id] = true; okN++; } catch (e) { } }
          U.toast(okN + '곡을 이 기기에 저장했어요. 인터넷이 약해도 열 수 있어요.');
          draw();
        };
      });
    }
    ctx.el.innerHTML = App.pageHead('찬양팀 악보', '콘티 순서대로 보기 · 한 번 연 악보는 이 기기에 저장돼요') +
      '<section class="container narrow">' +
      '<nav class="seg-tabs plain"><a href="#/scores" data-tab="sets">콘티</a><a href="#/scores?tab=all" data-tab="all">전체 악보 <small class="muted">' + scores.length + '</small></a></nav>' +
      '<input class="search score-search" type="search" placeholder="곡 제목·아티스트·키 검색" id="score-q">' +
      '<div id="score-body"></div>' +
      (App.isAdmin() ? '<a class="btn btn-ghost btn-block" href="#/admin/scores">' + icon('settings') + '콘티·악보 관리</a>' : '') + '</section>';
    U.$$('[data-tab]', ctx.el).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); tab = a.dataset.tab; history.replaceState(null, '', a.getAttribute('href')); draw(); }; });
    U.$('#score-q', ctx.el).oninput = U.debounce(function (e) { q = e.target.value.trim().toLowerCase(); draw(); }, 120);
    draw();
    // 이 기기에 저장된 악보 표시
    await Promise.all(scores.map(function (s) { return Scores.isCached(s).then(function (v) { cached[s.id] = v; }); }));
    if (ctx.alive() && scores.some(function (s) { return cached[s.id]; })) draw();
  }, { title: '찬양팀 악보', auth: true });

  /* =====================================================================
   *  악보 보기 (PDF 또는 페이지 이미지)
   * ===================================================================== */
  // 그리기 원본: PDF(pdf.js) 또는 이미지 묶음을 같은 방식으로 다룸
  async function makeSource(row) {
    if (row.pages && row.pages.length) {
      var imgs = await Promise.all(row.pages.map(async function (p) {
        var url = URL.createObjectURL(await Scores.fetch(p)), im = new Image();
        im.src = url;
        try { await im.decode(); } catch (e) { await new Promise(function (r) { im.onload = r; im.onerror = r; }); }
        return { url: url, w: im.naturalWidth || 1000, h: im.naturalHeight || 1414 };
      }));
      return {
        n: imgs.length,
        size: async function (i) { return imgs[i - 1]; },
        draw: async function (i, cssW) {
          var s = imgs[i - 1], im = document.createElement('img');
          im.src = s.url; im.alt = ''; im.draggable = false;
          im.style.width = Math.floor(cssW) + 'px'; im.style.height = Math.floor(cssW * s.h / s.w) + 'px';
          return im;
        },
        destroy: function () { imgs.forEach(function (s) { URL.revokeObjectURL(s.url); }); }
      };
    }
    var doc = await Scores.open(await Scores.load(row));
    return {
      n: doc.numPages, doc: doc,
      size: async function (i) { var p = await doc.getPage(i), v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height, page: p }; },
      draw: async function (i, cssW, dpr, sz) {
        var p = sz.page, scale = cssW / sz.w, px = scale * dpr, maxPx = 4096 * 4096;
        if (sz.w * sz.h * px * px > maxPx) px = Math.sqrt(maxPx / (sz.w * sz.h));
        var vp = p.getViewport({ scale: px }), cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        cv.style.width = Math.floor(cssW) + 'px'; cv.style.height = Math.floor(cssW * sz.h / sz.w) + 'px';
        await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        return cv;
      },
      destroy: function () { try { doc.destroy(); } catch (e) { } }
    };
  }

  App.route('/scores/:id', async function (ctx) {
    if (!App.inTeam('worship')) { ctx.el.innerHTML = '<section class="container narrow">' + noTeam() + '</section>'; return; }
    var setId = ctx.query.set || '';
    var r = await Promise.all([App.api.scores.get(ctx.params.id), setId ? App.api.scores.list() : null, setId ? App.api.setlists.get(setId).catch(function () { return null; }) : null]);
    if (!ctx.alive()) return;
    var row = r[0], seq = [{ score: row, item: null, i: 0 }], idx = 0, sl = r[2];
    if (sl) {
      seq = entries(sl, byId(r[1]));
      var want = +ctx.query.i;
      idx = seq.findIndex(function (e) { return e.i === want && String(e.score.id) === String(row.id); });
      if (idx < 0) idx = seq.findIndex(function (e) { return String(e.score.id) === String(row.id); });
      if (idx < 0) { seq = [{ score: row, item: null, i: 0 }]; idx = 0; sl = null; }
    }
    var cur = seq[idx], songKey = keyOf(cur), memo = cur.item && cur.item.memo;
    var backTo = sl ? '/scores' : '/scores?tab=all';
    var prefs = {}; try { prefs = JSON.parse(localStorage.getItem('into_score_prefs') || '{}'); } catch (e) { }
    var mode = prefs.mode || 'scroll', zoom = 1, page = 1, src = null, wake = null, destroyed = false;
    function songHref(e) { return '/scores/' + e.score.id + (sl ? '?set=' + sl.id + '&i=' + e.i : ''); }

    document.body.classList.add('viewer-mode');
    ctx.el.innerHTML =
      '<div class="pv" id="pv">' +
        '<header class="pv-bar">' +
          '<button class="icon-btn" data-back aria-label="목록으로">' + icon('chevron-left') + '</button>' +
          '<div class="pv-title"><b>' + (seq.length > 1 ? (idx + 1) + '. ' : '') + esc(row.title) + '</b><small>' +
            [songKey ? 'Key ' + songKey + (cur.item && cur.item.key && row.song_key && cur.item.key !== row.song_key ? ' (원키 ' + row.song_key + ')' : '') : '', row.artist, memo].filter(Boolean).map(esc).join(' · ') + '<span id="pv-pg"></span></small></div>' +
          '<div class="pv-tools">' +
            '<button class="icon-btn" data-zoom="-1" aria-label="축소"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg></button>' +
            '<button class="icon-btn" data-zoom="1" aria-label="확대"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg></button>' +
            '<button class="pv-btn" data-mode></button>' +
            ('wakeLock' in navigator ? '<button class="pv-btn" data-wake aria-pressed="false">' + icon('eye') + '<span>화면 켜 두기</span></button>' : '') +
          '</div>' +
        '</header>' +
        '<div class="pv-pages" id="pv-pages"><div class="loading"><span class="spinner"></span></div></div>' +
        '<div class="pv-tap pv-tap-l" data-tap="-1"></div><div class="pv-tap pv-tap-r" data-tap="1"></div>' +
        (seq.length > 1 ? '<footer class="pv-nav">' +
          '<button class="pv-btn" data-song="-1"' + (idx <= 0 ? ' disabled' : '') + '>' + icon('chevron-left') + '<span>' + (idx > 0 ? esc(seq[idx - 1].score.title) : '이전 곡') + '</span></button>' +
          '<span class="pv-count">' + (idx + 1) + ' / ' + seq.length + '곡</span>' +
          '<button class="pv-btn" data-song="1"' + (idx >= seq.length - 1 ? ' disabled' : '') + '><span>' + (idx < seq.length - 1 ? esc(seq[idx + 1].score.title) : '다음 곡') + '</span>' + icon('chevron-right') + '</button>' +
        '</footer>' : '') +
      '</div>';

    var pv = U.$('#pv', ctx.el), pagesEl = U.$('#pv-pages', ctx.el), pgLabel = U.$('#pv-pg', ctx.el);
    function savePrefs() { try { localStorage.setItem('into_score_prefs', JSON.stringify({ mode: mode })); } catch (e) { } }
    function setModeBtn() { var b = U.$('[data-mode]', ctx.el); b.innerHTML = mode === 'scroll' ? icon('book') + '<span>한 장씩</span>' : icon('menu') + '<span>세로 스크롤</span>'; pv.classList.toggle('mode-page', mode === 'page'); }
    function updateLabel() { if (src) pgLabel.textContent = (pgLabel.previousSibling ? ' · ' : '') + page + '/' + src.n + '쪽'; }

    // 페이지 그리기: 화면 크기 × 확대 × 기기 해상도에 맞춰 선명하게
    var renderToken = 0;
    async function renderAll() {
      if (!src || destroyed) return;
      var token = ++renderToken;
      var W = pagesEl.clientWidth, H = pagesEl.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      pagesEl.innerHTML = '';
      pagesEl.classList.toggle('zoomed', zoom > 1);
      var targets = mode === 'page' ? [page] : Array.from({ length: src.n }, function (_, i) { return i + 1; });
      for (var t = 0; t < targets.length; t++) {
        if (token !== renderToken || destroyed) return;
        var n = targets[t], sz = await src.size(n);
        var cssW = (mode === 'page' ? Math.min(W - 8, (H - 8) * sz.w / sz.h) : W - 16) * zoom;
        var wrap = document.createElement('div'); wrap.className = 'pv-page'; wrap.dataset.page = n;
        pagesEl.appendChild(wrap);
        var el = await src.draw(n, cssW, dpr, sz);
        if (token !== renderToken || destroyed) return;
        wrap.appendChild(el);
        if (mode === 'scroll' && src.n > 1) { var lb = document.createElement('div'); lb.className = 'pv-pnum'; lb.textContent = n + ' / ' + src.n; wrap.appendChild(lb); }
      }
      if (mode === 'scroll') observe();
      updateLabel();
    }
    var io = null;
    function observe() {
      if (io) io.disconnect();
      if (!('IntersectionObserver' in window)) return;
      io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) { if (e.isIntersecting) { page = +e.target.dataset.page; updateLabel(); } });
      }, { root: pagesEl, threshold: 0.5 });
      U.$$('.pv-page', pagesEl).forEach(function (el) { io.observe(el); });
    }
    function go(delta) {
      if (!src) return;
      if (mode === 'page') {
        var np = page + delta;
        if (np < 1 || np > src.n) { if (seq.length > 1) song(delta); return; }
        page = np; renderAll();
      } else {
        var el = U.$('.pv-page[data-page="' + Math.min(src.n, Math.max(1, page + delta)) + '"]', pagesEl);
        if (el) pagesEl.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' });
      }
    }
    function song(delta) { var t = seq[idx + delta]; if (t) App.go(songHref(t), true); }
    function setZoom(z) { zoom = Math.max(1, Math.min(4, Math.round(z * 100) / 100)); renderAll(); }

    U.$('[data-back]', ctx.el).onclick = function () { App.go(backTo); };
    U.$$('[data-zoom]', ctx.el).forEach(function (b) { b.onclick = function () { setZoom(zoom + (+b.dataset.zoom) * 0.25); }; });
    U.$('[data-mode]', ctx.el).onclick = function () { mode = mode === 'scroll' ? 'page' : 'scroll'; zoom = 1; savePrefs(); setModeBtn(); renderAll(); };
    U.$$('[data-song]', ctx.el).forEach(function (b) { b.onclick = function () { song(+b.dataset.song); }; });
    U.$$('[data-tap]', ctx.el).forEach(function (b) { b.onclick = function () { if (mode === 'page' && zoom === 1) go(+b.dataset.tap); }; });
    var wb = U.$('[data-wake]', ctx.el);
    async function wakeOn() { try { wake = await navigator.wakeLock.request('screen'); wb.classList.add('on'); wb.setAttribute('aria-pressed', 'true'); wake.addEventListener('release', function () { if (wb) { wb.classList.remove('on'); wb.setAttribute('aria-pressed', 'false'); } }); } catch (e) { U.toast('이 기기에서는 화면 켜 두기를 쓸 수 없어요.'); } }
    if (wb) wb.onclick = function () { if (wake) { wake.release(); wake = null; } else wakeOn(); };
    function onVis() { if (document.visibilityState === 'visible' && wb && wb.classList.contains('on') && !wake) wakeOn(); }
    document.addEventListener('visibilitychange', onVis);

    // 키보드·블루투스 페달
    function onKey(e) {
      if (!document.body.contains(pv)) return;
      if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].indexOf(e.key) >= 0) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'ArrowUp'].indexOf(e.key) >= 0) { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') App.go(backTo);
    }
    document.addEventListener('keydown', onKey);

    // 스와이프(한 장씩) + 두 손가락 확대
    var sx = null, sy = null, pinch = null;
    pagesEl.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch = { d: Math.hypot(dx, dy), z: zoom, ratio: 1 }; sx = null;
      } else if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
    }, { passive: true });
    pagesEl.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch.ratio = Math.hypot(dx, dy) / pinch.d;
        pagesEl.style.transform = 'scale(' + Math.max(0.6, Math.min(3, pinch.ratio)) + ')';
      }
    }, { passive: true });
    pagesEl.addEventListener('touchend', function (e) {
      if (pinch && e.touches.length < 2) {
        pagesEl.style.transform = ''; var z = pinch.z * pinch.ratio; pinch = null;
        if (Math.abs(z - zoom) > 0.05) setZoom(z);
        return;
      }
      if (sx === null || mode !== 'page' || zoom > 1) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
    });

    var onResize = U.debounce(function () { if (document.body.contains(pv)) renderAll(); }, 250);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    function cleanup() {
      destroyed = true;
      document.body.classList.remove('viewer-mode');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (wake) { try { wake.release(); } catch (e) { } wake = null; }
      if (io) io.disconnect();
      if (src) src.destroy();
    }
    App.onLeave(cleanup);

    setModeBtn();
    try {
      if (!filesOf(row).length) throw new Error('악보 파일이 없어요.');
      var s = await makeSource(row);
      if (destroyed) { s.destroy(); return; }
      src = s;
      if (!row.page_count && App.isAdmin()) App.api.scores.save({ id: row.id, page_count: src.n }).catch(function () { });
      await renderAll();
      if (seq[idx + 1]) Scores.saveOffline(seq[idx + 1].score).catch(function () { });   // 다음 곡 미리 받아 두기
    } catch (e) {
      pagesEl.innerHTML = '<div class="empty" style="color:#ddd">악보를 열 수 없어요.<br><small>' + esc(U.errMsg(e)) + '</small></div>';
    }
  }, { title: '악보', auth: true });

  /* =====================================================================
   *  악보 나누기: 여러 곡이 든 PDF·사진 → 곡별 페이지 묶음 + 이름
   *   Scores.splitter(files, { setlists }) → Promise<저장된 악보 목록>
   * ===================================================================== */
  // 페이지 맨 위쪽의 가장 큰 글자를 곡 제목으로 추정
  function detectTitle(tc, vw, vh) {
    var items = (tc.items || []).filter(function (it) { return it.str && it.str.trim(); });
    if (!items.length) return null;
    var sz = function (it) { return Math.abs(it.transform[3]) || it.height || 0; };
    var sizes = items.map(sz).sort(function (a, b) { return a - b; }), median = sizes[Math.floor(sizes.length / 2)];
    var top = items.filter(function (it) { return (vh - it.transform[5]) / vh < 0.3; });
    if (!top.length) return { title: '', key: '', isTitle: false };
    var mx = Math.max.apply(null, top.map(sz)), ref = top.filter(function (it) { return sz(it) === mx; })[0];
    var line = top.filter(function (it) { return sz(it) >= mx * 0.8 && Math.abs(it.transform[5] - ref.transform[5]) < mx * 0.7; })
      .sort(function (a, b) { return a.transform[4] - b.transform[4]; });
    var title = line.reduce(function (acc, it, k) {          // 글자 사이 간격을 보고 띄어쓰기 결정 (한글은 글자마다 나뉘어 나옴)
      if (k > 0) { var pv = line[k - 1], gap = it.transform[4] - (pv.transform[4] + (pv.width || 0)); if (gap > mx * 0.22 && !/\s$/.test(acc) && !/^\s/.test(it.str)) acc += ' '; }
      return acc + it.str;
    }, '').replace(/\s+/g, ' ').trim()
      .replace(/\s*[\(\[]?\s*\d+\s*\/\s*\d+\s*[\)\]]?\s*$/, '').replace(/\s*[-–]\s*\d+\s*[-–]?\s*$/, '').trim();
    var key = '', m = title.match(KEY_RE);
    if (m) { key = m[1].replace(/\s+/g, ''); title = title.slice(0, m.index).trim(); }
    if (!key) {
      var all = top.map(function (it) { return it.str; }).join(' ');
      var km = all.match(/\bKey\s*(?:of\s*)?[:：=\-]?\s*([A-G][#b♭♯]?m?)(?![a-z])/i) || all.match(/[\(\[]\s*([A-G][#b♭♯]?m?)\s*[\)\]]/);
      if (km) key = km[1];
    }
    return { title: title, key: key, isTitle: title.length >= 2 && mx >= median * 1.3 };
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/[\s\(\)\[\]\-–.,:'"]/g, ''); }

  Scores.splitter = function (files, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var pages = [], docs = [], urls = [], saved = [], fileInfo = [];
      var wrap = document.createElement('div'); wrap.className = 'sp-wrap';
      wrap.innerHTML = '<div class="sp-loading"><span class="spinner"></span><p>페이지를 읽는 중이에요…</p></div>';
      document.body.appendChild(wrap); document.body.classList.add('no-scroll');
      var closed = false;
      function close() {
        if (closed) return; closed = true;
        docs.forEach(function (d) { try { d.destroy(); } catch (e) { } });
        urls.forEach(function (u) { URL.revokeObjectURL(u); });
        var v = U.$('.spv'); if (v) v.remove();
        wrap.remove(); document.body.classList.remove('no-scroll');
        document.removeEventListener('keydown', onKey);
        resolve(saved);
      }
      var viewing = false;
      function onKey(e) { if (e.key === 'Escape' && !busy && !viewing) ask(); }
      document.addEventListener('keydown', onKey);
      var busy = false;
      async function ask() { if (saved.length || await U.confirm('나누기를 그만할까요? 아직 저장하지 않았어요.', '그만하기')) close(); }

      // 1) 파일 → 페이지
      (async function () {
        for (var f = 0; f < files.length; f++) {
          var file = files[f], nm = Scores.parseName(file.name);
          fileInfo[f] = { file: file, name: file.name, title: genericName(nm.title) ? '' : nm.title, key: nm.key, pdf: isPdf(file), pages: 0, text: false };
          setLoading((f + 1) + '/' + files.length + ' · ' + file.name);
          try {
            if (isPdf(file)) {
              var doc = await Scores.open(await file.arrayBuffer()); docs.push(doc);
              fileInfo[f].pages = doc.numPages;
              for (var n = 1; n <= doc.numPages; n++) {
                var pg = await doc.getPage(n), v1 = pg.getViewport({ scale: 1 });
                var tv = pg.getViewport({ scale: 600 / v1.width }), cv = document.createElement('canvas');
                cv.width = Math.round(tv.width); cv.height = Math.round(tv.height);
                await pg.render({ canvasContext: cv.getContext('2d'), viewport: tv }).promise;
                var det = null; try { det = detectTitle(await pg.getTextContent(), v1.width, v1.height); } catch (e) { }
                if (det) fileInfo[f].text = true;
                pages.push({ f: f, n: n, doc: doc, thumb: cv.toDataURL('image/jpeg', 0.8), det: det || { title: '', key: '', isTitle: false }, off: false, start: false });
                if (n % 4 === 0) setLoading((f + 1) + '/' + files.length + ' · ' + file.name + ' (' + n + '/' + doc.numPages + '쪽)');
              }
            } else if (isImg(file)) {
              var u = URL.createObjectURL(file); urls.push(u);
              fileInfo[f].pages = 1;
              pages.push({ f: f, n: 1, img: file, thumb: u, det: { title: '', key: '', isTitle: false }, off: false, start: false });
            } else U.toast(file.name + ': PDF나 사진만 올릴 수 있어요.', 'error');
          } catch (e) { U.toast(file.name + ': ' + U.errMsg(e), 'error'); }
        }
        if (closed) return;
        if (!pages.length) { close(); return; }
        apply('auto'); draw();
      })();
      function setLoading(t) { var p = U.$('.sp-loading p', wrap); if (p) p.textContent = '페이지를 읽는 중이에요… ' + t; }

      // 2) 나누는 방법
      function startAt(p, title, key) { p.start = true; p.gTitle = title || ''; p.gKey = key || ''; p.gArtist = p.gArtist || ''; }
      function apply(how) {
        var fileStarts = {};
        pages.forEach(function (p, i) {
          var first = !fileStarts[p.f]; fileStarts[p.f] = true;
          var fi = fileInfo[p.f]; p.start = false;
          if (how === 'page') { startAt(p, p.det.title || (fi.pages > 1 ? '' : fi.title), p.det.key || (fi.pages > 1 ? '' : fi.key)); return; }
          if (first) startAt(p, fi.title, fi.key);
        });
        if (how !== 'auto') return;
        // 자동: 한 파일 안에서 새 제목이 보이는 페이지마다 새 곡
        fileInfo.forEach(function (fi, f) {
          var ps = pages.filter(function (p) { return p.f === f; });
          if (ps.length < 2 || !fi.pdf) return;
          var prev = '', starts = [];
          ps.forEach(function (p, j) {
            if (p.det.isTitle && norm(p.det.title) !== norm(prev)) starts.push(j);
            if (p.det.isTitle) prev = p.det.title;
          });
          if (starts.length < 2 && !(starts.length === 1 && starts[0] > 0)) {   // 한 곡짜리 파일
            if (!ps[0].gKey && ps[0].det.key) ps[0].gKey = ps[0].det.key;
            return;
          }
          ps.forEach(function (p, j) {
            var at = starts.indexOf(j) >= 0;
            if (j === 0) startAt(p, p.det.isTitle ? p.det.title : fi.title, p.det.isTitle ? p.det.key : fi.key);
            else if (at) startAt(p, p.det.title, p.det.key);
          });
        });
      }
      function groups() {
        var gs = [];
        pages.forEach(function (p, i) { if (p.start || !gs.length) { if (!p.start) startAt(p, fileInfo[p.f].title, fileInfo[p.f].key); gs.push({ head: p, idx: [] }); } gs[gs.length - 1].idx.push(i); });
        gs.forEach(function (g) { g.use = g.idx.filter(function (i) { return !pages[i].off; }); });
        return gs;
      }

      // 3) 화면
      function draw() {
        var oldBody = U.$('.sp-body', wrap), keepTop = oldBody ? oldBody.scrollTop : 0;
        var gs = groups(), songs = gs.filter(function (g) { return g.use.length && !g.head.done; });
        var noText = fileInfo.filter(function (fi) { return fi.pdf && fi.pages > 1 && !fi.text; }).map(function (fi) { return fi.name; });
        var setOpts = (opts.setlists || []).filter(function (s) { return s.worship_date >= today(); });
        wrap.innerHTML =
          '<header class="sp-head"><button class="icon-btn" data-x aria-label="닫기">' + icon('close') + '</button>' +
            '<div class="sp-h"><b>악보 나누기</b><small>' + pages.length + '쪽 → ' + songs.length + '곡</small></div>' +
            '<button class="btn btn-primary" data-save>' + songs.length + '곡 저장</button></header>' +
          '<div class="sp-body">' +
            '<div class="sp-tools"><span class="muted small">나누는 방법</span>' +
              '<button class="chip-btn" data-how="auto">자동 (제목 인식)</button>' +
              '<button class="chip-btn" data-how="page">한 쪽 = 한 곡</button>' +
              '<button class="chip-btn" data-how="file">파일 하나 = 한 곡</button></div>' +
            '<p class="sp-hint">' + SVG.scissors + ' ' + (noText.length ?
                '<b>사진으로 된 PDF라 곡을 자동으로 나누지 못했어요.</b> 새 곡이 시작되는 쪽에서 <b>여기서 나누기</b>를 누르고, 악보를 눌러 크게 보면서 제목을 적어 주세요.' :
                '새 곡이 시작되는 쪽에서 <b>여기서 나누기</b>, 표지·빈 쪽은 <b>빼기</b>. 악보를 누르면 크게 보여요.') + '</p>' +
            gs.map(function (g, k) {
              var h = g.head, done = h.done;
              return '<section class="sp-group' + (done ? ' done' : '') + '" data-g="' + k + '">' +
                '<div class="sp-ghead"><span class="sr-no">' + (k + 1) + '</span>' +
                  (done ? '<b class="sp-done">' + icon('check') + esc(h.gTitle) + ' · 저장됨</b>' :
                  '<input class="sp-title" data-t="' + g.idx[0] + '" value="' + esc(h.gTitle) + '" placeholder="곡 제목" aria-label="곡 제목">' +
                  '<input class="sp-key" data-k="' + g.idx[0] + '" value="' + esc(h.gKey) + '" placeholder="키" aria-label="키">' +
                  '<input class="sp-artist" data-a="' + g.idx[0] + '" value="' + esc(h.gArtist || '') + '" placeholder="아티스트 (선택)" aria-label="아티스트">') +
                  '<span class="muted small nw">' + g.use.length + '쪽</span>' +
                  (k > 0 && !done && !gs[k - 1].head.done ? '<button class="btn btn-sm btn-ghost" data-merge="' + g.idx[0] + '">' + SVG.merge + '앞 곡에 붙이기</button>' : '') + '</div>' +
                '<div class="sp-pages">' + g.idx.map(function (i, j) {
                  var p = pages[i], fi = fileInfo[p.f];
                  return '<figure class="sp-page' + (p.off ? ' off' : '') + (j === 0 ? ' first' : '') + '">' +
                    '<button type="button" class="sp-zoom" data-view="' + i + '" aria-label="' + p.n + '쪽 크게 보기"><img src="' + p.thumb + '" alt="">' +
                      '<span class="sp-pno">' + (fi.pages > 1 || files.length > 1 ? p.n + '쪽' : '사진') + '</span><span class="sp-mag">' + SVG.zoom + '</span></button>' +
                    (files.length > 1 ? '<figcaption>' + esc(fi.name) + '</figcaption>' : '') +
                    (done ? '' : '<div class="sp-ptools">' +
                      (j > 0 ? '<button type="button" class="sp-cut" data-cut="' + i + '" title="이 쪽부터 새 곡으로 나누기">' + SVG.scissors + '여기서 나누기</button>' : '<span class="sp-startlbl">' + (k + 1) + '번 곡 시작</span>') +
                      '<button type="button" class="sp-off" data-off="' + i + '">' + (p.off ? '다시 넣기' : '빼기') + '</button></div>') +
                    '</figure>';
                }).join('') + '</div></section>';
            }).join('') +
          '</div>' +
          '<footer class="sp-foot">' +
            (setOpts.length ? '<label class="field inline-field"><span>콘티에도 넣기</span><select id="sp-set"><option value="">넣지 않음</option>' +
              setOpts.map(function (s) { return '<option value="' + s.id + '"' + (String(s.id) === String(opts.setlistId || '') ? ' selected' : '') + '>' + esc(dateLabel(s.worship_date) + (s.title ? ' · ' + s.title : '')) + '</option>'; }).join('') + '</select></label>' : '<span></span>') +
            '<div class="sp-prog muted small" id="sp-prog"></div>' +
            '<button class="btn btn-primary" data-save>' + songs.length + '곡 저장</button></footer>';
        bind();
        var nb = U.$('.sp-body', wrap); if (nb && keepTop) nb.scrollTop = keepTop;
      }
      function bind() {
        U.$('[data-x]', wrap).onclick = function () { if (!busy) ask(); };
        U.$$('[data-how]', wrap).forEach(function (b) { b.onclick = function () { apply(b.dataset.how); draw(); U.toast(b.textContent + '(으)로 나눴어요.'); }; });
        U.$$('[data-cut]', wrap).forEach(function (b) {
          b.onclick = function () { var p = pages[+b.dataset.cut]; startAt(p, p.det.isTitle ? p.det.title : '', p.det.key); draw(); var inp = U.$('[data-t="' + b.dataset.cut + '"]', wrap); if (inp) { inp.focus(); inp.scrollIntoView({ block: 'center' }); } };
        });
        U.$$('[data-merge]', wrap).forEach(function (b) { b.onclick = function () { pages[+b.dataset.merge].start = false; draw(); }; });
        U.$$('[data-off]', wrap).forEach(function (b) { b.onclick = function () { var p = pages[+b.dataset.off]; p.off = !p.off; draw(); }; });
        U.$$('[data-t]', wrap).forEach(function (inp) { inp.oninput = function () { pages[+inp.dataset.t].gTitle = inp.value; inp.classList.remove('bad'); }; });
        U.$$('[data-k]', wrap).forEach(function (inp) { inp.oninput = function () { pages[+inp.dataset.k].gKey = inp.value.trim(); }; });
        U.$$('[data-a]', wrap).forEach(function (inp) { inp.oninput = function () { pages[+inp.dataset.a].gArtist = inp.value; }; });
        U.$$('[data-save]', wrap).forEach(function (b) { b.onclick = save; });
        U.$$('[data-view]', wrap).forEach(function (b) { b.onclick = function () { view(+b.dataset.view); }; });
      }

      // 3-1) 크게 보기: 페이지를 화면 크기에 맞게 선명하게 다시 그려서 보여 주고, 거기서 바로 제목·나누기
      async function bigUrl(p) {
        if (p.img) return p.thumb;
        if (p.big) return p.big;
        var pg = await p.doc.getPage(p.n), v1 = pg.getViewport({ scale: 1 });
        var W = Math.min(2400, Math.max(1600, Math.round(Math.min(window.innerWidth, 1100) * Math.min(window.devicePixelRatio || 1, 2.5))));
        var sc = W / v1.width; if (v1.width * sc * v1.height * sc > 12e6) sc = Math.sqrt(12e6 / (v1.width * v1.height));
        var vp = pg.getViewport({ scale: sc }), cv = document.createElement('canvas');
        cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
        await pg.render({ canvasContext: cx, viewport: vp }).promise;
        var blob = await new Promise(function (r) { cv.toBlob(r, 'image/jpeg', 0.9); }); cv.width = cv.height = 0;
        if (!blob) return p.thumb;
        p.big = URL.createObjectURL(blob); urls.push(p.big); return p.big;
      }
      function view(start) {
        var cur = start, zoom = 1, ZS = [1, 1.5, 2, 3], token = 0;
        viewing = true;
        var v = document.createElement('div'); v.className = 'spv'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', '악보 크게 보기');
        v.innerHTML =
          '<header class="spv-bar"><button class="icon-btn" data-vx aria-label="닫기">' + icon('close') + '</button>' +
            '<div class="spv-t"><b></b><small></small></div>' +
            '<button class="icon-btn" data-vz="-1" aria-label="축소"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg></button>' +
            '<button class="icon-btn" data-vz="1" aria-label="확대"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg></button></header>' +
          '<div class="spv-body"><img class="spv-img" alt=""><span class="spinner spv-spin"></span></div>' +
          '<button class="spv-nav l" data-vn="-1" aria-label="이전 쪽">' + icon('chevron-left') + '</button>' +
          '<button class="spv-nav r" data-vn="1" aria-label="다음 쪽">' + icon('chevron-right') + '</button>' +
          '<footer class="spv-foot"></footer>';
        document.body.appendChild(v);
        var body = U.$('.spv-body', v), img = U.$('.spv-img', v), foot = U.$('.spv-foot', v);
        function where() {
          var gs = groups();
          for (var k = 0; k < gs.length; k++) { var j = gs[k].idx.indexOf(cur); if (j >= 0) return { gs: gs, g: gs[k], k: k, j: j }; }
        }
        function setZoom(z) { zoom = z; img.style.width = (zoom * 100) + '%'; v.classList.toggle('zoomed', zoom > 1); }
        async function paint(resetScroll) {
          var p = pages[cur], fi = fileInfo[p.f], w = where(), h = w.g.head, done = h.done, my = ++token;
          U.$('.spv-t b', v).textContent = (w.k + 1) + '번째 곡 · ' + (h.gTitle || '제목 없음');
          U.$('.spv-t small', v).textContent = (fi.pages > 1 ? fi.name.replace(/\.pdf$/i, '') + ' ' + p.n + '쪽' : fi.name) + ' · ' + (cur + 1) + '/' + pages.length + (p.off ? ' · 뺀 쪽' : '');
          U.$('[data-vn="-1"]', v).disabled = cur <= 0; U.$('[data-vn="1"]', v).disabled = cur >= pages.length - 1;
          v.classList.toggle('off', !!p.off);
          foot.innerHTML = done ? '<p class="spv-done">' + icon('check') + '이미 저장한 곡이에요.</p>' :
            '<div class="spv-fields"><span class="sr-no">' + (w.k + 1) + '</span>' +
              '<input class="spv-title" data-vt value="' + esc(h.gTitle) + '" placeholder="곡 제목 (악보에 적힌 제목을 보고 적어 주세요)" aria-label="곡 제목">' +
              '<input class="spv-key" data-vk value="' + esc(h.gKey) + '" placeholder="키" aria-label="키"></div>' +
            '<div class="spv-acts">' +
              (w.j > 0 ? '<button class="btn btn-sm" data-va="cut">' + SVG.scissors + '이 쪽부터 새 곡</button>' :
                (w.k > 0 && !w.gs[w.k - 1].head.done ? '<button class="btn btn-sm" data-va="merge">' + SVG.merge + '앞 곡에 붙이기</button>' : '')) +
              '<button class="btn btn-sm btn-ghost" data-va="off">' + (p.off ? '다시 넣기' : '이 쪽 빼기') + '</button>' +
              '<span class="spv-pos muted small">이 곡의 ' + (w.j + 1) + '/' + w.g.idx.length + '쪽</span></div>';
          var t = U.$('[data-vt]', foot), kk = U.$('[data-vk]', foot);
          if (t) t.oninput = function () { h.gTitle = t.value; U.$('.spv-t b', v).textContent = (w.k + 1) + '번째 곡 · ' + (t.value || '제목 없음'); };
          if (kk) kk.oninput = function () { h.gKey = kk.value.trim(); };
          U.$$('[data-va]', foot).forEach(function (b) {
            b.onclick = function () {
              var a = b.dataset.va;
              if (a === 'cut') { startAt(p, p.det.isTitle ? p.det.title : '', p.det.key); paint(); var ti = U.$('[data-vt]', foot); if (ti && !ti.value) ti.focus(); }
              else if (a === 'merge') { h.start = false; paint(); }
              else if (a === 'off') { p.off = !p.off; paint(); }
            };
          });
          if (resetScroll) body.scrollTop = 0;
          v.classList.add('loading');
          var url = p.thumb;
          img.src = url;   // 먼저 미리보기를 띄우고
          try { url = await bigUrl(p); } catch (e) { }
          if (my !== token) return;
          img.src = url;   // 선명한 그림으로 바꿈
          v.classList.remove('loading');
          if (pages[cur + 1] && !pages[cur + 1].img) bigUrl(pages[cur + 1]).catch(function () { });
        }
        function go(d) { var n = cur + d; if (n < 0 || n >= pages.length) return; cur = n; setZoom(1); paint(true); }
        function closeView() {
          viewing = false; document.removeEventListener('keydown', keys, true); v.remove(); draw();
          var f = U.$('[data-view="' + cur + '"].sp-zoom', wrap); if (f) f.scrollIntoView({ block: 'nearest' });
        }
        function keys(e) {
          if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'Escape') { e.target.blur(); e.stopPropagation(); } return; }
          if (e.key === 'Escape') { e.stopPropagation(); closeView(); }
          else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
          else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
        }
        document.addEventListener('keydown', keys, true);
        U.$('[data-vx]', v).onclick = closeView;
        U.$$('[data-vn]', v).forEach(function (b) { b.onclick = function () { go(+b.dataset.vn); }; });
        U.$$('[data-vz]', v).forEach(function (b) {
          b.onclick = function () { var i = ZS.indexOf(zoom) + (+b.dataset.vz); setZoom(ZS[Math.max(0, Math.min(ZS.length - 1, i))]); };
        });
        img.ondblclick = function (e) {
          var r = body.getBoundingClientRect(), fx = (e.clientX - r.left + body.scrollLeft) / body.scrollWidth, fy = (e.clientY - r.top + body.scrollTop) / body.scrollHeight;
          setZoom(zoom > 1 ? 1 : 2);
          body.scrollLeft = fx * body.scrollWidth - r.width / 2; body.scrollTop = fy * body.scrollHeight - r.height / 2;
        };
        var sx = null, sy = null;
        body.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
        body.addEventListener('touchend', function (e) {
          if (sx === null || zoom > 1) return;
          var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        });
        setZoom(1); paint(true);
      }

      // 4) 저장: 파일 하나를 통째로 쓰는 곡은 PDF 원본 그대로(가장 선명), 나눈 곡은 페이지 이미지로
      async function pageBlob(p) {
        var W = demo() ? 1100 : 2000, Q = demo() ? 0.7 : 0.85;
        if (p.img) return U.resizeImage(p.img, demo() ? 1500 : 2800, Q);
        var pg = await p.doc.getPage(p.n), v1 = pg.getViewport({ scale: 1 }), s = W / v1.width;
        if (v1.width * s * v1.height * s > 16e6) s = Math.sqrt(16e6 / (v1.width * v1.height));
        var vp = pg.getViewport({ scale: s }), cv = document.createElement('canvas');
        cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
        await pg.render({ canvasContext: cx, viewport: vp }).promise;
        var blob = await new Promise(function (r) { cv.toBlob(r, 'image/jpeg', Q); });
        cv.width = cv.height = 0;
        if (!blob) throw new Error('페이지를 그림으로 바꾸지 못했어요.');
        return blob;
      }
      async function save() {
        if (busy) return;
        var gs = groups().filter(function (g) { return g.use.length && !g.head.done; });
        var bad = gs.filter(function (g) { return !String(g.head.gTitle || '').trim(); });
        if (bad.length) {
          bad.forEach(function (g) { var inp = U.$('[data-t="' + g.idx[0] + '"]', wrap); if (inp) inp.classList.add('bad'); });
          var first = U.$('.sp-title.bad', wrap); if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
          U.toast('곡 제목을 모두 적어 주세요.', 'error'); return;
        }
        if (!gs.length) { U.toast('저장할 곡이 없어요.', 'error'); return; }
        var setSel = U.$('#sp-set', wrap), setTarget = setSel ? setSel.value : '';
        busy = true; wrap.classList.add('busy');
        var prog = U.$('#sp-prog', wrap), newOnes = [];
        U.$$('[data-save]', wrap).forEach(function (b) { b.disabled = true; });
        try {
          for (var k = 0; k < gs.length; k++) {
            var g = gs[k], h = g.head, fi = fileInfo[h.f];
            var whole = fi.pdf && g.use.length === fi.pages && g.use.every(function (i) { return pages[i].f === h.f; });
            var row = { title: h.gTitle.trim(), song_key: (h.gKey || '').trim(), artist: (h.gArtist || '').trim(), page_count: g.use.length, pages: [] };
            prog.textContent = (k + 1) + '/' + gs.length + '곡 · ' + row.title + ' 올리는 중…';
            if (whole) {
              var up = await App.api.scores.uploadFile(fi.file);
              Object.assign(row, { file_path: up.path, file_name: fi.name, file_size: fi.file.size });
            } else {
              var b = batchId(), paths = [], names = {};
              for (var j = 0; j < g.use.length; j++) {
                var p = pages[g.use[j]];
                prog.textContent = (k + 1) + '/' + gs.length + '곡 · ' + row.title + ' (' + (j + 1) + '/' + g.use.length + '쪽) 올리는 중…';
                var path = await App.api.scores.uploadImage(await pageBlob(p), 'pages/' + b + '/' + (j + 1) + '.jpg');
                paths.push(path); names[fileInfo[p.f].name] = 1;
              }
              Object.assign(row, { pages: paths, file_path: null, file_name: Object.keys(names).join(', ') });
            }
            var s = await App.api.scores.save(row);
            saved.push(s); newOnes.push(s); h.done = true;
          }
          if (setTarget) {
            var sl = await App.api.setlists.get(setTarget);
            await App.api.setlists.save({ id: sl.id, items: (sl.items || []).concat(newOnes.map(function (s) { return { score_id: s.id }; })) });
          }
          U.toast(newOnes.length + '곡을 저장했어요.' + (setTarget ? ' 콘티에도 넣었어요.' : ''));
          busy = false; close();
        } catch (e) {
          busy = false; wrap.classList.remove('busy');
          U.toast(U.errMsg(e), 'error');
          draw();
          var pr = U.$('#sp-prog', wrap); if (pr) pr.textContent = saved.length ? saved.length + '곡은 저장됐어요. 나머지를 다시 저장해 주세요.' : '';
        }
      }
    });
  };

  /* ---------- 악보 정보 수정 (관리자) ---------- */
  function editScore(s, onSaved) {
    U.modal({
      title: '악보 정보 수정',
      html: '<form class="form" id="se">' +
        '<label class="field"><span>곡 제목</span><input name="title" value="' + esc(s.title) + '" required></label>' +
        '<div class="grid2"><label class="field"><span>원래 키 (Key)</span><input name="song_key" value="' + esc(s.song_key || '') + '" placeholder="예) G, A→B♭"></label>' +
        '<label class="field"><span>아티스트</span><input name="artist" value="' + esc(s.artist || '') + '"></label></div>' +
        '<label class="field"><span>메모</span><input name="memo" value="' + esc(s.memo || '') + '" placeholder="예) 카포 2, 템포 72"></label>' +
        '<div class="row-between"><button type="button" class="btn btn-sm btn-ghost" data-replace>' + icon('refresh') + '파일 바꾸기 (PDF·사진)</button><span class="muted small">' +
          (s.pages && s.pages.length ? '이미지 ' + s.pages.length + '쪽' : 'PDF') + (s.file_name ? ' · ' + esc(s.file_name) : '') + '</span></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">저장</button></div></form>',
      onMount: function (root, close) {
        var f = root.querySelector('#se');
        root.querySelector('[data-replace]').onclick = async function () {
          var files = await pickFiles(true); if (!files.length) return;
          var pdfs = files.filter(isPdf), imgs = files.filter(isImg);
          if (pdfs.length > 1 || (pdfs.length && imgs.length)) { U.toast('PDF 한 개 또는 사진 여러 장으로 바꿀 수 있어요.', 'error'); return; }
          var btn = this; U.busy(btn, true);
          try {
            var old = filesOf(s), patch = { id: s.id };
            if (pdfs.length) {
              var up = await App.api.scores.uploadFile(pdfs[0]);
              Object.assign(patch, { file_path: up.path, file_name: up.name, file_size: up.size, pages: [], page_count: await Scores.countPages(pdfs[0]) });
            } else {
              var b = batchId(), paths = [];
              for (var i = 0; i < imgs.length; i++) paths.push(await App.api.scores.uploadImage(await U.resizeImage(imgs[i], demo() ? 1500 : 2800, demo() ? 0.7 : 0.85), 'pages/' + b + '/' + (i + 1) + '.jpg'));
              Object.assign(patch, { pages: paths, file_path: null, file_name: imgs.map(function (x) { return x.name; }).join(', '), file_size: null, page_count: paths.length });
            }
            var saved = await App.api.scores.save(patch);
            await App.api.scores.removeFiles(old);
            Object.assign(s, saved); U.toast('파일을 바꿨어요.'); close(); onSaved && onSaved(s);
          } catch (e) { U.toast(U.errMsg(e), 'error'); U.busy(btn, false); }
        };
        f.onsubmit = async function (e) {
          e.preventDefault(); var d = U.formData(f);
          try {
            var saved = await App.api.scores.save({ id: s.id, title: d.title, song_key: d.song_key, artist: d.artist, memo: d.memo });
            Object.assign(s, saved); close(); onSaved && onSaved(s); U.toast('저장했어요.');
          } catch (err) { U.toast(U.errMsg(err), 'error'); }
        };
      }
    });
  }

  /* =====================================================================
   *  관리자: 콘티 관리 | 악보 라이브러리
   * ===================================================================== */
  App.route('/admin/scores', async function (ctx) {
    var r = await Promise.all([App.api.scores.list(), App.api.setlists.list()]);
    if (!ctx.alive()) return;
    var scores = r[0], sets = sortSetlists(r[1]), map = byId(scores);
    var tab = ctx.query.tab === 'lib' ? 'lib' : 'sets', q = '';
    var t = today(), up = sets.filter(function (s) { return s.worship_date >= t; }), nextId = up.length ? up[0].id : null;
    function usedIn(id) { return sets.filter(function (sl) { return (sl.items || []).some(function (it) { return String(it.score_id) === String(id); }); }); }

    function drawSets() {
      return '<div class="toolbar"><div class="tb-left"><a class="btn btn-primary" href="#/admin/setlists/new">' + icon('plus') + '새 콘티 만들기</a></div></div>' +
        (sets.length ? sets.map(function (sl) {
          var es = entries(sl, map);
          return '<section class="panel"><div class="panel-head"><h2>' + setTitleHTML(sl, nextId) + ' <span class="muted small">&nbsp;' + es.length + '곡</span></h2>' +
            '<div class="row-tools">' + (es.length ? '<a class="btn btn-sm btn-ghost" href="#/scores/' + es[0].score.id + '?set=' + sl.id + '&i=' + es[0].i + '">' + icon('eye') + '보기</a>' : '') +
            '<a class="btn btn-sm btn-ghost" href="#/admin/setlists/' + sl.id + '">' + icon('edit') + '순서·수정</a>' +
            '<button class="btn btn-sm btn-ghost" data-copy="' + sl.id + '">복사</button>' +
            '<button class="icon-btn danger-text" data-del-set="' + sl.id + '" aria-label="삭제">' + icon('trash') + '</button></div></div>' +
            '<div class="panel-body">' + (es.length ? '<ol class="sl-mini">' + es.map(function (e) {
              var k = keyOf(e); return '<li><b>' + esc(e.score.title) + '</b>' + (k ? ' <span class="key-chip sm">' + esc(k) + '</span>' : '') + (e.item.memo ? ' <span class="muted small">' + esc(e.item.memo) + '</span>' : '') + '</li>';
            }).join('') + '</ol>' : '<p class="muted small">곡이 없어요. <a href="#/admin/setlists/' + sl.id + '">곡 추가하기</a></p>') +
            (sl.memo ? '<p class="sl-memo">' + U.text(sl.memo) + '</p>' : '') + '</div></section>';
        }).join('') : '<div class="empty">아직 콘티가 없어요.<br><small>예배 날짜를 정하고 곡을 골라 순서를 정해 보세요.</small></div>');
    }
    function drawLib() {
      var list = scores.filter(function (s) { return !q || (s.title + ' ' + (s.artist || '') + ' ' + (s.song_key || '')).toLowerCase().indexOf(q) >= 0; });
      return '<div class="toolbar"><div class="tb-left">' +
          '<button class="btn btn-primary" id="as-up">' + icon('plus') + '악보 올리기 (PDF·사진)</button>' +
          '<input class="search" type="search" id="as-q" placeholder="곡 검색" value="' + esc(q) + '"></div></div>' +
        '<p class="muted small">여러 곡이 한 PDF에 들어 있어도 괜찮아요. 올리면 페이지를 곡별로 나누고 이름을 붙이는 화면이 열려요. 파일 이름의 괄호 키(예: "주의 이름 높이며 (G).pdf")는 자동으로 키 칸에 들어가요.</p>' +
        '<section class="panel"><div class="panel-body"><div class="table-wrap"><table class="tbl"><thead><tr><th>제목</th><th>키</th><th>아티스트</th><th>쪽</th><th>콘티</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (s) {
          var u = usedIn(s.id).length;
          return '<tr><td data-label="제목"><b>' + esc(s.title) + '</b>' + (s.memo ? '<div class="muted small">' + esc(s.memo) + '</div>' : '') + '</td>' +
            '<td data-label="키">' + (s.song_key ? '<span class="key-chip">' + esc(s.song_key) + '</span>' : '-') + '</td>' +
            '<td data-label="아티스트">' + esc(s.artist || '-') + '</td>' +
            '<td data-label="쪽">' + (s.page_count || filesOf(s).length || '-') + (s.pages && s.pages.length ? ' <span class="chip">이미지</span>' : ' <span class="chip">PDF</span>') + '</td>' +
            '<td data-label="콘티">' + (u ? u + '곳' : '-') + '</td>' +
            '<td data-label=""><div class="row-tools"><a class="btn btn-sm btn-ghost" href="#/scores/' + s.id + '">보기</a><button class="btn btn-sm btn-ghost" data-edit="' + s.id + '">수정</button><button class="icon-btn danger-text" data-del="' + s.id + '" aria-label="삭제">' + icon('trash') + '</button></div></td></tr>';
        }).join('') : '<tr><td colspan="6"><div class="empty sm">' + (q ? '검색 결과가 없어요.' : '아직 올린 악보가 없어요.') + '</div></td></tr>') +
        '</tbody></table></div></div></section>';
    }
    function draw() {
      U.$$('[data-tab]', ctx.el).forEach(function (a) { a.classList.toggle('on', a.dataset.tab === tab); });
      var box = U.$('#as-body', ctx.el);
      box.innerHTML = tab === 'lib' ? drawLib() : drawSets();
      bind(box);
    }
    function bind(box) {
      var upBtn = U.$('#as-up', box);
      if (upBtn) upBtn.onclick = async function () {
        var files = await pickFiles(true); if (!files.length) return;
        var got = await Scores.splitter(files, { setlists: sets });
        if (got.length) { r = await Promise.all([App.api.scores.list(), App.api.setlists.list()]); scores = r[0]; sets = sortSetlists(r[1]); map = byId(scores); draw(); }
      };
      var qi = U.$('#as-q', box);
      if (qi) qi.oninput = U.debounce(function (e) { q = e.target.value.trim().toLowerCase(); draw(); var n = U.$('#as-q', ctx.el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200);
      U.$$('[data-edit]', box).forEach(function (b) { b.onclick = function () { editScore(map[b.dataset.edit], draw); }; });
      U.$$('[data-del]', box).forEach(function (b) {
        b.onclick = async function () {
          var s = map[b.dataset.del], u = usedIn(s.id);
          if (!(await U.confirm('"' + s.title + '" 악보를 삭제할까요?\n파일도 함께 지워져요.' + (u.length ? '\n이 곡이 들어 있는 콘티 ' + u.length + '곳에서도 빠져요.' : ''), '삭제', true))) return;
          try {
            await App.api.scores.remove(s.id);
            scores = scores.filter(function (x) { return x !== s; }); map = byId(scores);
            sets.forEach(function (sl) { sl.items = (sl.items || []).filter(function (it) { return String(it.score_id) !== String(s.id); }); });
            draw(); U.toast('삭제했어요.');
          } catch (e) { U.toast(U.errMsg(e), 'error'); }
        };
      });
      U.$$('[data-del-set]', box).forEach(function (b) {
        b.onclick = async function () {
          var sl = sets.filter(function (x) { return String(x.id) === b.dataset.delSet; })[0];
          if (!(await U.confirm(dateLabel(sl.worship_date) + ' 콘티를 삭제할까요?\n악보는 라이브러리에 그대로 남아요.', '삭제', true))) return;
          try { await App.api.setlists.remove(sl.id); sets = sets.filter(function (x) { return x !== sl; }); draw(); U.toast('콘티를 삭제했어요.'); } catch (e) { U.toast(U.errMsg(e), 'error'); }
        };
      });
      U.$$('[data-copy]', box).forEach(function (b) {
        b.onclick = function () { App.go('/admin/setlists/new?copy=' + b.dataset.copy); };
      });
    }
    ctx.el.innerHTML =
      '<div class="toolbar"><nav class="tabs-line" style="margin:0;border:0"><a href="#/admin/scores" data-tab="sets">콘티 관리</a><a href="#/admin/scores?tab=lib" data-tab="lib">악보 라이브러리 <small class="muted">' + scores.length + '</small></a></nav>' +
      '<div class="tb-right"><a class="btn btn-ghost btn-sm" href="#/admin/members?team=worship">' + icon('users') + '찬양팀 명단</a><a class="btn btn-ghost btn-sm" href="#/scores">' + icon('eye') + '찬양팀 화면 보기</a></div></div>' +
      '<div id="as-body"></div>';
    U.$$('[data-tab]', ctx.el).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); tab = a.dataset.tab; history.replaceState(null, '', a.getAttribute('href')); draw(); }; });
    draw();
  }, { title: '찬양팀 콘티·악보', admin: true });

  /* =====================================================================
   *  관리자: 콘티 만들기·순서 정하기
   * ===================================================================== */
  App.route('/admin/setlists/:id', async function (ctx) {
    var isNew = ctx.params.id === 'new';
    var r = await Promise.all([App.api.scores.list(), isNew ? null : App.api.setlists.get(ctx.params.id), App.api.setlists.list()]);
    if (!ctx.alive()) return;
    var scores = r[0], map = byId(scores), all = r[2];
    var sl = r[1] || { worship_date: ctx.query.date || U.sundayOf(new Date()), title: '', memo: '', items: [] };
    if (isNew && ctx.query.copy) {
      var src = all.filter(function (x) { return String(x.id) === ctx.query.copy; })[0];
      if (src) {
        var nd = U.toDate(src.worship_date); nd.setDate(nd.getDate() + 7);
        var next = U.ymd(nd); if (next < today()) next = U.sundayOf(new Date());
        sl = { worship_date: next, title: src.title || '', memo: src.memo || '', items: JSON.parse(JSON.stringify(src.items || [])) };
      }
    }
    var items = (sl.items || []).filter(function (it) { return map[String(it.score_id)]; }).map(function (it) { return { score_id: it.score_id, key: it.key || '', memo: it.memo || '' }; });
    var dirty = isNew && !!items.length;

    function setDirty(v) { dirty = v; var c = U.$('#sl-dirty', ctx.el); if (c) c.style.display = dirty ? '' : 'none'; }
    function onBeforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', onBeforeUnload);
    App.onLeave(function () { window.removeEventListener('beforeunload', onBeforeUnload); });

    ctx.el.innerHTML =
      '<div class="toolbar"><div class="tb-left"><a class="btn btn-ghost btn-sm" href="#/admin/scores">' + icon('chevron-left') + '콘티 목록</a>' +
        '<span class="chip chip-warn" id="sl-dirty" style="display:none">저장하지 않은 변경</span></div>' +
        '<div class="tb-right">' + (isNew ? '' : '<a class="btn btn-ghost btn-sm" href="#/scores">' + icon('eye') + '찬양팀 화면</a>') +
        '<button class="btn btn-primary" data-save-sl>' + icon('check') + '저장</button></div></div>' +
      '<div class="two-col sl-cols">' +
        '<section class="panel"><div class="panel-head"><h2>콘티 정보</h2></div><div class="panel-body form">' +
          '<label class="field"><span>예배 날짜 <em>*</em></span><input type="date" id="sl-date" value="' + esc(sl.worship_date || '') + '" required></label>' +
          '<label class="field"><span>이름 <small class="muted">(선택)</small></span><input id="sl-title" value="' + esc(sl.title || '') + '" placeholder="예) 주일 예배, 수련회 둘째 날"></label>' +
          '<label class="field"><span>진행 메모 <small class="muted">(찬양팀에게 보여요)</small></span><textarea id="sl-memo" rows="4" placeholder="예) 2곡 끝나고 기도, 마지막 곡 후렴 2번">' + esc(sl.memo || '') + '</textarea></label>' +
        '</div></section>' +
        '<section class="panel"><div class="panel-head"><h2>곡 순서 <span class="muted small" id="sl-count" style="margin-left:4px"></span></h2>' +
          '<div class="row-tools"><button class="btn btn-sm btn-ghost" data-add-lib>' + icon('plus') + '라이브러리에서 추가</button><button class="btn btn-sm btn-ghost" data-add-up>' + icon('plus') + 'PDF·사진 올려서 추가</button></div></div>' +
          '<div class="panel-body"><p class="muted small sl-tip">' + SVG.grip + ' 손잡이를 끌어서 순서를 바꾸거나 화살표를 누르세요. 키·메모는 이번 콘티에만 적용돼요.</p><ol class="sl-list" id="sl-list"></ol></div></section>' +
      '</div>' +
      '<div class="sl-savebar"><button class="btn btn-primary btn-block" data-save-sl>' + icon('check') + '콘티 저장</button></div>';

    U.$('#sl-date', ctx.el).onchange = U.$('#sl-title', ctx.el).oninput = U.$('#sl-memo', ctx.el).oninput = function () { setDirty(true); };

    function drawList() {
      var ol = U.$('#sl-list', ctx.el);
      U.$('#sl-count', ctx.el).textContent = items.length ? items.length + '곡' : '';
      ol.innerHTML = items.length ? items.map(function (it, i) {
        var s = map[String(it.score_id)];
        return '<li class="sl-item" data-i="' + i + '">' +
          '<button type="button" class="drag-h" aria-label="끌어서 순서 바꾸기">' + SVG.grip + '</button>' +
          '<span class="sr-no">' + (i + 1) + '</span>' +
          '<div class="sl-main"><b>' + esc(s.title) + '</b><small class="muted">' + [s.artist, s.song_key ? '원키 ' + s.song_key : '', (s.page_count || filesOf(s).length) + '쪽'].filter(Boolean).map(esc).join(' · ') + '</small></div>' +
          '<input class="sl-key" data-key="' + i + '" value="' + esc(it.key) + '" placeholder="' + esc(s.song_key || '키') + '" aria-label="이번 키">' +
          '<input class="sl-imemo" data-memo="' + i + '" value="' + esc(it.memo) + '" placeholder="메모 (예: 후렴 2번)" aria-label="메모">' +
          '<span class="sl-btns"><button type="button" class="icon-btn sm" data-mv="' + i + '|-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">' + SVG.up + '</button>' +
          '<button type="button" class="icon-btn sm" data-mv="' + i + '|1"' + (i === items.length - 1 ? ' disabled' : '') + ' aria-label="아래로">' + SVG.down + '</button>' +
          '<button type="button" class="icon-btn sm danger-text" data-rm="' + i + '" aria-label="콘티에서 빼기">' + icon('close') + '</button></span></li>';
      }).join('') : '<li class="empty sm">아직 곡이 없어요. 위의 버튼으로 곡을 추가해 주세요.</li>';
      U.$$('[data-key]', ol).forEach(function (inp) { inp.oninput = function () { items[+inp.dataset.key].key = inp.value.trim(); setDirty(true); }; });
      U.$$('[data-memo]', ol).forEach(function (inp) { inp.oninput = function () { items[+inp.dataset.memo].memo = inp.value; setDirty(true); }; });
      U.$$('[data-mv]', ol).forEach(function (b) {
        b.onclick = function () {
          var p = b.dataset.mv.split('|'), i = +p[0], j = i + (+p[1]); if (j < 0 || j >= items.length) return;
          var x = items.splice(i, 1)[0]; items.splice(j, 0, x); setDirty(true); drawList();
          var nb = U.$('[data-mv="' + j + '|' + p[1] + '"]', ol); if (nb && !nb.disabled) nb.focus();
        };
      });
      U.$$('[data-rm]', ol).forEach(function (b) { b.onclick = function () { items.splice(+b.dataset.rm, 1); setDirty(true); drawList(); }; });
      bindDrag(ol, function (order) {
        var changed = order.some(function (v, k) { return v !== k; });
        if (changed) { items = order.map(function (k) { return items[k]; }); setDirty(true); }
        drawList();
      });
    }

    // 끌어서 순서 바꾸기 (마우스·터치 공통)
    function bindDrag(ol, done) {
      U.$$('.drag-h', ol).forEach(function (h) {
        h.addEventListener('pointerdown', function (e) {
          if (e.button) return;
          e.preventDefault();
          var row = h.closest('.sl-item'), id = e.pointerId;
          row.classList.add('dragging'); ol.classList.add('is-dragging');
          function move(ev) {
            if (ev.pointerId !== id) return;
            ev.preventDefault();
            // 끌고 있는 줄은 그대로 두고 옆 줄을 옮김 (손가락이 닿은 요소가 DOM에서 빠지면 터치가 취소되기 때문)
            var y = ev.clientY, s, b, guard = 0;
            while ((s = row.previousElementSibling) && guard++ < 50) { b = s.getBoundingClientRect(); if (y < b.top + b.height / 2) ol.insertBefore(s, row.nextElementSibling); else break; }
            while ((s = row.nextElementSibling) && guard++ < 100) { b = s.getBoundingClientRect(); if (y > b.top + b.height / 2) ol.insertBefore(s, row); else break; }
            if (y < 80) window.scrollBy(0, -14); else if (y > window.innerHeight - 80) window.scrollBy(0, 14);
          }
          function up(ev) {
            if (ev.pointerId !== id) return;
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
            row.classList.remove('dragging'); ol.classList.remove('is-dragging');
            done(U.$$('.sl-item', ol).map(function (x) { return +x.dataset.i; }));
          }
          document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
        });
      });
    }

    function addScores(list) {
      list.forEach(function (s) { map[String(s.id)] = s; items.push({ score_id: s.id, key: '', memo: '' }); });
      if (list.length) { setDirty(true); drawList(); }
    }
    U.$('[data-add-lib]', ctx.el).onclick = function () {
      var picked = {};
      U.modal({
        title: '라이브러리에서 곡 추가', wide: true,
        html: '<input class="search" type="search" id="lib-q" placeholder="곡 제목·아티스트 검색" style="max-width:none;width:100%">' +
          '<div class="lib-pick" id="lib-list"></div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-up-new>' + icon('plus') + '새 악보 올리기</button><span style="flex:1"></span><button type="button" class="btn btn-ghost" data-close>취소</button><button type="button" class="btn btn-primary" data-ok>추가</button></div>',
        onMount: function (root, close) {
          var q = '', inSet = {}; items.forEach(function (it) { inSet[String(it.score_id)] = 1; });
          var order = [];
          function drawPick() {
            var list = scores.filter(function (s) { return !q || (s.title + ' ' + (s.artist || '')).toLowerCase().indexOf(q) >= 0; });
            U.$('#lib-list', root).innerHTML = list.length ? list.map(function (s) {
              return '<label class="check lib-row"><input type="checkbox" value="' + s.id + '"' + (picked[s.id] ? ' checked' : '') + '><span><b>' + esc(s.title) + '</b>' +
                (s.song_key ? ' <span class="key-chip sm">' + esc(s.song_key) + '</span>' : '') + (s.artist ? ' <small class="muted">' + esc(s.artist) + '</small>' : '') +
                (inSet[String(s.id)] ? ' <span class="chip">이미 있음</span>' : '') + '</span></label>';
            }).join('') : '<div class="empty sm">' + (scores.length ? '검색 결과가 없어요.' : '라이브러리에 악보가 없어요. 새 악보를 올려 주세요.') + '</div>';
            U.$$('input[type=checkbox]', root).forEach(function (c) {
              c.onchange = function () { if (c.checked) { picked[c.value] = 1; order.push(c.value); } else { delete picked[c.value]; order = order.filter(function (v) { return v !== c.value; }); } upd(); };
            });
            upd();
          }
          function upd() { var n = Object.keys(picked).length; root.querySelector('[data-ok]').textContent = n ? n + '곡 추가' : '추가'; }
          U.$('#lib-q', root).oninput = U.debounce(function (e) { q = e.target.value.trim().toLowerCase(); drawPick(); }, 120);
          root.querySelector('[data-ok]').onclick = function () { addScores(order.map(function (id) { return map[id]; }).filter(Boolean)); close(); };
          root.querySelector('[data-up-new]').onclick = function () { close(); uploadAndAdd(); };
          drawPick();
          setTimeout(function () { var i = U.$('#lib-q', root); if (i && window.innerWidth > 700) i.focus(); }, 50);
        }
      });
    };
    async function uploadAndAdd() {
      var files = await pickFiles(true); if (!files.length) return;
      var got = await Scores.splitter(files, {});
      if (got.length) { scores = scores.concat(got); addScores(got); U.toast('콘티에 ' + got.length + '곡을 넣었어요. 저장을 눌러 주세요.'); }
    }
    U.$('[data-add-up]', ctx.el).onclick = uploadAndAdd;

    async function save() {
      var date = U.$('#sl-date', ctx.el).value;
      if (!date) { U.toast('예배 날짜를 정해 주세요.', 'error'); U.$('#sl-date', ctx.el).focus(); return; }
      var btns = U.$$('[data-save-sl]', ctx.el); btns.forEach(function (b) { U.busy(b, true); });
      try {
        var row = { worship_date: date, title: U.$('#sl-title', ctx.el).value.trim(), memo: U.$('#sl-memo', ctx.el).value.trim(),
          items: items.map(function (it) { var o = { score_id: it.score_id }; if (it.key) o.key = it.key; if (it.memo && it.memo.trim()) o.memo = it.memo.trim(); return o; }) };
        if (sl.id) row.id = sl.id;
        var savedRow = await App.api.setlists.save(row);
        setDirty(false); U.toast('콘티를 저장했어요.');
        if (!sl.id) { App.go('/admin/setlists/' + savedRow.id, true); return; }
        sl = savedRow;
      } catch (e) { U.toast(U.errMsg(e), 'error'); }
      btns.forEach(function (b) { U.busy(b, false); });
    }
    U.$$('[data-save-sl]', ctx.el).forEach(function (b) { b.onclick = save; });
    drawList();
    setDirty(dirty);
  }, { title: '콘티 만들기', admin: true });
})();
