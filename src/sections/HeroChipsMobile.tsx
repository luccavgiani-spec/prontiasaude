import { Clock, Headphones, ShieldCheck, Users, FileSignature } from "lucide-react";
import LogoLoop from "@/components/bits/LogoLoop";

/** O subtítulo da hero deve ter a classe .hero-subtitle */
const HERO_SUBTITLE_SELECTOR = ".hero-subtitle";

const features = [
  { icon: Clock, label: "Médico 24h" },
  { icon: Headphones, label: "Suporte Rápido" },
  { icon: FileSignature, label: "Emissão de Laudos" },
  { icon: ShieldCheck, label: "Pagamento Seguro" },
  { icon: Users, label: "Para Todas as Idades" },
];

export default function HeroChipsMobile() {
  const logoHeight = 56; // altura fixa para evitar reflow

  const logos = features.map(({ icon: Icon, label }) => ({
    title: label,
    node: (
      <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border-2 border-emerald-500 shadow-sm px-4 py-3 ring-0">
        <Icon aria-hidden className="h-7 w-7 text-emerald-600" />
        <span className="font-medium leading-none text-neutral-800">{label}</span>
      </div>
    ),
  }));

  return (
    <div className="md:hidden relative z-20">
      <div style={{ minHeight: '56px', contain: 'layout' }}>
        <LogoLoop
          logos={logos}
          speed={48}
          direction="left"
          logoHeight={logoHeight}
          gap={24}
          pauseOnHover={false}
          scaleOnHover={false}
          fadeOut={false}
          ariaLabel="Diferenciais do serviço (mobile)"
        />
      </div>
    </div>
  );
}