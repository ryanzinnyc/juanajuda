/**
 * emprestimos.js — registro de empréstimos, devoluções e controle de atrasos.
 */
import {
  bootPage, $, $$, escapeHtml, fmtDate, icons, debounce, daysBetween,
  Toast, openModal, closeModal, confirmDialog, setBtnLoading,
} from "./app.js";
import { Emprestimos, Alunos, Livros } from "../services/database.js";

const PAGE_SIZE = 8;
const state = { search: "", status: "", page: 1 };
const STATUS_LABEL = { ativo: "Ativo", devolvido: "Devolvido", atrasado: "Atrasado" };
const badge = (s) => `<span class="badge badge--${s}">${STATUS_LABEL[s] || s}</span>`;
const todayStr = () => new Date().toISOString().slice(0, 10);

function skeletonRows() {
  $("#tbody").innerHTML = Array.from({ length: PAGE_SIZE })
    .map(
      () => `<tr class="sk-row">
        <td><div class="skeleton sk-line" style="width:65%"></div><div class="skeleton sk-line" style="width:40%"></div></td>
        <td><div class="skeleton sk-line" style="width:70%"></div></td>
        <td><div class="skeleton sk-line" style="width:60%"></div></td>
        <td><div class="skeleton sk-line" style="width:60%"></div></td>
        <td><div class="skeleton sk-line" style="width:60%"></div></td>
        <td><div class="skeleton sk-line" style="width:50%"></div></td>
        <td><div class="skeleton sk-line" style="width:50%"></div></td>
      </tr>`
    )
    .join("");
}

function devolucaoCell(e) {
  if (e.data_devolucao) return `<span class="cell-mono">${fmtDate(e.data_devolucao)}</span>`;
  if (e.status_atual === "atrasado") {
    const dias = daysBetween(e.data_prevista, todayStr());
    return `<span class="badge--soft badge" style="color:var(--danger)">${dias} dia(s) de atraso</span>`;
  }
  return "<span class='muted'>—</span>";
}

function renderRows(rows) {
  const body = $("#tbody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty">
      <i data-lucide="book-marked"></i>
      <h4>Nenhum empréstimo encontrado</h4>
      <p>Registre um novo empréstimo para começar.</p>
    </div></td></tr>`;
    icons();
    return;
  }
  body.innerHTML = rows
    .map(
      (e) => `
    <tr>
      <td><span class="cell-strong">${escapeHtml(e.aluno_nome)}</span><div class="cell-sub">${escapeHtml(
        e.aluno_matricula
      )}</div></td>
      <td><span class="cell-strong">${escapeHtml(e.livro_titulo)}</span><div class="cell-sub">${escapeHtml(
        e.livro_autor
      )}</div></td>
      <td class="cell-mono">${fmtDate(e.data_emprestimo)}</td>
      <td class="cell-mono">${fmtDate(e.data_prevista)}</td>
      <td>${devolucaoCell(e)}</td>
      <td>${badge(e.status_atual)}</td>
      <td>
        <div class="row-actions">
          ${
            e.status_atual !== "devolvido"
              ? `<button class="icon-btn" data-return="${e.id}" title="Registrar devolução" style="color:var(--success)"><i data-lucide="undo-2"></i></button>`
              : `<button class="icon-btn" disabled title="Já devolvido"><i data-lucide="check-check"></i></button>`
          }
          <button class="icon-btn danger" data-del="${e.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
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
  $("#page-info").textContent = `Mostrando ${from}–${to} de ${total} empréstimo(s)`;

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
    const { data, total } = await Emprestimos.list({ ...state, pageSize: PAGE_SIZE });
    renderRows(data);
    renderPager(total);
  } catch (err) {
    Toast.error("Erro ao carregar empréstimos", err.message);
  } finally {
    firstLoad = false;
  }
}

/* -------- popular selects do modal (alunos + livros disponíveis) -------- */
async function prepararModal() {
  const [alunos, livrosRes] = await Promise.all([Alunos.all(), Livros.list({ pageSize: 1000 })]);
  const disponiveis = livrosRes.data.filter((l) => l.disponivel > 0);

  $("#emp-aluno").innerHTML =
    `<option value="">Selecione o aluno…</option>` +
    alunos
      .map((a) => `<option value="${a.id}">${escapeHtml(a.nome)} — ${escapeHtml(a.turma || "s/turma")}</option>`)
      .join("");

  $("#emp-livro").innerHTML = disponiveis.length
    ? `<option value="">Selecione o livro…</option>` +
      disponiveis
        .map(
          (l) =>
            `<option value="${l.id}">${escapeHtml(l.titulo)} (${l.disponivel} disp.)</option>`
        )
        .join("")
    : `<option value="">Nenhum livro disponível</option>`;

  // data padrão: hoje + 14 dias
  const d = new Date();
  d.setDate(d.getDate() + 14);
  $("#emp-data").value = d.toISOString().slice(0, 10);
  $("#emp-data").min = todayStr();
}

function openForm() {
  $("#form-emp").reset();
  $$(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  prepararModal();
  openModal("#modal-emp");
}

(async function () {
  await bootPage({ active: "emprestimos.html", title: "Empréstimos", subtitle: "Controle de retiradas e devoluções" });
  await load();

  $("#search").addEventListener(
    "input",
    debounce((e) => {
      state.search = e.target.value.trim();
      state.page = 1;
      load();
    }, 300)
  );
  $("#filter-status").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.page = 1;
    load();
  });
  $("#pager").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    state.page = Number(b.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#tbody").addEventListener("click", async (e) => {
    const ret = e.target.closest("[data-return]");
    const del = e.target.closest("[data-del]");
    if (ret) {
      const ok = await confirmDialog({
        title: "Registrar devolução",
        message: "Confirmar a devolução deste livro? O estoque será atualizado.",
        confirmText: "Confirmar devolução",
        danger: false,
        icon: "undo-2",
      });
      if (!ok) return;
      try {
        await Emprestimos.devolver(ret.dataset.return);
        Toast.success("Devolução registrada", "O exemplar voltou ao acervo.");
        load();
      } catch (err) {
        Toast.error("Erro na devolução", err.message);
      }
    }
    if (del) {
      const ok = await confirmDialog({
        title: "Excluir empréstimo",
        message: "Remover este registro de empréstimo? Se ainda estiver ativo, o estoque será devolvido.",
        confirmText: "Excluir",
        icon: "trash-2",
      });
      if (!ok) return;
      try {
        await Emprestimos.remove(del.dataset.del);
        Toast.success("Registro excluído", "O empréstimo foi removido.");
        load();
      } catch (err) {
        Toast.error("Erro ao excluir", err.message);
      }
    }
  });

  $("#btn-add").addEventListener("click", openForm);

  $("#form-emp").addEventListener("submit", async (e) => {
    e.preventDefault();
    const aluno = $("#emp-aluno");
    const livro = $("#emp-livro");
    const data = $("#emp-data");
    aluno.closest(".field").classList.toggle("invalid", !aluno.value);
    livro.closest(".field").classList.toggle("invalid", !livro.value);
    const dataOk = data.value && data.value >= todayStr();
    data.closest(".field").classList.toggle("invalid", !dataOk);
    if (!aluno.value || !livro.value || !dataOk) return;

    const btn = $("#btn-save");
    setBtnLoading(btn, true, "Registrando...");
    try {
      await Emprestimos.create({
        aluno_id: aluno.value,
        livro_id: livro.value,
        data_prevista: data.value,
      });
      closeModal("#modal-emp");
      Toast.success("Empréstimo registrado", "Estoque atualizado automaticamente.");
      load();
    } catch (err) {
      Toast.error("Não foi possível registrar", err.message);
    } finally {
      setBtnLoading(btn, false);
    }
  });

  $$("#form-emp select, #form-emp input").forEach((i) =>
    i.addEventListener("change", () => i.closest(".field")?.classList.remove("invalid"))
  );
})();
