/**
 * configuracoes.js — preferências do sistema, modo de operação e dados demo.
 */
import { bootPage, $, icons, Toast, confirmDialog, setBtnLoading } from "./app.js";
import { Auth } from "../services/auth.js";
import { resetDemoData } from "../services/database.js";
import { APP } from "../services/config.js";

(async function () {
  const user = await bootPage({
    active: "configuracoes.html",
    title: "Configurações",
    subtitle: "Preferências e informações do sistema",
  });
  if (!user) return;

  /* ----------------------------- modo atual ----------------------------- */
  const badge = $("#mode-badge");
  const desc = $("#mode-desc");
  const ico = $("#mode-ico");

  if (Auth.isDemoMode) {
    badge.textContent = "Modo demonstração";
    badge.className = "badge badge--ativo";
    desc.textContent = Auth.didAutoFallback
      ? "O Supabase está configurado, mas não respondeu — os dados estão sendo salvos neste navegador."
      : "Os dados estão sendo salvos localmente neste navegador (localStorage).";
    ico.innerHTML = '<i data-lucide="hard-drive"></i>';
  } else {
    badge.textContent = "Conectado ao Supabase";
    badge.className = "badge badge--devolvido";
    desc.textContent = "Os dados estão sendo lidos e gravados no banco de dados na nuvem.";
    ico.innerHTML = '<i data-lucide="cloud"></i>';
  }

  // Botões de alternância só fazem sentido quando o Supabase está configurado.
  if (Auth.isSupabaseConfigured) {
    $("#btn-offline").classList.toggle("hidden", Auth.isDemoMode);
    $("#btn-online").classList.toggle("hidden", !Auth.isDemoMode);
  }

  // O cartão de dados de demonstração só é relevante no modo demo.
  $("#card-demo").classList.toggle("hidden", !Auth.isDemoMode);

  /* ------------------------------- sobre -------------------------------- */
  $("#about-name").textContent = APP.name;
  $("#about-version").textContent = `v${APP.version}`;

  icons();

  /* ----------------------------- interações ----------------------------- */
  $("#btn-offline").addEventListener("click", () => {
    Auth.setOfflineMode(true);
    Toast.success("Modo demonstração ativado", "Recarregando...");
    setTimeout(() => location.reload(), 500);
  });

  $("#btn-online").addEventListener("click", () => {
    Auth.setOfflineMode(false);
    Toast.success("Conectando ao Supabase", "Recarregando...");
    setTimeout(() => location.reload(), 500);
  });

  $("#btn-reset").addEventListener("click", async (e) => {
    const ok = await confirmDialog({
      title: "Restaurar dados de exemplo",
      message:
        "Isto substitui todos os livros, alunos e empréstimos atuais pelos dados de demonstração. Não pode ser desfeito.",
      confirmText: "Restaurar",
      icon: "rotate-ccw",
    });
    if (!ok) return;
    const btn = e.currentTarget;
    setBtnLoading(btn, true, "Restaurando...");
    try {
      resetDemoData();
      Toast.success("Dados restaurados", "O sistema voltou ao estado inicial.");
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      setBtnLoading(btn, false);
      Toast.error("Erro ao restaurar", err.message);
    }
  });
})();
