/**
 * database.js
 * ---------------------------------------------------------------------------
 * Camada de acesso a dados (livros, alunos, empréstimos, estatísticas).
 *
 * Funciona em dois modos transparentes:
 *   • MODO SUPABASE  -> tabelas PostgreSQL (o estoque é ajustado por TRIGGER)
 *   • MODO DEMO      -> localStorage com dados de demonstração já populados
 *
 * Todas as funções de listagem retornam { data: [], total: number } para
 * suportar busca, filtros, ordenação e paginação.
 * ---------------------------------------------------------------------------
 */
import { supabase, isDemoMode } from "./supabase.js";

/* ============================ utilidades de data ========================== */
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
const today = () => isoDate(new Date());
const shiftDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

/** Status calculado em tempo real (mesma regra da view SQL). */
export function computeStatus(emp) {
  if (emp.data_devolucao) return "devolvido";
  if (emp.data_prevista < today()) return "atrasado";
  return "ativo";
}

/* ===================== armazenamento do modo demo ======================== */
const K = {
  livros: "bibliotech_demo_livros",
  alunos: "bibliotech_demo_alunos",
  emprestimos: "bibliotech_demo_emprestimos",
  seeded: "bibliotech_demo_seeded",
};
const get = (k) => JSON.parse(localStorage.getItem(k) || "[]");
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function seedDemo() {
  if (localStorage.getItem(K.seeded)) return;

  const livrosBase = [
    ["Dom Casmurro", "Machado de Assis", "Romance", "9788525406958", 5],
    ["O Cortiço", "Aluísio Azevedo", "Romance", "9788508133093", 4],
    ["Capitães da Areia", "Jorge Amado", "Romance", "9788535911664", 3],
    ["Vidas Secas", "Graciliano Ramos", "Romance", "9788501069880", 6],
    ["A Hora da Estrela", "Clarice Lispector", "Romance", "9788532511010", 2],
    ["Memórias Póstumas de Brás Cubas", "Machado de Assis", "Romance", "9788535914801", 4],
    ["O Pequeno Príncipe", "Antoine de Saint-Exupéry", "Infantil", "9788595081512", 8],
    ["Harry Potter e a Pedra Filosofal", "J. K. Rowling", "Fantasia", "9788532530783", 5],
    ["1984", "George Orwell", "Ficção", "9788535914849", 4],
    ["A Revolução dos Bichos", "George Orwell", "Ficção", "9788535909554", 3],
    ["Sapiens", "Yuval Noah Harari", "História", "9788525432186", 2],
    ["Breves Respostas para Grandes Questões", "Stephen Hawking", "Ciência", "9788554439970", 3],
  ].map(([titulo, autor, categoria, isbn, quantidade], i) => ({
    id: crypto.randomUUID(),
    titulo,
    autor,
    categoria,
    isbn,
    quantidade,
    disponivel: quantidade,
    created_at: shiftDate(-120 + i * 3) + "T10:00:00.000Z",
  }));

  const alunosBase = [
    ["Ana Beatriz Souza", "2024001", "9º A", "(11) 98888-0001", "ana.souza@escola.edu.br"],
    ["Bruno Carvalho Lima", "2024002", "9º A", "(11) 98888-0002", "bruno.lima@escola.edu.br"],
    ["Carla Mendes Rocha", "2024003", "8º B", "(11) 98888-0003", "carla.rocha@escola.edu.br"],
    ["Diego Fernandes", "2024004", "8º B", "(11) 98888-0004", "diego.f@escola.edu.br"],
    ["Eduarda Pereira", "2024005", "7º C", "(11) 98888-0005", "eduarda.p@escola.edu.br"],
    ["Felipe Augusto Dias", "2024006", "7º C", "(11) 98888-0006", "felipe.dias@escola.edu.br"],
    ["Gabriela Nunes", "2024007", "9º A", "(11) 98888-0007", "gabriela.n@escola.edu.br"],
    ["Henrique Barbosa", "2024008", "8º B", "(11) 98888-0008", "henrique.b@escola.edu.br"],
  ].map(([nome, matricula, turma, telefone, email], i) => ({
    id: crypto.randomUUID(),
    nome,
    matricula,
    turma,
    telefone,
    email,
    created_at: shiftDate(-100 + i * 4) + "T10:00:00.000Z",
  }));

  // Empréstimos: mistura de ativos, atrasados e devolvidos ao longo de 6 meses
  const L = (i) => livrosBase[i].id;
  const A = (i) => alunosBase[i].id;
  const emprestimosBase = [
    [A(0), L(0), -4, 10, null], // ativo, no prazo
    [A(6), L(7), -2, 12, null], // ativo, no prazo
    [A(3), L(8), -6, 8, null], // ativo, no prazo
    [A(1), L(2), -22, -8, null], // ATRASADO
    [A(4), L(4), -18, -4, null], // ATRASADO
    [A(2), L(1), -40, -26, -28], // devolvido
    [A(5), L(3), -55, -41, -44], // devolvido
    [A(7), L(9), -70, -56, -58], // devolvido
    [A(0), L(6), -95, -81, -83], // devolvido (mês anterior)
    [A(3), L(5), -120, -106, -108], // devolvido (há ~4 meses)
    [A(6), L(10), -150, -136, -139], // devolvido (há ~5 meses)
    [A(2), L(11), -175, -161, -164], // devolvido (há ~6 meses)
  ].map(([aluno_id, livro_id, dEmp, dPrev, dDev]) => ({
    id: crypto.randomUUID(),
    aluno_id,
    livro_id,
    data_emprestimo: shiftDate(dEmp),
    data_prevista: shiftDate(dPrev),
    data_devolucao: dDev === null ? null : shiftDate(dDev),
    status: "ativo",
    created_at: shiftDate(dEmp) + "T10:00:00.000Z",
  }));

  // Ajusta estoque para empréstimos ainda em aberto
  emprestimosBase.forEach((e) => {
    if (!e.data_devolucao) {
      const lv = livrosBase.find((l) => l.id === e.livro_id);
      if (lv && lv.disponivel > 0) lv.disponivel -= 1;
    }
  });

  set(K.livros, livrosBase);
  set(K.alunos, alunosBase);
  set(K.emprestimos, emprestimosBase);
  localStorage.setItem(K.seeded, "1");
}
if (isDemoMode) seedDemo();

/* ====================== filtragem / paginação demo ======================= */
function paginate(arr, page, pageSize) {
  const total = arr.length;
  if (!pageSize) return { data: arr, total };
  const start = (page - 1) * pageSize;
  return { data: arr.slice(start, start + pageSize), total };
}
function sortBy(arr, field, dir = "asc") {
  const f = dir === "desc" ? -1 : 1;
  return [...arr].sort((a, b) => {
    const x = a[field] ?? "";
    const y = b[field] ?? "";
    if (typeof x === "number" && typeof y === "number") return (x - y) * f;
    return String(x).localeCompare(String(y), "pt-BR", { numeric: true }) * f;
  });
}

/* ========================================================================= */
/*  L I V R O S                                                              */
/* ========================================================================= */
export const Livros = {
  async list({ search = "", categoria = "", sort = "titulo", dir = "asc", page = 1, pageSize = 8 } = {}) {
    if (isDemoMode) {
      let rows = get(K.livros);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.titulo.toLowerCase().includes(q) ||
            r.autor.toLowerCase().includes(q) ||
            (r.isbn || "").toLowerCase().includes(q)
        );
      }
      if (categoria) rows = rows.filter((r) => r.categoria === categoria);
      rows = sortBy(rows, sort, dir);
      return paginate(rows, page, pageSize);
    }

    let query = supabase.from("livros").select("*", { count: "exact" });
    if (search) query = query.or(`titulo.ilike.%${search}%,autor.ilike.%${search}%,isbn.ilike.%${search}%`);
    if (categoria) query = query.eq("categoria", categoria);
    query = query.order(sort, { ascending: dir === "asc" });
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { data, total: count ?? data.length };
  },

  async categorias() {
    if (isDemoMode) {
      return [...new Set(get(K.livros).map((l) => l.categoria).filter(Boolean))].sort();
    }
    const { data, error } = await supabase.from("livros").select("categoria");
    if (error) throw error;
    return [...new Set(data.map((l) => l.categoria).filter(Boolean))].sort();
  },

  async create(payload) {
    const reg = {
      titulo: payload.titulo,
      autor: payload.autor,
      categoria: payload.categoria || null,
      isbn: payload.isbn || null,
      quantidade: Number(payload.quantidade),
      disponivel: Number(payload.quantidade),
    };
    if (isDemoMode) {
      const rows = get(K.livros);
      const novo = { id: crypto.randomUUID(), ...reg, created_at: new Date().toISOString() };
      rows.push(novo);
      set(K.livros, rows);
      return novo;
    }
    const { data, error } = await supabase.from("livros").insert(reg).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    if (isDemoMode) {
      const rows = get(K.livros);
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error("Livro não encontrado.");
      const emprestados = rows[i].quantidade - rows[i].disponivel;
      const novaQtd = Number(payload.quantidade);
      rows[i] = {
        ...rows[i],
        titulo: payload.titulo,
        autor: payload.autor,
        categoria: payload.categoria || null,
        isbn: payload.isbn || null,
        quantidade: novaQtd,
        disponivel: Math.max(0, novaQtd - emprestados),
      };
      set(K.livros, rows);
      return rows[i];
    }
    // No Supabase, recalcula disponível preservando os exemplares emprestados.
    const { data: atual, error: e1 } = await supabase.from("livros").select("*").eq("id", id).single();
    if (e1) throw e1;
    const emprestados = atual.quantidade - atual.disponivel;
    const novaQtd = Number(payload.quantidade);
    const { data, error } = await supabase
      .from("livros")
      .update({
        titulo: payload.titulo,
        autor: payload.autor,
        categoria: payload.categoria || null,
        isbn: payload.isbn || null,
        quantidade: novaQtd,
        disponivel: Math.max(0, novaQtd - emprestados),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    if (isDemoMode) {
      set(K.livros, get(K.livros).filter((r) => r.id !== id));
      return true;
    }
    const { error } = await supabase.from("livros").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};

/* ========================================================================= */
/*  A L U N O S                                                              */
/* ========================================================================= */
export const Alunos = {
  async list({ search = "", turma = "", sort = "nome", dir = "asc", page = 1, pageSize = 8 } = {}) {
    if (isDemoMode) {
      let rows = get(K.alunos);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.nome.toLowerCase().includes(q) ||
            r.matricula.toLowerCase().includes(q) ||
            (r.email || "").toLowerCase().includes(q)
        );
      }
      if (turma) rows = rows.filter((r) => r.turma === turma);
      rows = sortBy(rows, sort, dir);
      return paginate(rows, page, pageSize);
    }

    let query = supabase.from("alunos").select("*", { count: "exact" });
    if (search) query = query.or(`nome.ilike.%${search}%,matricula.ilike.%${search}%,email.ilike.%${search}%`);
    if (turma) query = query.eq("turma", turma);
    query = query.order(sort, { ascending: dir === "asc" });
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { data, total: count ?? data.length };
  },

  async turmas() {
    if (isDemoMode) {
      return [...new Set(get(K.alunos).map((a) => a.turma).filter(Boolean))].sort();
    }
    const { data, error } = await supabase.from("alunos").select("turma");
    if (error) throw error;
    return [...new Set(data.map((a) => a.turma).filter(Boolean))].sort();
  },

  async all() {
    if (isDemoMode) return sortBy(get(K.alunos), "nome");
    const { data, error } = await supabase.from("alunos").select("*").order("nome");
    if (error) throw error;
    return data;
  },

  async create(payload) {
    const reg = {
      nome: payload.nome,
      matricula: payload.matricula,
      turma: payload.turma || null,
      telefone: payload.telefone || null,
      email: payload.email || null,
    };
    if (isDemoMode) {
      const rows = get(K.alunos);
      if (rows.some((r) => r.matricula === reg.matricula))
        throw new Error("Já existe um aluno com esta matrícula.");
      const novo = { id: crypto.randomUUID(), ...reg, created_at: new Date().toISOString() };
      rows.push(novo);
      set(K.alunos, rows);
      return novo;
    }
    const { data, error } = await supabase.from("alunos").insert(reg).select().single();
    if (error) throw error.code === "23505" ? new Error("Já existe um aluno com esta matrícula.") : error;
    return data;
  },

  async update(id, payload) {
    const reg = {
      nome: payload.nome,
      matricula: payload.matricula,
      turma: payload.turma || null,
      telefone: payload.telefone || null,
      email: payload.email || null,
    };
    if (isDemoMode) {
      const rows = get(K.alunos);
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error("Aluno não encontrado.");
      if (rows.some((r) => r.matricula === reg.matricula && r.id !== id))
        throw new Error("Já existe um aluno com esta matrícula.");
      rows[i] = { ...rows[i], ...reg };
      set(K.alunos, rows);
      return rows[i];
    }
    const { data, error } = await supabase.from("alunos").update(reg).eq("id", id).select().single();
    if (error) throw error.code === "23505" ? new Error("Já existe um aluno com esta matrícula.") : error;
    return data;
  },

  async remove(id) {
    if (isDemoMode) {
      set(K.alunos, get(K.alunos).filter((r) => r.id !== id));
      // remove empréstimos vinculados
      set(K.emprestimos, get(K.emprestimos).filter((e) => e.aluno_id !== id));
      return true;
    }
    const { error } = await supabase.from("alunos").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};

/* ========================================================================= */
/*  E M P R É S T I M O S                                                    */
/* ========================================================================= */
export const Emprestimos = {
  async list({ search = "", status = "", page = 1, pageSize = 8 } = {}) {
    let rows;
    if (isDemoMode) {
      const livros = get(K.livros);
      const alunos = get(K.alunos);
      rows = get(K.emprestimos).map((e) => ({
        ...e,
        aluno: alunos.find((a) => a.id === e.aluno_id) || null,
        livro: livros.find((l) => l.id === e.livro_id) || null,
      }));
    } else {
      const { data, error } = await supabase
        .from("emprestimos")
        .select("*, aluno:alunos(nome,matricula,turma), livro:livros(titulo,autor)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = data;
    }

    rows = rows
      .map((e) => ({
        ...e,
        aluno_nome: e.aluno?.nome ?? "—",
        aluno_matricula: e.aluno?.matricula ?? "—",
        livro_titulo: e.livro?.titulo ?? "—",
        livro_autor: e.livro?.autor ?? "—",
        status_atual: computeStatus(e),
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (status) rows = rows.filter((r) => r.status_atual === status);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.aluno_nome.toLowerCase().includes(q) ||
          r.livro_titulo.toLowerCase().includes(q) ||
          r.aluno_matricula.toLowerCase().includes(q)
      );
    }
    return paginate(rows, page, pageSize);
  },

  async create({ aluno_id, livro_id, data_prevista }) {
    if (isDemoMode) {
      const livros = get(K.livros);
      const lv = livros.find((l) => l.id === livro_id);
      if (!lv) throw new Error("Livro não encontrado.");
      if (lv.disponivel <= 0) throw new Error("Este livro não possui exemplares disponíveis.");
      lv.disponivel -= 1;
      set(K.livros, livros);

      const novo = {
        id: crypto.randomUUID(),
        aluno_id,
        livro_id,
        data_emprestimo: today(),
        data_prevista,
        data_devolucao: null,
        status: "ativo",
        created_at: new Date().toISOString(),
      };
      const rows = get(K.emprestimos);
      rows.push(novo);
      set(K.emprestimos, rows);
      return novo;
    }

    // Verificação amigável (o TRIGGER no banco é a rede de segurança atômica)
    const { data: lv, error: e1 } = await supabase
      .from("livros")
      .select("disponivel")
      .eq("id", livro_id)
      .single();
    if (e1) throw e1;
    if (lv.disponivel <= 0) throw new Error("Este livro não possui exemplares disponíveis.");

    const { data, error } = await supabase
      .from("emprestimos")
      .insert({ aluno_id, livro_id, data_emprestimo: today(), data_prevista, status: "ativo" })
      .select()
      .single();
    if (error) throw error;
    return data; // estoque ajustado pelo trigger
  },

  async devolver(id) {
    if (isDemoMode) {
      const rows = get(K.emprestimos);
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error("Empréstimo não encontrado.");
      if (rows[i].data_devolucao) throw new Error("Este empréstimo já foi devolvido.");
      rows[i].data_devolucao = today();
      rows[i].status = "devolvido";
      set(K.emprestimos, rows);

      const livros = get(K.livros);
      const lv = livros.find((l) => l.id === rows[i].livro_id);
      if (lv) lv.disponivel = Math.min(lv.disponivel + 1, lv.quantidade);
      set(K.livros, livros);
      return rows[i];
    }
    const { data, error } = await supabase
      .from("emprestimos")
      .update({ data_devolucao: today(), status: "devolvido" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error; // estoque ajustado pelo trigger
    return data;
  },

  async remove(id) {
    if (isDemoMode) {
      const rows = get(K.emprestimos);
      const emp = rows.find((r) => r.id === id);
      if (emp && !emp.data_devolucao) {
        const livros = get(K.livros);
        const lv = livros.find((l) => l.id === emp.livro_id);
        if (lv) lv.disponivel = Math.min(lv.disponivel + 1, lv.quantidade);
        set(K.livros, livros);
      }
      set(K.emprestimos, rows.filter((r) => r.id !== id));
      return true;
    }
    const { error } = await supabase.from("emprestimos").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};

/* ========================================================================= */
/*  D A S H B O A R D                                                        */
/* ========================================================================= */
export const Dashboard = {
  async data() {
    let livros, alunos, emprestimos;

    if (isDemoMode) {
      livros = get(K.livros);
      alunos = get(K.alunos);
      emprestimos = get(K.emprestimos);
    } else {
      const [rl, ra, re] = await Promise.all([
        supabase.from("livros").select("id,categoria,quantidade,disponivel,created_at"),
        supabase.from("alunos").select("id"),
        supabase.from("emprestimos").select("data_emprestimo,data_prevista,data_devolucao,status,created_at"),
      ]);
      if (rl.error) throw rl.error;
      if (ra.error) throw ra.error;
      if (re.error) throw re.error;
      livros = rl.data;
      alunos = ra.data;
      emprestimos = re.data;
    }

    const totalExemplares = livros.reduce((s, l) => s + (l.quantidade || 0), 0);
    const disponiveis = livros.reduce((s, l) => s + (l.disponivel || 0), 0);
    const statuses = emprestimos.map(computeStatus);
    const ativos = statuses.filter((s) => s === "ativo").length;
    const atrasados = statuses.filter((s) => s === "atrasado").length;

    // Empréstimos por mês (últimos 6 meses)
    const meses = [];
    const ref = new Date();
    ref.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ref);
      d.setMonth(d.getMonth() - i);
      meses.push({
        chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        total: 0,
      });
    }
    emprestimos.forEach((e) => {
      const chave = (e.data_emprestimo || "").slice(0, 7);
      const m = meses.find((x) => x.chave === chave);
      if (m) m.total += 1;
    });

    // Distribuição por categoria
    const porCategoria = {};
    livros.forEach((l) => {
      const c = l.categoria || "Sem categoria";
      porCategoria[c] = (porCategoria[c] || 0) + (l.quantidade || 0);
    });

    return {
      cards: {
        totalLivros: totalExemplares,
        totalTitulos: livros.length,
        totalAlunos: alunos.length,
        emprestimosAtivos: ativos + atrasados,
        atrasados,
        disponiveis,
      },
      chartMeses: { labels: meses.map((m) => m.rotulo), valores: meses.map((m) => m.total) },
      chartCategorias: {
        labels: Object.keys(porCategoria),
        valores: Object.values(porCategoria),
      },
    };
  },

  async emprestimosRecentes(limit = 5) {
    const { data } = await Emprestimos.list({ page: 1, pageSize: limit });
    return data;
  },
};
