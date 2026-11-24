/* =====================================================================
 * 회원 화면: 로그인·회원가입·MY · 이번 주 나눔지 · 질문 게시판
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon, text = U.text;

  function nextPath(ctx) { var n = ctx.query.next; return n && n.charAt(0) === '/' ? n : '/me'; }

  /* ---------------- 로그인 ---------------- */
  App.route('/login', async function (ctx) {
    if (App.isLoggedIn()) return App.go(nextPath(ctx), true);
    var next = ctx.query.next ? '?next=' + encodeURIComponent(ctx.query.next) : '';
    ctx.el.innerHTML =
      '<section class="container narrow auth">' +
        '<div class="auth-mark">' + U.markSVG() + '</div>' +
        '<h1>로그인</h1><p class="muted">인투처치 성도 계정으로 로그인하세요.</p>' +
        '<form class="card form" id="login-form">' +
          '<label class="field"><span>이메일</span><input name="email" type="email" required autocomplete="email" inputmode="email"></label>' +
          '<label class="field"><span>비밀번호</span><div class="pw-wrap"><input name="password" type="password" required autocomplete="current-password"><button type="button" class="pw-eye" aria-label="비밀번호 보기">' + icon('eye') + '</button></div></label>' +
          '<button class="btn btn-primary btn-block" type="submit">로그인</button>' +
          '<div class="auth-links"><a href="#/signup' + next + '">회원가입</a><span>·</span><a href="#/forgot">비밀번호 찾기</a></div>' +
        '</form>' +
        (App.api.mode === 'demo' ? '<div class="card demo-hint"><b>데모 계정</b><button type="button" class="link" data-fill="admin">관리자 admin@into.demo</button><button type="button" class="link" data-fill="member">성도 member@into.demo</button><span class="muted small">비밀번호: into1234</span></div>' : '') +
      '</section>';
    var f = ctx.el.querySelector('#login-form');
    bindPwEye(f);
    U.$$('[data-fill]', ctx.el).forEach(function (b) {
      b.onclick = function () { f.email.value = b.dataset.fill + '@into.demo'; f.password.value = 'into1234'; };
    });
    f.onsubmit = async function (e) {
      e.preventDefault();
      var btn = f.querySelector('[type=submit]'); U.busy(btn, true);
      try {
        await App.api.auth.signIn(f.email.value.trim(), f.password.value);
        App.session = await App.api.auth.current();
        App.refreshChrome();
        U.toast('환영합니다, ' + (App.profile() ? App.profile().name : '') + ' 님!');
        App.go(nextPath(ctx), true);
      } catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(btn, false); }
    };
  }, { title: '로그인' });

  function bindPwEye(root) {
    U.$$('.pw-eye', root).forEach(function (b) {
      b.onclick = function () {
        var inp = b.parentNode.querySelector('input'); var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eye-off' : 'eye');
      };
    });
  }

  /* ---------------- 회원가입 ---------------- */
  App.route('/signup', async function (ctx) {
    if (App.isLoggedIn()) return App.go('/me', true);
    var needApproval = App.content.settings && App.content.settings.require_approval;
    ctx.el.innerHTML =
      '<section class="container narrow auth">' +
        '<div class="auth-mark">' + U.markSVG() + '</div>' +
        '<h1>회원가입</h1><p class="muted">가입하면 이번 주 나눔지에 나눔을 남기고 질문 게시판을 이용할 수 있어요.' + (needApproval ? '<br><b>가입 후 관리자 승인이 필요해요.</b>' : '') + '</p>' +
        '<form class="card form" id="signup-form" novalidate>' +
          '<label class="field"><span>이름 <em>*</em></span><input name="name" required maxlength="30" autocomplete="name" placeholder="실명을 적어 주세요"></label>' +
          '<label class="field"><span>이메일 <em>*</em></span><input name="email" type="email" required autocomplete="email" inputmode="email"></label>' +
          '<label class="field"><span>비밀번호 <em>*</em> <small class="muted">6자 이상</small></span><div class="pw-wrap"><input name="password" type="password" required minlength="6" autocomplete="new-password"><button type="button" class="pw-eye" aria-label="비밀번호 보기">' + icon('eye') + '</button></div></label>' +
          '<label class="field"><span>비밀번호 확인 <em>*</em></span><input name="password2" type="password" required autocomplete="new-password"></label>' +
          '<label class="field"><span>연락처 <small class="muted">(선택)</small></span><input name="phone" type="tel" maxlength="20" placeholder="010-0000-0000" autocomplete="tel"></label>' +
          '<label class="check"><input type="checkbox" name="agree"><span>[필수] 개인정보(이름·이메일·연락처)를 교회 공동체 운영 목적으로 수집·이용하는 데 동의합니다. <small class="muted">탈퇴 시 지체 없이 파기합니다.</small></span></label>' +
          '<button class="btn btn-primary btn-block" type="submit">가입하기</button>' +
          '<div class="auth-links">이미 계정이 있나요? <a href="#/login' + (ctx.query.next ? '?next=' + encodeURIComponent(ctx.query.next) : '') + '">로그인</a></div>' +
        '</form>' +
      '</section>';
    var f = ctx.el.querySelector('#signup-form');
    bindPwEye(f);
    f.onsubmit = async function (e) {
      e.preventDefault();
      var d = U.formData(f);
      if (!d.name) return U.toast('이름을 입력해 주세요.', 'error');
      if (!/^\S+@\S+\.\S+$/.test(d.email)) return U.toast('이메일 형식을 확인해 주세요.', 'error');
      if ((f.password.value || '').length < 6) return U.toast('비밀번호는 6자 이상이어야 해요.', 'error');
      if (f.password.value !== f.password2.value) return U.toast('비밀번호가 서로 달라요.', 'error');
      if (!d.agree) return U.toast('개인정보 수집·이용에 동의해 주세요.', 'error');
      var btn = f.querySelector('[type=submit]'); U.busy(btn, true);
      try {
        var r = await App.api.auth.signUp({ email: d.email, password: f.password.value, name: d.name, phone: d.phone });
        if (r.needsConfirm) {
          ctx.el.querySelector('.auth').innerHTML = '<div class="card done-card">' + icon('mail') + '<h2>인증 메일을 보냈어요</h2><p class="muted">' + esc(d.email) + ' 메일함에서 인증 링크를 누르면 가입이 완료돼요.<br>메일이 안 보이면 스팸함도 확인해 주세요.</p><a class="btn btn-primary" href="#/login">로그인 화면으로</a></div>';
          return;
        }
        App.session = await App.api.auth.current();
        App.refreshChrome();
        U.toast(App.profile() && App.profile().status === 'pending' ? '가입 완료! 관리자 승인 후 이용할 수 있어요.' : '가입을 환영합니다!');
        App.go(ctx.query.next && ctx.query.next.charAt(0) === '/' ? ctx.query.next : '/me', true);
        if (window.Install) Install.maybeAuto(true);
      } catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(btn, false); }
    };
  }, { title: '회원가입' });

  /* ---------------- 비밀번호 찾기 / 재설정 ---------------- */
  App.route('/forgot', async function (ctx) {
    ctx.el.innerHTML =
      '<section class="container narrow auth"><h1>비밀번호 찾기</h1><p class="muted">가입한 이메일로 재설정 링크를 보내 드려요.</p>' +
      '<form class="card form" id="fg"><label class="field"><span>이메일</span><input name="email" type="email" required></label><button class="btn btn-primary btn-block">재설정 메일 보내기</button></form></section>';
    var f = ctx.el.querySelector('#fg');
    f.onsubmit = async function (e) {
      e.preventDefault(); var btn = f.querySelector('button'); U.busy(btn, true);
      try { await App.api.auth.resetPassword(f.email.value.trim()); f.innerHTML = '<p>' + icon('check') + ' 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 설정하세요.</p>'; }
      catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(btn, false); }
    };
  }, { title: '비밀번호 찾기' });

  App.route('/reset', async function (ctx) {
    if (!App.isLoggedIn()) {
      ctx.el.innerHTML = '<section class="container narrow auth"><div class="card">링크가 만료되었거나 잘못되었어요. <a href="#/forgot">다시 요청하기</a></div></section>'; return;
    }
    ctx.el.innerHTML =
      '<section class="container narrow auth"><h1>새 비밀번호 설정</h1>' +
      '<form class="card form" id="rs"><label class="field"><span>새 비밀번호 (6자 이상)</span><input name="pw" type="password" minlength="6" required autocomplete="new-password"></label>' +
      '<label class="field"><span>새 비밀번호 확인</span><input name="pw2" type="password" required autocomplete="new-password"></label><button class="btn btn-primary btn-block">변경하기</button></form></section>';
    var f = ctx.el.querySelector('#rs');
    f.onsubmit = async function (e) {
      e.preventDefault();
      if (f.pw.value.length < 6) return U.toast('비밀번호는 6자 이상이어야 해요.', 'error');
      if (f.pw.value !== f.pw2.value) return U.toast('비밀번호가 서로 달라요.', 'error');
      try { await App.api.auth.updatePassword(f.pw.value); U.toast('비밀번호를 변경했어요.'); App.go('/me', true); }
      catch (err) { U.toast(U.errMsg(err), 'error'); }
    };
  }, { title: '새 비밀번호' });

  /* ---------------- MY ---------------- */
  App.route('/me', async function (ctx) {
    var p = App.profile();
    var r = await Promise.all([App.api.answers.listMine(), App.api.qna.listMine()]);
    if (!ctx.alive()) return;
    var answers = r[0], qnas = r[1];
    var statusChip = { active: '', pending: '<span class="chip chip-warn">승인 대기</span>', blocked: '<span class="chip chip-danger">이용 제한</span>' }[p.status] || '';
    ctx.el.innerHTML =
      '<section class="container narrow me">' +
        '<div class="me-card">' +
          '<div class="avatar">' + esc((p.name || '?').slice(0, 1)) + '</div>' +
          '<div class="me-info"><div class="me-name">' + esc(p.name) + ' ' + (p.role === 'admin' ? '<span class="chip">관리자</span>' : '') + statusChip + '</div>' +
          '<div class="muted small">' + esc(p.email || '') + (p.phone ? ' · ' + esc(p.phone) : '') + '</div></div>' +
          '<button class="btn btn-sm btn-ghost" data-edit>' + icon('edit') + '수정</button>' +
        '</div>' +
        (p.status === 'pending' ? App.pendingNotice() : '') +
        (App.inTeam('worship') ? '<a class="admin-entry team" href="#/scores">' + icon('music') + '<div><b>찬양팀 악보</b><span>콘티별 악보를 페이지별로 크게 보기</span></div>' + icon('chevron-right') + '</a>' : '') +
        (App.isAdmin() ? '<a class="admin-entry" href="#/admin">' + icon('settings') + '<div><b>관리자 페이지</b><span>질문·소식·회원·문의 관리 (PC 화면 권장)</span></div>' + icon('chevron-right') + '</a>' : '') +

        '<h2 class="sub-title">내 나눔 <span class="muted">' + answers.length + '</span></h2>' +
        (answers.length ? '<div class="list-card">' + answers.slice(0, 10).map(function (a) {
          return '<a class="list-row" href="#/q/week/' + a.question_id + '"><span class="lr-icon">' + icon('question') + '</span><span class="lr-body"><span class="lr-title">' + esc(a.question_title || '나눔지') + '</span><span class="lr-sub">' + esc(a.body.slice(0, 60)) + (a.is_anonymous ? ' · 익명' : '') + '</span></span>' + icon('chevron-right', 'lr-arrow') + '</a>';
        }).join('') + '</div>' : '<div class="empty sm">아직 남긴 나눔이 없어요. <a href="#/q">이번 주 나눔지 보러 가기</a></div>') +

        '<h2 class="sub-title">내 질문 <span class="muted">' + qnas.length + '</span></h2>' +
        (qnas.length ? '<div class="list-card">' + qnas.slice(0, 10).map(qnaRow).join('') + '</div>' : '<div class="empty sm">올린 질문이 없어요. <a href="#/q/board/new">질문하기</a></div>') +

        '<div class="menu-list">' +
          (App.canInstall() ? '<button data-install>' + icon('install') + '앱 설치 (홈 화면에 추가)</button>' : '') +
          '<button data-share-app>' + icon('send') + '앱 링크 공유하기</button>' +
          '<button data-pw>' + icon('lock') + '비밀번호 변경</button>' +
          '<a href="#/contact">' + icon('mail') + '예배 문의 / 새가족 신청</a>' +
          '<button data-logout>' + icon('logout') + '로그아웃</button>' +
          '<button data-withdraw class="danger-text">' + icon('trash') + '회원 탈퇴</button>' +
        '</div>' +
      '</section>';

    ctx.el.querySelector('[data-edit]').onclick = function () {
      U.modal({
        title: '내 정보 수정',
        html: '<form class="form" id="pf"><label class="field"><span>이름</span><input name="name" value="' + esc(p.name) + '" maxlength="30" required></label><label class="field"><span>연락처</span><input name="phone" type="tel" value="' + esc(p.phone || '') + '" maxlength="20"></label><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">저장</button></div></form>',
        onMount: function (root, close) {
          var f = root.querySelector('#pf');
          f.onsubmit = async function (e) {
            e.preventDefault();
            try { await App.api.profiles.updateMe({ name: f.name.value.trim(), phone: f.phone.value.trim() }); App.session = await App.api.auth.current(); App.refreshChrome(); U.toast('저장했어요.'); close(); App.render(); }
            catch (err) { U.toast(U.errMsg(err), 'error'); }
          };
        }
      });
    };
    ctx.el.querySelector('[data-pw]').onclick = function () {
      U.modal({
        title: '비밀번호 변경',
        html: '<form class="form" id="pwf"><label class="field"><span>새 비밀번호 (6자 이상)</span><input name="pw" type="password" minlength="6" required autocomplete="new-password"></label><label class="field"><span>새 비밀번호 확인</span><input name="pw2" type="password" required autocomplete="new-password"></label><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">변경</button></div></form>',
        onMount: function (root, close) {
          var f = root.querySelector('#pwf');
          f.onsubmit = async function (e) {
            e.preventDefault();
            if (f.pw.value.length < 6) return U.toast('비밀번호는 6자 이상이어야 해요.', 'error');
            if (f.pw.value !== f.pw2.value) return U.toast('비밀번호가 서로 달라요.', 'error');
            try { await App.api.auth.updatePassword(f.pw.value); U.toast('비밀번호를 변경했어요.'); close(); }
            catch (err) { U.toast(U.errMsg(err), 'error'); }
          };
        }
      });
    };
    ctx.el.querySelector('[data-withdraw]').onclick = async function () {
      if (!(await U.confirm('정말 탈퇴할까요?\n작성한 나눔·질문은 "탈퇴한 회원"으로 남거나 관리자가 정리합니다.', '탈퇴하기', true))) return;
      try { await App.api.profiles.withdraw(); if (window.Scores) Scores.clearCache(); App.session = null; U.toast('탈퇴 처리됐어요. 함께해 주셔서 감사했어요.'); App.go('/'); }
      catch (err) { U.toast(U.errMsg(err), 'error'); }
    };
    var ib = ctx.el.querySelector('[data-install]'); if (ib) ib.onclick = App.install;
    ctx.el.querySelector('[data-share-app]').onclick = function () { window.Install && Install.share(); };
  }, { title: 'MY', auth: true });

  /* ================= 나눔 (이번 주 나눔지 + 질문 게시판) ================= */
  function qTabs(active) {
    return '<div class="seg-tabs container"><a href="#/q" class="' + (active === 'week' ? 'on' : '') + '">이번 주 나눔지</a><a href="#/q/board" class="' + (active === 'board' ? 'on' : '') + '">질문 게시판</a><a href="#/mix" class="' + (active === 'mix' ? 'on' : '') + '">조 나누기</a></div>';
  }
  App.qTabs = qTabs;

  App.route('/q', async function (ctx) {
    var list = await App.api.questions.list();
    if (!ctx.alive()) return;
    if (!list.length) {
      ctx.el.innerHTML = App.pageHead('나눔', '') + qTabs('week') + '<section class="container"><div class="empty">아직 공개된 나눔지가 없어요.<br><span class="muted small">매주 목사님이 나눔지를 올려 주실 거예요.</span></div></section>';
      return;
    }
    await renderWeek(ctx, list[0], list);
  }, { title: '이번 주 나눔' });

  App.route('/q/week/:id', async function (ctx) {
    var r = await Promise.all([App.api.questions.get(ctx.params.id), App.api.questions.list()]);
    if (!ctx.alive()) return;
    await renderWeek(ctx, r[0], r[1]);
  }, { title: '이번 주 나눔' });

  function sec(title, html, cls) { return '<section class="sheet-sec' + (cls ? ' ' + cls : '') + '"><h3>' + title + '</h3>' + html + '</section>'; }

  async function renderWeek(ctx, q, all) {
    var answers = await App.api.answers.listByQuestion(q.id);
    if (!ctx.alive()) return;
    var isCurrent = all[0] && all[0].id === q.id;
    var past = all.filter(function (x) { return x.id !== q.id; });
    var p = App.profile();
    var qs = (q.questions || []).filter(function (x) { return x && String(x).trim(); });
    var counts = {};
    (answers || []).forEach(function (a) { var k = a.question_no || 0; counts[k] = (counts[k] || 0) + 1; });
    var filterNo = 'all';

    var answerArea;
    if (!App.isLoggedIn()) answerArea = App.needLogin('나눔은 로그인한 성도만 보고 남길 수 있어요.');
    else if (p.status === 'pending') answerArea = App.pendingNotice();
    else if (answers === null) answerArea = App.needLogin('이용이 제한된 계정이에요.');
    else {
      answerArea =
        (q.closed ? '<div class="card notice-card">' + icon('lock') + '<div><b>나눔이 마감된 나눔지예요</b></div></div>' :
        '<form class="card answer-form" id="ans-form">' +
          (qs.length ? '<select name="question_no" class="af-select" aria-label="나눔할 질문"><option value="">전체 나눔 (자유롭게)</option>' +
            qs.map(function (t, i) { return '<option value="' + (i + 1) + '">Q' + (i + 1) + '. ' + esc(String(t).slice(0, 36)) + (String(t).length > 36 ? '…' : '') + '</option>'; }).join('') + '</select>' : '') +
          '<textarea name="body" rows="4" maxlength="3000" placeholder="' + (qs.length ? '질문을 고르고, 나의 생각과 삶을 나눠 주세요.' : '이 나눔지에 대한 나의 생각과 삶을 나눠 주세요.') + '"></textarea>' +
          '<div class="af-preview" id="af-preview"></div>' +
          '<div class="af-bar">' +
            (App.isAdmin() ? '<button type="button" class="icon-btn" data-photo aria-label="사진 첨부">' + icon('camera') + '</button>' : '') +
            (q.allow_anonymous ? '<label class="check inline"><input type="checkbox" name="is_anonymous"><span>익명으로</span></label>' : '') +
            '<button class="btn btn-primary btn-sm" type="submit">' + icon('send') + '나눔 올리기</button>' +
          '</div>' +
        '</form>') +
        '<div class="answers-head"><h3>나눔 <span class="muted">' + answers.length + '</span></h3>' +
          (qs.length && answers.length ? '<div class="chips" id="ans-filter"><button class="chip-btn on" data-fno="all">전체</button>' +
            qs.map(function (t, i) { return counts[i + 1] ? '<button class="chip-btn" data-fno="' + (i + 1) + '">Q' + (i + 1) + ' <small>' + counts[i + 1] + '</small></button>' : ''; }).join('') + '</div>' : '') +
        '</div>' +
        (answers.length ? '<div class="answers" id="answers">' + answers.map(answerCard).join('') + '</div>' : '<div class="empty sm">첫 나눔을 남겨 주세요 🙂</div>');
    }

    var meta = [esc(U.weekLabel(q.week_of)), q.preacher ? esc(q.preacher) : ''].filter(Boolean).join(' · ');
    ctx.el.innerHTML = App.pageHead('나눔', '') + qTabs('week') +
      '<section class="container narrow">' +
        '<article class="sheet" id="sheet">' +
          '<header class="wq-detail sheet-head">' +
            '<div class="wq-label">' + (isCurrent ? '<span class="chip chip-dark">이번 주</span>' : '') + meta + '</div>' +
            '<h2 class="wq-q">' + esc(q.title) + '</h2>' +
            (q.scripture ? '<div class="wq-verse">' + icon('book') + esc(q.scripture) + '</div>' : '') +
          '</header>' +
          (q.scripture_text ? '<blockquote class="sheet-verse">' + text(q.scripture_text) + (q.scripture ? '<cite>' + esc(q.scripture) + '</cite>' : '') + '</blockquote>' : '') +
          (q.body ? sec('말씀 요약', '<p>' + text(q.body) + '</p>') : '') +
          (qs.length ? sec('나눔 질문', '<ol class="sheet-qs">' + qs.map(function (t, i) {
            return '<li><span class="qn">' + (i + 1) + '</span><div><p>' + text(t) + '</p>' +
              (answers && !q.closed ? '<button class="q-answer" data-answer-q="' + (i + 1) + '">' + icon('edit') + '이 질문에 나누기' + (counts[i + 1] ? ' · 나눔 ' + counts[i + 1] : '') + '</button>' : (counts[i + 1] ? '<span class="muted small">나눔 ' + counts[i + 1] + '</span>' : '')) +
              '</div></li>';
          }).join('') + '</ol>') : '') +
          (q.application ? sec('적용 · 결단', '<p>' + text(q.application) + '</p>', 'sheet-apply') : '') +
          (q.prayer ? sec('함께 기도', '<p>' + text(q.prayer) + '</p>') : '') +
          (q.image_url ? '<img class="wq-img" src="' + esc(q.image_url) + '" alt="" loading="lazy">' : '') +
          (q.attachment_url ? '<a class="sheet-file" href="' + esc(q.attachment_url) + '" target="_blank" rel="noopener"' + (/^data:/.test(q.attachment_url) ? ' download="' + esc(q.attachment_name || '나눔지') + '"' : '') + '>' + icon('download') + '<span><b>나눔지 원본</b><small>' + esc(q.attachment_name || '파일 열기') + '</small></span></a>' : '') +
          '<div class="sheet-tools"><button class="btn btn-sm btn-ghost" data-print>' + icon('download') + '인쇄 · PDF 저장</button><button class="btn btn-sm btn-ghost" data-share-sheet>' + icon('send') + '공유</button></div>' +
        '</article>' +
        answerArea +
        (past.length ? '<h3 class="sub-title">지난 나눔지</h3><div class="list-card">' + past.map(function (x) {
          return '<a class="list-row" href="#/q/week/' + x.id + '"><span class="lr-date">' + esc(U.fmtDate(x.week_of).slice(5)) + '</span><span class="lr-body"><span class="lr-title">' + esc(x.title) + '</span>' + (x.scripture ? '<span class="lr-sub">' + esc(x.scripture) + '</span>' : '') + '</span>' + icon('chevron-right', 'lr-arrow') + '</a>';
        }).join('') + '</div>' : '') +
      '</section>';

    var img = ctx.el.querySelector('.wq-img'); if (img) img.onclick = function () { U.lightbox([q.image_url], 0); };
    ctx.el.querySelector('[data-print]').onclick = function () { window.print(); };
    ctx.el.querySelector('[data-share-sheet]').onclick = function () {
      var url = (window.Install ? Install.appURL() : location.origin + location.pathname) + '#/q/week/' + q.id;
      var data = { title: '인투처치 나눔지 · ' + q.title, text: U.weekLabel(q.week_of) + ' 나눔지', url: url };
      if (navigator.share) navigator.share(data).catch(function () { }); else Install.copy(url, '나눔지 링크를 복사했어요.');
    };
    var f = ctx.el.querySelector('#ans-form');
    U.$$('[data-answer-q]', ctx.el).forEach(function (b) {
      b.onclick = function () {
        if (!f) return;
        if (f.question_no) f.question_no.value = b.dataset.answerQ;
        f.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { f.body.focus(); }, 350);
      };
    });
    var fl = ctx.el.querySelector('#ans-filter');
    if (fl) U.$$('[data-fno]', fl).forEach(function (b) {
      b.onclick = function () {
        filterNo = b.dataset.fno;
        U.$$('[data-fno]', fl).forEach(function (x) { x.classList.toggle('on', x === b); });
        U.$$('#answers .answer', ctx.el).forEach(function (el) { el.style.display = (filterNo === 'all' || el.dataset.qno === filterNo) ? '' : 'none'; });
      };
    });
    if (f) {
      var photo = null;
      if (f.querySelector('[data-photo]')) f.querySelector('[data-photo]').onclick = async function () {
        var r = await App.pickAndUpload({ folder: 'answers', max: 1400 });
        if (!r) return; photo = r.url;
        ctx.el.querySelector('#af-preview').innerHTML = '<div class="thumb-x"><img src="' + esc(photo) + '"><button type="button" aria-label="사진 빼기">' + icon('close') + '</button></div>';
        ctx.el.querySelector('#af-preview button').onclick = function () { photo = null; ctx.el.querySelector('#af-preview').innerHTML = ''; };
      };
      f.onsubmit = async function (e) {
        e.preventDefault();
        var body = f.body.value.trim(); if (!body) return U.toast('내용을 입력해 주세요.', 'error');
        var btn = f.querySelector('[type=submit]'); U.busy(btn, true);
        try {
          await App.api.answers.save({ question_id: q.id, question_no: f.question_no && f.question_no.value ? +f.question_no.value : null, body: body, image_url: photo, is_anonymous: f.is_anonymous ? f.is_anonymous.checked : false });
          U.toast('나눔을 올렸어요. 고마워요!');
          App.render();
        } catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(btn, false); }
      };
    }
    bindAnswerActions(ctx, q, answers || []);
  }

  function answerCard(a) {
    var who = a.is_anonymous ? '익명' : a.author_name;
    return '<div class="answer" data-aid="' + a.id + '" data-qno="' + (a.question_no || '') + '">' +
      '<div class="a-head"><span class="a-avatar' + (a.is_anonymous ? ' anon' : '') + '">' + esc(a.is_anonymous ? '?' : (who || '?').slice(0, 1)) + '</span>' +
        '<span class="a-who">' + esc(who) + (a.real_name && a.is_anonymous ? ' <small class="muted">(' + esc(a.real_name) + ')</small>' : '') + (a.mine ? ' <small class="chip">나</small>' : '') + '</span>' +
        '<span class="a-time">' + U.fmtRel(a.created_at) + (a.updated_at && a.updated_at !== a.created_at ? ' · 수정됨' : '') + '</span></div>' +
      (a.question_no ? '<div class="a-q">Q' + a.question_no + '</div>' : '') +
      '<div class="a-body">' + text(a.body) + '</div>' +
      (a.image_url ? '<img class="a-img" src="' + U.attr(a.image_url) + '" alt="" loading="lazy">' : '') +
      '<div class="a-foot">' +
        '<button class="like' + (a.liked ? ' on' : '') + '" data-like="' + a.id + '">' + icon('heart') + '<span>' + (a.like_count || '') + '</span></button>' +
        ((a.mine || App.isAdmin()) ? '<span class="a-tools">' + (a.mine ? '<button data-aedit="' + a.id + '">수정</button>' : '') + '<button data-adel="' + a.id + '">삭제</button></span>' : '') +
      '</div></div>';
  }

  function bindAnswerActions(ctx, q, answers) {
    U.$$('[data-like]', ctx.el).forEach(function (b) {
      b.onclick = async function () {
        try {
          var on = await App.api.answers.toggleLike(+b.dataset.like);
          var n = +(b.querySelector('span').textContent || 0) + (on ? 1 : -1);
          b.classList.toggle('on', on); b.querySelector('span').textContent = n || '';
        } catch (err) { U.toast(U.errMsg(err), 'error'); }
      };
    });
    U.$$('[data-adel]', ctx.el).forEach(function (b) {
      b.onclick = async function () {
        if (!(await U.confirm('이 나눔을 삭제할까요?', '삭제', true))) return;
        try { await App.api.answers.remove(+b.dataset.adel); U.toast('삭제했어요.'); App.render(); }
        catch (err) { U.toast(U.errMsg(err), 'error'); }
      };
    });
    U.$$('[data-aedit]', ctx.el).forEach(function (b) {
      b.onclick = function () {
        var a = answers.filter(function (x) { return x.id === +b.dataset.aedit; })[0]; if (!a) return;
        U.modal({
          title: '나눔 수정',
          html: '<form class="form" id="ae"><textarea name="body" rows="6" maxlength="3000">' + esc(a.body) + '</textarea>' +
            (q.allow_anonymous ? '<label class="check"><input type="checkbox" name="anon"' + (a.is_anonymous ? ' checked' : '') + '><span>익명으로</span></label>' : '') +
            (a.image_url ? '<label class="check"><input type="checkbox" name="keepimg" checked><span>첨부 사진 유지</span></label>' : '') +
            '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">저장</button></div></form>',
          onMount: function (root, close) {
            var f = root.querySelector('#ae');
            f.onsubmit = async function (e) {
              e.preventDefault();
              try {
                await App.api.answers.save({ id: a.id, question_id: q.id, question_no: a.question_no, body: f.body.value.trim(), is_anonymous: f.anon ? f.anon.checked : false, image_url: f.keepimg && f.keepimg.checked ? a.image_url : null });
                close(); U.toast('수정했어요.'); App.render();
              } catch (err) { U.toast(U.errMsg(err), 'error'); }
            };
          }
        });
      };
    });
    U.$$('.a-img', ctx.el).forEach(function (im) { im.onclick = function () { U.lightbox([im.src], 0); }; });
  }

  /* ---------------- 질문 게시판 ---------------- */
  function qnaRow(q) {
    return '<a class="list-row" href="#/q/board/' + q.id + '"><span class="lr-icon">' + icon(q.is_private ? 'lock' : 'question') + '</span>' +
      '<span class="lr-body"><span class="lr-title">' + esc(q.title) + '</span><span class="lr-sub">' + esc(q.author_name || '') + ' · ' + U.fmtRel(q.created_at) + '</span></span>' +
      (q.reply ? '<span class="chip chip-ok">답변완료</span>' : '<span class="chip">답변대기</span>') + '</a>';
  }

  App.route('/q/board', async function (ctx) {
    var list = await App.api.qna.list();
    if (!ctx.alive()) return;
    var head = App.pageHead('나눔', '') + qTabs('board');
    if (list === null) {
      ctx.el.innerHTML = head + '<section class="container narrow"><div class="board-intro"><h2>궁금한 것을 물어보세요</h2><p class="muted">신앙, 말씀, 교회 생활에 대한 질문을 남기면 목사님이 답해 드려요. 비공개로도 올릴 수 있어요.</p></div>' + App.needLogin('질문 게시판은 로그인한 성도만 이용할 수 있어요.') + '</section>';
      return;
    }
    ctx.el.innerHTML = head +
      '<section class="container narrow">' +
        '<div class="board-intro"><div><h2>궁금한 것을 물어보세요</h2><p class="muted">목사님이 답해 드려요. 비공개 글은 본인과 목사님만 볼 수 있어요.</p></div>' +
        (App.isMember() ? '<a class="btn btn-primary" href="#/q/board/new">' + icon('plus') + '질문하기</a>' : '') + '</div>' +
        (App.profile().status === 'pending' ? App.pendingNotice() : '') +
        (list.length ? '<div class="list-card">' + list.map(qnaRow).join('') + '</div>' : '<div class="empty">아직 질문이 없어요. 첫 질문을 남겨 보세요!</div>') +
      '</section>';
  }, { title: '질문 게시판' });

  async function qnaForm(ctx, q) {
    q = q || {};
    var photo = q.image_url || null;
    ctx.el.innerHTML = App.pageHead(q.id ? '질문 수정' : '질문하기') +
      '<section class="container narrow"><form class="card form" id="qf">' +
        '<label class="field"><span>제목</span><input name="title" required maxlength="100" value="' + esc(q.title || '') + '"></label>' +
        '<label class="field"><span>내용</span><textarea name="body" rows="8" required maxlength="5000">' + esc(q.body || '') + '</textarea></label>' +
        '<div class="af-preview" id="qf-preview"></div>' +
        '<div class="row-between">' + (App.isAdmin() ? '<button type="button" class="btn btn-ghost btn-sm" data-photo>' + icon('camera') + '사진 첨부</button>' : '<span></span>') +
        '<label class="check inline"><input type="checkbox" name="is_private"' + (q.is_private ? ' checked' : '') + '><span>' + icon('lock') + '비공개 (목사님만 보기)</span></label></div>' +
        '<div class="row-gap end"><a class="btn btn-ghost" href="#/q/board' + (q.id ? '/' + q.id : '') + '">취소</a><button class="btn btn-primary" type="submit">' + (q.id ? '저장' : '올리기') + '</button></div>' +
      '</form></section>';
    var f = ctx.el.querySelector('#qf'), pv = ctx.el.querySelector('#qf-preview');
    function drawPhoto() {
      pv.innerHTML = photo ? '<div class="thumb-x"><img src="' + esc(photo) + '"><button type="button" aria-label="사진 빼기">' + icon('close') + '</button></div>' : '';
      if (photo) pv.querySelector('button').onclick = function () { photo = null; drawPhoto(); };
    }
    drawPhoto();
    if (f.querySelector('[data-photo]')) f.querySelector('[data-photo]').onclick = async function () { var r = await App.pickAndUpload({ folder: 'qna', max: 1400 }); if (r) { photo = r.url; drawPhoto(); } };
    f.onsubmit = async function (e) {
      e.preventDefault();
      var d = U.formData(f);
      if (!d.title || !d.body) return U.toast('제목과 내용을 입력해 주세요.', 'error');
      var btn = f.querySelector('[type=submit]'); U.busy(btn, true);
      try {
        var saved = await App.api.qna.save({ id: q.id, title: d.title, body: d.body, is_private: d.is_private, image_url: photo });
        U.toast(q.id ? '수정했어요.' : '질문을 올렸어요.');
        App.go('/q/board/' + (saved.id || q.id), true);
      } catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(btn, false); }
    };
  }

  App.route('/q/board/new', async function (ctx) {
    if (!App.isMember()) { ctx.el.innerHTML = '<section class="container narrow">' + App.pendingNotice() + '</section>'; return; }
    await qnaForm(ctx);
  }, { title: '질문하기', auth: true });

  App.route('/q/board/:id/edit', async function (ctx) {
    var q = await App.api.qna.get(ctx.params.id);
    if (!ctx.alive()) return;
    await qnaForm(ctx, q);
  }, { title: '질문 수정', auth: true });

  App.route('/q/board/:id', async function (ctx) {
    if (!App.isLoggedIn()) { ctx.el.innerHTML = '<section class="container narrow">' + App.needLogin() + '</section>'; return; }
    var q = await App.api.qna.get(ctx.params.id);
    if (!ctx.alive()) return;
    ctx.el.innerHTML = qTabs('board') +
      '<article class="container narrow article">' +
        '<a class="back" href="#/q/board">' + icon('chevron-left') + '질문 게시판</a>' +
        '<h1>' + (q.is_private ? icon('lock', 'inline-ic') : '') + esc(q.title) + '</h1>' +
        '<div class="meta">' + esc(q.author_name) + ' · ' + U.fmtDate(q.created_at, true) + '</div>' +
        '<div class="article-body">' + text(q.body) + '</div>' +
        (q.image_url ? '<img class="article-img" src="' + esc(q.image_url) + '" alt="">' : '') +
        (q.mine || App.isAdmin() ? '<div class="row-gap">' + (q.mine && !q.reply ? '<a class="btn btn-sm btn-ghost" href="#/q/board/' + q.id + '/edit">' + icon('edit') + '수정</a>' : '') + '<button class="btn btn-sm btn-ghost" data-del>' + icon('trash') + '삭제</button></div>' : '') +
        '<div class="reply-box' + (q.reply ? '' : ' waiting') + '">' +
          '<div class="rb-head">' + U.markSVG() + '<b>목사님 답변</b>' + (q.replied_at ? '<span class="muted small">' + U.fmtDate(q.replied_at, true) + '</span>' : '') + '</div>' +
          (q.reply ? '<div class="rb-body">' + text(q.reply) + '</div>' : '<div class="rb-body muted">아직 답변을 준비 중이에요. 조금만 기다려 주세요.</div>') +
          (App.isAdmin() ? '<form class="form rb-form" id="rb"><textarea name="reply" rows="5" placeholder="답변을 작성하세요">' + esc(q.reply || '') + '</textarea><div class="row-gap end"><button class="btn btn-primary btn-sm">' + (q.reply ? '답변 수정' : '답변 등록') + '</button></div></form>' : '') +
        '</div>' +
      '</article>';
    var img = ctx.el.querySelector('.article-img'); if (img) img.onclick = function () { U.lightbox([q.image_url], 0); };
    var del = ctx.el.querySelector('[data-del]');
    if (del) del.onclick = async function () {
      if (!(await U.confirm('이 질문을 삭제할까요?', '삭제', true))) return;
      try { await App.api.qna.remove(q.id); U.toast('삭제했어요.'); App.go('/q/board', true); } catch (err) { U.toast(U.errMsg(err), 'error'); }
    };
    var rb = ctx.el.querySelector('#rb');
    if (rb) rb.onsubmit = async function (e) {
      e.preventDefault();
      try { await App.api.qna.reply(q.id, rb.reply.value.trim()); U.toast('답변을 저장했어요.'); App.render(); } catch (err) { U.toast(U.errMsg(err), 'error'); }
    };
  }, { title: '질문 게시판' });

  App.qnaRow = qnaRow;
})();
