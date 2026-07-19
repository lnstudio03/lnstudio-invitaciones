/**
 * Configuración central de Supabase.
 * En el Módulo 1 se incluye la estructura segura de configuración.
 * Sustituye los valores cuando el proyecto Supabase esté creado.
 */

export const SUPABASE_CONFIG = Object.freeze({
  url: "",
  anonKey: ""
});

/**
 * Indica si las credenciales públicas de Supabase fueron configuradas.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}
