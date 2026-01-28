
# Correção: Modal de Consulta Rápida + Exibição de Link

## Problemas Identificados

### 1. Modal fecha automaticamente (linha 456)
O código atual fecha o modal **antes de mostrar o link** para o usuário:
```typescript
finally {
  setQuickConsultLoading(false);
  setQuickConsultUser(null); // ❌ Fecha o modal imediatamente
}
```

**Resultado**: O link é copiado para clipboard e mostrado em um toast, mas o usuário não consegue ver/copiar de forma confiável.

### 2. Não existe estado para armazenar o link gerado
O componente não tem um estado para guardar a URL após a criação bem-sucedida.

### 3. Dados da Carolina estão completos
Verifiquei no banco e os dados da Carolina estão perfeitos:
| Campo | Valor |
|-------|-------|
| CPF | 04021896040 |
| Nome | Carolina De Lima Bombardelli |
| Telefone | +5546999240242 |
| Nascimento | 1999-08-23 |
| Sexo | F |

A consulta dela **foi criada com sucesso** (vi no network request com redirect_url). O problema é que o modal fechou antes de mostrar o link.

---

## Arquivo que será modificado

`src/components/admin/UserRegistrationsTab.tsx`

**Motivo**: Adicionar estado para mostrar o link gerado no modal após criar consulta.

**Escopo exato**:
- Adicionar novo estado `generatedConsultUrl`
- Modificar `handleQuickConsult` para não fechar modal em caso de sucesso
- Modificar o modal para exibir o link com botão de copiar

---

## Correção Técnica

### 1. Adicionar estado para URL gerada (linha ~92)
```typescript
// Após a linha 92 (quickConsultLoading)
const [generatedConsultUrl, setGeneratedConsultUrl] = useState<string | null>(null);
```

### 2. Modificar handleQuickConsult (linhas 421-457)
```typescript
if (data?.ok && data?.url) {
  // ✅ NOVO: Salvar URL no estado para mostrar no modal
  setGeneratedConsultUrl(data.url);
  setQuickConsultLoading(false);
  
  // Copiar automaticamente
  await navigator.clipboard.writeText(data.url);
  toast.success(`Consulta criada! Link copiado para a área de transferência.`);
  
  // ❌ NÃO fechar o modal - deixar aberto para mostrar o link
  // setQuickConsultUser(null);
} else {
  // ... código de erro existente ...
  setQuickConsultLoading(false);
  setQuickConsultUser(null); // Fechar modal em caso de erro
  setGeneratedConsultUrl(null);
}
```

### 3. Modificar finally block (linha 454-457)
```typescript
finally {
  setQuickConsultLoading(false);
  // ❌ Remover: setQuickConsultUser(null);
  // O modal será fechado manualmente pelo usuário ou ao criar novo
}
```

### 4. Atualizar o modal para mostrar link gerado (após linha 891)
```typescript
{/* Mostrar link gerado */}
{generatedConsultUrl && (
  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
    <p className="text-sm font-medium text-green-800 mb-2">✅ Consulta criada com sucesso!</p>
    <div className="flex items-center gap-2">
      <Input 
        value={generatedConsultUrl} 
        readOnly 
        className="flex-1 text-xs font-mono"
      />
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(generatedConsultUrl);
          toast.success('Link copiado!');
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
    <p className="text-xs text-green-600 mt-2">
      Envie este link para o paciente iniciar a consulta.
    </p>
  </div>
)}
```

### 5. Resetar URL ao fechar modal
```typescript
<Dialog 
  open={!!quickConsultUser} 
  onOpenChange={(open) => {
    if (!open) {
      setQuickConsultUser(null);
      setGeneratedConsultUrl(null); // ✅ Limpar URL ao fechar
    }
  }}
>
```

### 6. Adicionar import do ícone Copy (linha ~14)
```typescript
import { ..., Copy } from 'lucide-react';
```

---

## Fluxo Esperado Após Correção

1. Admin clica em "Criar Consulta" no modal
2. Consulta é criada (ClickLife ou Communicare)
3. **Modal permanece aberto** com:
   - Mensagem de sucesso
   - Input com URL completa
   - Botão "Copiar" ao lado
4. Admin copia o link manualmente se precisar
5. Admin fecha o modal quando terminar

---

## Critérios de Aceite

1. **Modal não fecha automaticamente** após criar consulta
2. **Link é exibido visualmente** em um input dentro do modal
3. **Botão de copiar funciona** e mostra toast de confirmação
4. **Funciona para ClickLife e Communicare**
5. **Carolina consegue ter consulta criada e link copiado**

---

## Detalhes Técnicos

### Por que o erro 500 acontecia?
A correção de safe parsing que implementamos na edge function já deve prevenir crashes quando as APIs externas retornam HTML. O erro agora é capturado e retornado de forma estruturada.

### Por que sempre vai para ClickLife?
O `quickConsultProvider` inicia com valor `'clicklife'` por padrão, mas o usuário pode alterar no RadioGroup do modal. Isso não é um bug.

### Por que não funciona para alguns pacientes?
Possíveis causas:
- Dados incompletos (CPF, telefone, nascimento)
- CPF inválido (checksum incorreto)
- API externa retornando erro

O modal agora mostrará a mensagem de erro específica quando ocorrer.
