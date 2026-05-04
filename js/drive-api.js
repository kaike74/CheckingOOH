// =============================================================================
// 📂 INTEGRAÇÃO COM GOOGLE DRIVE API - CHECKING OOH
// =============================================================================

/**
 * Lê corpo de erro da API (JSON ou HTML/texto) e regista diagnóstico no consola.
 * @param {Response} response
 * @param {string} label ex.: drive-upload
 * @returns {string} mensagem para throw
 */
async function parseApiErrorResponse(response, label) {
    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const cfRay = response.headers.get('cf-ray') || '';
    let text = '';
    try {
        text = await response.text();
    } catch (e) {
        Logger.error(`[${label}] Falha ao ler corpo da resposta`, { status, cfRay });
        return `Erro HTTP ${status} (corpo ilegível)`;
    }

    let parsed = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch (e) {
        Logger.error(`[${label}] Resposta não-JSON`, {
            status,
            contentType,
            cfRay,
            bodyPreview: text.slice(0, 1200)
        });
        return `Erro HTTP ${status} — resposta não-JSON: ${text.slice(0, 400)}`;
    }

    const err = parsed?.error || `Erro HTTP ${status}`;
    const details = parsed?.details || parsed?.message || '';
    const code = parsed?.code || '';
    const requestId = parsed?.requestId || '';

    Logger.error(`[${label}] API falhou`, {
        status,
        code,
        requestId,
        cfRay,
        error: err,
        details,
        full: parsed
    });

    return [err, details, code, requestId].filter(Boolean).join(' — ');
}

/**
 * 📤 FAZER UPLOAD DE ARQUIVO PARA O GOOGLE DRIVE
 * Envia um arquivo para a pasta específica da exibidora/tipo
 */
async function uploadFileToDrive(file, exibidora, pontoId, tipo, databaseId) {
    try {
        Logger.info('Iniciando upload de arquivo', {
            fileName: file.name,
            size: file.size
        });

        // 🧪 MODO DEMO - SIMULAR UPLOAD
        if (CONFIG.DEMO.ENABLED) {
            Logger.debug('Modo demo ativado, simulando upload');
            return mockDriveUpload(file, exibidora, pontoId, tipo);
        }

        // Validar arquivo
        const validation = validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Criar FormData para envio
        const formData = new FormData();
        formData.append('file', file);
        formData.append('exibidora', exibidora);
        formData.append('pontoId', pontoId);
        formData.append('tipo', tipo);
        formData.append('databaseId', databaseId);

        // 🔗 CHAMADA PARA A API
        const apiUrl = `${getApiBaseUrl()}/api/drive-upload`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(await parseApiErrorResponse(response, 'drive-upload'));
        }

        const result = await response.json();
        Logger.success('Upload concluído', result);

        return result;

    } catch (error) {
        Logger.error('Erro no upload de arquivo', error);
        throw error;
    }
}

/**
 * 📂 LISTAR ARQUIVOS DO GOOGLE DRIVE
 * Lista todos os arquivos de uma exibidora/ponto/tipo específico
 */
async function listDriveFiles(exibidora, pontoId, tipo, databaseId) { // ✅ NOVO: Receber databaseId
    try {
        Logger.info('Listando arquivos do Google Drive', { exibidora, pontoId, tipo, databaseId });
        
        // 🧪 MODO DEMO - RETORNAR ARQUIVOS FICTÍCIOS
        if (CONFIG.DEMO.ENABLED) {
            return mockDriveFileList(exibidora, pontoId, tipo);
        }
        
        // 🔗 CHAMADA PARA A API
        const params = new URLSearchParams({
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo,
            databaseId: databaseId // ✅ NOVO: Enviar ID da campanha
        });
        
        const response = await fetch(`${getApiBaseUrl()}/api/drive-list?${params}`);
        
        if (!response.ok) {
            throw new Error(await parseApiErrorResponse(response, 'drive-list'));
        }
        
        const result = await response.json();
        Logger.success('Arquivos listados', { count: result.files?.length || 0 });
        
        return result;
        
    } catch (error) {
        Logger.error('Erro ao listar arquivos do Google Drive', error);
        throw error;
    }
}

/**
 * 🗑️ EXCLUIR ARQUIVO DO GOOGLE DRIVE
 * Remove um arquivo específico do Google Drive
 */
async function deleteFileFromDrive(fileId, fileName) {
    try {
        Logger.info('Excluindo arquivo do Google Drive', { fileId, fileName });
        
        // 🧪 MODO DEMO - SIMULAR EXCLUSÃO
        if (CONFIG.DEMO.ENABLED) {
            await new Promise(resolve => setTimeout(resolve, 500));
            Logger.debug('Modo demo - arquivo "excluído" com sucesso');
            return { success: true, message: 'Arquivo excluído (modo demo)' };
        }
        
        // 🔗 CHAMADA PARA A API
        const response = await fetch(`${getApiBaseUrl()}/api/drive-delete`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileId: fileId,
                fileName: fileName
            })
        });
        
        if (!response.ok) {
            throw new Error(await parseApiErrorResponse(response, 'drive-delete'));
        }
        
        const result = await response.json();
        Logger.success('Arquivo excluído', result);
        
        return result;
        
    } catch (error) {
        Logger.error('Erro ao excluir arquivo do Google Drive', error);
        throw error;
    }
}

/**
 * ✅ VALIDAR ARQUIVO
 * Verifica se o arquivo está dentro dos limites permitidos
 */
function validateFile(file) {
    // Verificar tipo
    if (!CONFIG.UPLOAD.ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: imagens e vídeos.`
        };
    }
    
    // Verificar tamanho
    if (file.size > CONFIG.UPLOAD.MAX_FILE_SIZE) {
        const maxSizeMB = CONFIG.UPLOAD.MAX_FILE_SIZE / (1024 * 1024);
        return {
            valid: false,
            error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`
        };
    }
    
    return { valid: true };
}

/**
 * 🧪 MOCK DE UPLOAD (MODO DEMO)
 * Simula um upload para testes sem backend
 */
async function mockDriveUpload(file, exibidora, pontoId, tipo) {
    Logger.debug('Simulando upload no modo demo');
    
    // Simular delay de upload
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
        success: true,
        fileId: `mock_${Date.now()}`,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        message: 'Upload simulado com sucesso (modo demo)'
    };
}

/**
 * 🧪 MOCK DE LISTAGEM (MODO DEMO)
 * Simula listagem de arquivos para testes
 */
async function mockDriveFileList(exibidora, pontoId, tipo) {
    Logger.debug('Simulando listagem de arquivos no modo demo');
    
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Gerar alguns arquivos fictícios
    const sampleFiles = [];
    const fileCount = Math.floor(Math.random() * 4) + 1; // 1-4 arquivos
    
    for (let i = 0; i < fileCount; i++) {
        const isVideo = Math.random() > 0.7; // 30% chance de ser vídeo
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
        
        sampleFiles.push({
            id: `mock_${pontoId}_${tipo}_${i}`,
            name: `${tipo}_${pontoId}_${Date.now() - (i * 60000)}.${fileExtension}`,
            url: CONFIG.DEMO.SAMPLE_IMAGES[i % CONFIG.DEMO.SAMPLE_IMAGES.length],
            thumbnailUrl: CONFIG.DEMO.SAMPLE_IMAGES[i % CONFIG.DEMO.SAMPLE_IMAGES.length],
            mimeType: mimeType,
            size: Math.floor(Math.random() * 5000000) + 100000, // 100KB - 5MB
            createdTime: new Date(Date.now() - (i * 60000)).toISOString(),
            isVideo: isVideo
        });
    }
    
    return {
        success: true,
        files: sampleFiles,
        totalCount: sampleFiles.length
    };
}

/**
 * 🔧 REDIMENSIONAR IMAGEM (SE NECESSÁRIO)
 * Redimensiona imagens grandes antes do upload
 */
async function resizeImage(file, maxWidth = 1920, maxHeight = 1080) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height / width) * maxWidth;
                        width = maxWidth;
                    } else {
                        width = (width / height) * maxHeight;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: file.type }));
                }, file.type, 0.9);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * 📊 FORMATAR TAMANHO DE ARQUIVO
 * Converte bytes para formato legível
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 🎥 VERIFICAR SE É VÍDEO
 * Verifica se o arquivo é um vídeo baseado no tipo MIME
 */
function isVideoFile(mimeType) {
    return mimeType && mimeType.startsWith('video/');
}

/**
 * 🖼️ VERIFICAR SE É IMAGEM
 * Verifica se o arquivo é uma imagem baseado no tipo MIME
 */
function isImageFile(mimeType) {
    return mimeType && mimeType.startsWith('image/');
}

/**
 * 📅 FORMATAR DATA
 * Formata uma data para exibição
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Data inválida';
    }
}

// 🚀 EXPORTAR FUNÇÕES
window.DriveAPI = {
    uploadFileToDrive,
    listDriveFiles,
    deleteFileFromDrive,
    validateFile,
    resizeImage,
    formatFileSize,
    isVideoFile,
    isImageFile,
    formatDate
};

Logger.info('Módulo de armazenamento carregado');
