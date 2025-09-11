import Stepper, { Step } from "@/components/bits/Stepper";
import consultaImage from "@/assets/medical-team-realistic.jpg";

export default function ComoFuncionaStepper() {
  return (
    <section className="relative py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 md:grid-cols-2 md:items-center">
        <div className="text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">Como Funciona</h2>
          <p className="mt-2 text-neutral-600">Três passos simples para revolucionar o cuidado com sua saúde</p>

          <div className="mt-6">
            <Stepper initialStep={1} showFooter={false}>
              <Step>
                <h3 className="text-xl font-semibold text-neutral-900">01 — Cadastre-se</h3>
                <p className="mt-1 text-neutral-600">Crie sua conta em poucos minutos e tenha acesso a centenas de especialistas qualificados.</p>
              </Step>
              <Step>
                <h3 className="text-xl font-semibold text-neutral-900">02 — Agende</h3>
                <p className="mt-1 text-neutral-600">Escolha o serviço de sua necessidade e passe pela <strong>consulta na hora</strong> após aprovação do pagamento.</p>
              </Step>
              <Step>
                <h3 className="text-xl font-semibold text-neutral-900">03 — Consulte</h3>
                <p className="mt-1 text-neutral-600">Realize sua consulta online de forma segura e receba prescrições digitais válidas.</p>
              </Step>
            </Stepper>
          </div>
        </div>

        {/* manter exatamente a mesma imagem da seção atual */}
        <div className="order-first md:order-none">
          <img src={consultaImage} alt="Consulta médica online profissional" className="w-full rounded-3xl shadow-xl" />
        </div>
      </div>
    </section>
  );
}