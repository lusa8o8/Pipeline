create table pipelines (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid references dreams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references pipelines(id) on delete cascade not null,
  name text not null,
  position integer not null,
  created_at timestamptz default now()
);

alter table pipelines enable row level security;
alter table stages enable row level security;

create policy "users can only access their own pipelines"
  on pipelines for all using (auth.uid() = user_id);

create policy "users can only access their own stages"
  on stages for all using (
    pipeline_id in (
      select id from pipelines where user_id = auth.uid()
    )
  );
