/* 공통 유틸리티 */
(function () {
  var U = {};

  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  U.esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.attr = U.esc;

  // 줄바꿈 유지 + URL 자동 링크
  U.text = function (s) {
    var html = U.esc(s || '');
    html = html.replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>';
    });
    return html.replace(/\n/g, '<br>');
  };

  U.pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  U.toDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { var p = v.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    return new Date(v);
  };

  U.ymd = function (d) {
    d = U.toDate(d) || new Date();
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  };

  U.fmtDate = function (v, withTime) {
    var d = U.toDate(v); if (!d || isNaN(d)) return '';
    var s = d.getFullYear() + '.' + U.pad(d.getMonth() + 1) + '.' + U.pad(d.getDate());
    if (withTime) s += ' ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
    return s;
  };

  U.fmtRel = function (v) {
    var d = U.toDate(v); if (!d) return '';
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + '일 전';
    return U.fmtDate(d);
  };

  // 해당 날짜가 속한 주의 '주일(일요일)' — 일요일이면 그날, 아니면 다가오는 일요일
  U.sundayOf = function (d) {
    d = U.toDate(d) || new Date();
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var add = (7 - x.getDay()) % 7;
    x.setDate(x.getDate() + add);
    return U.ymd(x);
  };
  U.weekLabel = function (weekOf) {
    var d = U.toDate(weekOf); if (!d) return '';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 주일';
  };

  U.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };

  U.debounce = function (fn, ms) {
    var t; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); };
  };

  /* ---------- 토스트 ---------- */
  U.toast = function (msg, type) {
    var box = U.$('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { el.remove(); }, 3100);
  };

  /* ---------- 모달 ---------- */
  U.modal = function (opts) {
    // opts: {title, html, wide, onMount(root, close)}
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'modal-wrap';
      wrap.innerHTML =
        '<div class="modal' + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
        (opts.title ? '<div class="modal-head"><h3>' + U.esc(opts.title) + '</h3><button class="icon-btn" data-close aria-label="닫기">' + U.icon('close') + '</button></div>' : '') +
        '<div class="modal-body">' + (opts.html || '') + '</div></div>';
      document.body.appendChild(wrap);
      document.body.classList.add('no-scroll');
      requestAnimationFrame(function () { wrap.classList.add('show'); });
      function close(val) {
        wrap.classList.remove('show');
        document.body.classList.remove('no-scroll');
        setTimeout(function () { wrap.remove(); }, 200);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      }
      function onKey(e) { if (e.key === 'Escape') close(null); }
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap || e.target.closest('[data-close]')) close(null);
      });
      if (opts.onMount) opts.onMount(wrap.querySelector('.modal'), close);
    });
  };

  U.confirm = function (msg, okLabel, danger) {
    return U.modal({
      title: '확인',
      html: '<p class="confirm-msg">' + U.text(msg) + '</p><div class="modal-actions"><button class="btn btn-ghost" data-close>취소</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + U.esc(okLabel || '확인') + '</button></div>',
      onMount: function (root, close) { root.querySelector('[data-ok]').onclick = function () { close(true); }; }
    }).then(function (v) { return v === true; });
  };

  U.lightbox = function (urls, index) {
    var i = index || 0;
    U.modal({
      wide: true,
      html: '<div class="lightbox"><img alt=""><button class="lb-prev" aria-label="이전">' + U.icon('chevron-left') + '</button><button class="lb-next" aria-label="다음">' + U.icon('chevron-right') + '</button><button class="lb-close icon-btn" data-close aria-label="닫기">' + U.icon('close') + '</button><div class="lb-count"></div></div>',
      onMount: function (root) {
        root.classList.add('modal-lightbox');
        var img = root.querySelector('img'), cnt = root.querySelector('.lb-count');
        function show() { img.src = urls[i]; cnt.textContent = (i + 1) + ' / ' + urls.length; }
        root.querySelector('.lb-prev').onclick = function () { i = (i - 1 + urls.length) % urls.length; show(); };
        root.querySelector('.lb-next').onclick = function () { i = (i + 1) % urls.length; show(); };
        var sx = null;
        img.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
        img.addEventListener('touchend', function (e) {
          if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
          if (Math.abs(dx) > 40) { i = (i + (dx < 0 ? 1 : -1) + urls.length) % urls.length; show(); }
        });
        show();
      }
    });
  };

  /* ---------- 이미지: 업로드 전 리사이즈 ---------- */
  U.resizeImage = function (file, maxSide, quality) {
    maxSide = maxSide || 1600; quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('이미지 파일만 올릴 수 있어요.'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, maxSide / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('이미지 변환 실패')); }, 'image/jpeg', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요.')); };
      img.src = url;
    });
  };

  U.blobToDataURL = function (blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = reject; r.readAsDataURL(blob);
    });
  };

  /* ---------- CSV 내보내기 (엑셀 한글 깨짐 방지 BOM 포함) ---------- */
  U.downloadCSV = function (filename, headers, rows) {
    function cell(v) {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return /[",\n\r]/.test(v) ? '"' + v + '"' : v;
    }
    var lines = [headers.map(cell).join(',')].concat(rows.map(function (r) { return r.map(cell).join(','); }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  U.formData = function (form) {
    var o = {};
    U.$$('input, textarea, select', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else if (el.type === 'file') { /* skip */ }
      else o[el.name] = el.value.trim();
    });
    return o;
  };

  U.busy = function (btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  };

  U.errMsg = function (e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || '오류가 발생했어요.');
    var map = {
      'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요.',
      'Email not confirmed': '이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해 주세요.',
      'User already registered': '이미 가입된 이메일이에요.',
      'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 해요.',
      'new row violates row-level security policy': '권한이 없어요. (로그인/승인 상태를 확인해 주세요)'
    };
    for (var k in map) if (m.indexOf(k) >= 0) return map[k];
    return m;
  };

  /* ---------- 아이콘 (인라인 SVG) ---------- */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z"/><path d="M17 8h3v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>',
    question: '<path d="M21 12a8.5 8.5 0 0 1-12.5 7.5L3 21l1.6-5A8.5 8.5 0 1 1 21 12z"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    heart: '<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    map: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    'chevron-right': '<path d="m9 5 7 7-7 7"/>',
    'chevron-left': '<path d="m15 5-7 7 7 7"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    pin: '<path d="M9 4h6l-1 6 4 4H6l4-4-1-6z"/><path d="M12 14v7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/>',
    table: '<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    letter: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    install: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h14"/>'
  };
  U.icon = function (name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };
  U.markSVG = function (cls) {
    return '<svg class="mark' + (cls ? ' ' + cls : '') + '" viewBox="14 14 199 440" fill="currentColor" aria-hidden="true"><circle cx="113.5" cy="48" r="34"/><path fill-rule="evenodd" d="M14 453.6V210a99.5 99.5 0 0 1 199 0v192zM60 328.5V216a53 53 0 0 1 106 0v140.5z"/></svg>';
  };

  window.U = U;
})();
