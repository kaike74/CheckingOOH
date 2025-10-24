// =============================================================================
// 🔧 CLOUDFLARE WORKER: UPLOAD PARA GOOGLE DRIVE - CORREÇÃO COMPLETA
// =============================================================================

export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('📤 === INICIANDO UPLOAD V8 - CORREÇÃO COMPLETA ===');

        // =============================================================================
        // ETAPA 1: VALIDAR VARIÁVEIS DE AMBIENTE
        // =============================================================================
        console.log('🔍 ETAPA 1: Validando variáveis de ambiente...');
        
        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY não configurada');
            return new Response(JSON.stringify({
                success: false,
                error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada',
                step: 'ENV_VALIDATION'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const rootFolderId = env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        console.log('✅ ETAPA 1: Variáveis de ambiente OK');

        // =============================================================================
        // ETAPA 2: PROCESSAR FORMDATA
        // =============================================================================
        console.log('🔍 ETAPA 2: Processando FormData...');
        
        const formData = await request.formData();
        const file = formData.get('file');
        let exibidora = formData.get('exibidora');
        let pontoId = formData.get('pontoId');
        let tipo = formData.get('tipo');
        let databaseId = formData.get('databaseId');

        // ✅ CORREÇÃO 1 E 2: Sanitizar parâmetros
        exibidora = sanitizeParam(exibidora);
        pontoId = sanitizeParam(pontoId);
        tipo = sanitizeParam(tipo);
        databaseId = sanitizeParam(databaseId);

        console.log('📝 Dados recebidos:', { 
            fileName: file?.name,
            fileSize: file?.size,
            exibidora, 
            pontoId, 
            tipo,
            databaseId
        });

        if (!file || !exibidora || !pontoId || !tipo || !databaseId) {
            console.error('❌ ETAPA 2: Dados obrigatórios ausentes', {
                hasFile: !!file,
                hasExibidora: !!exibidora,
                hasPontoId: !!pontoId,
                hasTipo: !!tipo,
                hasDatabaseId: !!databaseId
            });
            return new Response(JSON.stringify({
                success: false,
                error: 'Dados obrigatórios ausentes ou inválidos: file, exibidora, pontoId, tipo, databaseId',
                step: 'FORM_VALIDATION'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('✅ ETAPA 2: FormData OK');

        // =============================================================================
        // ETAPA 3: VALIDAR ARQUIVO
        // =============================================================================
        console.log('🔍 ETAPA 3: Validando arquivo...');
        
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            console.log('❌ ETAPA 3: Arquivo muito grande');
            return new Response(JSON.stringify({
                success: false,
                error: 'Arquivo muito grande (máximo 100MB)',
                step: 'FILE_VALIDATION'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'
        ];

        if (!allowedTypes.includes(file.type)) {
            console.log('❌ ETAPA 3: Tipo de arquivo não permitido');
            return new Response(JSON.stringify({
                success: false,
                error: 'Tipo de arquivo não permitido',
                step: 'FILE_VALIDATION'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('✅ ETAPA 3: Validação OK');

        // =============================================================================
        // ETAPA 4: OBTER TOKEN DO GOOGLE
        // =============================================================================
        console.log('🔍 ETAPA 4: Obtendo token do Google...');
        
        const accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        if (!accessToken) {
            console.log('❌ ETAPA 4: Falha ao obter token');
            return new Response(JSON.stringify({
                success: false,
                error: 'Falha ao obter token de acesso do Google',
                step: 'TOKEN_ACQUISITION'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('✅ ETAPA 4: Token obtido com sucesso');

        // =============================================================================
        // ETAPA 5: UPLOAD DO ARQUIVO
        // =============================================================================
        console.log('🔍 ETAPA 5: Iniciando upload...');

        // ✅ CORREÇÃO: Passar pontoId para criar estrutura correta
        const folderPath = await ensureFolderPathInSharedDrive(exibidora, tipo, databaseId, pontoId, accessToken);
        
        if (!folderPath) {
            console.log('❌ ETAPA 5: Falha ao criar estrutura de pastas');
            return new Response(JSON.stringify({
                success: false,
                error: 'Falha ao criar estrutura de pastas no Shared Drive',
                step: 'FOLDER_CREATION'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Upload do arquivo
        const uploadResult = await uploadToGoogleDrive(
            file, 
            folderPath.id, 
            pontoId, 
            tipo, 
            accessToken
        );

        if (!uploadResult.success) {
            console.log('❌ ETAPA 5: Upload falhou');
            return new Response(JSON.stringify({
                success: false,
                error: uploadResult.error,
                step: 'FILE_UPLOAD'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('✅ ETAPA 5: Upload concluído');
        console.log('🎉 === UPLOAD V8 CONCLUÍDO COM SUCESSO ===');

        return new Response(JSON.stringify({
            success: true,
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            fileUrl: uploadResult.fileUrl,
            databaseId: databaseId,
            folderPath: folderPath.path,
            message: 'Upload realizado com sucesso!'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Erro geral no upload:', error);
        console.error('❌ Stack trace:', error.stack);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            step: 'GENERAL_ERROR'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// =============================================================================
// 🧹 SANITIZAR PARÂMETROS (NOVA FUNÇÃO)
// =============================================================================
function sanitizeParam(param) {
    if (!param || param === 'null' || param === 'undefined' || param.trim() === '') {
        return null;
    }
    return param.trim();
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO DO GOOGLE
// =============================================================================
async function getGoogleAccessToken(serviceAccountKey) {
    try {
        console.log('🔑 Gerando token de acesso...');

        const serviceAccount = JSON.parse(serviceAccountKey);
        
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const jwt = await signJWT(payload, serviceAccount.private_key);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`OAuth2 falhou (${tokenResponse.status}): ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Token de acesso obtido');
        return tokenData.access_token;

    } catch (error) {
        console.error('❌ Erro ao obter token:', error);
        throw error;
    }
}

// =============================================================================
// 🖊️ ASSINAR JWT
// =============================================================================
async function signJWT(payload, privateKey) {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToBinary(privateKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(signingInput)
    );

    const encodedSignature = base64UrlEncode(signature);
    return `${signingInput}.${encodedSignature}`;
}

// =============================================================================
// 📤 UPLOAD PARA GOOGLE DRIVE
// =============================================================================
async function uploadToGoogleDrive(file, folderId, pontoId, tipo, accessToken) {
    try {
        console.log('📤 Fazendo upload do arquivo...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileExtension = file.name.split('.').pop();
        const fileName = `${tipo}_${pontoId}_${timestamp}.${fileExtension}`;

        // ✅ CORREÇÃO 5: Upload usando resumable upload para evitar corrupção
        const metadata = {
            name: fileName,
            parents: [folderId]
        };

        // Passo 1: Iniciar sessão de upload resumível
        const initResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Upload-Content-Type': file.type
                },
                body: JSON.stringify(metadata)
            }
        );

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            throw new Error(`Falha ao iniciar upload: ${initResponse.status} - ${errorText}`);
        }

        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('URL de upload não retornada');
        }

        // Passo 2: Upload do conteúdo do arquivo
        const fileBuffer = await file.arrayBuffer();
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
                'Content-Length': fileBuffer.byteLength.toString()
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload falhou (${uploadResponse.status}): ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();

        console.log('✅ Arquivo enviado com sucesso!');

        // ✅ CORREÇÃO: Tornar arquivo público/compartilhável para visualização
        console.log('🔓 Configurando permissões do arquivo...');
        try {
            await makeFileViewable(uploadResult.id, accessToken);
            console.log('✅ Permissões configuradas com sucesso!');
        } catch (permError) {
            console.warn('⚠️ Aviso: Não foi possível configurar permissões públicas:', permError.message);
            // Não falhar o upload por causa disso, arquivo pode já ter permissões via pasta compartilhada
        }

        return {
            success: true,
            fileId: uploadResult.id,
            fileName: fileName,
            fileUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`
        };

    } catch (error) {
        console.error('❌ Erro no upload para Google Drive:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// =============================================================================
// 🔓 TORNAR ARQUIVO VISUALIZÁVEL (PERMISSÕES)
// =============================================================================
async function makeFileViewable(fileId, accessToken) {
    try {
        console.log(`🔓 Configurando permissões para o arquivo ${fileId}...`);

        // Adicionar permissão de leitura para qualquer pessoa com o link
        const permissionResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );

        if (!permissionResponse.ok) {
            const errorText = await permissionResponse.text();
            console.warn(`⚠️ Aviso ao configurar permissões: ${permissionResponse.status} - ${errorText}`);
            // Não lançar erro, apenas avisar
            return false;
        }

        console.log('✅ Arquivo configurado como público (visualizável por qualquer pessoa com o link)');
        return true;

    } catch (error) {
        console.warn('⚠️ Erro ao configurar permissões:', error.message);
        return false;
    }
}

// =============================================================================
// 📁 GARANTIR ESTRUTURA DE PASTAS NO SHARED DRIVE
// =============================================================================
async function ensureFolderPathInSharedDrive(exibidora, tipo, databaseId, pontoId, accessToken) {
    try {
        console.log('📁 Criando estrutura de pastas...', { exibidora, tipo, databaseId, pontoId });

        console.log('🔍 Buscando pasta CheckingOOH...');
        const checkingFolderDirect = await findFolderInAllDrives('CheckingOOH', accessToken);

        if (checkingFolderDirect) {
            console.log('✅ Pasta CheckingOOH encontrada:', checkingFolderDirect.id);

            // ✅ CORREÇÃO: Passar pontoId para criar estrutura correta
            const result = await buildFolderStructureForUpload(checkingFolderDirect.id, exibidora, tipo, databaseId, pontoId, accessToken, 'CheckingOOH');
            if (result) {
                console.log('🎉 Estrutura criada com sucesso');
                return result;
            }
        }

        throw new Error('Pasta raiz CheckingOOH não encontrada');

    } catch (error) {
        console.error('❌ Erro ao garantir estrutura de pastas:', error);
        throw error;
    }
}

// =============================================================================
// 🏗️ CONSTRUIR ESTRUTURA DE PASTAS PARA UPLOAD
// ✅ V10: HIERARQUIA CORRETA CheckingOOH/Exibidora/Campanha/Ponto/Tipo
// =============================================================================
async function buildFolderStructureForUpload(checkingFolderId, exibidora, tipo, databaseId, pontoId, accessToken, basePath) {
    try {
        console.log(`🏗️ ✅ V10: ${basePath}/Exibidora/Campanha/Ponto/Tipo`);

        // PASSO 1: Exibidora
        console.log(`📁 [1/4] Buscando/criando pasta Exibidora: ${exibidora}...`);
        const exibidoraFolder = await findOrCreateFolder(exibidora, checkingFolderId, accessToken);
        if (!exibidoraFolder) {
            throw new Error(`Falha ao criar pasta da exibidora: ${exibidora}`);
        }
        console.log('✅ Pasta Exibidora:', exibidoraFolder.id);

        // PASSO 2: Campanha (databaseId)
        console.log(`📁 [2/4] Buscando/criando pasta Campanha: ${databaseId}...`);
        const campanhaFolder = await findOrCreateFolder(databaseId, exibidoraFolder.id, accessToken);
        if (!campanhaFolder) {
            throw new Error(`Falha ao criar pasta da campanha: ${databaseId}`);
        }
        console.log('✅ Pasta Campanha:', campanhaFolder.id);

        // PASSO 3: Ponto (pontoId) ✅ V10: Ponto ANTES do Tipo
        console.log(`📁 [3/4] Buscando/criando pasta Ponto: ${pontoId}...`);
        const pontoFolder = await findOrCreateFolder(pontoId, campanhaFolder.id, accessToken);
        if (!pontoFolder) {
            throw new Error(`Falha ao criar pasta do ponto: ${pontoId}`);
        }
        console.log('✅ Pasta Ponto:', pontoFolder.id);

        // PASSO 4: Tipo (Entrada ou Saída) ✅ V10: Tipo DEPOIS do Ponto
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        console.log(`📁 [4/4] Buscando/criando pasta Tipo: ${tipoFolderName}...`);
        const tipoFolder = await findOrCreateFolder(tipoFolderName, pontoFolder.id, accessToken);
        if (!tipoFolder) {
            throw new Error(`Falha ao criar pasta do tipo: ${tipoFolderName}`);
        }
        console.log('✅ Pasta Tipo:', tipoFolder.id);

        const fullPath = `${basePath}/${exibidora}/${databaseId}/${pontoId}/${tipoFolderName}`;
        console.log('🎉 Caminho completo V10 (CORRETO):', fullPath);

        return {
            id: tipoFolder.id,
            path: fullPath
        };

    } catch (error) {
        console.error('❌ Erro ao construir estrutura:', error);
        throw error;
    }
}

// =============================================================================
// 📁 ENCONTRAR OU CRIAR PASTA
// =============================================================================
async function findOrCreateFolder(folderName, parentId, accessToken) {
    try {
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (searchResponse.ok) {
            const searchResult = await searchResponse.json();
            if (searchResult.files && searchResult.files.length > 0) {
                console.log(`📁 Pasta "${folderName}" já existe:`, searchResult.files[0].id);
                return searchResult.files[0];
            }
        }

        console.log(`📁 Criando pasta "${folderName}"...`);
        const createResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
            {
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
            }
        );

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Erro ao criar pasta: ${createResponse.status} - ${errorText}`);
        }

        const newFolder = await createResponse.json();
        console.log(`✅ Pasta "${folderName}" criada:`, newFolder.id);
        return newFolder;

    } catch (error) {
        console.error(`❌ Erro ao encontrar/criar pasta ${folderName}:`, error);
        return null;
    }
}

// =============================================================================
// 🌐 ENCONTRAR PASTA EM TODOS OS DRIVES
// =============================================================================
async function findFolderInAllDrives(folderName, accessToken) {
    try {
        console.log(`🌐 Buscando pasta "${folderName}"...`);
        
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
            throw new Error(`Erro ao buscar pasta: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.files && result.files.length > 0) {
            const sharedDriveFolder = result.files.find(f => f.driveId);
            const selectedFolder = sharedDriveFolder || result.files[0];
            
            console.log(`✅ Pasta "${folderName}" encontrada:`, selectedFolder.id);
            return selectedFolder;
        }

        console.log(`❌ Pasta "${folderName}" não encontrada`);
        return null;

    } catch (error) {
        console.error(`❌ Erro ao encontrar pasta ${folderName}:`, error);
        return null;
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
