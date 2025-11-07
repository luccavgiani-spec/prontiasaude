import { MessageCircle } from "lucide-react";

const WhatsAppFloatButton = () => {
  const whatsappUrl = "https://wa.me/5511933359187?text=w46530642";

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
      aria-label="Falar com suporte via WhatsApp"
    >
      <MessageCircle className="h-7 w-7 text-white" fill="white" />
    </a>
  );
};

export default WhatsAppFloatButton;
