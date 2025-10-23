// =============================================================================
// 🔧 CLOUDFLARE FUNCTION: CORRIGIR PERMISSÕES DE ARQUIVOS EXISTENTES
// =============================================================================
// Esta função pode ser chamada manualmente para corrigir permissões de arquivos
// que já foram enviados mas não estão visíveis no site

export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('🔧 === INICIANDO CORREÇÃO DE PERMISSÕES ===');

        // Obter lista de IDs de arquivos do corpo da requisição
        const body = await request.json();
        const fileIds = body.fileIds || [];

        if (!fileIds || fileIds.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Lista de IDs de arquivos não fornecida'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`📋 ${fileIds.length} arquivo(s) para corrigir`);

        // Obter token de acesso
        const accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);

        const results = [];
        let successCount = 0;
        let failCount = 0;

        // Processar cada arquivo
        for (const fileId of fileIds) {
            try {
                console.log(`🔓 Corrigindo permissões do arquivo: ${fileId}`);
                const success = await makeFileViewable(fileId, accessToken);

                if (success) {
                    successCount++;
                    results.push({ fileId, status: 'success' });
                } else {
                    failCount++;
                    results.push({ fileId, status: 'failed', error: 'Não foi possível configurar permissões' });
                }
            } catch (error) {
                failCount++;
                results.push({ fileId, status: 'error', error: error.message });
                console.error(`❌ Erro ao processar arquivo ${fileId}:`, error);
            }
        }

        console.log(`✅ Processamento concluído: ${successCount} sucesso, ${failCount} falhas`);

        return new Response(JSON.stringify({
            success: true,
            total: fileIds.length,
            successCount,
            failCount,
            results
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Erro ao corrigir permissões:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// =============================================================================
// 🔓 TORNAR ARQUIVO VISUALIZÁVEL
// =============================================================================
async function makeFileViewable(fileId, accessToken) {
    try {
        const permissionResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );

        if (!permissionResponse.ok) {
            const errorText = await permissionResponse.text();
            console.warn(`⚠️ Falha ao configurar permissões: ${permissionResponse.status} - ${errorText}`);
            return false;
        }

        console.log(`✅ Arquivo ${fileId} configurado como público`);
        return true;

    } catch (error) {
        console.error(`❌ Erro ao configurar permissões do arquivo ${fileId}:`, error);
        return false;
    }
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO DO GOOGLE
// =============================================================================
async function getGoogleAccessToken(serviceAccountKey) {
    try {
        const serviceAccount = JSON.parse(serviceAccountKey);

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const jwt = await signJWT(payload, serviceAccount.private_key);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        if (!tokenResponse.ok) {
            throw new Error(`OAuth2 falhou: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token:', error);
        throw error;
    }
}

// =============================================================================
// 🖊️ ASSINAR JWT
// =============================================================================
async function signJWT(payload, privateKey) {
    const header = { alg: 'RS256', typ: 'JWT' };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToBinary(privateKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(signingInput)
    );

    return `${signingInput}.${base64UrlEncode(signature)}`;
}

// =============================================================================
// 🔧 FUNÇÕES AUXILIARES
// =============================================================================
function base64UrlEncode(data) {
    let base64;
    if (typeof data === 'string') {
        base64 = btoa(data);
    } else {
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToBinary(pem) {
    const lines = pem.split('\n');
    const encoded = lines.filter(line => !line.includes('-----')).join('');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
