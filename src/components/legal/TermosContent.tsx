import { Separator } from "@/components/ui/separator";

const TermosContent = () => {
  return (
    <div className="space-y-8 text-foreground">
      <section>
        <p className="text-muted-foreground leading-relaxed">
          Leia atentamente os Termos de Consentimento do paciente para Teleconsulta na Plataforma de Telemedicina Prontia Saúde
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">1. Identificação do Paciente</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nome completo / CPF / RG / Data de nascimento / Endereço completo / Telefone / E-mail<br />
          Responsável legal (se aplicável): Nome completo, CPF, grau de parentesco.
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">2. Definição e Abrangência da Telemedicina</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          O paciente declara ter sido informado de que a telemedicina consiste na prestação de serviços médicos realizada a distância, por meio de videoconferência, áudio ou plataforma digital segura da Prontia Saúde, conforme autorização da Resolução CFM nº 2.314/2022.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          A teleconsulta tem como finalidade a assistência, o diagnóstico, o acompanhamento clínico e demais atos necessários ao atendimento, respeitados os limites técnicos e éticos da modalidade, com registro obrigatório no prontuário eletrônico.
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">3. Benefícios, Limitações e Riscos da Teleconsulta</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          O paciente reconhece que a telemedicina proporciona conveniência, acessibilidade, redução de deslocamentos e otimização do tempo.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-3">O paciente está ciente de que:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>a modalidade pode limitar a realização de exame físico completo e, conforme o quadro clínico, pode ser necessária complementação com avaliação presencial;</li>
          <li>a qualidade da consulta depende da estabilidade da conexão, do funcionamento adequado dos equipamentos e do ambiente utilizado;</li>
          <li>eventuais falhas técnicas podem interromper ou dificultar o atendimento, podendo o profissional encerrar a teleconsulta quando necessário, inclusive por segurança clínica;</li>
          <li>em caso de agravamento, piora súbita ou sinais de urgência, o paciente deve buscar imediatamente atendimento presencial de emergência;</li>
          <li>o paciente pode ligar e desligar a câmera e o áudio a qualquer momento durante a teleconsulta, ciente de que isso pode limitar a avaliação clínica.</li>
        </ul>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">4. Privacidade, Proteção de Dados e Prontuário — LGPD</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          O paciente autoriza o tratamento de seus dados pessoais e dados sensíveis de saúde, incluindo informações compartilhadas durante a teleconsulta, para fins de diagnóstico, acompanhamento, registro e demais atos necessários à prestação do serviço médico.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-3">O paciente está ciente de que:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>a plataforma Prontia Saúde utiliza mecanismos de segurança e sigilo, embora riscos residuais inerentes ao ambiente digital possam existir;</li>
          <li>as imagens e áudios da videoconferência não são gravados nem integrados ao prontuário eletrônico, sendo registradas apenas as anotações clínicas realizadas pelo profissional durante o atendimento;</li>
          <li>o conteúdo de chat, quando existente, não é armazenado de forma permanente, sendo utilizado apenas quando necessário para fins assistenciais;</li>
          <li>o acesso aos dados é restrito aos profissionais envolvidos no cuidado e a colaboradores autorizados, observadas as normas éticas, legais e técnicas;</li>
          <li>o prontuário eletrônico será mantido pelo período mínimo obrigatório por lei, independentemente de eventual revogação do consentimento;</li>
          <li>o paciente poderá solicitar acesso, esclarecimentos, correção de dados e demais direitos previstos na LGPD;</li>
          <li>o consentimento pode ser revogado antes da consulta, ciente de que tal revogação impedirá a realização do atendimento agendado.</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          O paciente pode revogar este consentimento a qualquer momento, respeitadas as hipóteses legais de guarda obrigatória das informações.
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">5. Responsabilidades do Paciente</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">O paciente declara que:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>fornecerá informações verdadeiras, completas e precisas sobre sua saúde, histórico e uso de medicamentos;</li>
          <li>realizará a teleconsulta em ambiente privado, adequado e livre de interrupções, contribuindo para a preservação do sigilo;</li>
          <li>entende que as condições técnicas de acesso, incluindo computador ou celular, conexão à internet, áudio e vídeo, são de responsabilidade exclusiva do paciente, que deve testá-los previamente ao atendimento;</li>
          <li>não gravará, copiará, reproduzirá ou divulgará qualquer imagem, áudio, vídeo ou conteúdo da teleconsulta sem autorização expressa do profissional.</li>
        </ul>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">6. Declaração de Consentimento</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          Eu, paciente acima identificado, ou meu responsável legal, declaro que:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>li ou recebi explicações claras sobre o teor deste documento;</li>
          <li>compreendi os benefícios, riscos e limitações da teleconsulta;</li>
          <li>fui informado sobre o tratamento dos meus dados pessoais e de saúde;</li>
          <li>tive oportunidade de esclarecer todas as minhas dúvidas;</li>
          <li>consinto livremente com a realização do atendimento médico por telemedicina.</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Local e data / Assinatura do paciente ou responsável legal / Assinatura e identificação do profissional.
        </p>
      </section>
    </div>
  );
};

export default TermosContent;
