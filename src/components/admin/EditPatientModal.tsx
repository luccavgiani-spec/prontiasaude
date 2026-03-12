import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { validateCPF, cleanCPF, formatCPF } from '@/lib/cpf-validator';

interface PatientData {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  cpf?: string;
  phone_e164?: string;
  birth_date?: string;
  gender?: string;
  cep?: string;
  address_line?: string;
  address_number?: string;
  city?: string;
  state?: string;
}

interface EditPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientData | null;
  onSuccess: () => void;
}

export function EditPatientModal({ open, onOpenChange, patient, onSuccess }: EditPatientModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<PatientData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (patient) {
      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        cpf: patient.cpf || '',
        phone_e164: patient.phone_e164 || '',
        birth_date: patient.birth_date || '',
        gender: patient.gender || '',
        cep: patient.cep || '',
        address_line: patient.address_line || '',
        address_number: patient.address_number || '',
        city: patient.city || '',
        state: patient.state || '',
      });
      setErrors({});
    }
  }, [patient]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate CPF if provided
    if (formData.cpf) {
      const cleanedCpf = cleanCPF(formData.cpf);
      if (cleanedCpf.length > 0 && cleanedCpf.length !== 11) {
        newErrors.cpf = 'CPF deve ter 11 dígitos';
      } else if (cleanedCpf.length === 11 && !validateCPF(cleanedCpf)) {
        newErrors.cpf = 'CPF inválido';
      } else if (cleanedCpf === '00000000000') {
        newErrors.cpf = 'CPF placeholder não permitido';
      }
    }

    // Validate phone if provided
    if (formData.phone_e164) {
      const cleanedPhone = formData.phone_e164.replace(/\D/g, '');
      if (cleanedPhone.length > 0 && (cleanedPhone.length < 10 || cleanedPhone.length > 13)) {
        newErrors.phone_e164 = 'Telefone inválido';
      } else if (formData.phone_e164 === '+5511999999999') {
        newErrors.phone_e164 = 'Telefone placeholder não permitido';
      }
    }

    // Validate CEP if provided
    if (formData.cep) {
      const cleanedCep = formData.cep.replace(/\D/g, '');
      if (cleanedCep.length > 0 && cleanedCep.length !== 8) {
        newErrors.cep = 'CEP deve ter 8 dígitos';
      }
    }

    // Validate birth date if provided
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const now = new Date();
      if (birthDate > now) {
        newErrors.birth_date = 'Data de nascimento não pode ser futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!patient || !validateForm()) return;

    setLoading(true);
    try {
      // Clean data before saving
      const cleanedCpf = formData.cpf ? cleanCPF(formData.cpf) : null;
      const cleanedCep = formData.cep ? formData.cep.replace(/\D/g, '') : null;

      // Prepare update data - remove empty strings, convert to null
      // ✅ Whitelist de campos permitidos para edição
      const updates: Record<string, unknown> = {
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        cpf: cleanedCpf && cleanedCpf !== '00000000000' ? cleanedCpf : null,
        phone_e164: formData.phone_e164 && formData.phone_e164 !== '+5511999999999' ? formData.phone_e164 : null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        cep: cleanedCep || null,
        address_line: formData.address_line || null,
        address_number: formData.address_number || null,
        city: formData.city || null,
        state: formData.state || null,
      };

      console.log('[EditPatientModal] Chamando admin_update_patient para:', patient.email);

      const { data: sessionData } = await supabase.auth.getSession();
      const adminToken = sessionData?.session?.access_token;

      const { data, error } = await invokeEdgeFunction('patient-operations', {
        body: {
          operation: 'admin_update_patient',
          patient_id: patient.id,
          email: patient.email,
          updates
        },
        headers: adminToken ? {
          Authorization: `Bearer ${adminToken}`
        } : undefined
      });

      if (error) {
        console.error('[EditPatientModal] Edge function error:', error);
        throw new Error(error.message || 'Erro ao atualizar paciente');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao atualizar paciente');
      }

      toast.success('Paciente atualizado com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating patient:', error);
      toast.error(error.message || 'Erro ao atualizar paciente');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PatientData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const formatPhoneForDisplay = (phone: string): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.slice(2, 4);
      const part1 = cleaned.slice(4, 9);
      const part2 = cleaned.slice(9, 13);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
    return phone;
  };

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Paciente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email (read-only) */}
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-mono text-sm mt-1">{patient.email}</p>
          </div>

          {/* Nome e Sobrenome */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nome</Label>
              <Input
                id="first_name"
                value={formData.first_name || ''}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                placeholder="Nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Sobrenome</Label>
              <Input
                id="last_name"
                value={formData.last_name || ''}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                placeholder="Sobrenome"
              />
            </div>
          </div>

          {/* CPF e Telefone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf ? formatCPF(formData.cpf) : ''}
                onChange={(e) => handleInputChange('cpf', e.target.value.replace(/\D/g, ''))}
                placeholder="000.000.000-00"
                maxLength={14}
                className={errors.cpf ? 'border-destructive' : ''}
              />
              {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_e164">Telefone (E.164)</Label>
              <Input
                id="phone_e164"
                value={formData.phone_e164 || ''}
                onChange={(e) => handleInputChange('phone_e164', e.target.value)}
                placeholder="+5511999999999"
                className={errors.phone_e164 ? 'border-destructive' : ''}
              />
              {errors.phone_e164 && <p className="text-sm text-destructive">{errors.phone_e164}</p>}
              {formData.phone_e164 && (
                <p className="text-xs text-muted-foreground">{formatPhoneForDisplay(formData.phone_e164)}</p>
              )}
            </div>
          </div>

          {/* Data de Nascimento e Gênero */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date || ''}
                onChange={(e) => handleInputChange('birth_date', e.target.value)}
                className={errors.birth_date ? 'border-destructive' : ''}
              />
              {errors.birth_date && <p className="text-sm text-destructive">{errors.birth_date}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gênero</Label>
              <Select
                value={formData.gender || ''}
                onValueChange={(value) => handleInputChange('gender', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="I">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CEP e Número */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep || ''}
                onChange={(e) => handleInputChange('cep', e.target.value.replace(/\D/g, ''))}
                placeholder="00000000"
                maxLength={8}
                className={errors.cep ? 'border-destructive' : ''}
              />
              {errors.cep && <p className="text-sm text-destructive">{errors.cep}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_number">Número</Label>
              <Input
                id="address_number"
                value={formData.address_number || ''}
                onChange={(e) => handleInputChange('address_number', e.target.value)}
                placeholder="123"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-2">
            <Label htmlFor="address_line">Endereço</Label>
            <Input
              id="address_line"
              value={formData.address_line || ''}
              onChange={(e) => handleInputChange('address_line', e.target.value)}
              placeholder="Rua, Bairro"
            />
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="São Paulo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Input
                id="state"
                value={formData.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
