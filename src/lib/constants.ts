// PRONTIA SAÚDE - Constantes e Configurações

// Environment Variables
export const ENV = {
  // InfinitePay configuration will be used from the checkout library
};

// Google Apps Script API Base URL
export const GAS_BASE = "https://script.google.com/macros/s/AKfycbx80rwMZwJVjiw8DMtwaQERGPzFzHU2ZVSLRBfQ5tRJkHwVvYB9ep9lABKdKuBJ4tFL/exec";

// Checkout Configuration
export const CHECKOUT_MODE = "infinitepay";

// Catálogo de Serviços
export const CATALOGO_SERVICOS = [
  { 
    slug: "consulta", 
    nome: "Pronto Atendimento", 
    precoBase: 43.90, 
    sku: "PREENCHER_DEPOIS",
    descricao: "Consulta médica online 24h por dia com clínico geral.",
    tempo: "30-45 minutos",
    inclui: ["Consulta por videochamada", "Receituário digital", "Orientações médicas"]
  },
  { 
    slug: "psicologa", 
    nome: "Psicólogo", 
    precoBase: 44.99, 
    sku: "PREENCHER_DEPOIS",
    descricao: "Sessão de psicologia online",
    tempo: "30 minutos",
    inclui: ["Sessão terapêutica", "Acompanhamento psicológico", "Orientações personalizadas"],
    variantes: [
      { valor: 44.99, nome: "Individual", sku: "PREENCHER_DEPOIS", consultas: 1 },
      { valor: 41.99, nome: "Plano 4 consultas", sku: "PREENCHER_DEPOIS", consultas: 4 },
      { valor: 38.49, nome: "Plano 8 consultas", sku: "PREENCHER_DEPOIS", consultas: 8 }
    ]
  },
  { 
    slug: "medicos_especialistas", 
    nome: "Especialidades", 
    precoBase: 89.90, 
    sku: "PREENCHER_DEPOIS",
    descricao: "Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Geriatria, Ginecologia, Infectologia, Neurologia, Nutrologia, Oftalmologia, Ortopedia, Otorrinolaringologia, Pediatria, Psiquiatria, Reumatologia, Médico da Família",
    tempo: "45-60 minutos",
    inclui: [
      "Cardiologista", "Dermatologista", "Endocrinologista", 
      "Gastroenterologista", "Geriatra", "Ginecologista", 
      "Infectologista", "Neurologista", "Nutrólogo",
      "Oftalmologista", "Ortopedista", "Otorrinolaringologista", 
      "Pediatra", "Psiquiatra", "Reumatologista", "Médico da Família"
    ],
    variantes: [
      { valor: 89.90, nome: "Cardiologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Dermatologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Endocrinologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Gastroenterologia", sku: "PREENCHER_DEPOIS" },
      { valor: 119.90, nome: "Geriatria", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Ginecologia", sku: "PREENCHER_DEPOIS" },
      { valor: 129.90, nome: "Infectologia", sku: "PREENCHER_DEPOIS" },
      { valor: 129.90, nome: "Neurologia", sku: "PREENCHER_DEPOIS" },
      { valor: 119.90, nome: "Nutrologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Oftalmologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Ortopedia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Otorrinolaringologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Pediatria", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Psiquiatria", sku: "PREENCHER_DEPOIS" },
      { valor: 129.90, nome: "Reumatologia", sku: "PREENCHER_DEPOIS" },
      { valor: 89.90, nome: "Médico da Família", sku: "PREENCHER_DEPOIS" }
    ]
  },
  { 
    slug: "nutricionista", 
    nome: "Nutricionista", 
    precoBase: 59.90, 
    sku: "PREENCHER_DEPOIS",
    descricao: "Consulta com nutricionista online",
    tempo: "30-45 minutos",
    inclui: ["Consulta nutricional", "Plano alimentar", "Orientações personalizadas"]
  },
  { 
    slug: "personal_trainer", 
    nome: "Personal Trainer", 
    precoBase: 54.99, 
    sku: "PREENCHER_DEPOIS",
    descricao: "Sessão com personal trainer online",
    tempo: "30-45 minutos",
    inclui: ["Treino personalizado", "Acompanhamento profissional", "Orientações de exercícios"]
  },
  { 
    slug: "laudos_psicologicos", 
    nome: "Laudos Psicológicos", 
    precoBase: 30000, 
    sku: "PRONTIA_LAUDO_PSICOLOGICO",
    descricao: "Necessário consulta prévia com psicólogo. Aplicável para cirurgia bariátrica, laqueadura, vasectomia, porte de arma, CNH e outros documentos legais",
    tempo: "Disponível após consulta",
    inclui: [
      "Laudo psicológico completo",
      "Assinatura digital do profissional",
      "Documento válido para fins legais",
      "Entrega em até 7 dias úteis"
    ]
  },
  { 
    slug: "renovacao_receitas", 
    nome: "Renovação de Receitas e Atestados", 
    precoBase: 3490, 
    sku: "PRONTIA_RENOVACAO_RECEITA",
    descricao: "Assim que o pagamento for aprovado, um de nossos médicos vai entrar em contato com você pelo WhatsApp, solicitar a foto da receita ou atestado e dar prosseguimento imediato ao atendimento",
    tempo: "Atendimento imediato",
    inclui: [
      "Contato via WhatsApp",
      "Avaliação médica",
      "Nova receita digital",
      "Atendimento rápido"
    ]
  }
];

// Planos de Assinatura
export const PLANOS = [
  { 
    code: "INDIVIDUAL_COM_ESPECIALISTA", 
    nome: "Individual - com especialista", 
    precoMensal: {
      "1": 23.99,
      "6": 17.99,
      "12": 15.99
    },
    sku: {
      "1": "PREENCHER_DEPOIS",
      "6": "PREENCHER_DEPOIS",
      "12": "PREENCHER_DEPOIS"
    },
    beneficios: [
      "Atendimento ilimitado",
      "Consultas com clínico geral 24h/dia",
      "Especialidades exclusivas",
      "Nutrição e personal trainer",
      "Psicólogo quinzenal",
      "Sem coparticipação e carência",
      "Descontos em farmácias e exames"
    ],
    popular: true
  },
  { 
    code: "INDIVIDUAL_SEM_ESPECIALISTA", 
    nome: "Individual - sem especialista", 
    precoMensal: {
      "1": 19.99,
      "6": 15.99,
      "12": 13.99
    },
    sku: {
      "1": "PREENCHER_DEPOIS",
      "6": "PREENCHER_DEPOIS",
      "12": "PREENCHER_DEPOIS"
    },
    beneficios: [
      "Atendimento ilimitado",
      "Consultas com clínico geral 24h/dia",
      "Sem coparticipação e carência",
      "Descontos em farmácias e exames"
    ],
    popular: false
  },
  { 
    code: "FAMILIAR_COM_ESPECIALISTA", 
    nome: "Familiar - com especialista", 
    precoMensal: {
      "1": 39.99,
      "6": 33.99,
      "12": 29.90
    },
    sku: {
      "1": "PREENCHER_DEPOIS",
      "6": "PREENCHER_DEPOIS",
      "12": "PREENCHER_DEPOIS"
    },
    beneficios: [
      "Atendimento para até 4 familiares",
      "Atendimento ilimitado",
      "Consultas com clínico geral 24h/dia",
      "Especialidades exclusivas",
      "Nutrição e personal trainer",
      "Psicólogo quinzenal",
      "Sem coparticipação e carência",
      "Descontos em farmácias e exames"
    ],
    popular: false
  },
  { 
    code: "FAMILIAR_SEM_ESPECIALISTA", 
    nome: "Familiar - sem especialista", 
    precoMensal: {
      "1": 29.90,
      "6": 26.90,
      "12": 24.30
    },
    sku: {
      "1": "PREENCHER_DEPOIS",
      "6": "PREENCHER_DEPOIS",
      "12": "PREENCHER_DEPOIS"
    },
    beneficios: [
      "Atendimento para até 4 familiares",
      "Atendimento ilimitado",
      "Consultas com clínico geral 24h/dia",
      "Sem coparticipação e carência",
      "Descontos em farmácias e exames"
    ],
    popular: false
  },
  { 
    code: "EMPRESARIAL", 
    nome: "Empresarial", 
    precoMensal: {
      "1": 0,
      "6": 0,
      "12": 0
    },
    sku: {
      "1": "CONTATO",
      "6": "CONTATO",
      "12": "CONTATO"
    },
    beneficios: [
      "Plano personalizado",
      "Atendimento prioritário",
      "Atendimento ilimitado",
      "Atendimento 24h/dia",
      "Especialidades exclusivas",
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