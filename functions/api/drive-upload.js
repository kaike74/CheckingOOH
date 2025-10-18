// =============================================================================
// 🔧 CLOUDFLARE WORKER: UPLOAD PARA GOOGLE DRIVE V6 - SHARED DRIVE FIX
// =============================================================================
// Data: Outubro 2024
// Compatível com: Cloudflare Pages Functions
// Funcionalidade: Upload de arquivos com estrutura de pastas específica
// CORREÇÃO: Usar Shared Drives em vez de Drive pessoal
// =============================================================================

export async function onRequestPost(context) {
    const { request, env } = context;

    // Headers CORS para permitir requests do frontend
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Responder a requests OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('📤 === INICIANDO UPLOAD V6 - SHARED DRIVE FIX ===');

        // =============================================================================
        // ETAPA 1: VALIDAR VARIÁVEIS DE AMBIENTE
        // =============================================================================
        console.log('🔍 ETAPA 1: Validando variáveis de ambiente...');
        
        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            console.log('❌ GOOGLE_SERVICE_ACCOUNT_KEY não configurada');
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
        const exibidora = formData.get('exibidora');
        const pontoId = formData.get('pontoId');
        const tipo = formData.get('tipo');

        console.log('📝 Dados recebidos:', { 
            fileName: file?.name,
            fileSize: file?.size,
            exibidora, 
            pontoId, 
            tipo 
        });

        if (!file || !exibidora || !pontoId || !tipo) {
            console.log('❌ ETAPA 2: Dados obrigatórios ausentes');
            return new Response(JSON.stringify({
                success: false,
                error: 'Dados obrigatórios ausentes: file, exibidora, pontoId, tipo',
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

        // ✅ CORREÇÃO: Usar Shared Drive em vez de rootFolderId
        const databaseId = generateDatabaseId();
        console.log('📝 Database ID gerado:', databaseId);

        // ✅ NOVO: Usar mesma lógica do drive-list.js para Shared Drives
        const folderPath = await ensureFolderPathInSharedDrive(exibidora, tipo, databaseId, accessToken);
        
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
        console.log('🎉 === UPLOAD V6 CONCLUÍDO COM SUCESSO ===');

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
        console.error('❌ Erro geral:', error);
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
// 🔑 OBTER TOKEN DE ACESSO DO GOOGLE
// =============================================================================
async function getGoogleAccessToken(serviceAccountKey) {
    try {
        console.log('🔑 Gerando token de acesso...');

        // Parse da chave da service account
        const serviceAccount = JSON.parse(serviceAccountKey);
        
        // Criar JWT
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        // Assinar JWT
        const jwt = await signJWT(payload, serviceAccount.private_key);

        // Trocar JWT por access token
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

    // Importar chave privada
    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToBinary(privateKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Assinar
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

        // Gerar nome único para o arquivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileExtension = file.name.split('.').pop();
        const fileName = `${tipo}_${pontoId}_${timestamp}.${fileExtension}`;

        // Converter arquivo para ArrayBuffer
        const fileBuffer = await file.arrayBuffer();

        // Upload usando API multipart
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const metadata = {
            name: fileName,
            parents: [folderId]
        };

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${file.type}\r\n\r\n` +
            new TextDecoder().decode(fileBuffer) +
            close_delim;

        const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body: multipartRequestBody
            }
        );

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload falhou (${uploadResponse.status}): ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        
        console.log('✅ Arquivo enviado com sucesso!');

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
// 📁 GARANTIR ESTRUTURA DE PASTAS NO SHARED DRIVE
// =============================================================================
async function ensureFolderPathInSharedDrive(exibidora, tipo, databaseId, accessToken) {
    try {
        console.log('📁 Criando estrutura no Shared Drive...', { exibidora, tipo, databaseId });

        // ✅ ETAPA 1: Buscar pasta "REDE COMPARTILHADA E-RÁDIOS" (raiz do Shared Drive)
        console.log('📁 ETAPA 1: Buscando pasta REDE COMPARTILHADA E-RÁDIOS...');
        const redeFolder = await findFolderInSharedDrives('REDE COMPARTILHADA E-RÁDIOS', accessToken);
        if (!redeFolder) {
            console.log('❌ Pasta REDE COMPARTILHADA E-RÁDIOS não encontrada');
            throw new Error('Pasta REDE COMPARTILHADA E-RÁDIOS não encontrada no Shared Drive');
        }
        console.log('✅ ETAPA 1 OK: Pasta REDE encontrada:', redeFolder.id);

        // ✅ ETAPA 2: Buscar/Criar pasta CheckingOOH dentro de REDE COMPARTILHADA
        console.log('📁 ETAPA 2: Buscando/criando pasta CheckingOOH...');
        const checkingFolder = await findOrCreateFolder('CheckingOOH', redeFolder.id, accessToken);
        if (!checkingFolder) {
            throw new Error('Falha ao criar pasta CheckingOOH');
        }
        console.log('✅ ETAPA 2 OK: Pasta CheckingOOH:', checkingFolder.id);

        // ✅ ETAPA 3: Buscar/Criar pasta da Exibidora
        console.log(`📁 ETAPA 3: Buscando/criando pasta ${exibidora}...`);
        const exibidoraFolder = await findOrCreateFolder(exibidora, checkingFolder.id, accessToken);
        if (!exibidoraFolder) {
            throw new Error(`Falha ao criar pasta da exibidora: ${exibidora}`);
        }
        console.log('✅ ETAPA 3 OK: Pasta da exibidora:', exibidoraFolder.id);

        // ✅ ETAPA 4: Buscar/Criar pasta da Campanha (databaseId)
        console.log(`📁 ETAPA 4: Buscando/criando pasta ${databaseId}...`);
        const campanhaFolder = await findOrCreateFolder(databaseId, exibidoraFolder.id, accessToken);
        if (!campanhaFolder) {
            throw new Error(`Falha ao criar pasta da campanha: ${databaseId}`);
        }
        console.log('✅ ETAPA 4 OK: Pasta da campanha:', campanhaFolder.id);

        // ✅ ETAPA 5: Buscar/Criar pasta do tipo (Entrada/Saida)
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        console.log(`📁 ETAPA 5: Buscando/criando pasta ${tipoFolderName}...`);
        const tipoFolder = await findOrCreateFolder(tipoFolderName, campanhaFolder.id, accessToken);
        if (!tipoFolder) {
            throw new Error(`Falha ao criar pasta do tipo: ${tipoFolderName}`);
        }
        console.log('✅ ETAPA 5 OK: Pasta do tipo:', tipoFolder.id);
        console.log('🎉 ESTRUTURA COMPLETA NO SHARED DRIVE!');
        const fullPath = `REDE COMPARTILHADA E-RÁDIOS/CheckingOOH/${exibidora}/${databaseId}/${tipoFolderName}`;
        console.log('📁 Caminho:', fullPath);

        return {
            id: tipoFolder.id,
            path: fullPath
        };

    } catch (error) {
        console.error('❌ Erro ao garantir estrutura de pastas no Shared Drive:', error);
        throw error;
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

        // Se não encontrou, criar a pasta
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
// 🆔 GERAR DATABASE ID
// =============================================================================
function generateDatabaseId() {
    return crypto.randomUUID();
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
