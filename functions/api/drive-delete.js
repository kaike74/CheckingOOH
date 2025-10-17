// =============================================================================
// 🗑️ CLOUDFLARE PAGES FUNCTION - GOOGLE DRIVE DELETE
// =============================================================================

export async function onRequest(context) {
    // Permitir CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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
        console.log('🗑️ Deletando arquivo do Google Drive...');

        // Verificar método
        if (context.request.method !== 'DELETE') {
            return new Response(JSON.stringify({ 
                error: 'Método não permitido' 
            }), {
                status: 405,
                headers
            });
        }

        // Processar dados JSON
        const requestData = await context.request.json();
        const fileId = requestData.fileId;
        const fileName = requestData.fileName;

        if (!fileId) {
            return new Response(JSON.stringify({ 
                error: 'ID do arquivo é obrigatório' 
            }), {
                status: 400,
                headers
            });
        }

        console.log('📋 Dados da exclusão:', {
            fileId: fileId,
            fileName: fileName || 'Nome não fornecido'
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

        // Deletar arquivo
        const deleteResult = await deleteFileFromGoogleDrive(fileId, fileName, accessToken);

        return new Response(JSON.stringify(deleteResult), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro ao deletar arquivo:', error);
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

        // Fallback para API Key (limitado - não funciona para delete)
        if (env.GOOGLE_DRIVE_API_KEY) {
            throw new Error('API Key não suporta operações de delete. Use Service Account.');
        }

        throw new Error('Credenciais válidas para delete não encontradas');

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
        
        // Criar JWT
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
    
    // Simplificado para demonstração - em produção usar biblioteca JWT
    const signature = btoa(message);
    
    return `${message}.${signature}`;
}

// =============================================================================
// 🗑️ DELETAR ARQUIVO DO GOOGLE DRIVE
// =============================================================================
async function deleteFileFromGoogleDrive(fileId, fileName, accessToken) {
    try {
        console.log('🗑️ Iniciando exclusão do arquivo:', { fileId, fileName });

        // Primeiro, verificar se o arquivo existe e obter informações
        const fileInfo = await getFileInfo(fileId, accessToken);
        
        if (!fileInfo) {
            return {
                success: false,
                error: 'Arquivo não encontrado',
                fileId: fileId
            };
        }

        console.log('📋 Informações do arquivo:', {
            id: fileInfo.id,
            name: fileInfo.name,
            mimeType: fileInfo.mimeType
        });

        // Executar exclusão
        const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!deleteResponse.ok) {
            // Verificar se é erro de permissão
            if (deleteResponse.status === 403) {
                throw new Error('Sem permissão para deletar este arquivo');
            } else if (deleteResponse.status === 404) {
                throw new Error('Arquivo não encontrado ou já foi deletado');
            } else {
                const errorText = await deleteResponse.text();
                throw new Error(`Erro na exclusão: ${deleteResponse.status} - ${errorText}`);
            }
        }

        console.log('✅ Arquivo deletado com sucesso:', fileId);

        // Log da operação (para auditoria)
        await logDeletionOperation(fileInfo, accessToken);

        return {
            success: true,
            fileId: fileId,
            fileName: fileInfo.name,
            deletedAt: new Date().toISOString(),
            message: 'Arquivo deletado com sucesso'
        };

    } catch (error) {
        console.error('❌ Erro ao deletar arquivo do Google Drive:', error);
        
        return {
            success: false,
            fileId: fileId,
            error: error.message,
            deletedAt: new Date().toISOString()
        };
    }
}

// =============================================================================
// ℹ️ OBTER INFORMAÇÕES DO ARQUIVO
// =============================================================================
async function getFileInfo(fileId, accessToken) {
    try {
        console.log('ℹ️ Obtendo informações do arquivo:', fileId);

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents&supportsAllDrives=true`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                console.log('📄 Arquivo não encontrado:', fileId);
                return null;
            }
            throw new Error(`Erro ao obter informações: ${response.status}`);
        }

        const fileInfo = await response.json();
        console.log('✅ Informações obtidas:', fileInfo.name);
        
        return fileInfo;

    } catch (error) {
        console.error('❌ Erro ao obter informações do arquivo:', error);
        return null;
    }
}

// =============================================================================
// 📝 LOG DA OPERAÇÃO DE EXCLUSÃO
// =============================================================================
async function logDeletionOperation(fileInfo, accessToken) {
    try {
        // Criar um log da exclusão (opcional - para auditoria)
        const logData = {
            operation: 'file_deletion',
            fileId: fileInfo.id,
            fileName: fileInfo.name,
            fileType: fileInfo.mimeType,
            fileSize: fileInfo.size,
            originalCreatedTime: fileInfo.createdTime,
            deletedAt: new Date().toISOString(),
            deletedBy: 'checking-ooh-system'
        };

        console.log('📝 Log da exclusão:', logData);

        // Aqui você poderia salvar o log em um banco de dados ou arquivo
        // Por enquanto, apenas logamos no console

        // Opcional: Criar arquivo de log no Google Drive
        // await createLogFile(logData, accessToken);

    } catch (error) {
        console.warn('⚠️ Erro ao criar log da exclusão:', error);
        // Não falhar a operação principal por causa do log
    }
}

// =============================================================================
// 🗂️ CRIAR ARQUIVO DE LOG (OPCIONAL)
// =============================================================================
async function createLogFile(logData, accessToken) {
    try {
        console.log('🗂️ Criando arquivo de log...');

        // Criar conteúdo do log
        const logContent = JSON.stringify(logData, null, 2);
        const logFileName = `deletion_log_${Date.now()}.json`;

        // Encontrar ou criar pasta de logs
        const logsFolder = await findOrCreateLogsFolder(accessToken);

        // Criar arquivo de log
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'multipart/related; boundary="boundary123"'
            },
            body: createMultipartBody(logFileName, logContent, logsFolder.id)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Arquivo de log criado:', result.id);
        } else {
            console.warn('⚠️ Não foi possível criar arquivo de log:', response.status);
        }

    } catch (error) {
        console.warn('⚠️ Erro ao criar arquivo de log:', error);
    }
}

// =============================================================================
// 📁 ENCONTRAR OU CRIAR PASTA DE LOGS
// =============================================================================
async function findOrCreateLogsFolder(accessToken) {
    try {
        // Buscar pasta existente
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='CheckingOOH_Logs' and mimeType='application/vnd.google-apps.folder' and trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        const searchResult = await searchResponse.json();

        if (searchResult.files && searchResult.files.length > 0) {
            return searchResult.files[0];
        }

        // Criar pasta de logs
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'CheckingOOH_Logs',
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        const newFolder = await createResponse.json();
        return newFolder;

    } catch (error) {
        console.error('❌ Erro ao criar pasta de logs:', error);
        throw error;
    }
}

// =============================================================================
// 📦 CRIAR CORPO MULTIPART
// =============================================================================
function createMultipartBody(fileName, content, parentId) {
    const boundary = 'boundary123';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const close_delim = '\r\n--' + boundary + '--';

    const metadata = {
        name: fileName,
        parents: [parentId]
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        close_delim;

    return multipartRequestBody;
}

// =============================================================================
// 🔍 VALIDAR PERMISSÕES DE EXCLUSÃO
// =============================================================================
async function validateDeletionPermissions(fileId, accessToken) {
    try {
        // Verificar permissões do arquivo
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            return { valid: false, error: 'Não foi possível verificar permissões' };
        }

        const permissions = await response.json();
        
        // Verificar se tem permissão de owner ou writer
        const hasWritePermission = permissions.permissions?.some(permission => 
            permission.role === 'owner' || permission.role === 'writer'
        );

        return { 
            valid: hasWritePermission, 
            error: hasWritePermission ? null : 'Sem permissão para deletar arquivo' 
        };

    } catch (error) {
        return { valid: false, error: 'Erro ao validar permissões' };
    }
}
