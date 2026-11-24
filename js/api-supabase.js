/* =====================================================================
 * Supabase 모드 데이터 레이어
 *  config.js 의 SUPABASE_URL / SUPABASE_ANON_KEY 가 채워지면 사용됩니다.
 *  권한은 supabase/schema.sql 의 RLS 정책이 서버에서 강제합니다.
 * ===================================================================== */
window.createSupabaseApi = function (DEFAULTS, cfg) {
  var sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  var BUCKET = 'media';
  var state = { profile: null, user: null };
  var listeners = [];

  function ok(res) { if (res.error) throw res.error; return res.data; }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k] === '' && /_url$|_date$|_at$/.test(k) ? null : o[k]; }); return r; }
  function redirectURL() { return location.origin + location.pathname; }
  function thisSunday() { return U.sundayOf(new Date()); }
  function isAdmin() { return !!(state.profile && state.profile.role === 'admin' && state.profile.status === 'active'); }
  function isMember() { return !!(state.profile && state.profile.status === 'active'); }
  function needMember() {
    if (!state.user) throw new Error('로그인이 필요해요.');
    if (state.profile && state.profile.status === 'pending') throw new Error('관리자 승인 후 이용할 수 있어요.');
    if (!isMember()) throw new Error('이용이 제한된 계정이에요.');
  }

  async function snapshot() {
    var s = ok(await sb.auth.getSession()).session;
    if (!s) { state.user = null; state.profile = null; return null; }
    state.user = s.user;
    var p = ok(await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle());
    if (!p || p.status === 'withdrawn') {
      await sb.auth.signOut(); state.user = null; state.profile = null; return null;
    }
    state.profile = p;
    return { user: { id: s.user.id, email: s.user.email }, profile: p };
  }

  sb.auth.onAuthStateChange(function (event) {
    // supabase-js 권고: 콜백 안에서 바로 다른 호출을 하지 않고 다음 틱으로 미룸
    setTimeout(async function () {
      var snap = null;
      try { snap = await snapshot(); } catch (e) { }
      listeners.forEach(function (cb) { try { cb(snap, event); } catch (e) { } });
    }, 0);
  });

  var FIELDS = {
    notices: ['title', 'body', 'image_url', 'link_url', 'pinned', 'published'],
    weekly_questions: ['week_of', 'title', 'body', 'scripture', 'image_url', 'published', 'allow_anonymous', 'closed',
      'sermon_title', 'preacher', 'scripture_text', 'questions', 'application', 'prayer', 'attachment_url', 'attachment_name', 'publish_at'],
    inquiries: ['name', 'phone', 'email', 'kind', 'preferred_date', 'message'],
    photos: ['url', 'thumb_url', 'caption', 'tag', 'sort'],
    scores: ['title', 'artist', 'song_key', 'memo', 'worship_date', 'sort_order', 'file_path', 'file_name', 'file_size', 'page_count', 'pages', 'youtube_url'],
    setlists: ['worship_date', 'title', 'memo', 'items']
  };

  async function saveRow(table, o) {
    var row = pick(o, FIELDS[table]);
    if (o.id) return ok(await sb.from(table).update(row).eq('id', o.id).select().single());
    return ok(await sb.from(table).insert(row).select().single());
  }

  var api = {
    mode: 'supabase',
    client: sb,

    auth: {
      current: snapshot,
      onChange: function (cb) { listeners.push(cb); },
      signUp: async function (o) {
        var data = ok(await sb.auth.signUp({
          email: o.email, password: o.password,
          options: { data: { name: o.name, phone: o.phone || null }, emailRedirectTo: redirectURL() }
        }));
        if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('이미 가입된 이메일이에요.');
        if (!data.session) return { needsConfirm: true };
        return { needsConfirm: false, profile: (await snapshot() || {}).profile };
      },
      signIn: async function (email, password) {
        ok(await sb.auth.signInWithPassword({ email: email, password: password }));
        var p = ok(await sb.from('profiles').select('*').eq('id', (await sb.auth.getUser()).data.user.id).maybeSingle());
        if (!p) { await sb.auth.signOut(); throw new Error('회원 정보를 찾을 수 없어요. 관리자에게 문의해 주세요.'); }
        if (p.status === 'blocked') { await sb.auth.signOut(); throw new Error('이용이 제한된 계정이에요. 관리자에게 문의해 주세요.'); }
        if (p.status === 'withdrawn') { await sb.auth.signOut(); throw new Error('탈퇴한 계정이에요.'); }
        state.profile = p;
        return p;
      },
      signOut: async function () { await sb.auth.signOut(); state.user = null; state.profile = null; },
      resetPassword: async function (email) {
        ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectURL() }));
      },
      updatePassword: async function (pw) { ok(await sb.auth.updateUser({ password: pw })); }
    },

    profiles: {
      updateMe: async function (o) {
        if (!state.user) throw new Error('로그인이 필요해요.');
        var p = ok(await sb.from('profiles').update(pick(o, ['name', 'phone'])).eq('id', state.user.id).select().single());
        state.profile = p; return p;
      },
      withdraw: async function () {
        if (!state.user) return;
        ok(await sb.from('profiles').update({ status: 'withdrawn', name: '탈퇴한 회원', phone: null }).eq('id', state.user.id));
        await api.auth.signOut();
      },
      list: async function () { return ok(await sb.from('profiles').select('*').order('created_at', { ascending: false })); },
      update: async function (id, o) { return ok(await sb.from('profiles').update(pick(o, ['name', 'phone', 'role', 'status', 'teams'])).eq('id', id).select().single()); },
      remove: async function (id) { ok(await sb.from('profiles').delete().eq('id', id)); }
    },

    content: {
      getAll: async function () {
        var rows = [];
        try { rows = ok(await sb.from('site_content').select('key,value')); } catch (e) { console.warn(e); }
        var out = JSON.parse(JSON.stringify(DEFAULTS.content));
        rows.forEach(function (r) { out[r.key] = Object.assign({}, out[r.key] || {}, r.value || {}); });
        return out;
      },
      set: async function (key, value) { ok(await sb.from('site_content').upsert({ key: key, value: value })); }
    },

    notices: {
      list: async function (opt) {
        var q = sb.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
        if (!(opt && opt.all)) q = q.eq('published', true);
        return ok(await q);
      },
      get: async function (id) {
        var n = ok(await sb.from('notices').select('*').eq('id', id).maybeSingle());
        if (!n) throw new Error('글을 찾을 수 없어요.'); return n;
      },
      save: function (o) { return saveRow('notices', o); },
      remove: async function (id) { ok(await sb.from('notices').delete().eq('id', id)); }
    },

    questions: {
      list: async function (opt) {
        var q = sb.from('weekly_questions').select('*').order('week_of', { ascending: false });
        if (opt && opt.all) return ok(await q);
        // 공개 시점은 DB 정책(RLS)이 막고, 화면에서도 한 번 더 걸러 줌
        return ok(await q.eq('published', true)).filter(U.isReleased);
      },
      get: async function (id) {
        var q = ok(await sb.from('weekly_questions').select('*').eq('id', id).maybeSingle());
        if (!q) throw new Error('나눔지를 찾을 수 없어요. (공개 전이거나 삭제됨)'); return q;
      },
      current: async function () {
        var rows = ok(await sb.from('weekly_questions').select('*').eq('published', true).order('week_of', { ascending: false }).limit(4));
        return rows.filter(U.isReleased)[0] || null;
      },
      save: function (o) { return saveRow('weekly_questions', o); },
      remove: async function (id) { ok(await sb.from('weekly_questions').delete().eq('id', id)); }
    },

    answers: {
      listByQuestion: async function (qid) {
        if (!isMember()) return null;
        var rows = ok(await sb.from('answers').select('*').eq('question_id', qid).order('created_at', { ascending: true }));
        var ids = rows.map(function (a) { return a.id; });
        var likes = ids.length ? ok(await sb.from('answer_likes').select('answer_id,user_id').in('answer_id', ids)) : [];
        var names = {};
        if (isAdmin() && rows.length) {
          var uids = rows.map(function (a) { return a.user_id; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
          ok(await sb.from('profiles').select('id,name').in('id', uids)).forEach(function (p) { names[p.id] = p.name; });
        }
        var uid = state.user && state.user.id;
        return rows.map(function (a) {
          var mine = likes.filter(function (l) { return l.answer_id === a.id; });
          a.like_count = mine.length;
          a.liked = mine.some(function (l) { return l.user_id === uid; });
          a.mine = a.user_id === uid;
          if (isAdmin()) a.real_name = names[a.user_id] || '';
          return a;
        });
      },
      listMine: async function () {
        if (!state.user) return [];
        var rows = ok(await sb.from('answers').select('*, weekly_questions(title, week_of)').eq('user_id', state.user.id).order('created_at', { ascending: false }));
        return rows.map(function (a) { var q = a.weekly_questions || {}; a.question_title = q.title; a.week_of = q.week_of; return a; });
      },
      save: async function (o) {
        needMember();
        var row = { body: o.body, image_url: o.image_url || null, is_anonymous: !!o.is_anonymous, question_no: o.question_no || null };
        if (o.id) return ok(await sb.from('answers').update(row).eq('id', o.id).select().single());
        row.question_id = o.question_id; row.user_id = state.user.id;
        return ok(await sb.from('answers').insert(row).select().single());
      },
      remove: async function (id) { ok(await sb.from('answers').delete().eq('id', id)); },
      toggleLike: async function (id) {
        needMember();
        var uid = state.user.id;
        var has = ok(await sb.from('answer_likes').select('answer_id').eq('answer_id', id).eq('user_id', uid)).length > 0;
        if (has) ok(await sb.from('answer_likes').delete().eq('answer_id', id).eq('user_id', uid));
        else ok(await sb.from('answer_likes').insert({ answer_id: id, user_id: uid }));
        return !has;
      },
      counts: async function () {
        var c = {};
        ok(await sb.from('answers').select('question_id')).forEach(function (a) { c[a.question_id] = (c[a.question_id] || 0) + 1; });
        return c;
      }
    },

    qna: {
      list: async function () {
        if (!state.user) return null;
        var uid = state.user.id;
        return ok(await sb.from('qna').select('*').order('created_at', { ascending: false })).map(function (q) { q.mine = q.user_id === uid; return q; });
      },
      get: async function (id) {
        var q = ok(await sb.from('qna').select('*').eq('id', id).maybeSingle());
        if (!q) throw new Error('글을 찾을 수 없거나 비공개 글이에요.');
        q.mine = state.user && q.user_id === state.user.id; return q;
      },
      listMine: async function () {
        if (!state.user) return [];
        return ok(await sb.from('qna').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }));
      },
      save: async function (o) {
        needMember();
        var row = { title: o.title, body: o.body, is_private: !!o.is_private, image_url: o.image_url || null };
        if (o.id) return ok(await sb.from('qna').update(row).eq('id', o.id).select().single());
        row.user_id = state.user.id;
        return ok(await sb.from('qna').insert(row).select().single());
      },
      reply: async function (id, text) { return ok(await sb.from('qna').update({ reply: text || null }).eq('id', id).select().single()); },
      remove: async function (id) { ok(await sb.from('qna').delete().eq('id', id)); }
    },

    inquiries: {
      // 비로그인 사용자는 select 권한이 없으므로 결과를 돌려받지 않는 insert 사용
      create: async function (o) { ok(await sb.from('inquiries').insert(pick(o, FIELDS.inquiries))); return {}; },
      list: async function () { return ok(await sb.from('inquiries').select('*').order('created_at', { ascending: false })); },
      update: async function (id, o) { return ok(await sb.from('inquiries').update(pick(o, ['status', 'admin_memo'])).eq('id', id).select().single()); },
      remove: async function (id) { ok(await sb.from('inquiries').delete().eq('id', id)); }
    },

    photos: {
      list: async function () { return ok(await sb.from('photos').select('*').order('sort', { ascending: false }).order('created_at', { ascending: false })); },
      add: async function (o) {
        var top = ok(await sb.from('photos').select('sort').order('sort', { ascending: false }).limit(1));
        o.sort = ((top[0] && top[0].sort) || 0) + 1;
        return ok(await sb.from('photos').insert(pick(o, FIELDS.photos)).select().single());
      },
      update: async function (id, o) { return ok(await sb.from('photos').update(pick(o, ['caption', 'tag', 'sort'])).eq('id', id).select().single()); },
      remove: async function (id) {
        var p = ok(await sb.from('photos').select('url,thumb_url').eq('id', id).maybeSingle());
        ok(await sb.from('photos').delete().eq('id', id));
        var mark = '/storage/v1/object/public/' + BUCKET + '/';
        var paths = [p && p.url, p && p.thumb_url].filter(function (u) { return u && u.indexOf(mark) >= 0; })
          .map(function (u) { return decodeURIComponent(u.split(mark)[1].split('?')[0]); });
        if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      }
    },

    storage: {
      // PDF 등 일반 파일 (최대 10MB)
      uploadFile: async function (file, folder) {
        if (!isAdmin()) throw new Error('파일은 관리자만 올릴 수 있어요.');
        if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하 파일만 올릴 수 있어요.');
        var ext = ((file.name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin';
        var name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        var path = isAdmin() ? 'admin/' + (folder || 'files') + '/' + name : 'members/' + state.user.id + '/' + name;
        ok(await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', cacheControl: '31536000', upsert: false }));
        return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      },
      upload: async function (blob, folder) {
        if (!isAdmin()) throw new Error('사진은 관리자만 올릴 수 있어요.');
        var name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        var path = isAdmin() ? 'admin/' + (folder || 'misc') + '/' + name : 'members/' + state.user.id + '/' + name;
        ok(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000', upsert: false }));
        return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
    },

    // 찬양팀 악보 (비공개 버킷 'scores') — PDF 원본 또는 페이지 이미지 목록
    scores: {
      list: async function () {
        return ok(await sb.from('scores').select('*').order('title', { ascending: true }));
      },
      get: async function (id) {
        var r = ok(await sb.from('scores').select('*').eq('id', id).maybeSingle());
        if (!r) throw new Error('악보를 찾을 수 없어요. (찬양팀만 볼 수 있어요)'); return r;
      },
      save: function (o) { return saveRow('scores', o); },
      remove: async function (id) {
        var r = ok(await sb.from('scores').select('file_path, pages').eq('id', id).maybeSingle());
        ok(await sb.from('scores').delete().eq('id', id));   // 콘티에서는 DB 트리거가 자동으로 빼 줌
        var paths = r ? [r.file_path].concat(r.pages || []).filter(Boolean) : [];
        if (paths.length) await sb.storage.from('scores').remove(paths);
      },
      uploadFile: async function (file) {
        if (!isAdmin()) throw new Error('악보는 관리자만 올릴 수 있어요.');
        if (file.size > 30 * 1024 * 1024) throw new Error('30MB 이하 PDF만 올릴 수 있어요.');
        var d = new Date(), path = d.getFullYear() + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.pdf';
        ok(await sb.storage.from('scores').upload(path, file, { contentType: 'application/pdf', cacheControl: '3600', upsert: false }));
        return { path: path, size: file.size, name: file.name };
      },
      uploadImage: async function (blob, path) {
        if (!isAdmin()) throw new Error('악보는 관리자만 올릴 수 있어요.');
        ok(await sb.storage.from('scores').upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000', upsert: false }));
        return path;
      },
      removeFiles: async function (paths) { paths = (paths || []).filter(Boolean); if (paths.length) await sb.storage.from('scores').remove(paths); },
      removeFile: async function (path) { if (path) await sb.storage.from('scores').remove([path]); },
      fetchBlob: async function (path) { return ok(await sb.storage.from('scores').download(path)); },
      fetchFile: async function (row) { return (await api.scores.fetchBlob(row.file_path)).arrayBuffer(); }
    },

    // 콘티: 날짜별 곡 순서 (items = [{score_id, key, memo}])
    setlists: {
      list: async function () {
        return ok(await sb.from('setlists').select('*').order('worship_date', { ascending: false }).order('id', { ascending: false }));
      },
      get: async function (id) {
        var r = ok(await sb.from('setlists').select('*').eq('id', id).maybeSingle());
        if (!r) throw new Error('콘티를 찾을 수 없어요. (찬양팀만 볼 수 있어요)'); return r;
      },
      save: function (o) {
        if (!o.id && !o.worship_date) return Promise.reject(new Error('콘티 날짜를 정해 주세요.'));
        return saveRow('setlists', o);
      },
      remove: async function (id) { ok(await sb.from('setlists').delete().eq('id', id)); }
    },

    stats: async function () {
      function cnt(q) { return q.then(function (r) { if (r.error) throw r.error; return r.count || 0; }); }
      var wk = new Date(Date.now() - 7 * 864e5).toISOString();
      var cur = await api.questions.current();
      var res = await Promise.all([
        cnt(sb.from('profiles').select('id', { count: 'exact', head: true }).neq('status', 'withdrawn')),
        cnt(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
        cnt(sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', wk)),
        cnt(sb.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new')),
        cnt(sb.from('qna').select('id', { count: 'exact', head: true }).is('reply', null)),
        cur ? cnt(sb.from('answers').select('id', { count: 'exact', head: true }).eq('question_id', cur.id)) : Promise.resolve(0)
      ]);
      return { members: res[0], pending: res[1], newMembers: res[2], inquiriesNew: res[3], qnaWaiting: res[4], currentQuestion: cur, currentAnswers: res[5] };
    }
  };
  return api;
};
