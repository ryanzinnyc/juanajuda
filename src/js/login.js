/**
 * login.js — login, cadastro e recuperação de senha.
 */
import { Auth } from "../services/auth.js";
import { Toast, setBtnLoading, icons } from "./app.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBER_KEY = "bibliotech_remember_email";

/* ----------------------------- validação -------------------------------- */
const fieldOf = (input) => input.closest(".field");
function setError(input, msg) {
  const f = fieldOf(input);
  f.classList.add("invalid");
  if (msg) f.querySelector(".field-error").textContent = msg;
  return false;
}
function clearError(input) {
  fieldOf(input)?.classList.remove("invalid");
  return true;
}

/* --------------------------- troca de views ----------------------------- */
const VIEWS = {
  login: "#form-login",
  signup: "#form-signup",
  forgot: "#form-forgot",
};
function showView(name) {
  Object.entries(VIEWS).forEach(([k, sel]) => $(sel).classList.toggle("hidden", k !== name));
  $$(".field.invalid").forEach((f) => f.classList.remove("invalid"));
}
$$("[data-go]").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    showView(a.dataset.go);
  })
);

function applyModeUI() {
  $("#demo-banner")?.classList.toggle("hidden", !Auth.isDemoMode);
  $("#use-offline-login")?.classList.toggle(
    "hidden",
    Auth.isDemoMode || !Auth.isSupabaseConfigured
  );
  $("#use-online-login")?.classList.toggle(
    "hidden",
    !Auth.isDemoMode || !Auth.isSupabaseConfigured
  );
}

$("#use-offline-login")?.addEventListener("click", () => {
  Auth.setOfflineMode(true);
  Toast.success("Modo offline ativado", "Use admin@biblioteca.com / 123456.");
  setTimeout(() => location.reload(), 350);
});

$("#use-online-login")?.addEventListener("click", () => {
  Auth.setOfflineMode(false);
  Toast.success("Modo Supabase ativado", "Use sua conta cadastrada.");
  setTimeout(() => location.reload(), 350);
});

/* --------------------------- mostrar/ocultar ---------------------------- */
$$(".toggle-pass").forEach((btn) =>
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`;
    icons();
  })
);

/* --------------------------- força da senha ----------------------------- */
const COLORS = ["#f87171", "#fbbf24", "#38bdf8", "#34d399"];
$("#su-pass")?.addEventListener("input", (e) => {
  const v = e.target.value;
  let score = 0;
  if (v.length >= 6) score++;
  if (v.length >= 10) score++;
  if (/[0-9]/.test(v) && /[a-zA-Z]/.test(v)) score++;
  if (/[^a-zA-Z0-9]/.test(v)) score++;
  score = Math.min(score, 4);
  const bar = $("#pwd-bar");
  bar.style.width = `${(score / 4) * 100}%`;
  bar.style.background = COLORS[Math.max(0, score - 1)] || "transparent";
});

/* ============================ LOGIN ===================================== */
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#login-email");
  const pass = $("#login-pass");
  let ok = true;
  ok = (EMAIL_RX.test(email.value.trim()) ? clearError(email) : setError(email)) && ok;
  ok = (pass.value ? clearError(pass) : setError(pass)) && ok;
  if (!ok) return;

  const btn = e.submitter;
  setBtnLoading(btn, true, "Entrando...");
  try {
    const user = await Auth.signIn({ email: email.value.trim(), password: pass.value });
    if ($("#remember").checked) localStorage.setItem(REMEMBER_KEY, email.value.trim());
    else localStorage.removeItem(REMEMBER_KEY);
    Toast.success("Login realizado!", `Olá, ${user.nome.split(" ")[0]}. Redirecionando...`);
    setTimeout(() => location.replace("dashboard.html"), 650);
  } catch (err) {
    setBtnLoading(btn, false);
    Toast.error("Não foi possível entrar", err.message);
  }
});

/* ============================ CADASTRO ================================== */
$("#form-signup").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("#su-nome");
  const email = $("#su-email");
  const pass = $("#su-pass");
  const pass2 = $("#su-pass2");
  let ok = true;
  ok = (nome.value.trim().length >= 2 ? clearError(nome) : setError(nome)) && ok;
  ok = (EMAIL_RX.test(email.value.trim()) ? clearError(email) : setError(email)) && ok;
  ok = (pass.value.length >= 6 ? clearError(pass) : setError(pass)) && ok;
  ok = (pass2.value === pass.value && pass2.value ? clearError(pass2) : setError(pass2)) && ok;
  if (!ok) return;

  const btn = e.submitter;
  setBtnLoading(btn, true, "Criando...");
  try {
    await Auth.signUp({ nome: nome.value.trim(), email: email.value.trim(), password: pass.value });
    if (Auth.isDemoMode) {
      Toast.success("Conta criada!", "Você já pode entrar com suas credenciais.");
      e.target.reset();
      $("#pwd-bar").style.width = "0";
      $("#login-email").value = email.value.trim();
      showView("login");
    } else {
      Toast.success("Conta criada!", "Verifique seu e-mail para confirmar o cadastro.");
      showView("login");
    }
    setBtnLoading(btn, false);
  } catch (err) {
    setBtnLoading(btn, false);
    Toast.error("Erro no cadastro", err.message);
  }
});

/* ========================== RECUPERAÇÃO ================================= */
$("#form-forgot").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#fg-email");
  if (!EMAIL_RX.test(email.value.trim())) return setError(email);
  clearError(email);

  const btn = e.submitter;
  setBtnLoading(btn, true, "Enviando...");
  try {
    await Auth.resetPassword(email.value.trim());
    Toast.success(
      "Link enviado!",
      Auth.isDemoMode
        ? "No modo demonstração o envio é simulado."
        : "Confira sua caixa de entrada."
    );
    showView("login");
    setBtnLoading(btn, false);
  } catch (err) {
    setBtnLoading(btn, false);
    Toast.error("Não foi possível enviar", err.message);
  }
});

/* limpa erro ao digitar */
$$("input").forEach((i) => i.addEventListener("input", () => clearError(i)));

/* ============================== init ==================================== */
(async function init() {
  icons();
  // já autenticado? vai direto ao painel
  await Auth.redirectIfAuthed();
  // modo de login + e-mail lembrado
  applyModeUI();
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (remembered) {
    $("#login-email").value = remembered;
    $("#remember").checked = true;
  }
})();
