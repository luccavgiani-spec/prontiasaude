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
        const workbook = XLSX.read(fileContent, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<{ email: string }>(firstSheet);
        parsedEmails = data
          .map(row => row.email?.trim())
          .filter(email => email && validateEmail(email));
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
      console.error(error);
    }
  };

  const processBulkInvites = async () => {
    setProcessing(true);
    setStep('processing');
    setProgress(0);
    
    const inviteResults: BulkInviteResult[] = [];
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      try {
        console.log('[BulkInvite] Sending invite for:', email);
        
        const { data, error } = await supabase.functions.invoke('company-operations', {
          body: {
            operation: 'invite-employee',
            company_id: companyId,
            email
          }
        });
        
        console.log('[BulkInvite] Response:', { data, error });
        
        if (error) {
          console.error('[BulkInvite] Supabase error:', error);
          throw error;
        }
        
        if (data?.error) {
          console.error('[BulkInvite] Edge function error:', data.error);
          throw new Error(data.error);
        }
        
        inviteResults.push({
          email,
          status: 'success'
        });
        
      } catch (error: any) {
        console.error('[BulkInvite] Failed for email:', email, error);
        
        let errorMessage = error.message || 'Erro desconhecido';
        
        // Identificar tipos específicos de erro
        if (errorMessage.includes('já cadastrado')) {
          errorMessage = '❌ Email já cadastrado no sistema';
        } else if (errorMessage.includes('já enviado')) {
          errorMessage = '⚠️ Convite já enviado anteriormente';
        } else if (errorMessage.includes('Failed to send') || errorMessage.includes('FunctionsHttpError')) {
          errorMessage = '🔌 Erro de conexão com servidor';
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
