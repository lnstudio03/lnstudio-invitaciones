# LN Studio v2.0 · Catálogo, invitaciones y RSVP

Sitio estático oficial de LN Studio, preparado para publicarse directamente en Cloudflare Pages y GitHub sin proceso de compilación.

## Identidad
- Marca: LN Studio
- Eslogan: Creamos experiencias que cuentan historias.
- Instagram: @lnstudio.invitaciones
- Correo: lnstudio.eventos@gmail.com
- Logo principal: `logo.png`

## Novedades de esta versión
- Catálogo visual con 10 invitaciones de muestra.
- Cada modelo abre una experiencia completa y responsive.
- Invitación oficial para el primer aniversario de Fantasmas Biker's Shop.
- Lanzamiento de Aliados Fantasma integrado en la narrativa.
- Cuenta regresiva, ubicación, compartir y archivo para calendario.
- Formulario RSVP con respuesta, acompañantes, mensaje y folio.
- Panel de control de asistencia con métricas, filtros, check-in y exportación CSV.
- Funcionamiento inmediato en modo local.
- Integración opcional con Supabase para centralizar respuestas entre dispositivos.

## Archivos principales
- `index.html`: sitio público de LN Studio.
- `catalogo.html`, `catalogo.css`, `catalogo.js`, `catalogo.json`: catálogo interactivo.
- `invitacion.html`, `invitacion.css`, `invitation.js`: invitaciones dinámicas.
- `admin.html`, `dashboard.css`, `dashboard.js`: control de asistencia.
- `supabase.js`: credenciales públicas y PIN del modo local.
- `supabase.sql`: tablas, políticas RLS y evento oficial.
- `cotizar.html`, `contacto.html`: formularios de LN Studio.

## Probar de inmediato
1. Publica todos los archivos en la raíz del repositorio.
2. Abre `catalogo.html`.
3. Entra a “Aniversario Fantasma”.
4. Registra una respuesta.
5. Abre `admin.html` y usa el PIN local definido en `supabase.js`.

PIN local inicial: `LN2026`

El modo local guarda los RSVP únicamente en el navegador donde se registran. Sirve para pruebas y demostraciones.

## Conectar Supabase
1. Crea o utiliza un proyecto de Supabase.
2. Ejecuta `supabase.sql` en SQL Editor.
3. Crea un usuario administrador en Authentication > Users.
4. Copia la URL del proyecto y la clave pública `anon` en `supabase.js`.
5. Publica nuevamente los archivos.

Al detectar credenciales, la invitación enviará los RSVP a Supabase y `admin.html` pedirá correo y contraseña del usuario administrador.

Nunca coloques la clave `service_role` en estos archivos.

## Publicación en Cloudflare Pages
- Framework preset: None
- Build command: vacío
- Build output directory: `.`
- Root directory: vacío
- Production branch: `main`

Todos los archivos deben permanecer directamente en la raíz del repositorio.
