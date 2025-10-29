import { useEffect, useState, useRef } from "react";
import { Clock, Headphones, ShieldCheck, Users, FileSignature } from "lucide-react";
import LogoLoop from "@/components/bits/LogoLoop";

const HERO_SUBTITLE_SELECTOR = ".hero-subtitle";

const features = [
  { icon: Clock, label: "Médico 24h" },
  { icon: Headphones, label: "Suporte Rápido" },
  { icon: FileSignature, label: "Emissão de Laudos" },
  { icon: ShieldCheck, label: "Pagamento Seguro" },
  { icon: Users, label: "Para Todas as Idades" },
];

export default function HeroChipsDesktop() {
  const [logoHeight, setLogoHeight] = useState<number>(44); // altura inicial estimada para desktop
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
      <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border-2 border-emerald-500 shadow-sm px-4 py-2 ring-0">
        <Icon aria-hidden className="h-6 w-6 text-emerald-600" />
        <span className="font-medium leading-none text-neutral-800">{label}</span>
      </div>
    ),
  }));

  return (
    <div className="hidden md:block relative z-20">
      {/* Elemento probe invisível para medir altura real do chip */}
      <div 
        ref={probeRef}
        className="absolute -top-[1000px] left-0 pointer-events-none"
        style={{ visibility: 'hidden' }}
      >
        <div className="inline-flex items-center gap-2 bg-white text-neutral-700 rounded-2xl border-2 border-emerald-500 shadow-sm px-4 py-2 ring-0">
          <Clock aria-hidden className="h-6 w-6 text-emerald-600" />
          <span className="font-medium leading-none text-neutral-800">Teste</span>
        </div>
      </div>
      
      <div style={{ minHeight: '56px' }}>
        <LogoLoop
          logos={logos}
          speed={120}        // 1,5x
          direction="left"
          logoHeight={logoHeight}  // altura real medida do chip
          gap={32}
          pauseOnHover
          scaleOnHover
          fadeOut={false}   // desativar gradientes que causam "apagão"
          ariaLabel="Diferenciais do serviço"
        />
      </div>
    </div>
  );
}