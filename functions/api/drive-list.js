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
        const driveApiKey = context.env.GOOGLE_DRIVE_API_KEY;
        const serviceAccountKey = context.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        
        if (!driveApiKey && !serviceAccountKey) {
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
// 🔑 OBTER TOKEN DE ACESSO (REUTILIZADO)
// =============================================================================
async function getAccessToken(env) {
    try {
        console.log('🔑 Obtendo token de acesso...');

        // Se tem Service Account Key, usar OAuth2
        if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            return await getServiceAccountToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        }

        // Fallback para API Key (limitado)
        if (env.GOOGLE_DRIVE_API_KEY) {
            return env.GOOGLE_DRIVE_API_KEY;
        }

        throw new Error('Nenhuma credencial válida encontrada');

    } catch (error) {
        console.error('❌ Erro ao obter token de acesso:', error);
        throw error;
    }
}

// =============================================================================
// 🔐 OBTER TOKEN DA SERVICE ACCOUNT (REUTILIZADO)
// =============================================================================
async function getServiceAccountToken(serviceAccountKeyJson) {
    try {
        const serviceAccount = JSON.parse(serviceAccountKeyJson);
        
        // Criar JWT simplificado
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
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
            throw new Error(`Erro OAuth2: ${response.status}`);
        }

        const tokenData = await response.json();
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token da service account:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 CRIAR JWT SIMPLIFICADO (REUTILIZADO)
// =============================================================================
async function createJWT(header, payload, privateKey) {
    const encoder = new TextEncoder();
    
    const headerB64 = btoa(JSON.stringify(header));
    const payloadB64 = btoa(JSON.stringify(payload));
    
    const message = `${headerB64}.${payloadB64}`;
    
    // Simplificado para demonstração
    const signature = btoa(message);
    
    return `${message}.${signature}`;
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
            throw new Error(`Erro ao listar arquivos: ${response.status}`);
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
            throw new Error(`Erro ao buscar pasta: ${response.status}`);
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

// =============================================================================
// 📊 OBTER ESTATÍSTICAS DOS ARQUIVOS
// =============================================================================
async function getFileStats(files) {
    const stats = {
        totalFiles: files.length,
        totalSize: 0,
        images: 0,
        videos: 0,
        others: 0
    };

    files.forEach(file => {
        stats.totalSize += file.size || 0;
        
        if (file.mimeType) {
            if (file.mimeType.startsWith('image/')) {
                stats.images++;
            } else if (file.mimeType.startsWith('video/')) {
                stats.videos++;
            } else {
                stats.others++;
            }
        }
    });

    return stats;
}
