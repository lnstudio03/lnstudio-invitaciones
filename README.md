# LN Studio v1.0 Oficial

Sitio público oficial de LN Studio.

## Identidad real
- Marca: LN Studio
- Eslogan: Creamos experiencias que cuentan historias.
- Instagram: @lnstudio.invitaciones
- Correo: lnstudio.eventos@gmail.com
- Logo: logo.png

## Publicación
Todos los archivos deben permanecer directamente en la raíz del repositorio de GitHub.

Cloudflare Pages:
- Framework preset: None
- Build command: vacío
- Build output directory: .
- Root directory: vacío
- Production branch: main

## Cotizaciones
La versión 1.0 no utiliza base de datos. El formulario:
1. Valida la información.
2. Guarda una copia temporal en el navegador del cliente.
3. Abre la aplicación de correo con la solicitud preparada para lnstudio.eventos@gmail.com.

La persistencia central, panel administrativo y notificaciones se conectarán con Supabase en una fase posterior.

## Archivos principales
- index.html: landing oficial
- catalogo.html: colecciones editoriales
- cotizar.html: asistente de cotización
- contacto.html: contacto
- 404.html: página de error
- style.css: diseño responsive
- app.js: interacción y formularios
- catalogo.json: contenido de colecciones
- manifest.webmanifest, robots.txt, sitemap.xml: SEO y PWA
- _headers, _redirects: Cloudflare Pages
