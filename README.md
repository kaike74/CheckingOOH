# Checking OOH (E-MÍDIAS)

Aplicação estática (HTML/CSS/JS) no **Cloudflare Pages** com **Functions** em `functions/api/` para dados no **Notion** e ficheiros no **Google Drive** (listagem, upload, exclusão lógica).

---

## Arquitetura

| Camada | Função |
|--------|--------|
| `index.html`, `js/`, `css/` | Interface; chama `/api/*` na mesma origem. |
| `functions/api/notion-data.js` | `GET` — pontos por exibidora (`?id=`) ou campanha (`?campanha=`). |
| `functions/api/drive-list.js` | `GET` — lista ficheiros por ponto / Entrada / Saída. |
| `functions/api/drive-upload.js` | `POST` — upload multipart. |
| `functions/api/drive-delete.js` | `DELETE` — renomeia ficheiro (`_EXCLUIDO_`) no Drive. |
| `functions/api/drive-hierarchy.js` | Hierarquia de pastas partilhada (upload + listagem). |
| `functions/api/_security.js` | CORS, validação de inputs, rate limit, logs mascarados. |

Fluxo de pastas no Drive: **CheckingOOH → Exibidora → Campanha (ID da base Notion) → Ponto (ID do ponto) → Entrada | Saida**. O código ainda agrega pastas antigas quando aplicável.

---

## Variáveis de ambiente (Cloudflare Pages)

Definir em **Production** e **Preview** se usar URLs `*.pages.dev` com hash.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NOTION_TOKEN` | Sim | Token da integração Notion (`secret_…`). |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Sim | JSON completo da service account (uma chave por linha ou colar o ficheiro). |
| `GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID` | Recomendada | ID da pasta **CheckingOOH** (segmento após `/folders/` na URL). |
| `CHECKINGOOH_ROOT_FOLDER_ID` | Opcional | Alias do ID da pasta CheckingOOH. |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | Opcional | ID do **Drive partilhado** (raiz). Sem ID da pasta: procura-se “CheckingOOH” primeiro aqui; depois `allDrives`. |
| `GOOGLE_DRIVE_FOLDER_ID` | Legado | Usado em partes de `drive-list`; a hierarquia principal vem das variáveis acima. |

**Google Cloud (obrigatório):** no projeto da mesma service account do JSON, ativar **Google Drive API** (APIs e serviços → Biblioteca). Sem isto a API devolve 403 a indicar API desativada.

**Permissões no Drive:** adicionar o `client_email` da service account como membro do drive partilhado (função com edição de conteúdos) ou partilhar a pasta CheckingOOH com esse e-mail.

**Nunca** commitar `.dev.vars` nem colar o JSON da chave em issues ou chats públicos.

---

## Segurança

- **CORS:** lista fixa em `functions/api/_security.js` (`ALLOWED_ORIGINS`) mais subdomínios `*.checkingooh.pages.dev` e `*.checking-ooh.pages.dev` (previews). Para domínio próprio, acrescentar o URL exato em `ALLOWED_ORIGINS`.
- **Cabeçalhos estáticos:** `_headers` define cache e CORS para assets; as respostas das Functions definem CORS via `_security.js`.
- **Validação:** IDs estilo Notion, nomes de ficheiro/pasta, tipos MIME e tamanho (upload).
- **Rate limiting:** por IP (`CF-Connecting-IP`) nos endpoints (valores em cada handler).
- **Erros 500:** respostas genéricas sem `details`/`stack` para o cliente em listagem e delete; detalhes só nos logs do worker.
- **Uploads:** após upload, o código pode marcar o ficheiro como **leitor com link** (`anyone`) para facilitar thumbnails no site — avaliar se isso é aceitável para o vosso modelo de dados.
- **`/api/debug-env`:** desativado (403).

Logs: em produção (`NODE_ENV=production` no worker) os `secureLog('info', …)` não imprimem; no browser, `config.js` usa `PRODUCTION_MODE: true` para silenciar `Logger.info` / `Logger.warning`. Erros críticos continuam visíveis onde necessário.

---

## Desenvolvimento local

```bash
npm install
npm run dev
```

Variáveis locais: ficheiro **`.dev.vars`** na raiz (não versionado), mesmo nomes que no Cloudflare.

---

## Notion

- Campanha = uma base (database); o **ID normalizado** da base é o nome da pasta de campanha no Drive.
- O campo **Exibidora** é tratado como **rich_text** na query da API.
- URLs típicas: `?id=<pageId>` (modo exibidora) e `?idcliente=<pageId>` (cliente, só leitura).

---

## Estrutura de pastas (referência)

```
CheckingOOH/
  └── <Exibidora>/
        └── <databaseId Notion>/
              └── <pontoId Notion>/
                    ├── Entrada/
                    └── Saida/
```

---

## Licença e créditos

Uso interno E-MÍDIAS / projeto Checking OOH. Ajustar licença conforme a política da organização.
