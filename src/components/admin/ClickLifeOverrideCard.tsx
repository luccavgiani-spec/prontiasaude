import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function ClickLifeOverrideCard() {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'force_clicklife_pronto_atendimento')
        .maybeSingle();

      setIsActive(data?.value === true);
    } catch (error) {
      console.error('Error loading override status:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOverride = async (newValue: boolean) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .upsert(
          { 
            key: 'force_clicklife_pronto_atendimento', 
            value: newValue,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        )
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Alteração não foi aplicada. Verifique suas permissões.');
      }

      // Recarregar status para confirmar
      await loadStatus();

      toast.success(
        newValue 
          ? '🚨 Override ativado! Pronto Atendimento agora vai SEMPRE para ClickLife'
          : '✅ Override desativado. Lógica de redirecionamento voltou ao normal'
      );
    } catch (err) {
      console.error('Error toggling override:', err);
      toast.error(`Erro ao alterar configuração: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      // Recarregar status em caso de erro também
      await loadStatus();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-red-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          🚨 FORÇAR PRONTO ATENDIMENTO → CLICKLIFE
        </CardTitle>
        <CardDescription>
          Sobrescreve TODA a lógica de redirecionamento e força o Pronto Atendimento exclusivamente para ClickLife.
          <br />
          ⚠️ <strong>Use apenas em emergências!</strong> Isso afeta TODOS os usuários.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Indicador visual do status */}
        <Alert className={isActive ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'}>
          <AlertCircle className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-gray-600'}`} />
          <AlertDescription className={isActive ? 'text-red-800' : 'text-gray-800'}>
            <strong>Status atual: </strong>
            {isActive ? (
              <span className="text-red-600 font-bold">🔴 ATIVO - ClickLife FORÇADO</span>
            ) : (
              <span className="text-gray-600">⚫ INATIVO - Roteamento normal</span>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            variant={isActive ? 'outline' : 'destructive'}
            onClick={() => toggleOverride(true)}
            disabled={isActive === true || saving}
            className="flex-1"
          >
            {saving && !isActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isActive ? '✓ Override Ativo' : 'Ativar Override'}
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleOverride(false)}
            disabled={isActive === false || saving}
            className="flex-1"
          >
            {saving && isActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isActive === false ? '✓ Override Inativo' : 'Desativar Override'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
