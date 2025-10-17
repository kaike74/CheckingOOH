// =============================================================================
// 🧪 FUNÇÃO DE TESTE - VERIFICAR SE UPLOAD ESTÁ FUNCIONANDO
// =============================================================================

export async function onRequest(context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response('', { status: 200, headers });
    }

    try {
        console.log('🧪 Testando função de upload...');

        const testResult = {
            timestamp: new Date().toISOString(),
            uploadFunction: {
                version: 'v5.1-shared-drive-complete',
                status: 'Upload, listagem e exclusão com suporte a Shared Drives',
                message: 'Todas as funções do Google Drive agora suportam Shared Drives!'
            },
            environment: {
                hasServiceAccount: !!context.env.GOOGLE_SERVICE_ACCOUNT_KEY,
                hasFolderId: !!context.env.GOOGLE_DRIVE_FOLDER_ID,
                hasNotionToken: !!context.env.NOTION_TOKEN
            },
            nextSteps: [
                '1. Se está vendo esta versão, o deploy funcionou',
                '2. Teste o upload novamente no site',
                '3. Verifique os logs do Cloudflare se ainda houver erro'
            ]
        };

        return new Response(JSON.stringify(testResult, null, 2), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro no teste:', error);
        return new Response(JSON.stringify({
            error: 'Erro no teste',
            message: error.message,
            timestamp: new Date().toISOString()
        }, null, 2), {
            status: 500,
            headers
        });
    }
}
