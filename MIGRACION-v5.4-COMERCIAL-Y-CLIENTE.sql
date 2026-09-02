-- LN Studio v5.4 · Cotizaciones, archivos privados, pagos, entregables,
-- solicitudes de cambio y aprobación formal.
-- Ejecutar DESPUÉS de MIGRACION-v4.sql y MIGRACION-v4.6.sql.

begin;

alter table public.quote_requests
  add column if not exists product text,
  add column if not exists package_key text,
  add column if not exists urgent boolean not null default false,
  add column if not exists upload_token uuid default gen_random_uuid();

alter table public.events
  add column if not exists design_config jsonb not null default '{}'::jsonb;

alter table public.events
  add column if not exists package_key text check (package_key in ('basic','intermediate','premium')),
  add column if not exists work_status text not null default 'brief' check (work_status in ('brief','design','client_review','approved','delivered')),
  add column if not exists total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  add column if not exists deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  add column if not exists balance_amount numeric(12,2) not null default 0 check (balance_amount >= 0),
  add column if not exists payment_due_date date,
  add column if not exists published_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists expiry_policy text check (expiry_policy in ('24h','7d','unlimited')),
  add column if not exists approved_at timestamptz;

create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quote_requests(id) on delete cascade,
  storage_path text not null unique, original_name text not null, mime_type text, size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);
create table if not exists public.event_deliverables (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  title text not null, file_path text, external_url text, status text not null default 'pending' check (status in ('pending','available','replaced')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.event_payments (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  concept text not null, amount numeric(12,2) not null check (amount > 0), status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  due_date date, paid_at timestamptz, reference text, created_at timestamptz not null default now()
);
create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  requested_by uuid not null default auth.uid(), request_type text not null default 'minor' check (request_type in ('major','minor')),
  message text not null check (char_length(message) between 5 and 3000), status text not null default 'new' check (status in ('new','reviewing','resolved','rejected')),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.event_approvals (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  approved_by uuid not null default auth.uid(), version_label text not null default 'Diseño final', notes text,
  created_at timestamptz not null default now()
);

alter table public.quote_attachments enable row level security;
alter table public.event_deliverables enable row level security;
alter table public.event_payments enable row level security;
alter table public.change_requests enable row level security;
alter table public.event_approvals enable row level security;

drop policy if exists "owner quote attachments" on public.quote_attachments;
create policy "owner quote attachments" on public.quote_attachments for all to authenticated using (public.is_ln_owner()) with check (public.is_ln_owner());
drop policy if exists "members view deliverables" on public.event_deliverables;
create policy "members view deliverables" on public.event_deliverables for select to authenticated using (public.can_view_event(event_id));
drop policy if exists "owner manage deliverables" on public.event_deliverables;
create policy "owner manage deliverables" on public.event_deliverables for all to authenticated using (public.is_ln_owner()) with check (public.is_ln_owner());
drop policy if exists "members view payments" on public.event_payments;
create policy "members view payments" on public.event_payments for select to authenticated using (public.can_view_event(event_id));
drop policy if exists "owner manage payments" on public.event_payments;
create policy "owner manage payments" on public.event_payments for all to authenticated using (public.is_ln_owner()) with check (public.is_ln_owner());
drop policy if exists "members view changes" on public.change_requests;
create policy "members view changes" on public.change_requests for select to authenticated using (public.can_view_event(event_id));
drop policy if exists "client requests changes" on public.change_requests;
create policy "client requests changes" on public.change_requests for insert to authenticated with check (public.can_admin_event(event_id) and requested_by = auth.uid());
drop policy if exists "owner manages changes" on public.change_requests;
create policy "owner manages changes" on public.change_requests for all to authenticated using (public.is_ln_owner()) with check (public.is_ln_owner());
drop policy if exists "members view approvals" on public.event_approvals;
create policy "members view approvals" on public.event_approvals for select to authenticated using (public.can_view_event(event_id));
drop policy if exists "members create approvals" on public.event_approvals;
create policy "members create approvals" on public.event_approvals for insert to authenticated with check (public.can_admin_event(event_id) and approved_by = auth.uid());
drop policy if exists "owner manages approvals" on public.event_approvals;
create policy "owner manages approvals" on public.event_approvals for all to authenticated using (public.is_ln_owner()) with check (public.is_ln_owner());

create or replace function public.submit_quote_request_v2(
  p_name text, p_email text, p_phone text, p_city text, p_event_type text, p_event_date date,
  p_guest_count integer, p_style text, p_features text[], p_details text, p_product text, p_package text, p_urgent boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_folio text; v_token uuid;
begin
  if char_length(trim(coalesce(p_name,''))) < 2 or char_length(trim(coalesce(p_phone,''))) < 8 then raise exception 'Datos de contacto incompletos'; end if;
  v_folio := 'LN-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_token := gen_random_uuid();
  insert into public.quote_requests(name,email,phone,city,event_type,event_date,guest_count,style,features,details,product,package_key,urgent,folio,upload_token)
  values(trim(p_name),lower(trim(p_email)),trim(p_phone),trim(p_city),trim(p_event_type),p_event_date,p_guest_count,trim(p_style),coalesce(p_features,'{}'),left(coalesce(p_details,''),3000),trim(p_product),trim(p_package),coalesce(p_urgent,false),v_folio,v_token)
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'folio',v_folio,'upload_token',v_token);
end $$;

create or replace function public.register_quote_attachment(p_quote_id uuid,p_upload_token uuid,p_path text,p_name text,p_type text,p_size bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.quote_requests where id=p_quote_id and upload_token=p_upload_token and created_at > now()-interval '2 hours') then raise exception 'Solicitud de archivo no válida'; end if;
  if p_path not like p_quote_id::text || '/' || p_upload_token::text || '/%' or p_size < 1 or p_size > 10485760 then raise exception 'Archivo no válido'; end if;
  insert into public.quote_attachments(quote_id,storage_path,original_name,mime_type,size_bytes) values(p_quote_id,p_path,left(p_name,240),left(p_type,120),p_size);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.approve_event_design(p_event_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.can_admin_event(p_event_id) then raise exception 'Sin permiso para aprobar'; end if;
  insert into public.event_approvals(event_id,approved_by,notes) values(p_event_id,auth.uid(),left(coalesce(p_notes,''),1000));
  update public.events set work_status='approved',approved_at=now(),updated_at=now() where id=p_event_id;
  return jsonb_build_object('ok',true,'approved_at',now());
end $$;

create or replace function public.get_public_event(p_token uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select case when e.id is null then null else jsonb_build_object(
    'id',e.id,'name',e.name,'event_type',e.event_type,'template_key',e.template_key,
    'event_date',e.event_date,'venue_name',e.venue_name,'venue_address',e.venue_address,
    'maps_url',e.maps_url,'description',e.description,'dress_code',e.dress_code,
    'logo_url',e.logo_url,'secondary_logo_url',e.secondary_logo_url,'hero_image_url',e.hero_image_url,
    'music_url',e.music_url,'theme_primary',e.theme_primary,'theme_secondary',e.theme_secondary,
    'design_config',coalesce(e.design_config,'{}'::jsonb),
    'custom_text',e.custom_text,'schedule',e.schedule,'max_companions',e.max_companions,
    'allow_general_rsvp',e.allow_general_rsvp,'allow_guest_edits',e.allow_guest_edits,
    'qr_enabled',e.qr_enabled,'status',e.status,'expires_at',e.expires_at
  ) end
  from public.events e where e.private_token=p_token and e.status in ('published','finished') limit 1;
$$;

revoke all on function public.submit_quote_request_v2(text,text,text,text,text,date,integer,text,text[],text,text,text,boolean) from public;
grant execute on function public.submit_quote_request_v2(text,text,text,text,text,date,integer,text,text[],text,text,text,boolean) to anon,authenticated;
revoke all on function public.register_quote_attachment(uuid,uuid,text,text,text,bigint) from public;
grant execute on function public.register_quote_attachment(uuid,uuid,text,text,text,bigint) to anon,authenticated;
grant execute on function public.approve_event_design(uuid,text) to authenticated;
grant execute on function public.get_public_event(uuid) to anon,authenticated;
grant select on public.event_deliverables,public.event_payments,public.change_requests,public.event_approvals,public.quote_attachments to authenticated;
grant insert on public.change_requests,public.event_approvals to authenticated;
grant insert,update,delete on public.event_deliverables,public.event_payments,public.change_requests,public.event_approvals to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('quote-attachments','quote-attachments',false,10485760,array['image/jpeg','image/png','image/webp','video/mp4','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "temporary private quote uploads" on storage.objects;
create policy "temporary private quote uploads" on storage.objects for insert to anon,authenticated
with check (bucket_id='quote-attachments' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$');
drop policy if exists "owner reads quote uploads" on storage.objects;
create policy "owner reads quote uploads" on storage.objects for select to authenticated using (bucket_id='quote-attachments' and public.is_ln_owner());

commit;
