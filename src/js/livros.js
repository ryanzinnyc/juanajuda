/**
 * livros.js — CRUD de livros com busca, filtro, ordenação e paginação.
 */
import {
  bootPage, $, $$, escapeHtml, fmtDate, icons, debounce,
  Toast, openModal, closeModal, confirmDialog, setBtnLoading,
} from "./app.js";
import { Livros } from "../services/database.js";

const PAGE_SIZE = 8;
const state = { search: "", categoria: "", sort: "titulo", dir: "asc", page: 1 };

/* ----------------------------- render linhas ---------------------------- */
function stockCell(l) {
  const pct = l.quantidade ? Math.round((l.disponivel / l.quantidade) * 100) : 0;
  const cls = l.disponivel === 0 ? "empty" : l.disponivel <= l.quantidade * 0.34 ? "low" : "";
  return `
    <div class="stock">
      <div class="stock__bar ${cls}"><span style="width:${pct}%"></span></div>
      <span class="stock__txt">${l.disponivel}/${l.quantidade}</span>
    </div>`;
}

function skeletonRows() {
  $("#tbody").innerHTML = Array.from({ length: PAGE_SIZE })
    .map(
      () => `<tr class="sk-row">
        <td><div class="skeleton sk-line" style="width:70%"></div><div class="skeleton sk-line" style="width:40%"></div></td>
        <td><div class="skeleton sk-line" style="width:60%"></div></td>
        <td><div class="skeleton sk-line" style="width:80%"></div></td>
        <td><div class="skeleton sk-line" style="width:70%"></div></td>
        <td><div class="skeleton sk-line" style="width:60%"></div></td>
        <td><div class="skeleton sk-line" style="width:50%"></div></td>
      </tr>`
    )
    .join("");
}

function renderRows(rows) {
  const body = $("#tbody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty">
      <i data-lucide="book-x"></i>
      <h4>Nenhum livro encontrado</h4>
      <p>Tente ajustar a busca ou cadastre um novo livro.</p>
    </div></td></tr>`;
    icons();
    return;
  }
  body.innerHTML = rows
    .map(
      (l) => `
    <tr>
      <td>
        <span class="cell-strong">${escapeHtml(l.titulo)}</span>
        <div class="cell-sub">${escapeHtml(l.autor)}</div>
      </td>
      <td>${l.categoria ? `<span class="chip">${escapeHtml(l.categoria)}</span>` : "<span class='muted'>—</span>"}</td>
      <td class="cell-mono">${escapeHtml(l.isbn || "—")}</td>
      <td>${stockCell(l)}</td>
      <td class="cell-mono">${fmtDate(l.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-edit="${l.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${l.id}" data-name="${escapeHtml(l.titulo)}" title="Excluir"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    </tr>`
    )
    .join("");
  icons();
}

/* ----------------------------- paginação -------------------------------- */
function renderPager(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const from = total ? (state.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(state.page * PAGE_SIZE, total);
  $("#page-info").textContent = `Mostrando ${from}–${to} de ${total} livro(s)`;

  const btn = (label, page, { active = false, disabled = false } = {}) =>
    `<button ${disabled ? "disabled" : ""} class="${active ? "active" : ""}" data-page="${page}">${label}</button>`;

  let html = btn("‹", state.page - 1, { disabled: state.page === 1 });
  const nums = new Set([1, pages, state.page, state.page - 1, state.page + 1]);
  let prev = 0;
  [...nums]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b)
    .forEach((p) => {
      if (p - prev > 1) html += `<button disabled>…</button>`;
      html += btn(p, p, { active: p === state.page });
      prev = p;
    });
  html += btn("›", state.page + 1, { disabled: state.page === pages });
  $("#pager").innerHTML = html;
}

/* ------------------------------- carregar ------------------------------- */
let firstLoad = true;
async function load() {
  if (firstLoad) skeletonRows();
  try {
    const { data, total } = await Livros.list({ ...state, pageSize: PAGE_SIZE });
    renderRows(data);
    renderPager(total);
  } catch (err) {
    Toast.error("Erro ao carregar livros", err.message);
  } finally {
    firstLoad = false;
  }
}

async function fillFilters() {
  const cats = await Livros.categorias();
  $("#filter-categoria").innerHTML =
    `<option value="">Todas as categorias</option>` +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  $("#cat-list").innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join("");
}

/* -------------------------------- modal --------------------------------- */
function openForm(livro = null) {
  $("#form-livro").reset();
  $$(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  $("#livro-id").value = livro?.id || "";
  $("#modal-title").textContent = livro ? "Editar livro" : "Novo livro";
  if (livro) {
    $("#livro-titulo").value = livro.titulo;
    $("#livro-autor").value = livro.autor;
    $("#livro-categoria").value = livro.categoria || "";
    $("#livro-isbn").value = livro.isbn || "";
    $("#livro-qtd").value = livro.quantidade;
  }
  openModal("#modal-livro");
}

/* keep a small cache so editar abre instantâneo */
let cache = [];
async function openEdit(id) {
  let livro = cache.find((l) => l.id === id);
  if (!livro) {
    const { data } = await Livros.list({ pageSize: 1000 });
    cache = data;
    livro = data.find((l) => l.id === id);
  }
  if (livro) openForm(livro);
}

/* ============================== init ==================================== */
(async function () {
  await bootPage({ active: "livros.html", title: "Acervo de Livros", subtitle: "Gerencie o catálogo da biblioteca" });
  await fillFilters();
  await load();

  // busca
  $("#search").addEventListener(
    "input",
    debounce((e) => {
      state.search = e.target.value.trim();
      state.page = 1;
      load();
    }, 300)
  );
  // filtro categoria
  $("#filter-categoria").addEventListener("change", (e) => {
    state.categoria = e.target.value;
    state.page = 1;
    load();
  });
  // ordenação (select)
  $("#sort").addEventListener("change", (e) => {
    const [sort, dir] = e.target.value.split(":");
    state.sort = sort;
    state.dir = dir;
    state.page = 1;
    syncSortHeaders();
    load();
  });
  // ordenação (cabeçalhos)
  $$("th.sortable").forEach((th) =>
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      state.dir = state.sort === field && state.dir === "asc" ? "desc" : "asc";
      state.sort = field;
      state.page = 1;
      $("#sort").value = `${state.sort}:${state.dir}`;
      syncSortHeaders();
      load();
    })
  );
  // paginação
  $("#pager").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    state.page = Number(b.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  // ações da tabela
  $("#tbody").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) openEdit(edit.dataset.edit);
    if (del) {
      const ok = await confirmDialog({
        title: "Excluir livro",
        message: `Remover "${del.dataset.name}" do acervo? Esta ação não pode ser desfeita.`,
        confirmText: "Excluir",
        icon: "trash-2",
      });
      if (!ok) return;
      try {
        await Livros.remove(del.dataset.del);
        cache = [];
        Toast.success("Livro excluído", `"${del.dataset.name}" foi removido.`);
        await fillFilters();
        load();
      } catch (err) {
        Toast.error("Erro ao excluir", err.message);
      }
    }
  });
  // novo
  $("#btn-add").addEventListener("click", () => openForm());

  // salvar
  $("#form-livro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = $("#livro-titulo");
    const autor = $("#livro-autor");
    const qtd = $("#livro-qtd");
    let ok = true;
    titulo.closest(".field").classList.toggle("invalid", !titulo.value.trim());
    autor.closest(".field").classList.toggle("invalid", !autor.value.trim());
    const qtdValid = qtd.value !== "" && Number(qtd.value) >= 0;
    qtd.closest(".field").classList.toggle("invalid", !qtdValid);
    if (!titulo.value.trim() || !autor.value.trim() || !qtdValid) ok = false;
    if (!ok) return;

    const payload = {
      titulo: titulo.value.trim(),
      autor: autor.value.trim(),
      categoria: $("#livro-categoria").value.trim(),
      isbn: $("#livro-isbn").value.trim(),
      quantidade: Number(qtd.value),
    };
    const id = $("#livro-id").value;
    const btn = $("#btn-save");
    setBtnLoading(btn, true, "Salvando...");
    try {
      if (id) await Livros.update(id, payload);
      else await Livros.create(payload);
      cache = [];
      closeModal("#modal-livro");
      Toast.success(id ? "Livro atualizado" : "Livro cadastrado", payload.titulo);
      await fillFilters();
      load();
    } catch (err) {
      Toast.error("Erro ao salvar", err.message);
    } finally {
      setBtnLoading(btn, false);
    }
  });

  $$("#form-livro input").forEach((i) =>
    i.addEventListener("input", () => i.closest(".field")?.classList.remove("invalid"))
  );
})();

function syncSortHeaders() {
  $$("th.sortable").forEach((th) => {
    th.classList.remove("asc", "desc");
    if (th.dataset.sort === state.sort) th.classList.add(state.dir);
  });
}
