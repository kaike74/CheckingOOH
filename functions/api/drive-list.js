// =============================================================================
// 📂 CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE LIST (SEGURO)
// =============================================================================

import { ensureFolderHierarchy, validateHierarchyParams } from './drive-hierarchy.js';
import {
    getSecureCorsHeaders,
    validateAndSanitize,
    secureLog,
    secureErrorResponse,
    checkRateLimit
} from './_security.js';

export async function onRequest(context) {
    const headers = getSecureCorsHeaders(context.request);

    if (context.request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers
        });
    }

    try {
        // 🛡️ RATE LIMITING
        const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
        if (!checkRateLimit(clientIP, 100, 60000)) {
            return new Response(JSON.stringify({
                error: 'Muitas requisições. Tente novamente em alguns segundos.'
            }), {
                status: 429,
                headers
            });
        }

        secureLog('info', 'Listando arquivos');

        const url = new URL(context.request.url);

        // 🛡️ VALIDAR E SANITIZAR PARÂMETROS
        let exibidora, pontoId, tipo, databaseId;
        try {
            exibidora = validateAndSanitize(url.searchParams.get('exibidora'), 'foldername', 100);
            pontoId = validateAndSanitize(url.searchParams.get('pontoId'), 'notionId', 40);
            tipo = validateAndSanitize(url.searchParams.get('tipo'), 'tipo', 10);
            databaseId = validateAndSanitize(url.searchParams.get('databaseId'), 'notionId', 40);
        } catch (validationError) {
            secureLog('warning', 'Validação falhou', { error: validationError.message });
            return new Response(JSON.stringify({
                error: 'Parâmetros inválidos'
            }), {
                status: 400,
                headers
            });
        }

        console.log('📋 Parâmetros da listagem:', {
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo,
            databaseId: databaseId
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
            databaseId,
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
// 🧹 SANITIZAR PARÂMETROS (NOVA FUNÇÃO)
// =============================================================================
function sanitizeParam(param) {
    if (!param || param === 'null' || param === 'undefined' || param.trim() === '') {
        return null;
    }
    return param.trim();
}

// =============================================================================
// 🔑 OBTER TOKEN DE ACESSO
// =============================================================================
async function getAccessToken(env) {
    try {
        console.log('🔑 Iniciando obtenção de token de acesso...');

        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            console.error('❌ Service Account Key não configurada');
            throw new Error('Service Account Key não configurada');
        }

        console.log('✅ Service Account Key encontrada, gerando token...');
        const token = await getServiceAccountToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        console.log('✅ Token de acesso obtido com sucesso');
        
        return token;

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
// 📂 LISTAR ARQUIVOS NA PASTA (SHARED DRIVE + FALLBACK)
// =============================================================================
// Em Shared Drives, `corpora=allDrives` + `in parents` pode falhar (400/403).
// Tentamos primeiro `corpora=drive` + `driveId` quando conhecemos o drive.
// =============================================================================
async function listFilesInFolderWithDriveFallback(folderId, sharedDriveId, accessToken) {
    const query =
        `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
    const fields =
        'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink)';

    const buildUrl = (corpora, driveId) => {
        const params = new URLSearchParams({
            q: query,
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
            corpora,
            fields
        });
        if (driveId) {
            params.set('driveId', driveId);
        }
        return `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    };

    const attempts = [];
    if (sharedDriveId) {
        attempts.push(() => buildUrl('drive', sharedDriveId));
    }
    attempts.push(() => buildUrl('allDrives', ''));
    attempts.push(() => {
        const params = new URLSearchParams({
            q: query,
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
            fields
        });
        return `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    });

    let lastStatus = 0;
    let lastBody = '';
    for (const getUrl of attempts) {
        const url = getUrl();
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (response.ok) {
            return response.json();
        }
        lastStatus = response.status;
        lastBody = await response.text();
        console.warn(`⚠️ list files tentativa falhou (${lastStatus}):`, lastBody.slice(0, 500));
    }

    throw new Error(`Erro ao listar arquivos: ${lastStatus} - ${lastBody}`);
}

// =============================================================================
// 📂 LISTAR ARQUIVOS DO GOOGLE DRIVE
// =============================================================================
async function listFilesFromGoogleDrive(exibidora, pontoId, tipo, databaseId, accessToken, rootFolderId) {
    try {
        console.log('📂 Listando arquivos...', { exibidora, pontoId, tipo, databaseId });

        // ✅ CORREÇÃO: Passar pontoId para buscar na nova estrutura
        const folderPath = await findOrCreateFolderPath(exibidora, tipo, databaseId, pontoId, accessToken, rootFolderId);
        
        if (!folderPath) {
            console.error('❌ Não foi possível criar/encontrar a estrutura de pastas');
            return {
                success: false,
                files: [],
                totalCount: 0,
                error: 'Não foi possível criar/encontrar a estrutura de pastas'
            };
        }

        console.log('✅ Estrutura de pastas pronta:', folderPath.path);

        // Listar arquivos na pasta
        console.log('📋 Buscando arquivos na pasta:', folderPath.id, 'driveId:', folderPath.driveId || '(My Drive)');

        const listResult = await listFilesInFolderWithDriveFallback(
            folderPath.id,
            folderPath.driveId || null,
            accessToken
        );
        const allFiles = listResult.files || [];

        console.log(`📋 Encontrados ${allFiles.length} arquivos na pasta`);

        // ✅ CORREÇÃO CRÍTICA: Filtro inteligente que aceita:
        // 1. Arquivos do sistema com pontoId no nome (tipo_pontoId_timestamp.ext)
        // 2. Arquivos manuais que contenham o pontoId em qualquer parte do nome
        // 3. ✅ NOVO: Filtrar arquivos excluídos (soft delete com sufixo _EXCLUIDO_)
        const pontoIdLower = pontoId.toLowerCase();
        const pontoIdCompact = pontoIdLower.replace(/-/g, '');

        const filteredFiles = allFiles.filter(file => {
            const fileName = (file.name || '').toLowerCase();

            // ✅ SOFT DELETE: Ignorar arquivos com _EXCLUIDO_ no nome
            if (fileName.includes('_excluido_')) {
                console.log(`🗑️ Arquivo excluído filtrado: ${file.name}`);
                return false;
            }

            // Nomes no Drive costumam usar o ID sem hífens (ex.: entrada_35220b549cf58149…)
            return fileName.includes(pontoIdLower) || fileName.includes(pontoIdCompact);
        });

        console.log(`📋 Arquivos filtrados para ponto ${pontoId}: ${filteredFiles.length} de ${allFiles.length}`);

        // Processar arquivos para formato padronizado
        const processedFiles = filteredFiles.map(file => {
            const isImage = file.mimeType && file.mimeType.startsWith('image/');
            const isVideo = file.mimeType && file.mimeType.startsWith('video/');

            // ✅ PRIORIDADE 1: URLs alternativas com THUMBNAIL PRIMEIRO
            const alternativeUrls = [];
            if (isImage) {
                // ✅ ORDEM: Thumbnail (rápido) → uc (direto) → download
                if (file.thumbnailLink) alternativeUrls.push(file.thumbnailLink.replace('=s220', '=s1000'));
                alternativeUrls.push(`https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`);
                alternativeUrls.push(`https://drive.google.com/thumbnail?id=${file.id}&sz=w800`);
                alternativeUrls.push(`https://drive.google.com/uc?id=${file.id}`);
                alternativeUrls.push(`https://drive.google.com/uc?export=download&id=${file.id}`);
            } else if (isVideo) {
                // ✅ CORREÇÃO: Adicionar URLs alternativas para vídeos também
                alternativeUrls.push(`https://drive.google.com/file/d/${file.id}/preview`);
                alternativeUrls.push(`https://drive.google.com/uc?id=${file.id}&export=download`);
                alternativeUrls.push(file.webContentLink);
            }

            return {
                id: file.id,
                name: file.name,
                url: getFileViewUrl(file),
                alternativeUrls: alternativeUrls, // ✅ NOVO: URLs de fallback
                downloadUrl: file.webContentLink,
                thumbnailUrl: file.thumbnailLink,
                mimeType: file.mimeType,
                size: parseInt(file.size) || 0,
                createdTime: file.createdTime,
                modifiedTime: file.modifiedTime,
                isVideo: isVideo,
                isImage: isImage
            };
        });

        return {
            success: true,
            files: processedFiles,
            totalCount: processedFiles.length,
            folderPath: folderPath.path,
            folderId: folderPath.id
        };

    } catch (error) {
        console.error('❌ Erro ao listar arquivos do Google Drive:', error);
        throw error;
    }
}

// =============================================================================
// 🔍 ENCONTRAR OU CRIAR CAMINHO DA PASTA (REFATORADO)
// ✅ V10: HIERARQUIA CORRETA CheckingOOH/Exibidora/Campanha/Ponto/Tipo
// ✅ REFATORADO: Agora usa o módulo compartilhado drive-hierarchy.js
// =============================================================================
async function findOrCreateFolderPath(exibidora, tipo, databaseId, pontoId, accessToken, rootFolderId) {
    try {
        console.log('📁 [REFATORADO] Usando módulo compartilhado de hierarquia...');
        console.log('📋 Parâmetros:', { exibidora, tipo, databaseId, pontoId });

        // ✅ VALIDAR parâmetros antes de prosseguir
        const validation = validateHierarchyParams(exibidora, databaseId, pontoId, tipo);
        if (!validation.valid) {
            console.error('❌ Parâmetros inválidos:', validation.errors);
            return null;
        }

        // ✅ USAR módulo compartilhado (com mutex para prevenir duplicações)
        const result = await ensureFolderHierarchy(
            exibidora,
            databaseId,
            pontoId,
            tipo,
            accessToken
        );

        console.log('🎉 Estrutura garantida via módulo compartilhado');

        return {
            id: result.id,
            path: result.path,
            driveId: result.folders.checking.driveId
        };

    } catch (error) {
        console.error('❌ Erro ao encontrar/criar estrutura de pastas:', error);
        return null;
    }
}

// =============================================================================
// 📁 CRIAR PASTA NO GOOGLE DRIVE (MANTIDO PARA COMPATIBILIDADE)
// =============================================================================
// ⚠️ DEPRECATED: Esta função será removida em versões futuras
// Use drive-hierarchy.js para criar pastas
async function createFolder(folderName, parentId, accessToken, driveId = null) {
    try {
        console.log(`📁 Criando pasta "${folderName}" dentro de ${parentId}...`);

        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };

        const url = driveId 
            ? `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`
            : `https://www.googleapis.com/drive/v3/files`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao criar pasta: ${response.status} - ${errorText}`);
        }

        const folder = await response.json();
        console.log(`✅ Pasta "${folderName}" criada com sucesso:`, folder.id);
        
        return folder;

    } catch (error) {
        console.error(`❌ Erro ao criar pasta ${folderName}:`, error);
        throw error;
    }
}

// =============================================================================
// 📁 ENCONTRAR PASTA V10.1 (MANTIDO PARA COMPATIBILIDADE)
// ✅ CORRIGIDO: Proteção contra duplicação + escape de caracteres especiais
// =============================================================================
// ⚠️ DEPRECATED: Esta função será removida em versões futuras
// Use drive-hierarchy.js para buscar pastas
async function findFolder(folderName, parentId, accessToken) {
    try {
        // ✅ V10.1: Escapar aspas simples no nome da pasta
        const escapedFolderName = folderName.replace(/'/g, "\\'");
        const query = `name='${escapedFolderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

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
            // ✅ V10.1: Avisar se houver duplicatas
            if (result.files.length > 1) {
                console.warn(`⚠️ Encontradas ${result.files.length} pastas duplicadas "${folderName}". Usando a primeira.`);
            }
            return result.files[0];
        }

        return null;

    } catch (error) {
        console.error(`❌ Erro ao encontrar pasta ${folderName}:`, error);
        return null;
    }
}

// =============================================================================
// 🌐 ENCONTRAR PASTA EM TODOS OS DRIVES (MANTIDO PARA COMPATIBILIDADE)
// =============================================================================
// ⚠️ DEPRECATED: Esta função será removida em versões futuras
// Use drive-hierarchy.js para buscar pastas
async function findFolderInAllDrives(folderName, accessToken) {
    try {
        console.log(`🌐 Buscando pasta "${folderName}" em My Drive e Shared Drives...`);
        
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
            console.error(`❌ Erro HTTP ao buscar pasta: ${response.status} - ${errorText}`);
            throw new Error(`Erro ao buscar pasta em drives: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.files && result.files.length > 0) {
            const sharedDriveFolder = result.files.find(f => f.driveId);
            const selectedFolder = sharedDriveFolder || result.files[0];
            
            console.log(`✅ Pasta "${folderName}" encontrada (total: ${result.files.length}):`, selectedFolder.id);
            if (selectedFolder.driveId) {
                console.log(`   📌 Encontrada em Shared Drive: ${selectedFolder.driveId}`);
            } else {
                console.log(`   📌 Encontrada em My Drive`);
            }
            return selectedFolder;
        }

        console.log(`❌ Pasta "${folderName}" NÃO encontrada em nenhum drive`);
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
    // ✅ PRIORIDADE 1: Usar thumbnail primeiro (mais rápido e confiável)

    if (file.mimeType && file.mimeType.startsWith('image/')) {
        // ✅ CORREÇÃO: Thumbnail como primeira opção (sz=w800 para boa qualidade)
        const url = file.thumbnailLink
            ? file.thumbnailLink.replace('=s220', '=s800')
            : `https://drive.google.com/thumbnail?id=${file.id}&sz=w800`;
        console.log(`🖼️ URL gerada para imagem ${file.name} (thumbnail): ${url}`);
        return url;
    }

    if (file.mimeType && file.mimeType.startsWith('video/')) {
        // Para vídeos: formato de preview
        const url = `https://drive.google.com/file/d/${file.id}/preview`;
        console.log(`🎥 URL gerada para vídeo ${file.name}: ${url}`);
        return url;
    }

    // Para outros tipos: webViewLink ou fallback
    const url = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    console.log(`📄 URL gerada para arquivo ${file.name}: ${url}`);
    return url;
}
