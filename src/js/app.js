/**
 * app.js
 * ---------------------------------------------------------------------------
 * Camada de UI compartilhada por todas as páginas internas:
 *   • Shell (sidebar recolhível + topbar + relógio)
 *   • Proteção de rota / logout
 *   • Toast notifications
 *   • Modais + diálogo de confirmação
 *   • Loading screen / utilitários
 * ---------------------------------------------------------------------------
 */
import { Auth } from "../services/auth.js";
import { APP } from "../services/config.js";

/* ============================== utilitários ============================== */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const escapeHtml = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export const initials = (name = "?") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d.length <= 10 ? d + "T00:00:00" : d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function fmtDateLong(d) {
  if (!d) return "—";
  const date = new Date(d.length <= 10 ? d + "T00:00:00" : d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
export const daysBetween = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000);

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Exporta uma lista de objetos para um arquivo CSV (compatível com Excel).
 * @param {string} filename  nome do arquivo (ex.: "livros.csv")
 * @param {object[]} rows    registros a exportar
 * @param {{key?:string,label:string,value?:Function}[]} columns  colunas
 */
export function downloadCsv(filename, rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) =>
      columns.map((c) => esc(typeof c.value === "function" ? c.value(r) : r[c.key])).join(",")
    )
    .join("\n");
  const csv = "﻿" + head + "\n" + body; // BOM para acentuação no Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** (re)desenha os ícones Lucide presentes no DOM. */
export function icons() {
  if (window.lucide) window.lucide.createIcons();
}

/* =============================== Loader ================================= */
export function hideLoader() {
  const l = $("#loader");
  if (l) {
    l.classList.add("hide");
    setTimeout(() => l.remove(), 450);
  }
}

/* =============================== Toasts ================================= */
const TOAST_ICONS = {
  success: "check-circle-2",
  error: "x-circle",
  info: "info",
  warning: "alert-triangle",
};
export const Toast = {
  show(type, title, message = "", timeout = 4000) {
    let box = $("#toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.className = "toasts";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = `toast toast--${type}`;
    t.innerHTML = `
      <div class="toast__ico"><i data-lucide="${TOAST_ICONS[type] || "info"}"></i></div>
      <div class="toast__body"><b>${escapeHtml(title)}</b>${
      message ? `<span>${escapeHtml(message)}</span>` : ""
    }</div>
      <button class="toast__close" aria-label="Fechar"><i data-lucide="x"></i></button>`;
    box.appendChild(t);
    icons();

    const remove = () => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 320);
    };
    t.querySelector(".toast__close").addEventListener("click", remove);
    if (timeout) setTimeout(remove, timeout);
  },
  success: (t, m, to) => Toast.show("success", t, m, to),
  error: (t, m, to) => Toast.show("error", t, m, to),
  info: (t, m, to) => Toast.show("info", t, m, to),
  warning: (t, m, to) => Toast.show("warning", t, m, to),
};

/* =============================== Modais ================================= */
export function openModal(el) {
  const node = typeof el === "string" ? $(el) : el;
  if (!node) return;
  node.classList.add("open");
  document.body.style.overflow = "hidden";
  const focusable = node.querySelector("input, select, textarea, button");
  setTimeout(() => focusable?.focus(), 120);
}
export function closeModal(el) {
  const node = typeof el === "string" ? $(el) : el;
  if (!node) return;
  node.classList.remove("open");
  if (!$$(".modal-overlay.open").length) document.body.style.overflow = "";
}

/** Liga os botões de fechar / clique fora / ESC para todos os modais. */
function wireModals() {
  document.addEventListener("click", (e) => {
    const overlay = e.target.closest(".modal-overlay");
    if (overlay && e.target === overlay) closeModal(overlay);
    if (e.target.closest("[data-close-modal]")) {
      closeModal(e.target.closest(".modal-overlay"));
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const open = $(".modal-overlay.open");
      if (open) closeModal(open);
    }
  });
}

/**
 * Diálogo de confirmação (Promise<boolean>). Usado antes de excluir.
 */
export function confirmDialog({
  title = "Tem certeza?",
  message = "Esta ação não pode ser desfeita.",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true,
  icon = "alert-triangle",
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal modal--sm" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div class="ico ${danger ? "danger" : ""}"><i data-lucide="${icon}"></i></div>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--ghost" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-act="ok">${escapeHtml(
      confirmText
    )}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    icons();
    requestAnimationFrame(() => openModal(overlay));

    const done = (val) => {
      closeModal(overlay);
      setTimeout(() => overlay.remove(), 300);
      resolve(val);
    };
    overlay.querySelector('[data-act="ok"]').addEventListener("click", () => done(true));
    overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => done(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) done(false);
    });
  });
}

/** Estado de carregamento em um botão (mantém largura, troca por spinner). */
export function setBtnLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) {
    btn.dataset.html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spin"></span>${loadingText ? escapeHtml(loadingText) : ""}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
  }
}

/* ============================== Relógio ================================= */
function startClock() {
  const timeEl = $("#clk-time");
  const dateEl = $("#clk-date");
  if (!timeEl) return;
  const tick = () => {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString("pt-BR");
    dateEl.textContent = now
      .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
      .replace(".", "");
  };
  tick();
  setInterval(tick, 1000);
}

/* =============================== Shell ================================= */
const NAV = [
  { section: "Geral" },
  { href: "dashboard.html", icon: "layout-dashboard", label: "Dashboard" },
  { section: "Gestão" },
  { href: "livros.html", icon: "book-open", label: "Acervo de Livros" },
  { href: "alunos.html", icon: "graduation-cap", label: "Alunos" },
  { href: "emprestimos.html", icon: "book-marked", label: "Empréstimos" },
  { section: "Sistema" },
  { href: "configuracoes.html", icon: "settings", label: "Configurações" },
];

function renderSidebar(active, user) {
  const items = NAV.map((n) =>
    n.section
      ? `<div class="sidebar__section">${n.section}</div>`
      : `<a class="nav__item ${n.href === active ? "active" : ""}" href="${n.href}">
           <i data-lucide="${n.icon}"></i><span class="nav__label">${n.label}</span>
         </a>`
  ).join("");

  return `
    <div class="sidebar__brand">
      <span class="brand-mark"><i data-lucide="library-big"></i></span>
      <span>${APP.name}</span>
    </div>
    <nav class="nav">${items}</nav>
    <div class="sidebar__spacer"></div>
    <div class="sidebar__user">
      <div class="avatar">${initials(user.nome)}</div>
      <div class="u-meta">
        <b>${escapeHtml(user.nome)}</b>
        <span>${escapeHtml(user.email)}</span>
      </div>
      <button class="icon-btn" id="logout-side" title="Sair" aria-label="Sair">
        <i data-lucide="log-out"></i>
      </button>
    </div>`;
}

function renderTopbar(title, subtitle) {
  return `
    <button class="icon-btn menu-toggle-mobile" id="menu-mobile" aria-label="Menu">
      <i data-lucide="menu"></i>
    </button>
    <button class="icon-btn menu-toggle-desktop" id="menu-desktop" aria-label="Recolher menu">
      <i data-lucide="panel-left-close"></i>
    </button>
    <div class="topbar__title">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle || "")}</p>
    </div>
    <div class="topbar__spacer"></div>
    <div class="clock-chip" title="Data e hora atuais">
      <span class="dot"></span>
      <span class="time" id="clk-time">--:--:--</span>
      <span class="date" id="clk-date"></span>
    </div>
    <button class="icon-btn" id="logout-top" title="Sair" aria-label="Sair">
      <i data-lucide="log-out"></i>
    </button>`;
}

function wireShell() {
  const app = $("#app");
  const COLLAPSE_KEY = "bibliotech_sidebar_collapsed";
  if (localStorage.getItem(COLLAPSE_KEY) === "1") app.classList.add("collapsed");

  $("#menu-desktop")?.addEventListener("click", () => {
    app.classList.toggle("collapsed");
    localStorage.setItem(COLLAPSE_KEY, app.classList.contains("collapsed") ? "1" : "0");
  });

  const scrim = $("#scrim");
  $("#menu-mobile")?.addEventListener("click", () => {
    app.classList.add("nav-open");
    scrim?.classList.add("show");
  });
  scrim?.addEventListener("click", () => {
    app.classList.remove("nav-open");
    scrim.classList.remove("show");
  });

  const logout = async () => {
    await Auth.signOut();
    Toast.info("Até logo!", "Sessão encerrada com segurança.");
    setTimeout(() => location.replace("login.html"), 500);
  };
  $("#logout-side")?.addEventListener("click", logout);
  $("#logout-top")?.addEventListener("click", logout);
}

/* ============================ Atalhos de teclado ======================== */
function wireShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Não interfere quando o usuário está digitando ou com modal aberto.
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = ["input", "select", "textarea"].includes(tag) || e.target.isContentEditable;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ($(".modal-overlay.open")) return;

    if (e.key === "/" && !typing) {
      const search = $("#search");
      if (search) {
        e.preventDefault();
        search.focus();
        search.select?.();
      }
    } else if ((e.key === "n" || e.key === "N") && !typing) {
      const add = $("#btn-add");
      if (add) {
        e.preventDefault();
        add.click();
      }
    }
  });
}

/**
 * Inicializa uma página interna: protege a rota, monta o shell, liga tudo.
 * Retorna o usuário autenticado (ou interrompe redirecionando ao login).
 */
export async function bootPage({ active, title, subtitle }) {
  wireModals();
  const user = await Auth.requireAuth();
  if (!user) return null; // já redirecionou

  $("#sidebar").innerHTML = renderSidebar(active, user);
  $("#topbar").innerHTML = renderTopbar(title, subtitle);
  icons();
  wireShell();
  wireShortcuts();
  startClock();
  hideLoader();
  return user;
}
