-- ============================================================
-- LN Studio v6.1.0 · SINCRONÍA PÚBLICA + MULTIMEDIA
-- Proyecto independiente de LN Studio.
-- Ejecutar en Supabase > SQL Editor una sola vez.
-- Es idempotente y no borra eventos ni diseños.
-- ============================================================

begin;

-- El diseñador canónico persiste aquí.
alter table public.events
  add column if not exists design_config jsonb not null default '{}'::jsonb;

-- RPC pública v7: devuelve el evento completo salvo campos internos/sensibles.
-- Al construir el JSON desde to_jsonb(e), futuras columnas visuales no vuelven
-- a desaparecer por olvidar agregarlas manualmente a jsonb_build_object().
create or replace function public.get_public_event_v7(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.id is null then null
    else to_jsonb(e)
      - array[
          'private_token','client_id','created_by','created_at','updated_at',
          'total_amount','deposit_amount','balance_amount','payment_due_date',
          'work_status','approved_at','package_key'
        ]::text[]
  end
  from public.events e
  where e.private_token = p_token
    and e.status in ('published','finished')
  limit 1;
$$;

revoke all on function public.get_public_event_v7(uuid) from public;
grant execute on function public.get_public_event_v7(uuid) to anon, authenticated;

-- Mantiene compatibilidad con todos los enlaces y JS anteriores.
create or replace function public.get_public_event(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_public_event_v7(p_token);
$$;
revoke all on function public.get_public_event(uuid) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;

-- Bucket canónico de los recursos públicos de invitaciones.
insert into storage.buckets as b(id, name, public, file_size_limit, allowed_mime_types)
values(
  'invitation-assets',
  'invitation-assets',
  true,
  83886080,
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg',
    'video/mp4','video/webm','video/ogg','video/x-m4v','video/quicktime',
    'application/json'
  ]::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = greatest(coalesce(b.file_size_limit,0), excluded.file_size_limit),
  allowed_mime_types = (
    select array_agg(distinct mime order by mime)
    from unnest(
      coalesce(b.allowed_mime_types, array[]::text[])
      || excluded.allowed_mime_types
    ) as mime
  );

-- Políticas aditivas: no eliminan las existentes. Permiten al equipo autorizado
-- gestionar únicamente recursos dentro de /<event_id>/... .
drop policy if exists "lnstudio invitation assets insert" on storage.objects;
create policy "lnstudio invitation assets insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'invitation-assets'
  and public.can_admin_event(
    case
      when coalesce((storage.foldername(name))[1],'') ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

drop policy if exists "lnstudio invitation assets update" on storage.objects;
create policy "lnstudio invitation assets update"
on storage.objects for update to authenticated
using (
  bucket_id = 'invitation-assets'
  and public.can_admin_event(
    case
      when coalesce((storage.foldername(name))[1],'') ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
)
with check (
  bucket_id = 'invitation-assets'
  and public.can_admin_event(
    case
      when coalesce((storage.foldername(name))[1],'') ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

drop policy if exists "lnstudio invitation assets delete" on storage.objects;
create policy "lnstudio invitation assets delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'invitation-assets'
  and public.can_admin_event(
    case
      when coalesce((storage.foldername(name))[1],'') ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

commit;

-- ============================================================
-- VERIFICACIÓN. Debe devolver rpc_v7_incluye_design_config = true,
-- public = true y video/mp4 dentro de allowed_mime_types.
-- ============================================================
select
  position('to_jsonb(e)' in pg_get_functiondef('public.get_public_event_v7(uuid)'::regprocedure)) > 0
    as rpc_v7_incluye_design_config,
  b.id,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types
from storage.buckets b
where b.id = 'invitation-assets';
