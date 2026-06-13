create extension if not exists pgcrypto;

create table if not exists public.experiment_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  fields jsonb not null default '[]'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  calculation_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, slug)
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  experiment_date date not null default current_date,
  sample_name text not null default '',
  batch_number text not null default '',
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  template_snapshot jsonb not null,
  field_values jsonb not null default '{}'::jsonb,
  calculation_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiment_samples (
  id uuid primary key,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id, position)
);

create table if not exists public.sample_measurements (
  id uuid primary key,
  sample_id uuid not null references public.experiment_samples(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sample_id, position)
);

create table if not exists public.replicate_weights (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.sample_measurements(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  replicate smallint not null check (replicate between 1 and 3),
  weight_mg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (measurement_id, replicate)
);

create index if not exists experiments_user_updated_idx
  on public.experiments (user_id, updated_at desc);
create index if not exists experiment_samples_experiment_position_idx
  on public.experiment_samples (experiment_id, position);
create index if not exists sample_measurements_sample_position_idx
  on public.sample_measurements (sample_id, position);
create index if not exists replicate_weights_measurement_idx
  on public.replicate_weights (measurement_id, replicate);

alter table public.experiment_templates enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_samples enable row level security;
alter table public.sample_measurements enable row level security;
alter table public.replicate_weights enable row level security;

create policy "templates are readable by owner or system"
  on public.experiment_templates for select
  using (user_id is null or auth.uid() = user_id);
create policy "users manage own templates"
  on public.experiment_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users read own experiments"
  on public.experiments for select
  using (auth.uid() = user_id);
create policy "users insert own experiments"
  on public.experiments for insert
  with check (auth.uid() = user_id);
create policy "users update own experiments"
  on public.experiments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users delete own experiments"
  on public.experiments for delete
  using (auth.uid() = user_id);

create policy "users manage own samples"
  on public.experiment_samples for all
  using (auth.uid() = user_id);
  with check (auth.uid() = user_id);

create policy "users manage own sample measurements"
  on public.sample_measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own replicate weights"
  on public.replicate_weights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.experiment_templates (
  user_id, slug, name, description, fields, columns, calculation_rules
) values (
  null,
  'biodegradation-weight-loss',
  '可降解材料重量降解实验',
  '按测量时间记录样品重量，自动计算降解时长、重量差和降解率。',
  '[
    {"key":"material","label":"材料名称","inputMode":"text"},
    {"key":"degradationMedium","label":"降解介质","inputMode":"text"},
    {"key":"temperature","label":"实验温度","unit":"°C","inputMode":"decimal"}
  ]'::jsonb,
  '[
    {"key":"weight","label":"样品重量","unit":"mg","inputType":"decimal"},
    {"key":"measuredAt","label":"测量时间","inputType":"datetime-local"}
  ]'::jsonb,
  '[]'::jsonb
) on conflict (user_id, slug) do nothing;
