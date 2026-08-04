# LN Studio v4.0 — Plataforma de invitaciones

Esta entrega sustituye las versiones v2 y v3. Es un proyecto independiente de Aliados Fantasma y está conectado al proyecto propio de Supabase de LN Studio.

## Qué funciona

- Sitio público de LN Studio y catálogo con invitaciones ficticias.
- Plantilla pública biker sin datos reales de Fantasmas.
- Cotizador de 6 pasos con folio y almacenamiento en Supabase.
- Inicio de sesión seguro; nunca coloca correo ni contraseña en la URL.
- Recuperación y actualización de contraseña.
- Dashboard propietario para clientes, eventos, solicitudes, plantillas y usuarios.
- Alta y edición de clientes, eventos y plantillas.
- Conversión de cotización a cliente y preparación del evento.
- Roles por evento: cliente administrador, personal de acceso y solo lectura.
- Panel particular de cada evento.
- Configuración de textos, fecha, ubicación, logos, colores, música, RSVP y QR.
- Grupos/familias invitadas y límites de acceso.
- Invitación real privada, no indexada y separada del catálogo.
- RSVP público con pase y QR generado sin depender de un CDN.
- Escáner móvil, validación manual, accesos parciales, rechazo y control de duplicados.
- RLS y permisos de base de datos para separar los eventos de cada cliente.

## Instalación obligatoria

### 1. Base de datos

En Supabase abre `SQL Editor`, crea una consulta nueva y ejecuta COMPLETO:

`MIGRACION-v4.sql`

La migración puede volver a ejecutarse si una parte falla. Conserva los registros existentes y actualiza tablas, funciones, políticas y permisos.

Importante: la migración cambia automáticamente el antiguo token demostrativo del aniversario. Después de ejecutarla, abre la invitación desde el dashboard para obtener su enlace privado vigente.

### 2. Configuración de Auth

En Supabase entra a `Authentication > URL Configuration`.

Site URL:

`https://lnstudio-invitaciones.pages.dev`

Redirect URLs recomendadas:

- `https://lnstudio-invitaciones.pages.dev/admin`
- `https://lnstudio-invitaciones.pages.dev/admin.html`

La cuenta propietaria configurada es:

`lnstudio.eventos@gmail.com`

No es necesario cambiar la contraseña actual.

### 3. GitHub y Cloudflare Pages

1. Elimina del repositorio cualquier archivo antiguo llamado `_redirects`, `wrangler.jsonc` o `wrangler.toml`.
2. Reemplaza los archivos de la raíz por los incluidos en este ZIP.
3. Configuración de Cloudflare Pages:
   - Build command: vacío
   - Build output directory: `.`
   - Root directory: `/`
4. Espera a que el despliegue termine.

Acceso administrativo:

`https://lnstudio-invitaciones.pages.dev/admin`

## Flujo para un cliente

1. LN Studio crea el cliente y el evento.
2. En “Usuarios y accesos” asigna el correo del cliente al evento.
3. El cliente abre `/admin`, pulsa “Activar acceso” y usa exactamente ese correo.
4. Confirma su correo y entra al panel.
5. Solo verá los eventos que se le asignaron.

Para personal de entrada, asigna el rol “Personal de acceso / escáner”.

## Límites actuales

El núcleo operativo está implementado. Las siguientes funciones avanzadas todavía no forman parte de esta entrega:

- Carga de archivos a Supabase Storage desde el panel; por ahora logos, portada y música usan una ruta o URL.
- Envíos automáticos de WhatsApp o correo; el sistema registra datos y accesos, pero no envía mensajes por sí solo.
- Editor visual de arrastrar y soltar.
- Cobros, suscripciones y facturación.
- La lectura directa con cámara depende del soporte del navegador; siempre existe validación manual por token o enlace.

## Seguridad

Nunca coloques una `service_role`, `secret key` o contraseña dentro del proyecto. La única clave incluida es la publishable key del navegador. La seguridad se aplica mediante Auth, funciones controladas y políticas RLS.
