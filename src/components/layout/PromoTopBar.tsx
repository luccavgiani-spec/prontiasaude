import { useState } from 'react';
import { X, Tag } from 'lucide-react';

export function PromoTopBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 relative">
      <div className="container mx-auto flex items-center justify-center gap-2 text-sm md:text-base">
        <Tag className="h-4 w-4 flex-shrink-0" />
        <span className="text-center">
          <span className="font-semibold">10% de desconto</span> na primeira consulta com o cupom{' '}
          <code className="bg-primary-foreground/20 px-2 py-0.5 rounded font-bold">BEMVINDO10</code>
        </span>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-primary-foreground/10 rounded transition-colors"
        aria-label="Fechar promoção"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
