-- ============================================================
-- LN Studio v5.1.0 · SINCRONÍA EXACTA DISEÑADOR / PUBLICACIÓN
-- ============================================================
-- CAUSA REPARADA:
-- El diseñador lee public.events.design_config directamente, pero la
-- función pública get_public_event() no devolvía design_config.
-- Por eso la URL ?token=... caía en fuentes, colores, fondo y animación
-- predeterminados aunque el diseñador mostrara el diseño correcto.
--
-- Esta migración es idempotente y se puede ejecutar más de una vez.

begin;

alter table public.events
  add column if not exists design_config jsonb not null default '{}'::jsonb;

create or replace function public.get_public_event(p_token uuid)
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
    'design_config', coalesce(e.design_config, '{}'::jsonb),
    'custom_text', e.custom_text,
    'schedule', e.schedule,
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

revoke all on function public.get_public_event(uuid) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;

-- Conserva también el arreglo de video de v5.0.0. No elimina MIME existentes.
update storage.buckets
set
  allowed_mime_types = (
    select array_agg(distinct mime order by mime)
    from unnest(
      coalesce(allowed_mime_types, array[]::text[])
      || array[
        'image/png','image/jpeg','image/webp','image/gif',
        'audio/mpeg','audio/wav','audio/x-wav','audio/ogg',
        'video/mp4','video/webm','video/ogg','video/x-m4v','video/quicktime'
      ]::text[]
    ) as mime
  ),
  file_size_limit = case
    when file_size_limit is null then null
    else greatest(file_size_limit, 83886080)
  end
where id = 'invitation-assets';

commit;

-- VERIFICACIÓN. La primera columna debe ser TRUE.
select
  position('design_config' in pg_get_functiondef('public.get_public_event(uuid)'::regprocedure)) > 0 as rpc_incluye_design_config,
  id,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'invitation-assets';
