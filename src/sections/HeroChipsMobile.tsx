import { useEffect, useState } from "react";
import { Clock, FileText, Headphones, ShieldCheck, Users, FileSignature } from "lucide-react";
import LogoLoop from "@/components/bits/LogoLoop";

/** O subtítulo da hero deve ter a classe .hero-subtitle */
const HERO_SUBTITLE_SELECTOR = ".hero-subtitle";

const features = [
  { icon: Clock, label: "Médico 24h" },
  { icon: FileText, label: "Atestado e Receitas Digitais" },
  { icon: Headphones, label: "Suporte Rápido" },
  { icon: FileSignature, label: "Emissão de Laudos" },
  { icon: ShieldCheck, label: "Pagamento Seguro" },
  { icon: Users, label: "Para Todas as Idades" },
];

export default function HeroChipsMobile() {
  const [logoHeight, setLogoHeight] = useState<number>(18); // mobile costuma ter fonte menor

  useEffect(() => {
    const el = document.querySelector(HERO_SUBTITLE_SELECTOR) as HTMLElement | null;
    if (el) setLogoHeight(Math.round(parseFloat(getComputedStyle(el).fontSize || "18")));
  }, []);

  const logos = features.map(({ icon: Icon, label }) => ({
    title: label,
    node: (
      <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border-2 border-emerald-500 shadow-sm px-4 py-3">
        <Icon aria-hidden className="h-6 w-6 text-emerald-600" />
        <span className="font-medium leading-none">{label}</span>
      </div>
    ),
  }));

  return (
    <div className="md:hidden relative z-20" style={{ minHeight: Math.ceil(logoHeight * 2) }}>
      <LogoLoop
        logos={logos}
        speed={120}            // 1,5x (igual ao desktop)
        direction="left"
        logoHeight={logoHeight} // segue o font-size do subtítulo
        gap={24}               // espaçamento confortável no mobile
        pauseOnHover={false}   // mobile não usa hover
        scaleOnHover={false}
        fadeOut={false}        // evita o "apagão" por máscara
        ariaLabel="Diferenciais do serviço (mobile)"
      />
    </div>
  );
}