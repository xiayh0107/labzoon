-- AI Tasks Table (Stores task history and status)
-- Run this SQL in Supabase SQL Editor

create table if not exists ai_tasks (
  id text primary key,
  user_id uuid references auth.users(id),
  type text not null, -- 'generate_questions', 'generate_structure', 'generate_image', 'batch_generate'
  status text not null default 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  title text not null,
  progress integer default 0, -- 0-100
  result jsonb,
  error text,
  input_summary text,
  created_at bigint not null,
  started_at bigint,
  completed_at bigint,
  metadata jsonb
);

-- Create indexes for faster queries
create index if not exists idx_ai_tasks_user_id on ai_tasks(user_id);
create index if not exists idx_ai_tasks_status on ai_tasks(status);
create index if not exists idx_ai_tasks_created_at on ai_tasks(created_at desc);

-- Enable RLS
alter table ai_tasks enable row level security;

-- Users can read their own tasks
drop policy if exists "Users can read own tasks" on ai_tasks;
create policy "Users can read own tasks" on ai_tasks 
  for select using (auth.uid() = user_id);

-- Service role can do everything (for backend)
drop policy if exists "Service role full access" on ai_tasks;
create policy "Service role full access" on ai_tasks 
  for all using (true);

-- Comment
comment on table ai_tasks is 'Stores AI generation task history and status';
