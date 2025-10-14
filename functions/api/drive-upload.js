// =============================================================================
// 📤 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE UPLOAD (CORRIGIDO)
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

        // Processar FormData
        const formData = await context.request.formData();
        const file = formData.get('file');
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo'); // 'entrada' ou 'saida'

        if (!file || !exibidora || !pontoId || !tipo) {
            return new Response(JSON.stringify({ 
                error: 'Dados obrigatórios não fornecidos' 
            }), {
                status: 400,
                headers
            });
        }

        console.log('📋 Dados do upload:', {
            fileName: file.name,
            fileSize: file.size,
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo
        });

        // Validar arquivo
        const validation = validateFile(file);
        if (!validation.valid) {
            return new Response(JSON.stringify({ 
                error: validation.error 
            }), {
                status: 400,
                headers
            });
        }

        // Obter token de acesso
        const accessToken = await getAccessToken(context.env);

        // Criar estrutura de pastas e fazer upload
        const uploadResult = await uploadFileToGoogleDrive(
            file, 
            exibidora, 
            pontoId, 
            tipo, 
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

    // Verificar tipo
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: imagens e vídeos.`
        };
    }

    // Verificar tamanho
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `Arquivo muito grande. Tamanho máximo: 100MB`
        };
    }

    return { valid: true };
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO (CORRIGIDO)
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
// 🔐 OBTER TOKEN DA SERVICE ACCOUNT (CORRIGIDO)
// =============================================================================
async function getServiceAccountToken(serviceAccountKeyJson) {
    try {
        const serviceAccount = JSON.parse(serviceAccountKeyJson);
        
        // Criar JWT com assinatura real
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive', // ✅ Escopo completo
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const token = await createJWT(header, payload, serviceAccount.private_key);

        // Trocar JWT por access token
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
// 🔧 CRIAR JWT COM ASSINATURA REAL (CORRIGIDO)
// =============================================================================
async function createJWT(header, payload, privateKey) {
    try {
        // Codificar header e payload
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

// =============================================================================
// 🔧 FUNÇÕES AUXILIARES PARA JWT
// =============================================================================
function base64UrlEncode(data) {
    let base64;
    if (typeof data === 'string') {
        base64 = btoa(data);
    } else {
        // ArrayBuffer
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
// 📂 UPLOAD PARA GOOGLE DRIVE
// =============================================================================
async function uploadFileToGoogleDrive(file, exibidora, pontoId, tipo, accessToken, rootFolderId) {
    try {
        console.log('📂 Iniciando upload para Google Drive...');

        // Criar estrutura de pastas: CheckingOOH/Exibidora/Tipo/
        const folderPath = await createFolderStructure(exibidora, tipo, accessToken, rootFolderId);

        // Gerar nome único para o arquivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.name.split('.').pop();
        const uniqueFileName = `${tipo}_${pontoId}_${timestamp}.${extension}`;

        // Converter arquivo para ArrayBuffer
        const fileBuffer = await file.arrayBuffer();

        // Metadados do arquivo
        const metadata = {
            name: uniqueFileName,
            parents: [folderPath.folderId],
            description: `Arquivo de ${tipo} para ponto ${pontoId} - ${exibidora}`
        };

        // Upload multipart
        const boundary = '-------314159265358979323846';
        const delimiter = '\r\n--' + boundary + '\r\n';
        const close_delim = '\r\n--' + boundary + '--';

        const metadataString = JSON.stringify(metadata);
        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            metadataString +
            delimiter +
            `Content-Type: ${file.type}\r\n\r\n`;

        const multipartRequestBodyBuffer = new TextEncoder().encode(multipartRequestBody);
        const closeDelimBuffer = new TextEncoder().encode(close_delim);

        // Combinar buffers
        const totalSize = multipartRequestBodyBuffer.length + fileBuffer.byteLength + closeDelimBuffer.length;
        const combinedBuffer = new Uint8Array(totalSize);
        combinedBuffer.set(multipartRequestBodyBuffer, 0);
        combinedBuffer.set(new Uint8Array(fileBuffer), multipartRequestBodyBuffer.length);
        combinedBuffer.set(closeDelimBuffer, multipartRequestBodyBuffer.length + fileBuffer.byteLength);

        // Fazer upload
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
            throw new Error(`Erro no upload: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();

        console.log('✅ Upload concluído:', uploadResult.id);

        // Tornar arquivo público para visualização
        await makeFilePublic(uploadResult.id, accessToken);

        return {
            success: true,
            fileId: uploadResult.id,
            fileName: uniqueFileName,
            fileUrl: `https://drive.google.com/uc?id=${uploadResult.id}`,
            uploadDate: new Date().toISOString(),
            message: 'Upload realizado com sucesso'
        };

    } catch (error) {
        console.error('❌ Erro no upload para Google Drive:', error);
        throw error;
    }
}

// =============================================================================
// 📁 CRIAR ESTRUTURA DE PASTAS
// =============================================================================
async function createFolderStructure(exibidora, tipo, accessToken, rootFolderId) {
    try {
        console.log('📁 Criando estrutura de pastas...', { exibidora, tipo });

        // Buscar/criar pasta CheckingOOH
        const checkingFolder = await findOrCreateFolder('CheckingOOH', rootFolderId, accessToken);
        
        // Buscar/criar pasta da Exibidora
        const exibidoraFolder = await findOrCreateFolder(exibidora, checkingFolder.id, accessToken);
        
        // Buscar/criar pasta do tipo (Entrada/Saida)
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolder(tipoFolderName, exibidoraFolder.id, accessToken);

        console.log('✅ Estrutura de pastas criada:', tipoFolder.id);

        return {
            folderId: tipoFolder.id,
            path: `CheckingOOH/${exibidora}/${tipoFolderName}`
        };

    } catch (error) {
        console.error('❌ Erro ao criar estrutura de pastas:', error);
        throw error;
    }
}

// =============================================================================
// 🔍 BUSCAR OU CRIAR PASTA
// =============================================================================
async function findOrCreateFolder(folderName, parentId, accessToken) {
    try {
        // Buscar pasta existente
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`Erro ao buscar pasta: ${searchResponse.status} - ${errorText}`);
        }

        const searchResult = await searchResponse.json();

        if (searchResult.files && searchResult.files.length > 0) {
            // Pasta existe
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
        console.log(`✅ Pasta criada: ${folderName} (${newFolder.id})`);
        
        return newFolder;

    } catch (error) {
        console.error(`❌ Erro ao buscar/criar pasta ${folderName}:`, error);
        throw error;
    }
}

// =============================================================================
// 🌐 TORNAR ARQUIVO PÚBLICO
// =============================================================================
async function makeFilePublic(fileId, accessToken) {
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

        if (!response.ok) {
            console.warn('⚠️ Não foi possível tornar arquivo público:', response.status);
            // Não falhar - arquivo ainda pode ser acessado por outros meios
        } else {
            console.log('✅ Arquivo tornado público');
        }

    } catch (error) {
        console.warn('⚠️ Erro ao tornar arquivo público:', error);
        // Não falhar - arquivo ainda pode ser acessado
    }
}
