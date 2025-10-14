# 🚀 Guia Rápido de Deploy - Checking OOH

Guia passo a passo para colocar o sistema no ar rapidamente.

## ⚡ Deploy Rápido (5 minutos)

### 1. 📂 Preparar Repositório

```bash
# Clonar ou baixar projeto
git clone https://github.com/SEU_USUARIO/checking-ooh.git
cd checking-ooh

# Ou criar do zero
mkdir checking-ooh && cd checking-ooh
git init
```

### 2. 🌐 Deploy no Cloudflare

#### Opção A: Via Dashboard (Mais Fácil)

1. **Acesse**: [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. **Selecione** seu repositório `checking-ooh`
4. **Configurações**:
   - Project name: `checking-ooh`
   - Build command: (vazio)
   - Build output: `/`
5. **Deploy**

#### Opção B: Via CLI

```bash
# Instalar Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy . --project-name=checking-ooh
```

### 3. 🔧 Configurar Variáveis

No **Cloudflare Dashboard**:
1. **Settings** → **Environment Variables** → **Production**
2. **Adicionar** (mínimo):

```
NOTION_TOKEN = secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NOTION_DATABASE_ID = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

3. **Save** → **Redeploy**

### 4. ✅ Testar

1. **Acesse**: `https://checking-ooh.pages.dev`
2. **Teste demo**: Deve carregar com dados fictícios
3. **URL teste**: `?id=12345678901234567890123456789012`

---

## 📋 Checklist de Deploy

### ✅ Pré-requisitos
- [ ] Conta GitHub
- [ ] Conta Cloudflare (gratuita)
- [ ] Workspace Notion (gratuito)
- [ ] Conta Google Cloud (créditos gratuitos)

### ✅ Notion Setup
- [ ] Integration criada
- [ ] Database configurado
- [ ] Campos corretos
- [ ] Permissões concedidas
- [ ] Token copiado

### ✅ Google Drive Setup  
- [ ] Projeto Google Cloud criado
- [ ] APIs ativadas (Drive API)
- [ ] Service Account criada
- [ ] JSON key baixado
- [ ] Pasta compartilhada

### ✅ Cloudflare Setup
- [ ] Repositório conectado
- [ ] Deploy bem-sucedido
- [ ] Variáveis configuradas
- [ ] URL funcionando

### ✅ Testes
- [ ] Modo demo funciona
- [ ] Notion conecta
- [ ] Google Drive conecta
- [ ] Upload funciona
- [ ] Câmera funciona (mobile)

---

## 🛠️ Configuração Detalhada

### 1. 📊 Notion Integration

```bash
# 1. Criar Integration
# → notion.so/my-integrations
# → New integration
# → Nome: "Checking OOH"
# → Capabilities: Read + Update

# 2. Copiar token
NOTION_TOKEN=secret_...

# 3. Compartilhar database
# → Abrir database
# → Share → Invite → Checking OOH → Can edit
```

### 2. 🔧 Google Cloud Setup

```bash
# 1. Criar projeto
# → console.cloud.google.com
# → New Project: "checking-ooh"

# 2. Ativar APIs
# → APIs & Services → Library
# → Google Drive API → Enable

# 3. Service Account
# → IAM & Admin → Service Accounts → Create
# → Nome: "checking-ooh-service"
# → Role: Editor
# → Create Key (JSON)

# 4. Configurar Drive
# → Criar pasta "CheckingOOH"
# → Share com email da service account
# → Permissão: Editor
```

### 3. ⚙️ Variáveis de Ambiente

**Mínimas (Notion + Demo)**:
```env
NOTION_TOKEN=secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Completas (Produção)**:
```env
NOTION_TOKEN=secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=1XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 🎯 URLs de Acesso

### 🔗 Formato das URLs

**Exibidora** (upload + edição):
```
https://SEU-SITE.pages.dev/?id=NOTION_ID_SEM_HIFENS
```

**Cliente** (apenas visualização):
```
https://SEU-SITE.pages.dev/?idcliente=NOTION_ID_SEM_HIFENS
```

### 📝 Fórmulas do Notion

**URL Exibidora**:
```notion
"https://checking-ooh.pages.dev/?id=" + replaceAll(id(), "-", "")
```

**URL Cliente**:
```notion
"https://checking-ooh.pages.dev/?idcliente=" + replaceAll(id(), "-", "")
```

---

## 🧪 Modo Demo

Para testar sem configurar APIs:

1. **Editar** `js/config.js`:
   ```javascript
   DEMO: {
       ENABLED: true  // Alterar para true
   }
   ```

2. **Redeploy**

3. **Testar**: URLs funcionam com dados fictícios

---

## 🔍 Troubleshooting

### ❌ Site não carrega
```bash
# Verificar build
wrangler pages deployment list

# Ver logs
wrangler pages deployment tail
```

### ❌ Notion não conecta
- ✅ Token começa com `secret_`
- ✅ Integration tem acesso ao database
- ✅ Database ID correto (32 chars)

### ❌ Google Drive falha
- ✅ Service Account JSON válido
- ✅ APIs ativadas no Google Cloud
- ✅ Pasta compartilhada
- ✅ JSON escapado corretamente

### ❌ Câmera não funciona
- ✅ HTTPS (obrigatório)
- ✅ Permissões do navegador
- ✅ Dispositivo com câmera

---

## 📞 Suporte Rápido

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

### 🔄 Redeploy Rápido

```bash
# Via CLI
wrangler pages deploy . --project-name=checking-ooh

# Via Git (automático)
git add .
git commit -m "Update config"
git push
```

---

## ✅ Deploy Checklist Final

Antes de entregar para o cliente:

- [ ] 🌐 **URL definitiva** configurada
- [ ] 📊 **Notion** database populado com pontos reais
- [ ] 🔧 **Fórmulas** das URLs funcionando
- [ ] 📱 **Teste mobile** completo
- [ ] 📸 **Câmera** testada em dispositivos
- [ ] 📤 **Upload** testado com arquivos reais
- [ ] 🗑️ **Delete** testado (modo edição)
- [ ] 👤 **Modo cliente** testado
- [ ] 📢 **Modo exibidora** testado
- [ ] 🔒 **Segurança** validada
- [ ] 📊 **Performance** verificada

**🎉 Pronto para produção!**
