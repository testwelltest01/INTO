/* =====================================================================
 * 앱 설치(PWA) 유도
 *  - 안드로이드 크롬/삼성인터넷: 설치 창(beforeinstallprompt) 바로 띄우기
 *  - 아이폰 사파리/크롬: 단계별 "홈 화면에 추가" 안내 시트
 *  - 카카오톡·네이버·인스타 등 앱 안 브라우저: 기본 브라우저로 빠져나가기
 *  - PC: 휴대폰으로 찍을 QR 코드
 *  - 처음 방문 시 자동 안내 (닫으면 며칠 동안 다시 안 띄움)
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon;
  var ua = navigator.userAgent || '';
  var LS_DISMISS = 'into_install_dismiss_until';
  var SS_SHOWN = 'into_install_shown';
  var SS_KAKAO = 'into_kakao_escape_tried';

  var env = (function () {
    var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var iphone = /iPhone|iPod/i.test(ua);
    var android = /Android/i.test(ua);
    var inapp = /KAKAOTALK/i.test(ua) ? 'kakao'
      : /NAVER\(inapp/i.test(ua) ? 'naver'
      : /Instagram/i.test(ua) ? 'instagram'
      : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'facebook'
      : /\bLine\//i.test(ua) ? 'line'
      : /DaumApps/i.test(ua) ? 'daum'
      : /\bBAND\//i.test(ua) ? 'band'
      : /everytimeApp/i.test(ua) ? 'everytime'
      : (android && /; wv\)/.test(ua)) ? 'webview' : '';
    var iosVer = (ua.match(/OS (\d+)_/) || [])[1];
    var browser = ios
      ? (/CriOS/i.test(ua) ? 'chrome' : /FxiOS|EdgiOS|OPiOS|Whale|DuckDuckGo/i.test(ua) ? 'other' : inapp ? 'inapp' : 'safari')
      : android ? (/SamsungBrowser/i.test(ua) ? 'samsung' : /Whale/i.test(ua) ? 'whale' : /Firefox/i.test(ua) ? 'firefox' : inapp ? 'inapp' : 'chrome')
      : 'desktop';
    return {
      ios: ios, iphone: iphone, android: android, mobile: ios || android || /Mobi/i.test(ua),
      inapp: inapp, browser: browser, iosVer: iosVer ? +iosVer : 0
    };
  })();

  var Install = window.Install = { env: env, deferred: null };

  Install.standalone = function () {
    return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  };
  Install.appURL = function () { return location.origin + location.pathname.replace(/index\.html$/, ''); };
  Install.installURL = function () { return Install.appURL() + '#/install'; };

  // 설치 안내를 보여 줄 수 있는 상황인지
  Install.canShow = function () {
    if (Install.standalone()) return false;
    return env.mobile || !!Install.deferred;
  };

  /* ---------- 앱 안 브라우저에서 빠져나가기 ---------- */
  Install.escapeInApp = function () {
    var here = location.href;
    if (env.inapp === 'kakao') {
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(here);
      return true;
    }
    if (env.inapp === 'line') {
      var u = location.origin + location.pathname + (location.search ? location.search + '&' : '?') + 'openExternalBrowser=1' + location.hash;
      location.href = u; return true;
    }
    if (env.android) {
      location.href = 'intent://' + location.host + location.pathname + location.search +
        '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(here) + ';end';
      return true;
    }
    return false; // 아이폰의 다른 앱들은 사용자가 직접 Safari로 열어야 함
  };

  /* ---------- 공유 / 링크 복사 ---------- */
  Install.copy = function (text, msg) {
    var done = function () { U.toast(msg || '링크를 복사했어요.'); };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { U.toast(text); } t.remove();
    }
  };
  Install.share = function () {
    var data = { title: 'INTO CHURCH 인투처치', text: '인투처치 앱 — 이번 주 질문, 교회 소식, 예배 안내', url: Install.installURL() };
    if (navigator.share) return navigator.share(data).catch(function () { });
    Install.copy(data.url, '앱 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.');
  };

  /* ---------- QR 코드 (PC → 휴대폰) ---------- */
  var qrLoading = null;
  function loadQR() {
    if (window.qrcode) return Promise.resolve();
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = 'assets/vendor/qrcode.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
    return qrLoading;
  }
  function makeQR(text) { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q; }
  Install.qrSVG = function (text) {
    return loadQR().then(function () {
      var q = makeQR(text), n = q.getModuleCount(), d = '';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
      return '<svg class="qr" viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="앱 주소 QR 코드"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + d + '" fill="#423B36"/></svg>';
    });
  };
  // 주보 인쇄용 PNG (로고 + 안내 문구 포함)
  Install.qrPNG = function (text) {
    return loadQR().then(function () {
      var q = makeQR(text), n = q.getModuleCount();
      var W = 1200, H = 1500, pad = 150, cell = Math.floor((W - pad * 2) / n), size = cell * n, ox = (W - size) / 2, oy = 360;
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = '#F3F1EC'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#423B36'; x.textAlign = 'center';
      x.font = '700 72px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      x.fillText('인투처치 앱 설치하기', W / 2, 170);
      x.font = '400 40px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      x.fillStyle = '#5E5751';
      x.fillText('휴대폰 카메라로 QR 코드를 찍어 주세요', W / 2, 250);
      x.fillStyle = '#fff'; x.fillRect(ox - 30, oy - 30, size + 60, size + 60);
      x.fillStyle = '#423B36';
      for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (q.isDark(r, col)) x.fillRect(ox + col * cell, oy + r * cell, cell, cell);
      x.font = '500 38px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      x.fillText(text.replace(/^https?:\/\//, '').replace(/#\/install$/, ''), W / 2, oy + size + 110);
      x.font = '400 34px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      x.fillStyle = '#5E5751';
      x.fillText('아이폰: 공유 → 홈 화면에 추가   ·   안드로이드: 앱 설치', W / 2, oy + size + 175);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  };

  /* ---------- 안내 시트 ---------- */
  var SHARE_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var ADD_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
  var DOTS_IC = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  var KEBAB_IC = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';

  function step(n, html) { return '<li><span class="is-n">' + n + '</span><div>' + html + '</div></li>'; }

  function bodyFor() {
    var appName = { kakao: '카카오톡', naver: '네이버 앱', instagram: '인스타그램', facebook: '페이스북', line: '라인', daum: '다음 앱', band: '밴드', everytime: '에브리타임', webview: '앱' }[env.inapp] || '앱';
    // 1) 앱 안 브라우저
    if (env.inapp) {
      var canAuto = env.inapp === 'kakao' || env.inapp === 'line' || env.android;
      return '<p class="is-lead">지금은 <b>' + appName + ' 안의 브라우저</b>라서 앱을 설치할 수 없어요.<br>' + (env.ios ? '<b>Safari</b>로' : '<b>Chrome</b>으로') + ' 열면 바로 설치할 수 있어요.</p>' +
        (canAuto ? '<button class="btn btn-primary btn-block btn-lg" data-escape>' + icon('external') + (env.ios ? 'Safari로 열기' : 'Chrome으로 열기') + '</button>' : '') +
        '<ol class="is-steps">' +
          (env.ios
            ? step(1, '오른쪽 아래(또는 위)의 ' + DOTS_IC + ' 또는 ' + SHARE_IC + ' 버튼을 누르세요') + step(2, '<b>Safari로 열기</b> (또는 기본 브라우저로 열기)를 누르세요')
            : step(1, '오른쪽 위 ' + KEBAB_IC + ' 메뉴를 누르세요') + step(2, '<b>다른 브라우저로 열기</b>를 누르세요')) +
        '</ol>' +
        '<button class="btn btn-ghost btn-block" data-copy>' + icon('external') + '링크 복사해서 직접 열기</button>';
    }
    // 2) 설치 창을 바로 띄울 수 있는 경우 (안드로이드 크롬, PC 크롬/엣지)
    if (Install.deferred) {
      return '<p class="is-lead">버튼 한 번이면 홈 화면에 인투처치 앱이 생겨요.</p>' +
        '<button class="btn btn-primary btn-block btn-lg" data-prompt>' + icon('install') + '앱 설치하기</button>' +
        '<ul class="is-perks"><li>' + icon('check') + '홈 화면 아이콘으로 바로 열기</li><li>' + icon('check') + '주소창 없이 앱처럼 꽉 찬 화면</li><li>' + icon('check') + '인터넷이 약해도 빠르게 열려요</li></ul>';
    }
    // 3) 아이폰
    if (env.ios) {
      if (env.browser === 'safari') {
        var newSafari = env.iosVer >= 26;
        return '<p class="is-lead">아이폰은 <b>3단계</b>면 설치돼요.</p><ol class="is-steps">' +
          step(1, newSafari
            ? '화면 아래 ' + DOTS_IC + ' 버튼을 누르고 <b>공유</b> ' + SHARE_IC + '를 누르세요'
            : '화면 아래 가운데 <b>공유</b> 버튼 ' + SHARE_IC + '을 누르세요') +
          step(2, '목록을 위로 올려 <b>홈 화면에 추가</b> ' + ADD_IC + '를 누르세요') +
          step(3, (newSafari ? '<b>웹 앱으로 열기</b>가 켜진 채로 ' : '') + '오른쪽 위 <b>추가</b>를 누르면 끝!') +
          '</ol>';
      }
      if (env.browser === 'chrome') {
        return '<p class="is-lead">아이폰 크롬에서도 설치할 수 있어요.</p><ol class="is-steps">' +
          step(1, '주소창 오른쪽 <b>공유</b> 버튼 ' + SHARE_IC + '을 누르세요') +
          step(2, '<b>홈 화면에 추가</b> ' + ADD_IC + '를 누르세요') +
          step(3, '오른쪽 위 <b>추가</b>를 누르면 끝!') + '</ol>';
      }
      return '<p class="is-lead">이 브라우저에서는 설치가 어려워요. <b>Safari</b>로 열어 주세요.</p>' +
        '<button class="btn btn-primary btn-block" data-copy>' + icon('external') + '링크 복사 (Safari에 붙여 넣기)</button>';
    }
    // 4) 안드로이드 (설치 창이 아직 안 뜬 경우: 메뉴로 안내)
    if (env.android) {
      if (env.browser === 'samsung') {
        return '<p class="is-lead">삼성 인터넷에서 설치하는 방법이에요.</p><ol class="is-steps">' +
          step(1, '아래쪽 <b>메뉴(≡)</b>를 누르세요') + step(2, '<b>현재 페이지 추가 → 홈 화면</b>을 누르세요') + step(3, '<b>추가</b>를 누르면 끝!') + '</ol>';
      }
      return '<p class="is-lead">크롬에서 설치하는 방법이에요.</p><ol class="is-steps">' +
        step(1, '오른쪽 위 ' + KEBAB_IC + ' 메뉴를 누르세요') +
        step(2, '<b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요') +
        step(3, '<b>설치</b>를 누르면 끝!') + '</ol>';
    }
    // 5) PC
    return '<p class="is-lead">휴대폰 카메라로 아래 QR 코드를 찍으면 바로 열려요.</p><div class="is-qr" data-qr></div>' +
      '<p class="muted small center">' + esc(Install.installURL().replace(/^https?:\/\//, '')) + '</p>';
  }

  Install.open = function (opts) {
    opts = opts || {};
    try { sessionStorage.setItem(SS_SHOWN, '1'); } catch (e) { }
    var pointer = env.iphone && env.browser === 'safari' && !env.inapp && !Install.deferred && env.iosVer < 26;
    return U.modal({
      html:
        '<div class="install-sheet">' +
          '<div class="is-head"><img src="assets/icons/icon-192.png" alt="" class="is-icon"><div><b>INTO CHURCH 앱 설치</b><span>' + esc(opts.sub || '홈 화면에서 바로 열고, 이번 주 질문을 놓치지 마세요') + '</span></div>' +
          '<button class="icon-btn" data-close aria-label="닫기">' + icon('close') + '</button></div>' +
          bodyFor() +
          '<div class="is-foot"><button class="link-btn" data-later>다음에 할게요</button>' + (opts.auto ? '<button class="link-btn" data-never>다시 보지 않기</button>' : '<button class="link-btn" data-share>' + icon('send') + '다른 사람에게 공유</button>') + '</div>' +
        '</div>' +
        (pointer ? '<div class="is-pointer" aria-hidden="true">' + icon('chevron-right', 'rot90') + '<span>여기 공유 버튼</span></div>' : ''),
      onMount: function (root, close) {
        root.classList.add('modal-install');
        var dismiss = function (days) { try { localStorage.setItem(LS_DISMISS, String(Date.now() + days * 864e5)); } catch (e) { } close(); };
        var q;
        if ((q = root.querySelector('[data-prompt]'))) q.onclick = async function () { close(); await Install.prompt(); };
        if ((q = root.querySelector('[data-escape]'))) q.onclick = function () { Install.escapeInApp(); };
        if ((q = root.querySelector('[data-copy]'))) q.onclick = function () { Install.copy(location.href, '링크를 복사했어요. ' + (env.ios ? 'Safari' : 'Chrome') + ' 주소창에 붙여 넣어 주세요.'); };
        if ((q = root.querySelector('[data-later]'))) q.onclick = function () { dismiss(3); };
        if ((q = root.querySelector('[data-never]'))) q.onclick = function () { dismiss(60); };
        if ((q = root.querySelector('[data-share]'))) q.onclick = function () { Install.share(); };
        if ((q = root.querySelector('[data-qr]'))) Install.qrSVG(Install.installURL()).then(function (svg) { q.innerHTML = svg; }).catch(function () { q.textContent = ''; });
      }
    });
  };

  Install.prompt = async function () {
    var d = Install.deferred;
    if (!d) return Install.open();
    Install.deferred = null;
    d.prompt();
    try {
      var choice = await d.userChoice;
      if (choice && choice.outcome === 'dismissed') U.toast('언제든 메뉴의 "앱 설치"에서 다시 설치할 수 있어요.');
    } catch (e) { }
    if (window.App) App.refreshChrome();
  };

  // 첫 방문 자동 안내
  Install.maybeAuto = function (force) {
    if (Install.standalone()) return;
    var path = (window.App && App.currentPath && App.currentPath()) || '/';
    if (!force && /^\/(admin|login|signup|forgot|reset|install)/.test(path)) return;
    if (env.inapp) {
      // 카카오톡은 세션당 한 번 자동으로 기본 브라우저로 넘김
      var tried = false; try { tried = !!sessionStorage.getItem(SS_KAKAO); } catch (e) { }
      if (env.inapp === 'kakao' && !tried) {
        try { sessionStorage.setItem(SS_KAKAO, '1'); } catch (e) { }
        Install.escapeInApp();
      }
      var shown = false; try { shown = !!sessionStorage.getItem(SS_SHOWN); } catch (e) { }
      if (!shown || force) setTimeout(function () { Install.open({ auto: true, sub: '더 편하게 보려면 기본 브라우저에서 열어 주세요' }); }, 900);
      return;
    }
    if (!env.mobile) return;
    if (!force) {
      var until = 0, was = false;
      try { until = +localStorage.getItem(LS_DISMISS) || 0; was = !!sessionStorage.getItem(SS_SHOWN); } catch (e) { }
      if (was || Date.now() < until) return;
    }
    setTimeout(function () {
      if (Install.standalone() || document.querySelector('.modal-wrap')) return;
      Install.open({ auto: true, sub: force ? '가입을 환영해요! 앱으로 설치하면 더 편해요' : undefined });
    }, force ? 600 : 2500);
  };

  Install.init = function () {
    var h = document.documentElement;
    h.classList.toggle('standalone', Install.standalone());
    h.classList.toggle('ios', env.ios);
    h.classList.toggle('android', env.android);
    if (env.inapp) h.classList.add('inapp');
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); Install.deferred = e;
      if (window.App && App.shell === 'public') App.refreshChrome();
    });
    window.addEventListener('appinstalled', function () {
      Install.deferred = null; U.toast('앱이 설치됐어요! 홈 화면에서 인투처치를 열어 보세요.');
      if (window.App) App.refreshChrome();
    });
    try {
      window.matchMedia('(display-mode: standalone)').addEventListener('change', function (ev) { h.classList.toggle('standalone', ev.matches); });
    } catch (e) { }
  };

  /* ---------- 설치 안내 페이지 (#/install) — 단톡방/주보에 이 주소를 공유 ---------- */
  App.route('/install', async function (ctx) {
    var installed = Install.standalone();
    var tab = ctx.query.os || (env.ios ? 'ios' : env.android ? 'android' : 'pc');
    function steps(t) {
      if (t === 'ios') return '<ol class="is-steps big">' +
        step(1, '<b>Safari</b>로 이 페이지를 엽니다. (카카오톡에서 열었다면 ' + DOTS_IC + ' → <b>Safari로 열기</b>)') +
        step(2, '화면 아래 <b>공유</b> ' + SHARE_IC + ' 를 누릅니다. <span class="muted small">(iOS 26 이상은 ' + DOTS_IC + ' → 공유)</span>') +
        step(3, '<b>홈 화면에 추가</b> ' + ADD_IC + ' → 오른쪽 위 <b>추가</b>') + '</ol>';
      if (t === 'android') return '<ol class="is-steps big">' +
        step(1, '<b>Chrome</b>으로 이 페이지를 엽니다. (카카오톡에서 열었다면 ' + KEBAB_IC + ' → <b>다른 브라우저로 열기</b>)') +
        step(2, '화면 아래에 뜨는 <b>앱 설치</b>를 누르거나, ' + KEBAB_IC + ' 메뉴 → <b>앱 설치</b>를 누릅니다.') +
        step(3, '<b>설치</b>를 누르면 홈 화면에 아이콘이 생겨요.') + '</ol>';
      return '<div class="install-pc"><div class="is-qr big" data-qr></div><div><p><b>휴대폰 카메라로 QR 코드를 찍으세요.</b></p><p class="muted">열린 화면에서 안내에 따라 홈 화면에 추가하면 끝이에요.</p>' +
        (Install.deferred ? '<button class="btn btn-ghost" data-prompt>' + icon('install') + '이 PC에도 설치</button>' : '') + '</div></div>';
    }
    function draw() {
      ctx.el.innerHTML = App.pageHead('인투처치 앱 설치', installed ? '이미 앱으로 보고 계세요 🙌' : '홈 화면에 추가하면 앱처럼 바로 열 수 있어요') +
        '<section class="container narrow">' +
          (installed ? '' : (Install.canShow() ? '<button class="btn btn-primary btn-block btn-lg" data-open>' + icon('install') + '지금 설치하기</button>' : '')) +
          '<div class="seg-tabs plain">' + [['ios', '아이폰'], ['android', '안드로이드'], ['pc', 'PC']].map(function (x) {
            return '<a href="#/install?os=' + x[0] + '" class="' + (tab === x[0] ? 'on' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</a>';
          }).join('') + '</div>' +
          '<div class="card install-guide">' + steps(tab) + '</div>' +
          '<button class="btn btn-ghost btn-block" data-share>' + icon('send') + '다른 사람에게 앱 링크 보내기</button>' +
        '</section>';
      U.$$('[data-tab]', ctx.el).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); tab = a.dataset.tab; draw(); }; });
      var q;
      if ((q = ctx.el.querySelector('[data-open]'))) q.onclick = function () { Install.deferred ? Install.prompt() : Install.open(); };
      if ((q = ctx.el.querySelector('[data-prompt]'))) q.onclick = function () { Install.prompt(); };
      if ((q = ctx.el.querySelector('[data-share]'))) q.onclick = Install.share;
      if ((q = ctx.el.querySelector('[data-qr]'))) Install.qrSVG(Install.installURL()).then(function (svg) { q.innerHTML = svg; });
    }
    draw();
  }, { title: '앱 설치' });
})();
