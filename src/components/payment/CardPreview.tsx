import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';

interface CardPreviewProps {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
}

const CARD_BRANDS = {
  visa: { name: 'Visa', pattern: /^4/, color: 'from-blue-600 to-blue-800' },
  mastercard: { name: 'Mastercard', pattern: /^5[1-5]/, color: 'from-red-600 to-orange-600' },
  elo: { name: 'Elo', pattern: /^(4011|4312|4389|4514|5067|6277|6362|6363|6504|6505|6516)/, color: 'from-yellow-600 to-yellow-800' },
  amex: { name: 'Amex', pattern: /^3[47]/, color: 'from-green-600 to-teal-700' },
  hipercard: { name: 'Hipercard', pattern: /^606282/, color: 'from-red-700 to-red-900' },
};

export function CardPreview({ cardNumber, cardHolder, expiry }: CardPreviewProps) {
  const [brand, setBrand] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('from-gray-700 to-gray-900');
  
  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const detectedBrand = Object.entries(CARD_BRANDS).find(([_, { pattern }]) =>
      pattern.test(cleanNumber)
    );
    
    if (detectedBrand) {
      setBrand(detectedBrand[1].name);
      setBrandColor(detectedBrand[1].color);
    } else {
      setBrand(null);
      setBrandColor('from-gray-700 to-gray-900');
    }
  }, [cardNumber]);
  
  const formatCardNumber = (num: string) => {
    const cleaned = num.replace(/\s/g, '');
    if (!cleaned) return '•••• •••• •••• ••••';
    const masked = cleaned.slice(0, -4).replace(/./g, '•') + cleaned.slice(-4);
    return masked.match(/.{1,4}/g)?.join(' ') || '•••• •••• •••• ••••';
  };
  
  return (
    <div className={`relative w-full max-w-sm mx-auto h-52 rounded-2xl bg-gradient-to-br ${brandColor} p-6 text-white shadow-2xl transition-all duration-300`}>
      <div className="flex justify-between items-start mb-8">
        <CreditCard className="h-10 w-10 opacity-80" />
        {brand && (
          <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold animate-in fade-in-0 slide-in-from-top-2 duration-300">
            {brand}
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div className="text-xl tracking-wider font-mono">
          {cardNumber ? formatCardNumber(cardNumber) : '•••• •••• •••• ••••'}
        </div>
        
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs opacity-70 uppercase">Titular</div>
            <div className="font-medium uppercase text-sm">
              {cardHolder || 'NOME NO CARTÃO'}
            </div>
          </div>
          
          <div>
            <div className="text-xs opacity-70 uppercase">Validade</div>
            <div className="font-medium">{expiry || 'MM/AA'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
