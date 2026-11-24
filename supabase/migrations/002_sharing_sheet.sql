-- =====================================================================
--  002: 나눔지(주간 나눔 자료) 확장 + 예약 공개
--  이미 schema.sql 을 실행한 프로젝트에서 한 번 실행하세요. (여러 번 실행해도 안전)
-- =====================================================================

alter table public.weekly_questions
  add column if not exists sermon_title    text,
  add column if not exists preacher        text,
  add column if not exists scripture_text  text,
  add column if not exists questions       jsonb not null default '[]'::jsonb,
  add column if not exists application     text,
  add column if not exists prayer          text,
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text,
  add column if not exists publish_at      timestamptz;

comment on column public.weekly_questions.publish_at is '이 시각부터 성도에게 공개. 비어 있으면 해당 주 월요일 0시(한국 시간)부터 공개';

-- 질문별 나눔 (몇 번 질문에 대한 나눔인지, 비어 있으면 전체 나눔)
alter table public.answers
  add column if not exists question_no smallint;

-- 공개 여부 판단 (예약 공개 포함)
create or replace function public.sheet_released(p_published boolean, p_publish_at timestamptz, p_week_of date)
returns boolean language sql stable as $$
  select p_published and coalesce(p_publish_at, (p_week_of - 6)::timestamp at time zone 'Asia/Seoul') <= now();
$$;

-- 성도는 공개 시점이 지난 나눔지만 볼 수 있음 (관리자는 전부)
alter policy "wq: read published" on public.weekly_questions
  using (public.is_admin() or public.sheet_released(published, publish_at, week_of));

-- 나눔은 공개된(마감 전) 나눔지에만 작성
alter policy "answers: members insert" on public.answers
  with check (
    public.is_member() and user_id = auth.uid()
    and exists (select 1 from public.weekly_questions q
                where q.id = question_id and not q.closed
                  and public.sheet_released(q.published, q.publish_at, q.week_of))
  );
