// =============================================================================
// 📷 GERENCIAMENTO DA CÂMERA - CHECKING OOH
// =============================================================================

let cameraStream = null;
let cameraVideo = null;
let cameraCanvas = null;
let currentExibidora = null;
let currentPontoId = null;
let currentTipo = null;
let currentDatabaseId = null; // ✅ NOVO: ID da campanha

/**
 * 📷 ABRIR CÂMERA
 * Inicia a câmera e abre o modal
 */
async function openCamera() {
    try {
        Logger.info('Abrindo câmera...');
        
        // Verificar se o navegador suporta getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Câmera não é suportada neste navegador');
        }
        
        // Abrir modal da câmera
        document.getElementById('camera-modal').style.display = 'flex';
        
        // Obter elementos
        cameraVideo = document.getElementById('camera-video');
        cameraCanvas = document.getElementById('camera-canvas');
        
        // Solicitar acesso à câmera
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: CONFIG.CAMERA.VIDEO_CONSTRAINTS,
            audio: false
        });
        
        // Conectar stream ao vídeo
        cameraVideo.srcObject = cameraStream;
        
        Logger.success('Câmera inicializada');
        
    } catch (error) {
        Logger.error('Erro ao abrir câmera', error);
        closeCameraModal();
        
        // Mostrar erro específico para o usuário
        let errorMessage = 'Não foi possível acessar a câmera.';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permissão de câmera negada. Permita o acesso à câmera e tente novamente.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Câmera não é suportada neste navegador.';
        }
        
        alert(errorMessage);
    }
}

/**
 * 📸 CAPTURAR FOTO
 * Tira uma foto da câmera e processa para upload
 */
async function capturePhoto() {
    try {
        if (!cameraVideo || !cameraCanvas || !cameraStream) {
            throw new Error('Câmera não está inicializada');
        }
        
        Logger.info('Capturando foto...');
        
        // Obter dimensões do vídeo
        const videoWidth = cameraVideo.videoWidth;
        const videoHeight = cameraVideo.videoHeight;
        
        if (videoWidth === 0 || videoHeight === 0) {
            throw new Error('Vídeo da câmera não está pronto');
        }
        
        // Configurar canvas com as dimensões do vídeo
        cameraCanvas.width = videoWidth;
        cameraCanvas.height = videoHeight;
        
        // Desenhar frame atual do vídeo no canvas
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, videoWidth, videoHeight);
        
        // Converter canvas para blob
        const photoBlob = await new Promise(resolve => {
            cameraCanvas.toBlob(resolve, CONFIG.CAMERA.PHOTO_FORMAT, CONFIG.CAMERA.PHOTO_QUALITY);
        });
        
        if (!photoBlob) {
            throw new Error('Falha ao capturar foto');
        }
        
        // Criar arquivo da foto
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `foto_${currentTipo}_${timestamp}.jpg`;
        
        const photoFile = new File([photoBlob], fileName, {
            type: CONFIG.CAMERA.PHOTO_FORMAT,
            lastModified: Date.now()
        });
        
        Logger.success('Foto capturada', { 
            fileName: photoFile.name, 
            size: photoFile.size 
        });
        
        // Fechar câmera
        closeCameraModal();
        
        // Iniciar upload automaticamente
        await uploadCapturedPhoto(photoFile);
        
    } catch (error) {
        Logger.error('Erro ao capturar foto', error);
        alert('Erro ao capturar foto: ' + error.message);
    }
}

/**
 * 📤 UPLOAD DE FOTO CAPTURADA
 * Faz upload da foto capturada pela câmera
 */
async function uploadCapturedPhoto(photoFile) {
    try {
        if (!currentExibidora || !currentPontoId || !currentTipo || !currentDatabaseId) { // ✅ ALTERADO: Validar databaseId
            throw new Error('Informações de contexto não disponíveis');
        }
        
        // Mostrar progresso
        showUploadProgress('Enviando foto capturada...');
        
        // ✅ ALTERADO: Passar databaseId para uploadFileToDrive
        const result = await DriveAPI.uploadFileToDrive(
            photoFile,
            currentExibidora,
            currentPontoId,
            currentTipo,
            currentDatabaseId
        );
        
        hideUploadProgress();
        
        if (result.success) {
            Logger.success('Foto enviada com sucesso');
            
            // Mostrar mensagem de sucesso
            showSuccessMessage('📸 Foto enviada com sucesso!');
            
            // Recarregar lista de arquivos
            await refreshFilesList(currentExibidora, currentPontoId, currentTipo, currentDatabaseId); // ✅ ALTERADO: Passar databaseId
        } else {
            throw new Error(result.error || 'Falha no upload');
        }
        
    } catch (error) {
        hideUploadProgress();
        Logger.error('Erro no upload da foto capturada', error);
        alert('Erro ao enviar foto: ' + error.message);
    }
}

/**
 * 🔒 FECHAR MODAL DA CÂMERA
 * Para a câmera e fecha o modal
 */
function closeCameraModal() {
    try {
        Logger.info('Fechando câmera...');
        
        // Parar stream da câmera
        if (cameraStream) {
            const tracks = cameraStream.getTracks();
            tracks.forEach(track => {
                track.stop();
                Logger.debug('Track da câmera parado', { kind: track.kind });
            });
            cameraStream = null;
        }
        
        // Limpar vídeo
        if (cameraVideo) {
            cameraVideo.srcObject = null;
        }
        
        // Fechar modal
        document.getElementById('camera-modal').style.display = 'none';
        
        // Limpar variáveis
        cameraVideo = null;
        cameraCanvas = null;
        
        Logger.success('Câmera fechada');
        
    } catch (error) {
        Logger.error('Erro ao fechar câmera', error);
    }
}

/**
 * 🎯 DEFINIR CONTEXTO DA CÂMERA
 * Define as informações necessárias para upload
 */
function setCameraContext(exibidora, pontoId, tipo, databaseId) { // ✅ NOVO: Receber databaseId
    currentExibidora = exibidora;
    currentPontoId = pontoId;
    currentTipo = tipo;
    currentDatabaseId = databaseId; // ✅ NOVO: Armazenar databaseId
    
    Logger.debug('Contexto da câmera definido', { 
        exibidora, 
        pontoId, 
        tipo,
        databaseId // ✅ NOVO
    });
}

// 🚀 EXPORTAR FUNÇÕES
window.CameraManager = {
    openCamera,
    capturePhoto,
    closeCameraModal,
    setCameraContext
};

// 🎯 EXPOR FUNÇÕES GLOBAIS PARA USO NO HTML
window.openCamera = openCamera;
window.capturePhoto = capturePhoto;
window.closeCameraModal = closeCameraModal;

Logger.info('Módulo Camera Manager carregado');
