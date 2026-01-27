import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { supabaseProduction } from '@/lib/supabase-production';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_SPECIALTIES, normalizeSpecialty } from '@/lib/specialties-config';
interface SpecialtiesSelectorProps {
  isAdmin: boolean;
}
export default function SpecialtiesSelector({
  isAdmin
}: SpecialtiesSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadSpecialties();
  }, []);
  const loadSpecialties = async () => {
    try {
      // Ler diretamente da Produção (RLS permite SELECT público)
      const {
        data,
        error
      } = await supabaseProduction.from('admin_settings').select('value').eq('key', 'communicare_specialties').maybeSingle();
      if (error) throw error;
      if (data?.value) {
        const valueStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
        const parsed = JSON.parse(valueStr);
        setSelected(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading specialties:', error);
      toast.error('Erro ao carregar especialidades');
    } finally {
      setLoading(false);
    }
  };
  const saveSpecialties = async (newSelected: string[]) => {
    try {
      // Usar Edge Function para escrever na Produção
      const { data, error } = await supabase.functions.invoke('admin-settings-update', {
        body: {
          key: 'communicare_specialties',
          value: JSON.stringify(newSelected)
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      
      toast.success('Especialidades atualizadas');
    } catch (error) {
      console.error('Error saving specialties:', error);
      toast.error('Erro ao salvar especialidades');
    }
  };
  const handleToggle = (specialty: string) => {
    if (!isAdmin) return;
    const isSelected = selected.some(s => normalizeSpecialty(s) === normalizeSpecialty(specialty));
    let newSelected: string[];
    if (isSelected) {
      newSelected = selected.filter(s => normalizeSpecialty(s) !== normalizeSpecialty(specialty));
    } else {
      newSelected = [...selected, specialty];
    }
    setSelected(newSelected);
    saveSpecialties(newSelected);
  };
  const filteredSpecialties = ALL_SPECIALTIES.filter(s => normalizeSpecialty(s).includes(normalizeSpecialty(search)));
  const selectedCount = selected.length;
  const clicklifeCount = ALL_SPECIALTIES.length - selectedCount;
  if (loading) {
    return <div className="text-center p-4">Carregando...</div>;
  }
  return <Card>
      <CardHeader>
        <CardTitle>Especialidades aceitas Communicare (Roteamento)</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          ℹ️ Use os <strong>nomes exatos</strong> do catálogo de serviços. Exemplo: "Psicólogo - 1 sessão", não "psicologo_1".
          A comparação é feita após normalização (sem acentos, lowercase).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar especialidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Counters */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-medium">Selecionadas (Communicare):</span>{' '}
            <span className="text-blue-600 font-semibold">{selectedCount}</span>
          </div>
          <div className="text-muted-foreground">|</div>
          <div>
            <span className="font-medium">Demais (ClickLife):</span>{' '}
            <span className="text-slate-600 font-semibold">{clicklifeCount}</span>
          </div>
        </div>

        {/* Chips Grid */}
        <div className="flex flex-wrap gap-2">
          {filteredSpecialties.map(specialty => {
          const isSelected = selected.some(s => normalizeSpecialty(s) === normalizeSpecialty(specialty));
          return <div key={specialty} className={`group relative ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`} onClick={() => isSelected ? null : handleToggle(specialty)} title={isSelected ? 'Atendido pela Communicare. Clique no X para remover.' : 'Atendido pela ClickLife. Clique para marcar Communicare.'}>
                <Badge variant={isSelected ? 'default' : 'outline'} className={`px-3 py-1.5 ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-background text-foreground hover:bg-muted'} ${isAdmin ? '' : 'opacity-70'}`}>
                  {specialty}
                  {isSelected && isAdmin && <X className="ml-2 h-3 w-3 inline-block hover:text-red-300" onClick={e => {
                e.stopPropagation();
                handleToggle(specialty);
              }} />}
                </Badge>
              </div>;
        })}
        </div>

        {filteredSpecialties.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma especialidade encontrada
          </p>}
      </CardContent>
    </Card>;
}