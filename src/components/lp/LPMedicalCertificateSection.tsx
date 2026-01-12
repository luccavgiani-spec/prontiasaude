import { FileCheck, FileText, ClipboardList, MapPin } from "lucide-react";

const LPMedicalCertificateSection = () => {
  const documents = [
    { icon: FileCheck, title: "Atestado Médico", subtitle: "Trabalho e estudos" },
    { icon: FileText, title: "Receita Digital", subtitle: "Comum e controlada" },
    { icon: ClipboardList, title: "Laudo Médico", subtitle: "Documentação completa" },
    { icon: MapPin, title: "Todo Brasil", subtitle: "Validade nacional" },
  ];

  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="text-primary font-semibold text-sm tracking-wider uppercase">
            Reconhecido em todo território nacional
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2">
            Documentos com Validade Legal
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Todos os documentos emitidos através da nossa plataforma possuem a
            mesma validade jurídica dos documentos presenciais.
          </p>
        </div>

        {/* Legal Backing Card */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="bg-card rounded-2xl p-6 md:p-8 shadow-md border border-border/50">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* CFM Logo */}
              <div className="flex-shrink-0">
                <img
                  src="https://prontia-landing-page-publicada.vercel.app/assets/cfm-logo-CjZ83_jF.png"
                  alt="CFM - Conselho Federal de Medicina"
                  className="h-16 md:h-20 w-auto"
                  loading="lazy"
                />
              </div>

              {/* Text */}
              <div className="text-center md:text-left">
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  Respaldo Legal
                </h3>
                <p className="text-muted-foreground text-sm md:text-base">
                  Conforme a <strong>Lei nº 13.989/2020</strong> e a{" "}
                  <strong>Resolução CFM nº 2.314/2022</strong>, documentos
                  médicos via telemedicina têm validade jurídica plena.
                </p>
              </div>

              {/* Vidaas Logo */}
              <div className="flex-shrink-0 flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2">
                <img
                  src="https://prontia-landing-page-publicada.vercel.app/assets/logo-vidaas-CO7-jLuZ.png"
                  alt="Vidaas"
                  className="h-8 w-auto"
                  loading="lazy"
                />
                <span className="text-xs text-muted-foreground">
                  Assinatura digital com
                  <br />
                  certificado <strong>ICP-Brasil</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Types Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-4 md:p-6 text-center shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <doc.icon className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground text-sm md:text-base">
                {doc.title}
              </h4>
              <p className="text-muted-foreground text-xs md:text-sm mt-1">
                {doc.subtitle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LPMedicalCertificateSection;
