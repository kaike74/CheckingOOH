# 🏗️ Checking OOH - Sistema de Monitoramento de Painéis

Sistema completo para monitoramento de painéis de mídia externa (Out-of-Home) com upload de fotos e vídeos, integração com Notion e armazenamento no Google Drive.

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
- **🌐 PWA Ready**: Funciona como app no celular
- **📱 Responsivo**: Interface otimizada para mobile
- **🧪 Modo Demo**: Teste sem configurar APIs
- **🔄 Tempo Real**: Atualizações automáticas
- **🎨 Identidade E-MÍDIAS**: Visual profissional

## 📋 Estrutura do Projeto

```
checking-ooh/
├── index.html              # Página principal
├── style.css               # Estilos com identidade E-MÍDIAS
├── js/
│   ├── config.js           # Configurações e variáveis
│   ├── notion-api.js       # Integração com Notion
│   ├── drive-api.js        # Integração com Google Drive
│   ├── camera.js           # Gerenciamento da câmera
│   ├── upload.js           # Sistema de upload
│   └── main.js             # Script principal
├── functions/api/
│   ├── notion-data.js      # Cloudflare Function - Notion
│   ├── drive-upload.js     # Cloudflare Function - Upload Drive
│   ├── drive-list.js       # Cloudflare Function - Listar Drive
│   └── drive-delete.js     # Cloudflare Function - Deletar Drive
├── wrangler.toml           # Configuração Cloudflare Pages
├── package.json            # Dependências
├── _headers                # Configuração CORS
└── README.md               # Esta documentação
```

## 🛠️ Instalação e Configuração

### 1. 📂 Criar Repositório no GitHub

```bash
# Criar pasta do projeto
mkdir checking-ooh
cd checking-ooh

# Inicializar git
git init

# Criar todos os arquivos (copie o conteúdo dos artifacts)
# - index.html
# - style.css
# - js/config.js
# - js/notion-api.js
# - js/drive-api.js
# - js/camera.js
# - js/upload.js
# - js/main.js
# - functions/api/notion-data.js
# - functions/api/drive-upload.js
# - functions/api/drive-list.js
# - functions/api/drive-delete.js
# - wrangler.toml
# - package.json
# - _headers
# - README.md

# Criar estrutura de pastas
mkdir -p js functions/api

# Adicionar ao git
git add .
git commit -m "Initial commit - Checking OOH v1.0"

# Conectar ao GitHub
git remote add origin https://github.com/SEU_USUARIO/checking-ooh.git
git branch -M main
git push -u origin main
```

### 2. 📊 Configurar Database no Notion

#### Criar Integration
1. Acesse [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Clique **+ New integration**
3. Configure:
   - **Name**: Checking OOH
   - **Associated workspace**: Seu workspace
   - **Capabilities**: Read content, Update content
4. Copie o **Internal Integration Token** (começa com `secret_`)

#### Estrutura do Database
Crie um database no Notion com os seguintes campos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **Ponto** | Title | Nome do ponto de mídia |
| **Exibidora** | Select | Nome da empresa exibidora |
| **Endereço** | Text | Localização completa |
| **Status** | Select | Ativo, Pendente, Finalizado |
| **URL Exibidora** | URL | Link para exibidora acessar |
| **URL Cliente** | URL | Link para cliente visualizar |
| **Campanha** | Text | Nome da campanha |
| **Período** | Text | Duração da campanha |
| **Valor** | Number | Valor do ponto |
| **Observações** | Text | Notas adicionais |

#### Compartilhar Database
1. Abra seu database no Notion
2. Clique em **Share** (botão no canto superior direito)
3. Clique em **Invite**
4. Adicione sua integração "Checking OOH"
5. Defina permissão como **Can edit**

#### Configurar URLs Dinâmicas
No campo **URL Exibidora**, use a fórmula:
```
"https://checking-ooh.pages.dev/?id=" + replaceAll(id(), "-", "")
```

No campo **URL Cliente**, use a fórmula:
```
"https://checking-ooh.pages.dev/?idcliente=" + replaceAll(id(), "-", "")
```

### 3. 🔧 Configurar Google Drive API

#### Opção A: Service Account (Recomendado)

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione existente
3. Ative as APIs:
   - Google Drive API
   - Google Sheets API (opcional)

4. **Criar Service Account**:
   - Vá em **IAM & Admin** > **Service Accounts**
   - Clique **+ Create Service Account**
   - Nome: `checking-ooh-service`
   - Descrição: `Service account para Checking OOH`
   - Clique **Create and Continue**

5. **Configurar Permissões**:
   - Role: **Editor** (ou **Storage Admin**)
   - Clique **Continue** > **Done**

6. **Gerar Chave**:
   - Clique na service account criada
   - Vá em **Keys** > **Add Key** > **Create New Key**
   - Tipo: **JSON**
   - Baixe o arquivo JSON

7. **Configurar Google Drive**:
   - Abra o arquivo JSON baixado
   - Copie o email da service account (field `client_email`)
   - No Google Drive, crie uma pasta "CheckingOOH"
   - Compartilhe a pasta com o email da service account
   - Dê permissão de **Editor**
   - Copie o ID da pasta (parte da URL)

#### Opção B: API Key (Limitado)

1. No Google Cloud Console
2. **APIs & Services** > **Credentials**
3. **+ Create Credentials** > **API Key**
4. Copie a API Key gerada
5. **Restringir** (recomendado):
   - Clique na API Key > **Edit**
   - **API restrictions**: Google Drive API
   - **Application restrictions**: HTTP referrers
   - Adicione seus domínios

### 4. 🚀 Deploy no Cloudflare Pages

#### Via Dashboard (Recomendado)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. Vá em **Workers & Pages** > **Create application** > **Pages**
3. **Connect to Git** > Selecione seu repositório
4. Configurações:
   - **Project name**: `checking-ooh`
   - **Production branch**: `main`
   - **Build command**: (deixe vazio)
   - **Build output directory**: `/`
5. Clique **Save and Deploy**

#### Via CLI

```bash
# Instalar Wrangler
npm install -g wrangler

# Login no Cloudflare
wrangler login

# Deploy
wrangler pages deploy . --project-name=checking-ooh
```

### 5. ⚙️ Configurar Variáveis de Ambiente

No dashboard do Cloudflare Pages:

1. Vá em **Settings** > **Environment Variables**
2. Para **Production**, adicione:

#### Notion (Obrigatório)
```
NOTION_TOKEN = secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NOTION_DATABASE_ID = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Google Drive - Service Account (Recomendado)
```
GOOGLE_SERVICE_ACCOUNT_KEY = {"type":"service_account","project_id":"..."}
GOOGLE_DRIVE_FOLDER_ID = 1XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### Google Drive - API Key (Alternativo)
```
GOOGLE_DRIVE_API_KEY = AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
GOOGLE_DRIVE_FOLDER_ID = 1XXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

3. Clique **Save**
4. **Redeploy** o projeto

### 6. 🧪 Configurar Modo Demo (Opcional)

Para testar sem APIs reais:

1. Edite `js/config.js`
2. Altere `DEMO.ENABLED` para `true`
3. Faça deploy novamente

## 📖 Como Usar

### 🔗 Gerar Links no Notion

#### Para Exibidoras
Use a fórmula no campo **URL Exibidora**:
```
"https://SEU-SITE.pages.dev/?id=" + replaceAll(id(), "-", "")
```

#### Para Clientes
Use a fórmula no campo **URL Cliente**:
```
"https://SEU-SITE.pages.dev/?idcliente=" + replaceAll(id(), "-", "")
```

### 📱 Fluxo da Exibidora

1. **Acesso**: Clica no link recebido por email
2. **Visualização**: Vê todos os pontos da empresa
3. **Expansão**: Clica na seta para expandir um ponto
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

### 📁 Organização no Google Drive

O sistema cria automaticamente:
```
📂 CheckingOOH/
├── 📂 Exibidora A/
│   ├── 📂 Entrada/
│   │   ├── entrada_ponto123_2025-01-14T10-30-00.jpg
│   │   └── entrada_ponto123_2025-01-14T10-35-00.mp4
│   └── 📂 Saida/
│       ├── saida_ponto123_2025-02-14T16-20-00.jpg
│       └── saida_ponto123_2025-02-14T16-25-00.jpg
└── 📂 Exibidora B/
    ├── 📂 Entrada/
    └── 📂 Saida/
```

## 🔧 Personalização

### 🎨 Alterar Cores e Logo

Edite `style.css`:
```css
:root {
    --emidias-primary: #06055B;    /* Azul principal */
    --emidias-magenta: #FC1E75;    /* Rosa/Magenta */
    --emidias-rosa: #D71E97;       /* Rosa */
    --emidias-roxo: #AA1EA5;       /* Roxo */
}
```

Para alterar o logo, substitua a URL em `index.html`:
```html
<img src="SUA_URL_DO_LOGO_AQUI" alt="Sua Logo" class="top-logo">
```

### ⚙️ Configurar Campos do Notion

Edite `js/config.js`:
```javascript
FIELDS: {
    EXIBIDORA: 'Exibidora',      // Nome do campo no Notion
    PONTO: 'Ponto',             // Nome do campo no Notion
    ENDERECO: 'Endereço',       // Nome do campo no Notion
    // ... outros campos
}
```

### 📱 Configurar Câmera

Edite `js/config.js`:
```javascript
CAMERA: {
    VIDEO_CONSTRAINTS: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'  // 'user' para frontal
    },
    PHOTO_QUALITY: 0.8,           // 0.1 - 1.0
    PHOTO_FORMAT: 'image/jpeg'    // ou 'image/png'
}
```

### 📤 Configurar Upload

Edite `js/config.js`:
```javascript
DRIVE: {
    MAX_FILE_SIZE: 100 * 1024 * 1024,  // 100MB
    MAX_FILES_PER_UPLOAD: 5,           // Máx arquivos por vez
    ALLOWED_TYPES: [
        'image/jpeg', 'image/png',      // Imagens
        'video/mp4', 'video/mov'        // Vídeos
    ]
}
```

## 🐛 Troubleshooting

### ❌ Erro: "Token do Notion não configurado"

**Solução**:
1. Verifique se `NOTION_TOKEN` está configurado no Cloudflare
2. Token deve começar com `secret_`
3. Verifique se a integração tem acesso ao database

### ❌ Erro: "Credenciais do Google Drive não configuradas"

**Solução**:
1. Configure `GOOGLE_SERVICE_ACCOUNT_KEY` (recomendado) ou `GOOGLE_DRIVE_API_KEY`
2. Verifique se a service account tem acesso à pasta
3. Confirme se as APIs estão ativadas no Google Cloud

### ❌ Erro: "Ponto não encontrado"

**Solução**:
1. Verifique se o ID na URL está correto (32 caracteres hex)
2. Confirme se o registro existe no Notion
3. Verifique se a integração tem acesso ao database

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

### 🔗 Links não funcionam

**Solução**:
1. Verifique se a fórmula no Notion está correta
2. Confirme se o site está deployado
3. Teste com ID manualmente: `site.com/?id=ID`

## 📊 Monitoramento e Logs

### 📈 Cloudflare Analytics

1. No dashboard do Cloudflare Pages
2. Vá em **Analytics** para ver:
   - Requests por dia
   - Países de origem
   - Erros mais comuns

### 🔍 Logs em Tempo Real

1. **Wrangler CLI**:
   ```bash
   wrangler pages deployment tail
   ```

2. **Dashboard**: 
   - **Workers & Pages** > **Seu projeto** > **Functions**
   - Clique em qualquer function para ver logs

### 🚨 Alertas (Opcional)

Configure alertas no Cloudflare para:
- Muitos erros 5xx
- Alto tempo de resposta
- Uso excessivo de banda

## 🔒 Segurança

### 🛡️ Boas Práticas Implementadas

1. **CORS Configurado**: Apenas origens permitidas
2. **Headers de Segurança**: X-Frame-Options, etc.
3. **Validação de Arquivos**: Tipo e tamanho
4. **Service Account**: Acesso limitado ao Google Drive
5. **Tokens Seguros**: Armazenados em variáveis de ambiente

### 🔐 Recomendações Adicionais

1. **Notion**: Só dê acesso necessário à integração
2. **Google Drive**: Use service account, não sua conta pessoal
3. **URLs**: Não compartilhe IDs publicamente
4. **Backup**: Faça backup do database Notion
5. **Monitoramento**: Acompanhe logs de acesso

## 🚀 Atualizações e Melhorias

### 📋 Roadmap

- [ ] **Notificações**: Email quando arquivo é enviado
- [ ] **Relatórios**: Dashboard com estatísticas
- [ ] **Aprovação**: Fluxo de aprovação para clientes
- [ ] **Mobile App**: PWA instalável
- [ ] **Bulk Actions**: Upload múltiplo em lote
- [ ] **Backup**: Backup automático para S3
- [ ] **Analytics**: Métricas detalhadas de uso

### 🔄 Como Atualizar

1. **Código**:
   ```bash
   git pull origin main
   git add .
   git commit -m "Update: descrição"
   git push
   ```

2. **Deploy**: O Cloudflare redeploya automaticamente

3. **Variáveis**: Adicione novas variáveis se necessário

## 📞 Suporte

### 🆘 Problemas Comuns

1. **Verifique logs** no Cloudflare
2. **Teste modo demo** para isolar problema
3. **Validar configurações** de API
4. **Limpar cache** do navegador

### 📧 Contato

- **Empresa**: E-MÍDIAS
- **Repositório**: [GitHub](https://github.com/SEU_USUARIO/checking-ooh)
- **Issues**: Use GitHub Issues para bugs
- **Documentação**: Este README

---

**Desenvolvido com ❤️ por E-MÍDIAS** • Versão 1.0 • Janeiro 2025
