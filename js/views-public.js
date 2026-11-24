/* =====================================================================
 * 공개 화면: 홈 · 소개 · 예배 안내 · 공동체 · FOUNDATION · 소식 · 갤러리 · 예배 문의
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon, text = U.text;

  function C() { return App.content; }
  function ext(url) { return /^https?:\/\//.test(url || ''); }

  /* ---------------- 홈 ---------------- */
  App.route('/', async function (ctx) {
    var h = C().home, w = C().worship, L = C().links;
    var cur = null, notices = [], photos = [];
    try {
      var r = await Promise.all([App.api.questions.current(), App.api.notices.list(), App.api.photos.list()]);
      cur = r[0]; notices = r[1].slice(0, 3); photos = r[2].slice(0, 8);
    } catch (e) { console.warn(e); }
    if (!ctx.alive()) return;

    var ways = [
      ['#/contact', '예배 문의 신청', 'mail'],
      [L.giving, '온라인 헌금', 'gift'],
      [L.table, 'INTO TABLE', 'table'],
      [L.newsletter, 'INTO NEWS LETTER', 'letter']
    ].filter(function (x) { return x[0]; });

    ctx.el.innerHTML =
      '<section class="hero container">' +
        '<h1 class="hero-title">' + h.heroLines.map(esc).join('<br>') + '</h1>' +
        '<div class="hero-slogan">' + h.sloganLines.map(function (s) { return '<p>' + esc(s) + '</p>'; }).join('') + '</div>' +
        '<p class="hero-intro">' + text(h.intro) + '</p>' +
      '</section>' +

      '<section class="container home-cards">' +
        (cur ? '<a class="wq-card" href="#/q/week/' + cur.id + '">' +
            '<div class="wq-label">' + icon('book') + '이번 주 나눔 <span>· ' + esc(U.weekLabel(cur.week_of)) + '</span></div>' +
            '<div class="wq-title">' + esc(cur.title) + '</div>' +
            (cur.scripture ? '<div class="wq-verse">' + esc(cur.scripture) + (cur.preacher ? ' · ' + esc(cur.preacher) : '') + '</div>' : '') +
            (cur.questions && cur.questions.length ? '<div class="wq-first">Q1. ' + esc(cur.questions[0]) + '</div>' : '') +
            '<div class="wq-cta">나눔 남기기 ' + icon('chevron-right') + '</div></a>'
          : '<a class="wq-card wq-empty" href="#/q"><div class="wq-label">' + icon('book') + '이번 주 나눔</div><div class="wq-title">곧 이번 주 나눔지가 올라와요</div><div class="wq-cta">지난 나눔 보기 ' + icon('chevron-right') + '</div></a>') +
        (App.inTeam && App.inTeam('worship') ? '<a class="team-mini" href="#/scores">' + icon('music') + '<span><b>찬양팀 악보</b><small>이번 주 콘티 보기</small></span>' + icon('chevron-right') + '</a>' : '') +
        '<a class="worship-mini" href="#/worship">' +
          '<div class="wm-head">' + icon('calendar') + '주일 예배</div>' +
          w.times.map(function (t) { return '<div class="wm-row"><b>' + esc(t.time) + '</b><span>' + esc(t.name) + '</span></div>'; }).join('') +
          '<div class="wm-place">' + icon('map') + esc(w.placeName) + '</div>' +
        '</a>' +
      '</section>' +

      (h.heroImage ? '<section class="container"><div class="hero-graphic"><img src="' + esc(h.heroImage) + '" alt="INTO CHURCH" loading="lazy"></div></section>' : '') +

      '<section class="principles container">' +
        h.principles.map(function (p) {
          return '<article class="principle"><h2 class="serif">' + esc(p.en) + '</h2><div class="p-ko">' + esc(p.ko) + '</div><p class="p-text">' + text(p.text) + '</p><div class="p-verse">' + esc(p.verse) + '</div></article>';
        }).join('') +
      '</section>' +

      '<section class="place-band"><div class="container">' +
        '<p class="place-label">' + esc(h.place.label) + '</p>' +
        '<h2 class="place-name">' + esc(h.place.name) + '</h2>' +
        '<p class="place-desc">' + text(h.place.desc) + '</p>' +
        '<p class="place-addr">' + icon('map') + esc(h.place.address) + '</p>' +
        (h.place.linkUrl ? '<a class="btn btn-light" href="' + esc(h.place.linkUrl) + '" target="_blank" rel="noopener">' + esc(h.place.linkLabel || '자세히 보기') + '</a>' : '') +
      '</div></section>' +

      (h.slides && h.slides.length ? '<section class="container slides-wrap"><div class="slides" id="slides">' +
        h.slides.map(function (s, i) { return '<div class="slide"><img src="' + esc(s) + '" alt="" loading="' + (i < 2 ? 'eager' : 'lazy') + '" data-i="' + i + '"></div>'; }).join('') +
        '</div><div class="dots" id="dots">' + h.slides.map(function (_, i) { return '<button aria-label="' + (i + 1) + '번 사진" data-dot="' + i + '"></button>'; }).join('') + '</div></section>' : '') +

      '<section class="container ways">' +
        '<h2 class="section-title">' + esc(h.waysTitle) + '</h2>' +
        '<div class="ways-grid">' + ways.map(function (x) {
          return '<a class="way-btn" href="' + esc(x[0]) + '"' + (ext(x[0]) ? ' target="_blank" rel="noopener"' : '') + '>' + icon(x[2]) + '<span>' + esc(x[1]) + '</span></a>';
        }).join('') + '</div>' +
      '</section>' +

      (notices.length ? '<section class="container home-news"><div class="section-row"><h2 class="section-title sm">교회 소식</h2><a href="#/news" class="more">전체 보기 ' + icon('chevron-right') + '</a></div>' +
        '<div class="list-card">' + notices.map(noticeRow).join('') + '</div></section>' : '') +

      (photos.length ? '<section class="container home-gallery"><div class="section-row"><h2 class="section-title sm">갤러리</h2><a href="#/gallery" class="more">더 보기 ' + icon('chevron-right') + '</a></div>' +
        '<div class="photo-grid">' + photos.map(function (p, i) { return '<button class="ph" data-ph="' + i + '"><img src="' + esc(p.thumb_url || p.url) + '" alt="' + esc(p.caption || '') + '" loading="lazy"></button>'; }).join('') + '</div></section>' : '') +

      (App.canInstall() ? '<section class="container"><button class="install-card" data-install>' + U.markSVG() + '<div><b>홈 화면에 인투처치 앱 추가하기</b><span>앱처럼 바로 열고, 이번 주 나눔을 놓치지 마세요</span></div>' + icon('chevron-right') + '</button></section>'
        : (window.Install && !Install.env.mobile && !Install.standalone() ? '<section class="container"><div class="install-card pc"><div class="is-qr" data-home-qr></div><div><b>휴대폰에 인투처치 앱 설치하기</b><span>휴대폰 카메라로 QR 코드를 찍으면 설치 안내가 열려요</span><a class="more" href="#/install">설치 안내 보기 ' + icon('chevron-right') + '</a></div></div></section>' : ''));

    // 슬라이드
    var sl = ctx.el.querySelector('#slides');
    if (sl) {
      var dots = U.$$('[data-dot]', ctx.el), idx = 0, timer;
      var setDot = function (i) { dots.forEach(function (d, j) { d.classList.toggle('on', i === j); }); };
      var goTo = function (i) { idx = (i + dots.length) % dots.length; sl.scrollTo({ left: sl.children[idx].offsetLeft - sl.offsetLeft, behavior: 'smooth' }); };
      sl.addEventListener('scroll', U.debounce(function () {
        var w0 = sl.children[0].getBoundingClientRect().width || 1; idx = Math.round(sl.scrollLeft / w0); setDot(idx);
      }, 60), { passive: true });
      dots.forEach(function (d) { d.onclick = function () { goTo(+d.dataset.dot); restart(); }; });
      var restart = function () { clearInterval(timer); timer = setInterval(function () { if (!document.body.contains(sl)) return clearInterval(timer); goTo(idx + 1); }, 5000); };
      setDot(0); restart();
      sl.addEventListener('click', function (e) { var im = e.target.closest('img'); if (im) U.lightbox(h.slides, +im.dataset.i); });
    }
    U.$$('[data-ph]', ctx.el).forEach(function (b) {
      b.onclick = function () { U.lightbox(photos.map(function (p) { return p.url; }), +b.dataset.ph); };
    });
    var ib = ctx.el.querySelector('[data-install]'); if (ib) ib.onclick = App.install;
    var hq = ctx.el.querySelector('[data-home-qr]');
    if (hq) Install.qrSVG(Install.installURL()).then(function (svg) { hq.innerHTML = svg; }).catch(function () { });
    // 지금 열려 있는 나눔 조 나누기가 있으면 맨 위에 알림
    if (App.isMember() && App.api.mix) App.api.mix.listOpen().then(function (rs) {
      rs = rs.filter(function (r) { return r.status !== 'closed'; });
      var box = ctx.alive() && ctx.el.querySelector('.home-cards'); if (!rs.length || !box) return;
      var r = rs[0], a = document.createElement('a');
      a.className = 'mix-banner'; a.href = '#/mix/' + r.code + '?j=1';
      a.innerHTML = '<span class="mix-banner-i">' + icon('users') + '</span><span class="mix-banner-t"><b>' + esc(r.title) + ' 조 나누기</b><small>' + (r.status === 'done' ? '조가 나뉘었어요 · 내 조 확인하기' : '지금 참가 받는 중 · 코드 ' + r.code) + '</small></span>' + icon('chevron-right');
      box.insertBefore(a, box.firstChild);
    }).catch(function () { });
  }, { title: '' });

  function noticeRow(n) {
    return '<a class="list-row" href="#/news/' + n.id + '">' +
      (n.image_url ? '<img class="lr-thumb" src="' + esc(n.image_url) + '" alt="" loading="lazy">' : '<span class="lr-icon">' + icon(n.pinned ? 'pin' : 'news') + '</span>') +
      '<span class="lr-body"><span class="lr-title">' + (n.pinned ? '<em class="chip">고정</em>' : '') + esc(n.title) + '</span><span class="lr-sub">' + U.fmtDate(n.created_at) + '</span></span>' + icon('chevron-right', 'lr-arrow') + '</a>';
  }
  App.noticeRow = noticeRow;

  /* ---------------- 우리는 인투처치입니다 ---------------- */
  App.route('/about', async function (ctx) {
    var a = C().about;
    ctx.el.innerHTML = App.pageHead(a.title) +
      '<section class="container prose about">' +
        '<h2 class="about-heading">' + esc(a.heading) + '</h2>' +
        a.paragraphs.map(function (p) { return '<p>' + text(p) + '</p>'; }).join('') +
      '</section>' +
      '<section class="into-band"><div class="container">' +
        '<h2 class="into-title serif">' + esc(a.intoTitle) + '</h2>' +
        '<p class="into-lead">' + esc(a.intoLead) + '</p>' +
        '<ul class="into-list">' + a.intoList.map(function (s) { return '<li class="serif">' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '</div></section>' +
      '<section class="container prose about">' + a.incarnation.map(function (p) { return '<p>' + text(p) + '</p>'; }).join('') + '</section>' +
      (a.image ? '<section class="container"><img class="about-img" src="' + esc(a.image) + '" alt="INTO CHURCH" loading="lazy"></section>' : '');
  }, { title: '우리는 인투처치입니다' });

  /* ---------------- 주일 예배 안내 ---------------- */
  App.route('/worship', async function (ctx) {
    var w = C().worship;
    var q = encodeURIComponent(w.address);
    ctx.el.innerHTML = App.pageHead(w.title) +
      '<section class="container worship-grid">' +
        (w.image ? '<div class="worship-img"><img src="' + esc(w.image) + '" alt="" loading="lazy"></div>' : '') +
        '<div class="worship-info">' +
          w.times.map(function (t) {
            return '<div class="time-card"><div class="tc-time">' + esc(t.time) + '</div><div><div class="tc-name">' + esc(t.name) + '</div>' + (t.desc ? '<div class="tc-desc">' + text(t.desc) + '</div>' : '') + '</div></div>';
          }).join('') +
          '<div class="place-card">' +
            '<div class="pc-label">' + icon('map') + '예배 장소</div>' +
            '<div class="pc-name">' + esc(w.placeName) + '</div>' +
            '<div class="pc-addr">' + esc(w.address) + '</div>' +
            '<div class="row-gap">' +
              '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="https://map.naver.com/p/search/' + q + '">네이버 지도</a>' +
              '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="https://map.kakao.com/?q=' + q + '">카카오맵</a>' +
              '<button class="btn btn-sm btn-ghost" data-copy="' + esc(w.address) + '">주소 복사</button>' +
            '</div>' +
          '</div>' +
          (w.notes ? '<p class="muted">' + text(w.notes) + '</p>' : '') +
          '<a class="btn btn-primary btn-block" href="#/contact">' + icon('mail') + '예배 문의 신청</a>' +
        '</div>' +
      '</section>';
    var cp = ctx.el.querySelector('[data-copy]');
    if (cp) cp.onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText(cp.dataset.copy) : Promise.reject())
        .then(function () { U.toast('주소를 복사했어요.'); }, function () { U.toast(cp.dataset.copy); });
    };
  }, { title: '주일 예배 안내' });

  /* ---------------- 예배와 공동체 ---------------- */
  App.route('/community', async function (ctx) {
    var c = C().community;
    ctx.el.innerHTML = App.pageHead(c.title) +
      '<section class="container community">' + c.items.map(function (it, i) {
        return '<article class="comm-item"><div class="comm-no">0' + (i + 1) + '</div><h2>' + esc(it.en) + '</h2><h3>' + esc(it.ko) + '</h3><p>' + text(it.text) + '</p></article>';
      }).join('') + '</section>';
  }, { title: '예배와 공동체' });

  /* ---------------- FOUNDATION ---------------- */
  App.route('/foundation', async function (ctx) {
    var f = C().foundation;
    ctx.el.innerHTML = App.pageHead(f.title) +
      '<section class="container foundation">' + f.items.map(function (it) {
        return '<article class="fd-item"><h2>' + esc(it.title) + '</h2><p>' + text(it.text) + '</p></article>';
      }).join('') +
      (f.closing ? '<p class="fd-closing">' + esc(f.closing) + '</p>' : '') + '</section>';
  }, { title: 'FOUNDATION' });

  /* ---------------- 교회 소식 ---------------- */
  App.route('/news', async function (ctx) {
    var list = await App.api.notices.list();
    if (!ctx.alive()) return;
    ctx.el.innerHTML = App.pageHead('교회 소식', '인투처치의 공지와 소식을 전해요') +
      '<section class="container">' + (list.length ? '<div class="list-card">' + list.map(noticeRow).join('') + '</div>' : '<div class="empty">아직 등록된 소식이 없어요.</div>') + '</section>';
  }, { title: '교회 소식' });

  App.route('/news/:id', async function (ctx) {
    var n = await App.api.notices.get(ctx.params.id);
    if (!ctx.alive()) return;
    ctx.el.innerHTML =
      '<article class="container article">' +
        '<a class="back" href="#/news">' + icon('chevron-left') + '교회 소식</a>' +
        '<h1>' + esc(n.title) + '</h1><div class="meta">' + U.fmtDate(n.created_at, true) + '</div>' +
        (n.image_url ? '<img class="article-img" src="' + esc(n.image_url) + '" alt="">' : '') +
        '<div class="article-body">' + text(n.body) + '</div>' +
        (n.link_url ? '<a class="btn btn-ghost" href="' + esc(n.link_url) + '" target="_blank" rel="noopener">' + icon('external') + '관련 링크 열기</a>' : '') +
        (App.isAdmin() ? '<div class="admin-inline"><a class="btn btn-sm btn-ghost" href="#/admin/notices/' + n.id + '">' + icon('edit') + '관리자에서 수정</a></div>' : '') +
      '</article>';
    var img = ctx.el.querySelector('.article-img'); if (img) img.onclick = function () { U.lightbox([n.image_url], 0); };
  }, { title: '교회 소식' });

  /* ---------------- 갤러리 ---------------- */
  App.route('/gallery', async function (ctx) {
    var list = await App.api.photos.list();
    if (!ctx.alive()) return;
    var tags = [];
    list.forEach(function (p) { if (p.tag && tags.indexOf(p.tag) < 0) tags.push(p.tag); });
    var cur = ctx.query.tag || '';
    function draw() {
      var shown = list.filter(function (p) { return !cur || p.tag === cur; });
      ctx.el.innerHTML = App.pageHead('갤러리', '함께한 시간들') +
        '<section class="container">' +
          (tags.length > 1 ? '<div class="chips">' + ['<button class="chip-btn' + (!cur ? ' on' : '') + '" data-tag="">전체</button>'].concat(tags.map(function (t) { return '<button class="chip-btn' + (cur === t ? ' on' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>'; })).join('') + '</div>' : '') +
          (shown.length ? '<div class="photo-grid big">' + shown.map(function (p, i) {
            return '<button class="ph" data-i="' + i + '"><img src="' + esc(p.thumb_url || p.url) + '" alt="' + esc(p.caption || '') + '" loading="lazy">' + (p.caption ? '<span class="ph-cap">' + esc(p.caption) + '</span>' : '') + '</button>';
          }).join('') + '</div>' : '<div class="empty">사진이 없어요.</div>') +
        '</section>';
      U.$$('[data-tag]', ctx.el).forEach(function (b) { b.onclick = function () { cur = b.dataset.tag; draw(); }; });
      U.$$('[data-i]', ctx.el).forEach(function (b) { b.onclick = function () { U.lightbox(shown.map(function (p) { return p.url; }), +b.dataset.i); }; });
    }
    draw();
  }, { title: '갤러리' });

  /* ---------------- 예배 문의 / 새가족 신청 ---------------- */
  App.route('/contact', async function (ctx) {
    var kinds = (C().settings && C().settings.inquiry_kinds) || ['예배 참석', '기타 문의'];
    var p = App.profile() || {};
    ctx.el.innerHTML = App.pageHead('예배 문의 신청', '처음 오시나요? 남겨 주시면 담당자가 연락드릴게요.') +
      '<section class="container narrow">' +
        '<form class="card form" id="inq-form" novalidate>' +
          '<label class="field"><span>문의 유형</span><div class="seg">' + kinds.map(function (k, i) {
            return '<label><input type="radio" name="kind" value="' + esc(k) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(k) + '</span></label>';
          }).join('') + '</div></label>' +
          '<label class="field"><span>이름 <em>*</em></span><input name="name" required maxlength="40" value="' + esc(p.name || '') + '" autocomplete="name"></label>' +
          '<label class="field"><span>연락처 <em>*</em></span><input name="phone" type="tel" required maxlength="20" placeholder="010-0000-0000" value="' + esc(p.phone || '') + '" autocomplete="tel"></label>' +
          '<label class="field"><span>이메일</span><input name="email" type="email" maxlength="80" value="' + esc(p.email || '') + '" autocomplete="email"></label>' +
          '<label class="field"><span>방문 희망 주일</span><input name="preferred_date" type="date" value="' + U.sundayOf(new Date()) + '"></label>' +
          '<label class="field"><span>남기실 말씀</span><textarea name="message" rows="4" maxlength="2000" placeholder="궁금한 점이나 전하고 싶은 이야기를 자유롭게 적어 주세요."></textarea></label>' +
          '<label class="check"><input type="checkbox" name="agree"><span>개인정보(이름·연락처·이메일)를 문의 응대 목적으로 수집·이용하는 데 동의합니다. <small class="muted">응대 완료 후 요청 시 삭제됩니다.</small></span></label>' +
          '<button class="btn btn-primary btn-block" type="submit">' + icon('send') + '문의 보내기</button>' +
        '</form>' +
      '</section>';
    var f = ctx.el.querySelector('#inq-form');
    f.onsubmit = async function (e) {
      e.preventDefault();
      var d = U.formData(f);
      if (!d.name) return U.toast('이름을 입력해 주세요.', 'error');
      if (!d.phone && !d.email) return U.toast('연락처나 이메일 중 하나는 꼭 남겨 주세요.', 'error');
      if (!d.agree) return U.toast('개인정보 수집·이용에 동의해 주세요.', 'error');
      var btn = f.querySelector('button[type=submit]'); U.busy(btn, true);
      try {
        await App.api.inquiries.create({ name: d.name, phone: d.phone, email: d.email, kind: d.kind, preferred_date: d.preferred_date || null, message: d.message });
        ctx.el.querySelector('.narrow').innerHTML = '<div class="card done-card">' + icon('check') + '<h2>문의가 접수됐어요</h2><p class="muted">확인 후 연락드릴게요. 주일에 만나요!</p><div class="row-gap"><a class="btn btn-primary" href="#/worship">예배 안내 보기</a><a class="btn btn-ghost" href="#/">홈으로</a></div></div>';
        App.refreshBadges(true);
      } catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(btn, false); }
    };
  }, { title: '예배 문의 신청' });
})();
