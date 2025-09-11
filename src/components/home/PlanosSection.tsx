import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLANOS } from "@/lib/constants";
import { Users, Crown, Star, Check } from "lucide-react";

export function PlanosSection() {
  const [duracaoSelecionada, setDuracaoSelecionada] = useState<string>("1");
  const [showEmpresarialForm, setShowEmpresarialForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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
          {PLANOS.map((plano) => (
            <Card
              key={plano.code}
              className={`medical-card p-6 relative ${
                plano.popular ? "ring-2 ring-primary shadow-[var(--shadow-medical)]" : ""
              } bg-background hover:bg-muted/20 transition-all duration-300`}
            >
              {plano.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Mais Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="mb-4">
                  {plano.code === "INDIVIDUAL" && <Users className="h-12 w-12 text-primary mx-auto" />}
                  {plano.code === "FAMILIAR" && <Crown className="h-12 w-12 text-primary mx-auto" />}
                  {plano.code === "EMPRESARIAL" && <Star className="h-12 w-12 text-primary mx-auto" />}
                </div>
                <CardTitle className="text-2xl text-foreground">
                  {plano.nome}
                </CardTitle>
                <div className="text-center">
                  {plano.precoMensal ? (
                    <>
                      <div className="text-2xl font-bold text-primary">
                        R$ {plano.precoMensal.toFixed(2).replace(".", ",")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        por mês
                      </div>
                    </>
                  ) : (
                    <div className="text-xl font-bold text-primary">
                      Sob Consulta
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plano.beneficios.slice(0, 5).map((beneficio, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{beneficio}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => {
                    if (plano.code === "EMPRESARIAL") {
                      setShowEmpresarialForm(true);
                    } else {
                      window.location.href = "/planos";
                    }
                  }}
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {plano.code === "EMPRESARIAL" ? "Solicitar Proposta" : "Assinar Plano"}
                </Button>
              </CardContent>
            </Card>
          ))}
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
      </div>
    </section>
  );
}