# LN Studio

Sitio estático para diseñar, publicar y administrar invitaciones digitales. Incluye catálogo de muestras, cotizaciones, invitaciones con RSVP, paneles de evento y herramientas de acceso QR.

## Desarrollo local

Sirve la carpeta raíz mediante HTTP para que funcionen los módulos JavaScript y los archivos JSON. Por ejemplo, usa Live Server en VS Code o ejecuta `python -m http.server 8000` desde esta carpeta y abre `http://localhost:8000`.

## Publicación

Publica el contenido de esta carpeta en la raíz de un hosting estático compatible con las reglas de `_headers`. Las funciones de invitaciones y administración requieren la configuración correspondiente de Supabase; nunca coloques una clave `service_role` en el código del navegador.

### Diseñador de invitaciones

Antes de habilitar el diseñador en producción, ejecuta una vez `INSTALAR-v6.1-SINCRONIA-PUBLICA.sql` en Supabase > SQL Editor. Su consulta de verificación debe confirmar `rpc_v7_incluye_design_config = true`, el bucket `invitation-assets` como público y los MIME de los archivos que se vayan a usar. El usuario editor también necesita un perfil activo con rol `owner` o `staff` y permisos para administrar el evento.

Tras publicar, abre un evento de prueba, guarda un cambio y revisa la invitación con su enlace público en celular y escritorio. Confirma también las cargas de imagen/audio/video que vaya a utilizar el sitio; no se deben probar con invitaciones reales sin autorización.

### Detalles de temporada

El sitio público aplica efectos visuales de temporada según el calendario de México: San Valentín (1–14 de febrero), Día de las Madres (1–10 de mayo), Día del Padre (la semana de esa fecha), Independencia (10–16 de septiembre), Día de Muertos (24 de octubre–2 de noviembre), Navidad (15 de noviembre–25 de diciembre) y Año Nuevo (26 de diciembre–6 de enero). Incluye partículas y acentos temáticos en las portadas públicas y la muestra de invitación; no cambia el diseño de invitaciones privadas de clientes.
