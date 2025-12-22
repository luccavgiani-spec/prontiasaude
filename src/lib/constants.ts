// PRONTIA SAÚDE - Constantes e Configurações

// Mercado Pago Configuration
export const MP_PUBLIC_KEY = "APP_USR-f1ef5dbe-cddf-4502-8439-1217b51e0af2";

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
    precoBase: 39.99, 
    sku: "ZXW2165",
    descricao: "Sessão de psicologia online",
    tempo: "30 minutos",
    inclui: ["Sessão terapêutica", "Acompanhamento psicológico", "Orientações personalizadas"]
  },
  { 
    slug: "medicos_especialistas", 
    nome: "Médicos Especialistas", 
    precoBase: 54.99, 
    sku: "BIR7668",
    descricao: "Personal Trainer, Nutricionista, Reumatologista, Neurologista, Infectologista, Nutrólogo, Geriatria, Urologista, Cardiologista, Dermatologista, Endocrinologista, Gastroenterologista, Ginecologista, Oftalmologista, Ortopedista, Pediatra, Otorrinolaringologista, Médico da Família, Psiquiatra",
    tempo: "30-60 minutos",
    inclui: [
      "Personal Trainer", "Nutricionista", "Reumatologista", 
      "Neurologista", "Infectologista", "Nutrólogo", "Geriatra",
      "Cardiologista", "Dermatologista", "Endocrinologista",
      "Gastroenterologista", "Ginecologista", "Oftalmologista",
      "Ortopedista", "Pediatra", "Otorrinolaringologista",
      "Médico da Família", "Psiquiatra", "Urologista"
    ],
    variantes: [
      { valor: 54.99, nome: "Personal Trainer", sku: "BIR7668" },
      { valor: 59.90, nome: "Nutricionista", sku: "VPN5132" },
      { valor: 129.90, nome: "Reumatologista", sku: "UDH3250" },
      { valor: 129.90, nome: "Neurologista", sku: "PKS9388" },
      { valor: 129.90, nome: "Infectologista", sku: "MYX5186" },
      { valor: 119.90, nome: "Nutrólogo", sku: "LZF3879" },
      { valor: 119.90, nome: "Geriatria", sku: "YZD9932" },
      { valor: 109.90, nome: "Urologista", sku: "URO1099" },
      { valor: 89.90, nome: "Cardiologista", sku: "TQP5720" },
      { valor: 89.90, nome: "Dermatologista", sku: "HGG3503" },
      { valor: 89.90, nome: "Endocrinologista", sku: "VHH8883" },
      { valor: 89.90, nome: "Gastroenterologista", sku: "TSB0751" },
      { valor: 89.90, nome: "Ginecologista", sku: "CCP1566" },
      { valor: 89.90, nome: "Oftalmologista", sku: "FKS5964" },
      { valor: 89.90, nome: "Ortopedista", sku: "TVQ5046" },
      { valor: 89.90, nome: "Pediatra", sku: "HMG9544" },
      { valor: 89.90, nome: "Otorrinolaringologista", sku: "HME8366" },
      { valor: 89.90, nome: "Médico da Família", sku: "DYY8522" },
      { valor: 89.90, nome: "Psiquiatra", sku: "QOP1101" }
    ]
  },
  { 
    slug: "laudos_psicologicos",
    nome: "Laudos Psicológicos",
    precoBase: 129.90,
    sku: "OVM9892",
    descricao: "Laudos assinados digitalmente",
    tempo: "Disponível após consulta",
    inclui: [
      "Laudo para bariátrica, laqueadura ou vasectomia.",
      "Assinatura digital do profissional",
      "Documento válido para fins legais"
    ],
    naoInclui: ["placeholder"]
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

// Descontos visuais por duração (apenas UI)
export const DESCONTOS_PLANO_VISUAL = {
  "1": 0,
  "3": 0.10,
  "6": 0.20,
  "12": 0.40
} as const;

// Depoimentos para prova social (8+ para carrossel)
export const DEPOIMENTOS = [
  {
    nome: "Tatiana Peixes, 54",
    avaliacao: 5,
    texto: "Atendimento excelente! Consegui minha consulta rapidamente e o médico foi muito atencioso."
  },
  {
    nome: "Ricardo de Paula, 46", 
    avaliacao: 5,
    texto: "Plataforma muito fácil de usar. Renovei minha receita sem sair de casa."
  },
  {
    nome: "Mario Goji, 32",
    avaliacao: 5, 
    texto: "Profissionais qualificados e preço justo. Recomendo para toda família."
  },
  {
    nome: "Teo Gonçalves, 27",
    avaliacao: 5,
    texto: "Nunca passei por uma consulta tão rápido. Comprei uma consulta, recebi o link da videochamada na mesma hora e em 30min fui atendido. Assinei um plano depois dessa, recomendo demais!"
  },
  {
    nome: "Fernanda Costa, 38",
    avaliacao: 5,
    texto: "Minha filha estava com febre de madrugada e conseguimos atendimento em menos de 10 minutos. Serviço essencial para famílias!"
  },
  {
    nome: "Carlos Mendes, 51",
    avaliacao: 5,
    texto: "Tenho pressão alta e preciso acompanhamento frequente. Com o plano, faço consultas mensais sem gastar fortunas. Muito satisfeito!"
  },
  {
    nome: "Julia Santos, 29",
    avaliacao: 5,
    texto: "A psicóloga foi incrível! Me senti acolhida desde o primeiro momento. Já marquei minha próxima sessão."
  },
  {
    nome: "Roberto Lima, 44",
    avaliacao: 5,
    texto: "Estava cético com telemedicina, mas mudei de opinião. Atendimento humano e profissional, melhor que muitos presenciais que já tive."
  },
  {
    nome: "Amanda Oliveira, 35",
    avaliacao: 5,
    texto: "Economizei muito tempo e dinheiro! Não preciso mais faltar trabalho para ir ao médico. Super prático."
  },
  {
    nome: "Pedro Henrique, 23",
    avaliacao: 5,
    texto: "Como universitário com orçamento apertado, o preço acessível foi decisivo. Qualidade top por um valor justo!"
  }
];

// Contadores para prova social
export const CONTADORES = {
  atendimentos: "+2.000",
  avaliacao: "4.9",
  medicos: "+50"
};
