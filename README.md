# LN Studio v2.1 · Catálogo, invitación y RSVP con Supabase

Sitio estático independiente de LN Studio, preparado para GitHub y Cloudflare Pages sin frameworks ni proceso de compilación.

## Identidad
- Marca: LN Studio
- Eslogan: Creamos experiencias que cuentan historias.
- Instagram: @lnstudio.invitaciones
- Correo administrativo: lnstudio.eventos@gmail.com
- Logo principal: `logo.png`

## Incluye
- Catálogo visual con invitaciones de muestra.
- Invitación oficial del primer aniversario de Fantasmas Biker's Shop.
- Lanzamiento de Aliados Fantasma integrado únicamente como contenido del evento.
- Cuenta regresiva, ubicación, compartir y calendario.
- Confirmación de asistencia, acompañantes, mensajes y folios.
- Panel administrativo con métricas, búsqueda, filtros, check-in y CSV.
- Integración separada con Supabase para LN Studio.

## Configuración segura de Supabase

### 1. Crear el proyecto independiente
Usa la cuenta de LN Studio y crea una organización llamada `LN Studio`.

Nombre recomendado del proyecto:
`lnstudio-invitaciones`

Guarda la contraseña de la base de datos en un lugar seguro.

### 2. Crear las tablas y políticas
En Supabase abre:
`SQL Editor > New query`

Copia y ejecuta todo el archivo:
`supabase.sql`

### 3. Crear el administrador
Abre:
`Authentication > Users > Add user`

Crea el usuario:
`lnstudio.eventos@gmail.com`

Usa una contraseña fuerte y confirma el usuario desde el panel cuando esa opción aparezca.

Después vuelve a `SQL Editor` y ejecuta:
`supabase-admin.sql`

La consulta final debe mostrar una fila con el correo administrativo.

### 4. Desactivar registros públicos de usuarios
En `Authentication > Sign In / Providers` o la configuración general de Auth, desactiva:
`Allow new users to sign up`

Los invitados no necesitan cuenta. El formulario RSVP escribe usando la clave pública y las políticas RLS.

### 5. Copiar las credenciales públicas
Abre `Project Settings > API` o el panel `Connect` del proyecto y copia:

- Project URL
- Publishable key (`sb_publishable_...`)

Pégalas en `supabase.js`:

```js
export const SUPABASE_CONFIG = Object.freeze({
  url: "https://TU-PROYECTO.supabase.co",
  publishableKey: "sb_publishable_TU_CLAVE",
  localAdminPin: "LN2026"
});
```

La publishable key puede estar en el navegador. Nunca pegues una secret key ni una `service_role` key en los archivos del sitio.

### 6. Publicar y probar
1. Sube todos los archivos a la raíz del repositorio de LN Studio.
2. Publica en Cloudflare Pages.
3. Abre `invitacion.html?modelo=aniversario-fantasmas`.
4. Registra una confirmación.
5. Abre `admin.html`.
6. Inicia sesión con `lnstudio.eventos@gmail.com` y la contraseña creada.
7. Comprueba que aparece la respuesta y prueba el check-in.

## Modo local
Mientras `url` y `publishableKey` estén vacías, el proyecto sigue funcionando en modo local para pruebas. Los datos locales solo existen en ese navegador y no son el sistema definitivo.

## Archivos de Supabase
- `supabase.js`: Project URL y publishable key.
- `supabase.sql`: tablas, evento, RLS y Realtime.
- `supabase-admin.sql`: autoriza al usuario administrador.

## Cloudflare Pages
- Framework preset: None
- Build command: vacío
- Build output directory: `.`
- Root directory: vacío
- Production branch: `main`

Todos los archivos permanecen directamente en la raíz del repositorio.
