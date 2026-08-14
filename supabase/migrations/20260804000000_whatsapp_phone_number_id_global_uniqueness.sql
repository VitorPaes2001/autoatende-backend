-- A4R1 / IR-006 + IR-010: candidate only. Do not apply without DBA review.
-- Fail-closed preflight; no data rewrite. The ownership comment enables safe rollback.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  duplicate_groups bigint;
  noncanonical_rows bigint;
  existing_index record;
  expected_expressions constant text[] := array[
    'btrim(phone_number_id)',
    'btrim((phone_number_id)::text)'
  ];
  expected_predicates constant text[] := array[
    '((phone_number_id IS NOT NULL) AND (phone_number_id <> ''''::text))',
    '((phone_number_id IS NOT NULL) AND ((phone_number_id)::text <> ''''::text))'
  ];
  ownership_marker constant text := 'autoatende:a4r1:owns:whatsapp_accounts_phone_number_id_global_uidx:v1';
begin
  if to_regclass('public.whatsapp_accounts') is null then
    raise exception 'A4R1 preflight: public.whatsapp_accounts does not exist';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'whatsapp_accounts'
       and column_name = 'phone_number_id'
  ) then
    raise exception 'A4R1 preflight: whatsapp_accounts.phone_number_id does not exist';
  end if;

  select count(*) into noncanonical_rows
    from public.whatsapp_accounts
   where phone_number_id is not null
     and phone_number_id::text <> btrim(phone_number_id::text);
  if noncanonical_rows > 0 then
    raise exception 'A4R1 preflight: % noncanonical phone_number_id row(s); no data changed', noncanonical_rows;
  end if;

  select count(*) into duplicate_groups
    from (
      select phone_number_id::text
        from public.whatsapp_accounts
       where phone_number_id is not null and phone_number_id::text <> ''
       group by phone_number_id::text having count(*) > 1
    ) duplicates;
  if duplicate_groups > 0 then
    raise exception 'A4R1 preflight: % duplicate phone_number_id group(s); no data changed', duplicate_groups;
  end if;

  select
    c.relname,
    c.relkind,
    i.indrelid,
    i.indisunique,
    i.indisvalid,
    i.indisready,
    i.indislive,
    i.indimmediate,
    i.indnkeyatts,
    i.indnatts,
    i.indkey::text as indkey,
    am.amname as access_method,
    selected_opclass.opcdefault as opclass_default,
    selected_opclass.opcintype as opclass_input_type,
    i.indcollation[0]::oid as index_collation_oid,
    phone_attribute.attcollation as phone_collation_oid,
    pg_get_indexdef(i.indexrelid) as definition,
    pg_get_expr(i.indexprs, i.indrelid) as expression,
    pg_get_expr(i.indpred, i.indrelid) as predicate,
    obj_description(i.indexrelid, 'pg_class') as ownership
  into existing_index
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_index i on i.indexrelid = c.oid
  join pg_am am on am.oid = c.relam
  left join pg_opclass selected_opclass on selected_opclass.oid = i.indclass[0]
  left join pg_attribute phone_attribute
    on phone_attribute.attrelid = i.indrelid
   and phone_attribute.attname = 'phone_number_id'
   and phone_attribute.attnum > 0
   and phone_attribute.attisdropped is false
  where n.nspname = 'public'
    and c.relname = 'whatsapp_accounts_phone_number_id_global_uidx';

  if found then
    if existing_index.relkind is distinct from 'i'::"char"
       or existing_index.indrelid is distinct from 'public.whatsapp_accounts'::regclass
       or existing_index.indisunique is not true
       or existing_index.indisvalid is not true
       or existing_index.indisready is not true
       or existing_index.indislive is not true
       or existing_index.indimmediate is not true
       or existing_index.indnkeyatts is distinct from 1
       or existing_index.indnatts is distinct from 1
       or existing_index.indkey is distinct from '0'
       or existing_index.access_method is distinct from 'btree'
       or existing_index.opclass_default is not true
       or existing_index.opclass_input_type is distinct from 'text'::regtype
       or existing_index.index_collation_oid is distinct from existing_index.phone_collation_oid
       or existing_index.expression is null
       or existing_index.expression <> all (expected_expressions)
       or existing_index.predicate is null
       or existing_index.predicate <> all (expected_predicates)
    then
      raise exception 'A4R1 preflight: same-name index exists with incompatible definition';
    end if;
    -- A compatible pre-existing index is accepted but never claimed by A4R1.
    return;
  end if;

  if to_regclass('public.whatsapp_accounts_phone_number_id_global_uidx') is not null then
    raise exception 'A4R1 preflight: same-name non-index relation exists';
  end if;

  execute 'create unique index whatsapp_accounts_phone_number_id_global_uidx on public.whatsapp_accounts ((btrim(phone_number_id::text))) where phone_number_id is not null and phone_number_id::text <> ''''';
  execute 'comment on index public.whatsapp_accounts_phone_number_id_global_uidx is ''autoatende:a4r1:owns:whatsapp_accounts_phone_number_id_global_uidx:v1''';
end
$migration$;

commit;
