// =============================================================================
// 🔧 CLOUDFLARE WORKER: UPLOAD PARA GOOGLE DRIVE - SEGURO
// =============================================================================

import {
    ensureFolderHierarchy,
    validateHierarchyParams,
    buildDriveHierarchyOptions
} from './drive-hierarchy.js';
import {
    getSecureCorsHeaders,
    validateUploadRequest,
    secureLog,
    checkRateLimit
} from './_security.js';

function driveUploadJsonError(corsHeaders, status, code, error, details, requestId, extra = {}) {
    const body = {
        success: false,
        error: error || 'Erro no servidor',
        details: details || error || 'sem_detalhe',
        code,
        requestId,
        t: new Date().toISOString(),
        ...extra
    };
    console.error(`[drive-upload:${requestId}]`, code, JSON.stringify(body).slice(0, 4000));
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const requestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `req_${Date.now()}`;

    const corsHeaders = getSecureCorsHeaders(request);

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log(`[drive-upload:${requestId}] POST`, {
            cfRay: request.headers.get('cf-ray'),
            contentLength: request.headers.get('content-length'),
            contentType: (request.headers.get('content-type') || '').slice(0, 100)
        });

        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (!checkRateLimit(clientIP, 50, 60000)) {
            secureLog('warning', 'Rate limit excedido', { ip: clientIP });
            return driveUploadJsonError(
                corsHeaders,
                429,
                'RATE_LIMIT',
                'Muitas requisições. Tente novamente em alguns segundos.',
                `IP: ${clientIP}`,
                requestId
            );
        }

        secureLog('info', 'Iniciando upload');

        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            secureLog('error', 'Credenciais não configuradas');
            return driveUploadJsonError(
                corsHeaders,
                500,
                'MISSING_GOOGLE_SERVICE_ACCOUNT_KEY',
                'Serviço temporariamente indisponível',
                'GOOGLE_SERVICE_ACCOUNT_KEY ausente no ambiente.',
                requestId
            );
        }

        let formData;
        try {
            formData = await request.formData();
        } catch (e) {
            return driveUploadJsonError(
                corsHeaders,
                400,
                'FORMDATA_PARSE',
                'Pedido inválido',
                e.message || String(e),
                requestId
            );
        }

        let validated;
        try {
            validated = validateUploadRequest(formData);
        } catch (validationError) {
            secureLog('warning', 'Validação falhou', { error: validationError.message });
            return driveUploadJsonError(
                corsHeaders,
                400,
                'VALIDATION',
                validationError.message,
                validationError.message,
                requestId
            );
        }

        const { file, exibidora, pontoId, tipo, databaseId } = validated;

        console.log(`[drive-upload:${requestId}] metadados`, {
            exibidora,
            pontoId,
            tipo,
            databaseId,
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type
        });

        secureLog('info', 'Upload validado', {
            fileName: file.name,
            fileSize: file.size,
            tipo
        });

        let accessToken;
        try {
            accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_KEY, requestId);
        } catch (oauthErr) {
            return driveUploadJsonError(
                corsHeaders,
                500,
                'OAUTH_OR_JWT',
                'Falha na autenticação Google',
                oauthErr.message || String(oauthErr),
                requestId,
                { hint: 'JSON da service account, chave ativa no GCP, Drive API ativada.' }
            );
        }

        if (!accessToken) {
            return driveUploadJsonError(
                corsHeaders,
                500,
                'TOKEN_EMPTY',
                'Token Google vazio',
                'Resposta OAuth sem access_token.',
                requestId
            );
        }

        console.log(`[drive-upload:${requestId}] token OK`, { prefix: accessToken.slice(0, 10) + '…' });

        let folderPath;
        try {
            folderPath = await ensureFolderPathInSharedDrive(
                exibidora,
                tipo,
                databaseId,
                pontoId,
                accessToken,
                requestId,
                env
            );
        } catch (folderErr) {
            return driveUploadJsonError(
                corsHeaders,
                500,
                'FOLDER_HIERARCHY',
                'Falha ao resolver pastas no Drive',
                folderErr.message || String(folderErr),
                requestId,
                { hint: 'Permissões na pasta CheckingOOH / Shared Drive; nomes de pastas.' }
            );
        }

        if (!folderPath?.id) {
            return driveUploadJsonError(
                corsHeaders,
                500,
                'FOLDER_PATH_INVALID',
                'Caminho de pastas inválido',
                'Sem folderId destino.',
                requestId
            );
        }

        console.log(`[drive-upload:${requestId}] destino`, { folderId: folderPath.id, path: folderPath.path });

        const uploadResult = await uploadToGoogleDrive(
            file,
            folderPath.id,
            pontoId,
            tipo,
            accessToken,
            requestId
        );

        if (!uploadResult.success) {
            secureLog('error', 'Upload falhou', { error: uploadResult.error });
            return driveUploadJsonError(
                corsHeaders,
                500,
                uploadResult.code || 'UPLOAD_GOOGLE',
                'Erro ao fazer upload do arquivo',
                uploadResult.error || 'erro_desconhecido',
                requestId,
                uploadResult.extra || {}
            );
        }

        secureLog('success', 'Upload concluído com sucesso');
        console.log(`[drive-upload:${requestId}] OK`, { fileId: uploadResult.fileId });

        return new Response(
            JSON.stringify({
                success: true,
                fileId: uploadResult.fileId,
                fileName: uploadResult.fileName,
                fileUrl: uploadResult.fileUrl,
                message: 'Upload realizado com sucesso!',
                requestId
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            }
        );
    } catch (error) {
        secureLog('error', 'drive-upload exceção', { message: error.message });
        const msg = error?.message || String(error);
        const stack = error?.stack ? String(error.stack).slice(0, 2000) : '';
        return driveUploadJsonError(
            corsHeaders,
            500,
            'UNHANDLED',
            'Erro no servidor',
            stack ? `${msg}\n---\n${stack}` : msg,
            requestId
        );
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
async function getGoogleAccessToken(serviceAccountKey, requestId = '') {
    try {
        console.log(`[drive-upload:${requestId}] 🔑 JWT / OAuth…`);

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountKey);
        } catch (parseErr) {
            throw new Error(
                `GOOGLE_SERVICE_ACCOUNT_KEY não é JSON válido: ${parseErr.message}. Confirme que colou o ficheiro completo (sem aspas extra no Cloudflare).`
            );
        }

        if (!serviceAccount.client_email || !serviceAccount.private_key) {
            throw new Error(
                'JSON da service account incompleto: faltam client_email ou private_key.'
            );
        }

        const emailDomain = (serviceAccount.client_email || '').split('@')[1] || '';
        console.log(`[drive-upload:${requestId}] conta serviço`, {
            client_email_suffix: `…@${emailDomain}`,
            hasPrivateKey: Boolean(serviceAccount.private_key)
        });

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        let jwt;
        try {
            jwt = await signJWT(payload, serviceAccount.private_key);
        } catch (signErr) {
            throw new Error(
                `Falha ao assinar JWT (chave PEM inválida ou formato errado): ${signErr.message}`
            );
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`OAuth2 HTTP ${tokenResponse.status}: ${errorText.slice(0, 2000)}`);
        }

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            throw new Error(`OAuth2 resposta sem access_token: ${JSON.stringify(tokenData).slice(0, 500)}`);
        }

        console.log(`[drive-upload:${requestId}] ✅ OAuth OK`);
        return tokenData.access_token;
    } catch (error) {
        console.error(`[drive-upload:${requestId}] ❌ token:`, error);
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
async function uploadToGoogleDrive(file, folderId, pontoId, tipo, accessToken, requestId = '') {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileExtension = file.name.split('.').pop();
        const fileName = `${tipo}_${pontoId}_${timestamp}.${fileExtension}`;

        console.log(`[drive-upload:${requestId}] 📤 init`, { folderId, bytes: file.size, mime: file.type });

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
                    'X-Upload-Content-Type': file.type || 'application/octet-stream'
                },
                body: JSON.stringify(metadata)
            }
        );

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error(`[drive-upload:${requestId}] init`, initResponse.status, errorText.slice(0, 1200));
            return {
                success: false,
                code: 'UPLOAD_INIT',
                error: `init ${initResponse.status}: ${errorText.slice(0, 2000)}`,
                extra: { googleStatus: initResponse.status }
            };
        }

        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) {
            return {
                success: false,
                code: 'UPLOAD_NO_LOCATION',
                error: 'Resumable: header Location ausente.',
                extra: {}
            };
        }

        const fileBuffer = await file.arrayBuffer();
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type || 'application/octet-stream',
                'Content-Length': fileBuffer.byteLength.toString()
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`[drive-upload:${requestId}] PUT`, uploadResponse.status, errorText.slice(0, 1200));
            return {
                success: false,
                code: 'UPLOAD_PUT',
                error: `PUT ${uploadResponse.status}: ${errorText.slice(0, 2000)}`,
                extra: { googleStatus: uploadResponse.status }
            };
        }

        const uploadResult = await uploadResponse.json();

        console.log(`[drive-upload:${requestId}] ✅ ficheiro`, uploadResult.id);

        try {
            await makeFileViewable(uploadResult.id, accessToken);
        } catch (permError) {
            console.warn(`[drive-upload:${requestId}] permissões anyone:`, permError.message);
        }

        return {
            success: true,
            fileId: uploadResult.id,
            fileName: fileName,
            fileUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`
        };

    } catch (error) {
        console.error(`[drive-upload:${requestId}] ❌`, error);
        return {
            success: false,
            code: 'UPLOAD_EXCEPTION',
            error: error.message || String(error),
            extra: {}
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
async function ensureFolderPathInSharedDrive(
    exibidora,
    tipo,
    databaseId,
    pontoId,
    accessToken,
    requestId = '',
    env = {}
) {
    try {
        console.log(`[drive-upload:${requestId}] 📁 hierarquia`, {
            exibidora,
            tipo,
            databaseId,
            pontoId,
            driveOpts: buildDriveHierarchyOptions(env)
        });

        const validation = validateHierarchyParams(exibidora, databaseId, pontoId, tipo);
        if (!validation.valid) {
            throw new Error(`Parâmetros inválidos: ${validation.errors.join(', ')}`);
        }

        const result = await ensureFolderHierarchy(
            exibidora,
            databaseId,
            pontoId,
            tipo,
            accessToken,
            buildDriveHierarchyOptions(env)
        );

        console.log(`[drive-upload:${requestId}] 🎉 hierarquia OK`, { path: result.path, tipoFolderId: result.id });
        return result;
    } catch (error) {
        console.error(`[drive-upload:${requestId}] ❌ hierarquia:`, error);
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
