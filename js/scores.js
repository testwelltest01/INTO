/* =====================================================================
 * 찬양팀 악보
 *  - 찬양팀(관리자 지정) + 관리자만 열람, 업로드는 관리자만
 *  - pdf.js 로 페이지별 선명하게 렌더링: 세로 스크롤 / 한 장씩 넘기기
 *  - 확대·축소(버튼·두 손가락), 다음 곡/이전 곡, 화면 꺼짐 방지, 페달(←/→, PageUp/Down)
 *  - 한 번 연 악보는 이 기기에 보관 → 예배 장소 인터넷이 약해도 열림 (로그아웃 시 삭제)
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon;
  var CACHE = 'into-scores-v1';
  var PDFJS = 'assets/vendor/pdfjs/';

  var Scores = window.Scores = {};

  App.inTeam = function (t) {
    var p = App.profile();
    return !!(p && p.status === 'active' && (p.role === 'admin' || (p.teams || []).indexOf(t) >= 0));
  };

  /* ---------- 기기 보관 (Cache Storage) ---------- */
  function cacheKey(path) { return location.origin + '/__scores/' + encodeURIComponent(path); }
  Scores.cached = async function (path) {
    try { var c = await caches.open(CACHE); return !!(await c.match(cacheKey(path))); } catch (e) { return false; }
  };
  Scores.clearCache = function () { try { if (window.caches) caches.delete(CACHE); } catch (e) { } };
  Scores.load = async function (row) {
    var key = cacheKey(row.file_path), c = null;
    try { c = await caches.open(CACHE); var hit = await c.match(key); if (hit) return hit.arrayBuffer(); } catch (e) { }
    var buf = await App.api.scores.fetchFile(row);
    try { if (c) await c.put(key, new Response(buf.slice(0), { headers: { 'Content-Type': 'application/pdf' } })); } catch (e) { }
    return buf;
  };

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

  function groupByDate(list) {
    var groups = [], map = {};
    list.forEach(function (s) { var k = s.worship_date || ''; if (!map[k]) { map[k] = []; groups.push({ date: k, items: map[k] }); } map[k].push(s); });
    var sun = U.sundayOf(new Date());
    groups.sort(function (a, b) {
      if (!a.date) return 1; if (!b.date) return -1;
      var af = a.date >= sun, bf = b.date >= sun;
      if (af && bf) return a.date < b.date ? -1 : 1;    // 다가오는 콘티: 가까운 날짜 먼저
      if (af !== bf) return af ? -1 : 1;                // 다가오는 콘티가 지난 콘티보다 위
      return a.date < b.date ? 1 : -1;                  // 지난 콘티: 최근 먼저
    });
    return groups;
  }
  function groupTitle(date) {
    if (!date) return '날짜 없는 악보';
    var sun = U.sundayOf(new Date());
    return U.weekLabel(date) + ' 콘티' + (date === sun ? ' <span class="chip chip-dark">이번 주</span>' : date > sun ? ' <span class="chip">예정</span>' : '');
  }
  function noTeam() {
    return '<div class="card login-card">' + icon('lock') + '<p><b>찬양팀만 볼 수 있어요</b></p><p class="muted small">찬양팀이라면 관리자에게 "찬양팀 지정"을 요청해 주세요.</p></div>';
  }

  /* ---------- 악보 목록 ---------- */
  App.route('/scores', async function (ctx) {
    if (!App.inTeam('worship')) { ctx.el.innerHTML = App.pageHead('찬양팀 악보') + '<section class="container narrow">' + noTeam() + '</section>'; return; }
    var list = await App.api.scores.list();
    if (!ctx.alive()) return;
    var q = '';
    var cachedSet = {};
    await Promise.all(list.map(function (s) { return Scores.cached(s.file_path).then(function (v) { cachedSet[s.id] = v; }); }));
    function draw() {
      var shown = list.filter(function (s) { return !q || (s.title + ' ' + (s.artist || '') + ' ' + (s.song_key || '')).toLowerCase().indexOf(q) >= 0; });
      var groups = groupByDate(shown);
      U.$('#score-groups', ctx.el).innerHTML = groups.length ? groups.map(function (g) {
        return '<section class="score-group"><div class="sg-head"><h2>' + groupTitle(g.date) + '</h2>' +
          (g.date ? '<button class="btn btn-sm btn-ghost" data-save-all="' + esc(g.date) + '">' + icon('download') + '오프라인 저장</button>' : '') + '</div>' +
          '<div class="list-card">' + g.items.map(function (s, i) {
            return '<a class="list-row score-row" href="#/scores/' + s.id + '"><span class="sr-no">' + (g.date ? i + 1 : icon('music')) + '</span>' +
              '<span class="lr-body"><span class="lr-title">' + esc(s.title) + '</span><span class="lr-sub">' + [s.artist, s.page_count ? s.page_count + '쪽' : '', s.memo].filter(Boolean).map(esc).join(' · ') + '</span></span>' +
              (s.song_key ? '<span class="key-chip">' + esc(s.song_key) + '</span>' : '') +
              (cachedSet[s.id] ? '<span class="saved-dot" title="이 기기에 저장됨">' + icon('check') + '</span>' : '') + '</a>';
          }).join('') + '</div></section>';
      }).join('') : '<div class="empty">' + (q ? '검색 결과가 없어요.' : '아직 올라온 악보가 없어요.') + '</div>';
      U.$$('[data-save-all]', ctx.el).forEach(function (b) {
        b.onclick = async function () {
          var items = list.filter(function (s) { return s.worship_date === b.dataset.saveAll; });
          U.busy(b, true);
          var okN = 0;
          for (var i = 0; i < items.length; i++) { try { await Scores.load(items[i]); cachedSet[items[i].id] = true; okN++; } catch (e) { } }
          U.toast(okN + '곡을 이 기기에 저장했어요. 인터넷이 약해도 열 수 있어요.');
          draw();
        };
      });
    }
    ctx.el.innerHTML = App.pageHead('찬양팀 악보', '콘티별 악보 · 한 번 연 악보는 이 기기에 저장돼요') +
      '<section class="container narrow"><input class="search score-search" type="search" placeholder="곡 제목·아티스트·키 검색" id="score-q"><div id="score-groups"></div>' +
      (App.isAdmin() ? '<a class="btn btn-ghost btn-block" href="#/admin/scores">' + icon('settings') + '악보 올리기 · 관리</a>' : '') + '</section>';
    U.$('#score-q', ctx.el).oninput = U.debounce(function (e) { q = e.target.value.trim().toLowerCase(); draw(); }, 120);
    draw();
  }, { title: '찬양팀 악보', auth: true });

  /* ---------- 악보 보기 (PDF 뷰어) ---------- */
  App.route('/scores/:id', async function (ctx) {
    if (!App.inTeam('worship')) { ctx.el.innerHTML = '<section class="container narrow">' + noTeam() + '</section>'; return; }
    var r = await Promise.all([App.api.scores.get(ctx.params.id), App.api.scores.list()]);
    if (!ctx.alive()) return;
    var row = r[0], list = r[1];
    var set = row.worship_date ? list.filter(function (s) { return s.worship_date === row.worship_date; }) : [row];
    var idx = set.findIndex(function (s) { return String(s.id) === String(row.id); });
    var prefs = {}; try { prefs = JSON.parse(localStorage.getItem('into_score_prefs') || '{}'); } catch (e) { }
    var mode = prefs.mode || 'scroll', zoom = 1, page = 1, doc = null, wake = null, destroyed = false;

    document.body.classList.add('viewer-mode');
    ctx.el.innerHTML =
      '<div class="pv" id="pv">' +
        '<header class="pv-bar">' +
          '<button class="icon-btn" data-back aria-label="목록으로">' + icon('chevron-left') + '</button>' +
          '<div class="pv-title"><b>' + esc(row.title) + '</b><small>' + [row.song_key ? 'Key ' + row.song_key : '', row.artist].filter(Boolean).map(esc).join(' · ') + '<span id="pv-pg"></span></small></div>' +
          '<div class="pv-tools">' +
            '<button class="icon-btn" data-zoom="-1" aria-label="축소"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg></button>' +
            '<button class="icon-btn" data-zoom="1" aria-label="확대"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg></button>' +
            '<button class="pv-btn" data-mode></button>' +
            ('wakeLock' in navigator ? '<button class="pv-btn" data-wake aria-pressed="false">' + icon('eye') + '<span>화면 켜 두기</span></button>' : '') +
          '</div>' +
        '</header>' +
        '<div class="pv-pages" id="pv-pages"><div class="loading"><span class="spinner"></span></div></div>' +
        '<div class="pv-tap pv-tap-l" data-tap="-1"></div><div class="pv-tap pv-tap-r" data-tap="1"></div>' +
        (set.length > 1 ? '<footer class="pv-nav">' +
          '<button class="pv-btn" data-song="-1"' + (idx <= 0 ? ' disabled' : '') + '>' + icon('chevron-left') + '<span>' + (idx > 0 ? esc(set[idx - 1].title) : '이전 곡') + '</span></button>' +
          '<span class="pv-count">' + (idx + 1) + ' / ' + set.length + '곡</span>' +
          '<button class="pv-btn" data-song="1"' + (idx >= set.length - 1 ? ' disabled' : '') + '><span>' + (idx < set.length - 1 ? esc(set[idx + 1].title) : '다음 곡') + '</span>' + icon('chevron-right') + '</button>' +
        '</footer>' : '') +
      '</div>';

    var pv = U.$('#pv', ctx.el), pagesEl = U.$('#pv-pages', ctx.el), pgLabel = U.$('#pv-pg', ctx.el);
    function savePrefs() { try { localStorage.setItem('into_score_prefs', JSON.stringify({ mode: mode })); } catch (e) { } }
    function setModeBtn() { var b = U.$('[data-mode]', ctx.el); b.innerHTML = mode === 'scroll' ? icon('book') + '<span>한 장씩</span>' : icon('menu') + '<span>세로 스크롤</span>'; pv.classList.toggle('mode-page', mode === 'page'); }
    function updateLabel() { if (doc) pgLabel.textContent = ' · ' + page + '/' + doc.numPages + '쪽'; }

    // 페이지 그리기: 화면 크기 × 확대 × 기기 해상도에 맞춰 선명하게
    var renderToken = 0;
    async function renderAll() {
      if (!doc || destroyed) return;
      var token = ++renderToken;
      var W = pagesEl.clientWidth, H = pagesEl.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      pagesEl.innerHTML = '';
      pagesEl.classList.toggle('zoomed', zoom > 1);
      var targets = mode === 'page' ? [page] : Array.from({ length: doc.numPages }, function (_, i) { return i + 1; });
      for (var t = 0; t < targets.length; t++) {
        if (token !== renderToken || destroyed) return;
        var n = targets[t];
        var p = await doc.getPage(n);
        var vp1 = p.getViewport({ scale: 1 });
        var cssW = mode === 'page' ? Math.min(W, (H - 8) * vp1.width / vp1.height) : W - 16;
        cssW *= zoom;
        var scale = cssW / vp1.width;
        var maxPx = 4096 * 4096, px = scale * dpr;
        if (vp1.width * vp1.height * px * px > maxPx) px = Math.sqrt(maxPx / (vp1.width * vp1.height));
        var vp = p.getViewport({ scale: px });
        var wrap = document.createElement('div'); wrap.className = 'pv-page'; wrap.dataset.page = n;
        var cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        cv.style.width = Math.floor(cssW) + 'px'; cv.style.height = Math.floor(cssW * vp1.height / vp1.width) + 'px';
        wrap.appendChild(cv);
        if (mode === 'scroll' && doc.numPages > 1) { var lb = document.createElement('div'); lb.className = 'pv-pnum'; lb.textContent = n + ' / ' + doc.numPages; wrap.appendChild(lb); }
        pagesEl.appendChild(wrap);
        await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
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
      if (!doc) return;
      if (mode === 'page') {
        var np = page + delta;
        if (np < 1 || np > doc.numPages) { if (set.length > 1) song(delta); return; }
        page = np; renderAll();
      } else {
        var el = U.$('.pv-page[data-page="' + Math.min(doc.numPages, Math.max(1, page + delta)) + '"]', pagesEl);
        if (el) pagesEl.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' });
      }
    }
    function song(delta) {
      var t = set[idx + delta]; if (!t) return;
      App.go('/scores/' + t.id, true);
    }
    function setZoom(z) { zoom = Math.max(1, Math.min(4, Math.round(z * 100) / 100)); renderAll(); }

    // 버튼
    U.$('[data-back]', ctx.el).onclick = function () { App.go('/scores'); };
    U.$$('[data-zoom]', ctx.el).forEach(function (b) { b.onclick = function () { setZoom(zoom + (+b.dataset.zoom) * 0.25); }; });
    U.$('[data-mode]', ctx.el).onclick = function () { mode = mode === 'scroll' ? 'page' : 'scroll'; zoom = 1; savePrefs(); setModeBtn(); renderAll(); };
    U.$$('[data-song]', ctx.el).forEach(function (b) { b.onclick = function () { song(+b.dataset.song); }; });
    U.$$('[data-tap]', ctx.el).forEach(function (b) { b.onclick = function () { if (mode === 'page' && zoom === 1) go(+b.dataset.tap); }; });
    var wb = U.$('[data-wake]', ctx.el);
    async function wakeOn() { try { wake = await navigator.wakeLock.request('screen'); wb.classList.add('on'); wb.setAttribute('aria-pressed', 'true'); wake.addEventListener('release', function () { if (wb) { wb.classList.remove('on'); wb.setAttribute('aria-pressed', 'false'); } }); } catch (e) { U.toast('이 기기에서는 화면 켜 두기를 쓸 수 없어요.'); } }
    if (wb) {
      wb.onclick = function () { if (wake) { wake.release(); wake = null; } else wakeOn(); };
    }
    function onVis() { if (document.visibilityState === 'visible' && wb && wb.classList.contains('on') && !wake) wakeOn(); }
    document.addEventListener('visibilitychange', onVis);

    // 키보드·블루투스 페달
    function onKey(e) {
      if (!document.body.contains(pv)) return;
      if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].indexOf(e.key) >= 0) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'ArrowUp'].indexOf(e.key) >= 0) { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') App.go('/scores');
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

    // 다른 화면으로 나가면 정리
    function cleanup() {
      destroyed = true;
      document.body.classList.remove('viewer-mode');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (wake) { try { wake.release(); } catch (e) { } wake = null; }
      if (io) io.disconnect();
      if (doc) { try { doc.destroy(); } catch (e) { } }
    }
    App.onLeave(cleanup);

    setModeBtn();
    try {
      var buf = await Scores.load(row);
      if (destroyed) return;
      doc = await Scores.open(buf);
      if (destroyed) { doc.destroy(); return; }
      if (!row.page_count && App.isAdmin()) App.api.scores.save({ id: row.id, page_count: doc.numPages }).catch(function () { });
      await renderAll();
      // 다음 곡 미리 받아 두기
      if (set[idx + 1]) Scores.load(set[idx + 1]).catch(function () { });
    } catch (e) {
      pagesEl.innerHTML = '<div class="empty" style="color:#ddd">악보를 열 수 없어요.<br><small>' + esc(U.errMsg(e)) + '</small></div>';
    }
  }, { title: '악보', auth: true });

  /* ---------- 관리자: 악보 올리기·관리 ---------- */
  App.route('/admin/scores', async function (ctx) {
    var list = await App.api.scores.list();
    if (!ctx.alive()) return;
    var sun = U.sundayOf(new Date());
    var date = ctx.query.date || sun, q = '';
    function draw() {
      var shown = list.filter(function (s) { return !q || (s.title + ' ' + (s.artist || '')).toLowerCase().indexOf(q) >= 0; });
      var groups = groupByDate(shown);
      U.$('#as-list', ctx.el).innerHTML = groups.length ? groups.map(function (g) {
        return '<section class="panel"><div class="panel-head"><h2>' + groupTitle(g.date) + ' <span class="muted small">&nbsp;' + g.items.length + '곡</span></h2></div>' +
          '<div class="panel-body"><div class="table-wrap"><table class="tbl"><thead><tr><th>순서</th><th>제목</th><th>키</th><th>아티스트</th><th>쪽</th><th></th></tr></thead><tbody>' +
          g.items.map(function (s, i) {
            return '<tr><td data-label="순서"><span class="nw">' + (g.date ? i + 1 : '-') + '</span>' +
              (g.date ? ' <button class="icon-btn sm" data-mv="' + s.id + '|-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">' + icon('chevron-left', 'rot90') + '</button><button class="icon-btn sm" data-mv="' + s.id + '|1"' + (i === g.items.length - 1 ? ' disabled' : '') + ' aria-label="아래로">' + icon('chevron-right', 'rot90') + '</button>' : '') + '</td>' +
              '<td data-label="제목"><b>' + esc(s.title) + '</b>' + (s.memo ? '<div class="muted small">' + esc(s.memo) + '</div>' : '') + '</td>' +
              '<td data-label="키">' + (s.song_key ? '<span class="key-chip">' + esc(s.song_key) + '</span>' : '-') + '</td>' +
              '<td data-label="아티스트">' + esc(s.artist || '-') + '</td>' +
              '<td data-label="쪽">' + (s.page_count || '-') + '</td>' +
              '<td data-label=""><div class="row-tools"><a class="btn btn-sm btn-ghost" href="#/scores/' + s.id + '">보기</a><button class="btn btn-sm btn-ghost" data-edit="' + s.id + '">수정</button><button class="icon-btn danger-text" data-del="' + s.id + '" aria-label="삭제">' + icon('trash') + '</button></div></td></tr>';
          }).join('') + '</tbody></table></div></div></section>';
      }).join('') : '<div class="empty">아직 올린 악보가 없어요. 위에서 콘티 날짜를 고르고 PDF를 올려 주세요.</div>';
      bindRows();
    }
    function bindRows() {
      U.$$('[data-del]', ctx.el).forEach(function (b) {
        b.onclick = async function () {
          var s = list.filter(function (x) { return String(x.id) === b.dataset.del; })[0];
          if (!(await U.confirm('"' + s.title + '" 악보를 삭제할까요?\n(파일도 함께 지워집니다)', '삭제', true))) return;
          try { await App.api.scores.remove(s.id); list = list.filter(function (x) { return x !== s; }); draw(); U.toast('삭제했어요.'); } catch (e) { U.toast(U.errMsg(e), 'error'); }
        };
      });
      U.$$('[data-mv]', ctx.el).forEach(function (b) {
        b.onclick = async function () {
          var p = b.dataset.mv.split('|'), s = list.filter(function (x) { return String(x.id) === p[0]; })[0];
          var grp = list.filter(function (x) { return x.worship_date === s.worship_date; }).sort(function (a, c) { return (a.sort_order || 0) - (c.sort_order || 0); });
          var i = grp.indexOf(s), j = i + (+p[1]); if (j < 0 || j >= grp.length) return;
          grp.splice(i, 1); grp.splice(j, 0, s);
          try {
            for (var k = 0; k < grp.length; k++) if (grp[k].sort_order !== k + 1) { grp[k].sort_order = k + 1; await App.api.scores.save({ id: grp[k].id, sort_order: k + 1 }); }
            list.sort(function (a, c) { return (a.sort_order || 0) - (c.sort_order || 0); }); draw();
          } catch (e) { U.toast(U.errMsg(e), 'error'); }
        };
      });
      U.$$('[data-edit]', ctx.el).forEach(function (b) {
        b.onclick = function () { edit(list.filter(function (x) { return String(x.id) === b.dataset.edit; })[0]); };
      });
    }
    function edit(s) {
      U.modal({
        title: '악보 정보 수정',
        html: '<form class="form" id="se">' +
          '<label class="field"><span>곡 제목</span><input name="title" value="' + esc(s.title) + '" required></label>' +
          '<div class="grid2"><label class="field"><span>키 (Key)</span><input name="song_key" value="' + esc(s.song_key || '') + '" placeholder="예) G, A→B♭"></label>' +
          '<label class="field"><span>아티스트</span><input name="artist" value="' + esc(s.artist || '') + '"></label></div>' +
          '<div class="grid2"><label class="field"><span>콘티 날짜</span><input type="date" name="worship_date" value="' + esc(s.worship_date || '') + '"></label>' +
          '<label class="field"><span>순서</span><input type="number" name="sort_order" value="' + (s.sort_order || 0) + '" min="0"></label></div>' +
          '<label class="field"><span>메모 (진행·반복 등)</span><input name="memo" value="' + esc(s.memo || '') + '" placeholder="예) 브릿지 2번, 후렴 반복"></label>' +
          '<div class="row-between"><button type="button" class="btn btn-sm btn-ghost" data-replace>' + icon('refresh') + 'PDF 파일 바꾸기</button><span class="muted small">' + esc(s.file_name || '') + '</span></div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">저장</button></div></form>',
        onMount: function (root, close) {
          var f = root.querySelector('#se');
          root.querySelector('[data-replace]').onclick = async function () {
            var file = await pickPdfs(false); if (!file || !file.length) return;
            var btn = this; U.busy(btn, true);
            try {
              var up = await App.api.scores.uploadFile(file[0]), pages = await Scores.countPages(file[0]);
              var old = s.file_path;
              var saved = await App.api.scores.save({ id: s.id, file_path: up.path, file_name: up.name, file_size: up.size, page_count: pages });
              await App.api.scores.removeFile(old);
              Object.assign(s, saved); U.toast('파일을 바꿨어요.'); close(); draw();
            } catch (e) { U.toast(U.errMsg(e), 'error'); U.busy(btn, false); }
          };
          f.onsubmit = async function (e) {
            e.preventDefault(); var d = U.formData(f);
            try {
              var saved = await App.api.scores.save({ id: s.id, title: d.title, song_key: d.song_key, artist: d.artist, worship_date: d.worship_date || null, sort_order: +d.sort_order || 0, memo: d.memo });
              Object.assign(s, saved); close(); draw(); U.toast('저장했어요.');
            } catch (err) { U.toast(U.errMsg(err), 'error'); }
          };
        }
      });
    }
    function pickPdfs(multiple) {
      return new Promise(function (resolve) {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; if (multiple) inp.multiple = true;
        inp.onchange = function () { resolve(Array.prototype.slice.call(inp.files || [])); }; inp.click();
      });
    }

    ctx.el.innerHTML = toolbarHTML() + '<div id="as-list"></div>';
    function toolbarHTML() {
      return '<div class="toolbar"><div class="tb-left">' +
        '<label class="field inline-field"><span>콘티 날짜</span><input type="date" id="as-date" value="' + esc(date) + '"></label>' +
        '<button class="btn btn-primary" id="as-up">' + icon('plus') + 'PDF 올리기 (여러 곡)</button>' +
        '<input class="search" type="search" id="as-q" placeholder="곡 검색"></div>' +
        '<div class="tb-right"><a class="btn btn-ghost btn-sm" href="#/admin/members?team=worship">' + icon('users') + '찬양팀 명단</a><a class="btn btn-ghost btn-sm" href="#/scores">' + icon('eye') + '찬양팀 화면 보기</a></div></div>' +
        '<p class="muted small">파일 이름이 곡 제목이 돼요 (예: "주의 이름 높이며 (G).pdf"). 괄호 안의 키는 자동으로 키 칸에 들어가요. 악보는 찬양팀과 관리자만 볼 수 있어요.</p>';
    }
    U.$('#as-date', ctx.el).onchange = function (e) { date = e.target.value; };
    U.$('#as-q', ctx.el).oninput = U.debounce(function (e) { q = e.target.value.trim().toLowerCase(); draw(); }, 120);
    U.$('#as-up', ctx.el).onclick = async function () {
      var files = await pickPdfs(true); if (!files.length) return;
      var btn = U.$('#as-up', ctx.el); btn.disabled = true;
      var base = list.filter(function (x) { return x.worship_date === (date || null); }).reduce(function (m, x) { return Math.max(m, x.sort_order || 0); }, 0);
      var okN = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        btn.innerHTML = '<span class="spinner"></span> ' + (i + 1) + '/' + files.length + ' 올리는 중';
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { U.toast(f.name + ': PDF만 올릴 수 있어요.', 'error'); continue; }
        try {
          var nameNoExt = f.name.replace(/\.pdf$/i, '').trim();
          var keyMatch = nameNoExt.match(/[\(\[]\s*([A-G][#b♭♯]?m?(?:\s*[-→>]\s*[A-G][#b♭♯]?m?)?)\s*[\)\]]\s*$/);
          var title = keyMatch ? nameNoExt.slice(0, keyMatch.index).trim() : nameNoExt;
          var up = await App.api.scores.uploadFile(f);
          var pages = await Scores.countPages(f);
          var saved = await App.api.scores.save({ title: title || nameNoExt, song_key: keyMatch ? keyMatch[1] : '', worship_date: date || null, sort_order: base + i + 1, file_path: up.path, file_name: f.name, file_size: f.size, page_count: pages });
          list.push(saved); okN++;
        } catch (e) { U.toast(f.name + ': ' + U.errMsg(e), 'error'); }
      }
      btn.disabled = false; btn.innerHTML = icon('plus') + 'PDF 올리기 (여러 곡)';
      if (okN) U.toast(okN + '곡을 올렸어요.');
      list.sort(function (a, c) { return (a.sort_order || 0) - (c.sort_order || 0); });
      draw();
    };
    draw();
  }, { title: '찬양팀 악보', admin: true });
})();
