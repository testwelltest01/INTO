/* =====================================================================
 * 나눔 조 나누기 — 실시간 미니게임
 *  1) 누군가 "조 나누기 열기" → 4자리 참가 코드 + QR
 *  2) 현장에 있는 사람들이 휴대폰으로 참가 (로그인 안 한 방문자는 이름만)
 *     휴대폰이 없는 분은 방장이 이름을 직접 추가, 현장에 없는 사람은 빼기
 *  3) 방장이 조 개수(또는 조당 인원)를 정하고 "조 나누기!" → 모두의 화면에서 슬롯이 돌다가 내 조 공개
 *  - 조 이름은 성령의 열매 (사랑·희락·화평·오래참음·자비·양선·충성·온유·절제)
 *  - ⭐ 조장으로 지정한 사람은 조마다 한 명씩 먼저 배치
 * ===================================================================== */
(function () {
  var esc = U.esc, icon = U.icon;
  var FRUITS = [['사랑', '#E0605E'], ['희락', '#EE9B2F'], ['화평', '#4AA172'], ['오래참음', '#4A84C6'], ['자비', '#8E6FCB'],
                ['양선', '#DA77A8'], ['충성', '#2C9895'], ['온유', '#B4864A'], ['절제', '#66788A']];
  var DICE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/></svg>';
  var STAR = '<svg class="ic star" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

  function gName(i) { return (i + 1) + '조'; }
  function gFruit(i) { return i < FRUITS.length ? FRUITS[i][0] : ''; }
  function gColor(i) { return FRUITS[i % FRUITS.length][1]; }
  function rnd(n) { try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sid(x) { return String(x); }

  // 조 나누기: 조장 먼저 한 명씩, 나머지는 가장 적은 조부터 (조 크기 차이는 최대 1명)
  function makeGroups(members, n) {
    n = Math.max(1, Math.min(n, members.length || 1));
    var gs = []; for (var i = 0; i < n; i++) gs.push({ no: i + 1, name: gName(i), fruit: gFruit(i), color: gColor(i), ids: [], leaders: [] });
    function pick(score) {
      var best = null, ties = [];
      gs.forEach(function (g) { var s = score(g); if (best === null || s < best) { best = s; ties = [g]; } else if (s === best) ties.push(g); });
      return ties[rnd(ties.length)];
    }
    shuffle(members.filter(function (m) { return m.is_leader; })).forEach(function (m) {
      var g = pick(function (g) { return g.leaders.length * 1000 + g.ids.length; }); g.ids.push(m.id); g.leaders.push(m.id);
    });
    shuffle(members.filter(function (m) { return !m.is_leader; })).forEach(function (m) {
      pick(function (g) { return g.ids.length; }).ids.push(m.id);
    });
    return gs;
  }
  function assignedIds(groups) { var s = {}; (groups || []).forEach(function (g) { g.ids.forEach(function (id) { s[sid(id)] = 1; }); }); return s; }
  function addLate(groups, late) {
    groups = JSON.parse(JSON.stringify(groups || []));
    shuffle(late).forEach(function (m) {
      var min = Math.min.apply(null, groups.map(function (g) { return g.ids.length; }));
      var ties = groups.filter(function (g) { return g.ids.length === min; });
      ties[rnd(ties.length)].ids.push(m.id);
    });
    return groups;
  }
  function groupOf(room, mid) { if (mid == null) return null; return (room.groups || []).filter(function (g) { return g.ids.map(sid).indexOf(sid(mid)) >= 0; })[0] || null; }
  function sizesText(total, n) {
    if (!total || !n) return '';
    var lo = Math.floor(total / n), hi = Math.ceil(total / n);
    return lo === hi ? lo + '명씩' : lo + '~' + hi + '명씩';
  }
  function joinURL(code) { return location.origin + location.pathname + '#/mix/' + code + '?j=1'; }
  function guestKey(code) { return 'into_mix_guest_' + code; }
  function loadGuest(code) { try { return JSON.parse(localStorage.getItem(guestKey(code)) || 'null'); } catch (e) { return null; } }
  function saveGuest(code, g) { try { localStorage.setItem(guestKey(code), JSON.stringify(g)); } catch (e) { } }
  function defaultTitle() { var d = new Date(); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 나눔'; }
  function initial(name) { return String(name || '?').trim().charAt(0) || '?'; }

  App.mixOpenDialog = function () {
    U.modal({
      title: '조 나누기 열기',
      html: '<form class="form" id="mix-new"><label class="field"><span>이름</span><input name="title" value="' + esc(defaultTitle()) + '" maxlength="40" required autocomplete="off"></label>' +
        '<p class="muted small">열면 4자리 참가 코드와 QR이 생겨요. 현장에 있는 분들이 휴대폰으로 참가하면 이름이 실시간으로 올라와요.</p>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">' + DICE + '열기</button></div></form>',
      onMount: function (root, close) {
        var f = root.querySelector('#mix-new');
        f.onsubmit = async function (e) {
          e.preventDefault(); var b = f.querySelector('.btn-primary'); U.busy(b, true);
          try { var r = await App.api.mix.open({ title: U.formData(f).title.trim() || defaultTitle() }); close(); App.go('/mix/' + r.code); }
          catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(b, false); }
        };
      }
    });
  };

  /* =====================================================================
   *  시작 화면: 코드 넣고 참가 / 열려 있는 방 / 새로 열기
   * ===================================================================== */
  App.route('/mix', async function (ctx) {
    var member = App.isMember(), p = App.profile(), rooms = [], counts = {};
    if (member) {
      try {
        rooms = await App.api.mix.listOpen();
        var ms = await Promise.all(rooms.map(function (r) { return App.api.mix.members(r.id).catch(function () { return []; }); }));
        rooms.forEach(function (r, i) { counts[r.id] = ms[i].length; });
      } catch (e) { }
    }
    if (!ctx.alive()) return;
    ctx.el.innerHTML = App.pageHead('나눔 조 나누기', '현장에 있는 사람들이 휴대폰으로 참가하면, 한 번에 조를 나눠 드려요') + (App.qTabs ? App.qTabs('mix') : '') +
      '<section class="container narrow mix-land">' +
        '<form class="card mix-codeform" id="mix-codeform">' +
          '<label for="mix-code">참가 코드 4자리</label>' +
          '<input id="mix-code" class="mix-codein" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0000" autocomplete="off" enterkeyhint="go">' +
          (!member ? '<input id="mix-name" class="mix-namein" placeholder="내 이름" maxlength="20" autocomplete="off" value="' + esc(p ? p.name : '') + '">' : '') +
          '<button class="btn btn-primary btn-block">참가하기</button>' +
          (!p ? '<p class="muted small center">로그인하면 이름을 적지 않아도 돼요. <a href="#/login">로그인</a></p>' : '') +
        '</form>' +
        (rooms.length ? '<h2 class="mix-h">지금 열려 있는 조 나누기</h2><div class="list-card">' + rooms.map(function (r) {
          var mine = p && r.host_id === p.id;
          return '<a class="list-row" href="#/mix/' + r.code + '"><span class="lr-icon mix-lr">' + DICE + '</span><span class="lr-body"><span class="lr-title">' + esc(r.title) +
            (mine ? ' <span class="chip chip-dark">내가 연 방</span>' : '') + '</span><span class="lr-sub">코드 ' + r.code + ' · ' + (counts[r.id] || 0) + '명 참가 · ' +
            (r.status === 'done' ? '조 나눔 완료' : '참가 받는 중') + ' · ' + esc(U.fmtRel(r.created_at)) + '</span></span>' + icon('chevron-right', 'lr-arrow') + '</a>';
        }).join('') + '</div>' : '') +
        (member ? '<button class="btn btn-ghost btn-block mix-open-btn" id="mix-open">' + DICE + '새 조 나누기 열기</button>' +
          '<p class="muted small center">연 사람이 조 개수를 정하고 "조 나누기!"를 누르면, 참가한 모두의 화면에 결과가 동시에 떠요.</p>' : '') +
      '</section>';
    var ci = U.$('#mix-code', ctx.el);
    ci.oninput = function () { ci.value = ci.value.replace(/\D/g, '').slice(0, 4); };
    U.$('#mix-codeform', ctx.el).onsubmit = async function (e) {
      e.preventDefault();
      var code = ci.value.trim();
      if (!/^\d{4}$/.test(code)) { U.toast('참가 코드 숫자 4자리를 넣어 주세요.', 'error'); ci.focus(); return; }
      if (member) { App.go('/mix/' + code + '?j=1'); return; }
      var ni = U.$('#mix-name', ctx.el), name = ni.value.trim();
      if (!name) { U.toast('이름을 적어 주세요.', 'error'); ni.focus(); return; }
      var b = e.target.querySelector('.btn-primary'); U.busy(b, true);
      try { var g = await App.api.mix.guestJoin(code, name); saveGuest(code, g); App.go('/mix/' + code); }
      catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(b, false); }
    };
    var ob = U.$('#mix-open', ctx.el); if (ob) ob.onclick = App.mixOpenDialog;
  }, { title: '조 나누기' });

  /* =====================================================================
   *  방 화면 (방장 / 참가자 / 방문자)
   * ===================================================================== */
  App.route('/mix/:code', async function (ctx) {
    var code = ctx.params.code, member = App.isMember(), p = App.profile();
    var st = { room: null, members: [], meId: null, guest: loadGuest(code), role: '' };
    var unsub = null, pollT = null, destroyed = false, busyRefresh = false, again = false;
    var by = 'groups', num = 3, numTouched = false, present = false, firstDraw = true;

    App.onLeave(function () { destroyed = true; if (unsub) unsub(); if (pollT) clearInterval(pollT); closeOverlay(); document.body.classList.remove('viewer-mode'); });

    // 1) 방 찾기
    try {
      if (member) {
        var r0 = await App.api.mix.byCode(code);
        if (r0) { st.room = r0; st.members = await App.api.mix.members(r0.id); }
        else if (st.guest) st.guest = null;
      }
      if (!st.room && st.guest) {
        var g0 = await App.api.mix.guestState(st.guest.member_id, st.guest.token);
        if (g0) { st.room = g0.room; st.members = g0.members; st.meId = g0.me; }
        else { localStorage.removeItem(guestKey(code)); st.guest = null; }
      }
    } catch (e) { }
    if (!ctx.alive()) return;

    // 방을 못 찾았을 때: 방문자 참가 양식 또는 안내
    if (!st.room) {
      if (!member) return drawGuestJoin();
      ctx.el.innerHTML = App.pageHead('나눔 조 나누기') + '<section class="container narrow"><div class="empty">참가 코드 <b>' + esc(code) + '</b>인 조 나누기를 찾을 수 없어요.<br><small>이미 끝났거나 코드가 달라요.</small></div>' +
        '<a class="btn btn-ghost btn-block" href="#/mix">다른 코드 넣기</a></section>';
      return;
    }
    if (st.guest) st.role = 'guest';
    else if (p && st.room.host_id === p.id) st.role = 'host';
    else st.role = 'member';
    if (st.role !== 'guest') { var mine0 = st.members.filter(function (m) { return p && m.user_id === p.id; })[0]; st.meId = mine0 ? mine0.id : null; }
    if (st.role === 'member' && !st.meId && ctx.query.j && st.room.status !== 'closed') {
      try { var jm = await App.api.mix.join(st.room.id); st.meId = jm.id; st.members = await App.api.mix.members(st.room.id); U.toast('참가했어요!'); } catch (e) { U.toast(U.errMsg(e), 'error'); }
      history.replaceState(null, '', '#/mix/' + code);
    }
    if (!ctx.alive()) return;

    skeleton();
    update(true);
    // 2) 실시간으로 맞추기
    if (st.role === 'guest') pollT = setInterval(refresh, 2000);
    else unsub = App.api.mix.subscribe(st.room.id, refresh);

    async function refresh() {
      if (destroyed) return;
      if (busyRefresh) { again = true; return; }
      busyRefresh = true;
      try {
        if (st.role === 'guest') {
          var g = await App.api.mix.guestState(st.guest.member_id, st.guest.token);
          if (!g) { localStorage.removeItem(guestKey(code)); destroyed = true; if (pollT) clearInterval(pollT); U.toast('조 나누기에서 빠졌어요.'); App.go('/mix', true); return; }
          st.room = g.room; st.members = g.members; st.meId = g.me;
        } else {
          var r = await Promise.all([App.api.mix.get(st.room.id), App.api.mix.members(st.room.id)]);
          st.room = r[0]; st.members = r[1];
          var mine = st.members.filter(function (m) { return p && m.user_id === p.id; })[0]; st.meId = mine ? mine.id : null;
        }
        if (!destroyed) update(false);
      } catch (e) { }
      busyRefresh = false;
      if (again) { again = false; refresh(); }
    }

    /* ---------- 화면 뼈대 ---------- */
    function skeleton() {
      var r = st.room, host = st.role === 'host';
      ctx.el.innerHTML =
        '<section class="mix ' + (host ? 'mix-host' : 'mix-part') + ' container' + (host ? '' : ' narrow') + '" id="mix">' +
          '<div class="mix-head">' +
            '<div class="mix-head-t"><span class="mix-kicker">' + DICE + '나눔 조 나누기</span><h1 id="mix-title">' + esc(r.title) + '</h1></div>' +
            (host ? '<div class="mix-head-tools"><button class="btn btn-sm btn-ghost" data-rename>' + icon('edit') + '이름</button><button class="btn btn-sm btn-ghost" data-present>' + icon('eye') + '크게 띄우기</button></div>' : '') +
          '</div>' +
          (host ?
            '<div class="mix-codebox">' +
              '<div class="mix-codebox-l"><span class="mix-k">참가 코드</span><b class="mix-code">' + esc(r.code) + '</b>' +
                '<span class="mix-k2">앱 <b>나눔 → 조 나누기</b>에서 코드를 넣거나<br>QR을 카메라로 찍으세요</span>' +
                '<div class="mix-codebox-btns"><button class="btn btn-sm btn-ghost" data-share>' + icon('send') + '링크 보내기</button><button class="btn btn-sm btn-ghost" data-me-join></button></div></div>' +
              '<div class="mix-qr" data-qr></div>' +
            '</div>' +
            '<div class="mix-grid">' +
              '<div class="panel mix-people"><div class="panel-head"><h2>참가한 사람 <b class="mix-n" id="mix-n">0</b>명</h2></div><div class="panel-body">' +
                '<div class="mix-chips" id="mix-chips"></div>' +
                '<p class="mix-tip">이름을 누르면 ' + STAR + '<b>조장</b>이 돼요 (조마다 한 명씩 먼저 나눠요). 현장에 없는 사람은 <b>✕</b>로 빼 주세요.</p>' +
                '<form class="mix-add" id="mix-add"><input placeholder="휴대폰 없는 분 이름 추가" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><button class="btn btn-sm">' + icon('plus') + '추가</button></form>' +
                (App.api.mode === 'demo' ? '<button class="btn btn-sm btn-ghost mix-demo" data-demo-fill>가상 참가자 8명 넣기 (데모)</button>' : '') +
              '</div></div>' +
              '<div class="panel mix-setup"><div class="panel-body">' +
                '<div class="mix-mode"><button type="button" data-by="groups">조 개수로</button><button type="button" data-by="size">조당 인원으로</button></div>' +
                '<div class="mix-stepper"><button type="button" class="icon-btn" data-step="-1" aria-label="줄이기">−</button><b id="mix-num"></b><span id="mix-unit"></span><button type="button" class="icon-btn" data-step="1" aria-label="늘리기">+</button></div>' +
                '<p class="mix-preview" id="mix-preview"></p>' +
                '<button type="button" class="mix-go" data-go>' + DICE + '<span>조 나누기!</span></button>' +
                '<div class="mix-after" id="mix-after"></div>' +
              '</div></div>' +
            '</div>'
          :
            '<div id="mix-mine"></div>' +
            '<div class="panel mix-people"><div class="panel-head"><h2>함께 있는 사람 <b class="mix-n" id="mix-n">0</b>명</h2><span class="chip">코드 ' + esc(r.code) + '</span></div><div class="panel-body"><div class="mix-chips" id="mix-chips"></div></div></div>'
          ) +
          '<div id="mix-result"></div>' +
          (!host ? '<button class="btn btn-ghost btn-block mix-leave" data-leave>' + icon('logout') + '나가기</button>' : '') +
          (host ? '<button class="mix-exit-present" data-present-exit>' + icon('close') + '작게 보기</button>' : '') +
        '</section>';
      bindStatic();
      if (host) Install.qrSVG(joinURL(r.code)).then(function (svg) { var q = U.$('[data-qr]', ctx.el); if (q) q.innerHTML = svg; }).catch(function () { });
    }

    function bindStatic() {
      var host = st.role === 'host';
      var lv = U.$('[data-leave]', ctx.el);
      if (lv) lv.onclick = async function () {
        if (!(await U.confirm('조 나누기에서 나갈까요?', '나가기'))) return;
        try {
          if (st.role === 'guest') { await App.api.mix.guestLeave(st.guest.member_id, st.guest.token); localStorage.removeItem(guestKey(code)); }
          else await App.api.mix.leave(st.room.id);
        } catch (e) { }
        App.go('/mix');
      };
      if (!host) return;
      U.$('[data-share]', ctx.el).onclick = async function () {
        var url = joinURL(st.room.code), text = st.room.title + ' 조 나누기에 참가해 주세요 (코드 ' + st.room.code + ')';
        try { if (navigator.share) { await navigator.share({ title: st.room.title, text: text, url: url }); return; } } catch (e) { return; }
        try { await navigator.clipboard.writeText(text + '\n' + url); U.toast('링크를 복사했어요.'); } catch (e) { U.toast(url); }
      };
      U.$('[data-me-join]', ctx.el).onclick = async function () {
        try { if (st.meId) await App.api.mix.leave(st.room.id); else await App.api.mix.join(st.room.id); } catch (e) { U.toast(U.errMsg(e), 'error'); }
        refresh();
      };
      U.$('[data-rename]', ctx.el).onclick = function () {
        U.modal({
          title: '이름 바꾸기',
          html: '<form class="form" id="mix-rn"><label class="field"><span>이름</span><input name="t" maxlength="40" value="' + esc(st.room.title) + '" autocomplete="off"></label><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>취소</button><button class="btn btn-primary">저장</button></div></form>',
          onMount: function (root, close) {
            root.querySelector('#mix-rn').onsubmit = async function (e) {
              e.preventDefault(); var t = U.formData(e.target).t.trim(); if (!t) return;
              try { await App.api.mix.update(st.room.id, { title: t }); close(); refresh(); } catch (err) { U.toast(U.errMsg(err), 'error'); }
            };
          }
        });
      };
      function setPresent(v) { present = v; U.$('#mix', ctx.el).classList.toggle('present', v); document.body.classList.toggle('viewer-mode', v); }
      U.$('[data-present]', ctx.el).onclick = function () { setPresent(true); };
      U.$('[data-present-exit]', ctx.el).onclick = function () { setPresent(false); };
      U.$('#mix-add', ctx.el).onsubmit = async function (e) {
        e.preventDefault(); var inp = e.target.querySelector('input'), v = inp.value.trim(); if (!v) return;
        try { await App.api.mix.addName(st.room.id, v); inp.value = ''; refresh(); } catch (err) { U.toast(U.errMsg(err), 'error'); }
      };
      var df = U.$('[data-demo-fill]', ctx.el); if (df) df.onclick = async function () { await App.api.mix.demoFill(st.room.id, 8); refresh(); };
      U.$$('[data-by]', ctx.el).forEach(function (b) {
        b.onclick = function () {
          if (by === b.dataset.by) return;
          by = b.dataset.by; var n = st.members.length || 1;
          num = by === 'size' ? Math.max(2, Math.min(8, Math.round(n / Math.max(1, num)) || 4)) : Math.max(1, Math.ceil(n / Math.max(1, num)));
          numTouched = true; drawSetup();
        };
      });
      U.$$('[data-step]', ctx.el).forEach(function (b) {
        b.onclick = function () { num = Math.max(1, Math.min(50, num + (+b.dataset.step))); numTouched = true; drawSetup(); };
      });
      U.$('[data-go]', ctx.el).onclick = go;
    }

    function groupCount() {
      var n = st.members.length;
      if (by === 'size') return Math.max(1, Math.ceil(n / Math.max(1, num)));
      return Math.max(1, Math.min(num, n || num));
    }
    async function go() {
      var r = st.room, n = st.members.length;
      if (n < 2) { U.toast('두 명 이상 참가해야 나눌 수 있어요.', 'error'); return; }
      if ((r.groups || []).length && !(await U.confirm('조를 다시 섞을까요?\n지금 나뉜 조가 모두 바뀌어요.', '다시 섞기'))) return;
      var b = U.$('[data-go]', ctx.el); b.disabled = true;
      try {
        var gs = makeGroups(st.members, groupCount());
        await App.api.mix.update(r.id, { groups: gs, group_count: gs.length, round: (r.round || 0) + 1, status: 'done' });
        await refresh();
      } catch (e) { U.toast(U.errMsg(e), 'error'); }
      b.disabled = false;
    }

    /* ---------- 바뀐 부분만 다시 그리기 ---------- */
    function update(initial) {
      var r = st.room, host = st.role === 'host';
      var t = U.$('#mix-title', ctx.el); if (t && t.textContent !== r.title) t.textContent = r.title;
      U.$('#mix', ctx.el).classList.toggle('closed', r.status === 'closed');
      drawChips();
      if (host) { drawSetup(); drawAfter(); }
      else drawMine();
      drawResult(initial);
      // 내 조가 새로 정해졌으면 슬롯 공개 (같은 결과는 한 번만)
      var my = groupOf(r, st.meId);
      if (my && r.round) {
        var key = 'into_mix_seen_' + r.id + '_' + r.round + '_' + sid(st.meId) + '_' + my.no;
        var seen = false; try { seen = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch (e) { }
        if (!seen) reveal(my);
      }
      firstDraw = false;
    }

    function drawChips() {
      var box = U.$('#mix-chips', ctx.el); if (!box) return;
      var host = st.role === 'host', ms = st.members, as = assignedIds(st.room.groups), hasGroups = (st.room.groups || []).length > 0;
      U.$('#mix-n', ctx.el).textContent = ms.length;
      var prev = {}; U.$$('[data-mid]', box).forEach(function (c) { prev[c.dataset.mid] = 1; });
      box.innerHTML = ms.length ? ms.map(function (m) {
        var me = sid(m.id) === sid(st.meId), late = hasGroups && !as[sid(m.id)];
        return '<span class="mix-chip' + (m.is_leader ? ' leader' : '') + (me ? ' is-me' : '') + (late ? ' late' : '') + (firstDraw || prev[sid(m.id)] ? '' : ' pop') + '" data-mid="' + m.id + '">' +
          (host ? '<button type="button" class="mix-chip-b" data-leader="' + m.id + '" title="조장 지정/해제">' : '<span class="mix-chip-b">') +
            '<i>' + esc(initial(m.name)) + '</i>' + (m.is_leader ? STAR : '') + esc(m.name) + (me ? ' (나)' : '') + (m.added_by_host ? '<small>직접 추가</small>' : '') + (late ? '<small>늦게 옴</small>' : '') +
          (host ? '</button><button type="button" class="mix-chip-x" data-rm="' + m.id + '" aria-label="' + esc(m.name) + ' 빼기">✕</button>' : '</span>') + '</span>';
      }).join('') : '<p class="muted small mix-empty">아직 아무도 없어요. 참가 코드나 QR을 알려 주세요.</p>';
      if (!host) return;
      U.$$('[data-leader]', box).forEach(function (b) {
        b.onclick = async function () {
          var m = st.members.filter(function (x) { return sid(x.id) === b.dataset.leader; })[0]; if (!m) return;
          m.is_leader = !m.is_leader; drawChips();
          try { await App.api.mix.setLeader(m.id, m.is_leader); } catch (e) { U.toast(U.errMsg(e), 'error'); refresh(); }
        };
      });
      U.$$('[data-rm]', box).forEach(function (b) {
        b.onclick = async function () {
          var m = st.members.filter(function (x) { return sid(x.id) === b.dataset.rm; })[0]; if (!m) return;
          if (!(await U.confirm(m.name + ' 님을 빼까요?', '빼기'))) return;
          try { await App.api.mix.remove(m.id); refresh(); } catch (e) { U.toast(U.errMsg(e), 'error'); }
        };
      });
    }

    function drawSetup() {
      var n = st.members.length;
      if (!numTouched && by === 'groups') num = st.room.round ? st.room.group_count : Math.max(n < 4 ? 1 : 2, Math.min(8, Math.round(n / 4) || 1));
      var gc = groupCount();
      U.$$('[data-by]', ctx.el).forEach(function (b) { b.classList.toggle('on', b.dataset.by === by); });
      U.$('#mix-num', ctx.el).textContent = num;
      U.$('#mix-unit', ctx.el).textContent = by === 'size' ? '명씩' : '조';
      U.$('#mix-preview', ctx.el).innerHTML = n ? '<b>' + n + '명</b> → <b>' + gc + '조</b> (' + sizesText(n, gc) + ')' + (st.members.some(function (m) { return m.is_leader; }) ? ' · 조장 ' + st.members.filter(function (m) { return m.is_leader; }).length + '명' : '') : '참가자를 기다리는 중…';
      var go = U.$('[data-go] span', ctx.el); if (go) go.textContent = (st.room.groups || []).length ? '다시 섞기' : '조 나누기!';
      var mj = U.$('[data-me-join]', ctx.el); if (mj) mj.innerHTML = st.meId ? icon('check') + '나도 참가 중' : icon('plus') + '나도 참가';
    }

    function drawAfter() {
      var box = U.$('#mix-after', ctx.el), r = st.room; if (!box) return;
      var as = assignedIds(r.groups), late = (r.groups || []).length ? st.members.filter(function (m) { return !as[sid(m.id)]; }) : [];
      box.innerHTML = (late.length ? '<button class="btn btn-sm" data-late>' + icon('plus') + '늦게 온 ' + late.length + '명 조에 넣기</button>' : '') +
        (r.status !== 'closed' ? '<button class="btn btn-sm btn-ghost" data-close-room>' + icon('check') + '조 나누기 끝내기</button>' : '<span class="chip">끝난 조 나누기</span>');
      var lb = U.$('[data-late]', box);
      if (lb) lb.onclick = async function () {
        try { await App.api.mix.update(r.id, { groups: addLate(r.groups, late) }); refresh(); U.toast(late.length + '명을 인원이 적은 조에 넣었어요.'); } catch (e) { U.toast(U.errMsg(e), 'error'); }
      };
      var cb = U.$('[data-close-room]', box);
      if (cb) cb.onclick = async function () {
        if (!(await U.confirm('조 나누기를 끝낼까요?\n더 이상 참가할 수 없고, 결과는 그대로 남아요.', '끝내기'))) return;
        try { await App.api.mix.update(r.id, { status: 'closed' }); refresh(); } catch (e) { U.toast(U.errMsg(e), 'error'); }
      };
    }

    function drawMine() {
      var box = U.$('#mix-mine', ctx.el); if (!box) return;
      var r = st.room, my = groupOf(r, st.meId), me = st.members.filter(function (m) { return sid(m.id) === sid(st.meId); })[0];
      if (!st.meId) {
        box.innerHTML = r.status === 'closed' ? '<div class="mix-wait"><p>이 조 나누기는 끝났어요.</p></div>' :
          '<div class="mix-wait mix-joincard"><p class="mix-big">' + esc(p ? p.name : '') + ' 님,<br>지금 여기 계신가요?</p><button class="btn btn-primary btn-block mix-join-btn" data-join>' + DICE + '참가하기</button></div>';
        var jb = U.$('[data-join]', box);
        if (jb) jb.onclick = async function () { U.busy(jb, true); try { await App.api.mix.join(r.id); await refresh(); } catch (e) { U.toast(U.errMsg(e), 'error'); U.busy(jb, false); } };
        return;
      }
      if (my) {
        var names = my.ids.filter(function (id) { return sid(id) !== sid(st.meId); }).map(nameOf).filter(Boolean);
        box.innerHTML = '<div class="mix-mycard" style="--c:' + my.color + '"><span class="mix-mycard-k">' + esc(me ? me.name : '') + ' 님은</span>' +
          '<b class="mix-mycard-g">' + esc(my.name) + '</b>' + (my.fruit ? '<span class="mix-mycard-f">' + esc(my.fruit) + '</span>' : '') +
          (names.length ? '<p class="mix-mycard-with">함께할 사람 · ' + names.map(esc).join(', ') + '</p>' : '') +
          '<button class="btn btn-sm mix-replay" data-replay>' + DICE + '다시 보기</button></div>';
        U.$('[data-replay]', box).onclick = function () { reveal(my); };
        return;
      }
      box.innerHTML = '<div class="mix-wait"><div class="mix-pulse">' + DICE + '</div><p class="mix-big">참가했어요!</p>' +
        '<p>' + ((r.groups || []).length ? '조가 이미 나뉘었어요. 방장이 늦게 온 사람을 넣으면 여기에 내 조가 떠요.' : '방장이 <b>조 나누기</b>를 누르면 여기에서 내 조가 공개돼요.') + '</p>' +
        '<p class="mix-dots"><span></span><span></span><span></span></p></div>';
    }

    function nameOf(id) { var m = st.members.filter(function (x) { return sid(x.id) === sid(id); })[0]; return m ? m.name : ''; }

    function drawResult(initial) {
      var box = U.$('#mix-result', ctx.el), r = st.room; if (!box) return;
      if (!(r.groups || []).length) { box.innerHTML = ''; box.dataset.round = ''; return; }
      var animate = box.dataset.round !== String(r.round) && !initial && st.role === 'host';
      box.dataset.round = r.round;
      var k = 0;
      box.innerHTML = '<h2 class="mix-h">조 나눔 결과</h2><div class="mix-groups">' + r.groups.map(function (g) {
        var mineG = g.ids.map(sid).indexOf(sid(st.meId)) >= 0;
        return '<div class="mix-g' + (mineG ? ' mine' : '') + '" style="--c:' + g.color + '"><div class="mix-g-h"><b>' + esc(g.name) + '</b>' + (g.fruit ? '<span>' + esc(g.fruit) + '</span>' : '') + '<small>' + g.ids.filter(nameOf).length + '명</small></div>' +
          '<ul>' + g.ids.map(function (id) {
            var nm = nameOf(id); if (!nm) return '';
            var lead = (g.leaders || []).map(sid).indexOf(sid(id)) >= 0, d = animate ? ' style="animation-delay:' + (k++ * 70) + 'ms"' : '';
            return '<li class="' + (animate ? 'fly' : '') + (sid(id) === sid(st.meId) ? ' is-me' : '') + '"' + d + '>' + (lead ? STAR : '') + esc(nm) + (sid(id) === sid(st.meId) ? ' (나)' : '') + '</li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div>';
      if (animate) confetti(U.$('.mix-groups', box));
    }

    /* ---------- 내 조 공개: 슬롯이 돌다가 멈춤 ---------- */
    function reveal(my) {
      closeOverlay();
      var gs = st.room.groups || [], meName = nameOf(st.meId);
      var ov = document.createElement('div'); ov.className = 'mix-ov'; ov.id = 'mix-ov';
      ov.innerHTML = '<div class="mix-ov-in"><p class="mix-ov-k">' + esc(meName) + ' 님의 조는…</p>' +
        '<div class="mix-slot"><div class="mix-slot-card"><b></b><span></span></div></div>' +
        '<p class="mix-ov-with"></p><button class="btn mix-ov-btn" data-ov-close>확인</button></div>';
      document.body.appendChild(ov);
      var card = U.$('.mix-slot-card', ov), b = U.$('b', card), s = U.$('span', card);
      function show(g) { card.style.setProperty('--c', g.color); b.textContent = g.name; s.textContent = g.fruit || ''; }
      var i = rnd(gs.length), delay = 55, total = 0;
      (function spin() {
        if (!document.body.contains(ov)) return;
        if (total > 2300 && delay > 260) {
          show(my); ov.classList.add('landed');
          var names = my.ids.filter(function (id) { return sid(id) !== sid(st.meId); }).map(nameOf).filter(Boolean);
          U.$('.mix-ov-with', ov).textContent = names.length ? '함께할 사람 · ' + names.join(', ') : '';
          try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) { }
          confetti(ov);
          return;
        }
        i = (i + 1) % gs.length; show(gs[i]);
        card.classList.remove('tick'); void card.offsetWidth; card.classList.add('tick');
        total += delay; delay = total > 1200 ? delay * 1.25 : delay * 1.04;
        setTimeout(spin, delay);
      })();
      U.$('[data-ov-close]', ov).onclick = closeOverlay;
    }
    function closeOverlay() { var o = document.getElementById('mix-ov'); if (o) o.remove(); }

    function confetti(host) {
      if (!host) return;
      var wrap = document.createElement('div'); wrap.className = 'mix-confetti';
      var colors = FRUITS.map(function (f) { return f[1]; });
      for (var c = 0; c < 46; c++) {
        var e = document.createElement('i');
        e.style.left = rnd(100) + '%'; e.style.background = colors[rnd(colors.length)];
        e.style.animationDelay = (rnd(400)) + 'ms'; e.style.animationDuration = (1400 + rnd(1200)) + 'ms';
        e.style.setProperty('--x', (rnd(160) - 80) + 'px'); e.style.setProperty('--r', (rnd(720) - 360) + 'deg');
        wrap.appendChild(e);
      }
      host.appendChild(wrap);
      setTimeout(function () { wrap.remove(); }, 3200);
    }

    /* ---------- 방문자(로그인 안 함) 참가 양식 ---------- */
    function drawGuestJoin() {
      ctx.el.innerHTML = App.pageHead('나눔 조 나누기', '이름만 적으면 바로 참가할 수 있어요') +
        '<section class="container narrow"><form class="card mix-codeform" id="mix-gj">' +
          '<label>참가 코드</label><div class="mix-codein mix-codefixed">' + esc(code) + '</div>' +
          '<input id="mix-gname" class="mix-namein" placeholder="내 이름" maxlength="20" autocomplete="off" value="' + esc(p ? p.name : '') + '" enterkeyhint="go">' +
          '<button class="btn btn-primary btn-block">' + DICE + '참가하기</button>' +
          (!p ? '<p class="muted small center">교회 앱 회원이라면 <a href="#/login">로그인</a>하고 참가해도 돼요.</p>' : '') +
        '</form></section>';
      var f = U.$('#mix-gj', ctx.el), ni = U.$('#mix-gname', ctx.el);
      if (window.innerWidth > 700) ni.focus();
      f.onsubmit = async function (e) {
        e.preventDefault(); var name = ni.value.trim();
        if (!name) { U.toast('이름을 적어 주세요.', 'error'); ni.focus(); return; }
        var b = f.querySelector('.btn-primary'); U.busy(b, true);
        try { var g = await App.api.mix.guestJoin(code, name); saveGuest(code, g); App.render(); }
        catch (err) { U.toast(U.errMsg(err), 'error'); U.busy(b, false); }
      };
    }
  }, { title: '조 나누기' });

})();
