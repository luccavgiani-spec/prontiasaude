import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LPFAQSection = () => {
  const faqs = [
    {
      question: "Como funciona a consulta online?",
      answer:
        "A consulta acontece por videochamada diretamente na plataforma. Após o pagamento, você será direcionado para a sala de espera virtual e conectado a um médico disponível. É simples, rápido e seguro.",
    },
    {
      question: "Em quanto tempo serei atendido?",
      answer:
        "O tempo médio de espera é de 5 a 15 minutos, dependendo da demanda. Nosso sistema prioriza o atendimento por ordem de chegada e disponibilidade de profissionais.",
    },
    {
      question: "Preciso baixar algum aplicativo?",
      answer:
        "Não! A Prontia funciona 100% pelo navegador do seu celular ou computador. Basta acessar nosso site, fazer o cadastro e iniciar sua consulta.",
    },
    {
      question: "A emissão de receitas e atestados vale em todo o Brasil?",
      answer:
        "Sim! Todos os documentos emitidos possuem validade legal em todo território nacional, conforme a Lei nº 13.989/2020 e Resolução CFM nº 2.314/2022. São assinados digitalmente com certificado ICP-Brasil.",
    },
    {
      question: "Emite receita de antibiótico?",
      answer:
        "Sim, nossos médicos podem prescrever antibióticos quando necessário, após avaliação clínica. A receita digital é válida em qualquer farmácia do Brasil.",
    },
    {
      question: "Criança pode consultar?",
      answer:
        "Sim! Atendemos pacientes de todas as idades. Para menores de 18 anos, é necessário que um responsável legal esteja presente durante a consulta.",
    },
    {
      question: "O atestado vem com CID?",
      answer:
        "O médico avalia cada caso individualmente. O CID pode ser incluído no atestado quando clinicamente justificado, a critério do profissional.",
    },
    {
      question: "As consultas são confidenciais?",
      answer:
        "Absolutamente! Seguimos rigorosamente o sigilo médico e a LGPD. Todas as consultas são privadas e seus dados são protegidos com criptografia.",
    },
    {
      question: "O que está incluso na consulta?",
      answer:
        "A consulta inclui: atendimento por videochamada com médico, prescrição de receitas (quando necessário), emissão de atestados, solicitação de exames e orientações médicas completas.",
    },
  ];

  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            PERGUNTAS FREQUENTES
          </h2>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border/50 shadow-sm px-6 overflow-hidden"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary py-4">
                  {index + 1} - {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default LPFAQSection;
