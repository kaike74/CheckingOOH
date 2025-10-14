// =============================================================================
// 📂 INTEGRAÇÃO COM GOOGLE DRIVE API - CHECKING OOH
// =============================================================================

/**
 * 📤 FAZER UPLOAD DE ARQUIVO PARA O GOOGLE DRIVE
 * Envia um arquivo para a pasta específica da exibidora/tipo
 */
async function uploadFileToDrive(file, exibidora, pontoId, tipo) {
    try {
        Logger.info('Iniciando upload para Google Drive', { 
            fileName: file.name, 
            size: file.size, 
            exibidora, 
            pontoId, 
            tipo 
        });
        
        // 🧪 MODO DEMO - SIMULAR UPLOAD
        if (CONFIG.DEMO.ENABLED) {
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
        formData.append('tipo', tipo); // 'entrada' ou 'saida'
        
        // 🔗 CHAMADA PARA A API
        const response = await fetch(`${getApiBaseUrl()}/api/drive-upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }
        
        const result = await response.json();
        Logger.success('Upload concluído', result);
        
        return result;
        
    } catch (error) {
        Logger.error('Erro no upload para Google Drive', error);
        throw error;
    }
}

/**
 * 📂 LISTAR ARQUIVOS DO GOOGLE DRIVE
 * Lista todos os arquivos de uma exibidora/ponto/tipo específico
 */
async function listDriveFiles(exibidora, pontoId, tipo) {
    try {
        Logger.info('Listando arquivos do Google Drive', { exibidora, pontoId, tipo });
        
        // 🧪 MODO DEMO - RETORNAR ARQUIVOS FICTÍCIOS
        if (CONFIG.DEMO.ENABLED) {
            return mockDriveFileList(exibidora, pontoId, tipo);
        }
        
        // 🔗 CHAMADA PARA A API
        const params = new URLSearchParams({
            exibidora: exibidora,
            pontoId: pontoId,
            tipo: tipo
        });
        
        const response = await fetch(`${getApiBaseUrl()}/api/drive-list?${params}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
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
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
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
    if (!CONFIG.DRIVE.ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: imagens e vídeos.`
        };
    }
    
    // Verificar tamanho
    if (file.size > CONFIG.DRIVE.MAX_FILE_SIZE) {
        const maxSizeMB = CONFIG.DRIVE.MAX_FILE_SIZE / (1024 * 1024);
        return {
            valid: false,
            error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`
        };
    }
    
    return { valid: true };
}

/**
 * 🧪 MOCK DE UPLOAD (MODO DEMO)
 * Simula o upload de um arquivo
 */
async function mockDriveUpload(file, exibidora, pontoId, tipo) {
    Logger.debug('Simulando upload no modo demo');
    
    // Simular delay de upload
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simular ID do arquivo
    const fileId = 'mock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    return {
        success: true,
        fileId: fileId,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file), // URL local para demonstração
        uploadDate: new Date().toISOString(),
        message: 'Upload simulado com sucesso (modo demo)'
    };
}

/**
 * 🧪 MOCK DE LISTAGEM (MODO DEMO)
 * Simula a listagem de arquivos
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
 * 📱 REDIMENSIONAR IMAGEM
 * Redimensiona uma imagem para otimizar o upload
 */
function resizeImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calcular novas dimensões mantendo proporção
            let { width, height } = img;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            
            // Redimensionar
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Converter para blob
            canvas.toBlob(resolve, file.type, quality);
        };
        
        img.src = URL.createObjectURL(file);
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
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

Logger.info('Módulo Google Drive API carregado');
