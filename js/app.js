/* =====================================================================
 * 앱 코어: 데이터 모드 선택, 로그인 상태, 라우터, 레이아웃(공개/관리자)
 * ===================================================================== */
(function () {
  var $ = U.$, esc = U.esc, icon = U.icon;

  var App = window.App = {
    api: null,
    content: null,
    session: null,          // { user, profile } | null
    routes: [],
    shell: null,            // 'public' | 'admin'
    renderId: 0
  };

  /* ---------- 권한 헬퍼 ---------- */
  App.profile = function () { return App.session && App.session.profile; };
  App.isLoggedIn = function () { return !!App.session; };
  App.isMember = function () { var p = App.profile(); return !!(p && p.status === 'active'); };
  App.isAdmin = function () { var p = App.profile(); return !!(p && p.role === 'admin' && p.status === 'active'); };

  /* ---------- 라우팅 ---------- */
  // App.route('/news/:id', handler, { admin: true, auth: true, title: '...' })
  App.route = function (pattern, handler, opts) {
    var keys = [];
    var re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, function (_, k) { keys.push(k); return '/([^/]+)'; }) + '/?$');
    App.routes.push({ pattern: pattern, re: re, keys: keys, handler: handler, opts: opts || {} });
  };

  App.go = function (path, replace) {
    var h = '#' + path;
    if (replace) { history.replaceState(null, '', h); App.render(); }
    else if (location.hash === h) App.render();
    else location.hash = h;
  };

  App.currentPath = function () {
    var h = location.hash || '';
    if (h.indexOf('#/') !== 0) return '/';
    return decodeURIComponent(h.slice(1).split('?')[0]) || '/';
  };
  App.query = function () {
    var h = location.hash, i = h.indexOf('?'), q = {};
    if (i < 0) return q;
    h.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
    return q;
  };

  // 화면을 떠날 때 정리할 일 (예: 악보 뷰어의 화면 켜 두기 해제)
  App._leave = [];
  App.onLeave = function (fn) { App._leave.push(fn); };

  App.render = async function () {
    var myId = ++App.renderId;
    var leaving = App._leave; App._leave = [];
    leaving.forEach(function (fn) { try { fn(); } catch (e) { } });
    document.body.classList.remove('viewer-mode');
    var path = App.currentPath();
    var match = null, params = {};
    for (var i = 0; i < App.routes.length; i++) {
      var r = App.routes[i], m = path.match(r.re);
      if (m) { match = r; r.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); }); break; }
    }
    if (!match) { App.go('/', true); return; }

    var o = match.opts;
    if ((o.auth || o.admin) && !App.isLoggedIn()) { App.go('/login?next=' + encodeURIComponent(path), true); return; }
    if (o.admin && !App.isAdmin()) { U.toast('관리자만 접근할 수 있어요.', 'error'); App.go('/', true); return; }

    App.mountShell(o.admin ? 'admin' : 'public');
    var el = App.shell === 'admin' ? $('#admin-view') : $('#view');
    App.setActiveNav(path);
    if (App.shell === 'admin') $('#admin-title').textContent = o.title || '관리자';
    document.title = (o.title ? o.title + ' · ' : '') + 'INTO CHURCH';
    el.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    if (!o.keepScroll) window.scrollTo(0, 0);
    try {
      var ctx = { params: params, query: App.query(), el: el, path: path, alive: function () { return myId === App.renderId; } };
      await match.handler(ctx);
    } catch (e) {
      console.error(e);
      if (myId === App.renderId) el.innerHTML = '<div class="container empty"><p>문제가 발생했어요.</p><p class="muted small">' + esc(U.errMsg(e)) + '</p><a class="btn btn-ghost" href="#/">홈으로</a></div>';
    }
    document.body.classList.remove('drawer-open');
  };

  /* ---------- 레이아웃 ---------- */
  var PUBLIC_NAV = [
    ['/', '홈'], ['/about', '우리는 인투처치입니다'], ['/worship', '주일 예배 안내'],
    ['/community', '예배와 공동체'], ['/foundation', 'FOUNDATION']
  ];
  var APP_NAV = [['/news', '교회 소식'], ['/q', '이번 주 나눔'], ['/q/board', '질문 게시판'], ['/gallery', '갤러리'], ['/contact', '예배 문의']];

  App.brandHTML = function () {
    return '<a href="#/" class="brand" aria-label="INTO CHURCH 홈">' +
      '<img class="brand-logo logo-dark" src="assets/logo-dark.png" alt="">' +
      '<img class="brand-logo logo-light" src="assets/logo-light.png" alt="">' +
      '<span class="brand-name">INTO CHURCH</span></a>';
  };

  App.mountShell = function (type) {
    if (App.shell === type) { App.refreshChrome(); return; }
    App.shell = type;
    var root = $('#app');
    document.body.classList.toggle('is-admin', type === 'admin');
    if (type === 'public') {
      root.innerHTML =
        App.demoBanner() +
        '<header class="topbar" id="topbar">' +
          '<div class="topbar-in">' + App.brandHTML() +
            '<nav class="topnav" aria-label="주 메뉴">' +
              PUBLIC_NAV.map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + '</a>'; }).join('') +
              '<span class="topnav-sep"></span>' +
              APP_NAV.filter(function (n) { return n[0] !== '/q/board' && n[0] !== '/contact'; }).map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + '</a>'; }).join('') +
            '</nav>' +
            '<div class="top-actions" id="top-actions"></div>' +
          '</div>' +
        '</header>' +
        '<main id="view" class="view"></main>' +
        '<footer id="footer" class="footer"></footer>' +
        '<nav class="tabbar" id="tabbar" aria-label="하단 메뉴">' +
          App.tab('/', 'home', '홈') + App.tab('/news', 'news', '소식') + App.tab('/q', 'question', '나눔') +
          App.tab('/gallery', 'image', '갤러리') + App.tab('/me', 'user', 'MY') +
        '</nav>' +
        '<div class="drawer" id="drawer" aria-hidden="true"></div>' +
        '<div class="drawer-dim" id="drawer-dim"></div>';
      $('#drawer-dim').onclick = function () { document.body.classList.remove('drawer-open'); };
    } else {
      root.innerHTML =
        App.demoBanner() +
        '<div class="admin">' +
          '<aside class="admin-side" id="admin-side">' +
            '<a href="#/admin" class="admin-brand"><img src="assets/logo-light.png" alt=""><span>관리자</span></a>' +
            '<nav class="admin-nav">' + App.adminNavHTML() + '</nav>' +
            '<div class="admin-side-foot">' +
              '<a href="#/" class="admin-link">' + icon('home') + '<span>사이트로 돌아가기</span></a>' +
              '<button class="admin-link" data-logout>' + icon('logout') + '<span>로그아웃</span></button>' +
            '</div>' +
          '</aside>' +
          '<div class="admin-main">' +
            '<header class="admin-top">' +
              '<button class="icon-btn admin-menu-btn" id="admin-menu-btn" aria-label="메뉴">' + icon('menu') + '</button>' +
              '<h1 id="admin-title">관리자</h1>' +
              '<div class="admin-top-right"><span class="admin-who" id="admin-who"></span><a class="btn btn-ghost btn-sm" href="#/">사이트 보기</a></div>' +
            '</header>' +
            '<div id="admin-view" class="admin-view"></div>' +
          '</div>' +
          '<div class="admin-dim" id="admin-dim"></div>' +
        '</div>';
      $('#admin-menu-btn').onclick = function () { document.body.classList.toggle('admin-nav-open'); };
      $('#admin-dim').onclick = function () { document.body.classList.remove('admin-nav-open'); };
      $('#admin-side').addEventListener('click', function (e) {
        if (e.target.closest('a')) document.body.classList.remove('admin-nav-open');
      });
    }
    App.bindLogout(root);
    App.refreshChrome();
  };

  App.adminNavHTML = function () {
    var items = [
      ['/admin', 'chart', '대시보드'],
      ['/admin/questions', 'book', '나눔지'],
      ['/admin/scores', 'music', '찬양팀 악보'],
      ['/admin/qna', 'mail', '질문 게시판'],
      ['/admin/notices', 'news', '교회 소식'],
      ['/admin/gallery', 'image', '갤러리'],
      ['/admin/inquiries', 'phone', '예배 문의'],
      ['/admin/members', 'users', '회원 관리'],
      ['/admin/content', 'edit', '사이트 콘텐츠'],
      ['/admin/settings', 'settings', '설정']
    ];
    return items.map(function (n) {
      return '<a href="#' + n[0] + '" data-nav="' + n[0] + '" class="admin-link">' + icon(n[1]) + '<span>' + n[2] + '</span><em class="badge" data-badge="' + n[0] + '"></em></a>';
    }).join('');
  };

  App.tab = function (path, ic, label) {
    return '<a href="#' + path + '" data-nav="' + path + '" class="tab">' + icon(ic) + '<span>' + label + '</span></a>';
  };

  App.demoBanner = function () {
    if (App.api.mode !== 'demo') return '';
    return '<div class="demo-banner">데모 모드 · 데이터가 이 기기에만 저장돼요 <button data-demo-help>로그인 안내</button></div>';
  };

  App.setActiveNav = function (path) {
    U.$$('[data-nav]').forEach(function (a) {
      var n = a.getAttribute('data-nav');
      var on = n === '/' || n === '/admin' ? path === n : (path === n || path.indexOf(n + '/') === 0);
      if (n === '/q' && path.indexOf('/q/board') === 0 && a.closest('.topnav')) on = false;
      if (n === '/me' && (path === '/login' || path === '/signup')) on = true;
      a.classList.toggle('active', on);
    });
  };

  App.refreshChrome = function () {
    var p = App.profile();
    if (App.shell === 'public') {
      var acts = $('#top-actions');
      if (acts) {
        acts.innerHTML =
          (App.canInstall() ? '<button class="install-pill" data-install-top>' + icon('install') + '<span>앱 설치</span></button>' : '') +
          (App.isAdmin() ? '<a href="#/admin" class="btn btn-sm btn-outline-top hide-sm">' + icon('settings') + '<span>관리</span></a>' : '') +
          (p ? '<a href="#/me" class="top-user hide-sm">' + icon('user') + '<span>' + esc(p.name || 'MY') + '</span></a>'
             : '<a href="#/login" class="top-user hide-sm">' + icon('user') + '<span>로그인</span></a>') +
          '<button class="icon-btn menu-btn" id="menu-btn" aria-label="전체 메뉴">' + icon('menu') + '</button>';
        $('#menu-btn').onclick = App.openDrawer;
        var ip = acts.querySelector('[data-install-top]'); if (ip) ip.onclick = App.install;
      }
      App.renderFooter();
      App.renderDrawer();
    } else {
      var who = $('#admin-who'); if (who && p) who.textContent = p.name + ' 님';
      App.refreshBadges();
    }
    var help = document.querySelector('[data-demo-help]');
    if (help) help.onclick = App.demoHelp;
  };

  App.refreshBadges = async function (force) {
    if (!App.isAdmin()) return;
    var now = Date.now();
    if (!force && App._badgeAt && now - App._badgeAt < 15000) return;
    App._badgeAt = now;
    try {
      var s = await App.api.stats();
      var set = function (k, v) { var b = document.querySelector('[data-badge="' + k + '"]'); if (b) { b.textContent = v || ''; b.style.display = v ? '' : 'none'; } };
      set('/admin/inquiries', s.inquiriesNew); set('/admin/qna', s.qnaWaiting); set('/admin/members', s.pending);
      U.$$('.badge').forEach(function (b) { if (!b.textContent) b.style.display = 'none'; });
    } catch (e) { }
  };

  App.renderDrawer = function () {
    var d = $('#drawer'); if (!d) return;
    var p = App.profile();
    d.innerHTML =
      '<div class="drawer-head">' + App.brandHTML() + '<button class="icon-btn" data-close-drawer aria-label="닫기">' + icon('close') + '</button></div>' +
      '<div class="drawer-user">' + (p
        ? '<div><strong>' + esc(p.name) + '</strong> 님' + (p.status === 'pending' ? ' <span class="chip chip-warn">승인 대기</span>' : '') + '<div class="muted small">' + esc(p.email || '') + '</div></div><a href="#/me" class="btn btn-sm btn-ghost">MY</a>'
        : '<div class="muted">로그인하고 나눔에 참여해 보세요</div><a href="#/login" class="btn btn-sm btn-primary">로그인</a>') + '</div>' +
      '<div class="drawer-group"><div class="drawer-label">INTO CHURCH</div>' +
        PUBLIC_NAV.map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + '</a>'; }).join('') + '</div>' +
      '<div class="drawer-group"><div class="drawer-label">함께하기</div>' +
        APP_NAV.map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + '</a>'; }).join('') + '</div>' +
      (App.inTeam && App.inTeam('worship') ? '<div class="drawer-group"><div class="drawer-label">찬양팀</div><a href="#/scores" data-nav="/scores">' + icon('music') + ' 찬양팀 악보</a></div>' : '') +
      (App.isAdmin() ? '<div class="drawer-group"><a href="#/admin" class="drawer-admin">' + icon('settings') + ' 관리자 페이지</a></div>' : '') +
      '<div class="drawer-group">' +
        (App.canInstall() ? '<button class="drawer-install" data-install>' + icon('install') + ' 앱 설치 (홈 화면에 추가)</button>' : '') +
        '<button data-share-app>' + icon('send') + ' 앱 링크 공유하기</button>' +
        '<a href="#/install">' + icon('phone') + ' 앱 설치 안내</a>' +
      '</div>';
    d.querySelector('[data-close-drawer]').onclick = function () { document.body.classList.remove('drawer-open'); };
    var ib = d.querySelector('[data-install]'); if (ib) ib.onclick = function () { document.body.classList.remove('drawer-open'); App.install(); };
    var sb = d.querySelector('[data-share-app]'); if (sb) sb.onclick = function () { window.Install && Install.share(); };
    App.setActiveNav(App.currentPath());
  };
  App.openDrawer = function () { document.body.classList.add('drawer-open'); };

  App.renderFooter = function () {
    var f = $('#footer'); if (!f) return;
    var c = App.content.church || {};
    f.innerHTML =
      '<div class="container footer-in">' +
        '<div class="footer-logo">' + U.markSVG() + '<div><strong>INTO</strong><span>CHURCH</span></div></div>' +
        '<div class="footer-info">' +
          '<p><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a><span class="dot">·</span>' + esc(c.website) + '<span class="dot">·</span>담임목사 : ' + esc(c.pastor) + '</p>' +
          '<p>' + esc(c.office) + '</p>' +
          '<p>' + esc(c.name) + ' ' + esc(c.nameEn) + '<span class="dot">·</span>' + esc(c.affiliation) + '<span class="dot">·</span>고유번호 ' + esc(c.regNo) + '</p>' +
        '</div>' +
      '</div>';
  };

  App.bindLogout = function (root) {
    root.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-logout]'); if (!b) return;
      e.preventDefault();
      await App.api.auth.signOut();
      if (window.Scores) Scores.clearCache();
      App.session = null; U.toast('로그아웃했어요.');
      App.go('/');
    });
  };

  App.demoHelp = function () {
    U.modal({
      title: '데모 모드 안내',
      html: '<p>지금은 서버(Supabase) 연결 없이 <b>이 브라우저에만</b> 데이터가 저장되는 미리보기 모드예요.</p>' +
        '<div class="demo-accounts"><div><b>관리자</b><code>admin@into.demo</code><code>into1234</code></div><div><b>성도</b><code>member@into.demo</code><code>into1234</code></div></div>' +
        '<p class="muted small">README의 안내대로 config.js에 Supabase 주소/키를 넣으면 실제 회원가입·DB 저장으로 동작합니다.</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-reset>데모 데이터 초기화</button><a class="btn btn-primary" href="#/login" data-close>로그인하러 가기</a></div>',
      onMount: function (root, close) {
        root.querySelector('[data-reset]').onclick = async function () {
          if (!(await U.confirm('데모 데이터를 처음 상태로 되돌릴까요?'))) return;
          App.api.resetDemo(); location.hash = '#/'; location.reload();
        };
      }
    });
  };

  /* ---------- 설치(PWA) — 실제 로직은 js/install.js ---------- */
  App.isStandalone = function () { return window.Install ? Install.standalone() : false; };
  App.canInstall = function () { return window.Install ? Install.canShow() : false; };
  App.install = function () { if (!window.Install) return; return Install.deferred ? Install.prompt() : Install.open(); };

  /* ---------- 공용 렌더 헬퍼 ---------- */
  App.pageHead = function (title, sub, extra) {
    return '<section class="page-head container"><h1>' + esc(title) + '</h1>' + (sub ? '<p class="page-sub">' + sub + '</p>' : '') + (extra || '') + '</section>';
  };
  App.needLogin = function (msg) {
    var next = encodeURIComponent(App.currentPath());
    return '<div class="card login-card">' + icon('lock') + '<p>' + esc(msg || '로그인한 성도만 볼 수 있어요.') + '</p>' +
      '<div class="row-gap"><a class="btn btn-primary" href="#/login?next=' + next + '">로그인</a><a class="btn btn-ghost" href="#/signup?next=' + next + '">회원가입</a></div></div>';
  };
  App.pendingNotice = function () {
    return '<div class="card notice-card">' + icon('clock') + '<div><b>가입 승인 대기 중</b><p class="muted small">관리자가 승인하면 나눔과 질문 게시판을 이용할 수 있어요.</p></div></div>';
  };

  // 이미지 선택 → 리사이즈 → 업로드 → URL
  // 나눔지 원본 파일(PDF·이미지) 첨부 → { url, name }
  App.pickFile = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = opts.accept || '.pdf,application/pdf,image/*';
      inp.onchange = async function () {
        var f = inp.files && inp.files[0]; if (!f) return resolve(null);
        try {
          var url;
          if (/^image\//.test(f.type)) url = await App.api.storage.upload(await U.resizeImage(f, 2000, 0.85), opts.folder);
          else url = await App.api.storage.uploadFile(f, opts.folder);
          resolve({ url: url, name: f.name });
        } catch (e) { U.toast(U.errMsg(e), 'error'); resolve(null); }
      };
      inp.click();
    });
  };

  App.pickAndUpload = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; if (opts.multiple) inp.multiple = true;
      inp.onchange = async function () {
        var files = Array.prototype.slice.call(inp.files || []);
        if (!files.length) return resolve(null);
        var out = [];
        for (var i = 0; i < files.length; i++) {
          try {
            if (opts.onProgress) opts.onProgress(i + 1, files.length);
            var blob = await U.resizeImage(files[i], opts.max || 1600, 0.82);
            var url = await App.api.storage.upload(blob, opts.folder);
            var thumb = null;
            if (opts.thumb) {
              var tb = await U.resizeImage(files[i], 520, 0.74);
              thumb = await App.api.storage.upload(tb, opts.folder);
            }
            out.push({ url: url, thumb_url: thumb, name: files[i].name });
          } catch (e) { U.toast(U.errMsg(e), 'error'); }
        }
        resolve(opts.multiple ? out : out[0] || null);
      };
      inp.click();
    });
  };

  /* ---------- 시작 ---------- */
  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.onload = function () { resolve(true); }; s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  // 앱 화면 확대 고정: 두 손가락 확대·두 번 탭 확대·입력칸 자동 확대 방지
  App.lockZoom = function () {
    var mobile = (window.Install && Install.env.mobile) || ('ontouchstart' in window);
    if (!mobile) return; // PC 브라우저의 Ctrl+휠 확대는 그대로 둠 (접근성)
    document.documentElement.classList.add('no-zoom');
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
      document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
    });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
    var last = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - last < 300 && !e.target.closest('input, textarea, select, [contenteditable]')) e.preventDefault();
      last = now;
    }, { passive: false });
  };

  App.start = async function () {
    var cfg = window.INTO_CONFIG || {};
    App.lockZoom();
    var wantSB = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
    if (wantSB && !window.supabase) await loadScript(cfg.SUPABASE_SDK || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    var useSB = wantSB && window.supabase;
    if (wantSB && !window.supabase) {
      $('#app').innerHTML = '<div class="container empty" style="padding-top:30vh"><p>서버에 연결할 수 없어요.</p><p class="muted small">인터넷 연결을 확인한 뒤 다시 열어 주세요.</p><button class="btn btn-primary" onclick="location.reload()">다시 시도</button></div>';
      return;
    }
    if (window.Install) Install.init();
    App.api = useSB ? window.createSupabaseApi(window.INTO_DEFAULTS, { url: cfg.SUPABASE_URL, anonKey: cfg.SUPABASE_ANON_KEY })
                    : window.createDemoApi(window.INTO_DEFAULTS);

    // Supabase 인증 메일 링크(#access_token=...)는 SDK가 처리하도록 잠시 대기
    var authHash = /access_token=|error_description=|type=recovery/.test(location.hash);
    var recovery = /type=recovery/.test(location.hash);

    try { App.content = await App.api.content.getAll(); }
    catch (e) { App.content = JSON.parse(JSON.stringify(window.INTO_DEFAULTS.content)); }
    try { App.session = await App.api.auth.current(); } catch (e) { App.session = null; }

    App.api.auth.onChange(function (snap, event) {
      App.session = snap;
      if (event === 'PASSWORD_RECOVERY') { App.go('/reset', true); return; }
      App.refreshChrome();
    });

    if (authHash) {
      var errm = (location.hash.match(/error_description=([^&]+)/) || [])[1];
      history.replaceState(null, '', location.pathname + (recovery ? '#/reset' : '#/'));
      if (errm) U.toast(decodeURIComponent(errm.replace(/\+/g, ' ')), 'error');
      else if (!recovery) U.toast('이메일 인증이 완료됐어요. 환영합니다!');
    }

    window.addEventListener('hashchange', App.render);
    window.addEventListener('scroll', function () {
      var t = $('#topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    // 서비스워커: https 배포 환경에서 등록 (로컬 개발 중에는 ?sw=1 일 때만 → 캐시 때문에 수정이 안 보이는 일 방지)
    var canSW = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
    var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (canSW && (!isLocal || location.search.indexOf('sw=1') >= 0)) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW 등록 실패', e); });
    }

    await App.render();
    if (window.Install) Install.maybeAuto();
  };
})();
