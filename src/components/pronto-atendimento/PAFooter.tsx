import logoImage from "@/assets/prontia-logo-navbar-master.webp";

const PAFooter = () => {
  return (
    <footer className="bg-muted py-12">
      <div className="container text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-4">
          <img src={logoImage} alt="Prontia Saúde" className="h-8 w-auto" />
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          © 2024 Prontìa Saúde — Marca registrada em processo no INPI (Processo nº 941907740). 
          Prontìa Saúde é uma marca de propriedade de PRIMECARE SERVIÇOS MÉDICOS LTDA — CNPJ 56.210.013/0001-40. 
          Todos os serviços de saúde são prestados pela PRIMECARE SERVIÇOS MÉDICOS LTDA enquanto responsável técnica e legal.
        </p>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          <a href="/privacidade" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Política de Privacidade
          </a>
          <a href="/termos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Termos e Condições de Uso
          </a>
          <a href="https://wa.me/5511933359187" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Fale Conosco
          </a>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">Copyright © 2024 - Prontia Saúde</p>
        </div>
      </div>
    </footer>
  );
};

export default PAFooter;
