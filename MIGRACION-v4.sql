-- =====================================================================
-- LN STUDIO v4 · INSTALACIÓN / MIGRACIÓN PRINCIPAL
-- Ejecutar COMPLETO una sola vez en Supabase > SQL Editor.
-- Es idempotente: puede volver a ejecutarse si una parte falló.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- TABLAS ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  global_role text not null default 'client',
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
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null default 'social',
  description text,
  preview_url text,
  active boolean not null default true,
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
  template_key text not null default 'biker-rebel-neon',
  event_date timestamptz,
  venue_name text,
  venue_address text,
  maps_url text,
  description text,
  dress_code text,
  logo_url text,
  secondary_logo_url text,
  hero_image_url text,
  music_url text,
  theme_primary text not null default '#c79735',
  theme_secondary text not null default '#0b0b0b',
  custom_text jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  max_companions integer not null default 3,
  allow_general_rsvp boolean not null default true,
  allow_guest_edits boolean not null default true,
  qr_enabled boolean not null default true,
  status text not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columnas nuevas para instalaciones que venían de v3.
alter table public.events add column if not exists dress_code text;
alter table public.events add column if not exists logo_url text;
alter table public.events add column if not exists secondary_logo_url text;
alter table public.events add column if not exists hero_image_url text;
alter table public.events add column if not exists music_url text;
alter table public.events add column if not exists theme_primary text not null default '#c79735';
alter table public.events add column if not exists theme_secondary text not null default '#0b0b0b';
alter table public.events add column if not exists custom_text jsonb not null default '{}'::jsonb;
alter table public.events add column if not exists schedule jsonb not null default '[]'::jsonb;

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,email)
);
alter table public.event_members add column if not exists updated_at timestamptz not null default now();

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invitation_code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  display_name text not null,
  phone text,
  email text,
  allowed_entries integer not null default 1,
  table_name text,
  notes text,
  status text not null default 'pending',
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
  group_id uuid references public.guest_groups(id) on delete set null,
  respondent_name text not null,
  phone text,
  email text,
  attendance text not null,
  party_size integer not null default 1,
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
  group_id uuid references public.guest_groups(id) on delete set null,
  rsvp_id uuid references public.rsvp_responses(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  folio text not null,
  allowed_entries integer not null default 1,
  used_entries integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, folio)
);
alter table public.access_passes add column if not exists updated_at timestamptz not null default now();
create unique index if not exists access_passes_rsvp_unique on public.access_passes(rsvp_id) where rsvp_id is not null;

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  pass_id uuid references public.access_passes(id) on delete set null,
  scanned_by uuid references auth.users(id) on delete set null,
  decision text not null,
  entries integer not null default 0,
  reason text,
  device_info text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  name text not null,
  email text,
  phone text,
  city text,
  event_type text not null,
  event_date date,
  guest_count integer,
  style text,
  features text[] not null default '{}',
  details text,
  status text not null default 'new',
  converted_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  event_id uuid references public.events(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- VALIDACIONES / ÍNDICES ----------
create index if not exists events_client_idx on public.events(client_id);
create index if not exists event_members_user_idx on public.event_members(user_id);
create index if not exists event_members_email_idx on public.event_members(lower(email));
create index if not exists rsvp_event_idx on public.rsvp_responses(event_id);
create index if not exists passes_event_idx on public.access_passes(event_id);
create index if not exists checkins_event_idx on public.checkins(event_id);
create index if not exists quotes_status_idx on public.quote_requests(status);

-- ---------- FUNCIONES DE PERMISOS ----------
create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt()->>'email',''));
$$;

create or replace function public.is_ln_owner()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active and p.global_role in ('owner','staff')
  );
$$;

create or replace function public.can_view_event(p_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_ln_owner() or exists(
    select 1 from public.event_members m
    where m.event_id=p_event and m.active
      and (m.user_id=auth.uid() or lower(m.email)=public.current_email())
  );
$$;

create or replace function public.can_admin_event(p_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_ln_owner() or exists(
    select 1 from public.event_members m
    where m.event_id=p_event and m.active
      and (m.user_id=auth.uid() or lower(m.email)=public.current_email())
      and m.role='client_admin'
  );
$$;

create or replace function public.can_scan_event(p_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_ln_owner() or exists(
    select 1 from public.event_members m
    where m.event_id=p_event and m.active
      and (m.user_id=auth.uid() or lower(m.email)=public.current_email())
      and m.role in ('client_admin','event_staff')
  );
$$;

-- ---------- AUTH: PERFIL Y VINCULACIÓN AUTOMÁTICA ----------
create or replace function public.handle_ln_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,global_role,active)
  values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'full_name',''),'client',true)
  on conflict(id) do update set email=excluded.email, updated_at=now();

  update public.event_members
     set user_id=new.id, updated_at=now()
   where lower(email)=lower(new.email) and (user_id is null or user_id=new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ln on auth.users;
drop trigger if exists on_auth_user_changed_ln on auth.users;
create trigger on_auth_user_changed_ln
  after insert or update of email on auth.users
  for each row execute procedure public.handle_ln_user();

-- Evita que un cliente cambie desde el navegador la propiedad, el token o el creador de un evento.
create or replace function public.protect_event_core_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_ln_owner() then
    new.id := old.id;
    new.client_id := old.client_id;
    new.private_token := old.private_token;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_core_fields_ln on public.events;
create trigger protect_event_core_fields_ln
  before update on public.events
  for each row execute procedure public.protect_event_core_fields();

-- ---------- FUNCIONES ADMINISTRATIVAS ----------
create or replace function public.upsert_event_member(p_event_id uuid,p_email text,p_role text,p_active boolean default true)
returns public.event_members
language plpgsql security definer set search_path=public,auth as $$
declare result public.event_members; found_user uuid;
begin
  if not public.can_admin_event(p_event_id) then raise exception 'Sin permiso para administrar accesos'; end if;
  if p_role not in ('client_admin','event_staff','viewer') then raise exception 'Rol no válido'; end if;
  select id into found_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  insert into public.event_members(event_id,user_id,email,role,active)
  values(p_event_id,found_user,lower(trim(p_email)),p_role,p_active)
  on conflict(event_id,email) do update
    set user_id=coalesce(excluded.user_id,public.event_members.user_id), role=excluded.role,
        active=excluded.active, updated_at=now()
  returning * into result;
  insert into public.audit_log(actor_id,event_id,action,entity_type,entity_id,details)
  values(auth.uid(),p_event_id,'member_upsert','event_member',result.id::text,jsonb_build_object('email',result.email,'role',result.role));
  return result;
end;
$$;

create or replace function public.convert_quote_to_client(p_request_id uuid)
returns public.clients
language plpgsql security definer set search_path=public as $$
declare q public.quote_requests; c public.clients;
begin
  if not public.is_ln_owner() then raise exception 'Solo LN Studio puede convertir solicitudes'; end if;
  select * into q from public.quote_requests where id=p_request_id for update;
  if q.id is null then raise exception 'Solicitud no encontrada'; end if;
  if q.converted_client_id is not null then
    select * into c from public.clients where id=q.converted_client_id;
    return c;
  end if;
  insert into public.clients(business_name,contact_name,email,phone,notes,created_by)
  values(q.name,q.name,q.email,q.phone,'Creado desde solicitud '||q.folio||E'\n'||coalesce(q.details,''),auth.uid())
  returning * into c;
  update public.quote_requests set status='converted',converted_client_id=c.id,updated_at=now() where id=q.id;
  return c;
end;
$$;

-- ---------- RSVP Y PASES ----------
create or replace function public.create_access_pass(p_rsvp uuid)
returns public.access_passes
language plpgsql security definer set search_path=public as $$
declare r public.rsvp_responses; result public.access_passes;
begin
  select * into r from public.rsvp_responses where id=p_rsvp;
  if r.id is null or r.attendance <> 'confirmed' then raise exception 'RSVP no válido'; end if;

  select * into result from public.access_passes where rsvp_id=r.id for update;
  if result.id is not null then
    update public.access_passes
       set allowed_entries=greatest(r.party_size,1),updated_at=now()
     where id=result.id returning * into result;
    return result;
  end if;

  insert into public.access_passes(event_id,group_id,rsvp_id,folio,allowed_entries)
  values(r.event_id,r.group_id,r.id,'LN-'||upper(substr(encode(gen_random_bytes(5),'hex'),1,10)),greatest(r.party_size,1))
  returning * into result;
  return result;
end;
$$;

create or replace function public.get_public_event(p_token uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select case when e.id is null then null else jsonb_build_object(
    'id',e.id,'name',e.name,'event_type',e.event_type,'template_key',e.template_key,
    'event_date',e.event_date,'venue_name',e.venue_name,'venue_address',e.venue_address,
    'maps_url',e.maps_url,'description',e.description,'dress_code',e.dress_code,
    'logo_url',e.logo_url,'secondary_logo_url',e.secondary_logo_url,'hero_image_url',e.hero_image_url,
    'music_url',e.music_url,'theme_primary',e.theme_primary,'theme_secondary',e.theme_secondary,
    'custom_text',e.custom_text,'schedule',e.schedule,'max_companions',e.max_companions,
    'allow_general_rsvp',e.allow_general_rsvp,'allow_guest_edits',e.allow_guest_edits,
    'qr_enabled',e.qr_enabled,'status',e.status
  ) end
  from public.events e where e.private_token=p_token and e.status='published' limit 1;
$$;

create or replace function public.submit_public_rsvp(
  p_token uuid,p_name text,p_phone text,p_email text,p_attendance text,p_party_size integer,
  p_guest_names text,p_dietary text,p_message text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events; r public.rsvp_responses; pass public.access_passes; safe_size integer;
begin
  select * into e from public.events where private_token=p_token and status='published';
  if e.id is null then raise exception 'Evento no disponible'; end if;
  if not e.allow_general_rsvp then raise exception 'Este evento requiere una invitación individual'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'Escribe el nombre del invitado'; end if;
  if p_attendance not in ('confirmed','declined') then raise exception 'Respuesta no válida'; end if;

  safe_size := case when p_attendance='confirmed'
    then least(greatest(coalesce(p_party_size,1),1),e.max_companions+1) else 0 end;

  insert into public.rsvp_responses(event_id,respondent_name,phone,email,attendance,party_size,guest_names,dietary_notes,message)
  values(e.id,trim(p_name),nullif(trim(p_phone),''),nullif(lower(trim(p_email)),''),p_attendance,safe_size,p_guest_names,p_dietary,p_message)
  returning * into r;

  if r.attendance='confirmed' and e.qr_enabled then pass := public.create_access_pass(r.id); end if;
  return jsonb_build_object('ok',true,'rsvp',to_jsonb(r),'pass',case when pass.id is null then null else to_jsonb(pass) end);
end;
$$;

create or replace function public.lookup_access_pass(p_token uuid,p_event_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare p public.access_passes; r public.rsvp_responses; e public.events; remaining integer;
begin
  select * into p from public.access_passes where token=p_token;
  if p.id is null then return jsonb_build_object('ok',false,'message','Código no encontrado'); end if;
  if p_event_id is not null and p.event_id<>p_event_id then return jsonb_build_object('ok',false,'message','El pase pertenece a otro evento'); end if;
  if not public.can_scan_event(p.event_id) then raise exception 'Sin permiso para validar este evento'; end if;
  select * into r from public.rsvp_responses where id=p.rsvp_id;
  select * into e from public.events where id=p.event_id;
  remaining:=greatest(p.allowed_entries-p.used_entries,0);
  return jsonb_build_object('ok',true,'pass',to_jsonb(p),'remaining',remaining,
    'guest',jsonb_build_object('name',r.respondent_name,'phone',r.phone,'party_size',r.party_size),
    'event',jsonb_build_object('id',e.id,'name',e.name));
end;
$$;

create or replace function public.process_checkin(
  p_token uuid,p_entries integer,p_decision text,p_reason text default null,
  p_device text default null,p_event_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.access_passes; remaining integer; accepted integer;
begin
  select * into p from public.access_passes where token=p_token for update;
  if p.id is null then return jsonb_build_object('ok',false,'message','Código inexistente'); end if;
  if p_event_id is not null and p.event_id<>p_event_id then return jsonb_build_object('ok',false,'message','El pase pertenece a otro evento'); end if;
  if not public.can_scan_event(p.event_id) then raise exception 'Sin permiso para validar este evento'; end if;
  remaining:=greatest(p.allowed_entries-p.used_entries,0);

  if p_decision='approved' then
    if p.status<>'active' or remaining=0 then
      return jsonb_build_object('ok',false,'message','Pase agotado o cancelado','pass',to_jsonb(p));
    end if;
    accepted:=least(greatest(coalesce(p_entries,1),1),remaining);
    update public.access_passes
       set used_entries=used_entries+accepted,
           status=case when used_entries+accepted>=allowed_entries then 'completed' else 'active' end,
           updated_at=now()
     where id=p.id returning * into p;
    insert into public.checkins(event_id,pass_id,scanned_by,decision,entries,reason,device_info)
    values(p.event_id,p.id,auth.uid(),'approved',accepted,p_reason,p_device);
    return jsonb_build_object('ok',true,'message','Acceso aprobado','entries',accepted,'pass',to_jsonb(p));
  elsif p_decision='rejected' then
    insert into public.checkins(event_id,pass_id,scanned_by,decision,entries,reason,device_info)
    values(p.event_id,p.id,auth.uid(),'rejected',0,p_reason,p_device);
    return jsonb_build_object('ok',false,'message','Acceso rechazado','pass',to_jsonb(p));
  else
    raise exception 'Decisión no válida';
  end if;
end;
$$;

-- ---------- COTIZACIÓN PÚBLICA ----------
create or replace function public.submit_quote_request(
  p_name text,p_email text,p_phone text,p_city text,p_event_type text,p_event_date date,
  p_guest_count integer,p_style text,p_features text[],p_details text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.quote_requests; new_folio text;
begin
  if trim(coalesce(p_name,''))='' then raise exception 'El nombre es obligatorio'; end if;
  new_folio:='LN-'||extract(year from now())::int||'-'||upper(substr(encode(gen_random_bytes(4),'hex'),1,8));
  insert into public.quote_requests(folio,name,email,phone,city,event_type,event_date,guest_count,style,features,details)
  values(new_folio,trim(p_name),nullif(lower(trim(p_email)),''),nullif(trim(p_phone),''),nullif(trim(p_city),''),
    p_event_type,p_event_date,greatest(coalesce(p_guest_count,0),0),p_style,coalesce(p_features,'{}'),p_details)
  returning * into q;
  return jsonb_build_object('ok',true,'folio',q.folio,'id',q.id);
end;
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.templates enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.access_passes enable row level security;
alter table public.checkins enable row level security;
alter table public.quote_requests enable row level security;
alter table public.audit_log enable row level security;

-- Quitar políticas anteriores conocidas.
drop policy if exists "profiles own or owner" on public.profiles;
drop policy if exists "clients owner all" on public.clients;
drop policy if exists "events view allowed" on public.events;
drop policy if exists "events owner write" on public.events;
drop policy if exists "members view allowed" on public.event_members;
drop policy if exists "members owner write" on public.event_members;
drop policy if exists "groups event view" on public.guest_groups;
drop policy if exists "groups manage" on public.guest_groups;
drop policy if exists "guests event view" on public.guests;
drop policy if exists "guests event manage" on public.guests;
drop policy if exists "rsvp event view" on public.rsvp_responses;
drop policy if exists "rsvp event manage" on public.rsvp_responses;
drop policy if exists "passes event view" on public.access_passes;
drop policy if exists "passes event manage" on public.access_passes;
drop policy if exists "checkins event view" on public.checkins;
drop policy if exists "checkins event insert" on public.checkins;
drop policy if exists "audit owner view" on public.audit_log;
drop policy if exists "templates public read" on public.templates;
drop policy if exists "templates owner write" on public.templates;
drop policy if exists "quotes owner read" on public.quote_requests;
drop policy if exists "quotes owner update" on public.quote_requests;

-- Políticas v4.
drop policy if exists "v4 profiles read" on public.profiles;
drop policy if exists "v4 profiles self update" on public.profiles;
drop policy if exists "v4 clients read" on public.clients;
drop policy if exists "v4 clients owner insert" on public.clients;
drop policy if exists "v4 clients owner update" on public.clients;
drop policy if exists "v4 clients owner delete" on public.clients;
drop policy if exists "v4 templates read" on public.templates;
drop policy if exists "v4 templates owner write" on public.templates;
drop policy if exists "v4 events read" on public.events;
drop policy if exists "v4 events owner insert" on public.events;
drop policy if exists "v4 events admin update" on public.events;
drop policy if exists "v4 events owner delete" on public.events;
drop policy if exists "v4 members read" on public.event_members;
drop policy if exists "v4 members admin write" on public.event_members;
drop policy if exists "v4 groups read" on public.guest_groups;
drop policy if exists "v4 groups admin write" on public.guest_groups;
drop policy if exists "v4 guests read" on public.guests;
drop policy if exists "v4 guests admin write" on public.guests;
drop policy if exists "v4 rsvp read" on public.rsvp_responses;
drop policy if exists "v4 rsvp admin update" on public.rsvp_responses;
drop policy if exists "v4 rsvp admin delete" on public.rsvp_responses;
drop policy if exists "v4 passes read" on public.access_passes;
drop policy if exists "v4 passes admin write" on public.access_passes;
drop policy if exists "v4 checkins read" on public.checkins;
drop policy if exists "v4 checkins scan insert" on public.checkins;
drop policy if exists "v4 quotes owner read" on public.quote_requests;
drop policy if exists "v4 quotes owner update" on public.quote_requests;
drop policy if exists "v4 quotes owner delete" on public.quote_requests;
drop policy if exists "v4 audit read" on public.audit_log;

create policy "v4 profiles read" on public.profiles for select using(id=auth.uid() or public.is_ln_owner());
create policy "v4 profiles self update" on public.profiles for update using(id=auth.uid() or public.is_ln_owner()) with check(id=auth.uid() or public.is_ln_owner());

create policy "v4 clients read" on public.clients for select using(
  public.is_ln_owner() or exists(select 1 from public.events e where e.client_id=clients.id and public.can_view_event(e.id))
);
create policy "v4 clients owner insert" on public.clients for insert with check(public.is_ln_owner());
create policy "v4 clients owner update" on public.clients for update using(public.is_ln_owner()) with check(public.is_ln_owner());
create policy "v4 clients owner delete" on public.clients for delete using(public.is_ln_owner());

create policy "v4 templates read" on public.templates for select using(active or public.is_ln_owner());
create policy "v4 templates owner write" on public.templates for all using(public.is_ln_owner()) with check(public.is_ln_owner());

create policy "v4 events read" on public.events for select using(public.can_view_event(id));
create policy "v4 events owner insert" on public.events for insert with check(public.is_ln_owner());
create policy "v4 events admin update" on public.events for update using(public.can_admin_event(id)) with check(public.can_admin_event(id));
create policy "v4 events owner delete" on public.events for delete using(public.is_ln_owner());

create policy "v4 members read" on public.event_members for select using(public.can_view_event(event_id));
create policy "v4 members admin write" on public.event_members for all using(public.can_admin_event(event_id)) with check(public.can_admin_event(event_id));

create policy "v4 groups read" on public.guest_groups for select using(public.can_view_event(event_id));
create policy "v4 groups admin write" on public.guest_groups for all using(public.can_admin_event(event_id)) with check(public.can_admin_event(event_id));

create policy "v4 guests read" on public.guests for select using(exists(
  select 1 from public.guest_groups g where g.id=guests.group_id and public.can_view_event(g.event_id)
));
create policy "v4 guests admin write" on public.guests for all using(exists(
  select 1 from public.guest_groups g where g.id=guests.group_id and public.can_admin_event(g.event_id)
)) with check(exists(
  select 1 from public.guest_groups g where g.id=guests.group_id and public.can_admin_event(g.event_id)
));

create policy "v4 rsvp read" on public.rsvp_responses for select using(public.can_view_event(event_id));
create policy "v4 rsvp admin update" on public.rsvp_responses for update using(public.can_admin_event(event_id)) with check(public.can_admin_event(event_id));
create policy "v4 rsvp admin delete" on public.rsvp_responses for delete using(public.can_admin_event(event_id));

create policy "v4 passes read" on public.access_passes for select using(public.can_view_event(event_id));
create policy "v4 passes admin write" on public.access_passes for all using(public.can_admin_event(event_id)) with check(public.can_admin_event(event_id));

create policy "v4 checkins read" on public.checkins for select using(public.can_view_event(event_id));
create policy "v4 checkins scan insert" on public.checkins for insert with check(public.can_scan_event(event_id));

create policy "v4 quotes owner read" on public.quote_requests for select using(public.is_ln_owner());
create policy "v4 quotes owner update" on public.quote_requests for update using(public.is_ln_owner()) with check(public.is_ln_owner());
create policy "v4 quotes owner delete" on public.quote_requests for delete using(public.is_ln_owner());

create policy "v4 audit read" on public.audit_log for select using(public.is_ln_owner() or public.can_view_event(event_id));

-- ---------- GRANTS ----------
grant usage on schema public to anon,authenticated;

-- Limpiar permisos heredados de versiones anteriores y volver a conceder solo lo necesario.
revoke all on table public.profiles,public.clients,public.templates,public.events,public.event_members,
  public.guest_groups,public.guests,public.rsvp_responses,public.access_passes,public.checkins,
  public.quote_requests,public.audit_log from anon,authenticated;

-- Lectura autenticada siempre filtrada por RLS.
grant select on table public.profiles,public.clients,public.templates,public.events,public.event_members,
  public.guest_groups,public.guests,public.rsvp_responses,public.access_passes,public.checkins,
  public.quote_requests,public.audit_log to authenticated;

-- Escrituras usadas directamente por el panel. Las políticas RLS deciden en qué filas.
grant insert,update,delete on table public.clients,public.templates,public.events,public.guest_groups,public.guests to authenticated;
grant update,delete on table public.rsvp_responses to authenticated;
grant update,delete on table public.quote_requests to authenticated;

-- El perfil propio solo puede modificar su nombre; nunca puede elevar su rol.
grant update(full_name) on table public.profiles to authenticated;

-- El catálogo público solo puede leer plantillas activas por RLS.
grant select on table public.templates to anon;

-- Las funciones SECURITY DEFINER no conservan el EXECUTE público predeterminado.
revoke all on function public.handle_ln_user() from public,anon,authenticated;
revoke all on function public.protect_event_core_fields() from public,anon,authenticated;
revoke all on function public.create_access_pass(uuid) from public,anon,authenticated;
revoke all on function public.get_public_event(uuid) from public,anon,authenticated;
revoke all on function public.submit_public_rsvp(uuid,text,text,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.submit_quote_request(text,text,text,text,text,date,integer,text,text[],text) from public,anon,authenticated;
revoke all on function public.lookup_access_pass(uuid,uuid) from public,anon,authenticated;
revoke all on function public.process_checkin(uuid,integer,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.upsert_event_member(uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.convert_quote_to_client(uuid) from public,anon,authenticated;

grant execute on function public.get_public_event(uuid) to anon,authenticated;
grant execute on function public.submit_public_rsvp(uuid,text,text,text,text,integer,text,text,text) to anon,authenticated;
grant execute on function public.submit_quote_request(text,text,text,text,text,date,integer,text,text[],text) to anon,authenticated;
grant execute on function public.lookup_access_pass(uuid,uuid) to authenticated;
grant execute on function public.process_checkin(uuid,integer,text,text,text,uuid) to authenticated;
grant execute on function public.upsert_event_member(uuid,text,text,boolean) to authenticated;
grant execute on function public.convert_quote_to_client(uuid) to authenticated;

-- ---------- SEMILLAS ----------
insert into public.templates(template_key,name,category,description,preview_url)
values
 ('biker-rebel-neon','Rebel Neon','biker','Plantilla biker pública con datos ficticios.','invitacion.html?modelo=biker-rebel-neon'),
 ('aniversario-fantasmas','Fantasmas Oficial','anniversary','Plantilla privada oficial de Fantasmas Biker’s Shop.',null),
 ('boda-eternite','Éternité','wedding','Diseño editorial elegante para boda.','invitacion.html?modelo=boda-eternite'),
 ('xv-eclat','Éclat','xv','Diseño premium para XV años.','invitacion.html?modelo=xv-eclat')
on conflict(template_key) do update set name=excluded.name,category=excluded.category,description=excluded.description,preview_url=excluded.preview_url,active=true,updated_at=now();

-- Propietario confirmado en esta cuenta.
insert into public.profiles(id,email,full_name,global_role,active)
values('ad2e7866-08f8-473a-bf94-42d8e6d319ba','lnstudio.eventos@gmail.com','LN Studio','owner',true)
on conflict(id) do update set email=excluded.email,global_role='owner',active=true,updated_at=now();

-- Primer cliente y primer evento real.
insert into public.clients(id,business_name,contact_name,email,phone,created_by)
values('11111111-1111-4111-8111-111111111111','Fantasmas Biker''s Shop','Fantasmas Biker''s Shop','lnstudio.eventos@gmail.com','5610329215','ad2e7866-08f8-473a-bf94-42d8e6d319ba')
on conflict(id) do update set business_name=excluded.business_name,contact_name=excluded.contact_name,email=excluded.email,phone=excluded.phone,updated_at=now();

insert into public.events(
 id,client_id,name,event_type,slug,private_token,template_key,event_date,venue_name,venue_address,maps_url,
 description,dress_code,logo_url,secondary_logo_url,theme_primary,theme_secondary,status,created_by
)
values(
 '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',
 'Primer aniversario Fantasmas','anniversary','primer-aniversario-fantasmas',gen_random_uuid(),
 'aniversario-fantasmas','2026-08-29 15:00:00-06','Fantasmas Biker''s Shop',
 'Avenida Gobernadora 656, Tolotzin I, Ecatepec, Estado de México','https://maps.app.goo.gl/NqPb7tJ6CNmK2Siq6',
 'Primer aniversario de Fantasmas Biker''s Shop y lanzamiento de Aliados Fantasma.','Estilo biker / casual',
 'logo-fantasmas-oficial.png','logo-aliados-oficial.png','#ff006e','#113de8','published','ad2e7866-08f8-473a-bf94-42d8e6d319ba'
)
on conflict(id) do update set
 client_id=excluded.client_id,name=excluded.name,event_type=excluded.event_type,template_key=excluded.template_key,
 event_date=excluded.event_date,venue_name=excluded.venue_name,venue_address=excluded.venue_address,maps_url=excluded.maps_url,
 description=excluded.description,dress_code=excluded.dress_code,logo_url=excluded.logo_url,
 secondary_logo_url=excluded.secondary_logo_url,theme_primary=excluded.theme_primary,
 theme_secondary=excluded.theme_secondary,status='published',updated_at=now();

-- Si una versión anterior dejó el token demostrativo conocido, rotarlo una sola vez.
update public.events
   set private_token=gen_random_uuid(),updated_at=now()
 where id='22222222-2222-4222-8222-222222222222'
   and private_token='33333333-3333-4333-8333-333333333333';

-- Forzar a PostgREST a recargar tablas, relaciones y funciones.
notify pgrst, 'reload schema';
