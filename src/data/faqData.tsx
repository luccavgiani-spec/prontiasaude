import { ReactNode } from "react";
export interface FAQ {
  question: string;
  answer: ReactNode;
}
export const faqData: FAQ[] = [{
  question: "Como funciona a consulta online?",
  answer: <p>
        A consulta é realizada por videochamada segura, no dia e horário que você escolher – podendo acontecer até na mesma hora do pagamento. Após o agendamento, você receberá um link exclusivo para acessar a consulta pelo celular, tablet ou computador. Durante o atendimento, o médico pode avaliar seus sintomas, prescrever receitas digitais, solicitar exames e emitir atestados, todos com validade legal em todo o Brasil. Todo o processo acontece em uma plataforma criptografada, garantindo privacidade e sigilo médico.
      </p>
}, {
  question: "A emissão de receitas e atestados vale em todo o Brasil?",
  answer: <p>
        Sim. Todas as receitas, atestados e laudos digitais emitidos pela nossa plataforma têm validade legal em todo o território nacional, com assinatura eletrônica segura.
      </p>
}, {
  question: "Como funciona o laudo psicológico?",
  answer: <div className="space-y-3">
        <p>
          Após a primeira consulta, o psicólogo avaliará quantas sessões serão necessárias para a emissão do laudo. Em média, são necessárias:
        </p>
        <p>
          Laudo de vasectomia ou laqueadura: 2 a 3 consultas;
        </p>
        <p>
          Laudo de cirurgia bariátrica: 4 a 10 consultas para laudos de cirurgia bariátrica.
        </p>
      </div>
}, {
  question: "Quais especialidades estão disponíveis?",
  answer: <p>
        Oferecemos cardiologia, dermatologia, endocrinologia, gastroenterologia, geriatria, ginecologia, médico da família, oftalmologia, ortopedia, pediatria, psiquiatria, otorrinolaringologia, psicologia, nutrição e personal trainer.
      </p>
}, {
  question: "As consultas são confidenciais?",
  answer: <div className="space-y-3">
        <p>
          Sim. Nossa plataforma segue todas as normas e leis brasileiras, garantindo atendimento confiável e sigiloso.
        </p>
        <p>
          <strong>CFM – Resolução 2.314/2022:</strong> Consultas e acompanhamento remoto com registro completo no prontuário.
        </p>
        <p>
          <strong>LGPD – Lei 13.709/2018:</strong> Proteção de todos os dados pessoais e de saúde.
        </p>
        <p>
          <strong>Código de Ética Médica:</strong> Sigilo, responsabilidade e ética em todos os atendimentos.
        </p>
      </div>
}, {
  question: "O que está incluso no valor da consulta médica?",
  answer: <p>
        Consulta completa via videochamada, receita digital de medicamentos, emissão de atestados e laudos digitais, registro seguro no prontuário eletrônico, suporte e orientação do profissional.
      </p>
}, {
  question: "Existe coparticipação ou carência no plano?",
  answer: <p>Não há coparticipação nas consultas online. O pagamento é apenas pelo serviço contratado. Não existe carência para consultas de telemedicina. Você pode usar assim que contratar.</p>
}, {
  question: "Existe diferença entre psicoterapia online e presencial?",
  answer: <p>
        A psicoterapia online oferece os mesmos benefícios da presencial, com conforto e flexibilidade para fazer a sessão de qualquer lugar. Todas as sessões são conduzidas por profissionais qualificados, com sigilo e ética garantidos.
      </p>
}];