-- LN Studio v3.3 · Módulos owner, plantillas y solicitudes
create extension if not exists pgcrypto;
create table if not exists public.templates (
 id uuid primary key default gen_random_uuid(), template_key text not null unique, name text not null, category text not null default 'social', description text, active boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.quote_requests (
 id uuid primary key default gen_random_uuid(), folio text unique, name text not null, email text, phone text, city text, event_type text not null, event_date date, guest_count integer, style text, features text[] not null default '{}', details text, status text not null default 'new' check(status in ('new','contacted','converted','archived')), converted_client_id uuid references public.clients(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.templates enable row level security; alter table public.quote_requests enable row level security;
drop policy if exists "templates public read" on public.templates; create policy "templates public read" on public.templates for select using(active or public.is_ln_owner());
drop policy if exists "templates owner write" on public.templates; create policy "templates owner write" on public.templates for all using(public.is_ln_owner()) with check(public.is_ln_owner());
drop policy if exists "quotes owner read" on public.quote_requests; create policy "quotes owner read" on public.quote_requests for select using(public.is_ln_owner());
drop policy if exists "quotes owner update" on public.quote_requests; create policy "quotes owner update" on public.quote_requests for update using(public.is_ln_owner()) with check(public.is_ln_owner());
create or replace function public.submit_quote_request(p_name text,p_email text,p_phone text,p_city text,p_event_type text,p_event_date date,p_guest_count integer,p_style text,p_features text[],p_details text) returns jsonb language plpgsql security definer set search_path=public as $$ declare q public.quote_requests; n integer; begin select count(*)+1 into n from public.quote_requests where extract(year from created_at)=extract(year from now()); insert into public.quote_requests(folio,name,email,phone,city,event_type,event_date,guest_count,style,features,details) values('LN-'||extract(year from now())::int||'-'||lpad(n::text,5,'0'),trim(p_name),nullif(trim(p_email),''),nullif(trim(p_phone),''),nullif(trim(p_city),''),p_event_type,p_event_date,p_guest_count,p_style,coalesce(p_features,'{}'),p_details) returning * into q; return jsonb_build_object('ok',true,'folio',q.folio,'id',q.id); end $$;
grant execute on function public.submit_quote_request(text,text,text,text,text,date,integer,text,text[],text) to anon, authenticated;
insert into public.templates(template_key,name,category,description) values ('biker-rebel-neon','Rebel Neon','biker','Plantilla biker ficticia azul y rosa.'),('aniversario-fantasmas','Fantasmas Oficial','anniversary','Invitación privada oficial de Fantasmas Biker’s Shop.'),('boda-eternite','Éternité','wedding','Diseño editorial para boda.'),('xv-eclat','Éclat','xv','Diseño premium para XV años.') on conflict(template_key) do nothing;
notify pgrst, 'reload schema';
