// =============================================================================
// 🐛 CLOUDFLARE PAGES FUNCTION - DEBUG DAS VARIÁVEIS DE AMBIENTE
// =============================================================================
// ⚠️ DESABILITADO EM PRODUÇÃO POR SEGURANÇA

export async function onRequest(context) {
    const headers = {
        'Content-Type': 'application/json'
    };

    // 🔒 BLOQUEIO DE SEGURANÇA: Este endpoint está desabilitado em produção
    return new Response(JSON.stringify({
        error: 'Endpoint não disponível',
        message: 'Este recurso está desabilitado por motivos de segurança.'
    }), {
        status: 403,
        headers
    });
}
