// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD
// =============================================================================

export async function onRequest(context) {
    // Permitir CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Responder OPTIONS para CORS preflight
    if (context.request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers
        });
    }

    try {
        console.log('📤 Iniciando upload para Google Drive...');

        // Verificar método
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ 
                error: 'Método não permitido' 
            }), {
                status: 405,
                headers
            });
        }

        // Processar FormData
        const formData = await context.request.formData();
        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');
        const databaseId = formData.get('databaseId'); // ✅ NOVO: ID da campanha

        console.log('📋 Parâmetros do upload:', {
            fileName: file?.name,
            fileSize: file?.size,
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo,
            databaseId: databaseId // ✅ NOVO
        });

        // Validar parâmetros
        if (!file || !exibidora || !pontoId || !tipo || !databaseId) { // ✅ ALTERADO: Validar databaseId
            return new Response(JSON.stringify({ 
                error: 'Parâmetros obrigatórios não fornecidos',
                missing: {
                    file: !file,
                    exibidora: !exibidora,
                    pontoId: !pontoId,
                    tipo: !tipo,
                    databaseId: !databaseId // ✅ NOVO
                }
            }), {
                status: 400,
                headers
            });
        }

        // Verificar variáveis de ambiente
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        
        if (!serviceAccountKey) {
            return new Response(JSON.stringify({ 
                error: 'Credenciais do Google Drive não configuradas' 
            }), {
                status: 500,
                headers
            });
        }

        // Obter token de acesso
        const accessToken = await getAccessToken(context.env);

        // Fazer upload
        const uploadResult = await uploadFileToGoogleDrive(
            file, 
            exibidora, 
            pontoId, 
            tipo,
            databaseId, // ✅ NOVO: Passar databaseId
            accessToken,
            context.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
        );

        return new Response(JSON.stringify(uploadResult), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro no upload:', error);
        return new Response(JSON.stringify({ 
            error: 'Erro interno do servidor',
            details: error.message
        }), {
            status: 500,
            headers
        });
    }
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO
// =============================================================================
async function getAccessToken(env) {
    try {
        console.log('🔑 Obtendo token de acesso...');

        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            throw new Error('Service Account Key não configurada');
        }

        return await getServiceAccountToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);

    } catch (error) {
        console.error('❌ Erro ao obter token de acesso:', error);
        throw error;
    }
}

// =============================================================================
// 🔐 OBTER TOKEN DA SERVICE ACCOUNT
// =============================================================================
async function getServiceAccountToken(serviceAccountKeyJson) {
    try {
        const serviceAccount = JSON.parse(serviceAccountKeyJson);
        
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

        const token = await createJWT(header, payload, serviceAccount.private_key);

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
            throw new Error(`Erro OAuth2: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token da service account:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 CRIAR JWT COM ASSINATURA
// =============================================================================
async function createJWT(header, payload, privateKey) {
    try {
        const headerB64 = base64UrlEncode(JSON.stringify(header));
        const payloadB64 = base64UrlEncode(JSON.stringify(payload));
        
        const message = `${headerB64}.${payloadB64}`;
        
        const pemKey = privateKey.replace(/\n/g, '\n');
        
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

// =============================================================================
// 🔧 FUNÇÕES AUXILIARES PARA JWT
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

// =============================================================================
// 📤 FAZER UPLOAD PARA GOOGLE DRIVE
// =============================================================================
async function uploadFileToGoogleDrive(file, exibidora, pontoId, tipo, databaseId, accessToken, rootFolderId) { // ✅ NOVO: Receber databaseId
    try {
        console.log('📤 Fazendo upload para Google Drive...', { 
            fileName: file.name, 
            exibidora, 
            pontoId, 
            tipo,
            databaseId // ✅ NOVO
        });

        // ✅ ALTERADO: Criar/obter estrutura de pastas com databaseId
        const folderPath = await ensureFolderPath(exibidora, tipo, databaseId, accessToken, rootFolderId);
        
        if (!folderPath) {
            throw new Error('Falha ao criar/obter estrutura de pastas');
        }

        console.log('📁 Pasta destino:', folderPath.id);

        // Gerar nome único do arquivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileExtension = file.name.split('.').pop();
        const fileName = `${tipo}_${pontoId}_${timestamp}.${fileExtension}`;

        console.log('📝 Nome do arquivo:', fileName);

        // Converter arquivo para ArrayBuffer
        const fileBuffer = await file.arrayBuffer();

        // Criar metadata do arquivo
        const metadata = {
            name: fileName,
            parents: [folderPath.id],
            mimeType: file.type
        };

        // Upload multipart
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const closeDelim = "\r\n--" + boundary + "--";

        const metadataPart = delimiter + 
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata);

        const dataPart = delimiter +
            `Content-Type: ${file.type}\r\n` +
            'Content-Transfer-Encoding: base64\r\n\r\n' +
            arrayBufferToBase64(fileBuffer);

        const multipartBody = new TextEncoder().encode(metadataPart + dataPart + closeDelim);

        // Fazer upload
        const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Erro no upload: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadedFile = await uploadResponse.json();

        console.log('✅ Upload concluído:', uploadedFile.id);

        return {
            success: true,
            fileId: uploadedFile.id,
            fileName: fileName,
            fileUrl: `https://drive.google.com/file/d/${uploadedFile.id}/view`,
            folderPath: folderPath.path
        };

    } catch (error) {
        console.error('❌ Erro no upload para Google Drive:', error);
        throw error;
    }
}

// =============================================================================
// 📁 GARANTIR ESTRUTURA DE PASTAS (COM CAMPANHA)
// =============================================================================
async function ensureFolderPath(exibidora, tipo, databaseId, accessToken, rootFolderId) { // ✅ NOVO: Receber databaseId
    try {
        console.log('📁 Garantindo estrutura de pastas...', { exibidora, tipo, databaseId });

        // Pasta raiz: CheckingOOH
        const checkingFolder = await findOrCreateFolder('CheckingOOH', rootFolderId, accessToken);
        
        // Pasta da Exibidora
        const exibidoraFolder = await findOrCreateFolder(exibidora, checkingFolder.id, accessToken);
        
        // ✅ NOVO: Pasta da Campanha (databaseId)
        const campanhaFolder = await findOrCreateFolder(databaseId, exibidoraFolder.id, accessToken);
        
        // Pasta do Tipo (Entrada ou Saida)
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolder(tipoFolderName, campanhaFolder.id, accessToken);

        console.log('✅ Estrutura de pastas criada/obtida');

        return {
            id: tipoFolder.id,
            path: `CheckingOOH/${exibidora}/${databaseId}/${tipoFolderName}` // ✅ ALTERADO: Incluir databaseId no path
        };

    } catch (error) {
        console.error('❌ Erro ao garantir estrutura de pastas:', error);
        return null;
    }
}

// =============================================================================
// 📁 ENCONTRAR OU CRIAR PASTA
// =============================================================================
async function findOrCreateFolder(folderName, parentId, accessToken) {
    try {
        // Primeiro, tentar encontrar a pasta
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!searchResponse.ok) {
            throw new Error(`Erro ao buscar pasta: ${searchResponse.status}`);
        }

        const searchResult = await searchResponse.json();
        
        // Se encontrou, retornar
        if (searchResult.files && searchResult.files.length > 0) {
            console.log(`📂 Pasta "${folderName}" encontrada:`, searchResult.files[0].id);
            return searchResult.files[0];
        }

        // Se não encontrou, criar
        console.log(`📂 Criando pasta "${folderName}"...`);
        
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
        console.error(`❌ Erro ao encontrar/criar pasta "${folderName}":`, error);
        throw error;
    }
}

// =============================================================================
// 🔧 CONVERTER ARRAYBUFFER PARA BASE64
// =============================================================================
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
