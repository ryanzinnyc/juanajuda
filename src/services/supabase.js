/**
 * supabase.js
 * ---------------------------------------------------------------------------
 * Inicializa o cliente Supabase (Auth + Banco de Dados).
 *
 * Quando as credenciais não estão configuradas (config.js), exportamos
 * `supabase = null` e o restante da aplicação usa o modo demonstração.
 *
 * Importamos o SDK de forma DINÂMICA só quando há configuração, para que o
 * modo demonstração funcione 100% offline (sem nenhuma chamada de rede).
 * ---------------------------------------------------------------------------
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_SUPABASE_CONFIGURED } from "./config.js";

export const isDemoMode = !IS_SUPABASE_CONFIGURED;

let _supabase = null;
if (IS_SUPABASE_CONFIGURED) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = _supabase;
