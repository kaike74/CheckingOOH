# 🧪 Guia de Testes - CheckingOOH v7.0

## 📋 Resumo das Correções

Este documento descreve as correções implementadas na versão 7.0 e como testá-las.

### 🐛 Problemas Corrigidos

1. **Sistema travava em "Carregando dados..."**
   - Causa: Buscava primeiro "REDE COMPARTILHADA E-RÁDIOS" que nem sempre existia
   - Solução: Inverte ordem de busca para procurar "CheckingOOH" primeiro

2. **Upload não funcionava ao selecionar arquivo**
   - Causa: Input de arquivo não tinha evento `onchange` configurado
   - Solução: Adicionado listener que dispara upload ao selecionar arquivo

3. **Falta de logs detalhados**
   - Causa: Logs insuficientes para debug
   - Solução: Logs detalhados em cada etapa (frontend e backend)

---

## 🔍 Estratégia de Busca de Pastas (v7.0)

### Estratégia 1 (Prioritária)
```
Busca "CheckingOOH" diretamente em:
- My Drive
- Shared Drives (com prioridade se múltiplas forem encontradas)

Caminho: CheckingOOH/[Exibidora]/[DatabaseID]/[Entrada|Saida]
```

### Estratégia 2 (Fallback)
```
Se Estratégia 1 falhar:
1. Busca "REDE COMPARTILHADA E-RÁDIOS"
2. Busca "CheckingOOH" dentro dela

Caminho: REDE COMPARTILHADA E-RÁDIOS/CheckingOOH/[Exibidora]/[DatabaseID]/[Entrada|Saida]
```

---

## 🧪 Como Testar

### Pré-requisitos

1. **Variáveis de ambiente configuradas** no Cloudflare Pages:
   - `NOTION_TOKEN`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`

2. **Pasta CheckingOOH criada** no Google Drive:
   - Opção 1: Criar em "My Drive"
   - Opção 2: Criar em "Shared Drive"
   - Opção 3: Criar em "REDE COMPARTILHADA E-RÁDIOS"

3. **Service Account com acesso** à pasta CheckingOOH

### Teste 1: Verificar Listagem de Arquivos

**Objetivo**: Confirmar que a página carrega e lista arquivos existentes

**Passos**:
1. Abrir URL da exibidora (do Notion)
2. Aguardar carregamento
3. Verificar se spinner desaparece
4. Verificar se seções Entrada/Saída aparecem

**Logs Esperados (Console do Navegador)**:
```
ℹ️ [CheckingOOH] Carregando dados da exibidora { pontoId: "..." }
✅ [CheckingOOH] Database ID da campanha: [UUID]
ℹ️ [CheckingOOH] Listando arquivos do Google Drive
✅ [CheckingOOH] Arquivos listados { count: X }
```

**Logs Esperados (Cloudflare/Backend)**:
```
🔑 Iniciando obtenção de token de acesso...
✅ Service Account Key encontrada, gerando token...
✅ Token de acesso obtido com sucesso
🔍 ESTRATÉGIA 1: Buscando pasta CheckingOOH diretamente em My Drive e Shared Drives...
✅ Pasta "CheckingOOH" encontrada (total: X): [ID]
✅ ESTRATÉGIA 1 OK: Pasta CheckingOOH encontrada diretamente: [ID]
🏗️ Construindo estrutura de pastas a partir de CheckingOOH...
✅ ETAPA 1 OK: Pasta da exibidora encontrada: [ID]
✅ ETAPA 2 OK: Pasta da campanha encontrada: [ID]
✅ ETAPA 3 OK: Pasta do tipo encontrada: [ID]
🎉 SUCESSO! Caminho encontrado via busca direta de CheckingOOH
```

**Resultado Esperado**:
- ✅ Spinner desaparece em menos de 5 segundos
- ✅ Seções Entrada e Saída aparecem
- ✅ Arquivos existentes são listados (ou mensagem "Nenhum arquivo")

### Teste 2: Verificar Upload de Arquivo

**Objetivo**: Confirmar que upload funciona ao selecionar arquivo

**Passos**:
1. Clicar em "📁 Upload" em uma das seções (Entrada ou Saída)
2. Modal de upload abre
3. Clicar em "📁 Selecionar Arquivos"
4. Escolher uma imagem ou vídeo
5. Aguardar upload

**Logs Esperados (Console do Navegador)**:
```
📁 === PROCESSANDO ARQUIVOS SELECIONADOS ===
📁 Quantidade de arquivos: 1
📄 Arquivo 1: { name: "foto.jpg", size: 123456, type: "image/jpeg" }
✅ Arquivo válido: foto.jpg
✅ 1 arquivo(s) válido(s), iniciando upload...
🚀 === INICIANDO PROCESSO DE UPLOAD ===
📤 Contexto do upload: { exibidora: "...", pontoId: "...", tipo: "entrada", databaseId: "..." }
📤 === DRIVE API: INICIANDO UPLOAD ===
📤 Parâmetros: { fileName: "foto.jpg", ... }
✅ Arquivo válido
📦 FormData criado com sucesso
📤 Enviando requisição para /api/drive-upload...
📥 Resposta recebida: { status: 200, ok: true }
✅ Upload concluído com sucesso
```

**Logs Esperados (Cloudflare/Backend)**:
```
📤 === INICIANDO UPLOAD V7 - ORDEM DE BUSCA CORRIGIDA ===
🔍 ETAPA 1: Validando variáveis de ambiente...
✅ ETAPA 1: Variáveis de ambiente OK
🔍 ETAPA 2: Processando FormData...
📝 Dados recebidos: { fileName: "foto.jpg", fileSize: 123456, exibidora: "...", pontoId: "...", tipo: "entrada", databaseId: "..." }
✅ ETAPA 2: FormData OK
🔍 ETAPA 4: Obtendo token do Google...
✅ ETAPA 4: Token obtido com sucesso
🔍 ETAPA 5: Iniciando upload...
📝 Database ID da campanha: [UUID]
📁 Criando estrutura de pastas...
🔍 ESTRATÉGIA 1: Buscando pasta CheckingOOH diretamente...
✅ ESTRATÉGIA 1 OK: Pasta CheckingOOH encontrada diretamente: [ID]
🏗️ Construindo estrutura para upload...
✅ ETAPA 1 OK: Pasta da exibidora: [ID]
✅ ETAPA 2 OK: Pasta da campanha: [ID]
✅ ETAPA 3 OK: Pasta do tipo: [ID]
📤 Fazendo upload do arquivo...
✅ Arquivo enviado com sucesso!
✅ ETAPA 5: Upload concluído
🎉 === UPLOAD V7 CONCLUÍDO COM SUCESSO ===
```

**Resultado Esperado**:
- ✅ Modal fecha automaticamente após upload
- ✅ Mensagem de sucesso aparece no canto superior direito
- ✅ Arquivo aparece na lista
- ✅ Arquivo é criado no Google Drive na pasta correta

### Teste 3: Verificar Fallback

**Objetivo**: Confirmar que fallback funciona se "CheckingOOH" não estiver no root

**Preparação**:
1. Remover/renomear pasta "CheckingOOH" do My Drive
2. Criar estrutura: "REDE COMPARTILHADA E-RÁDIOS" > "CheckingOOH"

**Passos**:
1. Abrir URL da exibidora
2. Aguardar carregamento

**Logs Esperados (Cloudflare/Backend)**:
```
🔍 ESTRATÉGIA 1: Buscando pasta CheckingOOH diretamente...
❌ Pasta "CheckingOOH" NÃO encontrada em nenhum drive
⚠️ ESTRATÉGIA 1 falhou, tentando ESTRATÉGIA 2...
🔍 ESTRATÉGIA 2 (FALLBACK): Buscando pasta REDE COMPARTILHADA E-RÁDIOS...
✅ ESTRATÉGIA 2: Pasta REDE encontrada: [ID]
🔍 Buscando pasta CheckingOOH dentro de REDE COMPARTILHADA...
✅ Pasta CheckingOOH encontrada: [ID]
🏗️ Construindo estrutura de pastas...
🎉 SUCESSO! Caminho encontrado via REDE COMPARTILHADA E-RÁDIOS
```

**Resultado Esperado**:
- ✅ Sistema funciona normalmente usando caminho alternativo

---

## ❌ Cenários de Erro

### Erro 1: Pasta CheckingOOH não encontrada

**Logs**:
```
❌ ESTRATÉGIA 1 falhou, tentando ESTRATÉGIA 2...
❌ ESTRATÉGIA 2 falhou: Pasta REDE COMPARTILHADA E-RÁDIOS não encontrada
❌ Todas as estratégias falharam. Retornando null.
```

**Solução**:
1. Criar pasta "CheckingOOH" no My Drive ou Shared Drive
2. Compartilhar com email da Service Account
3. Ou criar "REDE COMPARTILHADA E-RÁDIOS" > "CheckingOOH"

### Erro 2: Service Account sem acesso

**Logs**:
```
❌ Erro HTTP ao buscar pasta: 403 - Forbidden
```

**Solução**:
1. Compartilhar pasta com email da Service Account
2. Permissão mínima: "Editor"

### Erro 3: Token inválido

**Logs**:
```
❌ Erro ao obter token de acesso: Error: OAuth2 falhou (401): ...
```

**Solução**:
1. Verificar `GOOGLE_SERVICE_ACCOUNT_KEY` no Cloudflare
2. Confirmar que JSON está completo
3. Verificar se Service Account está ativa no Google Cloud

---

## 📊 Checklist Completo de Validação

### Backend
- [ ] Token obtido com sucesso
- [ ] Estratégia 1 tenta buscar CheckingOOH diretamente
- [ ] Se falhar, Estratégia 2 tenta REDE COMPARTILHADA
- [ ] Estrutura de pastas é construída corretamente
- [ ] Upload recebe databaseId do frontend (não gera novo)
- [ ] Arquivo é enviado para pasta correta no Drive

### Frontend
- [ ] Página carrega sem erros de console
- [ ] Spinner desaparece após carregar dados
- [ ] Ao clicar "Upload", modal abre
- [ ] Ao selecionar arquivo, logs aparecem no console
- [ ] Evento onchange dispara processamento
- [ ] FormData é criado com todos os campos
- [ ] Requisição é enviada para /api/drive-upload
- [ ] Resposta é processada corretamente
- [ ] Modal fecha e mensagem de sucesso aparece
- [ ] Lista de arquivos é atualizada

### Google Drive
- [ ] Estrutura de pastas é criada automaticamente
- [ ] Arquivo aparece na pasta correta
- [ ] Nome do arquivo segue padrão: `[tipo]_[pontoId]_[timestamp].[ext]`

---

## 🔄 Rollback

Se houver problemas, você pode reverter para versão anterior:

```bash
git revert [commit-hash]
git push
```

Ou fazer deploy manual da branch anterior no Cloudflare Pages.

---

## 📞 Suporte

Em caso de problemas:

1. **Verificar logs** no Cloudflare Dashboard (Analytics > Logs)
2. **Verificar console** do navegador (F12)
3. **Confirmar variáveis** de ambiente
4. **Testar com modo demo** ativado (DEMO.ENABLED = true)

## 📝 Notas da Versão

**v7.0 - Janeiro 2025**
- ✅ Ordem de busca invertida (CheckingOOH primeiro)
- ✅ Fallback robusto implementado
- ✅ Evento onchange adicionado ao input de arquivo
- ✅ Logs detalhados em português
- ✅ Correção do uso de databaseId
- ✅ Documentação atualizada
