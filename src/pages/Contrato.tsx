import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const Contrato = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Contrato de Prestação de Serviços Médicos por Telemedicina
            </CardTitle>
            <p className="text-muted-foreground text-center mt-2">
              Prontia Saúde
            </p>
          </CardHeader>
          <CardContent className="space-y-8 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. IDENTIFICAÇÃO DAS PARTES</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                <strong>Contratante/Paciente:</strong> Pessoa física identificada no momento da contratação na plataforma digital, responsável pelas informações cadastrais fornecidas.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Contratada:</strong> PRIMECARE SERVIÇOS MÉDICOS LTDA, de nome fantasia Prontìa Saúde, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 56.210.013/0001-40, com sede à Av. Fábio Montanari Ramos, nº 204, bairro Lagos de Santa Helena, na cidade de Bragança Paulista/SP, CEP 12.916-450, representada por sua sócia administradora, Sra. Victoria Toledo Silva, CPF nº 451.659.578-88 e RG nº 55.546.565-2 SSP/SP.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Ambas as partes reconhecem a validade da assinatura eletrônica realizada na plataforma.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">2. OBJETO DO CONTRATO</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                2.1 O presente contrato tem por objeto a prestação de serviços médicos na modalidade teleconsulta, realizada por videoconferência por profissional habilitado e inscrito no Conselho Regional de Medicina.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                2.2 A teleconsulta se destina exclusivamente a situações clínicas de baixa complexidade, compatíveis com atendimento remoto.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                2.3 O serviço <strong>NÃO</strong> abrange:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mb-3">
                <li>acompanhamento de doenças crônicas;</li>
                <li>renovação recorrente de receitas de uso contínuo;</li>
                <li>prescrição de medicamentos sujeitos a controle especial;</li>
                <li>pedidos de exames de rotina;</li>
                <li>emissão de laudos ocupacionais;</li>
                <li>atendimentos de urgência ou emergência;</li>
                <li>atos que dependam de exame físico ou avaliação presencial.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-3">
                2.4 O Paciente declara ciência de que quadros clínicos que indiquem risco imediato à saúde não serão atendidos por telemedicina, devendo buscar serviço presencial de urgência. Consideram-se situações de alerta, entre outras, dor torácica intensa, falta de ar acentuada, alterações neurológicas súbitas, perda de consciência, traumas relevantes e sangramentos importantes.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                2.5 Sempre que necessário, o profissional poderá orientar o Paciente a buscar imediatamente atendimento presencial, permanecendo a responsabilidade da Contratada limitada à orientação prestada.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                2.6 Os atendimentos poderão ser realizados por médicos vinculados à Contratada ou por profissionais disponibilizados pela plataforma utilizada.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                2.7 Quando não houver disponibilidade de médico especialista, a consulta poderá ser realizada por médico generalista devidamente habilitado, permanecendo a Contratada isenta de responsabilidade pela ausência de especialidade específica no momento da demanda.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">3. FORMATO DO ATENDIMENTO</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                3.1 A teleconsulta será realizada por videoconferência, mediante acesso do Paciente a dispositivo com internet, câmera e áudio funcionais.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                3.2 A Contratada não se responsabiliza por limitações técnicas ou falhas de conectividade que impeçam a conclusão do atendimento.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                3.3 A Contratada observará protocolos clínicos, normas sanitárias e diretrizes do Conselho Federal de Medicina, mantendo prontuário eletrônico atualizado.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                3.4 O Paciente declara ciência das limitações inerentes ao atendimento remoto, sendo vedado interpretar tele orientação, mensagens assíncronas ou suporte administrativo como teleconsulta.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                3.5 Mensagens enviadas por canais de suporte, chats ou atendimento administrativo não constituem ato médico nem substituem teleconsulta, a qual somente ocorre quando houver interação síncrona com registro em prontuário.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">4. CADASTRO, ACESSO E OBRIGAÇÕES DO PACIENTE</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                4.1 O Paciente deverá manter dados cadastrais verdadeiros e atualizados.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                4.2 Login e senha são pessoais e intransferíveis, respondendo o Paciente pelo uso indevido, inclusive por terceiros que obtenham acesso mediante compartilhamento voluntário.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                4.3 O Paciente deverá confirmar sua identidade no início do atendimento, mediante apresentação de documento oficial com foto ou pelos mecanismos de verificação disponibilizados na plataforma. A impossibilidade de validação poderá impedir a continuidade da consulta.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                4.4 O Paciente se compromete a:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mb-3">
                <li>informar seu histórico clínico e medicamentoso com precisão;</li>
                <li>manter comportamento respeitoso durante o atendimento;</li>
                <li>resguardar documentos recebidos, como receitas e relatórios;</li>
                <li>identificar-se quando solicitado;</li>
                <li>utilizar a plataforma somente para fins lícitos e compatíveis com assistência à saúde.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                4.5 O profissional poderá interromper imediatamente o atendimento caso o Paciente apresente comportamento ofensivo, desrespeitoso, agressivo ou incompatível com ambiente clínico, sem que este tenha direito a quaisquer reembolsos.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">5. PLANOS, PACOTES E CONSULTAS AVULSAS</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                5.1 O Paciente poderá contratar consultas avulsas ou planos e pacotes exibidos na plataforma, cujos valores, limites e prazos serão apresentados no momento da contratação.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                5.2 Pacotes ou créditos não utilizados dentro do prazo de vigência não geram reembolso, não podem ser transferidos a terceiros e não podem ser prorrogados para períodos futuros.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                5.3 Em caso de ausência no horário agendado sem aviso prévio, poderá ocorrer perda da consulta conforme regras operacionais da plataforma.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                5.4 Quando aplicável, a plataforma poderá limitar o número de atendimentos por período, sendo considerada inelegibilidade quando atingido o limite máximo contratado.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">6. DIREITO DE ARREPENDIMENTO</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                6.1 Quando a contratação ocorrer por meio eletrônico, o Paciente poderá exercer o direito de arrependimento no prazo de 7 dias, na forma do Código de Defesa do Consumidor.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                6.2 Não havendo teleconsulta realizada, a devolução será integral.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                6.3 Havendo atendimento realizado no período de arrependimento, poderá haver devolução parcial, com retenção do valor proporcional à consulta executada.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                6.4 Após os 7 dias, o cancelamento seguirá as regras do plano contratado, sem devolução de valores relativos a serviços utilizados ou iniciados.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. RESPONSABILIDADE DAS PARTES</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                7.1 A Contratada é responsável pelos atendimentos realizados por seus profissionais e pela qualidade técnica da conduta adotada.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                7.2 Atendimentos prestados por médicos vinculados à empresa terceirizada da plataforma serão de responsabilidade do respectivo profissional, cabendo à Contratada a governança interna, auditoria médica e eventual direito de regresso.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                7.3 A Contratada não se responsabiliza por deslocamento ou remoção do Paciente, custos de atendimento presencial, falhas de conexão, limitações técnicas do dispositivo utilizado pelo Paciente ou uso inadequado da plataforma.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                7.4 A Contratada igualmente não responderá por indisponibilidades, instabilidades, oscilações, manutenções ou quaisquer falhas da plataforma digital pertencente à empresa terceirizada fornecedora da tecnologia, limitando-se sua obrigação a orientar o reagendamento ou adotar, quando possível, medidas alternativas.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                7.5 A Contratada não será responsável pela recusa do médico em emitir atestados, prescrições, relatórios ou quaisquer documentos clínicos quando inexistirem elementos técnicos suficientes para sua elaboração, sendo vedada a emissão com base exclusivamente na solicitação do Paciente.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. PROTEÇÃO DE DADOS PESSOAIS</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                8.1 O tratamento de dados será realizado conforme a Lei Geral de Proteção de Dados e normas aplicáveis à saúde.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                8.2 Na consecução deste contrato a Contratada atuará como controladora dos dados médicos e a plataforma como operadora, com registros de segurança, criptografia e rastreabilidade.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                8.3 Os dados serão utilizados para: identificação; consulta; prontuário; documentos clínicos; comunicações assistenciais.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                8.4 Além da LGPD, será observado integralmente o sigilo médico previsto no Código de Ética Médica.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                8.5 Consentimento específico será solicitado para comunicações institucionais.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                8.6 Direitos do titular poderão ser exercidos nos canais informados.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">9. PRONTUÁRIO E DOCUMENTOS MÉDICOS</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                9.1 Todo atendimento será registrado em prontuário eletrônico, cuja guarda caberá à Contratada pelo prazo mínimo previsto em lei.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                9.2 O Paciente poderá solicitar acesso às informações constantes do prontuário mediante requerimento formal, observado o disposto na legislação aplicável.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                9.3 A emissão de atestados, declarações, prescrições e demais documentos clínicos dependerá exclusivamente da avaliação técnica do médico responsável, conforme normas éticas e regulamentares. A Contratada não garante a emissão de qualquer documento mediante simples solicitação do Paciente.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                9.4 A emissão de atestados somente ocorrerá quando existirem elementos clínicos suficientes para justificar afastamento ou recomendação específica. Quando tais elementos não puderem ser obtidos em teleconsulta, o médico orientará atendimento presencial, sem que isso configure negativa indevida.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                9.5 Fica vedada a emissão de documentos incompatíveis com telemedicina, tais como laudos ocupacionais, atestados periciais, atestados de sanidade física ou mental, documentos relacionados a concursos ou exames admissionais, e quaisquer outros que exijam exame físico presencial.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                9.6 O médico não emitirá atestados retroativos, salvo quando houver justificativa clínica devidamente registrada em prontuário e compatível com as normas do Conselho Federal de Medicina.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                9.7 Receitas, atestados e documentos médicos serão emitidos com assinatura eletrônica válida, conforme legislação vigente, incluindo MP 2.200-2/2001 e regulamentações aplicáveis à prescrição digital.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">10. VIGÊNCIA E RENOVAÇÃO</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                10.1 A vigência dependerá da modalidade contratada, indicada no momento da adesão.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                10.2 Nos planos com renovação automática, o Paciente poderá solicitar a não renovação com antecedência mínima de 7 dias, sem prejuízo das obrigações financeiras relativas ao período já contratado.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">11. ATENDIMENTO AO PACIENTE</h2>
              <p className="text-muted-foreground leading-relaxed">
                11.1 A Contratada manterá canal de atendimento administrativo para dúvidas e suporte operacional. O canal não substitui atendimento clínico, nem se destina a urgências ou emergências.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">12. FORO E LEI APLICÁVEL</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                12.1 Este contrato é regido pelas leis brasileiras e pelas normas do Conselho Federal de Medicina.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                12.2 Para resolução de conflitos, fica eleito o foro do domicílio do Paciente, nos termos do Código de Defesa do Consumidor.
              </p>
            </section>

            <Separator />

            <section>
              <p className="text-muted-foreground leading-relaxed italic">
                Ao manifestar concordância eletrônica na plataforma, o PACIENTE aceita integralmente os termos deste contrato.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contrato;
