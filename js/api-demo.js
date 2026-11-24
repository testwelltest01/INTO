/* =====================================================================
 * 데모 모드 데이터 레이어 — 브라우저 localStorage 에 저장
 *  config.js 에 Supabase 정보가 없을 때 자동으로 사용됩니다.
 *  (Supabase 모드와 동일한 함수 이름/동작을 흉내 냅니다)
 * ===================================================================== */
window.createDemoApi = function (DEFAULTS) {
  var KEY = 'into_demo_db_v3';
  var SKEY = 'into_demo_session_v1';
  var listeners = [];

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function now() { return new Date().toISOString(); }
  function hash(pw) { // 데모 전용(보안 목적 아님)
    var h = 0; pw = 'into:' + pw;
    for (var i = 0; i < pw.length; i++) { h = ((h << 5) - h + pw.charCodeAt(i)) | 0; }
    return 'h' + (h >>> 0).toString(36);
  }

  function seedDB() {
    var t = Date.now();
    var ago = function (days, hours) { return new Date(t - days * 864e5 - (hours || 0) * 36e5).toISOString(); };
    var thisSunday = U.sundayOf(new Date());
    var lastSunday = U.ymd(new Date(U.toDate(thisSunday).getTime() - 7 * 864e5));
    var db = {
      seq: { profiles: 10, notices: 10, weekly_questions: 10, answers: 10, qna: 10, inquiries: 10, photos: 100, scores: 1 },
      profiles: [
        { id: 'u-admin', email: 'admin@into.demo', pw: hash('into1234'), name: '관리자', phone: '010-0000-0000', role: 'admin', status: 'active', created_at: ago(30) },
        { id: 'u-member', email: 'member@into.demo', pw: hash('into1234'), name: '김인투', phone: '010-1234-5678', role: 'member', status: 'active', teams: ['worship'], created_at: ago(12) },
        { id: 'u-2', email: 'grace@into.demo', pw: hash('into1234'), name: '이은혜', phone: '', role: 'member', status: 'active', created_at: ago(8) },
        { id: 'u-3', email: 'hope@into.demo', pw: hash('into1234'), name: '박소망', phone: '010-2222-3333', role: 'member', status: 'pending', created_at: ago(1) }
      ],
      content: {},
      notices: [
        { id: 1, title: '인투처치 앱이 열렸어요', body: '홈 화면에 추가해서 앱처럼 사용해 보세요.\n매주 [이번 주 질문]에 나눔을 남기고, 궁금한 것은 [질문 게시판]에 올려 주세요.', image_url: '', link_url: '', pinned: true, published: true, created_at: ago(2) },
        { id: 2, title: '주일 예배 안내', body: '매주 주일 오후 2시 INTO WORSHIP, 오후 3시 INTO TABLE로 모입니다.\n장소: STEADFAST COFFEE & WORKS (성남시 분당구 판교공원로2길 22, 1층)', image_url: 'assets/photos/thumb/gallery-01.jpg', link_url: '', pinned: false, published: true, created_at: ago(5) }
      ],
      weekly_questions: [
        { id: 1, week_of: lastSunday, title: '말씀이 육신이 되어', sermon_title: '말씀이 육신이 되어', preacher: '김윤호 목사', scripture: '요한복음 1:14', scripture_text: '', body: '하나님은 멀리서 지켜보지 않으시고 우리 동네로 이사 오셨습니다.', questions: ['지난 한 주, 내 일상 속에서 하나님을 느꼈던 순간은 언제였나요?', '내가 "멀리서 지켜보기만" 하고 있는 관계가 있다면 어디일까요?'], application: '', prayer: '서로의 나눔을 듣고 한 사람씩 기도해 주세요.', image_url: '', attachment_url: '', attachment_name: '', publish_at: null, published: true, allow_anonymous: true, closed: false, created_at: ago(9) },
        { id: 2, week_of: thisSunday, title: '더 낮은 곳으로', sermon_title: '더 낮은 곳으로', preacher: '김윤호 목사', scripture: '빌립보서 2:6-8', scripture_text: '그는 근본 하나님의 본체시나 하나님과 동등됨을 취할 것으로 여기지 아니하시고 오히려 자기를 비워 종의 형체를 가지사 사람들과 같이 되셨고 사람의 모양으로 나타나사 자기를 낮추시고 죽기까지 복종하셨으니 곧 십자가에 죽으심이라 (개역한글)', body: '예수님은 높은 곳에 머물지 않고 가장 낮은 곳으로 들어오셨습니다. 복음은 언제나 아래로 흐릅니다.', questions: ['오늘 말씀에서 마음에 남은 한 구절은 무엇인가요? 왜 그 말씀이 남았나요?', '이번 주, 내가 "더 낮은 곳"으로 들어갈 수 있는 자리는 어디일까요?', '이번 한 주 실천할 한 가지를 나눠 주세요.'], application: '이번 주 내가 먼저 찾아갈 한 사람: ', prayer: '오른쪽에 앉은 사람을 위해 한 문장씩 기도해 주세요.', image_url: 'assets/photos/thumb/gallery-06.jpg', attachment_url: '', attachment_name: '', publish_at: null, published: true, allow_anonymous: true, closed: false, created_at: ago(1) },
        { id: 3, week_of: U.ymd(new Date(U.toDate(thisSunday).getTime() + 7 * 864e5)), title: '(예약) 다음 주 나눔지', sermon_title: '(예약) 다음 주 나눔지', preacher: '김윤호 목사', scripture: '', scripture_text: '', body: '', questions: [], application: '', prayer: '', image_url: '', attachment_url: '', attachment_name: '', publish_at: new Date(U.toDate(thisSunday).getTime() + 7 * 864e5 + 14 * 36e5).toISOString(), published: true, allow_anonymous: true, closed: false, created_at: ago(0, 1) }
      ],
      answers: [
        { id: 1, question_id: 1, user_id: 'u-2', author_name: '이은혜', body: '야근하고 들어오는 길에 동료가 건넨 따뜻한 커피 한 잔이요. 작은 친절 속에서 위로를 느꼈어요.', image_url: '', is_anonymous: false, created_at: ago(6) },
        { id: 2, question_id: 1, user_id: 'u-member', author_name: '익명', body: '아이를 재우고 혼자 식탁에 앉아 있던 밤, 오랜만에 기도가 나왔습니다.', image_url: '', is_anonymous: true, created_at: ago(5) },
        { id: 3, question_id: 2, question_no: 2, user_id: 'u-2', author_name: '이은혜', body: '회사에서 늘 혼자 점심 먹는 신입 동료에게 이번 주에는 먼저 말을 걸어 보려고 해요.', image_url: '', is_anonymous: false, created_at: ago(0, 5) }
      ],
      answer_likes: [{ answer_id: 1, user_id: 'u-member' }, { answer_id: 1, user_id: 'u-admin' }, { answer_id: 3, user_id: 'u-admin' }],
      qna: [
        { id: 1, user_id: 'u-member', author_name: '김인투', title: 'INTO TABLE은 처음 와도 참여할 수 있나요?', body: '예배 후에 모이는 INTO TABLE이 궁금합니다. 처음 방문한 사람도 함께해도 될까요?', image_url: '', is_private: false, reply: '물론입니다! 예배 후 오후 3시에 함께 식탁에 둘러앉아요. 처음 오신 분도 편하게 오시면 됩니다.', replied_at: ago(3), created_at: ago(4) },
        { id: 2, user_id: 'u-2', author_name: '이은혜', title: '개인적인 기도 제목이 있어요', body: '목사님께만 나누고 싶은 기도 제목입니다.', image_url: '', is_private: true, reply: null, replied_at: null, created_at: ago(1) }
      ],
      inquiries: [
        { id: 1, name: '홍길동', phone: '010-5555-6666', email: '', kind: '예배 참석', preferred_date: thisSunday, message: '판교에서 일하는 직장인인데 주일 예배에 참석해 보고 싶어요.', status: 'new', admin_memo: '', created_at: ago(0, 3) }
      ],
      scores: [],
      score_files: {},
      photos: DEFAULTS.photos.map(function (p, i) { var o = clone(p); o.id = i + 1; o.created_at = ago(20); return o; })
    };
    db.seq.photos = db.photos.length + 1;
    return db;
  }

  var db;
  function load() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db) { db = seedDB(); persist(); }
    return db;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { throw new Error('브라우저 저장 공간이 가득 찼어요. (데모 모드) 사진 수를 줄여 주세요.'); }
  }
  function nextId(t) { var d = load(); var id = d.seq[t] || 1; d.seq[t] = id + 1; return id; }
  function find(t, id) { return load()[t].filter(function (r) { return String(r.id) === String(id); })[0]; }

  function sessionId() { try { return localStorage.getItem(SKEY); } catch (e) { return null; } }
  function me() {
    var id = sessionId(); if (!id) return null;
    var p = find('profiles', id);
    if (!p || p.status === 'withdrawn') return null;
    return p;
  }
  function isAdmin() { var p = me(); return !!(p && p.role === 'admin' && p.status === 'active'); }
  function isMember() { var p = me(); return !!(p && p.status === 'active'); }
  function inTeam(t) { var p = me(); return !!(p && p.status === 'active' && (p.role === 'admin' || (p.teams || []).indexOf(t) >= 0)); }
  function needAdmin() { if (!isAdmin()) throw new Error('관리자만 할 수 있어요.'); }
  function needMember() {
    var p = me();
    if (!p) throw new Error('로그인이 필요해요.');
    if (p.status === 'pending') throw new Error('관리자 승인 후 이용할 수 있어요.');
    if (p.status !== 'active') throw new Error('이용이 제한된 계정이에요.');
    return p;
  }
  function publicProfile(p) { if (!p) return null; var o = clone(p); delete o.pw; return o; }
  function emit() { var s = sessionSnapshot(); listeners.forEach(function (cb) { try { cb(s); } catch (e) { } }); }
  function sessionSnapshot() { var p = me(); return p ? { user: { id: p.id, email: p.email }, profile: publicProfile(p) } : null; }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 60); }); }
  function byDesc(k) { return function (a, b) { return a[k] < b[k] ? 1 : a[k] > b[k] ? -1 : 0; }; }

  function thisSunday() { return U.sundayOf(new Date()); }

  var api = {
    mode: 'demo',

    auth: {
      current: function () { return delay(sessionSnapshot()); },
      onChange: function (cb) { listeners.push(cb); },
      signUp: async function (o) {
        var d = load();
        var email = (o.email || '').toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('이메일 형식을 확인해 주세요.');
        if ((o.password || '').length < 6) throw new Error('비밀번호는 6자 이상이어야 해요.');
        if (d.profiles.some(function (p) { return p.email === email; })) throw new Error('이미 가입된 이메일이에요.');
        var settings = (await api.content.getAll()).settings || {};
        var p = { id: 'u-' + U.uid(), email: email, pw: hash(o.password), name: o.name || email.split('@')[0], phone: o.phone || '', role: 'member', status: settings.require_approval ? 'pending' : 'active', created_at: now() };
        d.profiles.push(p); persist();
        localStorage.setItem(SKEY, p.id); emit();
        return { needsConfirm: false, profile: publicProfile(p) };
      },
      signIn: async function (email, password) {
        var d = load(); email = (email || '').toLowerCase();
        var p = d.profiles.filter(function (x) { return x.email === email; })[0];
        if (!p || p.pw !== hash(password)) throw new Error('이메일 또는 비밀번호가 맞지 않아요.');
        if (p.status === 'blocked') throw new Error('이용이 제한된 계정이에요. 관리자에게 문의해 주세요.');
        if (p.status === 'withdrawn') throw new Error('탈퇴한 계정이에요.');
        localStorage.setItem(SKEY, p.id); emit();
        return publicProfile(p);
      },
      signOut: async function () { localStorage.removeItem(SKEY); emit(); },
      resetPassword: async function () { throw new Error('데모 모드에서는 비밀번호 재설정 메일이 발송되지 않아요. (Supabase 연결 후 사용 가능)'); },
      updatePassword: async function (pw) {
        var p = me(); if (!p) throw new Error('로그인이 필요해요.');
        if ((pw || '').length < 6) throw new Error('비밀번호는 6자 이상이어야 해요.');
        p.pw = hash(pw); persist();
      }
    },

    profiles: {
      updateMe: async function (o) {
        var p = me(); if (!p) throw new Error('로그인이 필요해요.');
        if (o.name !== undefined) p.name = o.name;
        if (o.phone !== undefined) p.phone = o.phone;
        persist(); emit(); return publicProfile(p);
      },
      withdraw: async function () {
        var p = me(); if (!p) return;
        p.status = 'withdrawn'; p.name = '탈퇴한 회원'; p.phone = '';
        persist(); localStorage.removeItem(SKEY); emit();
      },
      list: async function () { needAdmin(); return load().profiles.map(publicProfile).sort(byDesc('created_at')); },
      update: async function (id, o) {
        needAdmin(); var p = find('profiles', id); if (!p) throw new Error('회원을 찾을 수 없어요.');
        ['name', 'phone', 'role', 'status', 'teams'].forEach(function (k) { if (o[k] !== undefined) p[k] = o[k]; });
        persist(); emit(); return publicProfile(p);
      },
      remove: async function (id) {
        needAdmin(); var d = load();
        d.profiles = d.profiles.filter(function (p) { return p.id !== id; });
        d.answers = d.answers.filter(function (a) { return a.user_id !== id; });
        d.qna = d.qna.filter(function (a) { return a.user_id !== id; });
        persist();
      }
    },

    content: {
      getAll: async function () {
        var d = load(), out = clone(DEFAULTS.content);
        Object.keys(d.content || {}).forEach(function (k) { out[k] = Object.assign({}, out[k] || {}, d.content[k]); });
        return out;
      },
      set: async function (key, value) { needAdmin(); load().content[key] = clone(value); persist(); }
    },

    notices: {
      list: async function (opt) {
        var all = opt && opt.all && isAdmin();
        return clone(load().notices.filter(function (n) { return all || n.published; })
          .sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1); }));
      },
      get: async function (id) { var n = find('notices', id); if (!n || (!n.published && !isAdmin())) throw new Error('글을 찾을 수 없어요.'); return clone(n); },
      save: async function (o) {
        needAdmin(); var d = load(), n;
        if (o.id) { n = find('notices', o.id); Object.assign(n, o, { updated_at: now() }); }
        else { n = Object.assign({ pinned: false, published: true, image_url: '', link_url: '' }, o, { id: nextId('notices'), created_at: now() }); d.notices.push(n); }
        persist(); return clone(n);
      },
      remove: async function (id) { needAdmin(); var d = load(); d.notices = d.notices.filter(function (n) { return String(n.id) !== String(id); }); persist(); }
    },

    questions: {
      list: async function (opt) {
        var all = opt && opt.all && isAdmin();
        return clone(load().weekly_questions.filter(function (q) { return all || U.isReleased(q); }).sort(byDesc('week_of')));
      },
      get: async function (id) { var q = find('weekly_questions', id); if (!q || (!U.isReleased(q) && !isAdmin())) throw new Error('나눔지를 찾을 수 없어요. (공개 전이거나 삭제됨)'); return clone(q); },
      current: async function () {
        var list = await api.questions.list();
        return list[0] || null;
      },
      save: async function (o) {
        needAdmin(); var d = load(), q;
        if (o.id) { q = find('weekly_questions', o.id); Object.assign(q, o, { updated_at: now() }); }
        else { q = Object.assign({ published: true, allow_anonymous: true, closed: false, body: '', scripture: '', image_url: '', questions: [] }, o, { id: nextId('weekly_questions'), created_at: now() }); d.weekly_questions.push(q); }
        persist(); return clone(q);
      },
      remove: async function (id) {
        needAdmin(); var d = load();
        d.weekly_questions = d.weekly_questions.filter(function (q) { return String(q.id) !== String(id); });
        var ids = d.answers.filter(function (a) { return String(a.question_id) === String(id); }).map(function (a) { return a.id; });
        d.answers = d.answers.filter(function (a) { return String(a.question_id) !== String(id); });
        d.answer_likes = d.answer_likes.filter(function (l) { return ids.indexOf(l.answer_id) < 0; });
        persist();
      }
    },

    answers: {
      listByQuestion: async function (qid) {
        if (!isMember()) return null; // null = 로그인 필요
        var d = load(), p = me(), admin = isAdmin();
        return d.answers.filter(function (a) { return String(a.question_id) === String(qid); })
          .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; })
          .map(function (a) {
            var o = clone(a);
            var likes = d.answer_likes.filter(function (l) { return l.answer_id === a.id; });
            o.like_count = likes.length;
            o.liked = likes.some(function (l) { return l.user_id === p.id; });
            o.mine = a.user_id === p.id;
            if (admin) { var au = find('profiles', a.user_id); o.real_name = au ? au.name : ''; }
            return o;
          });
      },
      listMine: async function () {
        var p = me(); if (!p) return [];
        var d = load();
        return d.answers.filter(function (a) { return a.user_id === p.id; }).sort(byDesc('created_at')).map(function (a) {
          var o = clone(a); var q = find('weekly_questions', a.question_id); o.question_title = q ? q.title : ''; o.week_of = q ? q.week_of : ''; return o;
        });
      },
      save: async function (o) {
        var p = needMember(), d = load(), a;
        var q = find('weekly_questions', o.question_id);
        if (!q || !U.isReleased(q)) throw new Error('아직 공개되지 않은 나눔지예요.');
        if (o.is_anonymous && !q.allow_anonymous) o.is_anonymous = false;
        if (o.id) {
          a = find('answers', o.id);
          if (!a || (a.user_id !== p.id && !isAdmin())) throw new Error('수정 권한이 없어요.');
          a.body = o.body; a.image_url = o.image_url || ''; a.is_anonymous = !!o.is_anonymous; a.question_no = o.question_no || null; a.updated_at = now();
        } else {
          if (q.closed) throw new Error('나눔이 마감된 질문이에요.');
          a = { id: nextId('answers'), question_id: q.id, question_no: o.question_no || null, user_id: p.id, body: o.body, image_url: o.image_url || '', is_anonymous: !!o.is_anonymous, created_at: now() };
          d.answers.push(a);
        }
        var au = find('profiles', a.user_id);
        a.author_name = a.is_anonymous ? '익명' : (au ? au.name : '');
        persist(); return clone(a);
      },
      remove: async function (id) {
        var p = me(), a = find('answers', id);
        if (!a || !p || (a.user_id !== p.id && !isAdmin())) throw new Error('삭제 권한이 없어요.');
        var d = load();
        d.answers = d.answers.filter(function (x) { return x.id !== a.id; });
        d.answer_likes = d.answer_likes.filter(function (l) { return l.answer_id !== a.id; });
        persist();
      },
      toggleLike: async function (id) {
        var p = needMember(), d = load(); id = +id;
        var has = d.answer_likes.some(function (l) { return l.answer_id === id && l.user_id === p.id; });
        if (has) d.answer_likes = d.answer_likes.filter(function (l) { return !(l.answer_id === id && l.user_id === p.id); });
        else d.answer_likes.push({ answer_id: id, user_id: p.id });
        persist(); return !has;
      },
      counts: async function () {
        needAdmin(); var c = {};
        load().answers.forEach(function (a) { c[a.question_id] = (c[a.question_id] || 0) + 1; });
        return c;
      }
    },

    qna: {
      list: async function () {
        var p = me(), admin = isAdmin(), member = isMember();
        if (!p) return null;
        return clone(load().qna.filter(function (q) { return admin || q.user_id === p.id || (!q.is_private && member); }).sort(byDesc('created_at')))
          .map(function (q) { q.mine = q.user_id === p.id; return q; });
      },
      get: async function (id) {
        var p = me(), q = find('qna', id);
        if (!q || !p) throw new Error('글을 찾을 수 없어요.');
        if (!(isAdmin() || q.user_id === p.id || (!q.is_private && isMember()))) throw new Error('비공개 글이에요.');
        var o = clone(q); o.mine = q.user_id === p.id; return o;
      },
      listMine: async function () { var p = me(); if (!p) return []; return clone(load().qna.filter(function (q) { return q.user_id === p.id; }).sort(byDesc('created_at'))); },
      save: async function (o) {
        var p = needMember(), d = load(), q;
        if (o.id) {
          q = find('qna', o.id);
          if (!q || (q.user_id !== p.id && !isAdmin())) throw new Error('수정 권한이 없어요.');
          q.title = o.title; q.body = o.body; q.is_private = !!o.is_private; q.image_url = o.image_url || ''; q.updated_at = now();
        } else {
          q = { id: nextId('qna'), user_id: p.id, author_name: p.name, title: o.title, body: o.body, image_url: o.image_url || '', is_private: !!o.is_private, reply: null, replied_at: null, created_at: now() };
          d.qna.push(q);
        }
        persist(); return clone(q);
      },
      reply: async function (id, text) {
        needAdmin(); var q = find('qna', id);
        q.reply = text || null; q.replied_at = text ? now() : null; persist(); return clone(q);
      },
      remove: async function (id) {
        var p = me(), q = find('qna', id);
        if (!q || !p || (q.user_id !== p.id && !isAdmin())) throw new Error('삭제 권한이 없어요.');
        var d = load(); d.qna = d.qna.filter(function (x) { return x.id !== q.id; }); persist();
      }
    },

    inquiries: {
      create: async function (o) {
        if (!o.name) throw new Error('이름을 입력해 주세요.');
        var d = load();
        var r = { id: nextId('inquiries'), name: o.name, phone: o.phone || '', email: o.email || '', kind: o.kind || '예배 참석', preferred_date: o.preferred_date || null, message: o.message || '', status: 'new', admin_memo: '', created_at: now() };
        d.inquiries.push(r); persist(); return { id: r.id };
      },
      list: async function () { needAdmin(); return clone(load().inquiries.sort(byDesc('created_at'))); },
      update: async function (id, o) { needAdmin(); var r = find('inquiries', id); Object.assign(r, o, { updated_at: now() }); persist(); return clone(r); },
      remove: async function (id) { needAdmin(); var d = load(); d.inquiries = d.inquiries.filter(function (r) { return String(r.id) !== String(id); }); persist(); }
    },

    photos: {
      list: async function () { return clone(load().photos.sort(function (a, b) { return (b.sort || 0) - (a.sort || 0) || (a.created_at < b.created_at ? 1 : -1); })); },
      add: async function (o) {
        needAdmin(); var d = load();
        var maxSort = d.photos.reduce(function (m, p) { return Math.max(m, p.sort || 0); }, 0);
        var p = Object.assign({ caption: '', tag: '', thumb_url: '' }, o, { id: nextId('photos'), sort: maxSort + 1, created_at: now() });
        d.photos.push(p); persist(); return clone(p);
      },
      update: async function (id, o) { needAdmin(); var p = find('photos', id); Object.assign(p, o); persist(); return clone(p); },
      remove: async function (id) { needAdmin(); var d = load(); d.photos = d.photos.filter(function (p) { return String(p.id) !== String(id); }); persist(); }
    },

    storage: {
      uploadFile: async function (file) {
        needAdmin();
        if (file.size > 2.5 * 1024 * 1024) throw new Error('데모 모드에서는 2.5MB 이하 파일만 올릴 수 있어요. (실제 운영에서는 10MB까지)');
        return U.blobToDataURL(file);
      },
      // 데모: 이미지를 작게 줄여 dataURL 로 저장
      upload: async function (blob) {
        needAdmin();
        var small = blob.size > 350000 ? await U.resizeImage(new File([blob], 'x.jpg', { type: 'image/jpeg' }), 1000, 0.72) : blob;
        return U.blobToDataURL(small);
      }
    },

    scores: {
      list: async function () {
        if (!inTeam('worship')) return [];
        return clone((load().scores || []).slice().sort(function (a, b) {
          var da = a.worship_date || '', db2 = b.worship_date || '';
          if (da !== db2) return !da ? 1 : !db2 ? -1 : (da < db2 ? 1 : -1);
          return (a.sort_order || 0) - (b.sort_order || 0) || (a.title < b.title ? -1 : 1);
        }));
      },
      get: async function (id) { if (!inTeam('worship')) throw new Error('찬양팀만 볼 수 있어요.'); var r = find('scores', id); if (!r) throw new Error('악보를 찾을 수 없어요.'); return clone(r); },
      save: async function (o) {
        needAdmin(); var d = load(); d.scores = d.scores || []; var r;
        if (o.id) { r = find('scores', o.id); Object.assign(r, o, { updated_at: now() }); }
        else { r = Object.assign({ sort_order: 0 }, o, { id: nextId('scores'), created_at: now() }); d.scores.push(r); }
        persist(); return clone(r);
      },
      remove: async function (id) {
        needAdmin(); var d = load(), r = find('scores', id);
        d.scores = d.scores.filter(function (x) { return String(x.id) !== String(id); });
        if (r && d.score_files) delete d.score_files[r.file_path];
        persist();
      },
      uploadFile: async function (file) {
        needAdmin();
        if (file.size > 2.5 * 1024 * 1024) throw new Error('데모 모드에서는 2.5MB 이하 PDF만 올릴 수 있어요. (실제 운영에서는 30MB까지)');
        var d = load(); d.score_files = d.score_files || {};
        var path = 'demo/' + U.uid() + '.pdf';
        d.score_files[path] = await U.blobToDataURL(file); persist();
        return { path: path, size: file.size, name: file.name };
      },
      removeFile: async function (path) { var d = load(); if (d.score_files) { delete d.score_files[path]; persist(); } },
      fetchFile: async function (row) {
        if (!inTeam('worship')) throw new Error('찬양팀만 볼 수 있어요.');
        var url = (load().score_files || {})[row.file_path]; if (!url) throw new Error('파일을 찾을 수 없어요.');
        var b64 = url.split(',')[1], bin = atob(b64), buf = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
      }
    },

    stats: async function () {
      needAdmin(); var d = load(), wk = Date.now() - 7 * 864e5;
      var cur = await api.questions.current();
      return {
        members: d.profiles.filter(function (p) { return p.status !== 'withdrawn'; }).length,
        pending: d.profiles.filter(function (p) { return p.status === 'pending'; }).length,
        newMembers: d.profiles.filter(function (p) { return new Date(p.created_at).getTime() > wk; }).length,
        inquiriesNew: d.inquiries.filter(function (r) { return r.status === 'new'; }).length,
        qnaWaiting: d.qna.filter(function (q) { return !q.reply; }).length,
        currentQuestion: cur,
        currentAnswers: cur ? d.answers.filter(function (a) { return a.question_id === cur.id; }).length : 0
      };
    },

    resetDemo: function () { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); db = null; }
  };
  return api;
};
