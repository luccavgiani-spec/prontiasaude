import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Como funciona a consulta online?",
    answer: "A consulta é realizada por videochamada segura, no dia e horário que você escolher — podendo acontecer até na mesma hora do pagamento. Após o agendamento, você recebe um link exclusivo para acessar a consulta pelo celular, tablet ou computador, sem necessidade de instalar aplicativos.\n\nDurante o atendimento, o médico pode:\n• Avaliar seus sintomas\n• Prescrever receitas digitais\n• Solicitar exames\n• Emitir atestados e laudos digitais\n\nTodo o processo acontece em uma plataforma criptografada, garantindo privacidade e sigilo médico.",
  },
  {
    question: "Em quanto tempo serei atendido?",
    answer: "O atendimento é imediato, normalmente em poucos minutos após a confirmação do pagamento.",
  },
  {
    question: "Preciso baixar algum aplicativo?",
    answer: "Não. A consulta acontece diretamente no navegador do seu celular, tablet ou computador.",
  },
  {
    question: "A emissão de receitas e atestados vale em todo o Brasil?",
    answer: "Sim. Todas as receitas, atestados e laudos digitais emitidos têm validade legal em todo o território nacional, com assinatura eletrônica segura.",
  },
  {
    question: "Emite receita de antibiótico?",
    answer: "Sim, quando houver indicação médica, conforme avaliação durante a consulta.",
  },
  {
    question: "Criança pode consultar?",
    answer: "Sim. Crianças podem ser atendidas desde que estejam acompanhadas pelo responsável legal durante a consulta.",
  },
  {
    question: "O atestado vem com CID?",
    answer: "Sim, caso o paciente solicite, o atestado pode ser emitido com CID.",
  },
  {
    question: "As consultas são confidenciais?",
    answer: "Sim. Nossa plataforma segue rigorosamente todas as normas e leis brasileiras, garantindo atendimento seguro, ético e sigiloso, conforme:\n\n• CFM – Resolução nº 2.314/2022: Autoriza consultas e acompanhamento remoto, com registro completo em prontuário.\n• LGPD – Lei nº 13.709/2018: Proteção total dos dados pessoais e de saúde.\n• Código de Ética Médica: Sigilo, responsabilidade e ética em todos os atendimentos.",
  },
  {
    question: "O que está incluso na consulta?",
    answer: "• Consulta completa via videochamada\n• Receita digital de medicamentos (quando indicada)\n• Atestados e laudos digitais\n• Registro seguro no prontuário eletrônico\n• Suporte e orientação médica durante o atendimento",
  },
  {
    question: "Os médicos que atendem possuem CRM?",
    answer: "Sim. Todas as consultas são realizadas por médicos formados, registrados no CRM e autorizados para atendimento online.",
  },
];

const PAFAQSection = () => {
  return (
    <section id="faq" className="py-16 bg-background">
      <div className="container max-w-3xl">
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
          PERGUNTAS FREQUENTES
        </h2>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-border rounded-lg px-4 bg-card"
            >
              <AccordionTrigger className="text-left text-sm font-medium text-foreground hover:text-primary hover:no-underline py-4">
                {index + 1} - {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 whitespace-pre-line">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default PAFAQSection;
