create table dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid references dreams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  outcome text not null,
  created_at timestamptz default now()
);

alter table dreams enable row level security;
alter table goals enable row level security;

create policy "users can only access their own dreams"
  on dreams for all using (auth.uid() = user_id);

create policy "users can only access their own goals"
  on goals for all using (auth.uid() = user_id);
