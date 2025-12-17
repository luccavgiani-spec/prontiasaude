import { motion } from "motion/react";
import { FileText, Pill, ClipboardList, MapPin, BadgeCheck } from "lucide-react";

const documents = [
  { icon: FileText, title: "Atestado Médico", description: "Trabalho e estudos" },
  { icon: Pill, title: "Receita Digital", description: "Comum e controlada" },
  { icon: ClipboardList, title: "Laudo Médico", description: "Documentação completa" },
  { icon: MapPin, title: "Todo Brasil", description: "Validade nacional" },
];

const PAMedicalCertificateSection = () => {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Lado Esquerdo - Conteúdo Principal */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }} 
            whileInView={{ opacity: 1, x: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.6 }} 
            className="text-center lg:text-left flex flex-col items-center lg:items-start"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BadgeCheck className="w-4 h-4" />
              Reconhecido em todo território nacional
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-6 leading-tight">
              Documentos com{" "}
              <span className="text-primary">Validade Legal</span>
            </h2>

            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Todos os documentos emitidos através da nossa plataforma possuem a mesma
              validade jurídica dos documentos presenciais.
            </p>

            {/* Card de Lei */}
            <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm w-full">
              <div className="items-center gap-4 flex flex-col md:flex-row">
                <div className="flex-shrink-0">
                  <div className="w-32 md:w-56 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">CFM</span>
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <h3 className="font-semibold text-foreground mb-2">Respaldo Legal</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Conforme a <strong className="text-foreground">Lei nº 13.989/2020</strong> e
                    a <strong className="text-foreground">Resolução CFM nº 2.314/2022</strong>,
                    documentos médicos via telemedicina têm validade jurídica plena.
                  </p>
                </div>
              </div>
            </div>

            {/* Selo de Segurança */}
            <div className="items-center justify-center lg:justify-start gap-3 mt-6 text-muted-foreground flex flex-col md:flex-row">
              <div className="h-5 w-auto bg-primary/20 rounded px-2 flex items-center">
                <span className="text-xs font-medium text-primary">VIDAAS</span>
              </div>
              <span className="text-sm">
                Assinatura digital com certificado <strong className="text-foreground">ICP-Brasil</strong>
              </span>
            </div>
          </motion.div>

          {/* Lado Direito - Grid de Documentos */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }} 
            whileInView={{ opacity: 1, x: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.6, delay: 0.2 }} 
            className="relative"
          >
            {/* Background decorativo */}
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl blur-2xl opacity-50" />

            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc, index) => (
                <motion.div 
                  key={doc.title} 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  whileInView={{ opacity: 1, scale: 1 }} 
                  viewport={{ once: true }} 
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }} 
                  className={`bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 ${index === 0 ? "md:translate-y-4" : ""} ${index === 3 ? "md:translate-y-4" : ""}`}
                >
                  <div className={`rounded-xl w-12 h-12 flex items-center justify-center mb-4 ${index % 2 === 0 ? "bg-primary/10" : "bg-accent/10"}`}>
                    <doc.icon className={`w-6 h-6 ${index % 2 === 0 ? "text-primary" : "text-accent"}`} />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">{doc.title}</h4>
                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PAMedicalCertificateSection;
