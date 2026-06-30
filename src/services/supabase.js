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

export const DEMO_MODE_OVERRIDE_KEY = "bibliotech_force_demo_mode";
export const isSupabaseConfigured = IS_SUPABASE_CONFIGURED;

export function isDemoModeForced() {
  try {
    return localStorage.getItem(DEMO_MODE_OVERRIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoModeOverride(enabled) {
  try {
    if (enabled) localStorage.setItem(DEMO_MODE_OVERRIDE_KEY, "1");
    else localStorage.removeItem(DEMO_MODE_OVERRIDE_KEY);
  } catch {
    // Ignore storage errors and keep the default mode.
  }
}

export let isDemoMode = !IS_SUPABASE_CONFIGURED || isDemoModeForced();

/**
 * Sinaliza que houve um fallback automático para o modo demonstração porque o
 * Supabase estava configurado mas indisponível (rede caiu, projeto pausado ou
 * schema ainda não aplicado). Usado pela UI para avisar o usuário.
 */
export let didAutoFallback = false;

let _supabase = null;
if (!isDemoMode) {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    // Health-check: garante que as tabelas respondem antes de confiar no
    // backend. Se o projeto estiver fora do ar ou sem o schema aplicado,
    // caímos automaticamente no modo demonstração para o app sempre funcionar.
    const query = _supabase
      .from("livros")
      .select("id")
      .limit(1)
      .then((r) => r, (e) => ({ error: e })); // nunca rejeita (evita unhandled)
    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ error: { message: "timeout" } }), 6000)
    );
    const probe = await Promise.race([query, timeout]);
    if (probe?.error) {
      throw new Error(probe.error.message || "Supabase indisponível");
    }
  } catch (err) {
    console.warn("Supabase indisponível; usando o modo demonstração.", err);
    isDemoMode = true;
    didAutoFallback = true;
    _supabase = null;
  }
}

export const supabase = _supabase;
