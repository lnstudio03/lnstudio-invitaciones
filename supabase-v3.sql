-- LN STUDIO v3.0 · Plataforma multi-evento
-- Ejecutar completo en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  global_role text not null default 'client' check (global_role in ('owner','staff','client')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  event_type text not null default 'social',
  slug text not null unique,
  private_token uuid not null default gen_random_uuid() unique,
  template_key text not null default 'aniversario-fantasmas',
  event_date timestamptz,
  venue_name text,
  venue_address text,
  maps_url text,
  description text,
  max_companions integer not null default 3 check (max_companions between 0 and 20),
  allow_general_rsvp boolean not null default true,
  allow_guest_edits boolean not null default true,
  qr_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','paused','finished','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('client_admin','event_staff','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_id,email)
);

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invitation_code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  display_name text not null,
  phone text,
  email text,
  allowed_entries integer not null default 1 check (allowed_entries between 1 and 30),
  table_name text,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, invitation_code)
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  full_name text not null,
  is_primary boolean not null default false,
  dietary_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete cascade,
  respondent_name text not null,
  phone text,
  email text,
  attendance text not null check (attendance in ('confirmed','declined')),
  party_size integer not null default 1 check (party_size between 0 and 30),
  guest_names text,
  dietary_notes text,
  message text,
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_passes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete cascade,
  rsvp_id uuid references public.rsvp_responses(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  folio text not null,
  allowed_entries integer not null default 1,
  used_entries integer not null default 0,
  status text not null default 'active' check (status in ('active','cancelled','completed')),
  created_at timestamptz not null default now(),
  unique(event_id, folio)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  pass_id uuid references public.access_passes(id) on delete set null,
  scanned_by uuid references auth.users(id),
  decision text not null check (decision in ('approved','rejected','reversed')),
  entries integer not null default 0,
  reason text,
  device_info text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  event_id uuid references public.events(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt()->>'email',''));
$$;
create or replace function public.is_ln_owner() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.global_role in ('owner','staff'));
$$;
create or replace function public.can_manage_event(p_event uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_ln_owner() or exists(
    select 1 from public.event_members m where m.event_id=p_event and m.active and lower(m.email)=public.current_email() and m.role in ('client_admin','event_staff')
  );
$$;
create or replace function public.can_view_event(p_event uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_ln_owner() or exists(
    select 1 from public.event_members m where m.event_id=p_event and m.active and lower(m.email)=public.current_email()
  );
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict(id) do update set email=excluded.email;
  update public.event_members set user_id=new.id where lower(email)=lower(new.email) and user_id is null;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_ln on auth.users;
create trigger on_auth_user_created_ln after insert or update of email on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_access_pass(p_rsvp uuid) returns public.access_passes
language plpgsql security definer set search_path=public as $$
declare r public.rsvp_responses; e public.events; result public.access_passes; seq integer;
begin
  select * into r from public.rsvp_responses where id=p_rsvp;
  if r.id is null or r.attendance <> 'confirmed' then raise exception 'RSVP no válido'; end if;
  select * into e from public.events where id=r.event_id and status='published';
  if e.id is null then raise exception 'Evento no disponible'; end if;
  select count(*)+1 into seq from public.access_passes where event_id=r.event_id;
  insert into public.access_passes(event_id,group_id,rsvp_id,folio,allowed_entries)
  values(r.event_id,r.group_id,r.id,upper(substr(e.slug,1,3))||'-'||lpad(seq::text,4,'0'),greatest(r.party_size,1))
  on conflict(rsvp_id) do update set allowed_entries=excluded.allowed_entries
  returning * into result;
  return result;
end; $$;

create or replace function public.process_checkin(p_token uuid,p_entries integer,p_decision text,p_reason text default null,p_device text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.access_passes; remaining integer; accepted integer;
begin
  select * into p from public.access_passes where token=p_token for update;
  if p.id is null then return jsonb_build_object('ok',false,'message','Código inexistente'); end if;
  if not public.can_manage_event(p.event_id) then raise exception 'Sin permiso'; end if;
  remaining := greatest(p.allowed_entries-p.used_entries,0);
  if p_decision='approved' then
    if p.status<>'active' or remaining=0 then return jsonb_build_object('ok',false,'message','Pase agotado o cancelado','pass',to_jsonb(p)); end if;
    accepted := least(greatest(p_entries,1),remaining);
    update public.access_passes set used_entries=used_entries+accepted,status=case when used_entries+accepted>=allowed_entries then 'completed' else 'active' end where id=p.id returning * into p;
    insert into public.checkins(event_id,pass_id,scanned_by,decision,entries,reason,device_info) values(p.event_id,p.id,auth.uid(),'approved',accepted,p_reason,p_device);
    return jsonb_build_object('ok',true,'message','Acceso aprobado','entries',accepted,'pass',to_jsonb(p));
  else
    insert into public.checkins(event_id,pass_id,scanned_by,decision,entries,reason,device_info) values(p.event_id,p.id,auth.uid(),'rejected',0,p_reason,p_device);
    return jsonb_build_object('ok',false,'message','Acceso rechazado','pass',to_jsonb(p));
  end if;
end; $$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.access_passes enable row level security;
alter table public.checkins enable row level security;
alter table public.audit_log enable row level security;

-- políticas administrativas
create policy "profiles own or owner" on public.profiles for select using(id=auth.uid() or public.is_ln_owner());
create policy "clients owner all" on public.clients for all using(public.is_ln_owner()) with check(public.is_ln_owner());
create policy "events view allowed" on public.events for select using(public.can_view_event(id));
create policy "events owner write" on public.events for all using(public.is_ln_owner()) with check(public.is_ln_owner());
create policy "members view allowed" on public.event_members for select using(public.can_view_event(event_id));
create policy "members owner write" on public.event_members for all using(public.is_ln_owner()) with check(public.is_ln_owner());
create policy "groups event view" on public.guest_groups for select using(public.can_view_event(event_id));
create policy "groups manage" on public.guest_groups for all using(public.can_manage_event(event_id)) with check(public.can_manage_event(event_id));
create policy "guests event view" on public.guests for select using(exists(select 1 from public.guest_groups g where g.id=group_id and public.can_view_event(g.event_id)));
create policy "guests event manage" on public.guests for all using(exists(select 1 from public.guest_groups g where g.id=group_id and public.can_manage_event(g.event_id))) with check(exists(select 1 from public.guest_groups g where g.id=group_id and public.can_manage_event(g.event_id)));
create policy "rsvp event view" on public.rsvp_responses for select using(public.can_view_event(event_id));
create policy "rsvp event manage" on public.rsvp_responses for update using(public.can_manage_event(event_id));
create policy "passes event view" on public.access_passes for select using(public.can_view_event(event_id));
create policy "passes event manage" on public.access_passes for all using(public.can_manage_event(event_id)) with check(public.can_manage_event(event_id));
create policy "checkins event view" on public.checkins for select using(public.can_view_event(event_id));
create policy "checkins event insert" on public.checkins for insert with check(public.can_manage_event(event_id));
create policy "audit owner view" on public.audit_log for select using(public.is_ln_owner() or public.can_view_event(event_id));

-- acceso público controlado por RPC para invitación real
create or replace function public.get_public_event(p_token uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select case when e.id is null then null else jsonb_build_object(
 'id',e.id,'name',e.name,'event_type',e.event_type,'template_key',e.template_key,'event_date',e.event_date,
 'venue_name',e.venue_name,'venue_address',e.venue_address,'maps_url',e.maps_url,'description',e.description,
 'max_companions',e.max_companions,'allow_general_rsvp',e.allow_general_rsvp,'qr_enabled',e.qr_enabled,'status',e.status
 ) end from public.events e where e.private_token=p_token and e.status='published' limit 1;
$$;
create or replace function public.submit_public_rsvp(p_token uuid,p_name text,p_phone text,p_email text,p_attendance text,p_party_size integer,p_guest_names text,p_dietary text,p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events; r public.rsvp_responses; pass public.access_passes;
begin
 select * into e from public.events where private_token=p_token and status='published';
 if e.id is null then raise exception 'Evento no disponible'; end if;
 if not e.allow_general_rsvp then raise exception 'Este evento requiere una invitación individual'; end if;
 insert into public.rsvp_responses(event_id,respondent_name,phone,email,attendance,party_size,guest_names,dietary_notes,message)
 values(e.id,trim(p_name),p_phone,p_email,p_attendance,case when p_attendance='confirmed' then least(greatest(p_party_size,1),e.max_companions+1) else 0 end,p_guest_names,p_dietary,p_message)
 returning * into r;
 if r.attendance='confirmed' and e.qr_enabled then select * into pass from public.create_access_pass(r.id); end if;
 return jsonb_build_object('rsvp',to_jsonb(r),'pass',case when pass.id is null then null else to_jsonb(pass) end);
end; $$;

grant execute on function public.get_public_event(uuid) to anon, authenticated;
grant execute on function public.submit_public_rsvp(uuid,text,text,text,text,integer,text,text,text) to anon, authenticated;
grant execute on function public.process_checkin(uuid,integer,text,text,text) to authenticated;

-- propietario actual
insert into public.profiles(id,email,full_name,global_role)
values('ad2e7866-08f8-473a-bf94-42d8e6d319ba','lnstudio.eventos@gmail.com','LN Studio','owner')
on conflict(id) do update set global_role='owner',active=true,email=excluded.email;

-- migración/semilla del aniversario
insert into public.clients(id,business_name,contact_name,email,phone,created_by)
values('11111111-1111-4111-8111-111111111111','Fantasmas Biker''s Shop','Fantasmas Biker''s Shop','lnstudio.eventos@gmail.com','5610329215','ad2e7866-08f8-473a-bf94-42d8e6d319ba')
on conflict(id) do nothing;
insert into public.events(id,client_id,name,event_type,slug,private_token,template_key,event_date,venue_name,venue_address,maps_url,description,status,created_by)
values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Primer aniversario Fantasmas','aniversario','primer-aniversario-fantasmas','33333333-3333-4333-8333-333333333333','aniversario-fantasmas','2026-08-29 15:00:00-06','Fantasmas Biker''s Shop','Avenida Gobernadora 656, Tolotzin I, Ecatepec, Estado de México','https://maps.app.goo.gl/NqPb7tJ6CNmK2Siq6','Primer aniversario de Fantasmas Biker''s Shop y lanzamiento de Aliados Fantasma.','published','ad2e7866-08f8-473a-bf94-42d8e6d319ba')
on conflict(id) do update set status='published';
