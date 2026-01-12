import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Package, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  category: string | null;
  is_active: boolean | null;
  allows_recurring: boolean | null;
  recurring_frequency: number | null;
  recurring_frequency_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const CATEGORIES = [
  { value: "consulta", label: "Consulta" },
  { value: "psicologia", label: "Psicologia" },
  { value: "exames", label: "Exames" },
  { value: "laudos", label: "Laudos" },
  { value: "especialistas", label: "Especialistas" },
  { value: "planos", label: "Planos" },
];

const ServicesManagement = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    price: "",
    category: "consulta",
    is_active: true,
    allows_recurring: false,
    recurring_frequency: "",
    recurring_frequency_type: "months",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar serviços",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const parsePriceInput = (value: string): number => {
    // Remove R$, espaços e pontos de milhar, troca vírgula por ponto
    const cleaned = value
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const number = parseFloat(cleaned);
    return isNaN(number) ? 0 : Math.round(number * 100);
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        sku: service.sku,
        name: service.name,
        description: service.description || "",
        price: service.price_cents ? (service.price_cents / 100).toFixed(2).replace(".", ",") : "",
        category: service.category || "consulta",
        is_active: service.is_active ?? true,
        allows_recurring: service.allows_recurring ?? false,
        recurring_frequency: service.recurring_frequency?.toString() || "",
        recurring_frequency_type: service.recurring_frequency_type || "months",
      });
    } else {
      setEditingService(null);
      setFormData({
        sku: "",
        name: "",
        description: "",
        price: "",
        category: "consulta",
        is_active: true,
        allows_recurring: false,
        recurring_frequency: "",
        recurring_frequency_type: "months",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.sku || !formData.name || !formData.price) {
      toast({
        title: "Campos obrigatórios",
        description: "SKU, nome e preço são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const priceCents = parsePriceInput(formData.price);
    
    const serviceData = {
      sku: formData.sku.toUpperCase(),
      name: formData.name,
      description: formData.description || null,
      price_cents: priceCents,
      price: priceCents / 100,
      category: formData.category,
      is_active: formData.is_active,
      allows_recurring: formData.allows_recurring,
      recurring_frequency: formData.recurring_frequency ? parseInt(formData.recurring_frequency) : null,
      recurring_frequency_type: formData.allows_recurring ? formData.recurring_frequency_type : null,
    };

    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;

        toast({
          title: "Serviço atualizado",
          description: `${formData.name} foi atualizado com sucesso`,
        });
      } else {
        const { error } = await supabase.from("services").insert(serviceData);

        if (error) throw error;

        toast({
          title: "Serviço criado",
          description: `${formData.name} foi criado com sucesso`,
        });
      }

      setIsDialogOpen(false);
      loadServices();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !service.is_active })
        .eq("id", service.id);

      if (error) throw error;

      toast({
        title: service.is_active ? "Serviço desativado" : "Serviço ativado",
        description: `${service.name} foi ${service.is_active ? "desativado" : "ativado"}`,
      });

      loadServices();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || service.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeColor = (category: string | null) => {
    switch (category) {
      case "consulta":
        return "bg-blue-100 text-blue-800";
      case "psicologia":
        return "bg-purple-100 text-purple-800";
      case "exames":
        return "bg-green-100 text-green-800";
      case "laudos":
        return "bg-orange-100 text-orange-800";
      case "especialistas":
        return "bg-cyan-100 text-cyan-800";
      case "planos":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gerenciamento de Serviços
            </CardTitle>
            <CardDescription>
              Gerencie os serviços, planos e seus preços
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadServices}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingService ? "Editar Serviço" : "Novo Serviço"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingService 
                      ? "Edite as informações do serviço abaixo" 
                      : "Preencha as informações para criar um novo serviço"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sku">SKU *</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                        }
                        placeholder="Ex: ITC6534"
                        disabled={!!editingService}
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Nome do serviço"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Descrição do serviço"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input
                      id="price"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      placeholder="Ex: 39,90"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Para planos, informe o valor TOTAL do período (não mensal)
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Serviço Ativo</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allows_recurring">Permite Recorrência</Label>
                    <Switch
                      id="allows_recurring"
                      checked={formData.allows_recurring}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, allows_recurring: checked })
                      }
                    />
                  </div>
                  {formData.allows_recurring && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recurring_frequency">Frequência</Label>
                        <Input
                          id="recurring_frequency"
                          type="number"
                          value={formData.recurring_frequency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recurring_frequency: e.target.value,
                            })
                          }
                          placeholder="Ex: 1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="recurring_frequency_type">Tipo</Label>
                        <Select
                          value={formData.recurring_frequency_type}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              recurring_frequency_type: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="months">Meses</SelectItem>
                            <SelectItem value="days">Dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    {editingService ? "Salvar Alterações" : "Criar Serviço"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{services.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {services.filter((s) => s.is_active).length}
            </p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">
              {services.filter((s) => !s.is_active).length}
            </p>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {services.filter((s) => s.category === "planos").length}
            </p>
            <p className="text-xs text-muted-foreground">Planos</p>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando serviços...
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24">Preço</TableHead>
                  <TableHead className="w-28">Categoria</TableHead>
                  <TableHead className="w-20 text-center">Ativo</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum serviço encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono text-xs">
                        {service.sku}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{service.name}</p>
                          {service.allows_recurring && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Recorrente
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(service.price_cents)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryBadgeColor(service.category)}>
                          {service.category || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={service.is_active ?? false}
                          onCheckedChange={() => toggleActive(service)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ServicesManagement;
