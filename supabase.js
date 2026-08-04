/**
 * Configuración pública de Supabase para LN Studio.
 * La invitación funciona de inmediato en modo local. Al completar estas dos
 * credenciales, los RSVP se centralizan y el panel puede consultarlos desde
 * cualquier dispositivo.
 */
export const SUPABASE_CONFIG = Object.freeze({
  url: "",
  anonKey: "",
  localAdminPin: "LN2026"
});

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

let clientPromise = null;

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      }));
  }
  return clientPromise;
}
