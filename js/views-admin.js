/* =====================================================================
 * 관리자 화면 (PC 최적화 + 모바일 대응)
 *  대시보드 · 나눔지 · 질문 게시판 · 소식 · 갤러리 · 예배 문의 · 회원 · 사이트 콘텐츠 · 설정
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon, text = U.text;
  var A = { admin: true };

  function table(headers, rows, opt) {
    opt = opt || {};
    if (!rows.length) return '<div class="empty">' + (opt.empty || '데이터가 없어요.') + '</div>';
    return '<div class="table-wrap"><table class="tbl' + (opt.cls ? ' ' + opt.cls : '') + '"><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr' + (r.attrs ? ' ' + r.attrs : '') + '>' + r.cells.map(function (c, i) { return '<td data-label="' + U.attr(headers[i].replace(/<[^>]+>/g, '')) + '">' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function statusChip(on, yes, no) { return on ? '<span class="chip chip-ok">' + yes + '</span>' : '<span class="chip">' + no + '</span>'; }
  function panel(title, body, tools) { return '<section class="panel"><div class="panel-head"><h2>' + title + '</h2>' + (tools || '') + '</div><div class="panel-body">' + body + '</div></section>'; }
  function toolbar(left, right) { return '<div class="toolbar"><div class="tb-left">' + (left || '') + '</div><div class="tb-right">' + (right || '') + '</div></div>'; }
  function guard(fn) { return async function () { try { await fn.apply(this, arguments); } catch (e) { U.toast(U.errMsg(e), 'error'); } }; }

  /* ---------------- 대시보드 ---------------- */
  App.route('/admin', async function (ctx) {
    var r = await Promise.all([App.api.stats(), App.api.inquiries.list(), App.api.qna.list()]);
    if (!ctx.alive()) return;
    var s = r[0], inq = r[1].slice(0, 5), waiting = (r[2] || []).filter(function (q) { return !q.reply; }).slice(0, 5);
    var cards = [
      ['users', '전체 회원', s.members, '#/admin/members'],
      ['clock', '승인 대기', s.pending, '#/admin/members?status=pending'],
      ['phone', '새 예배 문의', s.inquiriesNew, '#/admin/inquiries'],
      ['mail', '답변 대기 질문', s.qnaWaiting, '#/admin/qna'],
      ['question', '이번 주 나눔', s.currentAnswers, s.currentQuestion ? '#/admin/questions/' + s.currentQuestion.id : '#/admin/questions']
    ];
    ctx.el.innerHTML =
      '<div class="stat-grid">' + cards.map(function (c) {
        return '<a class="stat" href="' + c[3] + '"><span class="stat-ic">' + icon(c[0]) + '</span><span class="stat-label">' + c[1] + '</span><b class="stat-num">' + (c[2] || 0) + '</b></a>';
      }).join('') + '</div>' +
      '<div class="dash-grid">' +
        panel('이번 주 나눔지', s.currentQuestion
          ? '<div class="dash-q"><div class="muted small">' + esc(U.weekLabel(s.currentQuestion.week_of)) + '</div><div class="dash-q-title">' + esc(s.currentQuestion.title) + '</div><div class="muted small">나눔 ' + s.currentAnswers + '개</div></div>'
          : '<div class="empty sm">공개 중인 나눔지가 아직 없어요.</div>',
          '<a class="btn btn-sm btn-primary" href="#/admin/questions/new">' + icon('plus') + '새 나눔지</a>') +
        panel('빠른 작업', '<div class="quick">' +
          '<a href="#/admin/notices/new">' + icon('news') + '소식 쓰기</a>' +
          '<a href="#/admin/gallery">' + icon('image') + '사진 올리기</a>' +
          '<a href="#/admin/content">' + icon('edit') + '홈 문구 수정</a>' +
          '<a href="#/admin/members">' + icon('users') + '회원 관리</a></div>') +
        panel('최근 예배 문의', table(['접수', '이름', '유형', '상태'], inq.map(function (x) {
          return { attrs: 'class="click" data-go="/admin/inquiries"', cells: [U.fmtRel(x.created_at), esc(x.name), esc(x.kind), inqStatus(x.status)] };
        }), { empty: '문의가 없어요.' }), '<a class="more" href="#/admin/inquiries">전체 ' + icon('chevron-right') + '</a>') +
        panel('답변 대기 질문', table(['작성', '제목', '작성자'], waiting.map(function (x) {
          return { attrs: 'class="click" data-go="/admin/qna/' + x.id + '"', cells: [U.fmtRel(x.created_at), (x.is_private ? icon('lock', 'inline-ic') : '') + esc(x.title), esc(x.author_name)] };
        }), { empty: '모두 답변했어요 👍' }), '<a class="more" href="#/admin/qna">전체 ' + icon('chevron-right') + '</a>') +
      '</div>';
    bindRowLinks(ctx.el);
    App.refreshBadges(true);
  }, Object.assign({ title: '대시보드' }, A));

  function bindRowLinks(el) { U.$$('[data-go]', el).forEach(function (tr) { tr.onclick = function (e) { if (e.target.closest('button, a, select, input')) return; App.go(tr.dataset.go); }; }); }
  function inqStatus(s) { return { new: '<span class="chip chip-warn">새 문의</span>', contacted: '<span class="chip">연락함</span>', done: '<span class="chip chip-ok">완료</span>' }[s] || esc(s); }

  /* ---------------- 나눔지 (매주 미리 올리고 예약 공개) ---------------- */
  function tplOf() { return Object.assign({}, window.INTO_DEFAULTS.content.sheet_template, App.content.sheet_template || {}); }
  function releaseLabel(q) {
    if (!q.published) return '<span class="chip">비공개</span>';
    var at = U.releaseAt(q), now = Date.now();
    if (at && at.getTime() > now) return '<span class="chip chip-warn">예약 · ' + esc(U.fmtWhen(at)) + ' 공개</span>';
    return q.week_of === U.sundayOf(new Date()) ? '<span class="chip chip-dark">이번 주 · 공개 중</span>' : '<span class="chip chip-ok">공개</span>';
  }
  function sundayAt(weekOf, hhmm) {
    var d = U.toDate(weekOf), t = (hhmm || '14:00').split(':');
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +t[0] || 0, +t[1] || 0).toISOString();
  }
  function releaseModeOf(q) {
    if (!q.publish_at) return { mode: 'week', time: tplOf().release_time || '14:00' };
    var d = new Date(q.publish_at);
    if (U.ymd(d) === q.week_of) return { mode: 'sunday', time: U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) };
    return { mode: 'custom', time: tplOf().release_time || '14:00' };
  }

  App.route('/admin/questions', async function (ctx) {
    var r = await Promise.all([App.api.questions.list({ all: true }), App.api.answers.counts()]);
    if (!ctx.alive()) return;
    var list = r[0], counts = r[1];
    ctx.el.innerHTML = toolbar('<p class="muted">나눔지를 미리 여러 주 올려 두면, 정한 시간에 자동으로 성도들에게 공개돼요.</p>',
      '<a class="btn btn-ghost" href="#/admin/sheet-template">' + icon('settings') + '기본 서식</a><a class="btn btn-primary" href="#/admin/questions/new">' + icon('plus') + '새 나눔지</a>') +
      panel('나눔지 목록', table(['주일', '나눔지', '공개', '나눔', ''], list.map(function (q) {
        var st = releaseLabel(q) + (q.closed ? ' <span class="chip">마감</span>' : '');
        return { attrs: 'class="click" data-go="/admin/questions/' + q.id + '"', cells: ['<span class="nw">' + U.fmtDate(q.week_of) + '</span>', '<b>' + esc(q.title) + '</b>' + '<div class="muted small">' + [q.scripture, (q.questions || []).length ? '질문 ' + q.questions.length + '개' : '', q.attachment_url ? '원본 첨부' : ''].filter(Boolean).map(esc).join(' · ') + '</div>', st, (counts[q.id] || 0) + '개', '<a class="btn btn-sm btn-ghost" href="#/admin/questions/' + q.id + '">열기</a>'] };
      }), { empty: '아직 나눔지가 없어요. [새 나눔지]를 누르면 기본 서식이 채워진 채로 시작해요.' }));
    bindRowLinks(ctx.el);
  }, Object.assign({ title: '나눔지' }, A));

  // mode: 'new' | 'edit' | 'template'
  async function sheetEditor(ctx, q, mode) {
    var tpl = tplOf();
    var all = mode === 'template' ? [] : await App.api.questions.list({ all: true });
    if (mode === 'new') {
      var sun = U.sundayOf(new Date()), taken = all.map(function (x) { return x.week_of; });
      while (taken.indexOf(sun) >= 0) sun = U.ymd(new Date(U.toDate(sun).getTime() + 7 * 864e5));
      q = { week_of: sun, title: '', sermon_title: '', preacher: tpl.preacher || '', scripture: '', scripture_text: '', body: tpl.summary || '',
        questions: (tpl.questions || []).slice(), application: tpl.application || '', prayer: tpl.prayer || '', image_url: '', attachment_url: '', attachment_name: '',
        published: true, allow_anonymous: tpl.allow_anonymous !== false, closed: false,
        publish_at: tpl.release === 'week' ? null : sundayAt(sun, tpl.release_time) };
    }
    if (mode === 'template') q = { preacher: tpl.preacher, body: tpl.summary, questions: (tpl.questions || []).slice(), application: tpl.application, prayer: tpl.prayer, allow_anonymous: tpl.allow_anonymous !== false };
    var d = JSON.parse(JSON.stringify(q));
    d.questions = (d.questions || []).slice();
    var rel = mode === 'template' ? { mode: tpl.release || 'sunday', time: tpl.release_time || '14:00' } : releaseModeOf(d);
    var answers = mode === 'edit' ? (await App.api.answers.listByQuestion(d.id)) || [] : [];
    if (!ctx.alive()) return;
    var isTpl = mode === 'template';

    function collect() {
      var f = ctx.el.querySelector('#qe'); if (!f) return;
      U.$$('[data-f]', f).forEach(function (el) { d[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
      d.questions = U.$$('[data-qi]', f).map(function (el) { return el.value; });
      var r = f.querySelector('input[name=release]:checked'); if (r) rel.mode = r.value;
      var t = f.querySelector('[name=release_time]'); if (t) rel.time = t.value || '14:00';
      var c = f.querySelector('[name=release_custom]'); if (c) rel.custom = c.value;
    }
    function qRows() {
      return d.questions.map(function (t, i) {
        return '<div class="qrow"><span class="qn">' + (i + 1) + '</span><textarea rows="2" data-qi="' + i + '" placeholder="나눔 질문을 입력하세요">' + esc(t) + '</textarea>' +
          '<div class="li-tools"><button type="button" class="icon-btn" data-qmv="' + i + '|-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">' + icon('chevron-left', 'rot90') + '</button>' +
          '<button type="button" class="icon-btn" data-qmv="' + i + '|1"' + (i === d.questions.length - 1 ? ' disabled' : '') + ' aria-label="아래로">' + icon('chevron-right', 'rot90') + '</button>' +
          '<button type="button" class="icon-btn danger-text" data-qrm="' + i + '" aria-label="삭제">' + icon('trash') + '</button></div></div>';
      }).join('');
    }
    function releaseHTML() {
      var customVal = rel.custom || (d.publish_at ? U.toLocalInput(d.publish_at) : (d.week_of ? d.week_of + 'T' + rel.time : ''));
      return '<div class="field"><span>성도에게 공개되는 시점</span><div class="release">' +
        '<label><input type="radio" name="release" value="week"' + (rel.mode === 'week' ? ' checked' : '') + '><span>' + (isTpl ? '그 주 월요일부터' : '그 주 월요일 0시부터 <small>(' + esc(U.fmtWhen(U.releaseAt({ week_of: d.week_of }))) + ')</small>') + '</span></label>' +
        '<label><input type="radio" name="release" value="sunday"' + (rel.mode === 'sunday' ? ' checked' : '') + '><span>주일 <input type="time" name="release_time" value="' + esc(rel.time) + '"> 부터 <small>(예배 시간에 맞춰 공개)</small></span></label>' +
        (isTpl ? '' : '<label><input type="radio" name="release" value="custom"' + (rel.mode === 'custom' ? ' checked' : '') + '><span>직접 지정 <input type="datetime-local" name="release_custom" value="' + esc(customVal) + '"></span></label>') +
        '</div></div>';
    }
    function draw() {
      var main =
        '<form class="form" id="qe">' +
          (isTpl ? '<div class="callout small">[새 나눔지]를 누를 때 이 내용이 자동으로 채워져요. 매주 바뀌는 날짜·제목·본문은 나눔지마다 입력해요.</div>' :
            '<div class="tpl-bar"><button type="button" class="btn btn-sm btn-ghost" data-load-tpl>' + icon('refresh') + '기본 서식 불러오기</button>' +
            (all.filter(function (x) { return x.id !== d.id; }).length ? '<button type="button" class="btn btn-sm btn-ghost" data-copy-last>' + icon('book') + '지난 나눔지 복사</button>' : '') +
            '<button type="button" class="btn btn-sm btn-ghost" data-save-tpl>' + icon('check') + '이 내용을 기본 서식으로</button></div>' +
            '<div class="grid2"><label class="field"><span>주일 날짜</span><input type="date" data-f="week_of" value="' + esc(d.week_of) + '" required></label>' +
            '<label class="field"><span>설교자</span><input data-f="preacher" value="' + esc(d.preacher || '') + '" placeholder="김윤호 목사"></label></div>') +
          (isTpl ? '<label class="field"><span>설교자 (기본값)</span><input data-f="preacher" value="' + esc(d.preacher || '') + '"></label>' : '') +
          releaseHTML() +
          (isTpl ? '' :
            '<label class="field"><span>제목 (설교 제목) <em>*</em></span><input data-f="title" value="' + esc(d.title || '') + '" maxlength="120" required placeholder="예) 더 낮은 곳으로"></label>' +
            '<div class="grid2"><label class="field"><span>본문 말씀</span><input data-f="scripture" value="' + esc(d.scripture || '') + '" maxlength="80" placeholder="예) 빌립보서 2:6-8"></label><span></span></div>' +
            '<label class="field"><span>본문 내용 <small class="muted">(성경 구절을 붙여 넣으세요)</small></span><textarea rows="4" data-f="scripture_text">' + esc(d.scripture_text || '') + '</textarea></label>') +
          '<label class="field"><span>말씀 요약' + (isTpl ? ' (기본 문구, 보통 비워 둠)' : '') + '</span><textarea rows="4" data-f="body" placeholder="' + esc(tpl.summary_hint || '') + '">' + esc(d.body || '') + '</textarea></label>' +
          '<div class="field"><span>나눔 질문</span><div id="qrows">' + qRows() + '</div><button type="button" class="btn btn-sm btn-ghost" data-qadd>' + icon('plus') + '질문 추가</button></div>' +
          '<label class="field"><span>적용 · 결단</span><textarea rows="2" data-f="application">' + esc(d.application || '') + '</textarea></label>' +
          '<label class="field"><span>함께 기도</span><textarea rows="2" data-f="prayer">' + esc(d.prayer || '') + '</textarea></label>' +
          (isTpl ? '' :
            '<div class="grid2"><div class="field"><span>대표 이미지</span><div class="img-field" id="qe-img"></div></div>' +
            '<div class="field"><span>나눔지 원본 파일 <small class="muted">(PDF·이미지)</small></span><div class="file-field" id="qe-file"></div></div></div>') +
          '<div class="toggles">' +
            (isTpl ? '' : '<label class="switch"><input type="checkbox" data-f="published"' + (d.published ? ' checked' : '') + '><i></i><span>공개</span></label>') +
            '<label class="switch"><input type="checkbox" data-f="allow_anonymous"' + (d.allow_anonymous ? ' checked' : '') + '><i></i><span>익명 나눔 허용</span></label>' +
            (isTpl ? '' : '<label class="switch"><input type="checkbox" data-f="closed"' + (d.closed ? ' checked' : '') + '><i></i><span>나눔 마감</span></label>') +
          '</div>' +
          '<div class="row-gap end">' +
            (isTpl ? '<button type="button" class="btn btn-ghost" data-tpl-reset>처음 기본값으로</button>' :
              (mode === 'edit' ? '<button type="button" class="btn btn-ghost danger-text" data-del>' + icon('trash') + '삭제</button><a class="btn btn-ghost" href="#/q/week/' + d.id + '" target="_blank">' + icon('external') + '앱에서 보기</a>' : '')) +
            '<button class="btn btn-primary" type="submit">' + (isTpl ? '기본 서식 저장' : mode === 'new' ? '나눔지 등록' : '저장') + '</button>' +
          '</div>' +
        '</form>';
      var side = isTpl ? panel('기본 서식이란?', '<ul class="tips"><li>새 나눔지를 만들 때 질문·적용·기도 문구가 자동으로 채워져요.</li><li>나눔지 편집 화면의 <b>"이 내용을 기본 서식으로"</b>로도 저장할 수 있어요.</li><li>공개 시점 기본값도 여기서 정해요. (예: 주일 오후 2시 예배 시간)</li></ul>')
        : mode === 'new' ? panel('미리 올리기 안내', '<ul class="tips"><li>다음 주, 다다음 주 나눔지도 미리 등록해 두면 <b>정한 시간에 자동 공개</b>돼요.</li><li>공개 전에는 성도에게 보이지 않고, 관리자 목록에 "예약"으로 표시돼요.</li><li>주보용 나눔지 PDF가 있으면 <b>원본 파일</b>로 첨부해 두세요. 성도가 받아 볼 수 있어요.</li></ul>')
        : panel('나눔 ' + answers.length + '개', answers.length ? '<div class="answers admin-answers">' + answers.map(function (a) {
            return '<div class="answer"><div class="a-head"><span class="a-who">' + esc(a.is_anonymous ? '익명' : a.author_name) + (a.is_anonymous ? ' <small class="muted">(' + esc(a.real_name || '') + ')</small>' : '') + '</span><span class="a-time">' + U.fmtDate(a.created_at, true) + ' · ♥ ' + (a.like_count || 0) + '</span></div>' + (a.question_no ? '<div class="a-q">Q' + a.question_no + '</div>' : '') + '<div class="a-body">' + text(a.body) + '</div>' + (a.image_url ? '<img class="a-img" src="' + U.attr(a.image_url) + '" alt="">' : '') + '<div class="a-foot"><span class="a-tools"><button data-adel="' + a.id + '">삭제</button></span></div></div>';
          }).join('') + '</div>' : '<div class="empty sm">아직 나눔이 없어요.</div>', answers.length ? '<button class="btn btn-sm btn-ghost" data-csv>' + icon('download') + 'CSV</button>' : '');
      ctx.el.innerHTML = '<a class="back" href="#/admin/questions">' + icon('chevron-left') + '나눔지 목록</a>' +
        '<div class="two-col">' + panel(isTpl ? '나눔지 기본 서식' : mode === 'new' ? '새 나눔지' : '나눔지 수정', main) + side + '</div>';
      bind();
    }
    function fileField() {
      var el = ctx.el.querySelector('#qe-file'); if (!el) return;
      el.innerHTML = d.attachment_url
        ? '<a class="sheet-file small" href="' + esc(d.attachment_url) + '" target="_blank" rel="noopener">' + icon('download') + '<span><b>' + esc(d.attachment_name || '첨부 파일') + '</b><small>열어 보기</small></span></a><div class="img-btns"><button type="button" class="btn btn-sm btn-ghost" data-file-up>변경</button><button type="button" class="btn btn-sm btn-ghost danger-text" data-file-rm>빼기</button></div>'
        : '<div class="img-btns"><button type="button" class="btn btn-sm btn-ghost" data-file-up>' + icon('plus') + '파일 첨부</button></div>';
      el.querySelector('[data-file-up]').onclick = async function () { var b = this; U.busy(b, true); var r = await App.pickFile({ folder: 'sheets' }); U.busy(b, false); if (r) { d.attachment_url = r.url; d.attachment_name = r.name; fileField(); } };
      var rm = el.querySelector('[data-file-rm]'); if (rm) rm.onclick = function () { d.attachment_url = ''; d.attachment_name = ''; fileField(); };
    }
    function bind() {
      var f = ctx.el.querySelector('#qe');
      var imgEl = ctx.el.querySelector('#qe-img');
      if (imgEl) (function drawImg() { imageField(imgEl, d.image_url || '', function (v) { d.image_url = v; drawImg(); }, 'questions'); })();
      fileField();
      f.querySelector('[data-qadd]').onclick = function () { collect(); d.questions.push(''); draw(); var t = U.$$('[data-qi]', ctx.el).pop(); if (t) t.focus(); };
      U.$$('[data-qrm]', f).forEach(function (b) { b.onclick = function () { collect(); d.questions.splice(+b.dataset.qrm, 1); draw(); }; });
      U.$$('[data-qmv]', f).forEach(function (b) { b.onclick = function () { collect(); var p = b.dataset.qmv.split('|'), i = +p[0], j = i + (+p[1]); var t = d.questions[i]; d.questions[i] = d.questions[j]; d.questions[j] = t; draw(); }; });
      var x;
      if ((x = f.querySelector('[data-load-tpl]'))) x.onclick = async function () {
        if (!(await U.confirm('질문·요약·적용·기도를 기본 서식으로 바꿀까요?\n(날짜·제목·본문은 그대로 둡니다)'))) return;
        collect(); var t = tplOf();
        d.questions = (t.questions || []).slice(); d.body = t.summary || ''; d.application = t.application || ''; d.prayer = t.prayer || ''; d.preacher = d.preacher || t.preacher || '';
        rel.mode = t.release || rel.mode; rel.time = t.release_time || rel.time; draw();
      };
      if ((x = f.querySelector('[data-copy-last]'))) x.onclick = async function () {
        var prev = all.filter(function (y) { return y.id !== d.id; })[0]; if (!prev) return;
        if (!(await U.confirm('"' + prev.title + '" (' + U.fmtDate(prev.week_of) + ')의 질문·적용·기도를 가져올까요?'))) return;
        collect(); d.questions = (prev.questions || []).slice(); d.application = prev.application || ''; d.prayer = prev.prayer || ''; d.preacher = d.preacher || prev.preacher || ''; draw();
      };
      if ((x = f.querySelector('[data-save-tpl]'))) x.onclick = guard(async function () {
        collect();
        if (!(await U.confirm('지금 질문·적용·기도·공개 시점을 앞으로 쓸 기본 서식으로 저장할까요?'))) return;
        await saveTemplate({ preacher: d.preacher, summary: '', questions: d.questions.filter(function (t) { return t.trim(); }), application: d.application, prayer: d.prayer, allow_anonymous: !!d.allow_anonymous, release: rel.mode === 'custom' ? 'sunday' : rel.mode, release_time: rel.time });
        U.toast('기본 서식으로 저장했어요.');
      });
      if ((x = f.querySelector('[data-tpl-reset]'))) x.onclick = async function () {
        if (!(await U.confirm('기본 서식을 처음 기본값으로 되돌릴까요? (저장을 눌러야 반영)'))) return;
        var t = window.INTO_DEFAULTS.content.sheet_template;
        d = { preacher: t.preacher, body: t.summary, questions: t.questions.slice(), application: t.application, prayer: t.prayer, allow_anonymous: t.allow_anonymous };
        rel = { mode: t.release, time: t.release_time }; draw();
      };
      if ((x = f.querySelector('[data-del]'))) x.onclick = guard(async function () {
        if (!(await U.confirm('이 나눔지와 모든 나눔(' + answers.length + '개)을 삭제할까요?', '삭제', true))) return;
        await App.api.questions.remove(d.id); U.toast('삭제했어요.'); App.go('/admin/questions', true);
      });
      f.onsubmit = guard(async function (e) {
        e.preventDefault(); collect();
        var qsClean = d.questions.map(function (t) { return t.trim(); }).filter(Boolean);
        if (isTpl) {
          await saveTemplate({ preacher: d.preacher, summary: d.body, questions: qsClean, application: d.application, prayer: d.prayer, allow_anonymous: !!d.allow_anonymous, release: rel.mode, release_time: rel.time });
          U.toast('기본 서식을 저장했어요.'); App.go('/admin/questions', true); return;
        }
        if (!(d.title || '').trim()) return U.toast('제목(설교 제목)을 입력해 주세요.', 'error');
        if (!d.week_of) return U.toast('주일 날짜를 입력해 주세요.', 'error');
        var publish_at = rel.mode === 'week' ? null : rel.mode === 'sunday' ? sundayAt(d.week_of, rel.time) : U.fromLocalInput(rel.custom);
        if (rel.mode === 'custom' && !publish_at) return U.toast('공개 시각을 입력해 주세요.', 'error');
        var saved = await App.api.questions.save({
          id: d.id, week_of: d.week_of, title: d.title.trim(), sermon_title: d.title.trim(), preacher: d.preacher, scripture: d.scripture, scripture_text: d.scripture_text,
          body: d.body, questions: qsClean, application: d.application, prayer: d.prayer, image_url: d.image_url || '', attachment_url: d.attachment_url || '', attachment_name: d.attachment_name || '',
          publish_at: publish_at, published: !!d.published, allow_anonymous: !!d.allow_anonymous, closed: !!d.closed
        });
        var at = U.releaseAt(saved);
        U.toast(saved.published && at && at.getTime() > Date.now() ? '저장했어요. ' + U.fmtWhen(at) + '에 자동 공개돼요.' : '저장했어요.');
        App.go('/admin/questions/' + saved.id, true);
      });
      U.$$('[data-adel]', ctx.el).forEach(function (b) {
        b.onclick = guard(async function () {
          if (!(await U.confirm('이 나눔을 삭제할까요?', '삭제', true))) return;
          await App.api.answers.remove(+b.dataset.adel); U.toast('삭제했어요.'); App.render();
        });
      });
      U.$$('.a-img', ctx.el).forEach(function (im) { im.onclick = function () { U.lightbox([im.src], 0); }; });
      var csv = ctx.el.querySelector('[data-csv]');
      if (csv) csv.onclick = function () {
        U.downloadCSV('나눔_' + d.week_of + '.csv', ['작성일시', '질문', '표시이름', '실명', '익명', '공감', '내용'],
          answers.map(function (a) { return [U.fmtDate(a.created_at, true), a.question_no ? 'Q' + a.question_no + '. ' + ((d.questions || [])[a.question_no - 1] || '') : '전체', a.is_anonymous ? '익명' : a.author_name, a.real_name || a.author_name, a.is_anonymous ? 'Y' : '', a.like_count || 0, a.body]; }));
      };
    }
    async function saveTemplate(v) {
      var merged = Object.assign({}, tplOf(), v);
      await App.api.content.set('sheet_template', merged);
      App.content = await App.api.content.getAll();
    }
    draw();
  }

  App.route('/admin/questions/new', async function (ctx) { await sheetEditor(ctx, null, 'new'); }, Object.assign({ title: '새 나눔지' }, A));
  App.route('/admin/sheet-template', async function (ctx) { await sheetEditor(ctx, null, 'template'); }, Object.assign({ title: '나눔지 기본 서식' }, A));
  App.route('/admin/questions/:id', async function (ctx) {
    var q = await App.api.questions.get(ctx.params.id); if (!ctx.alive()) return;
    await sheetEditor(ctx, q, 'edit');
  }, Object.assign({ title: '나눔지 수정' }, A));

  /* 이미지 입력 필드 (미리보기 + 업로드 + URL 직접 입력) */
  function imageField(el, url, onChange, folder) {
    el.innerHTML = (url ? '<div class="img-prev"><img src="' + esc(url) + '" alt=""></div>' : '<div class="img-prev empty-img">' + icon('image') + '</div>') +
      '<div class="img-btns"><button type="button" class="btn btn-sm btn-ghost" data-up>' + icon('camera') + (url ? '변경' : '업로드') + '</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-url>URL</button>' +
      (url ? '<button type="button" class="btn btn-sm btn-ghost danger-text" data-rm>빼기</button>' : '') + '</div>';
    el.querySelector('[data-up]').onclick = async function () {
      var b = this; U.busy(b, true);
      var r = await App.pickAndUpload({ folder: folder || 'misc' });
      U.busy(b, false); if (r) onChange(r.url);
    };
    el.querySelector('[data-url]').onclick = function () {
      U.modal({
        title: '이미지 주소 입력',
        html: '<form class="form" id="uf"><label class="field"><span>이미지 URL 또는 앱 내부 경로</span><input name="u" value="' + esc(url || '') + '" placeholder="https://... 또는 assets/photos/..."></label><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">적용</button></div></form>',
        onMount: function (root, close) { var f = root.querySelector('#uf'); f.onsubmit = function (e) { e.preventDefault(); close(); onChange(f.u.value.trim()); }; }
      });
    };
    var rm = el.querySelector('[data-rm]'); if (rm) rm.onclick = function () { onChange(''); };
  }
  App.imageField = imageField;

  /* ---------------- 질문 게시판 관리 ---------------- */
  App.route('/admin/qna', async function (ctx) {
    var list = (await App.api.qna.list()) || [];
    if (!ctx.alive()) return;
    var filter = ctx.query.f || 'waiting';
    function draw() {
      var shown = list.filter(function (q) { return filter === 'all' || (filter === 'waiting' ? !q.reply : !!q.reply); });
      ctx.el.innerHTML = toolbar(
        '<div class="chips">' + [['waiting', '답변 대기'], ['done', '답변 완료'], ['all', '전체']].map(function (x) {
          return '<button class="chip-btn' + (filter === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + ' <small>' + list.filter(function (q) { return x[0] === 'all' || (x[0] === 'waiting' ? !q.reply : !!q.reply); }).length + '</small></button>';
        }).join('') + '</div>',
        '<button class="btn btn-ghost btn-sm" data-csv>' + icon('download') + 'CSV</button>') +
        panel('질문 게시판', table(['작성일', '제목', '작성자', '공개', '상태'], shown.map(function (q) {
          return { attrs: 'class="click" data-go="/admin/qna/' + q.id + '"', cells: ['<span class="nw">' + U.fmtDate(q.created_at) + '</span>', '<b>' + esc(q.title) + '</b><div class="muted small clamp1">' + esc(q.body) + '</div>', esc(q.author_name), q.is_private ? icon('lock', 'inline-ic') + '비공개' : '공개', statusChip(!!q.reply, '답변완료', '답변대기')] };
        }), { empty: '해당하는 질문이 없어요.' }));
      U.$$('[data-f]', ctx.el).forEach(function (b) { b.onclick = function () { filter = b.dataset.f; draw(); }; });
      ctx.el.querySelector('[data-csv]').onclick = function () {
        U.downloadCSV('질문게시판.csv', ['작성일', '작성자', '공개', '제목', '내용', '답변', '답변일'], list.map(function (q) { return [U.fmtDate(q.created_at, true), q.author_name, q.is_private ? '비공개' : '공개', q.title, q.body, q.reply || '', q.replied_at ? U.fmtDate(q.replied_at, true) : '']; }));
      };
      bindRowLinks(ctx.el);
    }
    draw();
  }, Object.assign({ title: '질문 게시판' }, A));

  App.route('/admin/qna/:id', async function (ctx) {
    var q = await App.api.qna.get(ctx.params.id);
    if (!ctx.alive()) return;
    ctx.el.innerHTML = '<a class="back" href="#/admin/qna">' + icon('chevron-left') + '질문 목록</a>' +
      '<div class="two-col">' +
        panel((q.is_private ? icon('lock', 'inline-ic') : '') + esc(q.title),
          '<div class="meta">' + esc(q.author_name) + ' · ' + U.fmtDate(q.created_at, true) + ' · ' + (q.is_private ? '비공개' : '공개') + '</div>' +
          '<div class="article-body">' + text(q.body) + '</div>' + (q.image_url ? '<img class="article-img" src="' + esc(q.image_url) + '" alt="">' : ''),
          '<button class="btn btn-sm btn-ghost danger-text" data-del>' + icon('trash') + '삭제</button>') +
        panel('답변', '<form class="form" id="rp"><textarea name="reply" rows="10" placeholder="성도에게 보일 답변을 작성하세요.">' + esc(q.reply || '') + '</textarea>' +
          (q.replied_at ? '<div class="muted small">마지막 답변: ' + U.fmtDate(q.replied_at, true) + '</div>' : '') +
          '<div class="row-gap end">' + (q.reply ? '<button type="button" class="btn btn-ghost" data-clear>답변 삭제</button>' : '') + '<button class="btn btn-primary">' + (q.reply ? '답변 수정' : '답변 등록') + '</button></div></form>') +
      '</div>';
    var f = ctx.el.querySelector('#rp');
    f.onsubmit = guard(async function (e) { e.preventDefault(); await App.api.qna.reply(q.id, f.reply.value.trim()); U.toast('답변을 저장했어요.'); App.refreshBadges(true); App.render(); });
    var cl = ctx.el.querySelector('[data-clear]'); if (cl) cl.onclick = guard(async function () { if (!(await U.confirm('답변을 삭제할까요?'))) return; await App.api.qna.reply(q.id, ''); App.render(); });
    ctx.el.querySelector('[data-del]').onclick = guard(async function () { if (!(await U.confirm('이 질문을 삭제할까요?', '삭제', true))) return; await App.api.qna.remove(q.id); App.go('/admin/qna', true); });
    var im = ctx.el.querySelector('.article-img'); if (im) im.onclick = function () { U.lightbox([q.image_url], 0); };
  }, Object.assign({ title: '질문 답변' }, A));

  /* ---------------- 교회 소식 ---------------- */
  App.route('/admin/notices', async function (ctx) {
    var list = await App.api.notices.list({ all: true });
    if (!ctx.alive()) return;
    ctx.el.innerHTML = toolbar('', '<a class="btn btn-primary" href="#/admin/notices/new">' + icon('plus') + '새 소식</a>') +
      panel('교회 소식', table(['작성일', '제목', '상태', ''], list.map(function (n) {
        return { attrs: 'class="click" data-go="/admin/notices/' + n.id + '"', cells: ['<span class="nw">' + U.fmtDate(n.created_at) + '</span>', (n.pinned ? '<span class="chip">고정</span> ' : '') + '<b>' + esc(n.title) + '</b>', statusChip(n.published, '공개', '비공개'), '<a class="btn btn-sm btn-ghost" href="#/admin/notices/' + n.id + '">수정</a>'] };
      }), { empty: '등록된 소식이 없어요.' }));
    bindRowLinks(ctx.el);
  }, Object.assign({ title: '교회 소식' }, A));

  async function noticeEditor(ctx, n) {
    var isNew = !n; n = n || { title: '', body: '', image_url: '', link_url: '', pinned: false, published: true };
    var img = n.image_url || '';
    ctx.el.innerHTML = '<a class="back" href="#/admin/notices">' + icon('chevron-left') + '소식 목록</a>' +
      panel(isNew ? '새 소식' : '소식 수정',
        '<form class="form" id="ne">' +
          '<label class="field"><span>제목 <em>*</em></span><input name="title" required maxlength="120" value="' + esc(n.title) + '"></label>' +
          '<label class="field"><span>내용</span><textarea name="body" rows="10" maxlength="10000">' + esc(n.body) + '</textarea></label>' +
          '<div class="field"><span>대표 이미지</span><div class="img-field" id="ne-img"></div></div>' +
          '<label class="field"><span>관련 링크 (선택)</span><input name="link_url" type="url" value="' + esc(n.link_url || '') + '" placeholder="https://"></label>' +
          '<div class="toggles"><label class="switch"><input type="checkbox" name="published"' + (n.published ? ' checked' : '') + '><i></i><span>공개</span></label>' +
          '<label class="switch"><input type="checkbox" name="pinned"' + (n.pinned ? ' checked' : '') + '><i></i><span>맨 위 고정</span></label></div>' +
          '<div class="row-gap end">' + (isNew ? '' : '<button type="button" class="btn btn-ghost danger-text" data-del>' + icon('trash') + '삭제</button>') + '<button class="btn btn-primary">' + (isNew ? '등록' : '저장') + '</button></div>' +
        '</form>');
    function drawImg() { imageField(ctx.el.querySelector('#ne-img'), img, function (v) { img = v; drawImg(); }, 'notices'); }
    drawImg();
    var f = ctx.el.querySelector('#ne');
    f.onsubmit = guard(async function (e) {
      e.preventDefault(); var d = U.formData(f);
      if (!d.title) return U.toast('제목을 입력해 주세요.', 'error');
      await App.api.notices.save({ id: n.id, title: d.title, body: d.body, link_url: d.link_url, image_url: img, published: d.published, pinned: d.pinned });
      U.toast('저장했어요.'); App.go('/admin/notices', true);
    });
    var del = ctx.el.querySelector('[data-del]');
    if (del) del.onclick = guard(async function () { if (!(await U.confirm('이 소식을 삭제할까요?', '삭제', true))) return; await App.api.notices.remove(n.id); App.go('/admin/notices', true); });
  }
  App.route('/admin/notices/new', async function (ctx) { await noticeEditor(ctx, null); }, Object.assign({ title: '새 소식' }, A));
  App.route('/admin/notices/:id', async function (ctx) { var n = await App.api.notices.get(ctx.params.id); if (!ctx.alive()) return; await noticeEditor(ctx, n); }, Object.assign({ title: '소식 수정' }, A));

  /* ---------------- 갤러리 ---------------- */
  App.route('/admin/gallery', async function (ctx) {
    var list = await App.api.photos.list();
    if (!ctx.alive()) return;
    var tags = []; list.forEach(function (p) { if (p.tag && tags.indexOf(p.tag) < 0) tags.push(p.tag); });
    ctx.el.innerHTML = toolbar('<p class="muted">사진은 업로드 전에 자동으로 줄여서(최대 1600px) 저장돼요. 여러 장을 한 번에 고를 수 있어요.</p>',
      '<button class="btn btn-primary" data-up>' + icon('plus') + '사진 올리기</button>') +
      '<datalist id="taglist">' + tags.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      panel('사진 ' + list.length + '장', list.length ? '<div class="admin-photos">' + list.map(function (p) {
        return '<div class="ap" data-id="' + p.id + '"><button class="ap-img" data-view><img src="' + esc(p.thumb_url || p.url) + '" alt="" loading="lazy"></button>' +
          '<input class="ap-cap" placeholder="설명" value="' + esc(p.caption || '') + '" data-k="caption">' +
          '<div class="ap-row"><input class="ap-tag" list="taglist" placeholder="태그" value="' + esc(p.tag || '') + '" data-k="tag"><button class="icon-btn danger-text" data-del aria-label="삭제">' + icon('trash') + '</button></div></div>';
      }).join('') + '</div>' : '<div class="empty">사진이 없어요.</div>');
    ctx.el.querySelector('[data-up]').onclick = guard(async function () {
      var b = this; var tag = '';
      var rs = await App.pickAndUpload({ multiple: true, folder: 'gallery', thumb: true, onProgress: function (i, n) { b.innerHTML = '<span class="spinner"></span> ' + i + '/' + n; b.disabled = true; } });
      if (rs && rs.length) {
        tag = ''; for (var i = 0; i < rs.length; i++) await App.api.photos.add({ url: rs[i].url, thumb_url: rs[i].thumb_url, caption: '', tag: tag });
        U.toast(rs.length + '장을 올렸어요.');
      }
      App.render();
    });
    U.$$('.ap', ctx.el).forEach(function (card) {
      var id = card.dataset.id;
      U.$$('[data-k]', card).forEach(function (inp) {
        inp.onchange = guard(async function () { var o = {}; o[inp.dataset.k] = inp.value.trim(); await App.api.photos.update(id, o); U.toast('저장했어요.'); });
      });
      card.querySelector('[data-del]').onclick = guard(async function () {
        if (!(await U.confirm('이 사진을 삭제할까요?', '삭제', true))) return;
        await App.api.photos.remove(id); card.remove(); U.toast('삭제했어요.');
      });
      card.querySelector('[data-view]').onclick = function () { var p = list.filter(function (x) { return String(x.id) === id; })[0]; U.lightbox([p.url], 0); };
    });
  }, Object.assign({ title: '갤러리' }, A));

  /* ---------------- 예배 문의 ---------------- */
  App.route('/admin/inquiries', async function (ctx) {
    var list = await App.api.inquiries.list();
    if (!ctx.alive()) return;
    var filter = 'all';
    function draw() {
      var shown = list.filter(function (r) { return filter === 'all' || r.status === filter; });
      ctx.el.innerHTML = toolbar(
        '<div class="chips">' + [['all', '전체'], ['new', '새 문의'], ['contacted', '연락함'], ['done', '완료']].map(function (x) {
          return '<button class="chip-btn' + (filter === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + ' <small>' + list.filter(function (r) { return x[0] === 'all' || r.status === x[0]; }).length + '</small></button>';
        }).join('') + '</div>',
        '<button class="btn btn-ghost btn-sm" data-csv>' + icon('download') + '엑셀(CSV)</button>') +
        panel('예배 문의 · 새가족 신청', table(['접수일', '유형', '이름', '연락처', '희망 주일', '내용', '상태', ''], shown.map(function (r) {
          return { cells: ['<span class="nw">' + U.fmtDate(r.created_at, true) + '</span>', '<span class="nw">' + esc(r.kind) + '</span>', '<b class="nw">' + esc(r.name) + '</b>', (r.phone ? '<a class="nw" href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a>' : '') + (r.email ? '<div class="small"><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></div>' : ''), r.preferred_date ? '<span class="nw">' + U.fmtDate(r.preferred_date) + '</span>' : '-',
            '<div class="clamp2">' + esc(r.message) + '</div>' + (r.admin_memo ? '<div class="memo">' + icon('edit', 'inline-ic') + esc(r.admin_memo) + '</div>' : ''),
            '<select data-status="' + r.id + '">' + [['new', '새 문의'], ['contacted', '연락함'], ['done', '완료']].map(function (s) { return '<option value="' + s[0] + '"' + (r.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>',
            '<div class="row-tools"><button class="btn btn-sm btn-ghost" data-open="' + r.id + '">보기</button><button class="icon-btn danger-text" data-del="' + r.id + '" aria-label="삭제">' + icon('trash') + '</button></div>'] };
        }), { empty: '문의가 없어요.' }));
      U.$$('[data-f]', ctx.el).forEach(function (b) { b.onclick = function () { filter = b.dataset.f; draw(); }; });
      U.$$('[data-status]', ctx.el).forEach(function (s) {
        s.onchange = guard(async function () { var id = s.dataset.status; await App.api.inquiries.update(id, { status: s.value }); find(id).status = s.value; U.toast('상태를 바꿨어요.'); App.refreshBadges(true); });
      });
      U.$$('[data-del]', ctx.el).forEach(function (b) {
        b.onclick = guard(async function () { if (!(await U.confirm('이 문의를 삭제할까요? (개인정보 파기)', '삭제', true))) return; await App.api.inquiries.remove(b.dataset.del); list = list.filter(function (r) { return String(r.id) !== b.dataset.del; }); draw(); App.refreshBadges(true); });
      });
      U.$$('[data-open]', ctx.el).forEach(function (b) { b.onclick = function () { openInquiry(find(b.dataset.open)); }; });
      ctx.el.querySelector('[data-csv]').onclick = function () {
        U.downloadCSV('예배문의_' + U.ymd(new Date()) + '.csv', ['접수일시', '유형', '이름', '연락처', '이메일', '희망 주일', '내용', '상태', '메모'],
          shown.map(function (r) { return [U.fmtDate(r.created_at, true), r.kind, r.name, r.phone, r.email, r.preferred_date || '', r.message, { new: '새 문의', contacted: '연락함', done: '완료' }[r.status], r.admin_memo || '']; }));
      };
    }
    function find(id) { return list.filter(function (r) { return String(r.id) === String(id); })[0]; }
    function openInquiry(r) {
      U.modal({
        title: r.name + ' 님의 문의',
        html: '<dl class="dl"><dt>유형</dt><dd>' + esc(r.kind) + '</dd><dt>연락처</dt><dd>' + esc(r.phone || '-') + '</dd><dt>이메일</dt><dd>' + esc(r.email || '-') + '</dd><dt>희망 주일</dt><dd>' + esc(r.preferred_date || '-') + '</dd><dt>접수</dt><dd>' + U.fmtDate(r.created_at, true) + '</dd></dl>' +
          '<div class="msg-box">' + text(r.message || '(내용 없음)') + '</div>' +
          '<form class="form" id="memo"><label class="field"><span>관리자 메모 (성도에게 보이지 않아요)</span><textarea name="memo" rows="3">' + esc(r.admin_memo || '') + '</textarea></label><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>닫기</button><button class="btn btn-primary">메모 저장</button></div></form>',
        onMount: function (root, close) {
          var f = root.querySelector('#memo');
          f.onsubmit = guard(async function (e) { e.preventDefault(); await App.api.inquiries.update(r.id, { admin_memo: f.memo.value.trim() }); r.admin_memo = f.memo.value.trim(); close(); draw(); U.toast('메모를 저장했어요.'); });
        }
      });
    }
    draw();
  }, Object.assign({ title: '예배 문의' }, A));

  /* ---------------- 회원 관리 ---------------- */
  App.route('/admin/members', async function (ctx) {
    var list = await App.api.profiles.list();
    if (!ctx.alive()) return;
    var q = '', st = ctx.query.status || 'all', teamOnly = ctx.query.team === 'worship';
    var meId = App.profile().id;
    var ST = [['active', '정상'], ['pending', '승인 대기'], ['blocked', '이용 제한'], ['withdrawn', '탈퇴']];
    ctx.el.innerHTML = toolbar(
      '<input class="search" type="search" placeholder="이름·이메일·연락처 검색" id="msearch"><div class="chips" id="mchips"></div>',
      '<button class="btn btn-ghost btn-sm" data-csv>' + icon('download') + '엑셀(CSV)</button>') +
      '<div id="mtable"></div>';
    function draw() {
      var shown = list.filter(function (m) {
        var hay = (m.name + ' ' + m.email + ' ' + (m.phone || '')).toLowerCase();
        return (st === 'all' ? m.status !== 'withdrawn' : m.status === st) && (!q || hay.indexOf(q) >= 0) && (!teamOnly || (m.teams || []).indexOf('worship') >= 0);
      });
      ctx.el.querySelector('#mchips').innerHTML = [['all', '전체']].concat(ST).map(function (x) {
        var n = list.filter(function (m) { return x[0] === 'all' ? m.status !== 'withdrawn' : m.status === x[0]; }).length;
        return '<button class="chip-btn' + (st === x[0] ? ' on' : '') + '" data-st="' + x[0] + '">' + x[1] + ' <small>' + n + '</small></button>';
      }).join('') + '<button class="chip-btn' + (teamOnly ? ' on' : '') + '" data-teamonly>' + icon('music', 'inline-ic') + '찬양팀 <small>' + list.filter(function (m) { return (m.teams || []).indexOf('worship') >= 0; }).length + '</small></button>';
      ctx.el.querySelector('#mtable').innerHTML = panel('회원 ' + shown.length + '명', table(['이름', '이메일', '연락처', '가입일', '상태', '권한', '찬양팀', ''], shown.map(function (m) {
        return { cells: ['<b class="nw">' + esc(m.name) + '</b>' + (m.id === meId ? ' <span class="chip">나</span>' : ''), esc(m.email || ''), '<span class="nw">' + esc(m.phone || '-') + '</span>', '<span class="nw">' + U.fmtDate(m.created_at) + '</span>',
          '<select data-mst="' + m.id + '"' + (m.id === meId ? ' disabled' : '') + '>' + ST.map(function (s) { return '<option value="' + s[0] + '"' + (m.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>',
          '<select data-mrole="' + m.id + '"' + (m.id === meId ? ' disabled' : '') + '><option value="member"' + (m.role === 'member' ? ' selected' : '') + '>성도</option><option value="admin"' + (m.role === 'admin' ? ' selected' : '') + '>관리자</option></select>',
          '<label class="switch sm"><input type="checkbox" data-team="' + m.id + '"' + ((m.teams || []).indexOf('worship') >= 0 ? ' checked' : '') + '><i></i></label>',
          (m.status === 'pending' ? '<button class="btn btn-sm btn-primary" data-approve="' + m.id + '">승인</button> ' : '') + (m.id === meId ? '' : '<button class="icon-btn danger-text" data-mdel="' + m.id + '" aria-label="삭제">' + icon('trash') + '</button>')] };
      }), { empty: '해당하는 회원이 없어요.' }));
      U.$$('[data-st]', ctx.el).forEach(function (b) { b.onclick = function () { st = b.dataset.st; draw(); }; });
      var to = ctx.el.querySelector('[data-teamonly]'); if (to) to.onclick = function () { teamOnly = !teamOnly; draw(); };
      U.$$('[data-team]', ctx.el).forEach(function (c) {
        c.onchange = guard(async function () {
          var m = list.filter(function (x) { return x.id === c.dataset.team; })[0];
          var teams = (m.teams || []).filter(function (t) { return t !== 'worship'; });
          if (c.checked) teams.push('worship');
          await upd(m.id, { teams: teams });
        });
      });
      U.$$('[data-mst]', ctx.el).forEach(function (s) { s.onchange = guard(async function () { await upd(s.dataset.mst, { status: s.value }); }); });
      U.$$('[data-approve]', ctx.el).forEach(function (b) { b.onclick = guard(async function () { await upd(b.dataset.approve, { status: 'active' }); draw(); }); });
      U.$$('[data-mrole]', ctx.el).forEach(function (s) {
        s.onchange = guard(async function () {
          if (s.value === 'admin' && !(await U.confirm('이 회원에게 관리자 권한을 줄까요?\n모든 회원 정보와 문의를 볼 수 있게 됩니다.'))) { s.value = 'member'; return; }
          await upd(s.dataset.mrole, { role: s.value });
        });
      });
      U.$$('[data-mdel]', ctx.el).forEach(function (b) {
        b.onclick = guard(async function () {
          if (!(await U.confirm('이 회원과 작성한 나눔·질문을 모두 삭제할까요?\n(Supabase 로그인 계정 자체는 대시보드 Authentication 메뉴에서 삭제하세요)', '삭제', true))) return;
          await App.api.profiles.remove(b.dataset.mdel); list = list.filter(function (m) { return m.id !== b.dataset.mdel; }); draw(); U.toast('삭제했어요.');
        });
      });
    }
    async function upd(id, o) {
      var m = await App.api.profiles.update(id, o);
      list = list.map(function (x) { return x.id === id ? Object.assign(x, m) : x; });
      U.toast('변경했어요.'); App.refreshBadges(true);
    }
    ctx.el.querySelector('#msearch').oninput = U.debounce(function (e) { q = e.target.value.trim().toLowerCase(); draw(); }, 150);
    ctx.el.querySelector('[data-csv]').onclick = function () {
      U.downloadCSV('회원명단_' + U.ymd(new Date()) + '.csv', ['이름', '이메일', '연락처', '가입일', '상태', '권한', '찬양팀'],
        list.map(function (m) { return [m.name, m.email, m.phone || '', U.fmtDate(m.created_at), { active: '정상', pending: '승인 대기', blocked: '이용 제한', withdrawn: '탈퇴' }[m.status], m.role === 'admin' ? '관리자' : '성도', (m.teams || []).indexOf('worship') >= 0 ? 'Y' : '']; }));
    };
    draw();
  }, Object.assign({ title: '회원 관리' }, A));

  /* ---------------- 사이트 콘텐츠 편집 ---------------- */
  var SCHEMA = {
    home: { label: '홈', fields: [
      { k: 'heroLines', t: 'lines', label: '메인 문구 (한 줄씩)' },
      { k: 'sloganLines', t: 'lines', label: '영문 슬로건 (한 줄씩)' },
      { k: 'intro', t: 'textarea', label: '소개 문단' },
      { k: 'heroImage', t: 'image', label: '메인 그래픽 이미지' },
      { k: 'principles', t: 'list', label: '세 가지 방향', item: [{ k: 'en', t: 'text', label: '영문 제목' }, { k: 'ko', t: 'text', label: '한글 소제목' }, { k: 'text', t: 'textarea', label: '내용' }, { k: 'verse', t: 'text', label: '말씀' }] },
      { k: 'place', t: 'group', label: '예배 장소 소개 (갈색 띠)', fields: [{ k: 'label', t: 'text', label: '윗줄' }, { k: 'name', t: 'text', label: '장소 이름' }, { k: 'desc', t: 'textarea', label: '설명' }, { k: 'address', t: 'text', label: '주소' }, { k: 'linkLabel', t: 'text', label: '버튼 글자' }, { k: 'linkUrl', t: 'text', label: '버튼 링크' }] },
      { k: 'slides', t: 'images', label: '슬라이드 사진' },
      { k: 'waysTitle', t: 'text', label: '"함께하는 방법" 제목' }
    ] },
    about: { label: '우리는 인투처치입니다', fields: [
      { k: 'title', t: 'text', label: '페이지 제목' }, { k: 'heading', t: 'text', label: '첫 제목' },
      { k: 'paragraphs', t: 'paras', label: '본문 문단' },
      { k: 'intoTitle', t: 'text', label: 'INTO 제목' }, { k: 'intoLead', t: 'text', label: 'INTO 설명' },
      { k: 'intoList', t: 'lines', label: 'INTO 목록 (한 줄씩)' },
      { k: 'incarnation', t: 'paras', label: '성육신 문단' },
      { k: 'image', t: 'image', label: '하단 이미지' }
    ] },
    worship: { label: '주일 예배 안내', fields: [
      { k: 'title', t: 'text', label: '페이지 제목' }, { k: 'image', t: 'image', label: '이미지' },
      { k: 'times', t: 'list', label: '예배 시간', item: [{ k: 'time', t: 'text', label: '시간' }, { k: 'name', t: 'text', label: '이름' }, { k: 'desc', t: 'textarea', label: '설명' }] },
      { k: 'placeName', t: 'text', label: '장소 이름' }, { k: 'address', t: 'text', label: '주소 (지도 검색에 사용)' }, { k: 'notes', t: 'textarea', label: '안내 문구' }
    ] },
    community: { label: '예배와 공동체', fields: [
      { k: 'title', t: 'text', label: '페이지 제목' },
      { k: 'items', t: 'list', label: '항목', item: [{ k: 'en', t: 'text', label: '영문' }, { k: 'ko', t: 'text', label: '한글 제목' }, { k: 'text', t: 'textarea', label: '설명' }] }
    ] },
    foundation: { label: 'FOUNDATION', fields: [
      { k: 'title', t: 'text', label: '페이지 제목' },
      { k: 'items', t: 'list', label: '항목', item: [{ k: 'title', t: 'text', label: '제목' }, { k: 'text', t: 'textarea', label: '내용' }] },
      { k: 'closing', t: 'text', label: '마지막 문장' }
    ] },
    links: { label: '링크', fields: [
      { k: 'giving', t: 'text', label: '온라인 헌금 링크' }, { k: 'table', t: 'text', label: 'INTO TABLE 링크' },
      { k: 'newsletter', t: 'text', label: 'INTO NEWS LETTER 링크' }, { k: 'youtube', t: 'text', label: '유튜브 (선택)' }, { k: 'instagram', t: 'text', label: '인스타그램 (선택)' }
    ] },
    church: { label: '교회 정보 (하단)', fields: [
      { k: 'name', t: 'text', label: '교회 이름' }, { k: 'nameEn', t: 'text', label: '영문 이름' }, { k: 'email', t: 'text', label: '이메일' },
      { k: 'website', t: 'text', label: '웹사이트' }, { k: 'pastor', t: 'text', label: '담임목사' }, { k: 'office', t: 'text', label: '사무실 주소' },
      { k: 'affiliation', t: 'text', label: '소속' }, { k: 'regNo', t: 'text', label: '고유번호' }
    ] }
  };

  function getPath(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, path, v) { var ks = path.split('.'), last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v; }

  App.route('/admin/content', async function (ctx) {
    var key = ctx.query.k && SCHEMA[ctx.query.k] ? ctx.query.k : 'home';
    var content = await App.api.content.getAll();
    if (!ctx.alive()) return;
    var draft = JSON.parse(JSON.stringify(content[key] || {}));
    var dirty = false;

    ctx.el.innerHTML =
      '<div class="tabs-line">' + Object.keys(SCHEMA).map(function (k) { return '<a href="#/admin/content?k=' + k + '" class="' + (k === key ? 'on' : '') + '">' + SCHEMA[k].label + '</a>'; }).join('') + '</div>' +
      '<div class="content-editor"><div id="ce"></div>' +
      '<div class="sticky-save"><button class="btn btn-ghost" data-reset>기본값으로</button><a class="btn btn-ghost" href="#' + ({ home: '/', about: '/about', worship: '/worship', community: '/community', foundation: '/foundation' }[key] || '/') + '" target="_blank">' + icon('external') + '미리보기</a><button class="btn btn-primary" data-save>' + icon('check') + '저장</button></div></div>';

    var root = ctx.el.querySelector('#ce');
    function fieldHTML(f, path, val) {
      var id = 'f_' + path.replace(/\./g, '_');
      switch (f.t) {
        case 'text': return '<label class="field"><span>' + f.label + '</span><input id="' + id + '" data-path="' + path + '" value="' + esc(val || '') + '"></label>';
        case 'textarea': return '<label class="field"><span>' + f.label + '</span><textarea rows="4" data-path="' + path + '">' + esc(val || '') + '</textarea></label>';
        case 'lines': return '<label class="field"><span>' + f.label + '</span><textarea rows="' + Math.max(2, (val || []).length + 1) + '" data-path="' + path + '" data-lines>' + esc((val || []).join('\n')) + '</textarea></label>';
        case 'paras': return '<div class="field"><span>' + f.label + '</span>' + (val || []).map(function (p, i) {
            return '<div class="para-row"><textarea rows="3" data-path="' + path + '.' + i + '">' + esc(p) + '</textarea><div class="li-tools">' + listTools(path, i, (val || []).length) + '</div></div>';
          }).join('') + '<button type="button" class="btn btn-sm btn-ghost" data-add="' + path + '" data-kind="str">' + icon('plus') + '문단 추가</button></div>';
        case 'image': return '<div class="field"><span>' + f.label + '</span><div class="img-field" data-img="' + path + '"></div></div>';
        case 'images': return '<div class="field"><span>' + f.label + ' <small class="muted">(' + (val || []).length + '장)</small></span><div class="img-list">' + (val || []).map(function (u, i) {
            return '<div class="il"><img src="' + esc(u) + '" alt=""><div class="il-tools">' + listTools(path, i, val.length) + '</div></div>';
          }).join('') + '<button type="button" class="il-add" data-addimg="' + path + '">' + icon('plus') + '<span>사진 추가</span></button></div></div>';
        case 'group': return '<fieldset class="group"><legend>' + f.label + '</legend>' + f.fields.map(function (sf) { return fieldHTML(sf, path + '.' + sf.k, (val || {})[sf.k]); }).join('') + '</fieldset>';
        case 'list': return '<fieldset class="group"><legend>' + f.label + '</legend>' + (val || []).map(function (it, i) {
            return '<div class="list-item"><div class="li-head"><b>' + (i + 1) + '</b><div class="li-tools">' + listTools(path, i, val.length) + '</div></div>' + f.item.map(function (sf) { return fieldHTML(sf, path + '.' + i + '.' + sf.k, it[sf.k]); }).join('') + '</div>';
          }).join('') + '<button type="button" class="btn btn-sm btn-ghost" data-add="' + path + '" data-kind="obj">' + icon('plus') + '항목 추가</button></fieldset>';
      }
      return '';
    }
    function listTools(path, i, n) {
      return '<button type="button" class="icon-btn" data-mv="' + path + '|' + i + '|-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">' + icon('chevron-left', 'rot90') + '</button>' +
        '<button type="button" class="icon-btn" data-mv="' + path + '|' + i + '|1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="아래로">' + icon('chevron-right', 'rot90') + '</button>' +
        '<button type="button" class="icon-btn danger-text" data-rmv="' + path + '|' + i + '" aria-label="삭제">' + icon('trash') + '</button>';
    }
    function draw() {
      root.innerHTML = '<div class="panel"><div class="panel-body form">' + SCHEMA[key].fields.map(function (f) { return fieldHTML(f, f.k, draft[f.k]); }).join('') + '</div></div>';
      U.$$('[data-path]', root).forEach(function (el) {
        el.addEventListener('input', function () {
          dirty = true;
          setPath(draft, el.dataset.path, el.hasAttribute('data-lines') ? el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : el.value);
        });
      });
      U.$$('[data-img]', root).forEach(function (el) {
        imageField(el, getPath(draft, el.dataset.img), function (v) { setPath(draft, el.dataset.img, v); dirty = true; draw(); }, 'content');
      });
      U.$$('[data-addimg]', root).forEach(function (b) {
        b.onclick = async function () {
          var rs = await App.pickAndUpload({ multiple: true, folder: 'content' });
          if (!rs || !rs.length) return;
          var arr = getPath(draft, b.dataset.addimg) || []; rs.forEach(function (r) { arr.push(r.url); });
          setPath(draft, b.dataset.addimg, arr); dirty = true; draw();
        };
      });
      U.$$('[data-add]', root).forEach(function (b) {
        b.onclick = function () { var arr = getPath(draft, b.dataset.add) || []; arr.push(b.dataset.kind === 'str' ? '' : {}); setPath(draft, b.dataset.add, arr); dirty = true; draw(); };
      });
      U.$$('[data-mv]', root).forEach(function (b) {
        b.onclick = function () { var p = b.dataset.mv.split('|'), arr = getPath(draft, p[0]), i = +p[1], j = i + (+p[2]); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; dirty = true; draw(); };
      });
      U.$$('[data-rmv]', root).forEach(function (b) {
        b.onclick = function () { var p = b.dataset.rmv.split('|'); getPath(draft, p[0]).splice(+p[1], 1); dirty = true; draw(); };
      });
    }
    draw();
    ctx.el.querySelector('[data-save]').onclick = guard(async function () {
      var b = this; U.busy(b, true);
      try {
        await App.api.content.set(key, draft);
        App.content = await App.api.content.getAll(); App.refreshChrome(); dirty = false;
        U.toast('저장했어요. 앱에 바로 반영돼요.');
      } finally { U.busy(b, false); }
    });
    ctx.el.querySelector('[data-reset]').onclick = async function () {
      if (!(await U.confirm('"' + SCHEMA[key].label + '" 내용을 처음 기본값(into.or.kr 내용)으로 되돌릴까요?\n저장을 눌러야 반영돼요.'))) return;
      draft = JSON.parse(JSON.stringify(window.INTO_DEFAULTS.content[key])); dirty = true; draw();
    };
    var leave = function (e) { if (dirty && ctx.alive()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leave);
  }, Object.assign({ title: '사이트 콘텐츠', keepScroll: false }, A));

  /* ---------------- 설정 ---------------- */
  App.route('/admin/settings', async function (ctx) {
    var content = await App.api.content.getAll();
    if (!ctx.alive()) return;
    var s = content.settings || {};
    var appUrl = location.origin + location.pathname;
    ctx.el.innerHTML =
      '<div class="two-col">' +
        panel('가입 · 문의 설정',
          '<form class="form" id="st">' +
            '<label class="switch"><input type="checkbox" name="require_approval"' + (s.require_approval ? ' checked' : '') + '><i></i><span>회원가입 승인제 <small class="muted">켜면 새 가입자는 관리자 승인 후 나눔·질문 이용</small></span></label>' +
            '<label class="field"><span>예배 문의 유형 (한 줄씩)</span><textarea name="kinds" rows="4">' + esc((s.inquiry_kinds || []).join('\n')) + '</textarea></label>' +
            '<div class="row-gap end"><button class="btn btn-primary">저장</button></div>' +
          '</form>') +
        panel('앱 설치 안내 (QR · 단톡방 공지)',
          '<div class="install-pc"><div class="is-qr" data-admin-qr></div><div>' +
            '<p class="small">성도들에게 아래 <b>설치 안내 주소</b>를 보내거나, QR 이미지를 주보·화면에 띄워 주세요. 휴대폰에 맞는 설치 방법이 자동으로 나와요.</p>' +
            '<p><code>' + esc(window.Install ? Install.installURL() : appUrl) + '</code></p>' +
            '<div class="row-gap"><button class="btn btn-sm btn-primary" data-qr-png>' + icon('download') + 'QR 이미지 (인쇄용)</button>' +
            '<button class="btn btn-sm btn-ghost" data-copy-notice>' + icon('send') + '단톡방 안내문 복사</button></div>' +
          '</div></div>') +
        panel('앱 정보',
          '<dl class="dl"><dt>데이터 모드</dt><dd>' + (App.api.mode === 'demo' ? '<span class="chip chip-warn">데모 (이 브라우저에만 저장)</span>' : '<span class="chip chip-ok">Supabase 연결됨</span>') + '</dd>' +
          '<dt>앱 주소</dt><dd><code>' + esc(appUrl) + '</code> <button class="btn btn-sm btn-ghost" data-copy>복사</button></dd>' +
          '<dt>설치</dt><dd>성도들에게 앱 주소를 보내고 "홈 화면에 추가"를 안내하세요.</dd></dl>' +
          (App.api.mode === 'demo' ? '<div class="callout"><b>실제 운영 전환</b><p class="small">README.md 안내대로 Supabase에 <code>supabase/schema.sql</code>을 실행하고 <code>config.js</code>에 주소/키를 넣으면 실제 회원가입·DB 저장으로 바뀝니다.</p><button class="btn btn-sm btn-ghost danger-text" data-reset>데모 데이터 초기화</button></div>' : '')) +
      '</div>';
    var f = ctx.el.querySelector('#st');
    f.onsubmit = guard(async function (e) {
      e.preventDefault();
      var v = Object.assign({}, s, { require_approval: f.require_approval.checked, inquiry_kinds: f.kinds.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) });
      await App.api.content.set('settings', v);
      App.content = await App.api.content.getAll(); U.toast('설정을 저장했어요.');
    });
    ctx.el.querySelector('[data-copy]').onclick = function () { Install.copy(appUrl, '앱 주소를 복사했어요.'); };
    var iu = Install.installURL();
    Install.qrSVG(iu).then(function (svg) { var b = ctx.el.querySelector('[data-admin-qr]'); if (b) b.innerHTML = svg; });
    ctx.el.querySelector('[data-qr-png]').onclick = guard(async function () {
      var blob = await Install.qrPNG(iu);
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '인투처치_앱설치_QR.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
    ctx.el.querySelector('[data-copy-notice]').onclick = function () {
      Install.copy('[인투처치 앱 안내]\n매주 나눔지와 나눔, 교회 소식, 예배 안내를 앱으로 만나 보세요 🙂\n\n👉 ' + iu + '\n\n· 아이폰: Safari로 열고 공유 → 홈 화면에 추가\n· 안드로이드: Chrome으로 열고 "앱 설치"\n(카카오톡에서 열리면 오른쪽 위 메뉴에서 다른 브라우저로 열어 주세요)', '안내문을 복사했어요. 단톡방에 붙여 넣어 주세요.');
    };
    var rs = ctx.el.querySelector('[data-reset]');
    if (rs) rs.onclick = async function () { if (!(await U.confirm('데모 데이터를 처음 상태로 되돌릴까요?', '초기화', true))) return; App.api.resetDemo(); location.hash = '#/'; location.reload(); };
  }, Object.assign({ title: '설정' }, A));
})();
