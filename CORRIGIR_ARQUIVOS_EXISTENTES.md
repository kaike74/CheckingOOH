# 🔧 Como Corrigir Arquivos Existentes no Google Drive

## Problema
Arquivos que foram enviados **antes** da correção de permissões não aparecem no site (mostram "?" ou "Nenhum arquivo").

## Solução Automática

### Opção 1: Via Console do Navegador (Recomendado)

1. Abra o site no navegador
2. Pressione `F12` para abrir o Console do desenvolvedor
3. Cole o código abaixo e pressione Enter:

```javascript
// Função para corrigir permissões de arquivos existentes
async function corrigirPermissoesExistentes() {
    console.log('🔧 Iniciando correção de permissões...');

    // Obter todos os arquivos listados na página atual
    const result = await DriveAPI.listDriveFiles(
        appData.exibidora,
        appData.pontoAtual.id,
        'entrada', // ou 'saida'
        appData.databaseId
    );

    if (!result.success || result.files.length === 0) {
        console.log('❌ Nenhum arquivo encontrado');
        return;
    }

    console.log(`📋 ${result.files.length} arquivo(s) encontrado(s)`);

    // Extrair IDs dos arquivos
    const fileIds = result.files.map(f => f.id);

    // Chamar endpoint de correção
    const response = await fetch('/api/fix-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds })
    });

    const fixResult = await response.json();

    if (fixResult.success) {
        console.log(`✅ Correção concluída!`);
        console.log(`   ✓ ${fixResult.successCount} arquivo(s) corrigido(s)`);
        console.log(`   ✗ ${fixResult.failCount} falha(s)`);

        // Recarregar página para ver os arquivos
        setTimeout(() => location.reload(), 2000);
    } else {
        console.error('❌ Erro:', fixResult.error);
    }
}

// Executar
corrigirPermissoesExistentes();
```

### Opção 2: Via API Direta

Se você tem os IDs dos arquivos, pode chamar a API diretamente:

```bash
curl -X POST https://seu-dominio.pages.dev/api/fix-permissions \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": [
      "1M4k5zLIWirzNGksm9rjfgCp3C8CCewUE",
      "outro-id-aqui"
    ]
  }'
```

## Solução Manual (Google Drive)

Se preferir fazer manualmente pelo Google Drive:

1. Acesse o [Google Drive](https://drive.google.com)
2. Navegue até a pasta do arquivo:
   ```
   CheckingOOH > [Exibidora] > [DatabaseId] > Entrada ou Saída
   ```
3. Para cada arquivo:
   - Clique com botão direito no arquivo
   - Selecione "Compartilhar"
   - Em "Acesso geral", selecione "Qualquer pessoa com o link"
   - Permissão: "Leitor"
   - Clique em "Concluído"

## Verificar se Funcionou

Após aplicar a correção:

1. Recarregue a página do site
2. Os arquivos devem aparecer normalmente
3. Ao clicar em "Ver Fotos", as imagens devem ser exibidas

## Prevenir Problemas Futuros

A partir de agora, **novos arquivos** enviados já terão as permissões configuradas automaticamente. Essa correção só é necessária para arquivos **antigos**.

## Troubleshooting

### Arquivos ainda não aparecem
- Verifique se o arquivo está na pasta correta no Drive
- Certifique-se de que a Service Account tem acesso ao Shared Drive
- Limpe o cache do navegador (Ctrl + Shift + Delete)

### Erro de permissão negada
- A Service Account pode não ter permissão para alterar compartilhamento
- Neste caso, use a solução manual pelo Google Drive

### Erro 400 ao listar arquivos
- Verifique se os parâmetros da URL estão corretos:
  ```
  ?id={pontoId}&exibidora={nome}&databaseId={id_campanha}
  ```

## Suporte

Em caso de dúvidas ou problemas, verifique os logs do console do navegador (F12) para mais detalhes.
