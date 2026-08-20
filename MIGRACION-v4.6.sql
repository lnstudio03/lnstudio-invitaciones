-- LN Studio v4.6.0 · permisos de eliminación revisados
-- Ejecutar una sola vez en Supabase > SQL Editor.

drop policy if exists "v4 checkins admin delete" on public.checkins;
create policy "v4 checkins admin delete"
on public.checkins for delete
to authenticated
using (public.can_admin_event(event_id));

-- event_members ya está protegido por la política "v4 members admin write".
-- Se concede DELETE para que el propietario pueda quitar la asignación sin borrar la cuenta Auth.
grant delete on table public.event_members to authenticated;
grant delete on table public.checkins to authenticated;

