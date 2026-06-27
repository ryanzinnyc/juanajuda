/**
 * dashboard.js — estatísticas, gráficos e empréstimos recentes.
 */
import { bootPage, $, escapeHtml, fmtDate, icons } from "./app.js";
import { Dashboard } from "../services/database.js";

const STATUS_LABEL = { ativo: "Ativo", devolvido: "Devolvido", atrasado: "Atrasado" };
const badge = (s) => `<span class="badge badge--${s}">${STATUS_LABEL[s] || s}</span>`;

/* anima um número de 0 até o valor final */
function countUp(el, target, duration = 900) {
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString("pt-BR");
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---- tema padrão dos gráficos ---- */
function chartTheme() {
  Chart.defaults.color = "#99a0b3";
  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
}

function lineChart(ctx, labels, data) {
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, "rgba(139,92,246,0.45)");
  grad.addColorStop(1, "rgba(139,92,246,0)");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Empréstimos",
          data,
          fill: true,
          backgroundColor: grad,
          borderColor: "#8b5cf6",
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: "#a855f7",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

function doughnutChart(ctx, labels, data) {
  const palette = ["#6366f1", "#8b5cf6", "#a855f7", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#38bdf8"];
  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: palette,
          borderColor: "rgba(10,12,20,0.9)",
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { usePointStyle: true, padding: 14, boxWidth: 8 } },
      },
    },
  });
}

/* =============================== init ================================== */
(async function () {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const user = await bootPage({
    active: "dashboard.html",
    title: "Dashboard",
    subtitle: "Visão geral da biblioteca",
  });
  if (!user) return;

  $("#topbar .topbar__title h1").textContent = `${greet}, ${user.nome.split(" ")[0]}!`;

  try {
    const d = await Dashboard.data();

    // cards
    countUp($('[data-stat="totalLivros"]'), d.cards.totalLivros);
    countUp($('[data-stat="totalAlunos"]'), d.cards.totalAlunos);
    countUp($('[data-stat="emprestimosAtivos"]'), d.cards.emprestimosAtivos);
    countUp($('[data-stat="disponiveis"]'), d.cards.disponiveis);

    $('[data-trend="titulos"]').innerHTML = `<i data-lucide="library"></i> ${d.cards.totalTitulos} títulos no catálogo`;
    const atr = d.cards.atrasados;
    const trendAtraso = $('[data-trend="atrasos"]');
    if (atr > 0) {
      trendAtraso.classList.add("warn");
      trendAtraso.innerHTML = `<i data-lucide="alert-triangle"></i> ${atr} em atraso`;
    } else {
      trendAtraso.classList.add("up");
      trendAtraso.innerHTML = `<i data-lucide="check"></i> Nenhum atraso`;
    }
    icons();

    // gráficos
    chartTheme();
    lineChart($("#chartMeses").getContext("2d"), d.chartMeses.labels, d.chartMeses.valores);
    if (d.chartCategorias.labels.length) {
      doughnutChart($("#chartCategorias").getContext("2d"), d.chartCategorias.labels, d.chartCategorias.valores);
    }

    // empréstimos recentes
    const recentes = await Dashboard.emprestimosRecentes(5);
    const body = $("#recent-body");
    if (!recentes.length) {
      body.innerHTML = `<tr><td colspan="5"><div class="empty"><i data-lucide="inbox"></i><h4>Nenhum empréstimo ainda</h4></div></td></tr>`;
    } else {
      body.innerHTML = recentes
        .map(
          (e) => `
        <tr>
          <td><span class="cell-strong">${escapeHtml(e.aluno_nome)}</span><div class="cell-sub">${escapeHtml(
            e.aluno_matricula
          )}</div></td>
          <td>${escapeHtml(e.livro_titulo)}</td>
          <td class="cell-mono">${fmtDate(e.data_emprestimo)}</td>
          <td class="cell-mono">${fmtDate(e.data_prevista)}</td>
          <td>${badge(e.status_atual)}</td>
        </tr>`
        )
        .join("");
    }
    icons();
  } catch (err) {
    console.error(err);
    const { Toast } = await import("./app.js");
    Toast.error("Erro ao carregar dados", err.message);
  }
})();
