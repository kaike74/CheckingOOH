// =============================================================================
// 🐛 CLOUDFLARE PAGES FUNCTION - DEBUG DAS VARIÁVEIS DE AMBIENTE
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
        console.log('🐛 Iniciando debug das variáveis de ambiente...');

        const debug = {
            timestamp: new Date().toISOString(),
            cloudflare: {
                cf: !!context.request.cf,
                waitUntil: !!context.waitUntil,
                passThroughOnException: !!context.passThroughOnException
            },
            environment: {},
            tests: {}
        };

        // ✅ 1. VERIFICAR VARIÁVEIS DE AMBIENTE
        console.log('🔍 Verificando variáveis de ambiente...');
        
        debug.environment.NOTION_TOKEN = {
            exists: !!context.env.NOTION_TOKEN,
            type: typeof context.env.NOTION_TOKEN,
            startsWith: context.env.NOTION_TOKEN ? context.env.NOTION_TOKEN.substring(0, 10) + '...' : null,
            length: context.env.NOTION_TOKEN ? context.env.NOTION_TOKEN.length : 0
        };

        debug.environment.GOOGLE_SERVICE_ACCOUNT_KEY = {
            exists: !!context.env.GOOGLE_SERVICE_ACCOUNT_KEY,
            type: typeof context.env.GOOGLE_SERVICE_ACCOUNT_KEY,
            length: context.env.GOOGLE_SERVICE_ACCOUNT_KEY ? context.env.GOOGLE_SERVICE_ACCOUNT_KEY.length : 0,
            startsWithBrace: context.env.GOOGLE_SERVICE_ACCOUNT_KEY ? context.env.GOOGLE_SERVICE_ACCOUNT_KEY.startsWith('{') : false
        };

        debug.environment.GOOGLE_DRIVE_FOLDER_ID = {
            exists: !!context.env.GOOGLE_DRIVE_FOLDER_ID,
            type: typeof context.env.GOOGLE_DRIVE_FOLDER_ID,
            value: context.env.GOOGLE_DRIVE_FOLDER_ID || 'root',
            length: context.env.GOOGLE_DRIVE_FOLDER_ID ? context.env.GOOGLE_DRIVE_FOLDER_ID.length : 0
        };

        // ✅ 2. TESTAR PARSING DO SERVICE ACCOUNT
        if (context.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            console.log('🧪 Testando parsing do Service Account...');
            try {
                const serviceAccount = JSON.parse(context.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                debug.tests.serviceAccountParsing = {
                    success: true,
                    hasClientEmail: !!serviceAccount.client_email,
                    hasPrivateKey: !!serviceAccount.private_key,
                    hasProjectId: !!serviceAccount.project_id,
                    clientEmail: serviceAccount.client_email || null,
                    projectId: serviceAccount.project_id || null,
                    privateKeyFormat: serviceAccount.private_key ? 
                        (serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----') ? 'PEM' : 'Raw') : null
                };
            } catch (error) {
                debug.tests.serviceAccountParsing = {
                    success: false,
                    error: error.message
                };
            }
        }

        // ✅ 3. TESTAR CRIAÇÃO DE JWT (SIMPLIFICADO)
        if (debug.tests.serviceAccountParsing?.success) {
            console.log('🧪 Testando criação de JWT...');
            try {
                const serviceAccount = JSON.parse(context.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                
                // Testar formato da chave
                let privateKey = serviceAccount.private_key;
                if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
                    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
                }
                privateKey = privateKey.replace(/\\n/g, '\n');

                // Testar importação da chave
                const keyData = await crypto.subtle.importKey(
                    'pkcs8',
                    pemToBinary(privateKey),
                    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                    false,
                    ['sign']
                );

                debug.tests.jwtCreation = {
                    success: true,
                    keyImported: true,
                    algorithm: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256'
                };

            } catch (error) {
                debug.tests.jwtCreation = {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        }

        // ✅ 4. TESTAR OAUTH2 (SEM FAZER REQUISIÇÃO REAL)
        if (debug.tests.jwtCreation?.success) {
            console.log('🧪 Preparando teste OAuth2...');
            debug.tests.oauth2Ready = {
                canProceed: true,
                endpoint: 'https://oauth2.googleapis.com/token',
                grantType: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                scope: 'https://www.googleapis.com/auth/drive'
            };
        }

        // ✅ 5. VERIFICAR WEB CRYPTO API
        debug.tests.webCrypto = {
            available: !!crypto,
            subtle: !!crypto?.subtle,
            methods: {
                importKey: typeof crypto?.subtle?.importKey,
                sign: typeof crypto?.subtle?.sign,
                generateKey: typeof crypto?.subtle?.generateKey
            }
        };

        // ✅ 6. VERIFICAR FETCH API
        debug.tests.fetchAPI = {
            available: typeof fetch === 'function',
            FormData: typeof FormData === 'function',
            URLSearchParams: typeof URLSearchParams === 'function'
        };

        // ✅ 7. VERIFICAR VERSÃO DO UPLOAD FUNCTION
        debug.tests.uploadFunctionVersion = {
            version: 'v2.0-corrected',
            timestamp: '2025-01-14T18:30:00Z',
            status: 'Função de upload corrigida ativa'
        };

        console.log('✅ Debug concluído');

        return new Response(JSON.stringify(debug, null, 2), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro no debug:', error);
        return new Response(JSON.stringify({
            error: 'Erro no debug',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        }, null, 2), {
            status: 500,
            headers
        });
    }
}

// =============================================================================
// 🔧 FUNÇÃO AUXILIAR PARA CONVERTER PEM
// =============================================================================
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
