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
    precoBase: 29.90, 
    sku: "RENOVACAO_RECEITA",
    descricao: "Por R$ 29,90 você renova agora sua receita válida em todo o Brasil.",
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
    slug: "medicos_especialistas", 
    nome: "Médicos Especialistas", 
    precoBase: 79.90, 
    sku: "MEDICOS_ESPECIALISTAS",
    descricao: "Consultas com especialistas em diversas áreas médicas",
    tempo: "45-60 minutos",
    inclui: [
      "Cardiologista", "Dermatologista", "Endocrinologista", 
      "Gastroenterologista", "Ginecologista", "Oftalmologista", 
      "Ortopedista", "Otorrinolaringologista", "Pediatria", 
      "Psiquiatria", "Urologista", "Fisioterapia"
    ]
  },
  { 
    slug: "laudos_psicologicos", 
    nome: "Laudos Psicológicos", 
    precoBase: 99.90, 
    sku: "LAUDOS_PSICOLOGICOS",
    descricao: "Laudos assinados digitalmente",
    tempo: "60-90 minutos",
    inclui: ["Laudo para bariátrica", "Laudo para laqueadura/vasectomia", "Avaliação completa"]
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
    beneficios: [
      "Descontos em consultas", 
      "Atendimento prioritário", 
      "Receitas digitais",
      "Atendimento 24h"
    ],
    popular: false
  },
  { 
    code: "FAMILIAR", 
    nome: "Plano Familiar", 
    precoMensal: 34.90,
    beneficios: [
      "Para até 4 pessoas", 
      "Descontos maiores", 
      "Atendimento prioritário", 
      "Histórico compartilhado",
      "Especialidades exclusivas:",
      "• Cardiologia",
      "• Dermatologia", 
      "• Endocrinologia",
      "• Gastroenterologia",
      "• Geriatria",
      "• Ginecologia",
      "• Médico da Família",
      "• Oftalmologia",
      "• Ortopedia",
      "• Otorrinolaringologia",
      "• Pediatria",
      "Nutrição (1x ao mês)",
      "Personal trainer (1x ao mês)",
      "Atendimento 24h"
    ],
    popular: true
  },
  { 
    code: "EMPRESARIAL", 
    nome: "Empresarial", 
    precoMensal: null,
    beneficios: [
      "Planos corporativos", 
      "Gestão de funcionários", 
      "Relatórios personalizados", 
      "Suporte dedicado",
      "Para funcionários ilimitados",
      "Especialidades exclusivas:",
      "• Cardiologia",
      "• Dermatologia", 
      "• Endocrinologia",
      "• Gastroenterologia",
      "• Geriatria",
      "• Ginecologia",
      "• Médico da Família",
      "• Oftalmologia",
      "• Ortopedia",
      "• Otorrinolaringologia",
      "• Pediatria",
      "Nutrição (1x ao mês)",
      "Personal trainer (1x ao mês)",
      "Atendimento 24h"
    ],
    popular: false
  }
];

// Mapa de Price IDs do Stripe
export const PRICE_MAP = {
  consulta: "price_1S0SpxENBHjf6SQJYKfzA6xs",
  renovacao: "price_1S0T9pENBHjf6SQJIQjyGiaG",
  psicologa: "price_1S0TAbENBHjf6SQJXFN80i1D",
  psiquiatria: "price_1S0TAzENBHjf6SQJRC8ZpnT5",
  laudo_bariatrica: "price_1S0TCsENBHjf6SQJpeAo8Nvr",
  laudo_laq_vas: "price_1S0TCNENBHjf6SQJIRlNoofO",
  plano_individual: "price_1S0TDYENBHjf6SQJiNZLlkw4",
  plano_familiar: "price_1S0TFBENBHjf6SQJVvKMb076"
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
    nome: "Tatiana Peixes, 54.",
    avaliacao: 5,
    texto: "Atendimento excelente! Consegui minha consulta rapidamente e o médico foi muito atencioso."
  },
  {
    nome: "Ricardo de Paula, 46.", 
    avaliacao: 5,
    texto: "Plataforma muito fácil de usar. Renovei minha receita sem sair de casa."
  },
  {
    nome: "Mario Goji, 32.",
    avaliacao: 5, 
    texto: "Profissionais qualificados e preço justo. Recomendo para toda família."
  },
  {
    nome: "Teo Gonçalves, 27.",
    avaliacao: 5,
    texto: "Nunca passei por uma consulta tão rápido. Comprei uma consulta, recebi o link da videochamada na mesma hora e em 30min fui atendido. Assinei um plano depois dessa, recomendo demais!"
  }
];

// Contadores para prova social
export const CONTADORES = {
  atendimentos: "+2.000",
  avaliacao: "4.9",
  medicos: "+50"
};