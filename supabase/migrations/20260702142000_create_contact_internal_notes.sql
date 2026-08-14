-- __AUTOATENDE_CONTACT_INTERNAL_NOTES_DB_V1__
-- AutoAtendeAI — Fase 6A1
-- Tabela privada de observações internas por empresa e conversa.
-- Aplicada inicialmente pelo SQL Editor do Supabase em 2026-07-02.
-- Seguro para reaplicação. O frontend não acessa esta tabela diretamente.

begin;

create extension if not exists pgcrypto;

create unique index if not exists inbox_conversations_id_company_id_uidx
  on public.inbox_conversations (id, company_id);

create table if not exists public.contact_internal_notes (
  id uuid primary key default gen_random_uuid()
);

alter table public.contact_internal_notes
  add column if not exists company_id uuid,
  add column if not exists conversation_id uuid,
  add column if not exists content text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.contact_internal_notes
  alter column company_id set not null,
  alter column conversation_id set not null,
  alter column content set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_internal_notes'::regclass
      and conname = 'contact_internal_notes_content_len_check'
  ) then
    alter table public.contact_internal_notes
      add constraint contact_internal_notes_content_len_check
      check (char_length(btrim(content)) between 1 and 4000);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_internal_notes'::regclass
      and conname = 'contact_internal_notes_company_conversation_key'
  ) then
    alter table public.contact_internal_notes
      add constraint contact_internal_notes_company_conversation_key
      unique (company_id, conversation_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_internal_notes'::regclass
      and conname = 'contact_internal_notes_conversation_company_fkey'
  ) then
    alter table public.contact_internal_notes
      add constraint contact_internal_notes_conversation_company_fkey
      foreign key (conversation_id, company_id)
      references public.inbox_conversations (id, company_id)
      on delete cascade;
  end if;
end
$$;

create index if not exists contact_internal_notes_company_updated_idx
  on public.contact_internal_notes (company_id, updated_at desc);

create index if not exists contact_internal_notes_conversation_idx
  on public.contact_internal_notes (conversation_id);

create or replace function public.set_contact_internal_notes_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contact_internal_notes_updated_at
  on public.contact_internal_notes;

create trigger trg_contact_internal_notes_updated_at
before update on public.contact_internal_notes
for each row
execute function public.set_contact_internal_notes_updated_at();

alter table public.contact_internal_notes
  enable row level security;

revoke all on table public.contact_internal_notes
  from anon, authenticated;

grant select, insert, update, delete
  on table public.contact_internal_notes
  to service_role;

comment on table public.contact_internal_notes is
  'Private internal note for an AutoAtendeAI conversation. Access is backend/service-role only.';

comment on column public.contact_internal_notes.company_id is
  'Tenant/company that owns the note.';

comment on column public.contact_internal_notes.conversation_id is
  'Inbox conversation associated with the note.';

comment on column public.contact_internal_notes.content is
  'Private operational note, limited to 4000 trimmed characters.';

comment on column public.contact_internal_notes.created_by is
  'Authenticated user UUID that originally created the note, when available.';

comment on column public.contact_internal_notes.updated_by is
  'Authenticated user UUID that most recently changed the note, when available.';

commit;

notify pgrst, 'reload schema';
