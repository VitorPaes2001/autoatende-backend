-- A4R1 rollback: refuses to drop any object not created and owned by A4R1.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $rollback$
declare
  target record;
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
  select
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
    pg_get_expr(i.indexprs, i.indrelid) as expression,
    pg_get_expr(i.indpred, i.indrelid) as predicate,
    obj_description(i.indexrelid, 'pg_class') as ownership
  into target
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

  if not found then
    raise notice 'A4R1 rollback: owned index absent; nothing to do';
    return;
  end if;

  if target.indrelid is distinct from 'public.whatsapp_accounts'::regclass then
    raise exception 'A4R1 rollback refused: index target is not public.whatsapp_accounts';
  end if;

  if target.ownership is distinct from ownership_marker then
    raise exception 'A4R1 rollback refused: index is not owned by A4R1';
  end if;
  if target.relkind is distinct from 'i'::"char"
     or target.indisunique is not true
     or target.indisvalid is not true
     or target.indisready is not true
     or target.indislive is not true
     or target.indimmediate is not true
     or target.indnkeyatts is distinct from 1
     or target.indnatts is distinct from 1
     or target.indkey is distinct from '0'
     or target.access_method is distinct from 'btree'
     or target.opclass_default is not true
     or target.opclass_input_type is distinct from 'text'::regtype
     or target.index_collation_oid is distinct from target.phone_collation_oid
     or target.expression is null
     or target.expression <> all (expected_expressions)
     or target.predicate is null
     or target.predicate <> all (expected_predicates)
  then
    raise exception 'A4R1 rollback refused: owned index definition drifted';
  end if;

  execute 'drop index public.whatsapp_accounts_phone_number_id_global_uidx';
end
$rollback$;
commit;
