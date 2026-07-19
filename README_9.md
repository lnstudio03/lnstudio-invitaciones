# LN Studio — Módulo 1

Landing page premium para una plataforma de invitaciones digitales.

## Incluye

- Landing completa y responsive.
- Navegación móvil accesible.
- Colecciones cargadas desde JSON.
- Testimonios cargados desde JSON.
- Preguntas frecuentes dinámicas.
- Formulario funcional con validación y almacenamiento local temporal.
- Animaciones mediante Intersection Observer.
- SEO técnico inicial y metadatos sociales.
- Página 404.
- Estructura de recursos para imágenes, iconos, música, video y fuentes.
- Archivo base de configuración para Supabase.

## Ejecutar localmente

Los módulos JavaScript y los archivos JSON requieren un servidor HTTP local. No abras `index.html` directamente con doble clic.

Opciones simples:

1. Publicar la carpeta en GitHub Pages, Cloudflare Pages, Netlify o cualquier hosting estático.
2. Usar la extensión Live Server de Visual Studio Code.
3. Usar cualquier servidor HTTP estático disponible en tu equipo.

## Publicación

Sube todo el contenido de la carpeta `LN-Studio` a la raíz del hosting.

## Configuración pendiente para módulos posteriores

El archivo `js/supabase.js` está preparado para recibir:

- URL pública del proyecto Supabase.
- Clave pública `anon` de Supabase.

No uses la clave `service_role` dentro del navegador.

## Datos temporales

En este módulo, las solicitudes del formulario se almacenan en `localStorage` con la clave:

`lnstudio_leads`

En el módulo de backend se conectará este flujo con Supabase Database.

## Compatibilidad

- Chrome, Edge, Firefox y Safari modernos.
- Diseño mobile-first y responsive.
- Respeta `prefers-reduced-motion`.
