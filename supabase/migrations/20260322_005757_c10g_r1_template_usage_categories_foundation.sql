-- __AUTOATENDE_C10G_R1_TEMPLATE_USAGE_CATEGORIES_FOUNDATION__
-- Fundação canônica de metering por categoria para templates Meta.
-- Mantém compatibilidade com templates_used agregado.
-- Histórico anterior NÃO será repartido retroativamente por categoria.

alter table if exists public.monthly_usage
  add column if not exists marketing_templates_used integer not null default 0,
  add column if not exists utility_auth_templates_used integer not null default 0;

comment on column public.monthly_usage.marketing_templates_used
  is 'Consumo mensal de templates da categoria marketing.';

comment on column public.monthly_usage.utility_auth_templates_used
  is 'Consumo mensal agregado de templates utility + authentication.';

update public.monthly_usage
set
  marketing_templates_used = coalesce(marketing_templates_used, 0),
  utility_auth_templates_used = coalesce(utility_auth_templates_used, 0)
where
  marketing_templates_used is null
  or utility_auth_templates_used is null;
