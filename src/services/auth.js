/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Camada de autenticação. Funciona em dois modos, de forma transparente:
 *
 *   • MODO SUPABASE  -> usa Supabase Auth (produção)
 *   • MODO DEMO      -> usa localStorage (sem backend, para demonstração)
 *
 * API pública:
 *   Auth.signUp({ nome, email, password })
 *   Auth.signIn({ email, password })
 *   Auth.signOut()
 *   Auth.getUser()            -> { id, nome, email } | null
 *   Auth.requireAuth()        -> redireciona p/ login se não autenticado
 *   Auth.redirectIfAuthed()   -> redireciona p/ dashboard se já autenticado
 *   Auth.resetPassword(email)
 *   Auth.updatePassword(newPassword)
 * ---------------------------------------------------------------------------
 */
import { supabase, isDemoMode, isSupabaseConfigured, setDemoModeOverride, didAutoFallback } from "./supabase.js";
import { DEMO_ACCOUNT } from "./config.js";

const DEMO_USERS_KEY = "bibliotech_demo_users";
const DEMO_SESSION_KEY = "bibliotech_demo_session";

/* ------------------------------------------------------------------ helpers */
const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/** Hash leve só para não guardar a senha em texto puro no modo demo. */
async function lightHash(text) {
  const data = new TextEncoder().encode(text + "::bibliotech");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Garante que a conta de demonstração exista no modo offline. */
async function ensureDemoSeedUser() {
  const users = read(DEMO_USERS_KEY, []);
  if (!users.some((u) => u.email === DEMO_ACCOUNT.email)) {
    users.push({
      id: crypto.randomUUID(),
      nome: DEMO_ACCOUNT.nome,
      email: DEMO_ACCOUNT.email,
      senha: await lightHash(DEMO_ACCOUNT.senha),
      created_at: new Date().toISOString(),
    });
    write(DEMO_USERS_KEY, users);
  }
}

/* =========================================================================
 *  IMPLEMENTAÇÃO — MODO DEMO
 * ========================================================================= */
const demoAuth = {
  async signUp({ nome, email, password }) {
    await ensureDemoSeedUser();
    const users = read(DEMO_USERS_KEY, []);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Este e-mail já está cadastrado.");
    }
    const user = {
      id: crypto.randomUUID(),
      nome,
      email,
      senha: await lightHash(password),
      created_at: new Date().toISOString(),
    };
    users.push(user);
    write(DEMO_USERS_KEY, users);
    return { id: user.id, nome, email };
  },

  async signIn({ email, password }) {
    await ensureDemoSeedUser();
    const users = read(DEMO_USERS_KEY, []);
    const hash = await lightHash(password);
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.senha === hash
    );
    if (!user) throw new Error("E-mail ou senha incorretos.");
    const session = { id: user.id, nome: user.nome, email: user.email };
    write(DEMO_SESSION_KEY, session);
    return session;
  },

  async signOut() {
    localStorage.removeItem(DEMO_SESSION_KEY);
  },

  async getUser() {
    return read(DEMO_SESSION_KEY, null);
  },

  async resetPassword(email) {
    const users = read(DEMO_USERS_KEY, []);
    if (!users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("E-mail não encontrado no sistema.");
    }
    // No modo demo apenas simulamos o envio do e-mail.
    return true;
  },

  async updatePassword(newPassword) {
    const session = read(DEMO_SESSION_KEY, null);
    if (!session) throw new Error("Sessão expirada.");
    const users = read(DEMO_USERS_KEY, []);
    const idx = users.findIndex((u) => u.id === session.id);
    if (idx === -1) throw new Error("Usuário não encontrado.");
    users[idx].senha = await lightHash(newPassword);
    write(DEMO_USERS_KEY, users);
    return true;
  },
};

/* =========================================================================
 *  IMPLEMENTAÇÃO — MODO SUPABASE
 * ========================================================================= */
const supaAuth = {
  async signUp({ nome, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });
    if (error) throw new Error(traduzErro(error.message));
    return { id: data.user?.id, nome, email };
  },

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(traduzErro(error.message));
    const meta = data.user?.user_metadata || {};
    return { id: data.user.id, nome: meta.nome || meta.full_name || email, email };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return null;
    const meta = data.user.user_metadata || {};
    return {
      id: data.user.id,
      nome: meta.nome || meta.full_name || data.user.email,
      email: data.user.email,
    };
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname.replace(/[^/]*$/, "")}reset-password.html`,
    });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  },
};

/** Traduz mensagens comuns do Supabase para PT-BR. */
function traduzErro(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (m.includes("password should be")) return "A senha deve ter ao menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um instante.";
  return msg;
}

/* =========================================================================
 *  FACADE PÚBLICA
 * ========================================================================= */
const impl = isDemoMode ? demoAuth : supaAuth;

export const Auth = {
  isDemoMode,
  isSupabaseConfigured,
  didAutoFallback,
  setOfflineMode: (enabled) => setDemoModeOverride(enabled),

  signUp: (p) => impl.signUp(p),
  signIn: (p) => impl.signIn(p),
  signOut: () => impl.signOut(),
  getUser: () => impl.getUser(),
  resetPassword: (email) => impl.resetPassword(email),
  updatePassword: (pwd) => impl.updatePassword(pwd),

  /** Protege uma página: manda para o login se não houver sessão. */
  async requireAuth() {
    const user = await impl.getUser();
    if (!user) {
      location.replace("login.html");
      return null;
    }
    return user;
  },

  /** Em páginas públicas (login): se já logado, vai para o dashboard. */
  async redirectIfAuthed() {
    const user = await impl.getUser();
    if (user) location.replace("dashboard.html");
    return user;
  },
};
