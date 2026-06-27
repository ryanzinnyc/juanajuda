# 📚 BiblioTech — Sistema de Gestão de Biblioteca Escolar

Um sistema **completo e profissional** de gerenciamento de biblioteca escolar, com
autenticação, dashboard com gráficos, e controle de livros, alunos e empréstimos.

Construído com **HTML5 + CSS3 + JavaScript ES6+** e integração pronta com **Supabase**
(Banco de Dados PostgreSQL + Autenticação). Visual moderno inspirado em
Linear, Vercel e Stripe — tema escuro, glassmorphism e animações suaves.

> 💡 **Funciona imediatamente!** Sem configurar nada, o sistema roda em
> **Modo Demonstração** (dados salvos no navegador). Configure o Supabase quando
> quiser colocar em produção.

---

## ✨ Funcionalidades

### 🔐 Autenticação
- Login com e-mail e senha, validação e mensagens de erro elegantes
- Mostrar/ocultar senha · "Lembrar usuário" · animações suaves
- Cadastro de novos usuários (com medidor de força de senha)
- Recuperação e redefinição de senha
- Rotas protegidas, verificação de sessão e logout seguro

### 📊 Dashboard
- Cards de estatística: Total de Livros, Total de Alunos, Empréstimos Ativos, Livros Disponíveis
- Gráfico de **empréstimos por mês** (últimos 6 meses)
- Gráfico de **acervo por categoria**
- Relógio em tempo real e data atual
- Tabela de empréstimos recentes

### 📖 Livros
- Adicionar, editar e excluir livros (com confirmação)
- Busca por título/autor/ISBN, filtro por categoria, ordenação e paginação
- Barra visual de disponibilidade (estoque)

### 👨‍🎓 Alunos
- Adicionar, editar e excluir alunos
- Busca por nome/matrícula/e-mail e filtro por turma

### 🔄 Empréstimos
- Registrar empréstimos e devoluções
- **Atualização automática do estoque**
- Bloqueio de empréstimo sem exemplares disponíveis
- Destaque de **atrasos** com contagem de dias
- Histórico completo com filtro por status

### 🎨 Experiência do usuário
- Toast notifications · Loading screen · Skeleton loading
- Modais elegantes · Confirmação antes de excluir
- Sidebar recolhível · Ícones Lucide · Responsividade total

---

## 🚀 Como executar (Modo Demonstração)

Como o projeto usa **ES Modules**, ele precisa ser servido por um servidor HTTP
local (abrir o arquivo direto com `file://` não funciona). Use **uma** das opções:

**Opção A — VS Code (mais fácil):**
1. Instale a extensão **Live Server**
2. Clique com o botão direito em `login.html` → **"Open with Live Server"**

**Opção B — Node.js:**
```bash
npx serve .
```

**Opção C — Python:**
```bash
python -m http.server 5500
```

Depois abra `http://localhost:<porta>/login.html`.

### 🔑 Conta de demonstração
```
E-mail:  admin@biblioteca.com
Senha:   123456
```
Ou crie sua própria conta na tela de cadastro. Os dados ficam salvos no
`localStorage` do navegador.

---

## 🛠️ Conectar ao Supabase (Produção)

1. Crie um projeto gratuito em **https://supabase.com**
2. No painel, vá em **SQL Editor → New query**, cole todo o conteúdo de
   [`database/schema.sql`](database/schema.sql) e clique em **Run**.
   Isso cria as tabelas, índices, constraints, triggers e políticas de RLS
   (e popula alguns dados de exemplo).
3. Vá em **Project Settings → API** e copie a **Project URL** e a chave
   **anon public**.
4. Abra [`src/services/config.js`](src/services/config.js) e cole nos campos:
   ```js
   export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   export const SUPABASE_ANON_KEY = "sua-chave-anon-public";
   ```
5. Pronto! O sistema detecta a configuração automaticamente e passa a usar o
   Supabase (Auth + Banco de Dados) no lugar do modo demonstração.

> Para que a recuperação de senha funcione, em **Authentication → URL Configuration**
> adicione a URL do seu site (ex.: `http://localhost:5500`) em *Redirect URLs*.

---

## 🗄️ Banco de Dados

| Tabela        | Descrição                                            |
|---------------|------------------------------------------------------|
| `users`       | Perfil do usuário (vinculado ao Supabase Auth)       |
| `alunos`      | Cadastro de alunos                                   |
| `livros`      | Acervo de livros (com controle de estoque)           |
| `emprestimos` | Empréstimos, devoluções e status                     |

Inclui **Primary Keys**, **Foreign Keys**, **índices**, **constraints**
(`CHECK`, `UNIQUE`), **triggers** (criação de perfil + ajuste automático de
estoque) e **políticas de Row Level Security (RLS)** do Supabase.

---

## 📁 Estrutura do projeto

```
JUAN AJUDA/
├── index.html              # Redireciona p/ login ou dashboard
├── login.html              # Login + Cadastro + Recuperação
├── reset-password.html     # Redefinição de senha
├── dashboard.html          # Painel com estatísticas e gráficos
├── livros.html             # Gestão do acervo
├── alunos.html             # Gestão de alunos
├── emprestimos.html        # Gestão de empréstimos
├── assets/
│   └── favicon.svg
├── database/
│   └── schema.sql          # SQL completo do Supabase
└── src/
    ├── styles/
    │   └── styles.css      # Design system (tema escuro, glassmorphism)
    ├── services/
    │   ├── config.js       # Configuração / chaves do Supabase
    │   ├── supabase.js     # Cliente Supabase
    │   ├── auth.js         # Autenticação (Supabase + demo)
    │   └── database.js     # Acesso a dados (Supabase + demo)
    └── js/
        ├── app.js          # Shell, sidebar, toasts, modais, relógio
        ├── login.js
        ├── dashboard.js
        ├── livros.js
        ├── alunos.js
        └── emprestimos.js
```

---

## 🧰 Tecnologias
- **HTML5, CSS3, JavaScript ES6+** (sem framework, ES Modules nativos)
- **Supabase** (PostgreSQL + Auth)
- **Chart.js** (gráficos) · **Lucide** (ícones) · **Inter** (tipografia)

---

## 📝 Licença
Projeto educacional — livre para uso e modificação.

© 2026 BiblioTech
