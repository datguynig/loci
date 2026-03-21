-- Flashcards table
create table if not exists public.flashcards (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  book_id      uuid not null references public.books(id) on delete cascade,
  chapter_href text not null,
  front        text not null,
  back         text not null,
  created_at   bigint not null,
  last_reviewed_at bigint,
  review_count int not null default 0
);

-- Row-level security
alter table public.flashcards enable row level security;

create policy "Users manage own flashcards"
  on public.flashcards
  for all
  using ((auth.jwt() ->> 'sub') = user_id);
