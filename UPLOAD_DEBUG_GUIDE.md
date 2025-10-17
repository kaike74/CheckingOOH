# 🔧 Guia de Debug do Upload - CheckingOOH

## 📋 Visão Geral

Este guia documenta as melhorias feitas no sistema de upload (`functions/api/drive-upload.js`) e fornece instruções para diagnosticar e resolver problemas.

## 🆕 Versão Atual: v6.0-error-handling

### Principais Melhorias

#### ✅ 1. Rastreamento de Erros Aprimorado
- **Variável `currentStep`**: Identifica exatamente qual etapa falhou
- **Tipos de erro específicos**: `CONFIGURATION_ERROR`, `INVALID_REQUEST`, `AUTHENTICATION_ERROR`, `UPLOAD_ERROR`
- **Timestamps detalhados**: Registra quando cada operação ocorre

#### ✅ 2. Validação Robusta de Variáveis de Ambiente
- Valida imediatamente se `GOOGLE_SERVICE_ACCOUNT_KEY` é um JSON válido
- Verifica campos obrigatórios: `client_email`, `private_key`, `project_id`
- Mensagens claras apontando para a configuração do Cloudflare Pages

#### ✅ 3. Tratamento Melhorado de FormData
- Validação individual de cada campo
- Mensagens específicas para cada tipo de erro
- Verificação de tipo para o campo `tipo` (deve ser 'entrada' ou 'saida')

#### ✅ 4. Timeout em Requisições
- **OAuth2**: 10 segundos
- **Operações de pasta**: 10 segundos
- **Upload de arquivo**: 60 segundos
- Previne travamentos em conexões lentas

#### ✅ 5. Logs Detalhados em Cada Etapa
- JWT: Valida formato PEM, tamanho da chave, processo de assinatura
- Token: Status HTTP, conteúdo da resposta, tempo de expiração
- Upload: Progresso em cada passo, tamanho do arquivo, conversão base64

## 🐛 Como Diagnosticar Erros

### Passo 1: Verificar os Logs

Os logs agora incluem informações estruturadas. Procure por:

```
🔴 Etapa que falhou: [NOME_DA_ETAPA]
```

#### Etapas Possíveis:
1. **INITIALIZATION** - Erro na inicialização
2. **METHOD_CHECK** - Método HTTP incorreto
3. **ENV_VALIDATION** - Problema nas variáveis de ambiente
4. **FORMDATA_PARSING** - Erro ao processar dados do formulário
5. **FILE_VALIDATION** - Arquivo inválido
6. **TOKEN_ACQUISITION** - Falha ao obter token do Google
7. **FILE_UPLOAD** - Erro durante o upload

### Passo 2: Usar o Endpoint de Teste

Acesse: `/api/test-upload-debug`

Este endpoint executa 6 testes:
1. ✅ Variáveis de ambiente
2. ✅ Parse do Service Account
3. ✅ Criação de JWT
4. ✅ Obtenção de token OAuth2
5. ✅ Acesso ao Google Drive
6. ✅ Criação de pasta teste

**Método GET**: Testa a configuração
**Método POST**: Testa também o recebimento de arquivos

### Passo 3: Interpretar Respostas de Erro

#### Erro na Etapa ENV_VALIDATION

**Sintoma:**
```json
{
  "errorStep": "ENV_VALIDATION",
  "errorType": "CONFIGURATION_ERROR",
  "details": "GOOGLE_SERVICE_ACCOUNT_KEY não configurada..."
}
```

**Solução:**
1. Acesse o Cloudflare Pages Dashboard
2. Vá em Settings > Environment Variables
3. Adicione/verifique:
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: JSON completo da service account
   - `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta raiz (opcional)

#### Erro na Etapa TOKEN_ACQUISITION

**Sintoma:**
```json
{
  "errorStep": "TOKEN_ACQUISITION",
  "errorType": "AUTHENTICATION_ERROR",
  "details": "OAuth2 falhou (403): access_denied"
}
```

**Possíveis Causas:**
1. **Chave privada inválida**: Verifique se o JSON está completo
2. **API não habilitada**: Habilite Google Drive API no projeto
3. **Service Account sem permissões**: Adicione a service account ao Drive

**Solução:**
```bash
# 1. Verificar JSON da service account
cat service-account.json | jq .

# 2. Verificar se tem todos os campos
- type
- project_id
- private_key_id
- private_key
- client_email
- client_id
- auth_uri
- token_uri
```

#### Erro na Etapa FILE_UPLOAD

**Sintoma:**
```json
{
  "errorStep": "FILE_UPLOAD",
  "errorType": "UPLOAD_ERROR",
  "details": "Erro ao acessar pasta raiz: 404"
}
```

**Possíveis Causas:**
1. **Pasta não encontrada**: `GOOGLE_DRIVE_FOLDER_ID` incorreto
2. **Sem permissão**: Service account não tem acesso à pasta
3. **Shared Drive**: Precisa de permissões especiais

**Solução:**
1. Verificar ID da pasta no Google Drive (está na URL)
2. Compartilhar a pasta com o email da service account
3. Para Shared Drives, dar permissão de "Content Manager" ou "Manager"

### Passo 4: Erros Comuns e Soluções

#### ❌ "Service Account JSON inválido"

**Causa**: JSON malformado ou escape incorreto

**Solução**:
```javascript
// ❌ ERRADO - com escapes duplos
"private_key": "-----BEGIN PRIVATE KEY-----\\nMIIE..."

// ✅ CORRETO - com \n real (o Cloudflare Pages aceita)
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE..."

// Ou no Cloudflare Pages, cole o JSON inteiro sem modificações
```

#### ❌ "Timeout ao conectar com OAuth2"

**Causa**: Problemas de rede ou API do Google indisponível

**Solução**:
1. Tente novamente (o sistema já tem retry automático)
2. Verifique status da API do Google: https://status.cloud.google.com
3. Verifique se o Cloudflare Pages não está bloqueando requisições

#### ❌ "Erro ao processar arquivo"

**Causa**: Arquivo corrompido ou muito grande

**Solução**:
1. Verifique o tamanho (máximo 100MB)
2. Verifique o formato (JPEG, PNG, MP4, etc.)
3. Tente um arquivo menor primeiro

#### ❌ "Sem permissão para acessar a pasta raiz"

**Causa**: Service account não foi compartilhada com a pasta

**Solução**:
1. Abra a pasta no Google Drive
2. Clique em "Compartilhar"
3. Adicione o email da service account (algo como `nome@projeto.iam.gserviceaccount.com`)
4. Dê permissão de "Editor"

#### ❌ "Upload falhou (403): insufficientPermissions"

**Causa**: Service account tem acesso read-only

**Solução**:
1. Verifique as permissões da service account na pasta
2. Deve ser "Editor" ou superior
3. Para Shared Drives, precisa ser "Content Manager" ou "Manager"

## 🧪 Testando Localmente

### Com Wrangler (Cloudflare Pages)

```bash
# 1. Instalar wrangler
npm install -g wrangler

# 2. Configurar secrets localmente
wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_KEY --env production
wrangler pages secret put GOOGLE_DRIVE_FOLDER_ID --env production

# 3. Executar localmente
npm run dev

# 4. Testar upload
curl -X POST http://localhost:8788/api/test-upload-debug
```

### Teste Manual com cURL

```bash
# Teste GET (verificar configuração)
curl -X GET https://seu-dominio.pages.dev/api/test-upload-debug

# Teste POST (upload simulado)
curl -X POST https://seu-dominio.pages.dev/api/drive-upload \
  -F "file=@foto.jpg" \
  -F "exibidora=Teste" \
  -F "pontoId=123" \
  -F "tipo=entrada"
```

## 📊 Estrutura de Logs

Os logs agora seguem um padrão estruturado:

```
📤 === INICIANDO UPLOAD V6 - ERROR HANDLING IMPROVED ===
🆔 Versão: v6.0-error-handling - 2025-10-17T22:00:00Z
🕐 Timestamp: 2025-10-17T22:03:00.000Z
🔍 ETAPA 1: Verificando variáveis de ambiente...
✅ Service Account JSON válido
📧 Client email: seu-email@projeto.iam.gserviceaccount.com
📁 Folder ID configurado: 1ABC...
✅ ETAPA 1: Variáveis de ambiente OK
🔍 ETAPA 2: Processando FormData...
📋 Dados recebidos: { ... }
✅ ETAPA 2: FormData OK
...
```

**Símbolos:**
- 📤 Início de operação
- 🔍 Verificação/diagnóstico
- ✅ Sucesso
- ❌ Erro
- ⚠️ Aviso
- 📊 Dados/métricas
- 🔐 Segurança/criptografia
- 🌐 Rede/requisições

## 🔒 Segurança

### Informações Sensíveis nos Logs

O código **NÃO registra** informações sensíveis:
- ❌ Chave privada completa
- ❌ Access tokens
- ❌ Conteúdo dos arquivos

O código **REGISTRA** (seguro):
- ✅ Client email (público)
- ✅ Project ID (público)
- ✅ Tamanhos e comprimentos
- ✅ Status de operações
- ✅ Mensagens de erro

## 📚 Referências

- [Google Drive API v3](https://developers.google.com/drive/api/v3/reference)
- [Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions)
- [OAuth 2.0 JWT](https://datatracker.ietf.org/doc/html/rfc7523)

## 🆘 Suporte

Se após seguir este guia o problema persistir:

1. **Colete os logs**: Copie os logs completos do Cloudflare Pages
2. **Execute o teste**: Acesse `/api/test-upload-debug` e copie o resultado
3. **Documente o erro**: Anote a etapa que falhou e a mensagem de erro
4. **Crie uma issue**: No GitHub com os logs e informações coletadas

## 📝 Checklist de Configuração

Antes de reportar um problema, verifique:

- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` está configurada
- [ ] JSON da service account é válido (teste em jsonlint.com)
- [ ] Service account tem Google Drive API habilitada
- [ ] Pasta do Drive está compartilhada com a service account
- [ ] Service account tem permissão de "Editor" ou superior
- [ ] Se usa Shared Drive, service account tem permissão adequada
- [ ] Arquivo é menor que 100MB
- [ ] Arquivo é de um tipo permitido (imagem ou vídeo)
- [ ] Teste em `/api/test-upload-debug` retorna sucesso

## 🎯 Resumo de Melhorias v6.0

| Aspecto | Antes (v5) | Depois (v6) |
|---------|-----------|-------------|
| **Rastreamento de erro** | Genérico | Por etapa específica |
| **Validação de env** | Básica | Completa com parse |
| **Timeouts** | Nenhum | 10s/60s configurado |
| **Logs** | Moderados | Muito detalhados |
| **Mensagens de erro** | Genéricas | Específicas e acionáveis |
| **Tratamento de falhas** | Básico | Granular por operação |
| **Diagnóstico** | Difícil | Facilitado com contexto |

---

**Versão do Guia**: 1.0  
**Data**: 2025-10-17  
**Autor**: Sistema CheckingOOH  
**Compatibilidade**: v6.0-error-handling e superior
