// Médicos do Bem - Constantes e Configurações

// Environment Variables
export const ENV = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx45643KLIb-YT0zy4o6nuBlk_nx0hXJjWxLjPyrgbbVBPn-Jq6NpXGOsJ4WBHnh3h5jw/exec",
  STRIPE_PK: "pk_live_51Ry1CkENBHjf6SQJhXbLXOo4Ia72RcHaMFvMk3SKK9FYPeyqkCxA16Sriz5A82UYlpia7sgrEEjFgg5A5nK2qpPE00t2iroVX4"
};

// Checkout Configuration
export const CHECKOUT_MODE = "apps_script";

// Catálogo de Serviços
export const CATALOGO_SERVICOS = [
  { 
    slug: "consulta", 
    nome: "Consulta clínica", 
    precoBase: 43.90, 
    sku: "CONSULTA_CLINICA",
    descricao: "Consulta médica online com profissionais qualificados",
    tempo: "30-45 minutos",
    inclui: ["Consulta por videochamada", "Receituário digital", "Orientações médicas"]
  },
  { 
    slug: "renovacao", 
    nome: "Renovação de receita", 
    precoBase: 34.90, 
    sku: "RENOVACAO_RECEITA",
    descricao: "Renovação rápida de receitas médicas",
    tempo: "15-20 minutos", 
    inclui: ["Avaliação do histórico", "Nova receita digital", "Orientações de uso"]
  },
  { 
    slug: "psicologa", 
    nome: "Psicóloga", 
    precoBase: 39.90, 
    sku: "PSICOLOGA",
    descricao: "Sessão de psicologia online",
    tempo: "50 minutos",
    inclui: ["Sessão terapêutica", "Acompanhamento psicológico", "Orientações personalizadas"]
  },
  { 
    slug: "psiquiatria", 
    nome: "Psiquiatria", 
    precoBase: 79.90, 
    sku: "PSIQUIATRIA",
    descricao: "Consulta psiquiátrica especializada",
    tempo: "45-60 minutos",
    inclui: ["Avaliação psiquiátrica", "Prescrição de medicamentos", "Acompanhamento clínico"]
  },
  { 
    slug: "laudo_bariatrica", 
    nome: "Laudo psicológico bariátrica", 
    precoBase: 99.90, 
    sku: "LAUDO_BARIATRICA",
    descricao: "Avaliação psicológica para cirurgia bariátrica",
    tempo: "60-90 minutos",
    inclui: ["Avaliação completa", "Laudo técnico", "Entrevistas estruturadas"]
  },
  { 
    slug: "laudo_laq_vas", 
    nome: "Laudo psicológico laqueadura/vasectomia", 
    precoBase: 99.90, 
    sku: "LAUDO_LAQ_VAS",
    descricao: "Avaliação psicológica para procedimentos contraceptivos",
    tempo: "60-90 minutos",
    inclui: ["Avaliação psicológica", "Laudo técnico especializado", "Orientações pré-procedimento"]
  }
];

// Planos de Assinatura
export const PLANOS = [
  { 
    code: "INDIVIDUAL", 
    nome: "Plano Individual", 
    precoMensal: 19.90,
    beneficios: ["Descontos em consultas", "Atendimento prioritário", "Receitas digitais"],
    popular: false
  },
  { 
    code: "FAMILIAR", 
    nome: "Plano Familiar", 
    precoMensal: 34.90,
    beneficios: ["Para até 4 pessoas", "Descontos maiores", "Atendimento prioritário", "Histórico compartilhado"],
    popular: true
  },
  { 
    code: "EMPRESARIAL", 
    nome: "Empresarial", 
    precoMensal: null,
    beneficios: ["Planos corporativos", "Gestão de funcionários", "Relatórios personalizados", "Suporte dedicado"],
    popular: false
  }
];

// Mapa de Price IDs do Stripe (a ser preenchido)
export const PRICE_MAP = {
  consulta: "price_xxx",
  renovacao: "price_xxx", 
  psicologa: "price_xxx",
  psiquiatria: "price_xxx",
  laudo_bariatrica: "price_xxx",
  laudo_laq_vas: "price_xxx",
  plano_individual: "price_xxx",
  plano_familiar: "price_xxx"
};

// Descontos visuais por duração (apenas UI)
export const DESCONTOS_PLANO_VISUAL = {
  "1": 0,
  "3": 0.10,
  "6": 0.20,
  "12": 0.40
} as const;

// Depoimentos para prova social
export const DEPOIMENTOS = [
  {
    nome: "Maria Silva",
    avaliacao: 5,
    texto: "Atendimento excelente! Consegui minha consulta rapidamente e o médico foi muito atencioso."
  },
  {
    nome: "João Santos", 
    avaliacao: 5,
    texto: "Plataforma muito fácil de usar. Renovei minha receita sem sair de casa."
  },
  {
    nome: "Ana Oliveira",
    avaliacao: 5, 
    texto: "Profissionais qualificados e preço justo. Recomendo para toda família."
  }
];

// Contadores para prova social
export const CONTADORES = {
  atendimentos: "+2.000",
  avaliacao: "4.9",
  medicos: "+50"
};