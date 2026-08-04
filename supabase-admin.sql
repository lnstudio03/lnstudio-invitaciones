-- ============================================================
-- LN STUDIO · AUTORIZAR CUENTA ADMINISTRATIVA
-- ============================================================
-- PASO PREVIO:
-- Supabase > Authentication > Users > Add user.
-- Crea primero el usuario lnstudio.eventos@gmail.com y su contraseña.
-- Después ejecuta este archivo en SQL Editor.

insert into public.admin_users (user_id, email)
select id, email
from auth.users
where lower(email) = lower('lnstudio.eventos@gmail.com')
on conflict (user_id) do update
set email = excluded.email;

-- Debe devolver una fila. Si devuelve cero, el usuario todavía no existe
-- o no se creó con ese correo.
select
  admin_users.user_id,
  admin_users.email,
  admin_users.created_at
from public.admin_users
where lower(admin_users.email) = lower('lnstudio.eventos@gmail.com');
