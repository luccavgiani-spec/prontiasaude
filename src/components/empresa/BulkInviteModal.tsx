import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Download, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { validateEmail } from '@/lib/validations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkInviteResult {
  email: string;
  status: 'success' | 'error';
  message?: string;
}

interface BulkInviteModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onComplete: () => void;
}

export default function BulkInviteModal({ 
  open, 
  onClose, 
  companyId, 
  onComplete 
}: BulkInviteModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkInviteResult[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'results'>('upload');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
    
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      toast.error('Formato inválido. Use CSV ou XLSX');
      return;
    }

    setFile(uploadedFile);
    
    try {
      const fileContent = await uploadedFile.arrayBuffer();
      let parsedEmails: string[] = [];

      if (extension === 'csv') {
        const text = new TextDecoder().decode(fileContent);
        const lines = text.split('\n').slice(1);
        parsedEmails = lines
          .map(line => line.trim())
          .filter(line => line && validateEmail(line));
      } else {
        console.log('[XLSX] Starting parse...');
        
        // Forçar leitura de valores (não hyperlinks/fórmulas)
        const workbook = XLSX.read(fileContent, { 
          type: 'array',
          cellText: false,
          cellFormula: false,
          cellHTML: false
        });
        
        console.log('[XLSX] Workbook loaded:', {
          sheetNames: workbook.SheetNames,
          totalSheets: workbook.SheetNames.length
        });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        console.log('[XLSX] First sheet range:', firstSheet['!ref']);
        
        // Tentar parsear via sheet_to_json
        const data = XLSX.utils.sheet_to_json<{ email: string }>(firstSheet);
        console.log('[XLSX] Parsed via sheet_to_json:', {
          totalRows: data.length,
          firstRow: data[0]
        });
        
        parsedEmails = data
          .map(row => {
            const email = row.email?.trim();
            console.log('[XLSX] Processing row:', { raw: row, extracted: email });
            return email;
          })
          .filter(email => {
            const isValid = email && validateEmail(email);
            if (!isValid && email) {
              console.log('[XLSX] Invalid email filtered:', email);
            }
            return isValid;
          });
        
        // Fallback: Se não encontrou nada, tentar ler coluna A diretamente
        if (parsedEmails.length === 0) {
          console.log('[XLSX] Fallback: reading column A directly...');
          const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
          
          for (let row = 1; row <= range.e.r; row++) { // Pula linha 0 (cabeçalho)
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 }); // Coluna A
            const cell = firstSheet[cellAddress];
            
            if (cell && cell.v) {
              const email = String(cell.v).trim();
              console.log('[XLSX] Fallback found:', { cellAddress, value: email });
              
              if (validateEmail(email)) {
                parsedEmails.push(email);
              }
            }
          }
        }
        
        console.log('[XLSX] Final parsed emails:', parsedEmails);
      }

      if (parsedEmails.length === 0) {
        toast.error('Nenhum email válido encontrado no arquivo');
        return;
      }

      const uniqueEmails = Array.from(new Set(parsedEmails));
      
      setEmails(uniqueEmails);
      setStep('preview');
      toast.success(`${uniqueEmails.length} emails válidos encontrados`);
      
    } catch (error) {
      toast.error('Erro ao processar arquivo');
      console.error('[Upload] Error:', error);
    }
  };

  const processBulkInvites = async () => {
    setProcessing(true);
    setStep('processing');
    setProgress(0);
    
    // Validar sessão antes de iniciar
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      toast.error('❌ Sessão expirada. Faça login novamente.');
      setProcessing(false);
      onClose();
      return;
    }
    
    console.log('[BulkInvite] Session valid:', {
      user: session.user.email,
      expiresAt: session.expires_at
    });
    
    const inviteResults: BulkInviteResult[] = [];
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      const MAX_RETRIES = 2;
      let attempt = 0;
      let lastError: any;
      
      while (attempt < MAX_RETRIES) {
        try {
          console.log(`[BulkInvite] Sending invite for: ${email} (attempt ${attempt + 1}/${MAX_RETRIES})`);
          
          // Criar promises: timeout + invocação
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('⏱️ Timeout: Servidor não respondeu em 30s')), 30000)
          );
          
          const invokePromise = supabase.functions.invoke('company-operations', {
            body: {
              operation: 'invite-employee',
              company_id: companyId,
              email
            }
          });
          
          const result = await Promise.race([invokePromise, timeoutPromise]) as any;
          const { data, error } = result;
          
          console.log('[BulkInvite] Response:', { data, error, status: result?.status });
          
          // Se retornou data com error e code, é uma resposta controlada da edge function
          if (data?.error && data?.code) {
            console.log('[BulkInvite] Validation error from edge function:', data);
            throw new Error(data.error);
          }
          
          // Se error do Supabase client (network, timeout, etc.)
          if (error) {
            console.error('[BulkInvite] Supabase client error:', error);
            throw error;
          }
          
          // Sucesso
          inviteResults.push({
            email,
            status: 'success'
          });
          
          break; // Sair do while de retry
          
        } catch (error: any) {
          lastError = error;
          attempt++;
          
          console.error(`[BulkInvite] Attempt ${attempt} failed for ${email}:`, error);
          
          // Erros de validação (409) não devem fazer retry
          const isValidationError = error.message?.includes('convite pendente') ||
                                   error.message?.includes('já cadastrado') ||
                                   error.message?.includes('completou o cadastro');
          
          // Erros de rede podem fazer retry
          const isNetworkError = error.message?.includes('Failed to send') || 
                                 error.message?.includes('FunctionsHttpError') ||
                                 error.message?.includes('Timeout');
          
          if (isValidationError) {
            // Erro de validação: não fazer retry, sair imediatamente
            console.log('[BulkInvite] Validation error, not retrying');
            break;
          } else if (attempt < MAX_RETRIES && isNetworkError) {
            // Erro de rede: tentar novamente
            const delay = 1000 * attempt; // 1s, 2s
            console.log(`[BulkInvite] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // Última tentativa ou erro desconhecido
            break;
          }
        }
      }
      
      // Se todas as tentativas falharam, registrar erro
      if (attempt === MAX_RETRIES || lastError) {
        let errorMessage = lastError?.message || 'Erro desconhecido';
        
        // Identificar tipos específicos de erro (com prioridade para mensagens mais específicas)
        if (errorMessage.includes('Email já cadastrado no sistema')) {
          errorMessage = '❌ Email já cadastrado no sistema';
        } else if (errorMessage.includes('convite pendente') || errorMessage.includes('Use a opção "Reenviar"')) {
          errorMessage = '⚠️ Convite já enviado anteriormente (pendente)';
        } else if (errorMessage.includes('completou o cadastro') || errorMessage.includes('Verifique a aba "Funcionários"')) {
          errorMessage = '✅ Funcionário já cadastrado';
        } else if (errorMessage.includes('Failed to send') || 
                   errorMessage.includes('FunctionsHttpError') || 
                   errorMessage.includes('Timeout')) {
          errorMessage = `🔌 Erro de conexão (${attempt} tentativas)`;
        } else if (errorMessage.includes('Company not found')) {
          errorMessage = '❌ Empresa não encontrada';
        } else if (errorMessage.includes('Missing required fields')) {
          errorMessage = '❌ Dados inválidos';
        }
        
        inviteResults.push({
          email,
          status: 'error',
          message: errorMessage
        });
      }
      
      setProgress(((i + 1) / emails.length) * 100);
    }
    
    setResults(inviteResults);
    setStep('results');
    setProcessing(false);
    
    const successCount = inviteResults.filter(r => r.status === 'success').length;
    toast.success(`${successCount} de ${emails.length} convites enviados com sucesso`);
    
    onComplete();
  };

  const downloadErrorReport = () => {
    const errors = results.filter(r => r.status === 'error');
    const csvContent = 'email,erro\n' + 
      errors.map(e => `${e.email},"${e.message}"`).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros-convites.csv';
    a.click();
  };

  const reset = () => {
    setFile(null);
    setEmails([]);
    setResults([]);
    setStep('upload');
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Importar Lista de Funcionários</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo CSV ou XLSX ou clique para selecionar
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="max-w-sm mx-auto"
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>📋 Formato esperado:</strong>
              </p>
              <pre className="text-xs bg-white p-2 rounded border">
email
funcionario1@empresa.com
funcionario2@empresa.com
funcionario3@empresa.com
              </pre>
              <p className="text-xs text-blue-700 mt-2">
                ✅ A coluna "email" é obrigatória<br/>
                ✅ Emails duplicados serão ignorados<br/>
                ✅ Emails inválidos serão filtrados
              </p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✅ <strong>{emails.length} emails</strong> prontos para envio
              </p>
            </div>
            
            <div className="border rounded-lg max-h-60 overflow-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-sm font-medium">#</th>
                    <th className="text-left p-2 text-sm font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-sm text-muted-foreground">{idx + 1}</td>
                      <td className="p-2 text-sm">{email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button onClick={processBulkInvites}>
                Enviar {emails.length} Convites
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-lg font-medium mb-2">Processando convites...</p>
              <p className="text-sm text-muted-foreground">
                {Math.round(progress)}% concluído
              </p>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-800">
                        {results.filter(r => r.status === 'success').length}
                      </p>
                      <p className="text-sm text-green-700">Sucessos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-800">
                        {results.filter(r => r.status === 'error').length}
                      </p>
                      <p className="text-sm text-red-700">Erros</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {results.filter(r => r.status === 'error').length > 0 && (
              <>
                <div className="border rounded-lg max-h-60 overflow-auto">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-sm font-medium">Email</th>
                        <th className="text-left p-2 text-sm font-medium">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results
                        .filter(r => r.status === 'error')
                        .map((result, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 text-sm">{result.email}</td>
                            <td className="p-2 text-sm text-red-600">{result.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                
                <Button variant="outline" onClick={downloadErrorReport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Relatório de Erros (CSV)
                </Button>
              </>
            )}
            
            <div className="flex justify-end">
              <Button onClick={reset}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
