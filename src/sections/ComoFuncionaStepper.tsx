import Stepper, { Step } from "@/components/bits/Stepper";

export default function ComoFuncionaStepper() {
  return (
    <section className="relative py-12 md:py-16 bg-muted/30">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 md:grid-cols-2 md:items-center">
        <div className="text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">Como Funciona</h2>
          <p className="mt-2 text-neutral-600">Três passos simples para revolucionar o cuidado com sua saúde</p>

          <div className="mt-6">
            <Stepper initialStep={1} showFooter={false}>
              <Step>
                <h3 className="text-xl font-semibold text-neutral-900">01 — Cadastre-se</h3>
                <p className="mt-1 mb-4 text-neutral-600">Crie sua conta em poucos minutos.</p>
              </Step>
              <Step>
                <h3 className="text-xl font-semibold text-neutral-900">02 — Agende</h3>
                <p className="mt-1 text-neutral-600">Escolha o serviço de sua necessidade e passe pela <strong>consulta na hora</strong> após aprovação do pagamento.</p>
              </Step>
              <Step>
                <h3 className="text-xl font-semibold text-neutral-900">03 — Consulte</h3>
                <p className="mt-1 text-neutral-600">Realize sua consulta online de forma segura e receba prescrições e atestados digitais válidos.</p>
              </Step>
            </Stepper>
          </div>
        </div>

        {/* Imagem otimizada com lazy loading */}
        <div className="order-first md:order-none">
          <picture>
            <source 
              srcSet="/assets/medical-team-realistic-600.webp 600w, 
                      /assets/medical-team-realistic-1200.webp 1200w"
              type="image/webp"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <img 
              src="/assets/medical-team-realistic-600.webp" 
              alt="Equipe médica profissional em consulta online" 
              width="600"
              height="400"
              loading="lazy"
              decoding="async"
              className="w-full rounded-3xl shadow-xl"
              style={{ aspectRatio: '600/400' }}
            />
          </picture>
        </div>
      </div>
    </section>
  );
}