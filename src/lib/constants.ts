// PRONTIA SAÚDE - Constantes e Configurações

// Environment Variables
export const ENV = {
  // Google Sheets integration removed
  STRIPE_PK: "pk_live_51Ry1CkENBHjf6SQJhXbLXOo4Ia72RcHaMFvMk3SKK9FYPeyqkCxA16Sriz5A82UYlpia7sgrEEjFgg5A5nK2qpPE00t2iroVX4"
};

// Checkout Configuration
export const CHECKOUT_MODE = "stripe";

// Catálogo de Serviços
export const CATALOGO_SERVICOS = [
  { 
    slug: "consulta", 
    nome: "Consulta clínica", 
    precoBase: 43.90, 
    sku: "CONSULTA_CLINICA",
    descricao: "Consulta médica online 24h por dia.",
    tempo: "30-45 minutos",
    inclui: ["Consulta por videochamada", "Receituário digital", "Orientações médicas"]
  },
  { 
    slug: "renovacao", 
    nome: "Renovação de receita", 
    precoBase: 29.90, 
    sku: "RENOVACAO_RECEITA",
    descricao: "Renove sua receita agora, válida em todo o Brasil e com assinatura digital.",
    tempo: "15-20 minutos", 
    inclui: ["Nova receita digital", "Orientações de uso"]
  },
  { 
    slug: "psicologa", 
    nome: "Psicólogo", 
    precoBase: 39.90, 
    sku: "PSICOLOGA",
    descricao: "Sessão de psicologia online",
    tempo: "30 minutos",
    inclui: ["Sessão terapêutica", "Acompanhamento psicológico", "Orientações personalizadas"]
  },
  { 
    slug: "medicos_especialistas", 
    nome: "Médicos Especialistas", 
    precoBase: 79.90, 
    sku: "MEDICOS_ESPECIALISTAS",
    descricao: "Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Ginecologia, Oftalmologia, Ortopedia, Otorrinolaringologia, Pediatria, Psiquiatria, Urologia, Fisioterapia",
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
    precoBase: 119.90, 
    sku: "LAUDOS_PSICOLOGICOS",
    descricao: "",
    tempo: "60-90 minutos",
    inclui: ["Laudo para bariátrica, laqueadura e vasectomia", "Avaliação completa"],
    naoInclui: ["Consulta psicológica prévia"]
  }
];

// Planos de Assinatura
export const PLANOS = [
  { 
    code: "INDIVIDUAL", 
    nome: "Individual", 
    precoMensal: 187,
    beneficios: [
      "Atendimento para 1 pessoa",
      "Atendimento prioritário",
      "Atendimento ilimitado",
      "Atendimento 24h/dia",
      "Sem coparticipação e sem carência"
    ],
    popular: false
  },
  { 
    code: "FAMILIAR", 
    nome: "Familiar", 
    precoMensal: 250,
    beneficios: [
      "Atendimento para até 4 pessoas",
      "Atendimento prioritário",
      "Atendimento ilimitado",
      "Atendimento 24h/dia",
      "Especialidades exclusivas: Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Geriatria, Ginecologia, Oftalmologia, Ortopedia, Pediatria, Psiquiatria, Otorrinolaringologia",
      "• Nutrição",
      "• Personal Trainer",
      "• Psicólogo (2x no mês)"
    ],
    popular: true
  },
  { 
    code: "EMPRESARIAL", 
    nome: "Empresarial", 
    precoMensal: 0,
    beneficios: [
      "Plano personalizado",
      "Atendimento prioritário",
      "Atendimento ilimitado",
      "Atendimento 24h/dia",
      "Especialidades exclusivas: Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Geriatria, Ginecologia, Oftalmologia, Ortopedia, Pediatria, Psiquiatria, Otorrinolaringologia",
      "• Nutrição",
      "• Personal Trainer",
      "• Psicólogo (2x no mês)",
      "Suporte dedicado"
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