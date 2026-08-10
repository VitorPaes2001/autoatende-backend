-- __AUTOATENDE_C13D_R9C_A_CREATE_ACQUISITION_ATTRIBUTION_EVENTS__

create extension if not exists pgcrypto;

create table if not exists public.acquisition_attribution_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),

  -- vínculo futuro/gradual com tenant
  company_id uuid null,
  client_id uuid null,
  user_id uuid null,

  -- identificação do evento/captura
  event_type text not null default 'site_click',
  source_surface text not null default 'site_first_party_tracking',
  tracking_key text null,
  session_key text null,
  click_id text null,

  -- contexto comercial / aquisição
  src text null,
  lp text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  utm_term text null,
  refhost text null,

  -- destino / contexto de navegação
  target_path text null,
  target_url text null,
  request_path text null,
  request_host text null,
  request_query text null,

  -- identificação opcional de lead futuro
  lead_email text null,
  lead_phone text null,
  lead_name text null,

  -- payload bruto para preservar rastreabilidade
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists acquisition_attribution_events_occurred_at_idx
  on public.acquisition_attribution_events (occurred_at desc);

create index if not exists acquisition_attribution_events_company_id_idx
  on public.acquisition_attribution_events (company_id);

create index if not exists acquisition_attribution_events_client_id_idx
  on public.acquisition_attribution_events (client_id);

create index if not exists acquisition_attribution_events_event_type_idx
  on public.acquisition_attribution_events (event_type);

create index if not exists acquisition_attribution_events_utm_campaign_idx
  on public.acquisition_attribution_events (utm_campaign);

create index if not exists acquisition_attribution_events_utm_source_idx
  on public.acquisition_attribution_events (utm_source);

create index if not exists acquisition_attribution_events_refhost_idx
  on public.acquisition_attribution_events (refhost);

comment on table public.acquisition_attribution_events is
  'Fundação de atribuição de aquisição da AutoAtendeAI. Permite capturar eventos first-party do site e futuramente vinculá-los a company/client/user sem forçar atribuição prematura.';

comment on column public.acquisition_attribution_events.company_id is
  'Vínculo opcional com a empresa/tenant quando houver identificação confiável.';
comment on column public.acquisition_attribution_events.client_id is
  'Vínculo opcional com client quando o fluxo usar esse identificador.';
comment on column public.acquisition_attribution_events.tracking_key is
  'Chave lógica de rastreio first-party para correlacionar eventos.';
comment on column public.acquisition_attribution_events.session_key is
  'Chave opcional de sessão first-party.';
comment on column public.acquisition_attribution_events.raw_payload is
  'Payload bruto preservado para auditoria e evolução futura da atribuição.';
