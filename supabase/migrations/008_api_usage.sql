create table api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz default now()
);

alter table api_usage enable row level security;

create policy "users can only see their own usage"
  on api_usage for select using (auth.uid() = user_id);

create policy "service can insert usage"
  on api_usage for insert with check (true);

