-- LN Studio v3.1 · Corrección de relación events → clients
-- Ejecutar una sola vez en Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_client_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

notify pgrst, 'reload schema';
