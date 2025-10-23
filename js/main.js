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

        // Mostrar loading
        showLoading();

        // Configurar interface inicial
        setupInterface();

        // Detectar modo de acesso pela URL
        const urlParams = new URLSearchParams(window.location.search);
        const pontoId = urlParams.get('id');
        const clienteId = urlParams.get('idcliente');
        const exibidora = urlParams.get('exibidora');
        const databaseId = urlParams.get('databaseId');

        // ✅ CORREÇÃO 2: Armazenar databaseId e exibidora da URL
        if (databaseId && databaseId !== 'null' && databaseId !== 'undefined') {
            appData.databaseId = databaseId;
            Logger.info('✅ Database ID obtido da URL:', databaseId);
        }

        if (exibidora && exibidora !== 'null' && exibidora !== 'undefined') {
            appData.exibidora = exibidora;
            Logger.info('✅ Exibidora obtida da URL:', exibidora);
        }

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
            hideLoading();
            showWelcomeScreen();
            return;
        }

        // Configurar drag & drop após carregar dados
        setupDragAndDrop();

        // ✅ CORREÇÃO 3: Esconder loading após carregar tudo
        hideLoading();

        Logger.success('Aplicação inicializada com sucesso');

    } catch (error) {
        Logger.error('Erro ao inicializar aplicação', error);
        hideLoading();
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
        // ✅ MELHORIA: Removido botão "Ver Fotos" - clique direto nas imagens abre carrossel
        actionsDiv.innerHTML = `
            <button class="btn btn-primary btn-small" onclick="openMediaChoiceModal('${appData.exibidora}', '${ponto.id}', '${tipo}', '${appData.databaseId}')">
                📎 Adicionar Mídia
            </button>
            <button class="btn btn-secondary btn-small" onclick="toggleEditMode('${ponto.id}', '${tipo}')" id="edit-btn-${ponto.id}-${tipo}">
                ✏️ Editar
            </button>
        `;
        secaoDiv.appendChild(actionsDiv);
    }
    
    // Preview de mídia
    const previewDiv = document.createElement('div');
    previewDiv.className = 'media-preview';
    previewDiv.id = `preview-${ponto.id}-${tipo}`;

    // ✅ OTIMIZAÇÃO: Lazy loading - só carregar quando visível ou em modo cliente
    if (readOnly) {
        // Modo cliente: carregar imediatamente
        await loadMediaPreview(ponto, tipo, previewDiv, readOnly);
    } else {
        // Modo exibidora: mostrar placeholder, carregar sob demanda
        previewDiv.innerHTML = '<p style="text-align: center; color: #94A3B8; font-size: 11px; padding: 10px;">↓ Expanda para carregar ↓</p>';
        previewDiv.dataset.pontoId = ponto.id;
        previewDiv.dataset.tipo = tipo;
        previewDiv.dataset.loaded = 'false';
    }

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
        // ✅ MELHORIA: Abrir carousel fullscreen em vez de modal grid
        mediaItem.onclick = () => openMediaCarousel(pontoId, tipo, container.children.length - 1);
        
        if (DriveAPI.isVideoFile(file.mimeType)) {
            // ✅ CORREÇÃO: Vídeo com thumbnail e ícone de play
            const videoThumb = file.thumbnailUrl || `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;

            // ✅ MELHORIA: Removido timestamp conforme solicitado
            mediaItem.innerHTML = `
                <div style="
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: url('${videoThumb}') center/cover no-repeat, #000;
                    cursor: pointer;
                ">
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(0,0,0,0.7);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 20px;
                    ">▶</div>
                    <div style="
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        background: rgba(0,0,0,0.7);
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: bold;
                    ">VÍDEO</div>
                </div>
            `;
        } else {
            // Imagem com fallback
            const img = document.createElement('img');
            img.alt = file.name;
            img.loading = 'lazy';
            img.dataset.fileId = file.id;
            img.dataset.fileName = file.name;

            // ✅ NOVO: Adicionar URLs alternativas como data attributes
            if (file.alternativeUrls && file.alternativeUrls.length > 0) {
                img.dataset.alternativeUrls = JSON.stringify(file.alternativeUrls);
                img.dataset.currentUrlIndex = '0';
            }

            // ✅ NOVO: Handler de erro com fallback automático
            img.onerror = function() {
                console.warn(`⚠️ Erro ao carregar imagem: ${this.src}`);
                handleImageError(this);
            };

            // ✅ NOVO: Log quando carrega com sucesso
            img.onload = function() {
                console.log(`✅ Imagem carregada: ${this.dataset.fileName}`);
            };

            img.src = file.url;
            console.log(`🖼️ Tentando carregar imagem ${file.name} de: ${file.url}`);

            // ✅ MELHORIA: Timestamp removido conforme solicitado
            mediaItem.appendChild(img);
        }
        
        // ✅ CORREÇÃO: Badge de delete sempre criado, mas inicialmente escondido
        if (!readOnly) {
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'delete-badge';
            deleteBtn.innerHTML = '−'; // Sinal de menos
            deleteBtn.style.display = isEditMode(pontoId, tipo) ? 'flex' : 'none';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Não abrir carrossel ao clicar no -
                deleteFile(file.id, file.name, pontoId, tipo);
            };
            mediaItem.appendChild(deleteBtn);
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
async function togglePontoContent(pontoId) {
    const content = document.getElementById(`content-${pontoId}`);
    const icon = document.getElementById(`toggle-icon-${pontoId}`);

    if (content && icon) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'grid';
        icon.textContent = isVisible ? '▼' : '▲';

        // ✅ OTIMIZAÇÃO: Lazy load - carregar arquivos na primeira expansão
        // ✅ OTIMIZAÇÃO: Carregar entrada e saída em PARALELO
        if (!isVisible) {
            const ponto = appData.pontos.find(p => p.id === pontoId);
            if (ponto) {
                await Promise.all([
                    loadPontoMediaIfNeeded(ponto, 'entrada'),
                    loadPontoMediaIfNeeded(ponto, 'saida')
                ]);
            }
        }

        Logger.debug('Conteúdo do ponto alternado', { pontoId, visible: !isVisible });
    }
}

/**
 * 📥 CARREGAR MÍDIA SE NECESSÁRIO (LAZY LOADING)
 * Carrega arquivos apenas se ainda não foram carregados
 */
async function loadPontoMediaIfNeeded(ponto, tipo) {
    const previewDiv = document.getElementById(`preview-${ponto.id}-${tipo}`);

    if (!previewDiv) return;

    const isLoaded = previewDiv.dataset.loaded === 'true';

    if (!isLoaded) {
        console.log(`📥 Lazy loading: Carregando arquivos ${tipo} para ponto ${ponto.id}`);

        // ✅ OTIMIZAÇÃO: Mostrar skeleton loaders durante carregamento
        previewDiv.className = 'media-preview loading';
        previewDiv.innerHTML = `
            <div class="skeleton skeleton-media-item"></div>
            <div class="skeleton skeleton-media-item"></div>
            <div class="skeleton skeleton-media-item"></div>
        `;

        await loadMediaPreview(ponto, tipo, previewDiv, false);
        previewDiv.className = 'media-preview'; // Remover classe loading
        previewDiv.dataset.loaded = 'true';

        Logger.info('Arquivos carregados via lazy loading', { pontoId: ponto.id, tipo });
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
    
    // ✅ CORREÇÃO: Apenas mostrar/ocultar badges de delete SEM recarregar (remove delay)
    const container = document.getElementById(`preview-${pontoId}-${tipo}`);
    if (container) {
        const deleteButtons = container.querySelectorAll('.delete-badge');
        deleteButtons.forEach(badge => {
            badge.style.display = appData.editMode[key] ? 'flex' : 'none';
        });
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
 * 🎠 ABRIR CARROSSEL DE MÍDIA (NOVO)
 * Visualizador fullscreen com navegação por setas
 */
async function openMediaCarousel(pontoId, tipo, startIndex = 0) {
    try {
        Logger.info('Abrindo carrossel de mídia', { pontoId, tipo, startIndex });

        // Buscar arquivos
        const result = await DriveAPI.listDriveFiles(appData.exibidora, pontoId, tipo, appData.databaseId);

        if (!result.success || result.files.length === 0) {
            alert('Nenhuma mídia encontrada');
            return;
        }

        // Criar overlay fullscreen
        const carousel = document.createElement('div');
        carousel.id = 'media-carousel';
        carousel.className = 'media-carousel';
        carousel.innerHTML = `
            <div class="carousel-overlay" onclick="closeMediaCarousel()"></div>
            <div class="carousel-content">
                <button class="carousel-close" onclick="closeMediaCarousel()">×</button>
                <button class="carousel-nav carousel-prev" onclick="carouselPrev()">‹</button>
                <button class="carousel-nav carousel-next" onclick="carouselNext()">›</button>
                <div class="carousel-counter"><span id="carousel-current">1</span> / <span id="carousel-total">${result.files.length}</span></div>
                <div class="carousel-media" id="carousel-media"></div>
            </div>
        `;

        document.body.appendChild(carousel);

        // Armazenar dados para navegação
        window.carouselData = {
            files: result.files,
            currentIndex: Math.min(startIndex, result.files.length - 1),
            pontoId: pontoId,
            tipo: tipo
        };

        // Mostrar primeira mídia
        showCarouselMedia(window.carouselData.currentIndex);

        // Adicionar controle por teclado
        document.addEventListener('keydown', handleCarouselKeyboard);

    } catch (error) {
        Logger.error('Erro ao abrir carrossel', error);
        alert('Erro ao carregar mídia: ' + error.message);
    }
}

/**
 * 🖼️ MOSTRAR MÍDIA NO CARROSSEL
 */
function showCarouselMedia(index) {
    const data = window.carouselData;
    const file = data.files[index];
    const container = document.getElementById('carousel-media');

    // Atualizar contador
    document.getElementById('carousel-current').textContent = index + 1;

    // Limpar conteúdo anterior
    container.innerHTML = '';

    if (DriveAPI.isVideoFile(file.mimeType)) {
        // Vídeo
        container.innerHTML = `
            <video controls autoplay style="max-width: 90vw; max-height: 90vh;">
                <source src="${file.url}" type="${file.mimeType}">
                Seu navegador não suporta vídeos.
            </video>
        `;
    } else {
        // Imagem
        const img = document.createElement('img');
        img.src = file.url;
        img.alt = file.name;
        img.style.maxWidth = '90vw';
        img.style.maxHeight = '90vh';
        img.style.objectFit = 'contain';

        // Fallback de erro
        if (file.alternativeUrls && file.alternativeUrls.length > 0) {
            img.dataset.alternativeUrls = JSON.stringify(file.alternativeUrls);
            img.dataset.currentUrlIndex = '0';
            img.dataset.fileId = file.id;
            img.dataset.fileName = file.name;
            img.onerror = function() {
                handleImageError(this);
            };
        }

        container.appendChild(img);
    }

    data.currentIndex = index;
}

/**
 * ◀️ NAVEGAR PARA ANTERIOR
 */
function carouselPrev() {
    const data = window.carouselData;
    if (data.currentIndex > 0) {
        showCarouselMedia(data.currentIndex - 1);
    }
}

/**
 * ▶️ NAVEGAR PARA PRÓXIMO
 */
function carouselNext() {
    const data = window.carouselData;
    if (data.currentIndex < data.files.length - 1) {
        showCarouselMedia(data.currentIndex + 1);
    }
}

/**
 * ⌨️ CONTROLE POR TECLADO
 */
function handleCarouselKeyboard(e) {
    if (!document.getElementById('media-carousel')) return;

    switch(e.key) {
        case 'ArrowLeft':
            carouselPrev();
            break;
        case 'ArrowRight':
            carouselNext();
            break;
        case 'Escape':
            closeMediaCarousel();
            break;
    }
}

/**
 * 🔒 FECHAR CARROSSEL
 */
function closeMediaCarousel() {
    const carousel = document.getElementById('media-carousel');
    if (carousel) {
        carousel.remove();
    }
    window.carouselData = null;
    document.removeEventListener('keydown', handleCarouselKeyboard);
}

/**
 * 👁️ ABRIR MODAL DE FOTOS (ANTIGO - mantido para compatibilidade)
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
                    // ✅ Imagem com fallback (mesmo tratamento do preview)
                    const img = document.createElement('img');
                    img.alt = file.name;
                    img.dataset.fileId = file.id;
                    img.dataset.fileName = file.name;
                    img.onclick = () => openFullImage(file.url);

                    // Adicionar URLs alternativas
                    if (file.alternativeUrls && file.alternativeUrls.length > 0) {
                        img.dataset.alternativeUrls = JSON.stringify(file.alternativeUrls);
                        img.dataset.currentUrlIndex = '0';
                    }

                    // Handler de erro com fallback
                    img.onerror = function() {
                        console.warn(`⚠️ Erro ao carregar imagem no modal: ${this.src}`);
                        handleImageError(this);
                    };

                    img.onload = function() {
                        console.log(`✅ Imagem carregada no modal: ${this.dataset.fileName}`);
                    };

                    img.src = file.url;
                    console.log(`🖼️ Modal: Carregando ${file.name} de: ${file.url}`);

                    const dateDiv = document.createElement('div');
                    dateDiv.className = 'photo-date';
                    dateDiv.textContent = DriveAPI.formatDate(file.createdTime);

                    photoItem.appendChild(img);
                    photoItem.appendChild(dateDiv);
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

/**
 * 🔄 MOSTRAR LOADING
 * Exibe a tela de carregamento
 */
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
        Logger.debug('Loading exibido');
    }
}

/**
 * 🔒 ESCONDER LOADING
 * Oculta a tela de carregamento
 */
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
        Logger.debug('Loading escondido');
    }
}

/**
 * ⚠️ TRATAR ERRO DE IMAGEM COM FALLBACK
 * Tenta URLs alternativas quando a principal falha
 */
function handleImageError(imgElement) {
    const alternativeUrls = imgElement.dataset.alternativeUrls;

    if (!alternativeUrls) {
        console.error(`❌ Sem URLs alternativas para ${imgElement.dataset.fileName}`);
        showImageErrorPlaceholder(imgElement);
        return;
    }

    try {
        const urls = JSON.parse(alternativeUrls);
        let currentIndex = parseInt(imgElement.dataset.currentUrlIndex || '0');

        currentIndex++;

        if (currentIndex < urls.length) {
            console.log(`🔄 Tentando URL alternativa ${currentIndex + 1}/${urls.length}: ${urls[currentIndex]}`);
            imgElement.dataset.currentUrlIndex = currentIndex.toString();
            imgElement.src = urls[currentIndex];
        } else {
            console.error(`❌ Todas as URLs falharam para ${imgElement.dataset.fileName}`);
            showImageErrorPlaceholder(imgElement);
        }
    } catch (error) {
        console.error('❌ Erro ao processar URLs alternativas:', error);
        showImageErrorPlaceholder(imgElement);
    }
}

/**
 * 🖼️ MOSTRAR PLACEHOLDER DE ERRO
 * Exibe um ícone quando todas as URLs falham
 */
function showImageErrorPlaceholder(imgElement) {
    imgElement.style.display = 'none';

    const parent = imgElement.parentElement;
    if (parent && !parent.querySelector('.image-error-placeholder')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'image-error-placeholder';
        placeholder.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: #F1F5F9;
                color: #64748B;
                font-size: 24px;
                padding: 10px;
                text-align: center;
            ">
                <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
                <div style="font-size: 10px;">Erro ao carregar</div>
                <div style="font-size: 9px; margin-top: 4px;">ID: ${imgElement.dataset.fileId || '?'}</div>
            </div>
        `;
        parent.insertBefore(placeholder, imgElement);
    }
}

/**
 * 📎 ABRIR MODAL DE ESCOLHA DE MÍDIA
 * Modal que permite escolher entre Tirar Foto ou fazer Upload
 */
function openMediaChoiceModal(exibidora, pontoId, tipo, databaseId) {
    // Criar modal simples com as opções
    const existingModal = document.getElementById('media-choice-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'media-choice-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '2100'; // Acima de outros modais

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3>📎 Adicionar Mídia</h3>
                <button class="close-btn" onclick="closeMediaChoiceModal()">×</button>
            </div>
            <div class="modal-body" style="padding: 30px; text-align: center;">
                <button class="btn btn-camera" style="width: 100%; margin-bottom: 15px; padding: 20px; font-size: 16px;" onclick="chooseCamera('${exibidora}', '${pontoId}', '${tipo}', '${databaseId}')">
                    📷 Tirar Foto
                </button>
                <button class="btn btn-primary" style="width: 100%; padding: 20px; font-size: 16px;" onclick="chooseUpload('${exibidora}', '${pontoId}', '${tipo}', '${databaseId}')">
                    📁 Fazer Upload
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * 🔒 FECHAR MODAL DE ESCOLHA
 */
function closeMediaChoiceModal() {
    const modal = document.getElementById('media-choice-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * 📷 ESCOLHER CÂMERA
 */
function chooseCamera(exibidora, pontoId, tipo, databaseId) {
    closeMediaChoiceModal();
    CameraManager.setCameraContext(exibidora, pontoId, tipo, databaseId);
    CameraManager.openCamera();
}

/**
 * 📁 ESCOLHER UPLOAD
 */
function chooseUpload(exibidora, pontoId, tipo, databaseId) {
    closeMediaChoiceModal();
    openUploadModal(exibidora, pontoId, tipo, databaseId);
}

// 🚀 EXPORTAR FUNÇÕES GLOBAIS
window.togglePontoContent = togglePontoContent;
window.toggleEditMode = toggleEditMode;
window.openMediaChoiceModal = openMediaChoiceModal;
window.closeMediaChoiceModal = closeMediaChoiceModal;
window.chooseCamera = chooseCamera;
window.chooseUpload = chooseUpload;
window.deleteFile = deleteFile;
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
window.openFullImage = openFullImage;
window.openMediaCarousel = openMediaCarousel;
window.closeMediaCarousel = closeMediaCarousel;
window.carouselPrev = carouselPrev;
window.carouselNext = carouselNext;
window.hideDemoWarning = hideDemoWarning;
window.updateMediaPreview = updateMediaPreview;
window.showSuccessMessage = showSuccessMessage;

Logger.info('Script principal carregado');

// ✅ INICIALIZAR APLICAÇÃO QUANDO O DOM ESTIVER PRONTO
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
