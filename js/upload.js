// =============================================================================
// 📤 GERENCIAMENTO DE UPLOAD - CHECKING OOH
// =============================================================================

let currentUploadContext = {
    exibidora: null,
    pontoId: null,
    tipo: null
};

let uploadQueue = [];
let isUploading = false;

/**
 * 📤 ABRIR MODAL DE UPLOAD
 * Abre o modal para seleção e upload de arquivos
 */
function openUploadModal(exibidora, pontoId, tipo) {
    // Definir contexto
    currentUploadContext = { exibidora, pontoId, tipo };
    
    // Definir contexto da câmera também
    CameraManager.setCameraContext(exibidora, pontoId, tipo);
    
    // Atualizar título do modal
    const modalTitle = document.getElementById('upload-modal-title');
    const tipoText = tipo === 'entrada' ? 'Entrada' : 'Saída';
    modalTitle.textContent = `📤 Upload - ${tipoText}`;
    
    // Limpar estado anterior
    clearUploadState();
    
    // Mostrar modal
    document.getElementById('upload-modal').style.display = 'flex';
    
    Logger.info('Modal de upload aberto', { exibidora, pontoId, tipo });
}

/**
 * 🔒 FECHAR MODAL DE UPLOAD
 * Fecha o modal e limpa o estado
 */
function closeUploadModal() {
    // Ocultar modal
    document.getElementById('upload-modal').style.display = 'none';
    
    // Limpar contexto
    currentUploadContext = { exibidora: null, pontoId: null, tipo: null };
    
    // Limpar estado
    clearUploadState();
    
    Logger.info('Modal de upload fechado');
}

/**
 * 🧹 LIMPAR ESTADO DO UPLOAD
 * Remove arquivos da fila e reseta a interface
 */
function clearUploadState() {
    uploadQueue = [];
    isUploading = false;
    
    // Resetar interface
    hideUploadProgress();
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.value = '';
    }
}

/**
 * 📁 PROCESSAR ARQUIVOS SELECIONADOS
 * Processa arquivos selecionados pelo input ou drag&drop
 */
function processSelectedFiles(files) {
    try {
        Logger.info('Processando arquivos selecionados', { count: files.length });
        
        // Converter FileList para Array
        const fileArray = Array.from(files);
        
        // Verificar limite de arquivos
        if (fileArray.length > CONFIG.DRIVE.MAX_FILES_PER_UPLOAD) {
            alert(`Máximo de ${CONFIG.DRIVE.MAX_FILES_PER_UPLOAD} arquivos por vez.`);
            return;
        }
        
        // Validar cada arquivo
        const validFiles = [];
        const errors = [];
        
        fileArray.forEach(file => {
            const validation = DriveAPI.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
            }
        });
        
        // Mostrar erros se houver
        if (errors.length > 0) {
            alert('Alguns arquivos não são válidos:\n\n' + errors.join('\n'));
        }
        
        // Se há arquivos válidos, iniciar upload
        if (validFiles.length > 0) {
            addFilesToQueue(validFiles);
            startUpload();
        }
        
    } catch (error) {
        Logger.error('Erro ao processar arquivos selecionados', error);
        alert('Erro ao processar arquivos: ' + error.message);
    }
}

/**
 * ➕ ADICIONAR ARQUIVOS À FILA
 * Adiciona arquivos à fila de upload
 */
function addFilesToQueue(files) {
    files.forEach(file => {
        const uploadItem = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            file: file,
            status: 'pending', // pending, uploading, completed, error
            progress: 0,
            error: null
        };
        
        uploadQueue.push(uploadItem);
    });
    
    Logger.debug('Arquivos adicionados à fila', { count: files.length, total: uploadQueue.length });
}

/**
 * 🚀 INICIAR UPLOAD
 * Inicia o processo de upload da fila
 */
async function startUpload() {
    if (isUploading || uploadQueue.length === 0) {
        return;
    }
    
    isUploading = true;
    
    try {
        Logger.info('Iniciando upload', { filesCount: uploadQueue.length });
        
        showUploadProgress('Preparando upload...');
        
        const { exibidora, pontoId, tipo } = currentUploadContext;
        
        if (!exibidora || !pontoId || !tipo) {
            throw new Error('Contexto de upload não definido');
        }
        
        // Processar arquivos um por vez
        for (let i = 0; i < uploadQueue.length; i++) {
            const uploadItem = uploadQueue[i];
            
            try {
                uploadItem.status = 'uploading';
                
                const progressText = `Enviando ${i + 1} de ${uploadQueue.length}: ${uploadItem.file.name}`;
                updateUploadProgress((i / uploadQueue.length) * 100, progressText);
                
                // Upload do arquivo
                const result = await DriveAPI.uploadFileToDrive(
                    uploadItem.file,
                    exibidora,
                    pontoId,
                    tipo
                );
                
                if (result.success) {
                    uploadItem.status = 'completed';
                    uploadItem.progress = 100;
                    Logger.success('Arquivo enviado', { fileName: uploadItem.file.name });
                } else {
                    throw new Error(result.error || 'Falha no upload');
                }
                
            } catch (error) {
                uploadItem.status = 'error';
                uploadItem.error = error.message;
                Logger.error('Erro no upload do arquivo', { fileName: uploadItem.file.name, error });
            }
        }
        
        // Verificar resultados
        const completed = uploadQueue.filter(item => item.status === 'completed');
        const failed = uploadQueue.filter(item => item.status === 'error');
        
        hideUploadProgress();
        
        if (completed.length > 0) {
            const message = `✅ ${completed.length} arquivo(s) enviado(s) com sucesso!`;
            showSuccessMessage(message);
            
            // Recarregar lista de arquivos
            await refreshFilesList(exibidora, pontoId, tipo);
        }
        
        if (failed.length > 0) {
            const failedNames = failed.map(item => `• ${item.file.name}: ${item.error}`).join('\n');
            alert(`❌ Falha no envio de ${failed.length} arquivo(s):\n\n${failedNames}`);
        }
        
        // Fechar modal se todos foram enviados com sucesso
        if (failed.length === 0) {
            closeUploadModal();
        }
        
    } catch (error) {
        hideUploadProgress();
        Logger.error('Erro no processo de upload', error);
        alert('Erro no upload: ' + error.message);
    } finally {
        isUploading = false;
    }
}

/**
 * 📊 MOSTRAR PROGRESSO DO UPLOAD
 * Exibe a barra de progresso
 */
function showUploadProgress(message = 'Enviando...') {
    const progressDiv = document.getElementById('upload-progress');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressDiv && progressText && progressFill) {
        progressDiv.style.display = 'block';
        progressText.textContent = message;
        progressFill.style.width = '0%';
    }
}

/**
 * 🔄 ATUALIZAR PROGRESSO DO UPLOAD
 * Atualiza a barra de progresso
 */
function updateUploadProgress(percentage, message) {
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressText && progressFill) {
        progressText.textContent = message;
        progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
}

/**
 * 🙈 OCULTAR PROGRESSO DO UPLOAD
 * Oculta a barra de progresso
 */
function hideUploadProgress() {
    const progressDiv = document.getElementById('upload-progress');
    if (progressDiv) {
        progressDiv.style.display = 'none';
    }
}

/**
 * ✅ MOSTRAR MENSAGEM DE SUCESSO
 * Exibe uma mensagem de sucesso temporária
 */
function showSuccessMessage(message) {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
        z-index: 9999;
        font-family: var(--font-primary);
        font-weight: 600;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover após 4 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

/**
 * 🔄 RECARREGAR LISTA DE ARQUIVOS
 * Recarrega a lista de arquivos de uma seção específica
 */
async function refreshFilesList(exibidora, pontoId, tipo) {
    try {
        Logger.info('Recarregando lista de arquivos', { exibidora, pontoId, tipo });
        
        // Buscar arquivos atualizados
        const result = await DriveAPI.listDriveFiles(exibidora, pontoId, tipo);
        
        if (result.success) {
            // Atualizar preview na interface
            updateMediaPreview(pontoId, tipo, result.files);
            Logger.success('Lista de arquivos atualizada', { count: result.files.length });
        }
        
    } catch (error) {
        Logger.error('Erro ao recarregar lista de arquivos', error);
    }
}

/**
 * 🎨 CONFIGURAR DRAG & DROP
 * Configura a zona de drag and drop
 */
function setupDragAndDrop() {
    const uploadZone = document.getElementById('upload-zone');
    
    if (!uploadZone) return;
    
    // Prevenir comportamento padrão
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Destacar zona de drop
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Processar arquivos arrastados
    uploadZone.addEventListener('drop', handleDrop, false);
    
    // Click para selecionar arquivos
    uploadZone.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    Logger.debug('Drag & Drop configurado');
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    document.getElementById('upload-zone').classList.add('drag-over');
}

function unhighlight(e) {
    document.getElementById('upload-zone').classList.remove('drag-over');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    processSelectedFiles(files);
}

// 🚀 EXPORTAR FUNÇÕES
window.UploadManager = {
    openUploadModal,
    closeUploadModal,
    processSelectedFiles,
    startUpload,
    showUploadProgress,
    updateUploadProgress,
    hideUploadProgress,
    refreshFilesList
};

// 🎯 EXPOR FUNÇÕES GLOBAIS PARA USO NO HTML
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.showUploadProgress = showUploadProgress;
window.hideUploadProgress = hideUploadProgress;

// 🎯 CONFIGURAR EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    // Configurar drag & drop
    setupDragAndDrop();
    
    // Configurar input de arquivo
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            processSelectedFiles(e.target.files);
        });
    }
    
    Logger.info('Upload Manager configurado');
});

Logger.info('Módulo de upload carregado');
