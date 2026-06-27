/**
 * config.js
 * ---------------------------------------------------------------------------
 * Configuração central do BiblioTech.
 *
 * >>> PARA CONECTAR AO SUPABASE <<<
 *   1. Crie um projeto em https://supabase.com
 *   2. Vá em  Project Settings -> API
 *   3. Copie a "Project URL" e a chave "anon public"
 *   4. Cole abaixo nos campos SUPABASE_URL e SUPABASE_ANON_KEY
 *   5. Rode o arquivo database/schema.sql no SQL Editor do Supabase
 *
 * Enquanto as chaves estiverem com os valores de exemplo, o sistema roda
 * automaticamente em MODO DEMONSTRAÇÃO (dados salvos no navegador via
 * localStorage), permitindo testar 100% das funcionalidades sem backend.
 * ---------------------------------------------------------------------------
 */

export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_ANON_KEY = "SUA-CHAVE-ANON-PUBLIC";

/** Identidade visual / textos do produto */
export const APP = {
  name: "BiblioTech",
  tagline: "Sistema de Gestão de Biblioteca Escolar",
  version: "1.0.0",
};

/** Conta de demonstração criada automaticamente no modo offline */
export const DEMO_ACCOUNT = {
  nome: "Bibliotecário(a) Demo",
  email: "admin@biblioteca.com",
  senha: "123456",
};

/**
 * Detecta se o Supabase foi configurado de fato.
 * Se ainda estiver com os placeholders, ativamos o modo demonstração.
 */
export const IS_SUPABASE_CONFIGURED =
  /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes("SEU-PROJETO") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes("SUA-CHAVE");
