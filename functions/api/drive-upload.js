// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (VERSÃO CORRIGIDA)
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
        console.log('📤 Iniciando upload para Google Drive...');

        if (context.request.method !== 'POST') {
            throw new Error('Método não permitido');
        }

        // ⚠️ CORREÇÃO 1: Verificar variáveis de ambiente primeiro
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const sharedFolderId = context.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        
        if (!serviceAccountKey) {
            console.error('❌ Service Account Key não configurada');
            throw new Error('Credenciais do Google Drive não configuradas');
        }

        console.log('✅ Variáveis de ambiente encontradas');

        // Processar FormData
        const formData = await context.request.formData();
        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');

        console.log('📋 Dados do upload:', {
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type,
            exibidora,
            pontoId,
            tipo
        });

        // Validar dados obrigatórios
        if (!file || !exibidora || !pontoId || !tipo) {
            throw new Error('Dados obrigatórios ausentes');
        }

        // Validar arquivo
        const validation = validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        console.log('✅ Validação passou');

        // ⚠️ CORREÇÃO 2: Obter token com mais logs
        console.log('🔑 Obtendo token de acesso...');
        const accessToken = await getAccessTokenCorrected(context.env);
        console.log('✅ Token obtido com sucesso');

        // ⚠️ CORREÇÃO 3: Upload com melhores logs
        console.log('📤 Iniciando upload do arquivo...');
        const uploadResult = await uploadToGoogleDriveCorrected(
            file,
            exibidora,
            pontoId,
            tipo,
            accessToken,
            sharedFolderId
        );

        console.log('✅ Upload concluído:', uploadResult.fileId);

        return new Response(JSON.stringify(uploadResult), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro detalhado no upload:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        return new Response(JSON.stringify({
            error: 'Erro no upload',
            details: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers
        });
    }
}

// =============================================================================
// ✅ VALIDAR ARQUIVO
// =============================================================================
function validateFile(file) {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/mov', 'video/avi', 'video/quicktime'
    ];

    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: `Tipo não permitido: ${file.type}` };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'Arquivo muito grande (máx: 100MB)' };
    }

    return { valid: true };
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO (CORRIGIDO)
// =============================================================================
async function getAccessTokenCorrected(env) {
    try {
        console.log('🔑 Processando Service Account...');
        
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
            console.log('✅ Service Account JSON parsed');
        } catch (parseError) {
            console.error('❌ Erro ao fazer parse do JSON:', parseError);
            throw new Error('Service Account JSON inválido');
        }

        // Verificar campos obrigatórios
        if (!serviceAccount.client_email || !serviceAccount.private_key) {
            throw new Error('Service Account incompleta - faltam client_email ou private_key');
        }

        console.log('📧 Client email:', serviceAccount.client_email);

        // ⚠️ CORREÇÃO 4: JWT com implementação mais robusta
        const header = { alg: 'RS256', typ: 'JWT' };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        console.log('🔧 Criando JWT...');
        const token = await createJWTCorrected(header, payload, serviceAccount.private_key);
        console.log('✅ JWT criado');

        // Trocar JWT por access token
        console.log('🔄 Trocando JWT por access token...');
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro OAuth2:', response.status, errorText);
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
// 🔧 CRIAR JWT (VERSÃO CORRIGIDA)
// =============================================================================
async function createJWTCorrected(header, payload, privateKey) {
    try {
        // Base64URL encode
        const headerB64 = base64UrlEncode(JSON.stringify(header));
        const payloadB64 = base64UrlEncode(JSON.stringify(payload));
        const message = `${headerB64}.${payloadB64}`;
        
        console.log('🔐 Processando chave privada...');
        
        // ⚠️ CORREÇÃO 5: Preparar chave privada corretamente
        let pemKey = privateKey;
        if (!pemKey.includes('-----BEGIN PRIVATE KEY-----')) {
            // Se não tem header/footer, adicionar
            pemKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
        }
        
        // Garantir quebras de linha corretas
        pemKey = pemKey.replace(/\\n/g, '\n');
        
        console.log('🔑 Importando chave...');
        
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
        
        console.log('✅ Chave importada');
        
        // Assinar
        console.log('✍️ Assinando JWT...');
        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            keyData,
            new TextEncoder().encode(message)
        );
        
        const signatureB64 = base64UrlEncode(signature);
        const jwt = `${message}.${signatureB64}`;
        
        console.log('✅ JWT assinado');
        return jwt;

    } catch (error) {
        console.error('❌ Erro ao criar JWT:', error);
        throw new Error(`Falha na criação do JWT: ${error.message}`);
    }
}

// =============================================================================
// 📤 UPLOAD PARA GOOGLE DRIVE (VERSÃO CORRIGIDA)
// =============================================================================
async function uploadToGoogleDriveCorrected(file, exibidora, pontoId, tipo, accessToken, sharedFolderId) {
    try {
        console.log('📂 Verificando acesso à pasta raiz...');

        // Verificar acesso à pasta compartilhada
        const folderCheck = await fetch(`https://www.googleapis.com/drive/v3/files/${sharedFolderId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!folderCheck.ok) {
            console.error('❌ Sem acesso à pasta:', folderCheck.status);
            throw new Error(`Sem acesso à pasta compartilhada: ${folderCheck.status}`);
        }

        console.log('✅ Acesso à pasta confirmado');

        // ⚠️ CORREÇÃO 6: Criar estrutura com logs detalhados
        console.log('📁 Criando estrutura de pastas...');
        const folderStructure = await createFolderStructureCorrected(exibidora, tipo, accessToken, sharedFolderId);
        console.log('✅ Estrutura criada:', folderStructure.path);

        // ⚠️ CORREÇÃO 7: Nome único e seguro
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const extension = cleanFileName.split('.').pop();
        const uniqueFileName = `${tipo}_${pontoId}_${timestamp}.${extension}`;

        console.log('📝 Nome do arquivo:', uniqueFileName);

        // ⚠️ CORREÇÃO 8: Upload multipart corrigido
        console.log('📤 Fazendo upload do arquivo...');
        const fileBuffer = await file.arrayBuffer();
        const uploadResult = await uploadFileMultipartCorrected(
            fileBuffer,
            uniqueFileName,
            file.type,
            folderStructure.folderId,
            accessToken
        );

        console.log('✅ Arquivo enviado:', uploadResult.id);

        // Tornar arquivo público
        console.log('🌐 Tornando arquivo público...');
        await makeFilePublic(uploadResult.id, accessToken);

        return {
            success: true,
            fileId: uploadResult.id,
            fileName: uniqueFileName,
            fileUrl: `https://drive.google.com/uc?id=${uploadResult.id}`,
            downloadUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`,
            uploadDate: new Date().toISOString(),
            message: 'Upload realizado com sucesso'
        };

    } catch (error) {
        console.error('❌ Erro no upload:', error);
        throw new Error(`Falha no upload: ${error.message}`);
    }
}

// =============================================================================
// 📁 CRIAR ESTRUTURA DE PASTAS (CORRIGIDA)
// =============================================================================
async function createFolderStructureCorrected(exibidora, tipo, accessToken, rootFolderId) {
    try {
        console.log('📁 Criando estrutura:', { exibidora, tipo, rootFolderId });

        // Buscar ou criar pasta CheckingOOH
        let checkingFolder;
        if (rootFolderId === 'root') {
            checkingFolder = await findOrCreateFolder('CheckingOOH', rootFolderId, accessToken);
        } else {
            // Se já é a pasta CheckingOOH, usar diretamente
            checkingFolder = { id: rootFolderId };
        }

        console.log('📂 Pasta CheckingOOH:', checkingFolder.id);

        // Buscar ou criar pasta da Exibidora
        const exibidoraFolder = await findOrCreateFolder(exibidora, checkingFolder.id, accessToken);
        console.log('📂 Pasta Exibidora:', exibidoraFolder.id);

        // Buscar ou criar pasta do tipo
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolder(tipoFolderName, exibidoraFolder.id, accessToken);
        console.log('📂 Pasta Tipo:', tipoFolder.id);

        return {
            folderId: tipoFolder.id,
            path: `CheckingOOH/${exibidora}/${tipoFolderName}`
        };

    } catch (error) {
        console.error('❌ Erro ao criar estrutura:', error);
        throw error;
    }
}

// =============================================================================
// 🔍 BUSCAR OU CRIAR PASTA (CORRIGIDA)
// =============================================================================
async function findOrCreateFolder(folderName, parentId, accessToken) {
    try {
        console.log(`🔍 Buscando pasta "${folderName}" em ${parentId}...`);

        // Escapar nome da pasta para query
        const escapedName = folderName.replace(/'/g, "\\'");
        const query = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!searchResponse.ok) {
            throw new Error(`Erro ao buscar pasta: ${searchResponse.status}`);
        }

        const searchResult = await searchResponse.json();

        if (searchResult.files?.length > 0) {
            console.log(`✅ Pasta "${folderName}" encontrada`);
            return searchResult.files[0];
        }

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
        console.log(`✅ Pasta "${folderName}" criada`);
        return newFolder;

    } catch (error) {
        console.error(`❌ Erro com pasta ${folderName}:`, error);
        throw error;
    }
}

// =============================================================================
// 📤 UPLOAD MULTIPART (CORRIGIDO)
// =============================================================================
async function uploadFileMultipartCorrected(fileBuffer, fileName, mimeType, parentId, accessToken) {
    try {
        console.log('📤 Upload multipart:', { fileName, mimeType, parentId });

        const metadata = {
            name: fileName,
            parents: [parentId]
        };

        // ⚠️ CORREÇÃO 9: Boundary único
        const boundary = `----formdata-checking-ooh-${Date.now()}`;
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;

        // Corpo da requisição multipart
        const metadataJson = JSON.stringify(metadata);
        let body = '';
        body += delimiter;
        body += 'Content-Type: application/json\r\n\r\n';
        body += metadataJson;
        body += delimiter;
        body += `Content-Type: ${mimeType}\r\n\r\n`;

        // Converter para bytes
        const encoder = new TextEncoder();
        const bodyStart = encoder.encode(body);
        const bodyEnd = encoder.encode(close_delim);
        
        // Combinar arrays de bytes
        const totalLength = bodyStart.length + fileBuffer.byteLength + bodyEnd.length;
        const combinedBuffer = new Uint8Array(totalLength);
        
        combinedBuffer.set(bodyStart, 0);
        combinedBuffer.set(new Uint8Array(fileBuffer), bodyStart.length);
        combinedBuffer.set(bodyEnd, bodyStart.length + fileBuffer.byteLength);

        console.log('📊 Tamanho total:', totalLength);

        const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary="${boundary}"`
            },
            body: combinedBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Upload falhou:', uploadResponse.status, errorText);
            throw new Error(`Upload falhou: ${uploadResponse.status} - ${errorText}`);
        }

        const result = await uploadResponse.json();
        console.log('✅ Upload multipart concluído');
        return result;

    } catch (error) {
        console.error('❌ Erro no upload multipart:', error);
        throw error;
    }
}

// =============================================================================
// 🌐 TORNAR ARQUIVO PÚBLICO
// =============================================================================
async function makeFilePublic(fileId, accessToken) {
    try {
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
            console.warn('⚠️ Não foi possível tornar arquivo público:', response.status);
        }
    } catch (error) {
        console.warn('⚠️ Erro ao tornar arquivo público:', error);
        // Não falhar o upload por causa disso
    }
}

// =============================================================================
// 🔧 FUNÇÕES AUXILIARES
// =============================================================================
function base64UrlEncode(data) {
    let base64;
    if (typeof data === 'string') {
        base64 = btoa(unescape(encodeURIComponent(data)));
    } else {
        // ArrayBuffer
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToBinary(pem) {
    try {
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
    } catch (error) {
        console.error('❌ Erro ao processar PEM:', error);
        throw new Error('Chave privada inválida');
    }
}
