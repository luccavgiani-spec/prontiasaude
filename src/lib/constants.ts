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
    sku: "ITC6534",
    descricao: "Consulta médica online 24h por dia com clínico geral.",
    tempo: "30-45 minutos",
    inclui: ["Consulta por videochamada", "Receituário digital", "Orientações médicas"]
  },
  { 
    slug: "psicologa", 
    nome: "Psicólogo", 
    precoBase: 44.99, 
    sku: "ZXW2165",
    descricao: "Sessão de psicologia online",
    tempo: "30 minutos",
    inclui: ["Sessão terapêutica", "Acompanhamento psicológico", "Orientações personalizadas"],
    variantes: [
      { valor: 44.99, nome: "Individual (R$ 44,99/consulta)", sku: "ZXW2165", consultas: 1 },
      { valor: 167.96, nome: "Plano 4 consultas (R$ 41,99/consulta)", sku: "HXR8516", consultas: 4 },
      { valor: 307.92, nome: "Plano 8 consultas (R$ 38,49/consulta)", sku: "YME9025", consultas: 8 }
    ]
  },
  { 
    slug: "medicos_especialistas", 
    nome: "Médicos Especialistas", 
    precoBase: 54.90, 
    sku: "BIR7668",
    descricao: "Personal Trainer, Nutricionista, Reumatologista, Neurologista, Infectologista, Nutrólogo, Geriatria, Cardiologista, Dermatologista, Endocrinologista, Gastroenterologista, Ginecologista, Oftalmologista, Ortopedista, Pediatra, Otorrinolaringologista, Médico da Família, Psiquiatra",
    tempo: "30-60 minutos",
    inclui: [
      "Personal Trainer", "Nutricionista", "Reumatologista", 
      "Neurologista", "Infectologista", "Nutrólogo", "Geriatra",
      "Cardiologista", "Dermatologista", "Endocrinologista",
      "Gastroenterologista", "Ginecologista", "Oftalmologista",
      "Ortopedista", "Pediatra", "Otorrinolaringologista",
      "Médico da Família", "Psiquiatra"
    ],
    variantes: [
      { valor: 54.90, nome: "Personal Trainer", sku: "BIR7668" },
      { valor: 59.90, nome: "Nutricionista", sku: "VPN5132" },
      { valor: 129.90, nome: "Reumatologista", sku: "UDH3250" },
      { valor: 129.90, nome: "Neurologista", sku: "PKS9388" },
      { valor: 129.90, nome: "Infectologista", sku: "MYX5186" },
      { valor: 119.90, nome: "Nutrólogo", sku: "LZF3879" },
      { valor: 119.90, nome: "Geriatria", sku: "YZD9932" },
      { valor: 139.00, nome: "Cardiologista", sku: "GGF9727" },
      { valor: 139.00, nome: "Dermatologista", sku: "HGG3503" },
      { valor: 139.00, nome: "Endocrinologista", sku: "ABG9429" },
      { valor: 139.00, nome: "Gastroenterologista", sku: "TSB0751" },
      { valor: 139.00, nome: "Ginecologista", sku: "CCP1566" },
      { valor: 139.00, nome: "Oftalmologista", sku: "FKS5964" },
      { valor: 139.00, nome: "Ortopedista", sku: "OKZ7620" },
      { valor: 89.00, nome: "Pediatra", sku: "IAL1842" },
      { valor: 139.00, nome: "Otorrinolaringologista", sku: "HME8366" },
      { valor: 139.00, nome: "Médico da Família", sku: "YUE3975" },
      { valor: 139.00, nome: "Psiquiatra", sku: "SGH7835" }
    ]
  },
  { 
    slug: "laudos_psicologicos", 
    nome: "Laudos Psicológicos", 
    precoBase: 32.90, 
    sku: "OVM9892",
    descricao: "Necessário consulta prévia com psicólogo",
    tempo: "Disponível após consulta",
    inclui: [
      "Laudo para bariátrica, laudo para laqueadura e laudo para vasectomia",
      "Avaliação completa"
    ]
  },
  { 
    slug: "renovacao_receitas", 
    nome: "Renovação de receitas", 
    precoBase: 34.90, 
    sku: "RZP5755",
    descricao: "Renove suas receitas médicas de forma prática e rápida. Após a confirmação do pagamento, você poderá anexar sua receita atual válida (até 3 meses) e encaminhar para análise. Um médico avaliará e emitirá a renovação em documento digital",
    tempo: "Atendimento imediato",
    inclui: [
      "Análise de receita anterior (válida até 3 meses)",
      "Avaliação médica especializada",
      "Nova receita digital",
      "Atendimento rápido via WhatsApp"
    ]
  },
  { 
    slug: "solicitacao_exames", 
    nome: "Solicitação de Exames", 
    precoBase: 34.90, 
    sku: "ULT3571",
    descricao: "Obtenha solicitações de exames laboratoriais sem sair de casa. Escolha o exame desejado, informe seus dados clínicos e receba a requisição médica assinada digitalmente para realizar o exame em qualquer laboratório",
    tempo: "Atendimento rápido",
    inclui: [
      "Escolha entre 10 exames mais solicitados",
      "Avaliação e solicitação médica",
      "Requisição digital assinada",
      "Atendimento ágil via WhatsApp"
    ],
    variantes: [
      { valor: 34.90, nome: "Hemograma Completo", sku: "ULT3571" },
      { valor: 34.90, nome: "Glicemia em Jejum", sku: "ULT3571" },
      { valor: 34.90, nome: "Colesterol Total e Frações", sku: "ULT3571" },
      { valor: 34.90, nome: "Função Renal (Ureia e Creatinina)", sku: "ULT3571" },
      { valor: 34.90, nome: "TSH e T4 Livre (Tireoide)", sku: "ULT3571" },
      { valor: 34.90, nome: "Exame de Urina Tipo 1", sku: "ULT3571" },
      { valor: 34.90, nome: "Vitamina D", sku: "ULT3571" },
      { valor: 34.90, nome: "Ferritina", sku: "ULT3571" },
      { valor: 34.90, nome: "Ácido Úrico", sku: "ULT3571" },
      { valor: 34.90, nome: "HbA1c (Hemoglobina Glicada)", sku: "ULT3571" }
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