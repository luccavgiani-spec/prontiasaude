import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2, FileText, Users } from 'lucide-react';

interface ParsedUser {
  email: string;
  encrypted_password: string | null;
  raw_user_meta_data?: Record<string, unknown>;
  email_confirmed_at?: string;
  created_at?: string;
  provider?: string;
}

interface ImportResult {
  email: string;
  status: 'created' | 'skipped' | 'error';
  message: string;
}

interface ImportUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportUsersModal({ open, onOpenChange, onSuccess }: ImportUsersModalProps) {
  const [sqlContent, setSqlContent] = useState('');
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'done'>('input');

  const parseSQL = () => {
    setAnalyzing(true);
    
    try {
      const users: ParsedUser[] = [];
      
      // Match INSERT statements for auth.users
      // Pattern: VALUES ('uuid', 'instance_id', 'aud', 'role', 'email', 'encrypted_password', ...)
      const insertPattern = /\(([^)]+)\)/g;
      const matches = sqlContent.matchAll(insertPattern);
      
      for (const match of matches) {
        const values = match[1];
        
        // Split by comma but respect quoted strings
        const parts: string[] = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';
        
        for (let i = 0; i < values.length; i++) {
          const char = values[i];
          
          if ((char === "'" || char === '"') && (i === 0 || values[i-1] !== '\\')) {
            if (!inQuote) {
              inQuote = true;
              quoteChar = char;
            } else if (char === quoteChar) {
              inQuote = false;
            }
          }
          
          if (char === ',' && !inQuote) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        if (current) parts.push(current.trim());
        
        // auth.users table columns (typical order):
        // 0: instance_id, 1: id, 2: aud, 3: role, 4: email, 5: encrypted_password
        // 6: email_confirmed_at, 7: invited_at, 8: confirmation_token, 9: confirmation_sent_at
        // 10: recovery_token, 11: recovery_sent_at, 12: email_change_token_new, 13: email_change
        // 14: email_change_sent_at, 15: last_sign_in_at, 16: raw_app_meta_data, 17: raw_user_meta_data
        // 18: is_super_admin, 19: created_at, 20: updated_at, 21: phone, 22: phone_confirmed_at
        // 23: phone_change, 24: phone_change_token, 25: phone_change_sent_at, 26: email_change_token_current
        // 27: email_change_confirm_status, 28: banned_until, 29: reauthentication_token, 30: reauthentication_sent_at
        // 31: is_sso_user, 32: deleted_at, 33: is_anonymous
        
        if (parts.length >= 6) {
          const cleanValue = (val: string) => {
            val = val.trim();
            if (val === 'NULL' || val === 'null') return null;
            // Remove quotes
            if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
              val = val.slice(1, -1);
            }
            // Handle escaped quotes
            val = val.replace(/''/g, "'").replace(/\\'/g, "'");
            return val;
          };
          
          const email = cleanValue(parts[4]);
          const encryptedPassword = cleanValue(parts[5]);
          const emailConfirmedAt = cleanValue(parts[6]);
          const rawUserMetaDataStr = cleanValue(parts[17]);
          const createdAt = cleanValue(parts[19]);
          
          // Validate email
          if (email && email.includes('@')) {
            let rawUserMetaData: Record<string, unknown> = {};
            
            if (rawUserMetaDataStr) {
              try {
                rawUserMetaData = JSON.parse(rawUserMetaDataStr);
              } catch {
                // Ignore parse errors
              }
            }
            
            // Detect provider from metadata
            const provider = rawUserMetaData?.provider as string || 
                             (rawUserMetaData?.providers as string[])?.includes('google') ? 'google' : 
                             encryptedPassword ? 'email' : 'unknown';
            
            users.push({
              email,
              encrypted_password: encryptedPassword,
              raw_user_meta_data: rawUserMetaData,
              email_confirmed_at: emailConfirmedAt || undefined,
              created_at: createdAt || undefined,
              provider
            });
          }
        }
      }
      
      // Remove duplicates by email
      const uniqueUsers = users.filter((user, index, self) => 
        index === self.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase())
      );
      
      setParsedUsers(uniqueUsers);
      setStep('preview');
      
      if (uniqueUsers.length === 0) {
        toast.error('Nenhum usuário encontrado no SQL. Verifique o formato.');
      } else {
        toast.success(`${uniqueUsers.length} usuários encontrados!`);
      }
      
    } catch (error) {
      console.error('Error parsing SQL:', error);
      toast.error('Erro ao analisar SQL. Verifique o formato.');
    } finally {
      setAnalyzing(false);
    }
  };

  const startImport = async () => {
    setImporting(true);
    setStep('importing');
    setProgress(0);
    setResults([]);
    
    try {
      // Import in batches of 10
      const batchSize = 10;
      const allResults: ImportResult[] = [];
      
      for (let i = 0; i < parsedUsers.length; i += batchSize) {
        const batch = parsedUsers.slice(i, i + batchSize);
        
        const { data, error } = await supabase.functions.invoke('import-users', {
          body: { users: batch }
        });
        
        if (error) {
          console.error('Error importing batch:', error);
          // Add error results for this batch
          batch.forEach(u => {
            allResults.push({
              email: u.email,
              status: 'error',
              message: error.message
            });
          });
        } else if (data?.results) {
          allResults.push(...data.results);
        }
        
        setProgress(Math.min(100, Math.round(((i + batch.length) / parsedUsers.length) * 100)));
        setResults([...allResults]);
      }
      
      setStep('done');
      
      const created = allResults.filter(r => r.status === 'created').length;
      const skipped = allResults.filter(r => r.status === 'skipped').length;
      const errors = allResults.filter(r => r.status === 'error').length;
      
      if (created > 0) {
        toast.success(`Importação concluída! ${created} criados, ${skipped} já existiam, ${errors} erros`);
      } else if (errors > 0) {
        toast.error(`Importação com erros: ${errors} falhas`);
      } else {
        toast.info(`Todos os ${skipped} usuários já existiam`);
      }
      
    } catch (error) {
      console.error('Error during import:', error);
      toast.error('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (step === 'done') {
      onSuccess();
    }
    setSqlContent('');
    setParsedUsers([]);
    setResults([]);
    setStep('input');
    setProgress(0);
    onOpenChange(false);
  };

  const emailPasswordUsers = parsedUsers.filter(u => u.encrypted_password);
  const googleOAuthUsers = parsedUsers.filter(u => !u.encrypted_password);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Usuários do Backup
          </DialogTitle>
          <DialogDescription>
            Cole o conteúdo do arquivo SQL de backup para importar usuários com senhas preservadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Conteúdo SQL (users_rows.sql)</label>
                <Textarea
                  placeholder="Cole aqui o conteúdo do arquivo SQL..."
                  value={sqlContent}
                  onChange={(e) => setSqlContent(e.target.value)}
                  className="h-64 font-mono text-xs mt-2"
                />
              </div>
              
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Formato esperado:</p>
                  <p>INSERT INTO auth.users com colunas: id, email, encrypted_password, raw_user_meta_data, etc.</p>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{parsedUsers.length}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">{emailPasswordUsers.length}</div>
                  <div className="text-sm text-muted-foreground">Email/Senha</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                  <svg className="h-6 w-6 mx-auto mb-2 text-blue-600" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <div className="text-2xl font-bold text-blue-600">{googleOAuthUsers.length}</div>
                  <div className="text-sm text-muted-foreground">Google OAuth</div>
                </div>
              </div>

              <ScrollArea className="h-64 border rounded-lg">
                <div className="p-2 space-y-1">
                  {parsedUsers.slice(0, 50).map((user, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted rounded text-sm">
                      <span className="font-mono">{user.email}</span>
                      <Badge variant={user.encrypted_password ? "default" : "secondary"}>
                        {user.encrypted_password ? "Email/Senha" : "Google"}
                      </Badge>
                    </div>
                  ))}
                  {parsedUsers.length > 50 && (
                    <div className="text-center text-muted-foreground text-sm py-2">
                      ... e mais {parsedUsers.length - 50} usuários
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-600">Senhas serão preservadas!</p>
                  <p className="text-muted-foreground">
                    Usuários com email/senha poderão fazer login com a mesma senha de antes.
                    Usuários Google continuarão usando "Entrar com Google".
                  </p>
                </div>
              </div>
            </div>
          )}

          {(step === 'importing' || step === 'done') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              <ScrollArea className="h-64 border rounded-lg">
                <div className="p-2 space-y-1">
                  {results.map((result, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted rounded text-sm">
                      <span className="font-mono truncate flex-1">{result.email}</span>
                      <div className="flex items-center gap-2 ml-2">
                        {result.status === 'created' && (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <Badge variant="default" className="bg-green-600">Criado</Badge>
                          </>
                        )}
                        {result.status === 'skipped' && (
                          <>
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <Badge variant="secondary">Já existe</Badge>
                          </>
                        )}
                        {result.status === 'error' && (
                          <>
                            <XCircle className="h-4 w-4 text-red-600" />
                            <Badge variant="destructive">Erro</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {step === 'done' && (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-xl font-bold text-green-600">
                      {results.filter(r => r.status === 'created').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Criados</div>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <div className="text-xl font-bold text-yellow-600">
                      {results.filter(r => r.status === 'skipped').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Já existiam</div>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div className="text-xl font-bold text-red-600">
                      {results.filter(r => r.status === 'error').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={parseSQL} disabled={!sqlContent.trim() || analyzing}>
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>Analisar SQL</>
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>Voltar</Button>
              <Button onClick={startImport} disabled={parsedUsers.length === 0}>
                Importar {parsedUsers.length} usuários
              </Button>
            </>
          )}

          {step === 'importing' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importando...
            </Button>
          )}

          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
