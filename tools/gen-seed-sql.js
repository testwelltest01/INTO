// node tools/gen-seed-sql.js > supabase/seed.sql
// js/seed.js 의 기본 콘텐츠·갤러리 사진을 Supabase 초기 데이터 SQL 로 변환합니다.
global.window = {};
require('../js/seed.js');
const D = window.INTO_DEFAULTS;
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
let out = [];
out.push('-- =====================================================================');
out.push('--  INTO CHURCH 초기 데이터 (schema.sql 실행 후 1회 실행)');
out.push('--  into.or.kr 에서 옮겨온 문구와 사진 목록입니다. 여러 번 실행해도 중복되지 않아요.');
out.push('--  (이 파일은 tools/gen-seed-sql.js 로 생성됨)');
out.push('-- =====================================================================');
out.push('');
out.push('-- 사이트 콘텐츠 (관리자 > 사이트 콘텐츠 에서 수정 가능)');
for (const [k, v] of Object.entries(D.content)) {
  out.push(`insert into public.site_content (key, value) values (${q(k)}, ${q(JSON.stringify(v))}::jsonb)\n  on conflict (key) do nothing;`);
}
out.push('');
out.push('-- 갤러리 사진 (앱과 함께 배포되는 assets/photos 폴더의 파일)');
out.push('insert into public.photos (url, thumb_url, caption, tag, sort)');
out.push('select v.url, v.thumb_url, v.caption, v.tag, v.sort from (values');
out.push(D.photos.map(p => `  (${q(p.url)}, ${q(p.thumb_url)}, ${q(p.caption || '')}, ${q(p.tag || '')}, ${p.sort})`).join(',\n'));
out.push(') as v(url, thumb_url, caption, tag, sort)');
out.push('where not exists (select 1 from public.photos x where x.url = v.url);');
out.push('');
out.push('-- 첫 소식');
out.push(`insert into public.notices (title, body, pinned)
select '인투처치 앱이 열렸어요', '홈 화면에 추가해서 앱처럼 사용해 보세요.' || chr(10) || '매주 [이번 주 질문]에 나눔을 남기고, 궁금한 것은 [질문 게시판]에 올려 주세요.', true
where not exists (select 1 from public.notices);`);
console.log(out.join('\n'));
