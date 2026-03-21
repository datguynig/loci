-- Add type discriminator to annotations table
-- Existing rows get 'note' (the default), new chapter notes will be 'chapter_note'
alter table public.annotations
  add column if not exists type text not null default 'note';
