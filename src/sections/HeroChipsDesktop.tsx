import { useEffect, useState } from "react";
import { Clock, FileText, Headphones, ShieldCheck, Users, FileSignature } from "lucide-react";
import LogoLoop from "@/components/bits/LogoLoop";

const HERO_SUBTITLE_SELECTOR = ".hero-subtitle";

const features = [
  { icon: Clock, label: "Médico 24h" },
  { icon: FileText, label: "Atestado e Receitas Digitais" },
  { icon: Headphones, label: "Suporte Rápido" },
  { icon: FileSignature, label: "Emissão de Laudos" },
  { icon: ShieldCheck, label: "Pagamento Seguro" },
  { icon: Users, label: "Para Todas as Idades" },
];

export default function HeroChipsDesktop() {
  const [logoHeight, setLogoHeight] = useState<number>(24);

  useEffect(() => {
    const el = document.querySelector(HERO_SUBTITLE_SELECTOR) as HTMLElement | null;
    if (el) setLogoHeight(Math.round(parseFloat(getComputedStyle(el).fontSize || "24")));
  }, []);

  const logos = features.map(({ icon: Icon, label }) => ({
    title: label,
    node: (
      <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border-2 border-emerald-500 shadow-sm px-4 py-2 ring-0">
        <Icon aria-hidden className="h-5 w-5 text-emerald-600" />
        <span className="font-medium leading-none text-neutral-800">{label}</span>
      </div>
    ),
  }));

  return (
    <div className="hidden md:block relative z-20" style={{ minHeight: Math.ceil(logoHeight * 2) }}>
      <LogoLoop
        logos={logos}
        speed={120}        // 1,5x
        direction="left"
        logoHeight={logoHeight}  // segue fonte do subtítulo
        gap={32}
        pauseOnHover
        scaleOnHover
        fadeOut={false}   // desativar gradientes que causam “apagão”
        ariaLabel="Diferenciais do serviço"
      />
    </div>
  );
}
