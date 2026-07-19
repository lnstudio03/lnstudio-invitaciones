# LN Studio — Módulo 1

Landing premium de LN Studio construida con HTML5, CSS3, JavaScript ES6 y JSON.

## Publicación

Todos los archivos están en la raíz. Para GitHub, sube el contenido descomprimido directamente al repositorio; no subas únicamente el ZIP.

Cloudflare detectará automáticamente los cambios del repositorio. Este paquete incluye `wrangler.jsonc` para desplegar los archivos estáticos desde la raíz mediante Workers Static Assets.

## Archivos principales

- `index.html`: landing principal.
- `style.css`, `landing.css`, `animations.css`: estilos.
- `app.js`, `landing.js`, `utils.js`: aplicación de la landing.
- `catalogo.json`, `templates.json`, `faq.json`, `testimonials.json`: datos iniciales.
- `logo-ln-studio.svg`, `og-ln-studio.svg`, `favicon.svg`: identidad visual.
- `admin.html`, `login.html`, `clientes.html`, `pedidos.html`, `plantillas.html`, `configuracion.html`: páginas base reservadas para módulos posteriores.
- `wrangler.jsonc`: configuración de despliegue en Cloudflare.

## Supabase

`supabase.js` contiene los espacios de configuración que se conectarán en los módulos posteriores. No publiques claves privadas; el navegador únicamente debe usar la URL del proyecto y la clave pública anónima.
