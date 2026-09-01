-- LN Studio v5.0.0
-- Habilita video en el bucket que ya usa el diseñador: invitation-assets
-- Ejecutar UNA sola vez en Supabase > SQL Editor.

update storage.buckets
set
  allowed_mime_types = (
    select array_agg(distinct mime order by mime)
    from unnest(
      coalesce(allowed_mime_types, array[]::text[])
      || array[
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/x-m4v',
        'video/quicktime'
      ]::text[]
    ) as mime
  ),
  file_size_limit = case
    when file_size_limit is null then null
    else greatest(file_size_limit, 83886080)
  end
where id = 'invitation-assets';

-- Verificación: debe mostrar video/mp4 dentro de allowed_mime_types.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'invitation-assets';
