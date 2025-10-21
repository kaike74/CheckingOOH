# 🏗️ Checking OOH - Sistema de Monitoramento de Painéis

Sistema completo para monitoramento de painéis de mídia externa (Out-of-Home) com upload de fotos e vídeos, integração com Notion e armazenamento no Google Drive.

> **Desenvolvido por E-MÍDIAS** • Versão 1.0 • 2025

---

## 🚀 Funcionalidades

### ✨ Para Exibidoras
- **📸 Captura de Fotos**: Usar câmera do celular direto no site
- **📤 Upload de Arquivos**: Enviar fotos e vídeos (até 100MB)
- **📥📤 Seções Entrada/Saída**: Organização por tipo de evento
- **✏️ Modo Edição**: Deletar arquivos desnecessários
- **👁️ Visualização**: Modal para ver todas as fotos/vídeos
- **📁 Organização Automática**: Pastas criadas automaticamente no Drive

### 👤 Para Clientes
- **🔍 Visualização**: Ver apenas fotos do seu ponto específico
- **📱 Interface Simplificada**: Apenas visualização, sem edição
- **🔒 Acesso Restrito**: Cada cliente vê apenas seus pontos

### 🔧 Técnicas
- **🌐 Cloudflare Pages**: Deploy serverless automático
- **📱 Responsivo**: Interface otimizada para mobile
- **🧪 Modo Demo**: Teste sem configurar APIs
- **🔄 Multi-Campanha**: Funciona com múltiplas tabelas do Notion
- **🎨 Identidade E-MÍDIAS**: Visual profissional

---

## 📋 Estrutura do Projeto

```
checking-ooh/
├── index.html                  # Página principal
├── style.css                   # Estilos E-MÍDIAS
├── js/
│   ├── config.js              # Configurações (AJUSTADO)
│   ├── notion-api.js          # Integração Notion
│   ├── drive-api.js           # Integração Google Drive
│   ├── camera.js              # Gerenciamento câmera
│   ├── upload.js              # Sistema upload
│   └── main.js                # Script principal (AJUSTADO)
├── functions/api/
│   ├── notion-data.js         # API Notion (AJUSTADO)
│   ├── drive-upload.js        # Upload Google Drive
│   ├── drive-list.js          # Listar arquivos
│   └── drive-delete.js        # Deletar arquivos
├── wrangler.toml              # Config Cloudflare
├── package.json               # Dependências
├── _headers                   # Headers CORS
├── .gitignore                 # Arquivos ignorados
└── README.md                  # Esta documentação
```

---

## 🗄️ Estrutura do Notion

### 📊 Campos do Database

Cada **tabela do Notion** = uma **campanha diferente**.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| **Endereço** | Title | ✅ | Local do painel (ex: "Av. Paulista, 1000") |
| **Exibidora** | Select | ✅ | Nome da empresa exibidora |
| **URL Exibidora** | Formula | ✅ | Gerada automaticamente |
| **URL Cliente** | Formula | ✅ | Gerada automaticamente |

**Campos Opcionais**:
- Valor (Number)
- Período (Text)
- Observações (Text)

### 🎯 Fórmulas das URLs

**URL Exibidora** (mostra todos os pontos da exibidora):
```notion
"https://checking.emidiastec.com.br/?id=" + replaceAll(id(), "-", "")
```

**URL Cliente** (mostra apenas aquele ponto):
```notion
"https://checking.emidiastec.com.br/?idcliente=" + replaceAll(id(), "-", "")
```

### 🏗️ Exemplo de Estrutura Multi-Campanhas

```
📊 Notion Workspace
├── 📋 Campanha Coca-Cola Verão 2025
│   ├── Av. Paulista, 1000 (Exibidora A)
│   ├── Rua Augusta, 500 (Exibidora A) 
│   └── Av. Faria Lima, 2000 (Exibidora B)
├── 📋 Campanha Nike Black Friday
│   ├── Shopping Norte (Exibidora C)
│   └── Aeroporto Internacional (Exibidora A)
└── 📋 Campanha McDonald's
    └── Estação Metrô Sé (Exibidora D)
```

**Como funciona**:
1. Sistema detecta o ID na URL
2. Busca esse registro no Notion
3. Identifica qual tabela/campanha pertence
4. Verifica o campo "Exibidora"
5. **Modo Exibidora**: busca todos pontos da mesma exibidora na mesma campanha
6. **Modo Cliente**: mostra apenas aquele ponto específico

---

## 🛠️ Instalação Passo a Passo

### 1. 📂 Criar Repositório no GitHub

```bash
# Criar pasta do projeto
mkdir checking-ooh
cd checking-ooh

# Inicializar git
git init

# Adicionar arquivos (copie todos os arquivos dos artefatos)
git add .
git commit -m "Initial commit - Checking OOH v1.0"

# Conectar ao GitHub
git remote add origin https://github.com/SEU_USUARIO/checking-ooh.git
git branch -M main
git push -u origin main
```

### 2. 📊 Configurar Notion

#### a) Criar Integration

1. Acesse [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Clique **+ New integration**
3. Configure:
   - **Name**: Checking OOH
   - **Associated workspace**: Seu workspace
   - **Capabilities**: ✅ Read content, ✅ Update content
4. Copie o **Internal Integration Token** (começa com `secret_`)

#### b) Configurar Database

1. Abra seu database de campanha no Notion
2. Adicione os campos se não existirem:
   - **Endereço** (Title) - já existe!
   - **Exibidora** (Select) - já existe!
   - **URL Exibidora** (Formula)
   - **URL Cliente** (Formula)

3. **Compartilhar Database com a Integration**:
   - Clique em **Share** (canto superior direito)
   - Clique em **Invite**
   - Adicione "Checking OOH"
   - Permissão: **Can edit**

4. **Adicionar Fórmulas** nos campos URL:

**URL Exibidora**:
```notion
"https://checking.emidiastec.com.br/?id=" + replaceAll(id(), "-", "")
```

**URL Cliente**:
```notion
"https://checking.emidiastec.com.br/?idcliente=" + replaceAll(id(), "-", "")
```

### 3. 🔧 Configurar Google Drive API

#### Opção A: Service Account (Recomendado)

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto: **"checking-ooh"**
3. Ative as APIs:
   - **Google Drive API**

4. **Criar Service Account**:
   - **IAM & Admin** > **Service Accounts**
   - **+ Create Service Account**
   - Nome: `checking-ooh-service`
   - Role: **Editor**
   - **Create and Continue** > **Done**

5. **Gerar Chave JSON**:
   - Clique na service account criada
   - **Keys** > **Add Key** > **Create New Key**
   - Tipo: **JSON**
   - Baixe o arquivo JSON

6. **Configurar Google Drive**:
   - Abra o arquivo JSON baixado
   - Copie o email da service account (campo `client_email`)
   - No Google Drive, crie uma pasta **"CheckingOOH"**
   - Compartilhe a pasta com o email da service account
   - Permissão: **Editor**
   - Copie o ID da pasta (parte da URL)

### 4. 🚀 Deploy no Cloudflare Pages

#### Via Dashboard (Recomendado)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** > **Create** > **Pages** > **Connect to Git**
3. Selecione seu repositório `checking-ooh`
4. Configurações:
   - **Project name**: `checking-ooh`
   - **Production branch**: `main`
   - **Build command**: (deixe vazio)
   - **Build output directory**: `/`
5. **Save and Deploy**

#### Via CLI

```bash
# Instalar Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy . --project-name=checking-ooh
```

### 5. ⚙️ Configurar Variáveis de Ambiente

No dashboard do Cloudflare Pages:

1. **Settings** > **Environment Variables**
2. Aba **Production**
3. **Adicionar variáveis**:

```env
NOTION_TOKEN
secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

GOOGLE_SERVICE_ACCOUNT_KEY
{"type":"service_account","project_id":"checking-ooh",...}

GOOGLE_DRIVE_FOLDER_ID
1XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

> ⚠️ **IMPORTANTE**: 
> - Cole o **conteúdo completo** do arquivo JSON da service account em `GOOGLE_SERVICE_ACCOUNT_KEY`
> - O `GOOGLE_DRIVE_FOLDER_ID` é opcional (padrão é 'root')

4. **Save**
5. **Redeploy** o projeto

### 6. 🧪 Testar o Sistema

#### Modo Demo (Teste Local)

1. Edite `js/config.js`:
```javascript
DEMO: {
    ENABLED: true  // ← Deixe true
}
```

2. Abra `index.html` no navegador
3. URLs de teste:
   - `?id=12345678901234567890123456789012`
   - `?idcliente=12345678901234567890123456789012`

#### Modo Produção (Dados Reais)

1. Edite `js/config.js`:
```javascript
DEMO: {
    ENABLED: false  // ← Altere para false
}
```

2. Faça deploy novamente
3. Acesse as URLs geradas no Notion

#### 🔍 Como Testar e Debugar (v7.0)

**Teste local com Wrangler**:
```bash
# Criar arquivo .dev.vars com variáveis de ambiente
echo 'NOTION_TOKEN=seu_token' > .dev.vars
echo 'GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}' >> .dev.vars

# Rodar servidor local
npm run dev

# Acessar http://localhost:8788?id=SEU_PONTO_ID
```

**Verificar logs detalhados**:

**Frontend (Console do navegador)**:
- Abra DevTools (F12)
- Aba Console
- Procure por logs com emojis: 📤 📁 ✅ ❌
- Verifique se `databaseId` é passado corretamente
- Confirme que evento `onchange` dispara ao selecionar arquivo

**Backend (Terminal do Wrangler ou Cloudflare Logs)**:
```bash
# Ver logs em tempo real durante desenvolvimento
wrangler pages deployment tail

# Ou no Cloudflare Dashboard: Analytics > Logs
```

Procure por:
- ✅ `Token de acesso obtido com sucesso`
- 🔍 `ESTRATÉGIA 1: Buscando pasta CheckingOOH diretamente`
- ✅ `Pasta "CheckingOOH" encontrada`
- 📤 `Arquivo selecionado`
- ✅ `Upload concluído`

**Checklist de Debug**:
- [ ] ✅ Variáveis de ambiente configuradas no Cloudflare?
- [ ] ✅ Tabela do Notion compartilhada com a integração?
- [ ] ✅ Service Account tem acesso ao Google Drive?
- [ ] ✅ Pasta "CheckingOOH" existe e está compartilhada?
- [ ] ✅ Formato do JSON da Service Account está correto?
- [ ] ✅ Console mostra logs de upload ao selecionar arquivo?
- [ ] ✅ Backend mostra busca de pasta em 2 estratégias?

---

## 🔄 Correções Implementadas (v7.0 - Janeiro 2025)

### Problema Resolvido
O sistema travava na mensagem "Carregando dados e conectando com Google Drive..." porque:
1. Buscava primeiro "REDE COMPARTILHADA E-RÁDIOS" que nem sempre existia
2. Não tinha fallback robusto para buscar "CheckingOOH" diretamente
3. Input de arquivo não disparava upload ao selecionar arquivos

### Mudanças Implementadas

#### 🔧 Backend (functions/api/drive-list.js)
- ✅ **Ordem de busca invertida**: Agora busca "CheckingOOH" PRIMEIRO em My Drive e Shared Drives
- ✅ **Fallback robusto**: Se não encontrar, tenta "REDE COMPARTILHADA E-RÁDIOS" > "CheckingOOH"
- ✅ **Busca inteligente**: Prioriza Shared Drives quando múltiplas pastas são encontradas
- ✅ **Logs detalhados**: Cada etapa registrada com emojis e mensagens em português
- ✅ **Função reutilizável**: `buildFolderStructure()` para construir caminho de pastas

#### 🔧 Backend (functions/api/drive-upload.js)
- ✅ **Mesma lógica de busca**: Alinhado com drive-list.js
- ✅ **Uso correto do databaseId**: Usa o ID recebido do frontend (não gera novo)
- ✅ **Logs de erro melhorados**: Stack trace completo em falhas
- ✅ **Versão atualizada**: V7 com ordem de busca corrigida

#### 🎨 Frontend (js/upload.js)
- ✅ **Evento onchange adicionado**: Input de arquivo agora dispara upload ao selecionar
- ✅ **Logs detalhados**: Console mostra cada arquivo selecionado e validado
- ✅ **Contexto de upload**: Logs mostram exibidora, pontoId, tipo e databaseId

#### 🎨 Frontend (js/drive-api.js)
- ✅ **Logs de API**: Registra cada etapa do upload (validação, FormData, requisição, resposta)
- ✅ **Rastreamento de erros**: Mensagens claras em cada ponto de falha

### Estrutura de Pastas Atualizada

**Busca Prioritária** (Estratégia 1):
```
My Drive ou Shared Drives
└── CheckingOOH/                    ← Procurado PRIMEIRO
    ├── [Exibidora]/
    │   ├── [Database ID]/
    │   │   ├── Entrada/
    │   │   └── Saida/
```

**Fallback** (Estratégia 2):
```
Shared Drive: REDE COMPARTILHADA E-RÁDIOS/
└── CheckingOOH/                    ← Fallback se Estratégia 1 falhar
    ├── [Exibidora]/
    │   ├── [Database ID]/
    │   │   ├── Entrada/
    │   │   └── Saida/
```

---

## 📖 Como Usar

### 🔗 Compartilhar Links

#### Para Exibidoras
Copie a **URL Exibidora** do Notion e envie por email junto com o contrato.

Exemplo de email:
```
Assunto: Contrato e Sistema de Checking - Campanha X

Olá [Exibidora],

Segue o contrato da campanha em anexo.

Para fazer o upload das fotos de ENTRADA e SAÍDA dos painéis,
acesse o link abaixo:

[URL Exibidora do Notion]

Obrigado!
```

#### Para Clientes
O cliente acessa direto da proposta no Notion clicando na **URL Cliente**.

### 📱 Fluxo da Exibidora

1. **Acesso**: Clica no link recebido por email
2. **Visualização**: Vê todos os pontos da empresa
3. **Expansão**: Clica na seta ▼ para expandir um ponto
4. **Upload**: 
   - 📷 **Tirar Foto**: Usa câmera do celular
   - 📁 **Upload**: Seleciona arquivos da galeria
5. **Organização**: 
   - 📥 **Entrada**: Quando cola o painel
   - 📤 **Saída**: Quando remove o painel
6. **Edição**: Ativa modo edição para deletar fotos
7. **Visualização**: Clica "Ver Fotos" para modal completo

### 👤 Fluxo do Cliente

1. **Acesso**: Clica no link da proposta
2. **Visualização**: Vê apenas seu ponto específico
3. **Fotos**: Vê fotos de entrada e saída automaticamente
4. **Modal**: Clica nas fotos para visualização ampliada

### 📁 Organização Automática no Google Drive

O sistema cria automaticamente:
```
📂 CheckingOOH/
├── 📂 Exibidora Central/
│   ├── 📂 Entrada/
│   │   ├── entrada_12345...012_2025-01-14T10-30-00.jpg
│   │   └── entrada_12345...012_2025-01-14T10-35-00.mp4
│   └── 📂 Saida/
│       ├── saida_12345...012_2025-02-14T16-20-00.jpg
│       └── saida_12345...012_2025-02-14T16-25-00.jpg
└── 📂 Exibidora Norte/
    ├── 📂 Entrada/
    └── 📂 Saida/
```

---

## 🎨 Personalização

### Cores e Logo

Edite `style.css`:
```css
:root {
    --emidias-primary: #06055B;    /* Azul E-MÍDIAS */
    --emidias-magenta: #FC1E75;    /* Magenta */
    --emidias-rosa: #D71E97;       /* Rosa */
    --emidias-roxo: #AA1EA5;       /* Roxo */
}
```

Para alterar o logo, edite `index.html`:
```html
<img src="SUA_URL_DO_LOGO" alt="Logo" class="top-logo">
```

### Campos do Notion

Edite `js/config.js`:
```javascript
FIELDS: {
    EXIBIDORA: 'Exibidora',     // Ajuste se nome diferente
    ENDERECO: 'Endereço',       // Ajuste se nome diferente
    URL_EXIBIDORA: 'URL Exibidora',
    URL_CLIENTE: 'URL Cliente'
}
```

### Câmera

Edite `js/config.js`:
```javascript
CAMERA: {
    VIDEO_CONSTRAINTS: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'  // 'user' para câmera frontal
    },
    PHOTO_QUALITY: 0.8,          // 0.1 - 1.0
    PHOTO_FORMAT: 'image/jpeg'    // ou 'image/png'
}
```

### Upload

Edite `js/config.js`:
```javascript
DRIVE: {
    MAX_FILE_SIZE: 100 * 1024 * 1024,  // 100MB
    MAX_FILES_PER_UPLOAD: 5,           // Máx arquivos por vez
    ALLOWED_TYPES: [
        'image/jpeg', 'image/png',
        'video/mp4', 'video/mov'
    ]
}
```

---

## 🐛 Troubleshooting

### ❌ Erro: "Token do Notion não configurado"

**Solução**:
1. Verifique se `NOTION_TOKEN` está no Cloudflare
2. Token deve começar com `secret_`
3. Verifique se a integration tem acesso ao database

### ❌ Erro: "Credenciais do Google Drive não configuradas"

**Solução**:
1. Configure `GOOGLE_SERVICE_ACCOUNT_KEY`
2. Verifique se a service account tem acesso à pasta
3. Confirme se as APIs estão ativadas no Google Cloud

### ❌ Erro: "Ponto não encontrado"

**Solução**:
1. Verifique se o ID na URL está correto (32 caracteres hex)
2. Confirme se o registro existe no Notion
3. Verifique se a integration tem acesso ao database

### 📷 Câmera não funciona

**Possíveis causas**:
1. **HTTPS obrigatório**: Câmera só funciona em HTTPS
2. **Permissões**: Usuário negou acesso à câmera
3. **Navegador**: Alguns navegadores bloqueiam câmera
4. **Dispositivo**: Sem câmera disponível

### 📤 Upload falha

**Possíveis causas**:
1. **Tamanho**: Arquivo maior que 100MB
2. **Tipo**: Formato não permitido
3. **Permissões**: Service account sem acesso
4. **Rede**: Conexão instável

---

## 🔒 Segurança

### 🛡️ Boas Práticas Implementadas

✅ **CORS Configurado**: Apenas origens permitidas
✅ **Headers de Segurança**: X-Frame-Options, etc.
✅ **Validação de Arquivos**: Tipo e tamanho
✅ **Service Account**: Acesso limitado ao Google Drive
✅ **Tokens Seguros**: Armazenados em variáveis de ambiente

### 🔐 Recomendações

1. **Notion**: Só dê acesso necessário à integration
2. **Google Drive**: Use service account, não sua conta pessoal
3. **URLs**: Não compartilhe IDs publicamente
4. **Backup**: Faça backup do database Notion
5. **Monitoramento**: Acompanhe logs de acesso

---

## 📞 Suporte

### 🆘 Problemas Comuns

1. **"Token não configurado"** → Verificar variáveis ambiente
2. **"Database não encontrado"** → Verificar permissões Notion
3. **"Upload falha"** → Verificar Google Cloud setup
4. **"Site não carrega"** → Verificar build logs

### 📊 Logs e Debug

```bash
# Ver logs em tempo real
wrangler pages deployment tail

# Status do deployment
wrangler pages deployment list

# Testar functions localmente
wrangler pages dev .
```

---

## 📝 Changelog

### [1.0.0] - 2025-01-14

✨ **Primeira versão estável**
- Sistema completo de monitoramento OOH
- Integração Notion + Google Drive
- Modo Exibidora e Cliente
- Upload de fotos/vídeos
- Captura via câmera
- Suporte multi-campanhas
- Identidade visual E-MÍDIAS

---

## 📄 Licença

MIT License - © 2025 E-MÍDIAS

---

**Desenvolvido com ❤️ por E-MÍDIAS** 

🌐 Website: [emidias.com.br](https://emidias.com.br)
📧 Email: contato@emidias.com.br
🐙 GitHub: [github.com/emidias](https://github.com/emidias)
