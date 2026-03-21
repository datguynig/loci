-- Scratchpad table — one row per (user, book), upserted on save
create table if not exists public.scratchpad (
  user_id    text not null,
  book_id    uuid not null references public.books(id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz default now(),
  primary key (user_id, book_id)
);

-- Row-level security
alter table public.scratchpad enable row level security;

create policy "Users manage own scratchpad"
  on public.scratchpad
  for all
  using ((auth.jwt() ->> 'sub') = user_id);
