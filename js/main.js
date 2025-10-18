// =============================================================================
// 🚀 SCRIPT PRINCIPAL - CHECKING OOH
// =============================================================================

const appData = {
    mode: null, // 'exibidora' ou 'cliente'
    exibidora: null,
    pontos: [],
    pontoAtual: null,
    databaseId: null, // ✅ NOVO: ID da campanha
    editMode: {} // { 'pontoId-tipo': boolean }
};

/**
 * 🎬 INICIALIZAR APLICAÇÃO
 * Ponto de entrada principal
 */
async function initApp() {
    try {
        Logger.info('Iniciando aplicação Checking OOH...');
        
        // Configurar interface inicial
        setupInterface();
        
        // Detectar modo de acesso pela URL
        const urlParams = new URLSearchParams(window.location.search);
        const pontoId = urlParams.get('id');
        const clienteId = urlParams.get('idcliente');
        
        if (pontoId) {
            // Modo Exibidora
            appData.mode = 'exibidora';
            await loadExibidoraData(pontoId);
        } else if (clienteId) {
            // Modo Cliente
            appData.mode = 'cliente';
            await loadClienteData(clienteId);
        } else {
            // Sem ID - Mostrar instruções
            showWelcomeScreen();
        }
        
        // Configurar drag & drop após carregar dados
        setupDragAndDrop();
        
        Logger.success('Aplicação inicializada com sucesso');
        
    } catch (error) {
        Logger.error('Erro ao inicializar aplicação', error);
        showErrorScreen(error.message);
    }
}

/**
 * 📢 CARREGAR DADOS DA EXIBIDORA
 * Carrega todos os pontos de uma exibidora
 */
async function loadExibidoraData(pontoId) {
    try {
        Logger.info('Carregando dados da exibidora', { pontoId });
        
        // Buscar dados no Notion
        const notionData = await NotionAPI.fetchPontosFromNotion(pontoId);
        
        appData.exibidora = notionData.exibidora;
        appData.pontos = notionData.pontos;
        appData.pontoAtual = notionData.ponto;
        appData.databaseId = notionData.databaseId; // ✅ NOVO: Armazenar ID da campanha
        
        Logger.info('✅ Database ID da campanha:', appData.databaseId);
        
        // Atualizar header
        updatePageHeader(`📢 ${appData.exibidora}`, `Modo Exibidora • ${appData.pontos.length} ponto(s)`);
        
        // Mostrar informações da exibidora
        showExibidoraInfo();
        
        // Renderizar pontos
        await renderPontos();
        
        Logger.success('Dados da exibidora carregados', { 
            exibidora: appData.exibidora, 
            pontosCount: appData.pontos.length,
            campanhaId: appData.databaseId
        });
        
    } catch (error) {
        Logger.error('Erro ao carregar dados da exibidora', error);
        throw error;
    }
}

/**
 * 👤 CARREGAR DADOS DO CLIENTE
 * Carrega apenas o ponto específico do cliente
 */
async function loadClienteData(clienteId) {
    try {
        Logger.info('Carregando dados do cliente', { clienteId });
        
        // Buscar dados no Notion
        const notionData = await NotionAPI.fetchPontoForCliente(clienteId);
        
        appData.exibidora = notionData.ponto.exibidora;
        appData.pontos = [notionData.ponto]; // Cliente vê apenas seu ponto
        appData.pontoAtual = notionData.ponto;
        appData.databaseId = notionData.databaseId; // ✅ NOVO: Armazenar ID da campanha
        
        // Atualizar header com endereço do ponto
        updatePageHeader(`👤 ${appData.pontoAtual.endereco}`, `Modo Cliente • Visualização`);
        
        // Renderizar ponto do cliente (somente leitura)
        await renderPontos(true);
        
        Logger.success('Dados do cliente carregados', { 
            endereco: appData.pontoAtual.endereco,
            campanhaId: appData.databaseId
        });
        
    } catch (error) {
        Logger.error('Erro ao carregar dados do cliente', error);
        throw error;
    }
}

/**
 * 🏗️ RENDERIZAR PONTOS
 * Renderiza a lista de pontos na interface
 */
async function renderPontos(readOnly = false) {
    try {
        Logger.info('Renderizando pontos', { count: appData.pontos.length, readOnly });
        
        const container = document.getElementById('pontos-list');
        if (!container) throw new Error('Container de pontos não encontrado');
        
        container.innerHTML = '';
        
        for (const ponto of appData.pontos) {
            const pontoElement = await createPontoElement(ponto, readOnly);
            container.appendChild(pontoElement);
        }
        
        // Mostrar seção de pontos
        document.getElementById('pontos-section').style.display = 'block';
        
        Logger.success('Pontos renderizados', { count: appData.pontos.length });
        
    } catch (error) {
        Logger.error('Erro ao renderizar pontos', error);
        throw error;
    }
}

/**
 * 🏗️ CRIAR ELEMENTO DE PONTO
 * Cria o elemento HTML para um ponto específico
 */
async function createPontoElement(ponto, readOnly = false) {
    const pontoDiv = document.createElement('div');
    pontoDiv.className = 'ponto-item';
    pontoDiv.id = `ponto-${ponto.id}`;
    
    // Header do ponto
    const headerDiv = document.createElement('div');
    headerDiv.className = 'ponto-header';
    
    // ⚠️ IMPORTANTE: Usar "endereco" em vez de "ponto"
    const infoDiv = document.createElement('div');
    infoDiv.className = 'ponto-info';
    infoDiv.innerHTML = `
        <h3>📍 ${ponto.endereco}</h3>
        <p style="font-size: 14px; color: #64748B;">Exibidora: ${ponto.exibidora}</p>
    `;
    
    // Ações do ponto (apenas para exibidora)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'ponto-actions';
    
    if (!readOnly) {
        actionsDiv.innerHTML = `
            <button class="btn btn-small btn-expand" onclick="togglePontoContent('${ponto.id}')" title="Expandir/Recolher">
                <span id="toggle-icon-${ponto.id}">▼</span>
            </button>
        `;
    }
    
    headerDiv.appendChild(infoDiv);
    headerDiv.appendChild(actionsDiv);
    
    // Conteúdo do ponto (seções Entrada e Saída)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ponto-content';
    contentDiv.id = `content-${ponto.id}`;
    contentDiv.style.display = readOnly ? 'grid' : 'none'; // Cliente sempre vê, exibidora precisa expandir
    
    // Seção Entrada
    const entradaSection = await createSecaoElement(ponto, 'entrada', readOnly);
    contentDiv.appendChild(entradaSection);
    
    // Seção Saída
    const saidaSection = await createSecaoElement(ponto, 'saida', readOnly);
    contentDiv.appendChild(saidaSection);
    
    pontoDiv.appendChild(headerDiv);
    pontoDiv.appendChild(contentDiv);
    
    return pontoDiv;
}

/**
 * 📥📤 CRIAR SEÇÃO (ENTRADA/SAÍDA)
 * Cria uma seção de entrada ou saída
 */
async function createSecaoElement(ponto, tipo, readOnly = false) {
    const secaoDiv = document.createElement('div');
    secaoDiv.className = `secao ${tipo}`;
    
    // Título da seção
    const titleDiv = document.createElement('div');
    titleDiv.className = 'secao-title';
    const emoji = tipo === 'entrada' ? '📥' : '📤';
    const titulo = tipo === 'entrada' ? 'Entrada' : 'Saída';
    titleDiv.innerHTML = `${emoji} ${titulo}`;
    
    secaoDiv.appendChild(titleDiv);
    
    // Ações (apenas para exibidora)
    if (!readOnly) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'secao-actions';
        // ✅ ALTERADO: Passar databaseId para openUploadModal
        actionsDiv.innerHTML = `
            <button class="btn btn-camera btn-small" onclick="openUploadModal('${appData.exibidora}', '${ponto.id}', '${tipo}', '${appData.databaseId}')">
                📷 Tirar Foto
            </button>
            <button class="btn btn-primary btn-small" onclick="openUploadModal('${appData.exibidora}', '${ponto.id}', '${tipo}', '${appData.databaseId}')">
                📁 Upload
            </button>
            <button class="btn btn-secondary btn-small" onclick="toggleEditMode('${ponto.id}', '${tipo}')" id="edit-btn-${ponto.id}-${tipo}">
                ✏️ Editar
            </button>
            <button class="btn btn-primary btn-small" onclick="openPhotoModal('${ponto.id}', '${tipo}')">
                👁️ Ver Fotos
            </button>
        `;
        secaoDiv.appendChild(actionsDiv);
    }
    
    // Preview de mídia
    const previewDiv = document.createElement('div');
    previewDiv.className = 'media-preview';
    previewDiv.id = `preview-${ponto.id}-${tipo}`;
    
    // Carregar arquivos existentes
    await loadMediaPreview(ponto, tipo, previewDiv, readOnly);
    
    secaoDiv.appendChild(previewDiv);
    
    // Contador de mídia
    const countDiv = document.createElement('div');
    countDiv.className = 'media-count';
    countDiv.id = `count-${ponto.id}-${tipo}`;
    secaoDiv.appendChild(countDiv);
    
    return secaoDiv;
}

/**
 * 🖼️ CARREGAR PREVIEW DE MÍDIA
 * Carrega e exibe o preview dos arquivos
 */
async function loadMediaPreview(ponto, tipo, container, readOnly = false) {
    try {
        Logger.debug('Carregando preview de mídia', { pontoId: ponto.id, tipo });
        
        // ✅ ALTERADO: Passar databaseId para listDriveFiles
        const result = await DriveAPI.listDriveFiles(appData.exibidora, ponto.id, tipo, appData.databaseId);
        
        if (result.success && result.files.length > 0) {
            // Atualizar preview
            updateMediaPreview(ponto.id, tipo, result.files, readOnly);
        } else {
            // Sem arquivos
            container.innerHTML = '<p style="text-align: center; color: #64748B; font-size: 12px;">Nenhum arquivo</p>';
            updateMediaCount(ponto.id, tipo, 0);
        }
        
    } catch (error) {
        Logger.warning('Erro ao carregar preview de mídia', error);
        container.innerHTML = '<p style="text-align: center; color: #EF4444; font-size: 12px;">Erro ao carregar</p>';
    }
}

/**
 * 🔄 ATUALIZAR PREVIEW DE MÍDIA
 * Atualiza o preview com novos arquivos
 */
function updateMediaPreview(pontoId, tipo, files, readOnly = false) {
    const container = document.getElementById(`preview-${pontoId}-${tipo}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (files.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748B; font-size: 12px;">Nenhum arquivo</p>';
        updateMediaCount(pontoId, tipo, 0);
        return;
    }
    
    files.forEach(file => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        mediaItem.onclick = () => openPhotoModal(pontoId, tipo);
        
        if (DriveAPI.isVideoFile(file.mimeType)) {
            // Vídeo
            mediaItem.innerHTML = `
                <video>
                    <source src="${file.url}" type="${file.mimeType}">
                </video>
                <div class="photo-date">${DriveAPI.formatDate(file.createdTime)}</div>
            `;
        } else {
            // Imagem
            mediaItem.innerHTML = `
                <img src="${file.url}" alt="${file.name}" loading="lazy">
                <div class="photo-date">${DriveAPI.formatDate(file.createdTime)}</div>
            `;
        }
        
        // Ações de edição (apenas para exibidora em modo edição)
        if (!readOnly && isEditMode(pontoId, tipo)) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'photo-actions';
            actionsDiv.innerHTML = `
                <button class="btn btn-danger btn-small" onclick="deleteFile('${file.id}', '${file.name}', '${pontoId}', '${tipo}')" title="Excluir">
                    🗑️
                </button>
            `;
            mediaItem.appendChild(actionsDiv);
        }
        
        container.appendChild(mediaItem);
    });
    
    updateMediaCount(pontoId, tipo, files.length);
}

/**
 * 📊 ATUALIZAR CONTADOR DE MÍDIA
 * Atualiza o contador de arquivos
 */
function updateMediaCount(pontoId, tipo, count) {
    const countElement = document.getElementById(`count-${pontoId}-${tipo}`);
    if (countElement) {
        const text = count === 0 ? 'Nenhum arquivo' : 
                     count === 1 ? '1 arquivo' : 
                     `${count} arquivos`;
        countElement.textContent = text;
    }
}

/**
 * 🔄 ALTERNAR CONTEÚDO DO PONTO
 * Expande/recolhe o conteúdo de um ponto
 */
function togglePontoContent(pontoId) {
    const content = document.getElementById(`content-${pontoId}`);
    const icon = document.getElementById(`toggle-icon-${pontoId}`);
    
    if (content && icon) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'grid';
        icon.textContent = isVisible ? '▼' : '▲';
        
        Logger.debug('Conteúdo do ponto alternado', { pontoId, visible: !isVisible });
    }
}

/**
 * ✏️ ALTERNAR MODO EDIÇÃO
 * Ativa/desativa o modo edição para uma seção
 */
function toggleEditMode(pontoId, tipo) {
    const key = `${pontoId}-${tipo}`;
    const isCurrentlyEditing = appData.editMode[key] || false;
    
    appData.editMode[key] = !isCurrentlyEditing;
    
    const editBtn = document.getElementById(`edit-btn-${pontoId}-${tipo}`);
    if (editBtn) {
        editBtn.textContent = appData.editMode[key] ? '✅ Finalizar' : '✏️ Editar';
        editBtn.className = appData.editMode[key] ? 'btn btn-success btn-small' : 'btn btn-secondary btn-small';
    }
    
    // Recarregar preview para mostrar/ocultar botões de delete
    const ponto = appData.pontos.find(p => p.id === pontoId);
    if (ponto) {
        const container = document.getElementById(`preview-${pontoId}-${tipo}`);
        if (container) {
            loadMediaPreview(ponto, tipo, container, false);
        }
    }
    
    Logger.debug('Modo edição alternado', { pontoId, tipo, editMode: appData.editMode[key] });
}

/**
 * ❓ VERIFICAR MODO EDIÇÃO
 * Verifica se uma seção está em modo edição
 */
function isEditMode(pontoId, tipo) {
    return appData.editMode[`${pontoId}-${tipo}`] || false;
}

/**
 * 🗑️ EXCLUIR ARQUIVO
 * Confirma e exclui um arquivo
 */
async function deleteFile(fileId, fileName, pontoId, tipo) {
    try {
        if (!confirm(`Tem certeza que deseja excluir "${fileName}"?`)) {
            return;
        }
        
        Logger.info('Excluindo arquivo', { fileId, fileName });
        
        showUploadProgress('Excluindo arquivo...');
        
        const result = await DriveAPI.deleteFileFromDrive(fileId, fileName);
        
        hideUploadProgress();
        
        if (result.success) {
            Logger.success('Arquivo excluído', { fileName });
            
            // Recarregar preview
            const ponto = appData.pontos.find(p => p.id === pontoId);
            if (ponto) {
                const container = document.getElementById(`preview-${pontoId}-${tipo}`);
                if (container) {
                    await loadMediaPreview(ponto, tipo, container, false);
                }
            }
            
            showSuccessMessage('🗑️ Arquivo excluído com sucesso!');
        } else {
            throw new Error(result.error || 'Falha na exclusão');
        }
        
    } catch (error) {
        hideUploadProgress();
        Logger.error('Erro ao excluir arquivo', error);
        alert('Erro ao excluir arquivo: ' + error.message);
    }
}

/**
 * 👁️ ABRIR MODAL DE FOTOS
 * Abre o modal para visualizar todas as fotos
 */
async function openPhotoModal(pontoId, tipo) {
    try {
        Logger.info('Abrindo modal de fotos', { pontoId, tipo });
        
        const ponto = appData.pontos.find(p => p.id === pontoId);
        if (!ponto) {
            throw new Error('Ponto não encontrado');
        }
        
        // Atualizar título do modal com ENDEREÇO
        const modalTitle = document.getElementById('modal-title');
        const tipoText = tipo === 'entrada' ? 'Entrada' : 'Saída';
        modalTitle.textContent = `📸 ${ponto.endereco} - ${tipoText}`;
        
        // ✅ ALTERADO: Passar databaseId para listDriveFiles
        const result = await DriveAPI.listDriveFiles(appData.exibidora, pontoId, tipo, appData.databaseId);
        
        const container = document.getElementById('photos-grid');
        container.innerHTML = '';
        
        if (result.success && result.files.length > 0) {
            result.files.forEach(file => {
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';
                
                if (DriveAPI.isVideoFile(file.mimeType)) {
                    photoItem.innerHTML = `
                        <video controls>
                            <source src="${file.url}" type="${file.mimeType}">
                        </video>
                        <div class="photo-date">${DriveAPI.formatDate(file.createdTime)}</div>
                    `;
                } else {
                    photoItem.innerHTML = `
                        <img src="${file.url}" alt="${file.name}" onclick="openFullImage('${file.url}')">
                        <div class="photo-date">${DriveAPI.formatDate(file.createdTime)}</div>
                    `;
                }
                
                // Ações para exibidora em modo edição
                if (appData.mode === 'exibidora' && isEditMode(pontoId, tipo)) {
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'photo-actions';
                    actionsDiv.innerHTML = `
                        <button class="btn btn-danger btn-small" onclick="deleteFile('${file.id}', '${file.name}', '${pontoId}', '${tipo}')">
                            🗑️
                        </button>
                    `;
                    photoItem.appendChild(actionsDiv);
                }
                
                container.appendChild(photoItem);
            });
        } else {
            container.innerHTML = '<p style="text-align: center; color: #64748B;">Nenhuma foto ou vídeo encontrado</p>';
        }
        
        // Mostrar modal
        document.getElementById('photo-modal').style.display = 'flex';
        
    } catch (error) {
        Logger.error('Erro ao abrir modal de fotos', error);
        alert('Erro ao carregar fotos: ' + error.message);
    }
}

/**
 * 🖼️ ABRIR IMAGEM EM TELA CHEIA
 * Abre uma imagem em nova aba para visualização completa
 */
function openFullImage(imageUrl) {
    window.open(imageUrl, '_blank');
}

/**
 * 🔒 FECHAR MODAL DE FOTOS
 * Fecha o modal de visualização de fotos
 */
function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
}

/**
 * 🎨 CONFIGURAR INTERFACE
 * Configura elementos da interface baseado no modo
 */
function setupInterface() {
    // Configurar modo cliente (ocultar elementos de exibidora)
    if (appData.mode === 'cliente') {
        const style = document.createElement('style');
        style.textContent = `
            .btn-camera, .btn[onclick*="openUploadModal"], .btn[onclick*="toggleEditMode"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    Logger.debug('Interface configurada', { mode: appData.mode });
}

/**
 * 🏠 MOSTRAR TELA DE BOAS-VINDAS
 * Exibe instruções quando não há ID na URL
 */
function showWelcomeScreen() {
    const container = document.getElementById('pontos-section');
    container.style.display = 'block';
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <h2 style="color: #1E293B; margin-bottom: 20px;">👋 Bem-vindo ao Checking OOH</h2>
            <p style="color: #64748B; margin-bottom: 30px;">Para acessar o sistema, use um dos links abaixo:</p>
            
            <div style="max-width: 600px; margin: 0 auto; text-align: left;">
                <div style="background: #F1F5F9; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="color: #1E293B; margin-bottom: 10px;">📢 Modo Exibidora</h3>
                    <p style="color: #64748B; font-size: 14px;">Acesse com o ID do ponto do Notion:</p>
                    <code style="background: white; padding: 8px 12px; border-radius: 6px; display: block; margin-top: 10px;">
                        ?id=SEU_PONTO_ID
                    </code>
                </div>
                
                <div style="background: #F1F5F9; padding: 20px; border-radius: 12px;">
                    <h3 style="color: #1E293B; margin-bottom: 10px;">👤 Modo Cliente</h3>
                    <p style="color: #64748B; font-size: 14px;">Acesse com o ID do cliente do Notion:</p>
                    <code style="background: white; padding: 8px 12px; border-radius: 6px; display: block; margin-top: 10px;">
                        ?idcliente=SEU_CLIENTE_ID
                    </code>
                </div>
            </div>
        </div>
    `;
}

/**
 * ❌ MOSTRAR TELA DE ERRO
 * Exibe mensagem de erro amigável
 */
function showErrorScreen(errorMessage) {
    const container = document.getElementById('pontos-section');
    container.style.display = 'block';
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <h2 style="color: #EF4444; margin-bottom: 20px;">⚠️ Erro ao Carregar Dados</h2>
            <p style="color: #64748B; margin-bottom: 20px;">${errorMessage}</p>
            <button onclick="location.reload()" class="btn btn-primary">🔄 Recarregar Página</button>
        </div>
    `;
}

/**
 * 📢 MOSTRAR INFORMAÇÕES DA EXIBIDORA
 * Exibe informações no topo da página
 */
function showExibidoraInfo() {
    // Pode ser expandido para mostrar mais informações
    Logger.debug('Exibindo informações da exibidora');
}

/**
 * 🏷️ ATUALIZAR HEADER DA PÁGINA
 * Atualiza título e subtítulo do header
 */
function updatePageHeader(title, subtitle) {
    const titleElement = document.getElementById('page-title');
    const subtitleElement = document.getElementById('page-subtitle');
    
    if (titleElement) titleElement.textContent = title;
    if (subtitleElement) subtitleElement.textContent = subtitle;
}

/**
 * 📤 MOSTRAR PROGRESSO DE UPLOAD
 * Exibe barra de progresso durante upload
 */
function showUploadProgress(message = 'Enviando...') {
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
 * Atualiza a barra de progresso
 */
function updateUploadProgress(percent) {
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
}

/**
 * 🔒 ESCONDER PROGRESSO DE UPLOAD
 * Oculta barra de progresso
 */
function hideUploadProgress() {
    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    if (progressFill) {
        progressFill.style.width = '0%';
    }
}

/**
 * ❌ ESCONDER AVISO DEMO
 * Remove o aviso de modo demonstração
 */
function hideDemoWarning() {
    const warning = document.getElementById('demo-warning');
    if (warning) {
        warning.style.display = 'none';
    }
}

/**
 * ✅ MOSTRAR MENSAGEM DE SUCESSO
 * Exibe uma notificação de sucesso temporária
 */
function showSuccessMessage(message) {
    const notification = document.createElement('div');
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
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 600;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// 🚀 EXPORTAR FUNÇÕES GLOBAIS
window.togglePontoContent = togglePontoContent;
window.toggleEditMode = toggleEditMode;
window.deleteFile = deleteFile;
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
window.openFullImage = openFullImage;
window.hideDemoWarning = hideDemoWarning;
window.updateMediaPreview = updateMediaPreview;
window.showSuccessMessage = showSuccessMessage;

Logger.info('Script principal carregado');
