// =============================================================================
// 📂 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE LIST
// =============================================================================

export async function onRequest(context) {
    // Permitir CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
        console.log('📂 Listando arquivos do Google Drive...');

        // Obter parâmetros da URL
        const url = new URL(context.request.url);
        const exibidora = url.searchParams.get('exibidora');
        const pontoId = url.searchParams.get('pontoId');
        const tipo = url.searchParams.get('tipo'); // 'entrada' ou 'saida'

        if (!exibidora || !pontoId || !tipo) {
            return new Response(JSON.stringify({ 
                error: 'Parâmetros obrigatórios não fornecidos' 
            }), {
                status: 400,
                headers
            });
        }

        console.log('📋 Parâmetros da listagem:', {
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo
        });

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

        // Listar arquivos
        const listResult = await listFilesFromGoogleDrive(
            exibidora, 
            pontoId, 
            tipo, 
            accessToken,
            context.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
        );

        return new Response(JSON.stringify(listResult), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro ao listar arquivos:', error);
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
// 📂 LISTAR ARQUIVOS DO GOOGLE DRIVE
// =============================================================================
async function listFilesFromGoogleDrive(exibidora, pontoId, tipo, accessToken, rootFolderId) {
    try {
        console.log('📂 Listando arquivos...', { exibidora, pontoId, tipo });

        // Encontrar pasta específica
        const folderPath = await findFolderPath(exibidora, tipo, accessToken, rootFolderId);
        
        if (!folderPath) {
            console.log('📁 Pasta não encontrada - retornando lista vazia');
            return {
                success: true,
                files: [],
                totalCount: 0,
                message: 'Pasta não encontrada'
            };
        }

        // Listar arquivos na pasta
        console.log('📋 Buscando arquivos na pasta:', folderPath.id);
        
        // Query para buscar arquivos (não pastas) relacionados ao ponto
        const query = `'${folderPath.id}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink)&orderBy=createdTime desc`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao listar arquivos: ${response.status} - ${errorText}`);
        }

        const listResult = await response.json();
        const allFiles = listResult.files || [];

        console.log(`📋 Encontrados ${allFiles.length} arquivos na pasta`);

        // Filtrar arquivos por ponto (nome do arquivo contém pontoId)
        const filteredFiles = allFiles.filter(file => 
            file.name.includes(pontoId) || file.name.includes(`${tipo}_${pontoId}`)
        );

        console.log(`📋 Arquivos filtrados para o ponto: ${filteredFiles.length}`);

        // Processar arquivos para formato padronizado
        const processedFiles = filteredFiles.map(file => ({
            id: file.id,
            name: file.name,
            url: getFileViewUrl(file),
            downloadUrl: file.webContentLink,
            thumbnailUrl: file.thumbnailLink,
            mimeType: file.mimeType,
            size: parseInt(file.size) || 0,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            isVideo: file.mimeType && file.mimeType.startsWith('video/'),
            isImage: file.mimeType && file.mimeType.startsWith('image/')
        }));

        return {
            success: true,
            files: processedFiles,
            totalCount: processedFiles.length,
            folderPath: folderPath.path
        };

    } catch (error) {
        console.error('❌ Erro ao listar arquivos do Google Drive:', error);
        throw error;
    }
}

// =============================================================================
// 🔍 ENCONTRAR CAMINHO DA PASTA
// =============================================================================
async function findFolderPath(exibidora, tipo, accessToken, rootFolderId) {
    try {
        console.log('🔍 Procurando caminho da pasta...', { exibidora, tipo });

        // Buscar pasta CheckingOOH
        const checkingFolder = await findFolder('CheckingOOH', rootFolderId, accessToken);
        if (!checkingFolder) {
            console.log('📁 Pasta CheckingOOH não encontrada');
            return null;
        }

        // Buscar pasta da Exibidora
        const exibidoraFolder = await findFolder(exibidora, checkingFolder.id, accessToken);
        if (!exibidoraFolder) {
            console.log(`📁 Pasta da exibidora ${exibidora} não encontrada`);
            return null;
        }

        // Buscar pasta do tipo
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findFolder(tipoFolderName, exibidoraFolder.id, accessToken);
        if (!tipoFolder) {
            console.log(`📁 Pasta ${tipoFolderName} não encontrada`);
            return null;
        }

        console.log('✅ Caminho da pasta encontrado:', tipoFolder.id);

        return {
            id: tipoFolder.id,
            path: `CheckingOOH/${exibidora}/${tipoFolderName}`
        };

    } catch (error) {
        console.error('❌ Erro ao encontrar caminho da pasta:', error);
        return null;
    }
}

// =============================================================================
// 📁 ENCONTRAR PASTA
// =============================================================================
async function findFolder(folderName, parentId, accessToken) {
    try {
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao buscar pasta: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.files && result.files.length > 0) {
            return result.files[0];
        }

        return null;

    } catch (error) {
        console.error(`❌ Erro ao encontrar pasta ${folderName}:`, error);
        return null;
    }
}

// =============================================================================
// 🔗 OBTER URL DE VISUALIZAÇÃO DO ARQUIVO
// =============================================================================
function getFileViewUrl(file) {
    // Para imagens e vídeos, usar URL de visualização direta
    if (file.mimeType && (file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/'))) {
        return `https://drive.google.com/uc?id=${file.id}`;
    }
    
    // Para outros tipos, usar URL de visualização
    return file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
}
