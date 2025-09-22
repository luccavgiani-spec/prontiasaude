import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function FAQSection() {
  const faqs = [
    {
      question: "Como funciona a consulta online?",
      answer: "A consulta online é realizada por vídeo chamada com o profissional de saúde escolhido. Após o agendamento, você receberá um link no WhatsApp para acessar a consulta no dia e horário marcados."
    },
    {
      question: "O pagamento é seguro?",
      answer: "Sim, todos os pagamentos são processados por plataformas confiáveis e criptografadas, garantindo total segurança de suas informações financeiras."
    },
    {
      question: "Posso cancelar ou remarcar uma consulta?",
      answer: "Sim, você pode cancelar ou remarcar com até 24h de antecedência, sem custo adicional, diretamente pela plataforma ou via WhatsApp."
    },
    {
      question: "As consultas são cobertas por plano de saúde?",
      answer: "Atualmente, os serviços são pagos de forma particular, mas você pode solicitar a nota fiscal para reembolso junto ao seu plano, caso ele ofereça essa opção."
    },
    {
      question: "Como recebo meu laudo psicológico?",
      answer: "Após a consulta e análise do profissional, o laudo é enviado por e-mail ou WhatsApp em até 3 dias úteis, conforme a necessidade do paciente."
    },
    {
      question: "Quais especialidades estão disponíveis?",
      answer: "Oferecemos psicologia, clínica geral, especialistas em diversas áreas e emissão de laudos, tudo com profissionais qualificados e experientes."
    },
    {
      question: "As consultas são confidenciais?",
      answer: "Sim, garantimos total sigilo e segurança dos dados, seguindo todas as normas de ética e privacidade exigidas."
    },
    {
      question: "E se eu tiver problemas técnicos durante a consulta?",
      answer: "Nossa equipe de suporte está disponível para ajudar em tempo real, para que sua experiência seja a mais tranquila possível."
    },
    {
      question: "O que está incluído no valor da consulta?",
      answer: "O valor cobre a consulta online com o profissional, orientações e, se necessário, a emissão de receitas ou solicitações médicas digitais."
    },
    {
      question: "Como funciona o atendimento para laudos psicológicos?",
      answer: "É necessário agendar primeiro uma consulta psicológica para avaliação. Só então o laudo será emitido, conforme as normas profissionais."
    }
  ];

  return (
    <section id="faq" className="py-16 bg-muted/30">
      <div className="container mx-auto px-[25px]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tire suas dúvidas sobre nossos serviços e funcionamento
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-background rounded-xl border border-border/50 px-6">
                <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-2 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}