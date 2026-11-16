# LN Studio

Sitio estático para diseñar, publicar y administrar invitaciones digitales. Incluye catálogo de muestras, cotizaciones, invitaciones con RSVP, paneles de evento y herramientas de acceso QR.

## Desarrollo local

Sirve la carpeta raíz mediante HTTP para que funcionen los módulos JavaScript y los archivos JSON. Por ejemplo, usa Live Server en VS Code o ejecuta `python -m http.server 8000` desde esta carpeta y abre `http://localhost:8000`.

## Publicación

Publica el contenido de esta carpeta en la raíz de un hosting estático compatible con las reglas de `_headers`. Las funciones de invitaciones y administración requieren la configuración correspondiente de Supabase; nunca coloques una clave `service_role` en el código del navegador.

### Diseñador de invitaciones

Antes de habilitar el diseñador en producción, ejecuta una vez `INSTALAR-v6.1-SINCRONIA-PUBLICA.sql` en Supabase > SQL Editor. Su consulta de verificación debe confirmar `rpc_v7_incluye_design_config = true`, el bucket `invitation-assets` como público y los MIME de los archivos que se vayan a usar. El usuario editor también necesita un perfil activo con rol `owner` o `staff` y permisos para administrar el evento.

Tras publicar, abre un evento de prueba, guarda un cambio y revisa la invitación con su enlace público en celular y escritorio. Confirma también las cargas de imagen/audio/video que vaya a utilizar el sitio; no se deben probar con invitaciones reales sin autorización.
