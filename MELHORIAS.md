# 🛠️ Melhorias — BiblioTech

Documento do que foi feito nesta rodada de melhorias e **o que cada coisa faz**.
O objetivo foi deixar o sistema **mais robusto** (sempre funciona), **mais completo**
(novas funcionalidades) e **mais agradável de usar** — sem quebrar nada do que já existia.

> **Resumo rápido:** o sistema agora nunca fica "na tela em branco" mesmo se o
> Supabase estiver fora do ar, ganhou **renovação de empréstimos**, **exportação
> para CSV**, **rankings e alerta de atrasos no dashboard**, uma **página de
> Configurações** e **atalhos de teclado**.

---

## 1. Confiabilidade — "Faça funcionar" ✅

### Fallback automático para o modo demonstração
**Arquivo:** [`src/services/supabase.js`](src/services/supabase.js)

Antes, se as credenciais do Supabase estivessem preenchidas mas o projeto
estivesse **pausado, sem o schema aplicado ou sem internet**, o sistema tentava
usar o backend e **falhava** — as páginas carregavam vazias e só apareciam toasts
de erro.

Agora, ao iniciar, o app faz um **health-check** (uma consulta rápida à tabela
`livros`, com timeout de 6s). Se o Supabase **não responder**, o sistema cai
**automaticamente** no **Modo Demonstração** (dados locais no navegador). Resultado:
**o sistema sempre abre e funciona**, com ou sem servidor.

- A tela de login mostra um aviso claro: *"Servidor indisponível — modo
  demonstração ativado"*.
- A flag `didAutoFallback` é exposta em `Auth` e usada pela interface.

---

## 2. Novas funcionalidades — "Mais atividades" ✨

### 2.1 Renovar empréstimo
**Arquivos:** [`src/services/database.js`](src/services/database.js) ·
[`src/js/emprestimos.js`](src/js/emprestimos.js)

Novo botão **"Renovar (+14 dias)"** em cada empréstimo em aberto. Estende o prazo
de devolução em 14 dias e, se o item estava **atrasado**, ele volta a ficar
**em dia** (o novo prazo parte da maior data entre "hoje" e o prazo atual).
Funciona tanto no modo Supabase quanto no modo demonstração.

### 2.2 Exportação para CSV
**Arquivos:** [`src/js/app.js`](src/js/app.js) (utilitário `downloadCsv`) ·
páginas de Livros, Alunos e Empréstimos

Botão **"Exportar"** nas três listagens. Gera um arquivo **CSV** (compatível com
Excel, com acentuação correta via BOM) contendo **exatamente os registros
filtrados** no momento (busca, filtros e ordenação são respeitados).

### 2.3 Dashboard mais rico
**Arquivos:** [`src/services/database.js`](src/services/database.js) ·
[`dashboard.html`](dashboard.html) · [`src/js/dashboard.js`](src/js/dashboard.js)

- **Alerta de atrasos**: faixa em destaque no topo quando há empréstimos
  atrasados, com link direto para a lista já filtrada (`emprestimos.html?status=atrasado`).
- **Ranking "Livros mais emprestados"** (Top 5) com barras de proporção.
- **Ranking "Alunos mais ativos"** (Top 5).

### 2.4 Página de Configurações
**Arquivos:** [`configuracoes.html`](configuracoes.html) ·
[`src/js/configuracoes.js`](src/js/configuracoes.js) ·
`resetDemoData()` em [`src/services/database.js`](src/services/database.js)

Nova entrada no menu lateral (**Sistema → Configurações**) com:
- **Modo de operação**: mostra se está em Supabase ou Demonstração e permite
  **alternar** entre eles.
- **Restaurar dados de demonstração**: recria livros, alunos e empréstimos de
  exemplo com um clique (ótimo para recomeçar do zero).
- **Atalhos de teclado** e **informações da aplicação** (nome, versão, stack).

---

## 3. Experiência do usuário — "Melhore tudo" 🎨

### Atalhos de teclado
**Arquivo:** [`src/js/app.js`](src/js/app.js)

Funcionam em todas as páginas internas (ignorados enquanto você digita ou com um
modal aberto):

| Tecla | Ação                                  |
|-------|---------------------------------------|
| `/`   | Foca a barra de busca                 |
| `N`   | Abre "novo" na página atual           |
| `Esc` | Fecha o modal/janela aberta           |

### Filtro por URL nos empréstimos
A página de empréstimos agora aceita `?status=ativo|atrasado|devolvido`, usado
pelo alerta de atrasos do dashboard para já abrir a lista filtrada.

---

## 4. Otimizações e organização do código 🧹

- **Utilitário CSV reutilizável** (`downloadCsv`) em vez de código repetido em
  cada página.
- **Consulta única do dashboard** estendida para também calcular os rankings
  (sem requisições extras) — eficiente nos dois modos.
- **Probe do Supabase à prova de falhas**: a consulta de teste nunca dispara um
  *unhandled rejection*, mesmo se a rede cair depois do timeout.
- Novos componentes de UI seguem o **mesmo design system** já existente (tokens
  de cor, raios, sombras e animações), mantendo a identidade visual.

---

## 5. Arquivos alterados / criados

**Criados**
- `configuracoes.html`
- `src/js/configuracoes.js`
- `MELHORIAS.md` (este arquivo)

**Alterados**
- `src/services/supabase.js` — health-check + fallback automático
- `src/services/auth.js` — expõe `didAutoFallback`
- `src/services/database.js` — `Emprestimos.renovar()`, rankings no dashboard, `resetDemoData()`
- `src/js/app.js` — `downloadCsv()`, atalhos de teclado, item de menu "Configurações"
- `src/js/login.js` — aviso de fallback no banner
- `src/js/dashboard.js` — alerta de atrasos + rankings
- `src/js/livros.js`, `src/js/alunos.js`, `src/js/emprestimos.js` — botão Exportar (+ renovar nos empréstimos)
- `dashboard.html`, `livros.html`, `alunos.html`, `emprestimos.html` — novos botões/seções
- `src/styles/styles.css` — estilos dos novos componentes (rankings, alerta, configurações, atalhos)
- `README.md` — funcionalidades e estrutura atualizadas

---

## 6. Como testar rapidamente

1. Sirva a pasta por um servidor local (ES Modules exigem `http://`, não `file://`):
   ```bash
   npx serve .
   #   ou
   python -m http.server 5500
   ```
2. Abra `http://localhost:<porta>/login.html`.
3. Entre com a conta de demonstração: **admin@biblioteca.com** / **123456**.
4. Experimente:
   - No **Dashboard**, veja os rankings e (se houver) o alerta de atrasos.
   - Em **Empréstimos**, use **Renovar** e **Exportar**.
   - Em **Livros/Alunos**, use **Exportar** (com e sem filtros).
   - Em **Configurações**, use **Restaurar dados de demonstração**.
   - Pressione `/` e `N` para testar os atalhos.

> 💡 Para validar o **fallback**: configure uma URL de Supabase inválida em
> `src/services/config.js` e recarregue — o sistema entra sozinho em modo
> demonstração e avisa na tela de login.

---

© 2026 BiblioTech — melhorias documentadas.
