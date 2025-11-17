import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface CouponUse {
  id: string;
  coupon_code: string;
  used_by_name: string;
  used_by_email: string;
  service_or_plan_name: string;
  owner_email: string;
  owner_pix_key: string | null;
  amount_original: number;
  amount_discounted: number;
  discount_percentage: number;
  used_at: string;
}

export function CouponsTab() {
  const [couponUses, setCouponUses] = useState<CouponUse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCouponUses();
  }, []);

  const loadCouponUses = async () => {
    try {
      const { data, error } = await supabase
        .from('coupon_uses')
        .select('*')
        .order('used_at', { ascending: false });

      if (error) throw error;

      setCouponUses(data || []);
    } catch (error) {
      console.error('Erro ao carregar cupons utilizados:', error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>🎟️ Cupons Utilizados</CardTitle>
        <CardDescription>
          Lista de cupons que foram utilizados em compras pagas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {couponUses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cupom foi utilizado ainda
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome de quem usou</TableHead>
                  <TableHead>Código do cupom</TableHead>
                  <TableHead>Serviço/Plano</TableHead>
                  <TableHead>E-mail do dono</TableHead>
                  <TableHead>Chave PIX do dono</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead className="text-right">Valor com Desconto</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead>Data de uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couponUses.map((use) => (
                  <TableRow key={use.id}>
                    <TableCell className="font-medium">{use.used_by_name}</TableCell>
                    <TableCell>
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        {use.coupon_code}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={use.service_or_plan_name}>
                      {use.service_or_plan_name}
                    </TableCell>
                    <TableCell className="text-xs">{use.owner_email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono">
                          {use.owner_pix_key || '-'}
                        </code>
                        {use.owner_pix_key && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(use.owner_pix_key!)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      R$ {(use.amount_original / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      R$ {(use.amount_discounted / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        -{use.discount_percentage}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(use.used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
