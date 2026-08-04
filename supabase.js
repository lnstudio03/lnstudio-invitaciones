/**
 * Configuración pública de Supabase para LN Studio.
 *
 * Pega únicamente:
 * 1) Project URL
 * 2) Publishable key (empieza normalmente con sb_publishable_)
 *
 * Nunca coloques aquí una secret key ni una service_role key.
 */
export const SUPABASE_CONFIG = Object.freeze({
  url: "",
  publishableKey: "",
  localAdminPin: "LN2026"
});

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey);
}

let clientPromise = null;

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.publishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      ));
  }

  return clientPromise;
}
