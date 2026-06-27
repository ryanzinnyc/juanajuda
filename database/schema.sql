-- ============================================================================
--  BiblioTech — Sistema de Gerenciamento de Biblioteca Escolar
--  Schema PostgreSQL / Supabase
--  --------------------------------------------------------------------------
--  Como usar:
--    1. Abra o painel do Supabase  ->  SQL Editor  ->  New query
--    2. Cole TODO este arquivo e clique em "Run"
--    3. (Opcional) Rode a seção "SEED" para popular dados de demonstração
--  ============================================================================

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ===========================================================================
-- 1. TABELAS
-- ===========================================================================

-- ---------------------------- USERS (perfil) --------------------------------
-- Vinculada 1:1 ao auth.users gerenciado pelo Supabase Auth.
create table if not exists public.users (
    id          uuid primary key references auth.users (id) on delete cascade,
    nome        text not null,
    email       text not null unique,
    created_at  timestamptz not null default now()
);

-- -------------------------------- ALUNOS ------------------------------------
create table if not exists public.alunos (
    id          uuid primary key default gen_random_uuid(),
    nome        text not null,
    matricula   text not null unique,
    turma       text,
    telefone    text,
    email       text,
    created_at  timestamptz not null default now()
);

-- -------------------------------- LIVROS ------------------------------------
create table if not exists public.livros (
    id          uuid primary key default gen_random_uuid(),
    titulo      text not null,
    autor       text not null,
    categoria   text,
    isbn        text,
    quantidade  integer not null default 1 check (quantidade  >= 0),
    disponivel  integer not null default 1 check (disponivel  >= 0),
    created_at  timestamptz not null default now(),
    constraint  chk_disponivel_lte_quantidade check (disponivel <= quantidade)
);

-- ----------------------------- EMPRESTIMOS ----------------------------------
create table if not exists public.emprestimos (
    id               uuid primary key default gen_random_uuid(),
    aluno_id         uuid not null references public.alunos (id) on delete cascade,
    livro_id         uuid not null references public.livros (id) on delete cascade,
    data_emprestimo  date not null default current_date,
    data_prevista    date not null,
    data_devolucao   date,
    status           text not null default 'ativo'
                     check (status in ('ativo', 'devolvido', 'atrasado')),
    created_at       timestamptz not null default now()
);

-- ===========================================================================
-- 2. ÍNDICES
-- ===========================================================================
create index if not exists idx_livros_categoria  on public.livros (categoria);
create index if not exists idx_livros_titulo      on public.livros (lower(titulo));
create index if not exists idx_livros_autor       on public.livros (lower(autor));
create index if not exists idx_alunos_turma       on public.alunos (turma);
create index if not exists idx_alunos_matricula   on public.alunos (matricula);
create index if not exists idx_alunos_nome        on public.alunos (lower(nome));
create index if not exists idx_emp_aluno          on public.emprestimos (aluno_id);
create index if not exists idx_emp_livro          on public.emprestimos (livro_id);
create index if not exists idx_emp_status         on public.emprestimos (status);

-- ===========================================================================
-- 3. GATILHO: criar perfil em public.users após signup no Auth
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, nome, email)
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data ->> 'nome',
            new.raw_user_meta_data ->> 'full_name',
            split_part(new.email, '@', 1)
        ),
        new.email
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ===========================================================================
-- 4. GATILHO: controle automático de estoque dos livros
--    - INSERT de empréstimo ativo  -> disponivel - 1 (bloqueia se = 0)
--    - Devolução (status devolvido) -> disponivel + 1
--    - DELETE de empréstimo ativo   -> disponivel + 1
-- ===========================================================================
create or replace function public.fn_ajusta_estoque()
returns trigger
language plpgsql
as $$
begin
    if (tg_op = 'INSERT') then
        if (new.status <> 'devolvido') then
            update public.livros
               set disponivel = disponivel - 1
             where id = new.livro_id and disponivel > 0;
            if not found then
                raise exception 'Livro sem exemplares disponíveis para empréstimo';
            end if;
        end if;
        return new;

    elsif (tg_op = 'UPDATE') then
        -- Empréstimo foi devolvido
        if (old.status <> 'devolvido' and new.status = 'devolvido') then
            update public.livros
               set disponivel = least(disponivel + 1, quantidade)
             where id = new.livro_id;
        end if;
        -- Empréstimo reaberto
        if (old.status = 'devolvido' and new.status <> 'devolvido') then
            update public.livros
               set disponivel = disponivel - 1
             where id = new.livro_id and disponivel > 0;
            if not found then
                raise exception 'Livro sem exemplares disponíveis para empréstimo';
            end if;
        end if;
        return new;

    elsif (tg_op = 'DELETE') then
        if (old.status <> 'devolvido') then
            update public.livros
               set disponivel = least(disponivel + 1, quantidade)
             where id = old.livro_id;
        end if;
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists trg_ajusta_estoque on public.emprestimos;
create trigger trg_ajusta_estoque
    after insert or update or delete on public.emprestimos
    for each row execute function public.fn_ajusta_estoque();

-- ===========================================================================
-- 5. VIEW de relatório (junta nomes + status calculado em tempo real)
-- ===========================================================================
create or replace view public.vw_emprestimos as
select
    e.id,
    e.aluno_id,
    e.livro_id,
    e.data_emprestimo,
    e.data_prevista,
    e.data_devolucao,
    e.created_at,
    a.nome      as aluno_nome,
    a.matricula as aluno_matricula,
    l.titulo    as livro_titulo,
    l.autor     as livro_autor,
    case
        when e.data_devolucao is not null then 'devolvido'
        when e.data_prevista < current_date then 'atrasado'
        else 'ativo'
    end as status_atual
from public.emprestimos e
join public.alunos  a on a.id = e.aluno_id
join public.livros  l on l.id = e.livro_id;

-- A view respeita o RLS das tabelas base (Postgres 15+ / Supabase)
alter view public.vw_emprestimos set (security_invoker = on);

-- ===========================================================================
-- 6. ROW LEVEL SECURITY (RLS)
--    Ferramenta interna de equipe: qualquer usuário autenticado opera o acervo.
-- ===========================================================================
alter table public.users        enable row level security;
alter table public.alunos       enable row level security;
alter table public.livros       enable row level security;
alter table public.emprestimos  enable row level security;

-- ---- users: lê todos os perfis, gerencia apenas o próprio ----
drop policy if exists "users_select"      on public.users;
drop policy if exists "users_insert_self" on public.users;
drop policy if exists "users_update_self" on public.users;

create policy "users_select"
    on public.users for select to authenticated using (true);

create policy "users_insert_self"
    on public.users for insert to authenticated with check (auth.uid() = id);

create policy "users_update_self"
    on public.users for update to authenticated
    using (auth.uid() = id) with check (auth.uid() = id);

-- ---- alunos / livros / emprestimos: acesso total para autenticados ----
drop policy if exists "alunos_all"      on public.alunos;
drop policy if exists "livros_all"      on public.livros;
drop policy if exists "emprestimos_all" on public.emprestimos;

create policy "alunos_all"
    on public.alunos for all to authenticated using (true) with check (true);

create policy "livros_all"
    on public.livros for all to authenticated using (true) with check (true);

create policy "emprestimos_all"
    on public.emprestimos for all to authenticated using (true) with check (true);

-- ===========================================================================
-- 7. SEED (opcional) — dados de demonstração
--    Rode apenas se quiser popular o sistema com exemplos.
-- ===========================================================================
insert into public.livros (titulo, autor, categoria, isbn, quantidade, disponivel) values
    ('Dom Casmurro',                 'Machado de Assis',     'Romance',       '9788525406958', 5, 5),
    ('O Cortiço',                    'Aluísio Azevedo',      'Romance',       '9788508133093', 4, 4),
    ('Capitães da Areia',            'Jorge Amado',          'Romance',       '9788535911664', 3, 3),
    ('Vidas Secas',                  'Graciliano Ramos',     'Romance',       '9788501069880', 6, 6),
    ('A Hora da Estrela',            'Clarice Lispector',    'Romance',       '9788532511010', 2, 2),
    ('Memórias Póstumas de Brás Cubas','Machado de Assis',   'Romance',       '9788535914849', 4, 4),
    ('O Pequeno Príncipe',           'Antoine de Saint-Exupéry','Infantil',   '9788595081512', 8, 8),
    ('Harry Potter e a Pedra Filosofal','J. K. Rowling',     'Fantasia',      '9788532530783', 5, 5),
    ('1984',                         'George Orwell',        'Ficção',        '9788535914849', 4, 4),
    ('A Revolução dos Bichos',       'George Orwell',        'Ficção',        '9788535909554', 3, 3),
    ('Sapiens',                      'Yuval Noah Harari',    'História',      '9788525432186', 2, 2),
    ('Breves Respostas para Grandes Questões','Stephen Hawking','Ciência',    '9788ds5439970', 3, 3)
on conflict do nothing;

insert into public.alunos (nome, matricula, turma, telefone, email) values
    ('Ana Beatriz Souza',   '2024001', '9º A', '(11) 98888-0001', 'ana.souza@escola.edu.br'),
    ('Bruno Carvalho Lima', '2024002', '9º A', '(11) 98888-0002', 'bruno.lima@escola.edu.br'),
    ('Carla Mendes Rocha',  '2024003', '8º B', '(11) 98888-0003', 'carla.rocha@escola.edu.br'),
    ('Diego Fernandes',     '2024004', '8º B', '(11) 98888-0004', 'diego.f@escola.edu.br'),
    ('Eduarda Pereira',     '2024005', '7º C', '(11) 98888-0005', 'eduarda.p@escola.edu.br'),
    ('Felipe Augusto Dias', '2024006', '7º C', '(11) 98888-0006', 'felipe.dias@escola.edu.br'),
    ('Gabriela Nunes',      '2024007', '9º A', '(11) 98888-0007', 'gabriela.n@escola.edu.br'),
    ('Henrique Barbosa',    '2024008', '8º B', '(11) 98888-0008', 'henrique.b@escola.edu.br')
on conflict do nothing;

-- ============================================================================
--  Fim do schema.
-- ============================================================================
