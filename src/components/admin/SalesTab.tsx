import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Copy, Search, Download, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { format, startOfDay, startOfWeek, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  appointment_id: string;
  email: string;
  user_id?: string;
  service_code: string;
  service_name?: string;
  start_at_local: string;
  duration_min: number;
  status: string;
  order_id?: string;
  teams_join_url?: string;
  teams_meeting_id?: string;
  provider?: string;
  redirect_url?: string;
  created_at: string;
  updated_at: string;
}

const SalesTab = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      toast({
        title: "Erro ao carregar vendas",
        description: "Não foi possível carregar os dados de vendas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          toast({
            title: "Nova venda registrada!",
            description: `Serviço: ${payload.new.service_name || payload.new.service_code}`,
          });
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    if (searchEmail && !apt.email.toLowerCase().includes(searchEmail.toLowerCase())) return false;
    if (filterService !== "all" && apt.service_code !== filterService) return false;
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    if (filterProvider !== "all" && apt.provider !== filterProvider) return false;
    return true;
  });

  const totalSales = appointments.length;
  const salesToday = appointments.filter(
    (apt) => isAfter(parseISO(apt.created_at), startOfDay(new Date()))
  ).length;
  const salesThisWeek = appointments.filter(
    (apt) => isAfter(parseISO(apt.created_at), startOfWeek(new Date(), { locale: ptBR }))
  ).length;
  const salesByProvider = appointments.reduce((acc, apt) => {
    const provider = apt.provider || "Desconhecido";
    acc[provider] = (acc[provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueServices = Array.from(new Set(appointments.map((apt) => apt.service_code)));

  const handleCopyLink = (url: string, serviceName: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: `Link de ${serviceName} copiado para a área de transferência.`,
    });
  };

  const simplifyUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Retorna o domínio + últimos 8 caracteres do path
      const path = urlObj.pathname + urlObj.hash;
      const shortPath = path.length > 20 ? '...' + path.slice(-15) : path;
      return urlObj.hostname + shortPath;
    } catch {
      // Se não for URL válida, retorna os primeiros e últimos caracteres
      return url.length > 30 ? url.slice(0, 15) + '...' + url.slice(-15) : url;
    }
  };

  const exportCSV = () => {
    const headers = [
      "Email",
      "Serviço",
      "Código",
      "Data Agendamento",
      "Status",
      "Provider",
      "Order ID",
      "Data Venda",
      "Link Redirecionamento",
    ];
    const rows = filteredAppointments.map((apt) => [
      apt.email,
      apt.service_name || "-",
      apt.service_code,
      format(parseISO(apt.start_at_local), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      apt.status,
      apt.provider || "-",
      apt.order_id || "-",
      format(parseISO(apt.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      apt.redirect_url || apt.teams_join_url || "-",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();

    toast({
      title: "Exportação concluída",
      description: `${filteredAppointments.length} vendas exportadas.`,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      scheduled: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getProviderBadge = (provider?: string) => {
    if (!provider) return <Badge variant="outline">Desconhecido</Badge>;
    return (
      <Badge variant={provider.toLowerCase().includes("clicklife") ? "default" : "secondary"}>
        {provider}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando vendas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Esta Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesThisWeek}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              {Object.entries(salesByProvider).map(([provider, count]) => (
                <div key={provider} className="flex justify-between">
                  <span className="text-muted-foreground">{provider}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os serviços" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                {uniqueServices.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os providers</SelectItem>
                <SelectItem value="ClickLife">ClickLife</SelectItem>
                <SelectItem value="Communicare">Communicare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Vendas ({filteredAppointments.length} {filteredAppointments.length === 1 ? "registro" : "registros"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Data Agendamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Link da Consulta</TableHead>
                  <TableHead>Data Venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhuma venda encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">{apt.email}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{apt.service_name || "-"}</div>
                          <div className="text-xs text-muted-foreground">{apt.service_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(apt.start_at_local), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(apt.status)}</TableCell>
                      <TableCell>{getProviderBadge(apt.provider)}</TableCell>
                      <TableCell>
                        {(apt.redirect_url || apt.teams_join_url) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]" title={apt.redirect_url || apt.teams_join_url}>
                              {simplifyUrl(apt.redirect_url || apt.teams_join_url || "")}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleCopyLink(
                                  apt.redirect_url || apt.teams_join_url || "",
                                  apt.service_name || apt.service_code
                                )
                              }
                              className="h-6 w-6 p-0"
                              title="Copiar link completo"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(apt.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesTab;
