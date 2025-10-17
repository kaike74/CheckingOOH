// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (VERSÃO ULTRA CORRIGIDA)
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
        console.log('📤 === INICIANDO UPLOAD ULTRA CORRIGIDO ===');
        console.log('🆔 Versão: v3.0-ultra-fixed - 2025-10-17T18:30:00Z');

        if (context.request.method !== 'POST') {
            throw new Error('Método não permitido');
        }

        // ✅ ETAPA 1: VERIFICAR VARIÁVEIS DE AMBIENTE
        console.log('🔍 ETAPA 1: Verificando variáveis...');
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const sharedFolderId = context.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        
        if (!serviceAccountKey) {
            console.error('❌ Service Account Key ausente');
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada');
        }
        console.log('✅ ETAPA 1: Variáveis OK');

        // ✅ ETAPA 2: PROCESSAR FORMDATA
        console.log('🔍 ETAPA 2: Processando FormData...');
        const formData = await context.request.formData();
        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');

        console.log('📋 Dados recebidos:', {
            hasFile: !!file,
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type,
            exibidora,
            pontoId,
            tipo
        });

        if (!file || !exibidora || !pontoId || !tipo) {
            throw new Error('Dados obrigatórios ausentes');
        }
        console.log('✅ ETAPA 2: FormData OK');

        // ✅ ETAPA 3: VALIDAR ARQUIVO
        console.log('🔍 ETAPA 3: Validando arquivo...');
        const validation = validateFileUltra(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        console.log('✅ ETAPA 3: Validação OK');

        // ✅ ETAPA 4: OBTER TOKEN (COM RETRY)
        console.log('🔍 ETAPA 4: Obtendo token de acesso...');
        let accessToken;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                accessToken = await getAccessTokenUltra(context.env);
                console.log('✅ ETAPA 4: Token obtido com sucesso');
                break;
            } catch (error) {
                attempts++;
                console.error(`❌ Tentativa ${attempts} falhou:`, error.message);
                if (attempts >= maxAttempts) {
                    throw new Error(`Falha ao obter token após ${maxAttempts} tentativas: ${error.message}`);
                }
                // Aguardar antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // ✅ ETAPA 5: UPLOAD DO ARQUIVO
        console.log('🔍 ETAPA 5: Fazendo upload...');
        const uploadResult = await uploadToGoogleDriveUltra(
            file,
            exibidora,
            pontoId,
            tipo,
            accessToken,
            sharedFolderId
        );
        console.log('✅ ETAPA 5: Upload concluído');

        console.log('🎉 === UPLOAD ULTRA CORRIGIDO CONCLUÍDO ===');
        return new Response(JSON.stringify(uploadResult), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 === ERRO DETALHADO NO UPLOAD ===');
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        console.error('Nome:', error.name);
        console.error('=====================================');
        
        return new Response(JSON.stringify({
            success: false,
            error: 'Erro no upload',
            details: error.message,
            timestamp: new Date().toISOString(),
            version: 'v3.0-ultra-fixed'
        }), {
            status: 500,
            headers
        });
    }
}

// =============================================================================
// ✅ VALIDAR ARQUIVO ULTRA
// =============================================================================
function validateFileUltra(file) {
    console.log('🔍 Validando arquivo:', {
        name: file.name,
        size: file.size,
        type: file.type
    });

    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/mov', 'video/avi', 'video/quicktime'
    ];

    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!allowedTypes.includes(file.type)) {
        return { 
            valid: false, 
            error: `Tipo não permitido: ${file.type}. Permitidos: ${allowedTypes.join(', ')}` 
        };
    }

    if (file.size > maxSize) {
        return { 
            valid: false, 
            error: `Arquivo muito grande: ${Math.round(file.size / 1024 / 1024)}MB. Máximo: 100MB` 
        };
    }

    if (file.size === 0) {
        return { 
            valid: false, 
            error: 'Arquivo vazio' 
        };
    }

    console.log('✅ Arquivo válido');
    return { valid: true };
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO ULTRA
// =============================================================================
async function getAccessTokenUltra(env) {
    try {
        console.log('🔑 Iniciando obtenção do token...');
        
        // Parse do Service Account
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
            console.log('✅ Service Account parsed');
        } catch (parseError) {
            console.error('❌ Erro no parse JSON:', parseError);
            throw new Error('Service Account JSON inválido');
        }

        // Verificar campos obrigatórios
        if (!serviceAccount.client_email || !serviceAccount.private_key) {
            throw new Error('Service Account incompleta - faltam campos obrigatórios');
        }

        console.log('📧 Client email:', serviceAccount.client_email);
        console.log('🔐 Private key presente:', !!serviceAccount.private_key);

        // Criar JWT de forma mais robusta
        console.log('🔧 Criando JWT...');
        const jwt = await createJWTUltra(serviceAccount);
        console.log('✅ JWT criado');

        // Trocar JWT por access token
        console.log('🔄 Trocando JWT por access token...');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        console.log('📡 Response status:', tokenResponse.status);

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Erro OAuth2:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                body: errorText
            });
            throw new Error(`OAuth2 falhou: ${tokenResponse.status} - ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Access token obtido');
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 CRIAR JWT ULTRA ROBUSTO
// =============================================================================
async function createJWTUltra(serviceAccount) {
    try {
        console.log('🔧 Criando JWT ultra robusto...');

        // Preparar header
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        // Preparar payload
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        console.log('📋 JWT payload:', {
            iss: payload.iss,
            scope: payload.scope,
            aud: payload.aud,
            iat: payload.iat,
            exp: payload.exp
        });

        // Codificar header e payload
        const headerB64 = base64UrlEncodeUltra(JSON.stringify(header));
        const payloadB64 = base64UrlEncodeUltra(JSON.stringify(payload));
        const message = `${headerB64}.${payloadB64}`;

        console.log('🔐 Processando chave privada...');
        
        // Preparar chave privada
        let privateKey = serviceAccount.private_key;
        
        // Normalizar quebras de linha
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        // Verificar formato PEM
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
        }

        console.log('🔑 Importando chave...');
        
        // Importar chave privada
        const keyData = await crypto.subtle.importKey(
            'pkcs8',
            pemToBinaryUltra(privateKey),
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256'
            },
            false,
            ['sign']
        );

        console.log('✅ Chave importada com sucesso');

        // Assinar mensagem
        console.log('✍️ Assinando JWT...');
        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            keyData,
            new TextEncoder().encode(message)
        );

        const signatureB64 = base64UrlEncodeUltra(signature);
        const jwt = `${message}.${signatureB64}`;

        console.log('✅ JWT criado e assinado');
        console.log('📏 JWT length:', jwt.length);

        return jwt;

    } catch (error) {
        console.error('❌ Erro ao criar JWT:', error);
        throw new Error(`Falha na criação do JWT: ${error.message}`);
    }
}

// =============================================================================
// 📤 UPLOAD PARA GOOGLE DRIVE ULTRA
// =============================================================================
async function uploadToGoogleDriveUltra(file, exibidora, pontoId, tipo, accessToken, rootFolderId) {
    try {
        console.log('📤 Iniciando upload ultra...');

        // ✅ PASSO 1: VERIFICAR ACESSO À PASTA RAIZ
        console.log('🔍 Verificando acesso à pasta raiz...');
        const rootResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!rootResponse.ok) {
            console.error('❌ Sem acesso à pasta raiz:', rootResponse.status);
            throw new Error(`Sem acesso à pasta raiz: ${rootResponse.status}`);
        }

        const rootData = await rootResponse.json();
        console.log('✅ Acesso à pasta confirmado:', rootData.name);

        // ✅ PASSO 2: CRIAR ESTRUTURA DE PASTAS
        console.log('📁 Criando estrutura de pastas...');
        const folderStructure = await createFolderStructureUltra(
            exibidora, 
            tipo, 
            accessToken, 
            rootFolderId
        );
        console.log('✅ Estrutura criada:', folderStructure.path);

        // ✅ PASSO 3: PREPARAR ARQUIVO
        console.log('📝 Preparando arquivo...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const baseFileName = `${tipo}_${pontoId}_${timestamp}`;
        const uniqueFileName = `${baseFileName}.${fileExtension}`;

        console.log('📄 Nome final:', uniqueFileName);

        // ✅ PASSO 4: CONVERTER ARQUIVO PARA BUFFER
        console.log('💾 Convertendo arquivo...');
        const fileBuffer = await file.arrayBuffer();
        console.log('📊 Buffer size:', fileBuffer.byteLength);

        // ✅ PASSO 5: UPLOAD SIMPLES (SEM MULTIPART)
        console.log('📤 Fazendo upload simples...');
        const uploadResult = await uploadFileSimpleUltra(
            fileBuffer,
            uniqueFileName,
            file.type,
            folderStructure.folderId,
            accessToken
        );

        console.log('✅ Upload concluído:', uploadResult.id);

        // ✅ PASSO 6: TORNAR PÚBLICO
        console.log('🌐 Tornando arquivo público...');
        await makeFilePublicUltra(uploadResult.id, accessToken);

        // ✅ PASSO 7: RETORNAR RESULTADO
        const result = {
            success: true,
            fileId: uploadResult.id,
            fileName: uniqueFileName,
            fileUrl: `https://drive.google.com/uc?id=${uploadResult.id}`,
            downloadUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`,
            uploadDate: new Date().toISOString(),
            message: 'Upload realizado com sucesso',
            folderPath: folderStructure.path
        };

        console.log('🎉 Upload ultra concluído com sucesso');
        return result;

    } catch (error) {
        console.error('❌ Erro no upload ultra:', error);
        throw error;
    }
}

// =============================================================================
// 📁 CRIAR ESTRUTURA DE PASTAS ULTRA (CORRIGIDA)
// =============================================================================
async function createFolderStructureUltra(exibidora, tipo, accessToken, rootFolderId) {
    try {
        console.log('📁 Criando estrutura CORRIGIDA:', { exibidora, tipo, rootFolderId });

        // ✅ CORREÇÃO: rootFolderId JÁ É a pasta CheckingOOH
        // Não precisamos criar outra pasta CheckingOOH!
        
        // Passo 1: Criar pasta da Exibidora diretamente na CheckingOOH
        const exibidoraFolder = await findOrCreateFolderUltra(
            exibidora, 
            rootFolderId,  // <- Usar diretamente a pasta CheckingOOH existente
            accessToken
        );
        console.log('📂 Pasta Exibidora:', exibidoraFolder.id);

        // Passo 2: Criar pasta do Tipo (Entrada/Saida) dentro da Exibidora
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolderUltra(
            tipoFolderName, 
            exibidoraFolder.id, 
            accessToken
        );
        console.log('📂 Pasta Tipo:', tipoFolder.id);

        return {
            folderId: tipoFolder.id,
            path: `CheckingOOH/${exibidora}/${tipoFolderName}`
        };

    } catch (error) {
        console.error('❌ Erro na estrutura:', error);
        throw error;
    }
}

// =============================================================================
// 🔍 BUSCAR OU CRIAR PASTA ULTRA
// =============================================================================
async function findOrCreateFolderUltra(folderName, parentId, accessToken) {
    try {
        console.log(`🔍 Buscando pasta "${folderName}" em ${parentId}...`);

        // Buscar pasta existente
        const escapedName = folderName.replace(/'/g, "\\'");
        const query = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
        
        const searchResponse = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!searchResponse.ok) {
            throw new Error(`Erro ao buscar pasta: ${searchResponse.status}`);
        }

        const searchResult = await searchResponse.json();

        if (searchResult.files?.length > 0) {
            console.log(`✅ Pasta "${folderName}" encontrada`);
            return searchResult.files[0];
        }

        // Criar nova pasta
        console.log(`📁 Criando pasta "${folderName}"...`);
        
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId]
            })
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Erro ao criar pasta: ${createResponse.status} - ${errorText}`);
        }

        const newFolder = await createResponse.json();
        console.log(`✅ Pasta "${folderName}" criada:`, newFolder.id);
        return newFolder;

    } catch (error) {
        console.error(`❌ Erro com pasta ${folderName}:`, error);
        throw error;
    }
}

// =============================================================================
// 📤 UPLOAD SIMPLES ULTRA (MÉTODO CORRETO)
// =============================================================================
async function uploadFileSimpleUltra(fileBuffer, fileName, mimeType, parentId, accessToken) {
    try {
        console.log('📤 Upload simples ultra CORRIGIDO:', { fileName, mimeType, parentId });

        // Usar uploadType=multipart para enviar metadata + conteúdo em uma única requisição
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;

        // Preparar metadata
        const metadata = {
            name: fileName,
            parents: [parentId]
        };

        // Construir corpo multipart
        let body = delimiter;
        body += 'Content-Type: application/json\r\n\r\n';
        body += JSON.stringify(metadata) + delimiter;
        body += `Content-Type: ${mimeType}\r\n`;
        body += 'Content-Transfer-Encoding: base64\r\n\r\n';
        
        // Converter buffer para base64
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        body += base64Data;
        body += close_delim;

        console.log('📦 Corpo preparado, tamanho:', body.length);

        // Fazer upload
        const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body: body
            }
        );

        console.log('📡 Response status:', uploadResponse.status);

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Erro detalhado:', errorText);
            throw new Error(`Erro no upload: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload simples CORRIGIDO concluído:', uploadResult.id);
        return uploadResult;

    } catch (error) {
        console.error('❌ Erro no upload simples CORRIGIDO:', error);
        throw error;
    }
}

// =============================================================================
// 🌐 TORNAR ARQUIVO PÚBLICO ULTRA
// =============================================================================
async function makeFilePublicUltra(fileId, accessToken) {
    try {
        console.log('🌐 Tornando arquivo público:', fileId);

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone'
            })
        });

        if (response.ok) {
            console.log('✅ Arquivo tornado público');
        } else {
            console.warn('⚠️ Não foi possível tornar público:', response.status);
            // Não falhar por causa disso
        }
    } catch (error) {
        console.warn('⚠️ Erro ao tornar público:', error);
        // Não falhar por causa disso
    }
}

// =============================================================================
// 🔧 FUNÇÕES AUXILIARES ULTRA
// =============================================================================
function base64UrlEncodeUltra(data) {
    let base64;
    if (typeof data === 'string') {
        // Para strings, usar encodeURIComponent para lidar com caracteres especiais
        base64 = btoa(unescape(encodeURIComponent(data)));
    } else {
        // Para ArrayBuffer
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    // Converter para base64url
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToBinaryUltra(pem) {
    try {
        console.log('🔐 Convertendo PEM para binary...');
        
        // Remover header/footer e quebras de linha
        const lines = pem.split('\n');
        const encoded = lines
            .filter(line => !line.includes('-----'))
            .join('');
        
        if (!encoded) {
            throw new Error('PEM vazio após limpeza');
        }

        console.log('📏 Base64 length:', encoded.length);
        
        // Decodificar base64
        const binary = atob(encoded);
        const bytes = new Uint8Array(binary.length);
        
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        console.log('✅ PEM convertido:', bytes.length, 'bytes');
        return bytes.buffer;
        
    } catch (error) {
        console.error('❌ Erro ao converter PEM:', error);
        throw new Error(`Chave privada inválida: ${error.message}`);
    }
}
