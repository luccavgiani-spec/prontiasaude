import { useEffect, useState } from "react";
import { Clock, FileText, Headphones, ShieldCheck, Users, FileSignature } from "lucide-react";
import LogoLoop from "@/components/bits/LogoLoop";

const HERO_SUBTITLE_SELECTOR = ".hero-subtitle"; // aplique esta classe no subtítulo da hero

const features = [
  { icon: Clock, label: "Médico 24h" },
  { icon: FileText, label: "Atestado e Receitas Digitais" },
  { icon: Headphones, label: "Suporte Rápido" },
  { icon: FileSignature, label: "Emissão de Laudos" },
  { icon: ShieldCheck, label: "Pagamento Seguro" },
  { icon: Users, label: "Para Todas as Idades" },
];

export default function HeroChipsDesktop() {
  const [logoHeight, setLogoHeight] = useState<number>(20);
  
  useEffect(() => {
    const el = document.querySelector(HERO_SUBTITLE_SELECTOR) as HTMLElement | null;
    if (el) setLogoHeight(Math.round(parseFloat(getComputedStyle(el).fontSize || "20")));
  }, []);

  const logos = features.map(({ icon: Icon, label }) => ({
    title: label,
    node: (
      <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border border-neutral-200 shadow-sm px-4 py-2">
        <Icon aria-hidden className="h-[1.1em] w-[1.1em] text-emerald-600" />
        <span className="font-medium leading-none">{label}</span>
      </div>
    ),
  }));

  return (
    <div className="hidden md:block">
      <LogoLoop
        logos={logos}
        speed={120}
        direction="left"
        logoHeight={logoHeight}   // segue o font-size do subtítulo
        gap={32}
        pauseOnHover
        scaleOnHover
        fadeOut
        fadeOutColor="#ffffff"
        ariaLabel="Diferenciais do serviço"
      />
    </div>
  );
}