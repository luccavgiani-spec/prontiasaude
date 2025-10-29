import { useEffect, useState, useRef } from "react";
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
  const [logoHeight, setLogoHeight] = useState<number>(50); // altura inicial estimada para mobile
  const probeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Medir a altura real do chip
    if (probeRef.current) {
      const chipHeight = probeRef.current.offsetHeight;
      setLogoHeight(chipHeight);
    }
  }, []);

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
      {/* Elemento probe invisível para medir altura real do chip */}
      <div 
        ref={probeRef}
        className="absolute -top-[1000px] left-0 pointer-events-none"
        style={{ visibility: 'hidden' }}
      >
        <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border-2 border-emerald-500 shadow-sm px-4 py-3 ring-0">
          <Clock aria-hidden className="h-7 w-7 text-emerald-600" />
          <span className="font-medium leading-none text-neutral-800">Teste</span>
        </div>
      </div>
      
      <div style={{ minHeight: '56px' }}>
        <LogoLoop
          logos={logos}
          speed={48}             // 2,5x velocidade no mobile
          direction="left"
          logoHeight={logoHeight} // altura real medida do chip
          gap={24}               // espaçamento confortável no mobile
          pauseOnHover={false}   // mobile não usa hover
          scaleOnHover={false}
          fadeOut={false}        // evita o "apagão" por máscara
          ariaLabel="Diferenciais do serviço (mobile)"
        />
      </div>
    </div>
  );
}