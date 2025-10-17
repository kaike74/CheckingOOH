// =============================================================================
// 🧪 CLOUDFLARE PAGES FUNCTION - TESTE ESPECÍFICO DO UPLOAD
// =============================================================================

export async function onRequest(context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response('', { status: 200, headers });
    }

    try {
        console.log('🧪 === TESTE ESPECÍFICO DO UPLOAD ===');

        const testResults = {
            timestamp: new Date().toISOString(),
            version: 'v3.0-ultra-test',
            tests: {}
        };

        // ✅ TESTE 1: VARIÁVEIS DE AMBIENTE
        console.log('🔍 TESTE 1: Verificando variáveis...');
        testResults.tests.environmentVariables = {
            serviceAccountExists: !!context.env.GOOGLE_SERVICE_ACCOUNT_KEY,
            serviceAccountLength: context.env.GOOGLE_SERVICE_ACCOUNT_KEY?.length || 0,
            folderIdExists: !!context.env.GOOGLE_DRIVE_FOLDER_ID,
            folderId: context.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
        };

        // ✅ TESTE 2: PARSE DO SERVICE ACCOUNT
        console.log('🔍 TESTE 2: Parse do Service Account...');
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(context.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            testResults.tests.serviceAccountParse = {
                success: true,
                hasRequiredFields: !!(serviceAccount.client_email && serviceAccount.private_key),
                clientEmail: serviceAccount.client_email,
                projectId: serviceAccount.project_id
            };
        } catch (error) {
            testResults.tests.serviceAccountParse = {
                success: false,
                error: error.message
            };
        }

        // ✅ TESTE 3: CRIAÇÃO DE JWT
        if (serviceAccount) {
            console.log('🔍 TESTE 3: Criação de JWT...');
            try {
                const jwt = await createTestJWT(serviceAccount);
                testResults.tests.jwtCreation = {
                    success: true,
                    jwtLength: jwt.length,
                    jwtParts: jwt.split('.').length
                };
            } catch (error) {
                testResults.tests.jwtCreation = {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        }

        // ✅ TESTE 4: OAUTH2 TOKEN
        if (testResults.tests.jwtCreation?.success) {
            console.log('🔍 TESTE 4: OAuth2 token...');
            try {
                const jwt = await createTestJWT(serviceAccount);
                const token = await getTestToken(jwt);
                testResults.tests.oauth2Token = {
                    success: true,
                    tokenExists: !!token,
                    tokenLength: token?.length || 0
                };
            } catch (error) {
                testResults.tests.oauth2Token = {
                    success: false,
                    error: error.message
                };
            }
        }

        // ✅ TESTE 5: ACESSO AO DRIVE
        if (testResults.tests.oauth2Token?.success) {
            console.log('🔍 TESTE 5: Acesso ao Google Drive...');
            try {
                const jwt = await createTestJWT(serviceAccount);
                const token = await getTestToken(jwt);
                const driveAccess = await testDriveAccess(token, context.env.GOOGLE_DRIVE_FOLDER_ID);
                testResults.tests.driveAccess = driveAccess;
            } catch (error) {
                testResults.tests.driveAccess = {
                    success: false,
                    error: error.message
                };
            }
        }

        // ✅ TESTE 6: CRIAÇÃO DE PASTA
        if (testResults.tests.driveAccess?.success) {
            console.log('🔍 TESTE 6: Criação de pasta teste...');
            try {
                const jwt = await createTestJWT(serviceAccount);
                const token = await getTestToken(jwt);
                const folderTest = await testFolderCreation(token, context.env.GOOGLE_DRIVE_FOLDER_ID);
                testResults.tests.folderCreation = folderTest;
            } catch (error) {
                testResults.tests.folderCreation = {
                    success: false,
                    error: error.message
                };
            }
        }

        // ✅ TESTE 7: UPLOAD SIMULADO
        if (context.request.method === 'POST') {
            console.log('🔍 TESTE 7: Upload simulado...');
            try {
                const formData = await context.request.formData();
                const file = formData.get('file');
                
                if (file) {
                    testResults.tests.uploadSimulated = {
                        success: true,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        message: 'Arquivo recebido com sucesso (não foi feito upload real)'
                    };
                } else {
                    testResults.tests.uploadSimulated = {
                        success: false,
                        error: 'Nenhum arquivo encontrado no FormData'
                    };
                }
            } catch (error) {
                testResults.tests.uploadSimulated = {
                    success: false,
                    error: error.message
                };
            }
        }

        // ✅ RESUMO
        const successfulTests = Object.values(testResults.tests).filter(test => test.success).length;
        const totalTests = Object.keys(testResults.tests).length;

        testResults.summary = {
            successfulTests,
            totalTests,
            successRate: `${Math.round((successfulTests / totalTests) * 100)}%`,
            allTestsPassed: successfulTests === totalTests,
            recommendation: successfulTests === totalTests ? 
                'Todos os testes passaram! O upload deve funcionar.' :
                `${totalTests - successfulTests} teste(s) falharam. Verifique os detalhes acima.`
        };

        console.log('🎉 === TESTE ESPECÍFICO CONCLUÍDO ===');
        return new Response(JSON.stringify(testResults, null, 2), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro no teste:', error);
        return new Response(JSON.stringify({
            error: 'Erro no teste específico',
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
// 🔧 FUNÇÕES DE TESTE
// =============================================================================

async function createTestJWT(serviceAccount) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const message = `${headerB64}.${payloadB64}`;

    let privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }

    const keyData = await crypto.subtle.importKey(
        'pkcs8',
        pemToBinary(privateKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        keyData,
        new TextEncoder().encode(message)
    );

    const signatureB64 = base64UrlEncode(signature);
    return `${message}.${signatureB64}`;
}

async function getTestToken(jwt) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth2 falhou: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

async function testDriveAccess(token, folderId) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        throw new Error(`Sem acesso à pasta: ${response.status}`);
    }

    const data = await response.json();
    return {
        success: true,
        folderName: data.name,
        folderId: data.id,
        permissions: data.permissions ? 'Sim' : 'Limitado'
    };
}

async function testFolderCreation(token, parentId) {
    // Tentar criar uma pasta de teste
    const testFolderName = `Teste_${Date.now()}`;
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: testFolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar pasta: ${response.status} - ${errorText}`);
    }

    const newFolder = await response.json();

    // Deletar a pasta de teste
    try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${newFolder.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (deleteError) {
        console.warn('Não foi possível deletar pasta de teste:', deleteError);
    }

    return {
        success: true,
        testFolderId: newFolder.id,
        testFolderName: testFolderName,
        message: 'Pasta criada e deletada com sucesso'
    };
}

// Funções auxiliares
function base64UrlEncode(data) {
    let base64;
    if (typeof data === 'string') {
        base64 = btoa(unescape(encodeURIComponent(data)));
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
