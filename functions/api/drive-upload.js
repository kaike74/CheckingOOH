// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (VERSÃO FINAL)
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
        console.log('📤 Iniciando upload real para Google Drive');

        // Verificar variáveis de ambiente
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const driveFolder = context.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        
        if (!serviceAccountKey) {
            return new Response(JSON.stringify({
                error: 'Service Account não configurada'
            }), { status: 500, headers });
        }

        // Verificar método
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({
                error: 'Método não permitido'
            }), { status: 405, headers });
        }

        // Processar FormData
        const formData = await context.request.formData();
        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');

        console.log('📋 Dados do upload:', {
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

        // Validar arquivo
        const validation = validateFile(file);
        if (!validation.valid) {
            return new Response(JSON.stringify({
                error: validation.error
            }), { status: 400, headers });
        }

        // Obter token de acesso
        const accessToken = await getAccessToken(context.env);
        console.log('✅ Token obtido para upload');

        // Fazer upload real
        const uploadResult = await uploadFileToGoogleDrive(
            file,
            exibidora,
            pontoId,
            tipo,
            accessToken,
            driveFolder
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
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/mov',
        'video/avi',
        'video/quicktime'
    ];

    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Tipo de arquivo não permitido: ${file.type}`
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'Arquivo muito grande. Máximo: 100MB'
        };
    }

    return { valid: true };
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO
// =============================================================================
async function getAccessToken(env) {
    try {
        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);

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
// 📂 UPLOAD PARA GOOGLE DRIVE (IMPLEMENTAÇÃO REAL)
// =============================================================================
async function uploadFileToGoogleDrive(file, exibidora, pontoId, tipo, accessToken, rootFolderId) {
    try {
        console.log('📂 Executando upload real...');

        // 1. Criar estrutura de pastas
        const folderPath = await createFolderStructure(exibidora, tipo, accessToken, rootFolderId);
        console.log('📁 Pasta de destino:', folderPath.folderId);

        // 2. Gerar nome único
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.name.split('.').pop();
        const uniqueFileName = `${tipo}_${pontoId}_${timestamp}.${extension}`;

        console.log('📝 Nome do arquivo:', uniqueFileName);

        // 3. Converter arquivo para ArrayBuffer
        const fileBuffer = await file.arrayBuffer();
        console.log('📦 Arquivo convertido:', fileBuffer.byteLength, 'bytes');

        // 4. Upload usando resumable upload (melhor para arquivos grandes)
        const uploadResult = await uploadFileResumable(
            fileBuffer,
            uniqueFileName,
            file.type,
            folderPath.folderId,
            accessToken,
            exibidora,
            pontoId,
            tipo
        );

        console.log('✅ Upload finalizado:', uploadResult.id);

        // 5. Tornar arquivo público
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
// 📤 UPLOAD RESUMABLE (MAIS CONFIÁVEL)
// =============================================================================
async function uploadFileResumable(fileBuffer, fileName, mimeType, parentId, accessToken, exibidora, pontoId, tipo) {
    try {
        console.log('🚀 Iniciando upload resumable...');

        // Metadados do arquivo
        const metadata = {
            name: fileName,
            parents: [parentId],
            description: `Arquivo de ${tipo} para ponto ${pontoId} - ${exibidora}`
        };

        // 1. Iniciar sessão de upload
        const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            throw new Error(`Erro ao iniciar upload: ${initResponse.status} - ${errorText}`);
        }

        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('URL de upload não recebida');
        }

        console.log('📍 URL de upload obtida');

        // 2. Enviar arquivo
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': mimeType
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Erro no upload: ${uploadResponse.status} - ${errorText}`);
        }

        const result = await uploadResponse.json();
        console.log('✅ Upload resumable concluído');

        return result;

    } catch (error) {
        console.error('❌ Erro no upload resumable:', error);
        throw error;
    }
}

// =============================================================================
// 📁 CRIAR ESTRUTURA DE PASTAS
// =============================================================================
async function createFolderStructure(exibidora, tipo, accessToken, rootFolderId) {
    try {
        console.log('📁 Criando estrutura de pastas...');

        // CheckingOOH
        const checkingFolder = await findOrCreateFolder('CheckingOOH', rootFolderId, accessToken);
        
        // Exibidora
        const exibidoraFolder = await findOrCreateFolder(exibidora, checkingFolder.id, accessToken);
        
        // Tipo (Entrada/Saida)
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolder(tipoFolderName, exibidoraFolder.id, accessToken);

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
// 🔍 BUSCAR OU CRIAR PASTA
// =============================================================================
async function findOrCreateFolder(folderName, parentId, accessToken) {
    try {
        // Buscar pasta existente
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
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

        if (searchResult.files && searchResult.files.length > 0) {
            console.log(`📁 Pasta encontrada: ${folderName}`);
            return searchResult.files[0];
        }

        // Criar nova pasta
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
// 🌐 TORNAR ARQUIVO PÚBLICO
// =============================================================================
async function makeFilePublic(fileId, accessToken) {
    try {
        console.log('🌐 Tornando arquivo público...');

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
            console.log('✅ Arquivo público');
        } else {
            console.warn('⚠️ Não foi possível tornar público');
        }

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
