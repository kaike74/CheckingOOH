// =============================================================================
// 📤 GERENCIAMENTO DE UPLOAD - CHECKING OOH
// =============================================================================

let currentUploadContext = {
    exibidora: null,
    pontoId: null,
    tipo: null,
    databaseId: null // ✅ NOVO: ID da campanha
};

let uploadQueue = [];
let isUploading = false;

/**
 * 📤 ABRIR MODAL DE UPLOAD
 * Abre o modal para seleção e upload de arquivos
 */
function openUploadModal(exibidora, pontoId, tipo, databaseId) { // ✅ NOVO: Receber databaseId
    // Definir contexto
    currentUploadContext = { exibidora, pontoId, tipo, databaseId };
    
    // Definir contexto da câmera também
    CameraManager.setCameraContext(exibidora, pontoId, tipo, databaseId);
    
    // Atualizar título do modal
    const modalTitle = document.getElementById('upload-modal-title');
    const tipoText = tipo === 'entrada' ? 'Entrada' : 'Saída';
    modalTitle.textContent = `📤 Upload - ${tipoText}`;
    
    // Limpar estado anterior
    clearUploadState();
    
    // Mostrar modal
    document.getElementById('upload-modal').style.display = 'flex';
    
    Logger.info('Modal de upload aberto', { exibidora, pontoId, tipo, databaseId });
}

/**
 * 🔒 FECHAR MODAL DE UPLOAD
 * Fecha o modal e limpa o estado
 */
function closeUploadModal() {
    // Ocultar modal
    document.getElementById('upload-modal').style.display = 'none';
    
    // Limpar contexto
    currentUploadContext = { exibidora: null, pontoId: null, tipo: null, databaseId: null };
    
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
 * Adiciona arquivos validados à fila de upload
 */
function addFilesToQueue(files) {
    uploadQueue = [...uploadQueue, ...files];
    Logger.debug('Arquivos adicionados à fila', { queueSize: uploadQueue.length });
}

/**
 * 🚀 INICIAR UPLOAD
 * Inicia o processo de upload dos arquivos na fila
 */
async function startUpload() {
    if (isUploading) {
        Logger.warning('Upload já em andamento');
        return;
    }
    
    if (uploadQueue.length === 0) {
        Logger.warning('Nenhum arquivo na fila de upload');
        return;
    }
    
    isUploading = true;
    showUploadProgress('Iniciando upload...');
    
    try {
        Logger.info('Iniciando upload de arquivos', { count: uploadQueue.length });
        
        const totalFiles = uploadQueue.length;
        let uploadedFiles = 0;
        let failedFiles = 0;
        
        // Upload sequencial de cada arquivo
        for (const file of uploadQueue) {
            try {
                Logger.info('Enviando arquivo', { fileName: file.name });
                
                updateUploadProgress((uploadedFiles / totalFiles) * 100);
                showUploadProgress(`Enviando ${file.name}...`);
                
                // ✅ ALTERADO: Passar databaseId para uploadFileToDrive
                const result = await DriveAPI.uploadFileToDrive(
                    file,
                    currentUploadContext.exibidora,
                    currentUploadContext.pontoId,
                    currentUploadContext.tipo,
                    currentUploadContext.databaseId
                );
                
                if (result.success) {
                    uploadedFiles++;
                    Logger.success('Arquivo enviado', { fileName: file.name });
                } else {
                    failedFiles++;
                    Logger.error('Falha no upload', { fileName: file.name, error: result.error });
                }
                
            } catch (error) {
                failedFiles++;
                Logger.error('Erro ao enviar arquivo', { fileName: file.name, error });
            }
        }
        
        // Atualizar progresso final
        updateUploadProgress(100);
        
        // Limpar fila
        uploadQueue = [];
        
        // Fechar modal após pequeno delay
        setTimeout(() => {
            closeUploadModal();
            
            // Mostrar mensagem de sucesso
            if (uploadedFiles > 0) {
                const message = failedFiles > 0 
                    ? `✅ ${uploadedFiles} arquivo(s) enviado(s) • ❌ ${failedFiles} falhou(aram)`
                    : `✅ ${uploadedFiles} arquivo(s) enviado(s) com sucesso!`;
                showSuccessMessage(message);
            }
            
            // Recarregar lista de arquivos
            refreshFilesList(
                currentUploadContext.exibidora,
                currentUploadContext.pontoId,
                currentUploadContext.tipo,
                currentUploadContext.databaseId // ✅ NOVO: Passar databaseId
            );
            
        }, 500);
        
    } catch (error) {
        Logger.error('Erro no processo de upload', error);
        alert('Erro no upload: ' + error.message);
    } finally {
        isUploading = false;
        hideUploadProgress();
    }
}

/**
 * 📤 MOSTRAR PROGRESSO DE UPLOAD
 * Exibe e atualiza a barra de progresso
 */
function showUploadProgress(message) {
    const progressContainer = document.getElementById('upload-progress');
    const progressText = document.getElementById('progress-text');
    
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
}

/**
 * 🔄 ATUALIZAR PROGRESSO DE UPLOAD
 * Atualiza a porcentagem da barra de progresso
 */
function updateUploadProgress(percent) {
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
}

/**
 * 🔒 ESCONDER PROGRESSO DE UPLOAD
 * Oculta a barra de progresso
 */
function hideUploadProgress() {
    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    
    if (progressText) {
        progressText.textContent = 'Enviando...';
    }
}

/**
 * 🔄 RECARREGAR LISTA DE ARQUIVOS
 * Recarrega a lista de arquivos de uma seção específica
 */
async function refreshFilesList(exibidora, pontoId, tipo, databaseId) { // ✅ NOVO: Receber databaseId
    try {
        Logger.info('Recarregando lista de arquivos', { exibidora, pontoId, tipo, databaseId });
        
        // ✅ ALTERADO: Passar databaseId para listDriveFiles
        const result = await DriveAPI.listDriveFiles(exibidora, pontoId, tipo, databaseId);
        
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

Logger.info('Módulo Upload Manager carregado');
