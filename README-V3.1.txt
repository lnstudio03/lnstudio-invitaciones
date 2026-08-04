LN STUDIO v3.1

CORRECCIONES
- El sitio público ya no enlaza ni muestra el aniversario real.
- El catálogo contiene únicamente invitaciones ficticias de muestra.
- invitacion.html abre por defecto una boda ficticia.
- El dashboard ya no depende de la relación embebida events/clients para cargar.
- Se incluye MIGRACION-v3.1.sql para reparar la llave foránea y recargar el esquema de Supabase.

INSTALACIÓN
1. Sustituye todos los archivos del repositorio por esta versión.
2. Ejecuta MIGRACION-v3.1.sql en Supabase SQL Editor.
3. Espera el despliegue de Cloudflare y prueba en incógnito.

La invitación real permanece únicamente en evento.html mediante token privado y dentro del panel administrativo.
