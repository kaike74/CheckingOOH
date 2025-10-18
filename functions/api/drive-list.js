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
        const databaseId = url.searchParams.get('databaseId'); // ✅ NOVO: ID da campanha

        if (!exibidora || !pontoId || !tipo || !databaseId) { // ✅ ALTERADO: Validar databaseId
            return new Response(JSON.stringify({ 
                error: 'Parâmetros obrigatórios não fornecidos',
                missing: {
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

        console.log('📋 Parâmetros da listagem:', {
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo,
            databaseId: databaseId // ✅ NOVO
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
            databaseId, // ✅ NOVO: Passar databaseId
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
// 📂 LISTAR ARQUIVOS DO GOOGLE DRIVE
// =============================================================================
async function listFilesFromGoogleDrive(exibidora, pontoId, tipo, databaseId, accessToken, rootFolderId) { // ✅ NOVO: Receber databaseId
    try {
        console.log('📂 Listando arquivos...', { exibidora, pontoId, tipo, databaseId });

        // ✅ ALTERADO: Encontrar pasta específica com databaseId
        const folderPath = await findFolderPath(exibidora, tipo, databaseId, accessToken, rootFolderId);
        
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
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink)&orderBy=name`,
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
// 🔍 ENCONTRAR CAMINHO DA PASTA (COM CAMPANHA)
// =============================================================================
async function findFolderPath(exibidora, tipo, databaseId, accessToken, rootFolderId) { // ✅ NOVO: Receber databaseId
    try {
        console.log('🔍 Procurando caminho da pasta...', { exibidora, tipo, databaseId });

        // ETAPA 1: Buscar pasta "REDE COMPARTILHADA E-RÁDIOS" (raiz do Shared Drive)
        console.log('🔍 ETAPA 1: Buscando pasta REDE COMPARTILHADA E-RÁDIOS em Shared Drives...');
        const redeFolder = await findFolderInSharedDrives('REDE COMPARTILHADA E-RÁDIOS', accessToken);
        if (!redeFolder) {
            console.log('❌ Pasta REDE COMPARTILHADA E-RÁDIOS não encontrada em Shared Drives');
            return null;
        }
        console.log('✅ ETAPA 1 OK: Pasta REDE encontrada:', redeFolder.id);

        // ETAPA 2: Buscar pasta CheckingOOH dentro de REDE COMPARTILHADA
        console.log('🔍 ETAPA 2: Buscando pasta CheckingOOH...');
        const checkingFolder = await findFolder('CheckingOOH', redeFolder.id, accessToken);
        if (!checkingFolder) {
            console.log('❌ Pasta CheckingOOH não encontrada dentro de REDE COMPARTILHADA');
            return null;
        }
        console.log('✅ ETAPA 2 OK: Pasta CheckingOOH encontrada:', checkingFolder.id);

        // ETAPA 3: Buscar pasta da Exibidora
        console.log(`🔍 ETAPA 3: Buscando pasta da exibidora: ${exibidora}...`);
        const exibidoraFolder = await findFolder(exibidora, checkingFolder.id, accessToken);
        if (!exibidoraFolder) {
            console.log(`❌ Pasta da exibidora ${exibidora} não encontrada`);
            return null;
        }
        console.log('✅ ETAPA 3 OK: Pasta da exibidora encontrada:', exibidoraFolder.id);

        // ETAPA 4: Buscar pasta da Campanha (databaseId)
        console.log(`🔍 ETAPA 4: Buscando pasta da campanha: ${databaseId}...`);
        const campanhaFolder = await findFolder(databaseId, exibidoraFolder.id, accessToken);
        if (!campanhaFolder) {
            console.log(`❌ Pasta da campanha ${databaseId} não encontrada`);
            return null;
        }
        console.log('✅ ETAPA 4 OK: Pasta da campanha encontrada:', campanhaFolder.id);

        // ETAPA 5: Buscar pasta do tipo (Entrada/Saida)
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        console.log(`🔍 ETAPA 5: Buscando pasta do tipo: ${tipoFolderName}...`);
        const tipoFolder = await findFolder(tipoFolderName, campanhaFolder.id, accessToken);
        if (!tipoFolder) {
            console.log(`❌ Pasta ${tipoFolderName} não encontrada`);
            return null;
        }

        console.log('✅ ETAPA 5 OK: Pasta do tipo encontrada:', tipoFolder.id);
        console.log('🎉 SUCESSO! Caminho COMPLETO da pasta encontrado!');

        return {
            id: tipoFolder.id,
            path: `REDE COMPARTILHADA E-RÁDIOS/CheckingOOH/${exibidora}/${databaseId}/${tipoFolderName}`
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
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)`,
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
// 🌐 ENCONTRAR PASTA EM SHARED DRIVES (SEM PAI ESPECÍFICO)
// =============================================================================
async function findFolderInSharedDrives(folderName, accessToken) {
    try {
        console.log(`🌐 Buscando pasta "${folderName}" em Shared Drives...`);
        
        // Query para buscar pasta em Shared Drives (sem especificar pai)
        const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name,driveId)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao buscar pasta em Shared Drives: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.files && result.files.length > 0) {
            console.log(`✅ Pasta "${folderName}" encontrada em Shared Drive:`, result.files[0].id);
            return result.files[0];
        }

        console.log(`❌ Pasta "${folderName}" NÃO encontrada em Shared Drives`);
        return null;

    } catch (error) {
        console.error(`❌ Erro ao encontrar pasta ${folderName} em Shared Drives:`, error);
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
