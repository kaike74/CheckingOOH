// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (DEBUG)
// =============================================================================

export async function onRequest(context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response('', { status: 200, headers });
    }

    try {
        console.log('🚀 Iniciando debug do upload');

        // Verificar variáveis de ambiente
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const driveFolder = context.env.GOOGLE_DRIVE_FOLDER_ID;
        
        console.log('🔑 Variáveis de ambiente:', {
            hasServiceAccount: !!serviceAccountKey,
            hasDriveFolder: !!driveFolder,
            serviceAccountLength: serviceAccountKey ? serviceAccountKey.length : 0
        });

        if (!serviceAccountKey) {
            return new Response(JSON.stringify({
                error: 'Service Account não configurada',
                debug: 'GOOGLE_SERVICE_ACCOUNT_KEY não encontrada'
            }), { status: 500, headers });
        }

        // Verificar se é POST
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({
                error: 'Método não permitido',
                method: context.request.method
            }), { status: 405, headers });
        }

        // Processar FormData
        console.log('📋 Processando FormData...');
        
        let formData;
        try {
            formData = await context.request.formData();
        } catch (error) {
            return new Response(JSON.stringify({
                error: 'Erro ao processar FormData',
                details: error.message
            }), { status: 400, headers });
        }

        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');

        console.log('�� Dados recebidos:', {
            hasFile: !!file,
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type,
            exibidora,
            pontoId,
            tipo
        });

        if (!file || !exibidora || !pontoId || !tipo) {
            return new Response(JSON.stringify({
                error: 'Dados obrigatórios ausentes',
                received: {
                    file: !!file,
                    exibidora: !!exibidora,
                    pontoId: !!pontoId,
                    tipo: !!tipo
                }
            }), { status: 400, headers });
        }

        // Teste de autenticação
        console.log('🔐 Testando autenticação...');
        
        let accessToken;
        try {
            accessToken = await getAccessToken(context.env);
            console.log('✅ Token obtido com sucesso');
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            return new Response(JSON.stringify({
                error: 'Erro na autenticação',
                details: error.message,
                stack: error.stack
            }), { status: 500, headers });
        }

        // Teste simples - listar arquivos do Drive
        console.log('📂 Testando acesso ao Drive...');
        
        try {
            const testResponse = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            console.log('📊 Status do teste:', testResponse.status);

            if (!testResponse.ok) {
                const errorText = await testResponse.text();
                return new Response(JSON.stringify({
                    error: 'Falha no acesso ao Drive',
                    status: testResponse.status,
                    details: errorText
                }), { status: 500, headers });
            }

            console.log('✅ Acesso ao Drive confirmado');

        } catch (error) {
            return new Response(JSON.stringify({
                error: 'Erro ao testar Drive',
                details: error.message
            }), { status: 500, headers });
        }

        // Se chegou até aqui, retornar sucesso do debug
        return new Response(JSON.stringify({
            success: true,
            debug: 'Todos os testes passaram',
            message: 'Upload seria executado aqui',
            data: {
                fileName: file.name,
                fileSize: file.size,
                exibidora,
                pontoId,
                tipo
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error('💥 Erro geral:', error);
        
        return new Response(JSON.stringify({
            error: 'Erro interno geral',
            message: error.message,
            stack: error.stack,
            name: error.name
        }), { status: 500, headers });
    }
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO (SIMPLIFICADO PARA DEBUG)
// =============================================================================
async function getAccessToken(env) {
    try {
        console.log('🔑 Obtendo token...');

        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        console.log('📋 Service Account:', {
            hasEmail: !!serviceAccount.client_email,
            hasPrivateKey: !!serviceAccount.private_key,
            email: serviceAccount.client_email
        });

        // Criar JWT
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        console.log('🔧 Criando JWT...');
        const token = await createJWT(header, payload, serviceAccount.private_key);
        
        console.log('📡 Trocando JWT por access token...');
        
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: token
            })
        });

        console.log('📊 Status OAuth2:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth2 falhou: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        console.log('✅ Access token obtido');
        
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 CRIAR JWT (VERSÃO SIMPLIFICADA PARA DEBUG)
// =============================================================================
async function createJWT(header, payload, privateKey) {
    try {
        const headerB64 = base64UrlEncode(JSON.stringify(header));
        const payloadB64 = base64UrlEncode(JSON.stringify(payload));
        
        const message = `${headerB64}.${payloadB64}`;
        
        // Preparar chave privada
        const pemKey = privateKey.replace(/\n/g, '\n');
        
        // Importar chave privada
        const keyData = await crypto.subtle.importKey(
            'pkcs8',
            pemToBinary(pemKey),
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256'
            },
            false,
            ['sign']
        );
        
        // Assinar
        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            keyData,
            new TextEncoder().encode(message)
        );
        
        const signatureB64 = base64UrlEncode(signature);
        
        return `${message}.${signatureB64}`;

    } catch (error) {
        console.error('❌ Erro ao criar JWT:', error);
        throw error;
    }
}

// Funções auxiliares
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
    const encoded = lines
        .filter(line => !line.includes('-----'))
        .join('');
    
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
