# 🔧 Correção: Suporte Completo para Google Shared Drives

## 🎯 Problema Identificado

O sistema não estava conseguindo fazer upload de arquivos no Google Drive quando a pasta configurada (`GOOGLE_DRIVE_FOLDER_ID`) estava em um **Shared Drive** (Drive Compartilhado).

### Causa Raiz

As funções `drive-list.js` e `drive-delete.js` não incluíam os parâmetros necessários para trabalhar com Shared Drives nas chamadas à API do Google Drive:
- `supportsAllDrives=true`
- `includeItemsFromAllDrives=true`

Apenas a função `drive-upload.js` havia sido atualizada com esses parâmetros, causando inconsistência.

## ✅ Solução Implementada

### Arquivos Modificados

#### 1. `functions/api/drive-list.js`
- ✅ Adicionado `supportsAllDrives=true&includeItemsFromAllDrives=true` na listagem de arquivos
- ✅ Adicionado `supportsAllDrives=true&includeItemsFromAllDrives=true` na busca de pastas

#### 2. `functions/api/drive-delete.js`
- ✅ Adicionado `supportsAllDrives=true` na exclusão de arquivos
- ✅ Adicionado `supportsAllDrives=true` na obtenção de informações do arquivo
- ✅ Adicionado `supportsAllDrives=true&includeItemsFromAllDrives=true` na busca de pastas de log
- ✅ Adicionado `supportsAllDrives=true` na criação de pastas de log
- ✅ Adicionado `supportsAllDrives=true` no upload de arquivos de log
- ✅ Adicionado `supportsAllDrives=true` na verificação de permissões

#### 3. `functions/api/test-upload.js`
- ✅ Atualizado número da versão para `v5.1-shared-drive-complete`
- ✅ Atualizada mensagem de status

## 🔍 Detalhes Técnicos

### O que são Shared Drives?

Shared Drives (anteriormente chamados de Team Drives) são drives compartilhados do Google Workspace onde:
- Os arquivos pertencem ao drive, não a usuários individuais
- Requerem parâmetros especiais nas chamadas da API
- Precisam de permissões específicas na Service Account

### Parâmetros Adicionados

```javascript
// Em todas as chamadas à API do Google Drive:

// Para listagem e busca
supportsAllDrives=true&includeItemsFromAllDrives=true

// Para operações individuais (get, delete, update)
supportsAllDrives=true
```

### Exemplo de Chamada Corrigida

**ANTES:**
```javascript
fetch('https://www.googleapis.com/drive/v3/files?q=...')
```

**DEPOIS:**
```javascript
fetch('https://www.googleapis.com/drive/v3/files?q=...&supportsAllDrives=true&includeItemsFromAllDrives=true')
```

## 📝 Checklist de Verificação

- [x] Todas as chamadas de listagem incluem `supportsAllDrives=true&includeItemsFromAllDrives=true`
- [x] Todas as chamadas de exclusão incluem `supportsAllDrives=true`
- [x] Todas as chamadas de busca de pastas incluem os parâmetros corretos
- [x] Todas as chamadas de criação de pastas incluem `supportsAllDrives=true`
- [x] Consistência entre drive-upload.js, drive-list.js e drive-delete.js

## 🧪 Como Testar

### 1. Testar Upload
```bash
curl https://checkingooh.emidiastec.com.br/api/test-upload
```

### 2. Verificar Environment
```bash
curl https://checkingooh.emidiastec.com.br/api/debug-env
```

### 3. Testar Upload Real
- Acesse o sistema com uma URL válida
- Tente fazer upload de uma imagem
- Verifique se o arquivo aparece no Google Drive
- Verifique se o arquivo é listado no sistema
- Tente deletar o arquivo

## 📋 Requisitos de Configuração

Para que o upload funcione corretamente em Shared Drives:

1. **Service Account deve ter acesso ao Shared Drive:**
   - Abra o Shared Drive no Google Drive
   - Clique em "Gerenciar membros"
   - Adicione o email da Service Account (do arquivo JSON)
   - Permissão mínima: "Editor de conteúdo"

2. **Variáveis de ambiente configuradas no Cloudflare:**
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: JSON completo da service account
   - `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta raiz (pode estar no Shared Drive)
   - `NOTION_TOKEN`: Token de integração do Notion

3. **Estrutura de pastas:**
   ```
   Shared Drive ou My Drive
   └── CheckingOOH/  (ou pasta configurada em GOOGLE_DRIVE_FOLDER_ID)
       ├── ExibidoraA/
       │   ├── Entrada/
       │   └── Saida/
       └── ExibidoraB/
           ├── Entrada/
           └── Saida/
   ```

## 🚀 Próximos Passos

Após o deploy desta correção:

1. Verifique se a Service Account tem acesso ao Shared Drive
2. Teste o upload de um arquivo
3. Verifique se o arquivo aparece no Drive e no sistema
4. Teste a exclusão de um arquivo
5. Monitore os logs do Cloudflare para qualquer erro

## 📚 Referências

- [Google Drive API - Shared Drives](https://developers.google.com/drive/api/guides/enable-shareddrives)
- [Google Drive API - Files: list](https://developers.google.com/drive/api/reference/rest/v3/files/list)
- [Google Drive API - Files: delete](https://developers.google.com/drive/api/reference/rest/v3/files/delete)

## 🔗 Commits Relacionados

- `3775aba`: Add shared drive support to drive-list and drive-delete APIs
- `301aa4f`: Update Google Drive upload function for shared drives

---

**Data da correção:** 2025-10-17  
**Versão:** v5.1-shared-drive-complete
