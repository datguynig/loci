create table if not exists public.subscriptions (
  user_id                 text primary key,
  tier                    text not null default 'free',
  status                  text not null default 'active',
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

comment on column public.subscriptions.tier   is 'free | reader | scholar';
comment on column public.subscriptions.status is 'trialing | active | canceled | past_due';

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using ((auth.jwt() ->> 'sub') = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
