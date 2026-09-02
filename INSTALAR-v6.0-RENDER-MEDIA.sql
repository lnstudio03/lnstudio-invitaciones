-- ============================================================
-- LN Studio v6.0.0 · RENDER PÚBLICO + MULTIMEDIA
-- Ejecutar en Supabase > SQL Editor una sola vez.
-- Es idempotente: se puede volver a ejecutar sin borrar diseños.
-- ============================================================

begin;

-- 1) El diseño completo vive en events.design_config.
alter table public.events
  add column if not exists design_config jsonb not null default '{}'::jsonb;

-- 2) Contrato público VERSIONADO. No depende de migraciones antiguas que
--    vuelvan a reemplazar get_public_event().
create or replace function public.get_public_event_v6(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when e.id is null then null else jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'event_type', e.event_type,
    'template_key', e.template_key,
    'event_date', e.event_date,
    'venue_name', e.venue_name,
    'venue_address', e.venue_address,
    'maps_url', e.maps_url,
    'description', e.description,
    'dress_code', e.dress_code,
    'logo_url', e.logo_url,
    'secondary_logo_url', e.secondary_logo_url,
    'hero_image_url', e.hero_image_url,
    'music_url', e.music_url,
    'theme_primary', e.theme_primary,
    'theme_secondary', e.theme_secondary,
    'custom_text', e.custom_text,
    'schedule', e.schedule,
    'design_config', coalesce(e.design_config, '{}'::jsonb),
    'max_companions', e.max_companions,
    'allow_general_rsvp', e.allow_general_rsvp,
    'allow_guest_edits', e.allow_guest_edits,
    'qr_enabled', e.qr_enabled,
    'status', e.status,
    'expires_at', e.expires_at
  ) end
  from public.events e
  where e.private_token = p_token
    and e.status in ('published','finished')
  limit 1;
$$;

revoke all on function public.get_public_event_v6(uuid) from public;
grant execute on function public.get_public_event_v6(uuid) to anon, authenticated;

-- Conserva también la RPC histórica para páginas antiguas.
create or replace function public.get_public_event(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_public_event_v6(p_token);
$$;
revoke all on function public.get_public_event(uuid) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;

-- 3) Bucket canónico. El sitio usa getPublicFileUrl(), por lo que ESTE
--    bucket debe ser público para que fondo, galería y video funcionen
--    fuera de la sesión de LN Studio.
insert into storage.buckets as b(id, name, public, file_size_limit, allowed_mime_types)
values(
  'invitation-assets',
  'invitation-assets',
  true,
  83886080,
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg',
    'video/mp4','video/webm','video/ogg','video/x-m4v','video/quicktime'
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

-- 4) No se modifican las políticas RLS existentes. El proyecto ya puede subir
--    imágenes; aquí solo corregimos visibilidad pública, límite y MIME del bucket.

commit;

-- ============================================================
-- VERIFICACIÓN
-- Debe devolver:
-- rpc_v6_incluye_design_config = true
-- public = true
-- video/mp4 dentro de allowed_mime_types
-- ============================================================
select
  position('design_config' in pg_get_functiondef('public.get_public_event_v6(uuid)'::regprocedure)) > 0 as rpc_v6_incluye_design_config,
  b.id,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types
from storage.buckets b
where b.id='invitation-assets';
