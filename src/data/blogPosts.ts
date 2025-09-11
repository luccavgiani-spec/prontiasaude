import telemedicineImage from "@/assets/telemedicine-consultation.jpg";
import prescriptionImage from "@/assets/doctor-prescription-real.jpg";
import consultationImage from "@/assets/doctor-online-consultation.jpg";
import medicalTeamImage from "@/assets/medical-team-modern.jpg";
import heroMedicalImage from "@/assets/hero-medical.jpg";
import heroModernImage from "@/assets/hero-doctor-modern.jpg";

export type BlogPost = {
  slug: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageAlt?: string;
  tags: string[];   // ex.: ["Saúde", "Nutrição"]
  date: string;     // ISO
  content: string[]; // parágrafos
};

export const blogPosts: BlogPost[] = [
  {
    slug: "telemedicina-consulta-na-hora",
    title: "Telemedicina: consulta na hora e com segurança",
    subtitle: "Entenda como a tecnologia agiliza o cuidado sem perder qualidade",
    imageUrl: telemedicineImage,
    imageAlt: "Paciente em consulta online com médico",
    tags: ["Telemedicina", "Cuidados"],
    date: "2025-01-15",
    content: [
      "A consulta online permite atendimento rápido e seguro, revolucionando a forma como cuidamos da nossa saúde. Com a telemedicina, você pode ter acesso a médicos qualificados a qualquer hora do dia, eliminando filas e deslocamentos desnecessários.",
      "Para preparar sua primeira consulta online, certifique-se de ter uma conexão estável de internet, um ambiente tranquilo e bem iluminado, além de ter em mãos seus documentos e exames anteriores. O médico poderá fazer a avaliação completa e, se necessário, prescrever medicamentos e solicitar exames.",
      "A plataforma garante total segurança e confidencialidade dos dados, seguindo todas as normas do Conselho Federal de Medicina. Seus dados ficam protegidos e suas consultas são registradas de forma segura para acompanhamento futuro.",
    ],
  },
  {
    slug: "receitas-digitais-como-funcionam",
    title: "Receitas Digitais: Como funcionam e sua validade",
    subtitle: "Tudo sobre prescrições médicas online e como utilizá-las",
    imageUrl: prescriptionImage,
    imageAlt: "Médico emitindo receita digital",
    tags: ["Receitas", "Digital"],
    date: "2025-01-10",
    content: [
      "As receitas digitais têm a mesma validade legal das receitas impressas tradicionais, sendo reconhecidas pelo Conselho Federal de Medicina e aceitas em todas as farmácias do Brasil.",
      "Durante sua consulta online, o médico pode prescrever medicamentos diretamente pelo sistema, gerando uma receita com assinatura digital certificada. Você receberá o documento por email e também poderá acessá-lo através da plataforma.",
      "Para usar sua receita digital, basta apresentar o documento (impresso ou no celular) na farmácia. O farmacêutico pode verificar a autenticidade através do QR Code presente na receita, garantindo segurança no processo.",
    ],
  },
  {
    slug: "atestados-medicos-online",
    title: "Atestados Médicos Online: Praticidade e Legalidade",
    subtitle: "Como obter atestados válidos através de consultas virtuais",
    imageUrl: consultationImage,
    imageAlt: "Consulta médica online para emissão de atestado",
    tags: ["Atestados", "Trabalho"],
    date: "2025-01-05",
    content: [
      "Os atestados médicos emitidos em consultas online têm total validade legal, sendo aceitos por empresas e instituições em todo o território nacional, conforme regulamentação do CFM.",
      "Para solicitar um atestado durante sua consulta, informe ao médico sobre seus sintomas e a necessidade do documento. O profissional fará a avaliação adequada e, se indicado, emitirá o atestado com o período de afastamento necessário.",
      "O documento é gerado com assinatura digital certificada e pode ser utilizado imediatamente. Você recebe o atestado por email e pode imprimi-lo ou enviá-lo digitalmente para seu empregador.",
    ],
  },
  {
    slug: "cuidados-preventivos-saude",
    title: "Cuidados Preventivos: A Importância do Check-up Regular",
    subtitle: "Como manter sua saúde em dia com consultas periódicas",
    imageUrl: medicalTeamImage,
    imageAlt: "Equipe médica em hospital moderno",
    tags: ["Prevenção", "Saúde"],
    date: "2024-12-28",
    content: [
      "A medicina preventiva é fundamental para detectar precocemente possíveis problemas de saúde e manter o bem-estar ao longo da vida. Check-ups regulares podem identificar fatores de risco antes que se tornem problemas sérios.",
      "Durante uma consulta preventiva online, o médico avaliará seu histórico familiar, hábitos de vida, e solicitará exames adequados para sua faixa etária. Essa abordagem permite acompanhamento contínuo da sua saúde.",
      "Além dos exames de rotina, o médico orientará sobre hábitos saudáveis, vacinação em dia, e cuidados específicos baseados no seu perfil individual. A prevenção é sempre o melhor remédio.",
    ],
  },
  {
    slug: "emergencias-medicas-quando-procurar",
    title: "Emergências Médicas: Quando Procurar Atendimento Imediato",
    subtitle: "Saiba identificar situações que requerem cuidado médico urgente",
    imageUrl: heroMedicalImage,
    imageAlt: "Atendimento médico de emergência",
    tags: ["Emergência", "Urgência"],
    date: "2024-12-20",
    content: [
      "Saber identificar uma emergência médica pode salvar vidas. Sintomas como dor no peito, dificuldade para respirar, perda de consciência ou sangramento intenso requerem atendimento presencial imediato.",
      "Para situações menos graves, mas que causam preocupação, a telemedicina pode ser uma excelente primeira opção. O médico online pode avaliar os sintomas, orientar sobre os primeiros cuidados e decidir se há necessidade de atendimento presencial.",
      "Tenha sempre em mente os sinais de alerta que indicam emergência real: alterações súbitas da consciência, dores intensas e súbitas, sangramentos que não param, e dificuldades respiratórias graves. Nesses casos, procure imediatamente um pronto-socorro.",
    ],
  },
  {
    slug: "saude-mental-consultas-online",
    title: "Saúde Mental: O Papel das Consultas Online no Bem-Estar",
    subtitle: "Como a telemedicina pode ajudar no cuidado da saúde mental",
    imageUrl: heroModernImage,
    imageAlt: "Consulta de saúde mental online",
    tags: ["Saúde Mental", "Bem-estar"],
    date: "2024-12-15",
    content: [
      "A saúde mental é tão importante quanto a saúde física, e as consultas online facilitam o acesso a cuidados psicológicos e psiquiátricos, especialmente para quem tem dificuldade de sair de casa ou vive em locais com poucos especialistas.",
      "Durante uma consulta online de saúde mental, o profissional pode fazer avaliações, prescrever medicamentos quando necessário, e oferecer orientações terapêuticas. O ambiente familiar muitas vezes ajuda o paciente a se sentir mais à vontade.",
      "É importante lembrar que cuidar da saúde mental não é sinal de fraqueza, mas de autocuidado. Se você sente ansiedade, depressão, ou outros sintomas que afetam sua qualidade de vida, procure ajuda profissional.",
    ],
  },
];