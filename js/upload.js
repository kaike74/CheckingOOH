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
        console.log('📁 === PROCESSANDO ARQUIVOS SELECIONADOS ===');
        console.log('📁 Quantidade de arquivos:', files.length);
        Logger.info('Processando arquivos selecionados', { count: files.length });
        
        // Converter FileList para Array
        const fileArray = Array.from(files);
        
        // Log de cada arquivo
        fileArray.forEach((file, index) => {
            console.log(`📄 Arquivo ${index + 1}:`, {
                name: file.name,
                size: file.size,
                type: file.type
            });
        });
        
        // Verificar limite de arquivos
        if (fileArray.length > CONFIG.DRIVE.MAX_FILES_PER_UPLOAD) {
            const message = `Máximo de ${CONFIG.DRIVE.MAX_FILES_PER_UPLOAD} arquivos por vez.`;
            console.warn('⚠️', message);
            alert(message);
            return;
        }
        
        // Validar cada arquivo
        const validFiles = [];
        const errors = [];
        
        fileArray.forEach(file => {
            const validation = DriveAPI.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
                console.log(`✅ Arquivo válido: ${file.name}`);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
                console.error(`❌ Arquivo inválido: ${file.name} - ${validation.error}`);
            }
        });
        
        // Mostrar erros se houver
        if (errors.length > 0) {
            const errorMessage = 'Alguns arquivos não são válidos:\n\n' + errors.join('\n');
            console.error('❌ Erros de validação:', errors);
            alert(errorMessage);
        }
        
        // Se há arquivos válidos, iniciar upload
        if (validFiles.length > 0) {
            console.log(`✅ ${validFiles.length} arquivo(s) válido(s), iniciando upload...`);
            addFilesToQueue(validFiles);
            startUpload();
        } else {
            console.warn('⚠️ Nenhum arquivo válido para upload');
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar arquivos selecionados:', error);
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
        console.warn('⚠️ Upload já em andamento');
        Logger.warning('Upload já em andamento');
        return;
    }
    
    if (uploadQueue.length === 0) {
        console.warn('⚠️ Nenhum arquivo na fila de upload');
        Logger.warning('Nenhum arquivo na fila de upload');
        return;
    }
    
    isUploading = true;
    showUploadProgress('Iniciando upload...');
    
    try {
        console.log('🚀 === INICIANDO PROCESSO DE UPLOAD ===');
        console.log('📤 Contexto do upload:', currentUploadContext);
        Logger.info('Iniciando upload de arquivos', { count: uploadQueue.length });
        
        const totalFiles = uploadQueue.length;
        let uploadedFiles = 0;
        let failedFiles = 0;
        
        // Upload sequencial de cada arquivo
        for (const file of uploadQueue) {
            try {
                console.log(`📤 Enviando arquivo: ${file.name}...`);
                Logger.info('Enviando arquivo', { fileName: file.name });
                
                updateUploadProgress((uploadedFiles / totalFiles) * 100);
                showUploadProgress(`Enviando ${file.name}...`);
                
                // ✅ ALTERADO: Passar databaseId para uploadFileToDrive
                console.log('📤 Chamando DriveAPI.uploadFileToDrive com:', {
                    fileName: file.name,
                    exibidora: currentUploadContext.exibidora,
                    pontoId: currentUploadContext.pontoId,
                    tipo: currentUploadContext.tipo,
                    databaseId: currentUploadContext.databaseId
                });
                
                const result = await DriveAPI.uploadFileToDrive(
                    file,
                    currentUploadContext.exibidora,
                    currentUploadContext.pontoId,
                    currentUploadContext.tipo,
                    currentUploadContext.databaseId
                );
                
                console.log('📤 Resultado do upload:', result);
                
                if (result.success) {
                    uploadedFiles++;
                    console.log(`✅ Arquivo enviado com sucesso: ${file.name}`);
                    Logger.success('Arquivo enviado', { fileName: file.name });
                } else {
                    failedFiles++;
                    console.error(`❌ Falha no upload de ${file.name}:`, result.error);
                    Logger.error('Falha no upload', { fileName: file.name, error: result.error });
                }
                
            } catch (error) {
                failedFiles++;
                console.error(`❌ Erro ao enviar arquivo ${file.name}:`, error);
                Logger.error('Erro ao enviar arquivo', { fileName: file.name, error });
            }
        }
        
        // Atualizar progresso final
        updateUploadProgress(100);
        
        console.log('📊 Resultado final do upload:', {
            total: totalFiles,
            enviados: uploadedFiles,
            falhas: failedFiles
        });
        
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
                console.log('🎉', message);
                showSuccessMessage(message);
            }
            
            // Recarregar lista de arquivos
            console.log('🔄 Recarregando lista de arquivos...');
            refreshFilesList(
                currentUploadContext.exibidora,
                currentUploadContext.pontoId,
                currentUploadContext.tipo,
                currentUploadContext.databaseId
            );
            
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro no processo de upload:', error);
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
    const fileInput = document.getElementById('file-input');
    
    if (!uploadZone) {
        Logger.warning('Upload zone não encontrada');
        return;
    }
    
    // ✅ CORREÇÃO: Adicionar evento onchange ao input de arquivo
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                console.log('📁 Arquivo(s) selecionado(s):', files.length);
                Logger.info('Arquivo(s) selecionado(s)', { count: files.length });
                processSelectedFiles(files);
            }
        });
        Logger.debug('Evento onchange configurado no input de arquivo');
    } else {
        Logger.warning('File input não encontrado');
    }
    
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
