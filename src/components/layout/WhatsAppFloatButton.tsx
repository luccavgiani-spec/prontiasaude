import { createPortal } from 'react-dom';

const WhatsAppFloatButton = () => {
  const whatsappUrl = "https://wa.me/5511933359187?text=Ol%C3%A1!%20Preciso%20de%20ajuda!";

  const button = (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[9999] flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-[0_20px_40px_rgba(37,211,102,0.5)]"
      aria-label="Falar com suporte via WhatsApp"
    >
      {/* Logo oficial do WhatsApp em SVG */}
      <svg
        viewBox="0 0 32 32"
        className="h-9 w-9"
        fill="white"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M16 0C7.164 0 0 7.164 0 16c0 2.777.711 5.391 1.961 7.664L.057 31.95l8.453-2.217A15.931 15.931 0 0 0 16 32c8.836 0 16-7.164 16-16S24.836 0 16 0zm0 29.333c-2.449 0-4.781-.664-6.769-1.818l-.485-.287-5.031 1.318 1.342-4.898-.316-.502A13.253 13.253 0 0 1 2.667 16c0-7.364 5.969-13.333 13.333-13.333S29.333 8.636 29.333 16 23.364 29.333 16 29.333zm7.293-9.955c-.4-.2-2.365-1.167-2.731-1.3-.365-.134-.631-.2-.897.2-.267.4-1.031 1.3-1.264 1.567-.233.267-.465.3-.865.1-.4-.2-1.689-.622-3.217-1.984-1.189-1.06-1.992-2.368-2.225-2.768-.233-.4-.025-.617.175-.816.18-.18.4-.467.6-.7.2-.233.267-.4.4-.667.133-.267.067-.5-.033-.7-.1-.2-.897-2.164-1.231-2.964-.325-.778-.654-.672-.897-.684-.232-.011-.498-.013-.764-.013-.267 0-.698.1-1.064.5-.365.4-1.396 1.367-1.396 3.331s1.429 3.864 1.629 4.131c.2.267 2.815 4.298 6.82 6.025.953.411 1.697.657 2.277.841.957.304 1.829.261 2.517.158.768-.115 2.365-.967 2.698-1.9.333-.933.333-1.733.233-1.9-.1-.167-.367-.267-.767-.467z"/>
      </svg>
    </a>
  );

  return createPortal(button, document.body);
};

export default WhatsAppFloatButton;
