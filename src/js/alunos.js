/**
 * alunos.js — CRUD de alunos com busca, filtro por turma, ordenação e paginação.
 */
import {
  bootPage, $, $$, escapeHtml, fmtDate, icons, debounce, initials, downloadCsv,
  Toast, openModal, closeModal, confirmDialog, setBtnLoading,
} from "./app.js";
import { Alunos } from "../services/database.js";

const PAGE_SIZE = 8;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const state = { search: "", turma: "", sort: "nome", dir: "asc", page: 1 };
let cache = [];

function skeletonRows() {
  $("#tbody").innerHTML = Array.from({ length: PAGE_SIZE })
    .map(
      () => `<tr class="sk-row">
        <td><div class="skeleton sk-line" style="width:65%"></div><div class="skeleton sk-line" style="width:45%"></div></td>
        <td><div class="skeleton sk-line" style="width:60%"></div></td>
        <td><div class="skeleton sk-line" style="width:50%"></div></td>
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
      <i data-lucide="user-x"></i>
      <h4>Nenhum aluno encontrado</h4>
      <p>Tente ajustar a busca ou cadastre um novo aluno.</p>
    </div></td></tr>`;
    icons();
    return;
  }
  body.innerHTML = rows
    .map(
      (a) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:11px">
          <div class="avatar" style="width:34px;height:34px;font-size:.78rem;border-radius:9px">${initials(a.nome)}</div>
          <div>
            <span class="cell-strong">${escapeHtml(a.nome)}</span>
            <div class="cell-sub">${escapeHtml(a.email || "sem e-mail")}</div>
          </div>
        </div>
      </td>
      <td class="cell-mono">${escapeHtml(a.matricula)}</td>
      <td>${a.turma ? `<span class="chip">${escapeHtml(a.turma)}</span>` : "<span class='muted'>—</span>"}</td>
      <td class="cell-mono">${escapeHtml(a.telefone || "—")}</td>
      <td class="cell-mono">${fmtDate(a.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-edit="${a.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${a.id}" data-name="${escapeHtml(a.nome)}" title="Excluir"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    </tr>`
    )
    .join("");
  icons();
}

function renderPager(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const from = total ? (state.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(state.page * PAGE_SIZE, total);
  $("#page-info").textContent = `Mostrando ${from}–${to} de ${total} aluno(s)`;

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

let firstLoad = true;
async function load() {
  if (firstLoad) skeletonRows();
  try {
    const { data, total } = await Alunos.list({ ...state, pageSize: PAGE_SIZE });
    renderRows(data);
    renderPager(total);
  } catch (err) {
    Toast.error("Erro ao carregar alunos", err.message);
  } finally {
    firstLoad = false;
  }
}

async function fillFilters() {
  const turmas = await Alunos.turmas();
  $("#filter-turma").innerHTML =
    `<option value="">Todas as turmas</option>` +
    turmas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  $("#turma-list").innerHTML = turmas.map((t) => `<option value="${escapeHtml(t)}">`).join("");
}

function openForm(aluno = null) {
  $("#form-aluno").reset();
  $$(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  $("#aluno-id").value = aluno?.id || "";
  $("#modal-title").textContent = aluno ? "Editar aluno" : "Novo aluno";
  if (aluno) {
    $("#aluno-nome").value = aluno.nome;
    $("#aluno-matricula").value = aluno.matricula;
    $("#aluno-turma").value = aluno.turma || "";
    $("#aluno-telefone").value = aluno.telefone || "";
    $("#aluno-email").value = aluno.email || "";
  }
  openModal("#modal-aluno");
}

async function openEdit(id) {
  let aluno = cache.find((a) => a.id === id);
  if (!aluno) {
    cache = await Alunos.all();
    aluno = cache.find((a) => a.id === id);
  }
  if (aluno) openForm(aluno);
}

(async function () {
  await bootPage({ active: "alunos.html", title: "Alunos", subtitle: "Cadastro e gestão de estudantes" });
  await fillFilters();
  await load();

  $("#search").addEventListener(
    "input",
    debounce((e) => {
      state.search = e.target.value.trim();
      state.page = 1;
      load();
    }, 300)
  );
  $("#filter-turma").addEventListener("change", (e) => {
    state.turma = e.target.value;
    state.page = 1;
    load();
  });
  $("#sort").addEventListener("change", (e) => {
    const [sort, dir] = e.target.value.split(":");
    Object.assign(state, { sort, dir, page: 1 });
    syncSortHeaders();
    load();
  });
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
  $("#pager").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    state.page = Number(b.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#tbody").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) openEdit(edit.dataset.edit);
    if (del) {
      const ok = await confirmDialog({
        title: "Excluir aluno",
        message: `Remover "${del.dataset.name}"? Os empréstimos vinculados também serão removidos.`,
        confirmText: "Excluir",
        icon: "user-x",
      });
      if (!ok) return;
      try {
        await Alunos.remove(del.dataset.del);
        cache = [];
        Toast.success("Aluno excluído", `"${del.dataset.name}" foi removido.`);
        await fillFilters();
        load();
      } catch (err) {
        Toast.error("Erro ao excluir", err.message);
      }
    }
  });
  $("#btn-add").addEventListener("click", () => openForm());

  // exportar CSV (respeita busca/filtro/ordenação atuais)
  $("#btn-export").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    setBtnLoading(btn, true, "Exportando...");
    try {
      const { data } = await Alunos.list({ ...state, pageSize: 100000 });
      if (!data.length) {
        Toast.info("Nada para exportar", "Nenhum aluno corresponde aos filtros atuais.");
        return;
      }
      downloadCsv(`alunos-${new Date().toISOString().slice(0, 10)}.csv`, data, [
        { key: "nome", label: "Nome" },
        { key: "matricula", label: "Matrícula" },
        { key: "turma", label: "Turma" },
        { key: "telefone", label: "Telefone" },
        { key: "email", label: "E-mail" },
        { label: "Cadastro", value: (a) => fmtDate(a.created_at) },
      ]);
      Toast.success("Exportação concluída", `${data.length} aluno(s) exportado(s).`);
    } catch (err) {
      Toast.error("Erro ao exportar", err.message);
    } finally {
      setBtnLoading(btn, false);
    }
  });

  $("#form-aluno").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("#aluno-nome");
    const matricula = $("#aluno-matricula");
    const email = $("#aluno-email");
    const emailOk = !email.value.trim() || EMAIL_RX.test(email.value.trim());
    nome.closest(".field").classList.toggle("invalid", !nome.value.trim());
    matricula.closest(".field").classList.toggle("invalid", !matricula.value.trim());
    email.closest(".field").classList.toggle("invalid", !emailOk);
    if (!nome.value.trim() || !matricula.value.trim() || !emailOk) return;

    const payload = {
      nome: nome.value.trim(),
      matricula: matricula.value.trim(),
      turma: $("#aluno-turma").value.trim(),
      telefone: $("#aluno-telefone").value.trim(),
      email: email.value.trim(),
    };
    const id = $("#aluno-id").value;
    const btn = $("#btn-save");
    setBtnLoading(btn, true, "Salvando...");
    try {
      if (id) await Alunos.update(id, payload);
      else await Alunos.create(payload);
      cache = [];
      closeModal("#modal-aluno");
      Toast.success(id ? "Aluno atualizado" : "Aluno cadastrado", payload.nome);
      await fillFilters();
      load();
    } catch (err) {
      Toast.error("Erro ao salvar", err.message);
    } finally {
      setBtnLoading(btn, false);
    }
  });

  $$("#form-aluno input").forEach((i) =>
    i.addEventListener("input", () => i.closest(".field")?.classList.remove("invalid"))
  );
})();

function syncSortHeaders() {
  $$("th.sortable").forEach((th) => {
    th.classList.remove("asc", "desc");
    if (th.dataset.sort === state.sort) th.classList.add(state.dir);
  });
}
