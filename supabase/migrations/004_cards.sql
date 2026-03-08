create table cards (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid references stages(id) on delete cascade not null,
  pipeline_id uuid references pipelines(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  position integer not null default 0,
  created_at timestamptz default now()
);

alter table cards enable row level security;

create policy "users can only access their own cards"
  on cards for all using (auth.uid() = user_id);
