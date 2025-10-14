// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (VERSÃO FINAL CORRIGIDA)
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
        console.log('📤 Iniciando upload para pasta compartilhada');

        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const sharedFolderId = context.env.GOOGLE_DRIVE_FOLDER_ID;
        
        if (!serviceAccountKey || !sharedFolderId) {
            return new Response(JSON.stringify({
                error: 'Credenciais não configuradas'
            }), { status: 500, headers });
        }

        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({
                error: 'Método não permitido'
            }), { status: 405, headers });
        }

        const formData = await context.request.formData();
        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');

        console.log('📋 Upload:', {
            fileName: file?.name,
            fileSize: file?.size,
            exibidora,
            pontoId,
            tipo
        });

        if (!file || !exibidora || !pontoId || !tipo) {
            return new Response(JSON.stringify({
                error: 'Dados obrigatórios ausentes'
            }), { status: 400, headers });
        }

        const validation = validateFile(file);
        if (!validation.valid) {
            return new Response(JSON.stringify({
                error: validation.error
            }), { status: 400, headers });
        }

        const accessToken = await getAccessToken(context.env);
        
        const uploadResult = await uploadToSharedFolder(
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
        console.error('💥 Erro no upload:', error);
        return new Response(JSON.stringify({
            error: 'Erro interno do servidor',
            details: error.message
        }), { status: 500, headers });
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
// 🔑 OBTER TOKEN DE ACESSO
// =============================================================================
async function getAccessToken(env) {
    try {
        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);

        const header = { alg: 'RS256', typ: 'JWT' };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const token = await createJWT(header, payload, serviceAccount.private_key);

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: token
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth2 falhou: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 CRIAR JWT
// =============================================================================
async function createJWT(header, payload, privateKey) {
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const message = `${headerB64}.${payloadB64}`;
    
    const pemKey = privateKey.replace(/\n/g, '\n');
    const keyData = await crypto.subtle.importKey(
        'pkcs8', pemToBinary(pemKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );
    
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5', keyData, new TextEncoder().encode(message)
    );
    
    const signatureB64 = base64UrlEncode(signature);
    return `${message}.${signatureB64}`;
}

// =============================================================================
// 📂 UPLOAD PARA PASTA COMPARTILHADA
// =============================================================================
async function uploadToSharedFolder(file, exibidora, pontoId, tipo, accessToken, sharedFolderId) {
    try {
        console.log('📂 Upload para:', sharedFolderId);

        // Verificar acesso à pasta
        const folderCheck = await fetch(`https://www.googleapis.com/drive/v3/files/${sharedFolderId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!folderCheck.ok) {
            throw new Error(`Sem acesso à pasta: ${folderCheck.status}`);
        }

        // Criar estrutura de subpastas
        const folderPath = await createFolderStructure(exibidora, tipo, accessToken, sharedFolderId);
        
        // Nome único do arquivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.name.split('.').pop();
        const uniqueFileName = `${tipo}_${pontoId}_${timestamp}.${extension}`;

        // Upload
        const fileBuffer = await file.arrayBuffer();
        const uploadResult = await uploadFileMultipart(
            fileBuffer, uniqueFileName, file.type, folderPath.folderId, 
            accessToken, exibidora, pontoId, tipo
        );

        // Tornar público
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
        throw error;
    }
}

// =============================================================================
// 📁 CRIAR ESTRUTURA (CORRIGIDO - SEM DUPLICAR CheckingOOH)
// =============================================================================
async function createFolderStructure(exibidora, tipo, accessToken, sharedFolderId) {
    try {
        console.log('�� Criando estrutura na pasta compartilhada');

        // ✅ Usar pasta compartilhada diretamente como raiz
        const exibidoraFolder = await findOrCreateFolder(exibidora, sharedFolderId, accessToken);
        
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolder(tipoFolderName, exibidoraFolder.id, accessToken);

        return {
            folderId: tipoFolder.id,
            path: `${exibidora}/${tipoFolderName}`
        };

    } catch (error) {
        console.error('❌ Erro ao criar estrutura:', error);
        throw error;
    }
}

// =============================================================================
// 🔍 BUSCAR OU CRIAR PASTA
// =============================================================================
async function findOrCreateFolder(folderName, parentId, accessToken) {
    try {
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!searchResponse.ok) {
            throw new Error(`Erro ao buscar pasta: ${searchResponse.status}`);
        }

        const searchResult = await searchResponse.json();

        if (searchResult.files?.length > 0) {
            console.log(`📁 Pasta encontrada: ${folderName}`);
            return searchResult.files[0];
        }

        console.log(`📁 Criando pasta: ${folderName}`);
        
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
        console.log(`✅ Pasta criada: ${folderName}`);
        return newFolder;

    } catch (error) {
        console.error(`❌ Erro com pasta ${folderName}:`, error);
        throw error;
    }
}

// =============================================================================
// 📤 UPLOAD MULTIPART
// =============================================================================
async function uploadFileMultipart(fileBuffer, fileName, mimeType, parentId, accessToken, exibidora, pontoId, tipo) {
    try {
        const metadata = {
            name: fileName,
            parents: [parentId],
            description: `${tipo} - ${pontoId} - ${exibidora}`
        };

        const boundary = '-------314159265358979323846';
        const delimiter = '\r\n--' + boundary + '\r\n';
        const close_delim = '\r\n--' + boundary + '--';

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${mimeType}\r\n\r\n`;

        const multipartRequestBodyBuffer = new TextEncoder().encode(multipartRequestBody);
        const closeDelimBuffer = new TextEncoder().encode(close_delim);

        const totalSize = multipartRequestBodyBuffer.length + fileBuffer.byteLength + closeDelimBuffer.length;
        const combinedBuffer = new Uint8Array(totalSize);
        
        combinedBuffer.set(multipartRequestBodyBuffer, 0);
        combinedBuffer.set(new Uint8Array(fileBuffer), multipartRequestBodyBuffer.length);
        combinedBuffer.set(closeDelimBuffer, multipartRequestBodyBuffer.length + fileBuffer.byteLength);

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
            throw new Error(`Upload falhou: ${uploadResponse.status} - ${errorText}`);
        }

        return await uploadResponse.json();

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
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });
        console.log('✅ Arquivo público');
    } catch (error) {
        console.warn('⚠️ Erro ao tornar público:', error);
    }
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
