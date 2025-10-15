import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { detectCardBrand, maskCardNumber, CARD_BRANDS } from '@/lib/card-utils';
import type { CardBrand } from '@/lib/card-utils';

interface CardPreviewProps {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
}

export function CardPreview({ cardNumber, cardHolder, expiry }: CardPreviewProps) {
  const [brand, setBrand] = useState<CardBrand | null>(null);
  const [brandColor, setBrandColor] = useState('from-gray-700 to-gray-900');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    const detectedBrand = detectCardBrand(cardNumber);
    
    if (detectedBrand !== brand) {
      // Trigger transition animation
      setIsTransitioning(true);
      
      setTimeout(() => {
        setBrand(detectedBrand);
        setBrandColor(detectedBrand ? CARD_BRANDS[detectedBrand].gradient : 'from-gray-700 to-gray-900');
        setIsTransitioning(false);
      }, 150);
    }
  }, [cardNumber]);
  
  const displayNumber = cardNumber 
    ? maskCardNumber(cardNumber) 
    : '•••• •••• •••• ••••';
  
  const displayHolder = cardHolder 
    ? cardHolder.toUpperCase() 
    : 'NOME NO CARTÃO';
  
  const displayExpiry = expiry || 'MM/AA';
  
  return (
    <div 
      className={`relative w-full max-w-sm mx-auto h-52 rounded-2xl bg-gradient-to-br ${brandColor} p-6 text-white shadow-2xl transition-all duration-500 ease-out`}
    >
      {/* Chip decoration */}
      <div className="absolute top-6 left-6 w-12 h-10 rounded bg-gradient-to-br from-yellow-200 to-yellow-400 opacity-80" />
      
      <div className="flex justify-between items-start mb-8">
        <CreditCard className="h-10 w-10 opacity-80" />
        
        {/* Brand Badge */}
        <div 
          className={`transition-all duration-300 ${
            isTransitioning ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
          }`}
        >
          {brand && (
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
              {CARD_BRANDS[brand].name}
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-4 mt-8">
        {/* Card Number */}
        <div 
          className={`text-xl tracking-wider font-mono transition-all duration-300 ${
            cardNumber ? 'opacity-100' : 'opacity-50'
          }`}
        >
          {displayNumber}
        </div>
        
        {/* Holder and Expiry */}
        <div className="flex justify-between items-end">
          <div className="flex-1">
            <div className="text-[10px] opacity-70 uppercase tracking-wide mb-1">Titular</div>
            <div 
              className={`font-medium uppercase text-sm transition-all duration-300 ${
                cardHolder ? 'opacity-100' : 'opacity-50'
              }`}
            >
              {displayHolder}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-[10px] opacity-70 uppercase tracking-wide mb-1">Validade</div>
            <div 
              className={`font-medium transition-all duration-300 ${
                expiry ? 'opacity-100' : 'opacity-50'
              }`}
            >
              {displayExpiry}
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative pattern */}
      <div className="absolute bottom-0 right-0 w-32 h-32 opacity-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <circle cx="80" cy="80" r="30" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
