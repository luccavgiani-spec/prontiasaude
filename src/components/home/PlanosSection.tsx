import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { PLANOS, DESCONTOS_PLANO_VISUAL, PRICE_MAP } from "@/lib/constants";
import { formataPreco, calcularDescontoPlano, getEmailAtual } from "@/lib/utils";
import { criarCheckout, redirecionarParaCheckout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Users, Crown, Star, Check, ArrowRight } from "lucide-react";

export function PlanosSection() {
  const [duracaoSelecionada, setDuracaoSelecionada] = useState<string>("1");
  const [showEmpresarialForm, setShowEmpresarialForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    descricao: ""
  });

  const duracoes = [
    { meses: "1", label: "Mensal" },
    { meses: "6", label: "Semestral", desconto: "20%" },
    { meses: "12", label: "Anual", desconto: "40%" }
  ];

  const handleAssinar = async (planoCode: string, email?: string) => {
    if (planoCode === "EMPRESARIAL") {
      setShowEmpresarialForm(true);
      return;
    }

    const emailParaUsar = email || await getEmailAtual();
    
    if (!emailParaUsar) {
      setPlanoSelecionado(planoCode);
      setIsModalOpen(true);
      return;
    }

    await processarCheckoutPlano(planoCode, emailParaUsar);
  };

  const processarCheckoutPlano = async (planoCode: string, email: string) => {
    setIsLoading(true);
    
    try {
      const priceId = PRICE_MAP[`plano_${planoCode.toLowerCase()}` as keyof typeof PRICE_MAP];
      
      if (!priceId || priceId === "price_xxx") {
        toast({
          title: "Plano em configuração",
          description: "Este plano ainda está sendo configurado. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      const checkoutData = await criarCheckout({
        mode: "subscription",
        price_id: priceId,
        plan_code: planoCode,
        plan_duration_months: parseInt(duracaoSelecionada),
        email: email
      });

      if (checkoutData.error) {
        toast({
          title: "Erro no checkout",
          description: checkoutData.error,
          variant: "destructive",
        });
        return;
      }

      redirecionarParaCheckout(checkoutData);
      
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Não foi possível processar a assinatura. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEmpresarialForm(false);
    setShowConfirmModal(true);
    setFormData({ nome: "", email: "", telefone: "", descricao: "" });
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nossos Planos
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
            Descontos exclusivos em consultas e atendimento prioritário para sua família
          </p>

          {/* Seletor de duração */}
          <div className="flex justify-center mb-8">
            <div className="inline-block bg-muted/50 rounded-2xl p-1.5">
              <div className="flex gap-1">
                {duracoes.map((duracao) => (
                  <button
                    key={duracao.meses}
                    onClick={() => setDuracaoSelecionada(duracao.meses)}
                    className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      duracaoSelecionada === duracao.meses
                        ? "bg-green-600 text-white"
                        : "bg-white text-green-700 border border-green-600 hover:bg-green-50"
                    }`}
                  >
                    {duracao.label}
                    {duracao.desconto && (
                      <Badge 
                        variant="secondary" 
                        className="absolute -top-1.5 -right-1.5 bg-accent text-accent-foreground text-xs px-1 py-0"
                      >
                        -{duracao.desconto}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid de planos */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {PLANOS.map((plano) => {
            const meses = parseInt(duracaoSelecionada);
            const desconto = DESCONTOS_PLANO_VISUAL[duracaoSelecionada as keyof typeof DESCONTOS_PLANO_VISUAL] || 0;
            const precoCalculado = plano.precoMensal ? calcularDescontoPlano(plano.precoMensal, meses, desconto) : null;
            
            return (
              <div
                key={plano.code}
                className={`medical-card p-8 relative ${
                  plano.popular ? "ring-2 ring-primary shadow-[var(--shadow-medical)]" : ""
                }`}
              >
                {plano.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}

                {/* Header do plano */}
                <div className="text-center mb-6">
                  <div className="mb-4">
                    {plano.code === "INDIVIDUAL" && <Users className="h-12 w-12 text-primary mx-auto" />}
                    {plano.code === "FAMILIAR" && <Crown className="h-12 w-12 text-primary mx-auto" />}
                    {plano.code === "EMPRESARIAL" && <Star className="h-12 w-12 text-primary mx-auto" />}
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plano.nome}
                  </h3>
                  <div className="text-center">
                    {plano.precoMensal ? (
                      <>
                        <div className="text-sm font-medium text-primary mb-1">
                          APENAS 12x
                        </div>
                        <div className="text-3xl font-bold text-primary">
                          {formataPreco(precoCalculado! / meses)}/mês
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Equivale a {formataPreco((precoCalculado! / meses) / 30)}/dia
                        </div>
                        {desconto > 0 && (
                          <div className="text-sm text-muted-foreground mt-2">
                            <span className="line-through">
                              {formataPreco(plano.precoMensal)}
                            </span>
                            <span className="text-accent font-medium ml-2">
                              Economize {Math.round(desconto * 100)}%
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-2xl font-bold text-primary">
                        Sob Consulta
                      </div>
                    )}
                  </div>
                </div>

                {/* Benefícios */}
                <ul className="space-y-3 mb-8">
                  {plano.beneficios.map((beneficio, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{beneficio}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  onClick={() => handleAssinar(plano.code)}
                  size="lg"
                  className="w-full group bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700 transition-all"
                  disabled={isLoading}
                >
                  {plano.code === "EMPRESARIAL" 
                    ? "Solicitar Proposta" 
                    : isLoading 
                      ? "Processando..." 
                      : "Assinar Plano"
                  }
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Modal do formulário empresarial */}
        <Dialog open={showEmpresarialForm} onOpenChange={setShowEmpresarialForm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Plano Empresarial</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <Input
                placeholder="Nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
              <Input
                type="email"
                placeholder="E-mail"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
              <Input
                placeholder="Telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                required
              />
              <Textarea
                placeholder="Breve descrição do negócio"
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                required
              />
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Enviar Formulário
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmação */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="sm:max-w-md text-center">
            <DialogHeader>
              <DialogTitle>Formulário Enviado!</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Formulário preenchido. Em breve alguém entrará em contato.
            </p>
            <Button onClick={() => setShowConfirmModal(false)} className="w-full">
              OK
            </Button>
          </DialogContent>
        </Dialog>

        {/* CadastroModal */}
        <CadastroModal 
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onSuccess={(email) => processarCheckoutPlano(planoSelecionado, email)}
        />
      </div>
    </section>
  );
}