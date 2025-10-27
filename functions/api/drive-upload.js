// =============================================================================
// 🔧 CLOUDFLARE WORKER: UPLOAD PARA GOOGLE DRIVE - SEGURO
// =============================================================================

import { ensureFolderHierarchy, validateHierarchyParams } from './drive-hierarchy.js';
import {
    getSecureCorsHeaders,
    validateUploadRequest,
    secureLog,
    secureErrorResponse,
    checkRateLimit
} from './_security.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    // 🛡️ CORS SEGURO
    const corsHeaders = getSecureCorsHeaders(request);

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 🛡️ RATE LIMITING
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (!checkRateLimit(clientIP, 50, 60000)) {
            secureLog('warning', 'Rate limit excedido', { ip: clientIP });
            return new Response(JSON.stringify({
                success: false,
                error: 'Muitas requisições. Tente novamente em alguns segundos.'
            }), {
                status: 429,
                headers: corsHeaders
            });
        }

        secureLog('info', 'Iniciando upload');

        // =============================================================================
        // ETAPA 1: VALIDAR VARIÁVEIS DE AMBIENTE
        // =============================================================================
        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            secureLog('error', 'Credenciais não configuradas');
            return new Response(JSON.stringify({
                success: false,
                error: 'Serviço temporariamente indisponível'
            }), {
                status: 500,
                headers: corsHeaders
            });
        }

        // =============================================================================
        // ETAPA 2: VALIDAR E SANITIZAR DADOS DO REQUEST
        // =============================================================================
        const formData = await request.formData();

        let validated;
        try {
            validated = validateUploadRequest(formData);
        } catch (validationError) {
            secureLog('warning', 'Validação falhou', { error: validationError.message });
            return new Response(JSON.stringify({
                success: false,
                error: validationError.message
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const { file, exibidora, pontoId, tipo, databaseId } = validated;

        secureLog('info', 'Upload validado', {
            fileName: file.name,
            fileSize: file.size,
            tipo
        });

        // =============================================================================
        // ETAPA 3: OBTER TOKEN DO GOOGLE
        // =============================================================================
        const accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);

        if (!accessToken) {
            secureLog('error', 'Falha ao obter token de acesso');
            return new Response(JSON.stringify({
                success: false,
                error: 'Erro ao processar requisição'
            }), {
                status: 500,
                headers: corsHeaders
            });
        }

        // =============================================================================
        // ETAPA 4: CRIAR ESTRUTURA DE PASTAS E FAZER UPLOAD
        // =============================================================================
        const folderPath = await ensureFolderPathInSharedDrive(exibidora, tipo, databaseId, pontoId, accessToken);

        if (!folderPath) {
            secureLog('error', 'Falha ao criar estrutura de pastas');
            return new Response(JSON.stringify({
                success: false,
                error: 'Erro ao processar requisição'
            }), {
                status: 500,
                headers: corsHeaders
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
            secureLog('error', 'Upload falhou', { error: uploadResult.error });
            return new Response(JSON.stringify({
                success: false,
                error: 'Erro ao fazer upload do arquivo'
            }), {
                status: 500,
                headers: corsHeaders
            });
        }

        secureLog('success', 'Upload concluído com sucesso');

        return new Response(JSON.stringify({
            success: true,
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            fileUrl: uploadResult.fileUrl,
            message: 'Upload realizado com sucesso!'
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return secureErrorResponse(error, 500, corsHeaders);
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
// 📁 GARANTIR ESTRUTURA DE PASTAS NO SHARED DRIVE (REFATORADO)
// =============================================================================
// ✅ REFATORADO: Agora usa o módulo compartilhado drive-hierarchy.js
// Isso previne duplicações paralelas e garante consistência
async function ensureFolderPathInSharedDrive(exibidora, tipo, databaseId, pontoId, accessToken) {
    try {
        console.log('📁 [REFATORADO] Usando módulo compartilhado de hierarquia...');
        console.log('📋 Parâmetros:', { exibidora, tipo, databaseId, pontoId });

        // ✅ VALIDAR parâmetros antes de prosseguir
        const validation = validateHierarchyParams(exibidora, databaseId, pontoId, tipo);
        if (!validation.valid) {
            throw new Error(`Parâmetros inválidos: ${validation.errors.join(', ')}`);
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
        return result;

    } catch (error) {
        console.error('❌ Erro ao garantir estrutura de pastas:', error);
        throw error;
    }
}

// =============================================================================
// 🗑️ FUNÇÕES REMOVIDAS - AGORA USAM drive-hierarchy.js
// =============================================================================
// ❌ REMOVIDO: buildFolderStructureForUpload() - Substituído por ensureFolderHierarchy()
// ❌ REMOVIDO: findOrCreateFolder() - Movido para drive-hierarchy.js com mutex
// ❌ REMOVIDO: findFolderInAllDrives() - Movido para drive-hierarchy.js
//
// ✅ BENEFÍCIOS:
// - Elimina duplicação de código entre drive-upload.js e drive-list.js
// - Adiciona mutex para prevenir duplicações em chamadas paralelas
// - Centraliza lógica de hierarquia em um único lugar
// - Facilita manutenção e debugging

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
