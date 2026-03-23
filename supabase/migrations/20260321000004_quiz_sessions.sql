create table if not exists public.quiz_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  book_id      uuid not null references public.books(id) on delete cascade,
  chapter_href text not null,
  score        integer not null default 0,
  total        integer not null default 0,
  questions    jsonb not null default '[]',
  created_at   timestamptz default now()
);

alter table public.quiz_sessions enable row level security;

create policy "Users manage own quiz sessions"
  on public.quiz_sessions for all
  using ((auth.jwt() ->> 'sub') = user_id);

create index if not exists quiz_sessions_user_book_idx
  on public.quiz_sessions (user_id, book_id);
