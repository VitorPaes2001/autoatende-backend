-- AUTOATENDEAI - C.1A
-- Camada persistente para configuração comercial por empresa
-- Objetivo: substituir gradualmente a dependência operacional do onboarding_store.json
-- Estratégia: DB-first com fallback temporário para JSON file

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.company_commercial_profiles (
  company_id uuid primary key,
  company_name text,
  company_context text,
  services jsonb not null default '[]'::jsonb,
  target_audience text,
  tone text,
  escalation_rules jsonb not null default '{}'::jsonb,
  forbidden_topics jsonb not null default '[]'::jsonb,
  faq_base jsonb not null default '[]'::jsonb,
  assistant_guidance text,
  onboarding_completed boolean not null default false,
  source text not null default 'db',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_commercial_profiles_updated_at
  on public.company_commercial_profiles(updated_at desc);

drop trigger if exists trg_company_commercial_profiles_updated_at
  on public.company_commercial_profiles;

create trigger trg_company_commercial_profiles_updated_at
before update on public.company_commercial_profiles
for each row
execute function public.set_updated_at();

alter table public.company_commercial_profiles enable row level security;

-- C.1A intentionally does NOT create client-facing RLS policies yet.
-- A leitura/escrita nesta fase deve ocorrer via backend/service role.
-- Políticas específicas serão adicionadas quando o painel/API estiverem prontos.
