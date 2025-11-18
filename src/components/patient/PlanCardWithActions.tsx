import { Download, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlanCard } from "./PlanCard";

interface PlanCardWithActionsProps {
  patientName: string;
  planCode: string;
  planCreatedAt: string;
  cpf: string;
}

export const PlanCardWithActions = (props: PlanCardWithActionsProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    toast.info("Gerando imagem...");
    try {
      // Aguardar 100ms para garantir que tudo foi renderizado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#00675e',
        logging: false,
        imageTimeout: 0,
        removeContainer: true
      });
      
      canvas.toBlob((blob) => {
        if (!blob) { toast.error("Erro"); setIsDownloading(false); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `carteirinha-prontia-${props.cpf.replace(/\D/g, '')}.png`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Baixado!");
        setIsDownloading(false);
      }, 'image/png');
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      toast.error("Erro ao gerar imagem");
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex gap-3 mb-4 justify-end">
        <Button onClick={handleDownload} disabled={isDownloading} size="sm" className="gap-2">
          <Download className="h-4 w-4" />{isDownloading ? "Gerando..." : "Baixar PNG"}
        </Button>
      </div>
      <div ref={cardRef}>
        <PlanCard {...props} />
      </div>
    </div>
  );
};