// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (VERSÃO V6 - ERROR HANDLING IMPROVED)
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

    let currentStep = 'INITIALIZATION';
    
    try {
        console.log('📤 === INICIANDO UPLOAD V6 - ERROR HANDLING IMPROVED ===');
        console.log('🆔 Versão: v6.0-error-handling - 2025-10-17T22:00:00Z');
        console.log('🕐 Timestamp:', new Date().toISOString());

        if (context.request.method !== 'POST') {
            currentStep = 'METHOD_CHECK';
            throw new Error('Método não permitido. Use POST.');
        }

        // ✅ ETAPA 1: VERIFICAR VARIÁVEIS DE AMBIENTE
        currentStep = 'ENV_VALIDATION';
        console.log('🔍 ETAPA 1: Verificando variáveis de ambiente...');
        
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const sharedFolderId = context.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        
        if (!serviceAccountKey) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY não está definida nas variáveis de ambiente');
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada. Por favor, configure no Cloudflare Pages.');
        }

        // Validar se é um JSON válido
        try {
            const testParse = JSON.parse(serviceAccountKey);
            if (!testParse.client_email || !testParse.private_key) {
                throw new Error('Service Account JSON incompleto');
            }
            console.log('✅ Service Account JSON válido');
            console.log('📧 Client email:', testParse.client_email);
        } catch (parseError) {
            console.error('❌ Erro ao validar Service Account JSON:', parseError.message);
            throw new Error(`Service Account JSON inválido: ${parseError.message}`);
        }

        console.log('📁 Folder ID configurado:', sharedFolderId);
        console.log('✅ ETAPA 1: Variáveis de ambiente OK');

        // ✅ ETAPA 2: PROCESSAR FORMDATA
        currentStep = 'FORMDATA_PARSING';
        console.log('🔍 ETAPA 2: Processando FormData...');
        
        let formData;
        try {
            formData = await context.request.formData();
        } catch (formError) {
            console.error('❌ Erro ao processar FormData:', formError.message);
            throw new Error(`Erro ao processar FormData: ${formError.message}`);
        }

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

        // Validação detalhada de cada campo
        if (!file) {
            throw new Error('Campo "file" ausente. Por favor, selecione um arquivo.');
        }
        if (!exibidora) {
            throw new Error('Campo "exibidora" ausente. Contexto de upload inválido.');
        }
        if (!pontoId) {
            throw new Error('Campo "pontoId" ausente. Contexto de upload inválido.');
        }
        if (!tipo || (tipo !== 'entrada' && tipo !== 'saida')) {
            throw new Error(`Campo "tipo" inválido: "${tipo}". Deve ser "entrada" ou "saida".`);
        }
        
        console.log('✅ ETAPA 2: FormData OK');

        // ✅ ETAPA 3: VALIDAR ARQUIVO
        currentStep = 'FILE_VALIDATION';
        console.log('🔍 ETAPA 3: Validando arquivo...');
        const validation = validateFileUltra(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        console.log('✅ ETAPA 3: Validação OK');

        // ✅ ETAPA 4: OBTER TOKEN (COM RETRY)
        currentStep = 'TOKEN_ACQUISITION';
        console.log('🔍 ETAPA 4: Obtendo token de acesso...');
        let accessToken;
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            try {
                accessToken = await getAccessTokenUltra(context.env);
                console.log('✅ ETAPA 4: Token obtido com sucesso');
                break;
            } catch (error) {
                attempts++;
                lastError = error;
                console.error(`❌ Tentativa ${attempts}/${maxAttempts} falhou:`, error.message);
                if (attempts >= maxAttempts) {
                    throw new Error(`Falha ao obter token após ${maxAttempts} tentativas. Último erro: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!accessToken) {
            throw new Error('Token de acesso não foi obtido após todas as tentativas');
        }

        // ✅ ETAPA 5: UPLOAD DO ARQUIVO
        currentStep = 'FILE_UPLOAD';
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

        console.log('🎉 === UPLOAD V6 CONCLUÍDO COM SUCESSO ===');
        return new Response(JSON.stringify(uploadResult), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 === ERRO DETALHADO NO UPLOAD ===');
        console.error('🔴 Etapa que falhou:', currentStep);
        console.error('📝 Mensagem:', error.message);
        console.error('📚 Stack:', error.stack);
        console.error('🏷️  Nome:', error.name);
        console.error('🕐 Timestamp:', new Date().toISOString());
        console.error('=====================================');
        
        // Determinar código de status apropriado
        let statusCode = 500;
        let errorType = 'INTERNAL_ERROR';
        
        if (currentStep === 'ENV_VALIDATION') {
            statusCode = 500;
            errorType = 'CONFIGURATION_ERROR';
        } else if (currentStep === 'FORMDATA_PARSING' || currentStep === 'FILE_VALIDATION') {
            statusCode = 400;
            errorType = 'INVALID_REQUEST';
        } else if (currentStep === 'TOKEN_ACQUISITION') {
            statusCode = 500;
            errorType = 'AUTHENTICATION_ERROR';
        } else if (currentStep === 'FILE_UPLOAD') {
            statusCode = 500;
            errorType = 'UPLOAD_ERROR';
        }
        
        return new Response(JSON.stringify({
            success: false,
            error: 'Erro no upload',
            errorType: errorType,
            errorStep: currentStep,
            details: error.message,
            timestamp: new Date().toISOString(),
            version: 'v6.0-error-handling'
        }), {
            status: statusCode,
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
        
        // Parse Service Account
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
            console.log('✅ Service Account parsed com sucesso');
        } catch (parseError) {
            console.error('❌ Erro ao fazer parse do Service Account JSON:', parseError.message);
            throw new Error(`Service Account JSON inválido: ${parseError.message}. Verifique se a variável GOOGLE_SERVICE_ACCOUNT_KEY está configurada corretamente.`);
        }

        // Validar campos obrigatórios
        const requiredFields = ['client_email', 'private_key', 'project_id'];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);
        
        if (missingFields.length > 0) {
            console.error('❌ Campos obrigatórios ausentes:', missingFields);
            throw new Error(`Service Account incompleta. Campos ausentes: ${missingFields.join(', ')}`);
        }

        console.log('📧 Client email:', serviceAccount.client_email);
        console.log('🏗️  Project ID:', serviceAccount.project_id);
        console.log('🔐 Private key presente:', !!serviceAccount.private_key);
        console.log('📏 Private key length:', serviceAccount.private_key?.length || 0);

        // Criar JWT
        console.log('🔧 Criando JWT...');
        let jwt;
        try {
            jwt = await createJWTUltra(serviceAccount);
            console.log('✅ JWT criado com sucesso');
            console.log('📏 JWT length:', jwt.length);
        } catch (jwtError) {
            console.error('❌ Erro ao criar JWT:', jwtError.message);
            throw new Error(`Falha na criação do JWT: ${jwtError.message}`);
        }

        // Trocar JWT por access token
        console.log('🔄 Trocando JWT por access token...');
        let tokenResponse;
        
        try {
            // Adicionar timeout de 10 segundos
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                console.error('❌ Timeout ao obter token do OAuth2');
                throw new Error('Timeout ao conectar com OAuth2. Tente novamente.');
            }
            console.error('❌ Erro na requisição OAuth2:', fetchError.message);
            throw new Error(`Erro ao conectar com OAuth2: ${fetchError.message}`);
        }

        console.log('📡 OAuth2 Response status:', tokenResponse.status);
        console.log('📡 OAuth2 Response statusText:', tokenResponse.statusText);

        if (!tokenResponse.ok) {
            let errorText;
            let errorData;
            
            try {
                errorText = await tokenResponse.text();
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            
            console.error('❌ Erro OAuth2:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                error: errorData.error,
                errorDescription: errorData.error_description
            });
            
            throw new Error(`OAuth2 falhou (${tokenResponse.status}): ${errorData.error_description || errorData.error || errorText}`);
        }

        let tokenData;
        try {
            tokenData = await tokenResponse.json();
        } catch (jsonError) {
            console.error('❌ Erro ao fazer parse da resposta OAuth2:', jsonError.message);
            throw new Error('Resposta inválida do OAuth2');
        }

        if (!tokenData.access_token) {
            console.error('❌ Access token ausente na resposta');
            throw new Error('Access token não retornado pelo OAuth2');
        }

        console.log('✅ Access token obtido com sucesso');
        console.log('⏱️  Token expires in:', tokenData.expires_in, 'segundos');
        
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token:', error.message);
        console.error('📚 Stack trace:', error.stack);
        throw error;
    }
}

// =============================================================================
// 🔧 CRIAR JWT ULTRA ROBUSTO
// =============================================================================
async function createJWTUltra(serviceAccount) {
    try {
        console.log('🔧 Criando JWT ultra robusto...');

        // Criar header
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        // Criar payload
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
            exp: payload.exp,
            validFor: '3600 segundos (1 hora)'
        });

        // Codificar header e payload
        let headerB64, payloadB64;
        try {
            headerB64 = base64UrlEncodeUltra(JSON.stringify(header));
            payloadB64 = base64UrlEncodeUltra(JSON.stringify(payload));
        } catch (encodeError) {
            console.error('❌ Erro ao codificar header/payload:', encodeError.message);
            throw new Error(`Erro na codificação Base64: ${encodeError.message}`);
        }

        const message = `${headerB64}.${payloadB64}`;
        console.log('📝 Mensagem para assinar criada (length:', message.length, ')');

        // Processar chave privada
        console.log('🔐 Processando chave privada...');
        
        let privateKey = serviceAccount.private_key;
        
        // Normalizar quebras de linha
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        // Validar formato PEM
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            console.warn('⚠️ Chave não possui header PEM, adicionando...');
            privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
        }
        
        if (!privateKey.includes('-----END PRIVATE KEY-----')) {
            console.error('❌ Chave privada malformada - falta footer');
            throw new Error('Chave privada inválida: formato PEM incorreto');
        }

        console.log('✅ Chave privada formatada corretamente');
        console.log('📏 Private key lines:', privateKey.split('\n').length);

        // Converter PEM para binário
        console.log('🔄 Convertendo PEM para binário...');
        let keyBinary;
        try {
            keyBinary = pemToBinaryUltra(privateKey);
            console.log('✅ PEM convertido, bytes:', keyBinary.byteLength);
        } catch (pemError) {
            console.error('❌ Erro ao converter PEM:', pemError.message);
            throw new Error(`Erro ao processar chave privada: ${pemError.message}`);
        }

        // Importar chave criptográfica
        console.log('🔑 Importando chave criptográfica...');
        let keyData;
        try {
            keyData = await crypto.subtle.importKey(
                'pkcs8',
                keyBinary,
                {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256'
                },
                false,
                ['sign']
            );
            console.log('✅ Chave importada com sucesso');
        } catch (importError) {
            console.error('❌ Erro ao importar chave:', importError.message);
            console.error('📚 Stack:', importError.stack);
            throw new Error(`Erro ao importar chave criptográfica: ${importError.message}. Verifique se a chave privada está no formato correto.`);
        }

        // Assinar JWT
        console.log('✍️ Assinando JWT...');
        let signature;
        try {
            signature = await crypto.subtle.sign(
                'RSASSA-PKCS1-v1_5',
                keyData,
                new TextEncoder().encode(message)
            );
            console.log('✅ JWT assinado com sucesso');
            console.log('📏 Signature bytes:', signature.byteLength);
        } catch (signError) {
            console.error('❌ Erro ao assinar JWT:', signError.message);
            throw new Error(`Erro ao assinar JWT: ${signError.message}`);
        }

        // Codificar assinatura
        const signatureB64 = base64UrlEncodeUltra(signature);
        const jwt = `${message}.${signatureB64}`;

        console.log('✅ JWT criado e assinado com sucesso');
        console.log('📏 JWT total length:', jwt.length);
        console.log('🔍 JWT parts:', {
            header: headerB64.length,
            payload: payloadB64.length,
            signature: signatureB64.length
        });

        return jwt;

    } catch (error) {
        console.error('❌ Erro ao criar JWT:', error.message);
        console.error('📚 Stack:', error.stack);
        throw new Error(`Falha na criação do JWT: ${error.message}`);
    }
}

// =============================================================================
// 📤 UPLOAD PARA GOOGLE DRIVE ULTRA
// =============================================================================
async function uploadToGoogleDriveUltra(file, exibidora, pontoId, tipo, accessToken, rootFolderId) {
    try {
        console.log('📤 Iniciando upload ultra...');
        console.log('📊 Parâmetros:', { exibidora, pontoId, tipo, rootFolderId });

        // ✅ PASSO 1: VERIFICAR ACESSO À PASTA RAIZ (COM SUPORTE A SHARED DRIVES)
        console.log('🔍 PASSO 1: Verificando acesso à pasta raiz...');
        
        let rootResponse;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            rootResponse = await fetch(
                `https://www.googleapis.com/drive/v3/files/${rootFolderId}?supportsAllDrives=true`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeoutId);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                console.error('❌ Timeout ao verificar pasta raiz');
                throw new Error('Timeout ao acessar Google Drive. Tente novamente.');
            }
            console.error('❌ Erro ao verificar pasta raiz:', fetchError.message);
            throw new Error(`Erro ao conectar com Google Drive: ${fetchError.message}`);
        }

        if (!rootResponse.ok) {
            console.error('❌ Sem acesso à pasta raiz. Status:', rootResponse.status);
            const errorText = await rootResponse.text();
            console.error('❌ Erro detalhado:', errorText);
            
            if (rootResponse.status === 404) {
                throw new Error(`Pasta raiz não encontrada (ID: ${rootFolderId}). Verifique o GOOGLE_DRIVE_FOLDER_ID.`);
            } else if (rootResponse.status === 403) {
                throw new Error('Sem permissão para acessar a pasta raiz. Verifique as permissões do Service Account.');
            } else {
                throw new Error(`Erro ao acessar pasta raiz: ${rootResponse.status} - ${errorText}`);
            }
        }

        const rootData = await rootResponse.json();
        console.log('✅ PASSO 1: Acesso à pasta confirmado:', rootData.name);

        // ✅ PASSO 2: CRIAR ESTRUTURA DE PASTAS
        console.log('📁 PASSO 2: Criando estrutura de pastas...');
        let folderStructure;
        try {
            folderStructure = await createFolderStructureUltra(
                exibidora, 
                tipo, 
                accessToken, 
                rootFolderId
            );
            console.log('✅ PASSO 2: Estrutura criada:', folderStructure.path);
        } catch (folderError) {
            console.error('❌ Erro ao criar estrutura de pastas:', folderError.message);
            throw new Error(`Erro ao criar pastas: ${folderError.message}`);
        }

        // ✅ PASSO 3: PREPARAR ARQUIVO
        console.log('📝 PASSO 3: Preparando arquivo...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const baseFileName = `${tipo}_${pontoId}_${timestamp}`;
        const uniqueFileName = `${baseFileName}.${fileExtension}`;

        console.log('📄 Nome final:', uniqueFileName);
        console.log('📊 Tipo MIME:', file.type);
        console.log('📏 Tamanho:', Math.round(file.size / 1024), 'KB');

        // ✅ PASSO 4: CONVERTER ARQUIVO PARA BUFFER
        console.log('💾 PASSO 4: Convertendo arquivo...');
        let fileBuffer;
        try {
            fileBuffer = await file.arrayBuffer();
            console.log('✅ PASSO 4: Buffer criado, size:', fileBuffer.byteLength, 'bytes');
        } catch (bufferError) {
            console.error('❌ Erro ao converter arquivo:', bufferError.message);
            throw new Error(`Erro ao processar arquivo: ${bufferError.message}`);
        }

        // ✅ PASSO 5: UPLOAD MULTIPART (COM SUPORTE A SHARED DRIVES)
        console.log('📤 PASSO 5: Fazendo upload multipart...');
        let uploadResult;
        try {
            uploadResult = await uploadFileMultipartUltra(
                fileBuffer,
                uniqueFileName,
                file.type,
                folderStructure.folderId,
                accessToken
            );
            console.log('✅ PASSO 5: Upload concluído. File ID:', uploadResult.id);
        } catch (uploadError) {
            console.error('❌ Erro no upload multipart:', uploadError.message);
            throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        // ✅ PASSO 6: TORNAR PÚBLICO
        console.log('🌐 PASSO 6: Tornando arquivo público...');
        try {
            await makeFilePublicUltra(uploadResult.id, accessToken);
            console.log('✅ PASSO 6: Arquivo público');
        } catch (publicError) {
            console.warn('⚠️ Não foi possível tornar o arquivo público:', publicError.message);
            // Não falhar se não conseguir tornar público
        }

        // ✅ PASSO 7: RETORNAR RESULTADO
        const result = {
            success: true,
            fileId: uploadResult.id,
            fileName: uniqueFileName,
            fileUrl: `https://drive.google.com/uc?id=${uploadResult.id}`,
            downloadUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`,
            uploadDate: new Date().toISOString(),
            message: 'Upload realizado com sucesso',
            folderPath: folderStructure.path,
            fileSize: file.size,
            mimeType: file.type
        };

        console.log('🎉 Upload ultra concluído com sucesso');
        console.log('📦 Resultado:', result);
        
        return result;

    } catch (error) {
        console.error('❌ Erro no upload ultra:', error.message);
        console.error('📚 Stack:', error.stack);
        throw error;
    }
}

// =============================================================================
// 📁 CRIAR ESTRUTURA DE PASTAS ULTRA
// =============================================================================
async function createFolderStructureUltra(exibidora, tipo, accessToken, rootFolderId) {
    try {
        console.log('📁 Criando estrutura:', { exibidora, tipo, rootFolderId });

        const exibidoraFolder = await findOrCreateFolderUltra(
            exibidora, 
            rootFolderId,
            accessToken
        );
        console.log('📁 Pasta Exibidora:', exibidoraFolder.id);

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
// 🔍 BUSCAR OU CRIAR PASTA ULTRA (COM SUPORTE A SHARED DRIVES)
// =============================================================================
async function findOrCreateFolderUltra(folderName, parentId, accessToken) {
    try {
        console.log(`🔍 Buscando pasta "${folderName}" em ${parentId}...`);

        const escapedName = folderName.replace(/'/g, "\\'");
        const query = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        // ✅ ADICIONADO: supportsAllDrives=true e includeItemsFromAllDrives=true
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        
        let searchResponse;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            searchResponse = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                throw new Error(`Timeout ao buscar pasta "${folderName}"`);
            }
            throw new Error(`Erro ao buscar pasta "${folderName}": ${fetchError.message}`);
        }

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.error('❌ Erro ao buscar pasta:', errorText);
            throw new Error(`Erro ao buscar pasta "${folderName}": ${searchResponse.status} - ${errorText}`);
        }

        const searchResult = await searchResponse.json();

        if (searchResult.files?.length > 0) {
            console.log(`✅ Pasta "${folderName}" encontrada:`, searchResult.files[0].id);
            return searchResult.files[0];
        }

        console.log(`📁 Criando pasta "${folderName}"...`);
        
        // ✅ ADICIONADO: supportsAllDrives=true
        let createResponse;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            createResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                throw new Error(`Timeout ao criar pasta "${folderName}"`);
            }
            throw new Error(`Erro ao criar pasta "${folderName}": ${fetchError.message}`);
        }

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ Erro ao criar pasta:', errorText);
            throw new Error(`Erro ao criar pasta "${folderName}": ${createResponse.status} - ${errorText}`);
        }

        const newFolder = await createResponse.json();
        console.log(`✅ Pasta "${folderName}" criada:`, newFolder.id);
        return newFolder;

    } catch (error) {
        console.error(`❌ Erro com pasta ${folderName}:`, error.message);
        throw error;
    }
}

// =============================================================================
// 📤 UPLOAD MULTIPART (COM SUPORTE A SHARED DRIVES)
// =============================================================================
async function uploadFileMultipartUltra(fileBuffer, fileName, mimeType, parentId, accessToken) {
    try {
        console.log('📤 Upload multipart:', { fileName, mimeType, parentId });
        console.log('📊 File buffer size:', fileBuffer.byteLength, 'bytes');

        const metadata = {
            name: fileName,
            parents: [parentId]
        };

        const boundary = '-------314159265358979323846';
        
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        // Parte 1: Metadata
        const metadataPart = delimiter + 
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata);

        console.log('📋 Metadata part criada');

        // Parte 2: Arquivo
        const filePart = delimiter +
            `Content-Type: ${mimeType}\r\n` +
            'Content-Transfer-Encoding: base64\r\n\r\n';

        console.log('📦 Convertendo arquivo para base64...');
        let base64File;
        try {
            base64File = btoa(
                new Uint8Array(fileBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                )
            );
            console.log('✅ Base64 criado, length:', base64File.length);
        } catch (base64Error) {
            console.error('❌ Erro ao converter para base64:', base64Error.message);
            throw new Error(`Erro ao processar arquivo: ${base64Error.message}`);
        }

        const multipartBody = metadataPart + filePart + base64File + closeDelimiter;
        
        console.log('📏 Multipart body size:', multipartBody.length, 'chars');
        console.log('📤 Enviando para Google Drive...');
        
        // ✅ ADICIONADO: supportsAllDrives=true
        let uploadResponse;
        try {
            // Timeout maior para upload (60 segundos)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            
            uploadResponse = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': `multipart/related; boundary=${boundary}`
                    },
                    body: multipartBody,
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeoutId);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                console.error('❌ Timeout no upload (60s)');
                throw new Error('Timeout no upload. O arquivo pode ser muito grande. Tente um arquivo menor.');
            }
            console.error('❌ Erro de rede no upload:', fetchError.message);
            throw new Error(`Erro de conexão no upload: ${fetchError.message}`);
        }

        console.log('📡 Upload response status:', uploadResponse.status);
        console.log('📡 Upload response statusText:', uploadResponse.statusText);

        if (!uploadResponse.ok) {
            let errorText;
            let errorData;
            
            try {
                errorText = await uploadResponse.text();
                errorData = JSON.parse(errorText);
                console.error('❌ Erro no upload (JSON):', errorData);
            } catch {
                console.error('❌ Erro no upload (texto):', errorText);
                errorData = { error: { message: errorText } };
            }
            
            const errorMessage = errorData.error?.message || errorText || 'Erro desconhecido';
            throw new Error(`Upload falhou (${uploadResponse.status}): ${errorMessage}`);
        }

        let uploadResult;
        try {
            uploadResult = await uploadResponse.json();
        } catch (jsonError) {
            console.error('❌ Erro ao fazer parse da resposta:', jsonError.message);
            throw new Error('Resposta inválida do Google Drive após upload');
        }

        console.log('✅ Upload multipart concluído com sucesso');
        console.log('📦 File ID:', uploadResult.id);
        console.log('📄 File name:', uploadResult.name);
        
        return uploadResult;

    } catch (error) {
        console.error('❌ Erro no upload multipart:', error.message);
        console.error('📚 Stack:', error.stack);
        throw error;
    }
}

// =============================================================================
// 🌐 TORNAR ARQUIVO PÚBLICO ULTRA (COM SUPORTE A SHARED DRIVES)
// =============================================================================
async function makeFilePublicUltra(fileId, accessToken) {
    try {
        console.log('🌐 Tornando arquivo público:', fileId);

        // ✅ ADICIONADO: supportsAllDrives=true
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
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
        }
    } catch (error) {
        console.warn('⚠️ Erro ao tornar público:', error);
    }
}

// =============================================================================
// 🔧 FUNÇÕES AUXILIARES ULTRA
// =============================================================================
function base64UrlEncodeUltra(data) {
    let base64;
    if (typeof data === 'string') {
        base64 = btoa(unescape(encodeURIComponent(data)));
    } else {
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToBinaryUltra(pem) {
    try {
        console.log('🔐 Convertendo PEM para binary...');
        console.log('📏 PEM input length:', pem.length);
        
        if (!pem || typeof pem !== 'string') {
            throw new Error('PEM inválido: input vazio ou não é string');
        }
        
        const lines = pem.split('\n');
        console.log('📋 PEM tem', lines.length, 'linhas');
        
        const encoded = lines
            .filter(line => !line.includes('-----'))
            .join('');
        
        if (!encoded) {
            console.error('❌ PEM vazio após remover headers');
            throw new Error('Chave privada inválida: PEM vazio após limpeza');
        }

        console.log('📏 Base64 content length:', encoded.length);
        
        // Validar base64
        if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) {
            console.error('❌ PEM contém caracteres inválidos para base64');
            throw new Error('Chave privada inválida: formato base64 inválido');
        }
        
        let binary;
        try {
            binary = atob(encoded);
        } catch (atobError) {
            console.error('❌ Erro no atob:', atobError.message);
            throw new Error(`Erro ao decodificar base64: ${atobError.message}`);
        }
        
        console.log('📏 Binary length:', binary.length);
        
        if (binary.length === 0) {
            throw new Error('Chave privada inválida: binary vazio após decodificação');
        }
        
        const bytes = new Uint8Array(binary.length);
        
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        console.log('✅ PEM convertido com sucesso:', bytes.length, 'bytes');
        
        // Validar tamanho mínimo (chaves RSA geralmente têm pelo menos 1000 bytes)
        if (bytes.length < 100) {
            console.warn('⚠️ Chave muito pequena:', bytes.length, 'bytes');
            throw new Error('Chave privada suspeita: tamanho muito pequeno');
        }
        
        return bytes.buffer;
        
    } catch (error) {
        console.error('❌ Erro ao converter PEM:', error.message);
        console.error('📚 Stack:', error.stack);
        throw new Error(`Chave privada inválida: ${error.message}`);
    }
}
