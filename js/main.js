// =============================================================================
// 🚀 SCRIPT PRINCIPAL - CHECKING OOH
// =============================================================================

const appData = {
    mode: null, // 'exibidora' ou 'cliente'
    exibidora: null,
    pontos: [],
    pontoAtual: null,
    databaseId: null, // ID da campanha
    editMode: {}, // { 'pontoId-tipo': boolean }
    pendingDeletes: {} // { 'pontoId-tipo': [{fileId, fileName, element}] }
};

/**
 * 🔧 NORMALIZAR ID DO NOTION
 * Converte IDs do Notion para formato consistente com hífens
 * Previne duplicação de pastas no Drive
 *
 * @param {string} id - ID do Notion (com ou sem hífens)
 * @returns {string} - ID normalizado (formato: 8-4-4-4-12)
 */
function normalizeNotionId(id) {
    if (!id || typeof id !== 'string') {
        return id;
    }

    // Remover hífens existentes
    const cleanId = id.replace(/-/g, '');

    // Verificar se tem 32 caracteres
    if (cleanId.length !== 32) {
        Logger.warning('ID do Notion com tamanho inválido', { id, length: cleanId.length });
        return id; // Retornar original se inválido
    }

    // Adicionar hífens no formato padrão: 8-4-4-4-12
    const normalized = `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20, 32)}`;

    return normalized;
}

/**
 * 🎬 INICIALIZAR APLICAÇÃO V10.5
 * ✅ Com tela de carregamento OOH + remoção de textos "Carregando" residuais
 */
async function initApp() {
    try {
        Logger.info('Iniciando aplicação Checking OOH V10.5...');

        // ✅ V10.5: Mostrar tela de carregamento OOH
        startLoadingScreen();

        // Configurar interface inicial
        setupInterface();

        // Detectar modo de acesso pela URL
        const urlParams = new URLSearchParams(window.location.search);
        const pontoId = urlParams.get('id');
        const campanhaId = urlParams.get('campanha');
        const exibidora = urlParams.get('exibidora');
        const databaseId = urlParams.get('databaseId');

        // ✅ CORREÇÃO: Armazenar databaseId e exibidora da URL
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
        } else if (campanhaId) {
            // Modo Campanha
            appData.mode = 'campanha';
            await loadCampanhaData(campanhaId);
        } else {
            // Sem ID - Mostrar instruções
            hideLoadingScreen();
            removeAllLoadingTexts(); // ✅ V10.5
            showWelcomeScreen();
            return;
        }

        // Configurar drag & drop após carregar dados
        setupDragAndDrop();

        // ✅ V10.5: Esconder tela de carregamento OOH
        hideLoadingScreen();

        // ✅ V10.5: REMOVER TODOS os textos "Carregando" residuais
        setTimeout(() => {
            removeAllLoadingTexts();
            startLoadingTextObserver(); // Monitorar dinamicamente
        }, 1000);

        Logger.success('Aplicação inicializada com sucesso V10.5');

    } catch (error) {
        Logger.error('Erro ao inicializar aplicação', error);
        hideLoadingScreen();
        removeAllLoadingTexts(); // ✅ V10.5
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
        updatePageHeader(appData.exibidora, `Modo Exibidora • ${appData.pontos.length} ponto(s)`);
        
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
 * 📋 CARREGAR DADOS DA CAMPANHA V10
 * Carrega TODOS os pontos de uma campanha (todas exibidoras) + botão PDF
 */
async function loadCampanhaData(campanhaId) {
    try {
        Logger.info('Carregando dados da campanha', { campanhaId });

        // Buscar dados no Notion
        const notionData = await NotionAPI.fetchPontosByCampanha(campanhaId);

        appData.exibidora = 'TODAS'; // Modo campanha mostra todas exibidoras
        appData.pontos = notionData.pontos;
        appData.databaseId = campanhaId;
        appData.pontoAtual = null; // Não há ponto atual específico
        appData.pageTitle = notionData.pageTitle; // ✅ Armazenar título da página pai
        appData.pageIcon = notionData.pageIcon; // ✅ Armazenar ícone da página pai

        // Atualizar header com título da página pai (sem emoji)
        const campanhaTitle = notionData.pageTitle || 'Campanha Completa';
        updatePageHeader(campanhaTitle, `Visualização Geral • ${appData.pontos.length} ponto(s) de todas as exibidoras`);

        // ✅ V10: Adicionar botão PDF no header
        addPDFButton();

        // Renderizar pontos (modo read-only como cliente, mas layout expandido como exibidora)
        await renderPontos(true); // true = read-only (sem edição)

        Logger.success('Dados da campanha carregados', {
            pontosCount: appData.pontos.length,
            campanhaId: appData.databaseId,
            pageTitle: notionData.pageTitle
        });

    } catch (error) {
        Logger.error('Erro ao carregar dados da campanha', error);
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

        // ✅ Ordenar pontos por exibidora no modo campanha
        let pontosToRender = [...appData.pontos];
        if (readOnly) {
            pontosToRender.sort((a, b) => {
                const exibidoraA = (a.exibidora || '').toUpperCase();
                const exibidoraB = (b.exibidora || '').toUpperCase();
                return exibidoraA.localeCompare(exibidoraB);
            });
            Logger.info('Pontos ordenados por exibidora', { count: pontosToRender.length });
        }

        for (const ponto of pontosToRender) {
            const pontoElement = await createPontoElement(ponto, readOnly);
            container.appendChild(pontoElement);
        }

        // ✅ Mostrar campo de pesquisa apenas no modo campanha
        const searchContainer = document.getElementById('search-container');
        if (searchContainer) {
            searchContainer.style.display = readOnly ? 'block' : 'none';
        }

        // Mostrar seção de pontos
        document.getElementById('pontos-section').style.display = 'block';

        Logger.success('Pontos renderizados', { count: pontosToRender.length });

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

    // ✅ LIMPEZA: Modo cliente removido, não precisa mais deste botão

    // Ações do ponto (com toggle para todos os modos)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'ponto-actions';

    // ✅ LAZY LOADING: Botão toggle em todos os modos
    const toggleFunction = readOnly ? 'togglePontoLazy' : 'togglePontoContent';
    actionsDiv.innerHTML = `
        <button class="btn btn-small btn-expand" onclick="${toggleFunction}('${ponto.id}')" title="Expandir/Recolher">
            <span id="toggle-icon-${ponto.id}">▼</span>
        </button>
    `;

    headerDiv.appendChild(infoDiv);
    headerDiv.appendChild(actionsDiv);

    // Conteúdo do ponto (seções Entrada e Saída)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ponto-content';
    contentDiv.id = `content-${ponto.id}`;
    contentDiv.style.display = 'none'; // ✅ LAZY LOADING: Sempre inicia colapsado
    contentDiv.dataset.loaded = 'false'; // ✅ Marcar como não carregado
    
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

    // Ações
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'secao-actions';

    if (!readOnly) {
        // Modo Exibidora
        actionsDiv.innerHTML = `
            <button class="btn btn-primary btn-small" onclick="openUploadModal('${ponto.exibidora}', '${ponto.id}', '${tipo}', '${appData.databaseId}')">
                📎 Adicionar Mídia
            </button>
            <button class="btn btn-secondary btn-small" onclick="toggleEditMode('${ponto.id}', '${tipo}')" id="edit-btn-${ponto.id}-${tipo}">
                ✏️ Editar
            </button>
            <button class="btn btn-danger btn-small" onclick="cancelEditMode('${ponto.id}', '${tipo}')" id="cancel-btn-${ponto.id}-${tipo}" style="display: none;">
                ❌ Cancelar
            </button>
        `;
    } else {
        // Modo campanha/read-only: sem botões de ação
        actionsDiv.innerHTML = '';
    }

    secaoDiv.appendChild(actionsDiv);
    
    // Preview de mídia
    const previewDiv = document.createElement('div');
    // ✅ V10.7.2: Mesmo tamanho em todos os modos
    previewDiv.className = 'media-preview';
    previewDiv.id = `preview-${ponto.id}-${tipo}`;

    // ✅ LAZY LOADING: Sempre usar placeholder, carregar sob demanda
    previewDiv.innerHTML = '<p style="text-align: center; color: #94A3B8; font-size: 11px; padding: 10px;">↓ Expanda para carregar ↓</p>';
    previewDiv.dataset.pontoId = ponto.id;
    previewDiv.dataset.tipo = tipo;
    previewDiv.dataset.loaded = 'false';
    previewDiv.dataset.exibidora = ponto.exibidora; // ✅ Armazenar exibidora para lazy load

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

        // ✅ CORREÇÃO: Usar ponto.exibidora em vez de appData.exibidora (importante para modo campanha)
        const exibidora = ponto.exibidora || appData.exibidora;

        // 🔧 NORMALIZAR IDS para prevenir duplicação de pastas
        const normalizedPontoId = normalizeNotionId(ponto.id);
        const normalizedDatabaseId = normalizeNotionId(appData.databaseId);

        const result = await DriveAPI.listDriveFiles(exibidora, normalizedPontoId, tipo, normalizedDatabaseId);

        if (result.success && result.files.length > 0) {
            // ✅ CORREÇÃO: Passar container como parâmetro
            updateMediaPreview(ponto.id, tipo, result.files, readOnly, container);
        } else {
            // Sem arquivos
            container.innerHTML = '<p style="text-align: center; color: #64748B; font-size: 12px;">Nenhum arquivo</p>';
            updateMediaCount(ponto.id, tipo, 0);
        }

    } catch (error) {
        Logger.debug('Erro ao carregar preview de mídia');
        container.innerHTML = '<p style="text-align: center; color: #EF4444; font-size: 12px;">Erro ao carregar</p>';
    }
}

/**
 * 📅 CALCULAR BI-SEMANA V10
 * Calcula a bi-semana baseada na data de upload
 */
function calcularBisemana(dataUpload) {
    // Data base de referência (primeira bi-semana conhecida)
    const BISEMANA_BASE = {
        numero: 2,
        ano: 2025,
        dataInicio: new Date('2024-12-30T00:00:00') // 30/12/2024 - início bi-semana 02/25
    };

    const data = new Date(dataUpload);
    const dataBase = BISEMANA_BASE.dataInicio;

    // Calcular diferença em dias
    const diferencaDias = Math.floor((data - dataBase) / (1000 * 60 * 60 * 24));

    // Cada bi-semana = 14 dias
    const numeroBisemanas = Math.floor(diferencaDias / 14);

    // Número da bi-semana (sempre par, começando em 02)
    let numeroBisemana = BISEMANA_BASE.numero + (numeroBisemanas * 2);

    // Calcular ano da bi-semana
    let anoBisemana = BISEMANA_BASE.ano;

    // Ajustar para ano correto (52 bi-semanas por ano = 26 períodos de 14 dias)
    while (numeroBisemana > 52) {
        numeroBisemana -= 52;
        anoBisemana++;
    }

    // Formatar resultado
    const numeroFormatado = numeroBisemana.toString().padStart(2, '0');
    const anoFormatado = anoBisemana.toString().slice(-2);

    return `Bi-semana ${numeroFormatado}/${anoFormatado} - ${data.toLocaleDateString('pt-BR')}`;
}

/**
 * 🔄 ATUALIZAR PREVIEW DE MÍDIA V10
 * Atualiza o preview com novos arquivos + cabeçalhos de bi-semana
 */
function updateMediaPreview(pontoId, tipo, files, readOnly = false, containerParam = null) {
    // ✅ CORREÇÃO: Aceitar container como parâmetro ou buscar por ID
    const container = containerParam || document.getElementById(`preview-${pontoId}-${tipo}`);
    if (!container) {
        Logger.error(`Container preview-${pontoId}-${tipo} não encontrado`);
        return;
    }

    Logger.info(`updateMediaPreview: ${files.length} arquivos`, { pontoId, tipo, readOnly });

    container.innerHTML = '';

    if (files.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748B; font-size: 12px;">Nenhum arquivo</p>';
        updateMediaCount(pontoId, tipo, 0);
        return;
    }

    // ✅ V10.1: CORREÇÃO CRÍTICA - Agrupar arquivos por bi-semana ANTES de usar
    const arquivosPorBisemana = {};
    files.forEach(file => {
        if (file.createdTime) {
            const bisemana = calcularBisemana(file.createdTime);
            if (!arquivosPorBisemana[bisemana]) {
                arquivosPorBisemana[bisemana] = [];
            }
            arquivosPorBisemana[bisemana].push(file);
        } else {
            // Arquivos sem data vão para categoria "Sem Data"
            if (!arquivosPorBisemana['Sem Data']) {
                arquivosPorBisemana['Sem Data'] = [];
            }
            arquivosPorBisemana['Sem Data'].push(file);
        }
    });

    // ✅ V10: Renderizar arquivos agrupados por bi-semana
    let fileIndex = 0;
    const bisemanas = Object.keys(arquivosPorBisemana).sort();

    bisemanas.forEach(bisemana => {
        // Criar cabeçalho de bi-semana
        const bisemanaHeader = document.createElement('div');
        bisemanaHeader.className = 'bisemana-header';
        bisemanaHeader.style.cssText = `
            grid-column: 1 / -1;
            background: linear-gradient(135deg, rgba(6, 5, 91, 0.05) 0%, rgba(6, 5, 91, 0.02) 100%);
            border-left: 3px solid #06055B;
            padding: 8px 12px;
            margin-top: 8px;
            margin-bottom: 4px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #06055B;
        `;
        bisemanaHeader.textContent = bisemana;
        container.appendChild(bisemanaHeader);

        // Renderizar arquivos desta bi-semana
        arquivosPorBisemana[bisemana].forEach(file => {
            const currentIndex = fileIndex++;
            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            // ✅ V10.7: Não definir onclick aqui - será tratado pelo img.onclick abaixo
        
        if (DriveAPI.isVideoFile(file.mimeType)) {
            // ✅ V10.7.3: Vídeo com thumbnail simples e download ao clicar
            const videoThumb = file.thumbnailUrl || `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;

            const videoDiv = document.createElement('div');
            videoDiv.className = 'video-thumbnail';
            videoDiv.dataset.fileId = file.id;
            videoDiv.dataset.fileName = file.name;
            videoDiv.dataset.isVideo = 'true';
            videoDiv.style.cssText = `
                position: relative;
                width: 100%;
                height: 100%;
                background: url('${videoThumb}') center/cover no-repeat, #000;
                cursor: pointer;
            `;

            // Ícone de play centralizado + badge VÍDEO
            videoDiv.innerHTML = `
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
            `;

            // ✅ V10.7.3: Click para baixar vídeo automaticamente
            videoDiv.onclick = (e) => {
                e.stopPropagation();
                // Download direto
                const a = document.createElement('a');
                a.href = `https://drive.google.com/uc?export=download&id=${file.id}`;
                a.download = file.name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                Logger.info('Download iniciado', { name: file.name });
            };

            mediaItem.appendChild(videoDiv);
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
                Logger.info('URLs alternativas', { name: file.name, n: file.alternativeUrls.length });
            } else {
                Logger.warning('Sem URLs alternativas', { name: file.name });
            }

            // ✅ NOVO: Handler de erro com fallback automático
            img.onerror = function() {
                Logger.warning('Erro ao carregar imagem', { src: this.src?.slice(0, 80) });
                handleImageError(this);
            };

            // ✅ NOVO: Log quando carrega com sucesso
            img.onload = function() {
                Logger.info('Imagem carregada', { name: this.dataset.fileName, w: this.naturalWidth, h: this.naturalHeight });
            };

            img.src = file.url;
            Logger.info('Carregando imagem', { name: file.name, readOnly });

            // ✅ V10.7: Adicionar click handler para zoom simples (sem alert)
            img.onclick = (e) => {
                e.stopPropagation();
                openSimpleZoom(file.url, file.name);
            };

            // ✅ MELHORIA: Timestamp removido conforme solicitado
            mediaItem.appendChild(img);
        }
        
        // ✅ V10.7.2: Badge de delete - controlado por CSS class .editing
        // Verifica se há img, video ou video-thumbnail no mediaItem
        if (!readOnly) {
            const hasMedia = mediaItem.querySelector('img') ||
                            mediaItem.querySelector('video') ||
                            mediaItem.querySelector('.video-thumbnail');
            if (hasMedia) {
                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'delete-badge';
                deleteBtn.innerHTML = '−'; // Sinal de menos
                deleteBtn.dataset.pontoId = pontoId;
                deleteBtn.dataset.tipo = tipo;
                deleteBtn.onclick = (e) => {
                    e.stopPropagation(); // Não abrir carrossel ao clicar no -
                    deleteFile(file.id, file.name, pontoId, tipo);
                };
                mediaItem.appendChild(deleteBtn);

                // ✅ V10.2: Se modo edição já está ativo, adicionar classe .editing
                const currentEditMode = isEditMode(pontoId, tipo);
                if (currentEditMode) {
                    mediaItem.classList.add('editing');
                }
                Logger.info('Badge delete', { name: file.name, editMode: currentEditMode });
            }
        }

        // ✅ V10.7.2: Botão de download individual (modo campanha)
        // Verifica se há img, video ou video-thumbnail no mediaItem
        if (readOnly) {
            const hasMedia = mediaItem.querySelector('img') ||
                            mediaItem.querySelector('video') ||
                            mediaItem.querySelector('.video-thumbnail');
            if (hasMedia) {
                const downloadBtn = document.createElement('a');
                downloadBtn.href = `https://drive.google.com/uc?export=download&id=${file.id}`;
                downloadBtn.className = 'download-badge';
                downloadBtn.innerHTML = '⬇';
                downloadBtn.title = 'Baixar arquivo';
                downloadBtn.onclick = (e) => {
                    e.stopPropagation(); // Não abrir carrossel ao clicar no download
                };
                mediaItem.appendChild(downloadBtn);
            }
        }

            container.appendChild(mediaItem);
        });
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
                    loadPontoMediaIfNeeded(ponto, 'entrada', false),
                    loadPontoMediaIfNeeded(ponto, 'saida', false)
                ]);
            }
        }

        Logger.debug('Conteúdo do ponto alternado', { pontoId, visible: !isVisible });
    }
}

/**
 * 🔄 ALTERNAR PONTO COM LAZY LOADING V10 (MODO CAMPANHA)
 * ✅ V10: Expande IMEDIATAMENTE + carrega fotos em PARALELO (sem bloquear)
 */
function togglePontoLazy(pontoId) {
    const content = document.getElementById(`content-${pontoId}`);
    const icon = document.getElementById(`toggle-icon-${pontoId}`);

    if (content && icon) {
        const isVisible = content.style.display !== 'none';

        if (!isVisible) {
            // ✅ V10 PERFORMANCE: Expandir IMEDIATAMENTE (não await)
            content.style.display = 'grid';
            icon.textContent = '▲';

            // ✅ V10 PERFORMANCE: Carregar fotos em BACKGROUND (não bloqueia UI)
            if (content.dataset.loaded === 'false') {
                Logger.info('Expandindo + carregando fotos em paralelo', { pontoId });

                // Buscar informações do ponto
                const ponto = appData.pontos.find(p => p.id === pontoId);
                if (ponto) {
                    // Carregar entrada e saída em PARALELO (sem await - não bloqueia)
                    // ✅ V10.7: Passar readOnly=true para mostrar botões de download
                    Promise.all([
                        loadPontoMediaIfNeeded(ponto, 'entrada', true),
                        loadPontoMediaIfNeeded(ponto, 'saida', true)
                    ]).then(() => {
                        content.dataset.loaded = 'true';
                        Logger.success('Fotos carregadas em background', { pontoId });
                    }).catch(error => {
                        Logger.error('Erro ao carregar fotos em background', error);
                    });
                }
            }
        } else {
            // Recolher
            content.style.display = 'none';
            icon.textContent = '▼';
        }

        Logger.debug('Ponto alternado (expansão instantânea)', { pontoId, visible: !isVisible });
    }
}

/**
 * 📥 CARREGAR MÍDIA SE NECESSÁRIO (LAZY LOADING)
 * Carrega arquivos apenas se ainda não foram carregados
 */
async function loadPontoMediaIfNeeded(ponto, tipo, readOnly = false) {
    const previewDiv = document.getElementById(`preview-${ponto.id}-${tipo}`);

    if (!previewDiv) return;

    const isLoaded = previewDiv.dataset.loaded === 'true';

    if (!isLoaded) {
        Logger.info('Lazy loading mídia', { tipo, pontoId: ponto.id, readOnly });

        // ✅ OTIMIZAÇÃO: Mostrar skeleton loaders durante carregamento
        previewDiv.className = 'media-preview loading';
        previewDiv.innerHTML = `
            <div class="skeleton skeleton-media-item"></div>
            <div class="skeleton skeleton-media-item"></div>
            <div class="skeleton skeleton-media-item"></div>
        `;

        await loadMediaPreview(ponto, tipo, previewDiv, readOnly);
        previewDiv.className = 'media-preview'; // Remover classe loading
        previewDiv.dataset.loaded = 'true';

        Logger.info('Arquivos carregados via lazy loading', { pontoId: ponto.id, tipo, readOnly });
    }
}

/**
 * ✏️ ALTERNAR MODO EDIÇÃO
 * Ativa/desativa o modo edição para uma seção
 */
/**
 * ✏️ ALTERNAR MODO EDIÇÃO V10.7.4
 * ✅ Resposta imediata no front-end, exclusões em background
 */
async function toggleEditMode(pontoId, tipo) {
    const key = `${pontoId}-${tipo}`;
    const isCurrentlyEditing = appData.editMode[key] || false;

    if (isCurrentlyEditing) {
        // CONCLUIR edição - resposta IMEDIATA
        const deleteCount = appData.pendingDeletes[key] ? appData.pendingDeletes[key].length : 0;

        // Desativar modo edição IMEDIATAMENTE
        appData.editMode[key] = false;

        // Atualizar botões IMEDIATAMENTE
        const editBtn = document.getElementById(`edit-btn-${pontoId}-${tipo}`);
        const cancelBtn = document.getElementById(`cancel-btn-${pontoId}-${tipo}`);

        if (editBtn) {
            editBtn.textContent = '✏️ Editar';
            editBtn.className = 'btn btn-secondary btn-small';
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }

        // Remover classe editing IMEDIATAMENTE
        const container = document.getElementById(`preview-${pontoId}-${tipo}`);
        if (container) {
            const mediaItems = container.querySelectorAll('.media-item');
            mediaItems.forEach(item => item.classList.remove('editing'));
        }

        // Mostrar mensagem de sucesso IMEDIATAMENTE
        if (deleteCount > 0) {
            showSuccessMessage(`✅ ${deleteCount} arquivo(s) sendo excluído(s)...`);
        }

        // Aplicar exclusões em BACKGROUND (sem await)
        confirmPendingDeletesBackground(pontoId, tipo);

        Logger.info('✅ Modo edição CONCLUÍDO (resposta imediata)', { pontoId, tipo });
    } else {
        // ATIVAR modo edição
        appData.editMode[key] = true;

        // Inicializar lista de exclusões pendentes
        if (!appData.pendingDeletes[key]) {
            appData.pendingDeletes[key] = [];
        }

        // Atualizar botões
        const editBtn = document.getElementById(`edit-btn-${pontoId}-${tipo}`);
        const cancelBtn = document.getElementById(`cancel-btn-${pontoId}-${tipo}`);

        if (editBtn) {
            editBtn.textContent = '✅ Concluir';
            editBtn.className = 'btn btn-success btn-small';
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-flex';
        }

        // Adicionar classe editing
        const container = document.getElementById(`preview-${pontoId}-${tipo}`);
        if (container) {
            const mediaItems = container.querySelectorAll('.media-item');
            mediaItems.forEach(item => item.classList.add('editing'));
        }

        Logger.info('✏️ Modo edição ATIVADO', { pontoId, tipo });
    }

    // ✅ Atualizar UI global
    updateEditModeUI();
}

/**
 * ❌ CANCELAR MODO EDIÇÃO V10.7.3
 * Cancela a edição e restaura fotos marcadas para exclusão
 */
function cancelEditMode(pontoId, tipo) {
    const key = `${pontoId}-${tipo}`;

    Logger.info('❌ Cancelando modo edição', { pontoId, tipo });

    // Restaurar fotos marcadas para exclusão
    if (appData.pendingDeletes[key] && appData.pendingDeletes[key].length > 0) {
        appData.pendingDeletes[key].forEach(item => {
            if (item.element && item.element.parentElement) {
                item.element.style.display = ''; // Mostrar novamente
                Logger.info('↩️ Foto restaurada:', item.fileName);
            }
        });
        // Limpar lista de exclusões pendentes
        appData.pendingDeletes[key] = [];
    }

    // Desativar modo edição
    appData.editMode[key] = false;

    // Atualizar botões
    const editBtn = document.getElementById(`edit-btn-${pontoId}-${tipo}`);
    const cancelBtn = document.getElementById(`cancel-btn-${pontoId}-${tipo}`);

    if (editBtn) {
        editBtn.textContent = '✏️ Editar';
        editBtn.className = 'btn btn-secondary btn-small';
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }

    // Remover classe editing
    const container = document.getElementById(`preview-${pontoId}-${tipo}`);
    if (container) {
        const mediaItems = container.querySelectorAll('.media-item');
        mediaItems.forEach(item => item.classList.remove('editing'));
    }

    // Atualizar UI global
    updateEditModeUI();

    Logger.success('✅ Edição cancelada, fotos restauradas');
}

/**
 * ✅ CONFIRMAR EXCLUSÕES PENDENTES EM BACKGROUND V10.7.4
 * Aplica exclusões sem bloquear UI (roda em background)
 */
async function confirmPendingDeletesBackground(pontoId, tipo) {
    const key = `${pontoId}-${tipo}`;

    if (!appData.pendingDeletes[key] || appData.pendingDeletes[key].length === 0) {
        Logger.info('Nenhuma exclusão pendente');
        return;
    }

    const deleteCount = appData.pendingDeletes[key].length;
    const pendingItems = [...appData.pendingDeletes[key]]; // Cópia para processar

    Logger.info(`📝 Excluindo ${deleteCount} arquivo(s) em background...`);

    // Limpar lista de exclusões pendentes IMEDIATAMENTE
    appData.pendingDeletes[key] = [];

    // Excluir todos os arquivos em background
    let successCount = 0;
    let errorCount = 0;

    for (const item of pendingItems) {
        try {
            const result = await DriveAPI.deleteFileFromDrive(item.fileId, item.fileName);
            if (result.success) {
                Logger.success(`✅ Arquivo excluído: ${item.fileName}`);
                successCount++;
            } else {
                Logger.error(`❌ Erro ao excluir: ${item.fileName}`);
                errorCount++;
            }
        } catch (error) {
            Logger.error(`❌ Erro ao excluir ${item.fileName}:`, error);
            errorCount++;
        }
    }

    // Recarregar preview silenciosamente
    const ponto = appData.pontos.find(p => p.id === pontoId);
    if (ponto) {
        const container = document.getElementById(`preview-${pontoId}-${tipo}`);
        if (container) {
            await loadMediaPreview(ponto, tipo, container, false);
        }
    }

    // Notificar resultado final
    if (errorCount === 0) {
        Logger.success(`🗑️ ${successCount} arquivo(s) excluído(s) com sucesso!`);
    } else {
        Logger.info(`⚠️ ${successCount} excluído(s), ${errorCount} erro(s)`);
    }
}

/**
 * ❓ VERIFICAR MODO EDIÇÃO
 * Verifica se uma seção está em modo edição
 */
function isEditMode(pontoId, tipo) {
    return appData.editMode[`${pontoId}-${tipo}`] || false;
}

/**
 * 🗑️ MARCAR ARQUIVO PARA EXCLUSÃO V10.7.3
 * Marca arquivo para exclusão pendente (não apaga imediatamente)
 */
function deleteFile(fileId, fileName, pontoId, tipo) {
    const key = `${pontoId}-${tipo}`;

    Logger.info('Marcando arquivo para exclusão', { fileId, fileName });

    // Encontrar o elemento media-item correspondente
    const container = document.getElementById(`preview-${pontoId}-${tipo}`);
    if (!container) {
        Logger.error('Container não encontrado');
        return;
    }

    // Buscar o media-item que contém este arquivo
    const mediaItems = container.querySelectorAll('.media-item');
    let targetElement = null;

    mediaItems.forEach(item => {
        const deleteBtn = item.querySelector('.delete-badge');
        if (deleteBtn && deleteBtn.dataset.pontoId === pontoId && deleteBtn.dataset.tipo === tipo) {
            // Verificar se é este arquivo (por fileId no data attribute)
            const img = item.querySelector('img');
            const videoThumb = item.querySelector('.video-thumbnail');

            if ((img && img.dataset.fileId === fileId) ||
                (videoThumb && videoThumb.dataset.fileId === fileId)) {
                targetElement = item;
            }
        }
    });

    if (!targetElement) {
        Logger.error('Elemento não encontrado');
        return;
    }

    // Adicionar à lista de exclusões pendentes
    if (!appData.pendingDeletes[key]) {
        appData.pendingDeletes[key] = [];
    }

    appData.pendingDeletes[key].push({
        fileId: fileId,
        fileName: fileName,
        element: targetElement
    });

    // Esconder o elemento imediatamente
    targetElement.style.display = 'none';

    Logger.info(`✅ Arquivo marcado para exclusão: ${fileName} (${appData.pendingDeletes[key].length} pendente(s))`);
}

/**
 * 🔍 ZOOM SIMPLES DE FOTO (V10)
 * Abre foto ampliada sem carrossel - apenas zoom
 */
function openMediaCarousel(pontoId, tipo, startIndex = 0) {
    try {
        Logger.info('Abrindo zoom de foto', { pontoId, tipo, startIndex });

        // Buscar container de fotos
        const container = document.getElementById(`preview-${pontoId}-${tipo}`);
        if (!container) {
            alert('Erro ao localizar fotos');
            return;
        }

        // Buscar todas as imagens no container
        const images = container.querySelectorAll('img');
        if (!images || images.length === 0 || startIndex >= images.length) {
            alert('Nenhuma foto encontrada');
            return;
        }

        // Pegar a imagem clicada
        const clickedImage = images[startIndex];
        const imageUrl = clickedImage.src;
        const imageName = clickedImage.alt || 'Foto';

        // Criar modal simples com zoom
        const zoomModal = document.createElement('div');
        zoomModal.id = 'zoom-modal';
        zoomModal.className = 'media-carousel'; // Reutilizar CSS do carrossel
        zoomModal.innerHTML = `
            <div class="carousel-overlay" onclick="closeZoomModal()"></div>
            <div class="carousel-content">
                <button class="carousel-close" onclick="closeZoomModal()">×</button>
                <div class="carousel-media" style="display: flex; align-items: center; justify-content: center;">
                    <img src="${imageUrl}" alt="${imageName}" style="max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                </div>
            </div>
        `;

        document.body.appendChild(zoomModal);

        // Adicionar controle ESC para fechar
        document.addEventListener('keydown', handleZoomKeyboard);

        Logger.info('Zoom de foto aberto', { imageUrl });

    } catch (error) {
        Logger.error('Erro ao abrir zoom', error);
        alert('Erro ao visualizar foto: ' + error.message);
    }
}

/**
 * ⌨️ CONTROLE POR TECLADO DO ZOOM
 */
function handleZoomKeyboard(e) {
    if (!document.getElementById('zoom-modal')) return;

    if (e.key === 'Escape') {
        closeZoomModal();
    }
}

/**
 * 🔒 FECHAR MODAL DE ZOOM
 */
function closeZoomModal() {
    const modal = document.getElementById('zoom-modal');
    if (modal) {
        modal.remove();
    }
    document.removeEventListener('keydown', handleZoomKeyboard);
    Logger.info('Zoom de foto fechado');
}

// ✅ MANTER FUNÇÕES ANTIGAS PARA COMPATIBILIDADE (mas simplificadas)
function closeMediaCarousel() {
    closeZoomModal();
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

        // ✅ CORREÇÃO: Usar exibidora do ponto
        const exibidora = ponto.exibidora || appData.exibidora;

        // 🔧 NORMALIZAR IDS para prevenir duplicação de pastas
        const normalizedPontoId = normalizeNotionId(pontoId);
        const normalizedDatabaseId = normalizeNotionId(appData.databaseId);

        const result = await DriveAPI.listDriveFiles(exibidora, normalizedPontoId, tipo, normalizedDatabaseId);
        
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
                        Logger.warning('Erro imagem no modal', { src: this.src?.slice(0, 80) });
                        handleImageError(this);
                    };

                    img.onload = function() {
                        Logger.info('Imagem modal OK', { name: this.dataset.fileName });
                    };

                    img.src = file.url;
                    Logger.info('Modal: carregando', { name: file.name });

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
    // ✅ LIMPEZA: Modo cliente foi removido
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
        <div class="landing-page">
            <div class="landing-hero">
                <div class="landing-icon">📱</div>
                <h1 class="landing-title">CheckingOOH</h1>
                <p class="landing-subtitle">Sistema Profissional de Monitoramento de Mídia Out of Home</p>
            </div>

            <div class="landing-features">
                <div class="feature-card">
                    <div class="feature-icon">📸</div>
                    <h3>Verificação em Tempo Real</h3>
                    <p>Acompanhe e registre suas campanhas com fotos e vídeos de alta qualidade</p>
                </div>

                <div class="feature-card">
                    <div class="feature-icon">☁️</div>
                    <h3>Armazenamento Seguro</h3>
                    <p>Todos os arquivos são salvos de forma segura e acessível a qualquer momento</p>
                </div>

                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <h3>Relatórios Completos</h3>
                    <p>Gere relatórios PDF profissionais com todas as informações de suas campanhas</p>
                </div>

                <div class="feature-card">
                    <div class="feature-icon">🔒</div>
                    <h3>Acesso Controlado</h3>
                    <p>Diferentes níveis de acesso para exibidoras e clientes</p>
                </div>
            </div>

            <div class="landing-cta">
                <div class="cta-content">
                    <h2>Pronto para começar?</h2>
                    <p>Acesse através do link personalizado enviado por email</p>
                    <div class="cta-info">
                        <div class="info-badge">
                            <span class="badge-icon">📧</span>
                            <span>Link de acesso exclusivo por email</span>
                        </div>
                        <div class="info-badge">
                            <span class="badge-icon">🔐</span>
                            <span>Acesso seguro e personalizado</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="landing-footer">
                <p>Desenvolvido por <strong>E-MÍDIAS</strong> • Tecnologia e Inovação em Mídia OOH</p>
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
 * 📤 MOSTRAR PROGRESSO DE UPLOAD V10.7.5
 * Exibe loading bonito DENTRO do modal de upload
 */
function showUploadProgress(message = 'Enviando...') {
    // Buscar o modal de upload
    const uploadModal = document.getElementById('upload-modal');
    if (!uploadModal) {
        Logger.error('Modal de upload não encontrado');
        return;
    }

    // Buscar ou criar container de loading dentro do modal
    let loadingContainer = document.getElementById('modal-loading-container');

    if (!loadingContainer) {
        loadingContainer = document.createElement('div');
        loadingContainer.id = 'modal-loading-container';
        loadingContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.98);
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 16px;
        `;

        loadingContainer.innerHTML = `
            <div style="text-align: center; max-width: 300px; padding: 40px;">
                <div style="margin-bottom: 24px;">
                    <img src="./LogoEmidias.png"
                         alt="E-MÍDIAS Logo"
                         style="max-width: 100px; animation: pulse 1.5s ease-in-out infinite;"
                         onerror="this.style.display='none'">
                </div>
                <h3 id="modal-loading-title" style="
                    color: #06055B;
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 16px;
                    font-family: 'Space Grotesk', sans-serif;
                ">${message}</h3>
                <div style="
                    width: 100%;
                    height: 6px;
                    background: #F1F5F9;
                    border-radius: 3px;
                    overflow: hidden;
                    position: relative;
                ">
                    <div style="
                        height: 100%;
                        background: linear-gradient(90deg, #06055B 0%, #AA1EA5 50%, #06055B 100%);
                        background-size: 200% 100%;
                        animation: progressSlide 2s ease-in-out infinite;
                        width: 100%;
                    "></div>
                </div>
                <p id="modal-loading-subtitle" style="
                    color: #64748B;
                    font-size: 13px;
                    margin-top: 12px;
                    font-family: 'Space Grotesk', sans-serif;
                ">Por favor, aguarde...</p>
            </div>
        `;

        const modalContent = uploadModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.position = 'relative';
            modalContent.appendChild(loadingContainer);
        }

        // Adicionar animações CSS se não existirem
        if (!document.getElementById('upload-loading-animations')) {
            const style = document.createElement('style');
            style.id = 'upload-loading-animations';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
                @keyframes progressSlide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        loadingContainer.style.display = 'flex';
        const title = document.getElementById('modal-loading-title');
        if (title) title.textContent = message;
    }

    Logger.info('🎨 Loading no modal exibido:', message);
}

/**
 * 🔄 ATUALIZAR PROGRESSO DE UPLOAD V10.7.5
 * Atualiza mensagem do loading no modal
 */
function updateUploadProgress(percent, message = null) {
    // Atualizar subtítulo com porcentagem
    const subtitle = document.getElementById('modal-loading-subtitle');
    if (subtitle) {
        if (message) {
            subtitle.textContent = message;
        } else {
            subtitle.textContent = `${Math.round(percent)}% concluído...`;
        }
    }

    Logger.debug('🔄 Progresso atualizado:', percent + '%');
}

/**
 * 🔒 ESCONDER PROGRESSO DE UPLOAD V10.7.5
 * Oculta loading do modal
 */
function hideUploadProgress() {
    const loadingContainer = document.getElementById('modal-loading-container');

    if (loadingContainer) {
        // Fade out suave
        loadingContainer.style.transition = 'opacity 0.3s ease';
        loadingContainer.style.opacity = '0';

        setTimeout(() => {
            loadingContainer.style.display = 'none';
            loadingContainer.style.opacity = '1'; // Reset para próxima vez
        }, 300);
    }

    Logger.info('🎨 Loading do modal escondido');
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
        Logger.error('Sem URLs alternativas', { name: imgElement.dataset.fileName });
        showImageErrorPlaceholder(imgElement);
        return;
    }

    try {
        const urls = JSON.parse(alternativeUrls);
        let currentIndex = parseInt(imgElement.dataset.currentUrlIndex || '0');

        currentIndex++;

        if (currentIndex < urls.length) {
            Logger.info('URL alternativa', { index: currentIndex + 1, total: urls.length });
            imgElement.dataset.currentUrlIndex = currentIndex.toString();
            imgElement.src = urls[currentIndex];
        } else {
            Logger.error('Todas URLs falharam', { name: imgElement.dataset.fileName });
            showImageErrorPlaceholder(imgElement);
        }
    } catch (error) {
        Logger.error('Erro URLs alternativas', error);
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
 * 📥 BAIXAR TODOS OS ARQUIVOS (MODO CLIENTE)
 * ✅ CORREÇÃO: Download direto sem abrir abas (evita bloqueio de pop-ups)
 */
async function downloadAllFiles(pontoId, tipo) {
    try {
        Logger.info('Baixando todos os arquivos', { pontoId, tipo });

        // ✅ CORREÇÃO: Buscar ponto para obter exibidora correta
        const ponto = appData.pontos.find(p => p.id === pontoId);
        const exibidora = ponto?.exibidora || appData.exibidora;

        // 🔧 NORMALIZAR IDS para prevenir duplicação de pastas
        const normalizedPontoId = normalizeNotionId(pontoId);
        const normalizedDatabaseId = normalizeNotionId(appData.databaseId);

        // Buscar arquivos
        const result = await DriveAPI.listDriveFiles(exibidora, normalizedPontoId, tipo, normalizedDatabaseId);

        if (!result.success || result.files.length === 0) {
            alert('Nenhum arquivo para baixar');
            return;
        }

        const confirmMsg = `Deseja baixar ${result.files.length} arquivo(s)?\n\nOs downloads serão iniciados automaticamente.`;
        if (!confirm(confirmMsg)) {
            return;
        }

        // ✅ CORREÇÃO: Usar tags <a> invisíveis para download direto
        let downloadCount = 0;
        result.files.forEach((file, index) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = `https://drive.google.com/uc?export=download&id=${file.id}`;
                a.download = file.name || `arquivo_${index + 1}`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                downloadCount++;
                Logger.info('Download ZIP', { n: downloadCount, total: result.files.length, name: file.name });
            }, index * 500); // Delay de 500ms entre downloads
        });

        showSuccessMessage(`📥 Iniciando download de ${result.files.length} arquivo(s)...`);

    } catch (error) {
        Logger.error('Erro ao baixar arquivos', error);
        alert('Erro ao iniciar downloads: ' + error.message);
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

/**
 * 📄 ADICIONAR BOTÃO PDF NO HEADER (V10)
 */
function addPDFButton() {
    // Verificar se já existe
    if (document.getElementById('btn-gerar-pdf')) {
        return;
    }

    const headerContent = document.querySelector('.header-content');
    if (!headerContent) return;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        margin-top: 16px;
        text-align: center;
    `;

    const pdfButton = document.createElement('button');
    pdfButton.id = 'btn-gerar-pdf';
    pdfButton.className = 'btn btn-primary';
    pdfButton.innerHTML = '📄 Gerar Relatório PDF';
    pdfButton.onclick = generatePDFReport; // ✅ NOVO: Usar função melhorada
    pdfButton.style.cssText = `
        padding: 12px 24px;
        font-size: 16px;
    `;

    buttonContainer.appendChild(pdfButton);
    headerContent.appendChild(buttonContainer);

    Logger.info('Botão PDF adicionado ao header');
}

/**
 * ⏱️ SLEEP HELPER (V10.2)
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 📄 GERAR PDF DA CAMPANHA V10.5
 * ✅ MELHORIAS CRÍTICAS:
 * - Qualidade das imagens aumentada (scale 3x)
 * - TODOS os pontos expandidos e carregados
 * - Tempo de espera maior para garantir carregamento completo
 * - Inclui pontos COM e SEM evidências
 * - Notificação flutuante de progresso
 */
async function generateCampanhaPDF() {
    try {
        if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
            showPDFNotification('❌ Bibliotecas não carregadas', 'error');
            setTimeout(hidePDFNotification, 3000);
            return;
        }

        Logger.info('Gerando PDF da campanha V10.5 com qualidade aprimorada');

        // ✅ V10.5: Usar notificação flutuante em vez de barra de progresso
        showPDFNotification('📄 Preparando PDF...', 'progress');

        // 1. EXPANDIR TODOS os pontos (incluindo sem evidências)
        showPDFNotification('📂 Expandindo todos os pontos...', 'progress');
        let expandidos = 0;

        // ✅ V10.4: Buscar TODOS os pontos (não apenas os com botão toggle)
        for (const ponto of appData.pontos) {
            const content = document.getElementById(`content-${ponto.id}`);
            const icon = document.getElementById(`toggle-icon-${ponto.id}`);

            if (content) {
                if (content.style.display === 'none' || content.style.display === '') {
                    content.style.display = 'grid';
                    if (icon) icon.textContent = '▲';
                    expandidos++;

                    // ✅ V10.4: CARREGAR fotos de cada ponto expandido
                    // ✅ CORREÇÃO: Carregar SEQUENCIALMENTE para evitar duplicação de pastas
                    if (content.dataset.loaded === 'false') {
                        await loadPontoMediaIfNeeded(ponto, 'entrada', true);
                        await loadPontoMediaIfNeeded(ponto, 'saida', true);
                    }

                    await sleep(200); // Delay para renderização
                }
            }
        }

        Logger.info(`✅ ${expandidos} pontos expandidos (total: ${appData.pontos.length})`);

        // 2. AGUARDAR carregamento completo das imagens
        showPDFNotification('📸 Carregando imagens...', 'progress');
        await sleep(5000); // ✅ V10.4: 5 segundos para garantir todas as imagens

        // ✅ V10.4: Verificar se todas as imagens carregaram
        const allImages = document.querySelectorAll('#pontos-list img');
        Logger.info(`Total de imagens no PDF: ${allImages.length}`);

        // 3. CAPTURAR a tela com ALTA QUALIDADE
        showPDFNotification('🖼️ Capturando tela...', 'progress');
        const pontosContainer = document.getElementById('pontos-list');

        if (!pontosContainer) {
            throw new Error('Container de pontos não encontrado');
        }

        // ✅ V10.4: Qualidade MÁXIMA para PDF
        const canvas = await html2canvas(pontosContainer, {
            scale: 3, // ✅ AUMENTADO: 3x para maior nitidez
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: pontosContainer.scrollWidth,
            windowHeight: pontosContainer.scrollHeight,
            imageTimeout: 15000, // ✅ NOVO: 15s timeout para cada imagem
            removeContainer: false // ✅ NOVO: Manter container no DOM
        });

        Logger.info(`Canvas gerado: ${canvas.width}x${canvas.height}px`);

        // 4. CONVERTER para PDF com qualidade máxima
        showPDFNotification('📄 Convertendo para PDF...', 'progress');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        // ✅ V10.4: Usar JPEG com qualidade 0.95 (mais nítido que PNG)
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 width em mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pageHeight = 297; // A4 height em mm

        let heightLeft = imgHeight;
        let position = 0;
        let pageCount = 1;

        // Adicionar primeira página
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        // Adicionar páginas adicionais se necessário
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;
            pageCount++;
        }

        Logger.info(`PDF: ${pageCount} página(s) geradas`);

        // 5. SALVAR com nome descritivo
        const fileName = `CheckingOOH-Campanha-${appData.databaseId}-${new Date().toISOString().split('T')[0]}.pdf`;
        showPDFNotification('💾 Salvando PDF...', 'progress');
        pdf.save(fileName);

        // ✅ V10.5: Notificação de sucesso
        showPDFNotification(`✅ PDF baixado! ${pageCount} pág. | ${appData.pontos.length} pontos`, 'success');
        setTimeout(hidePDFNotification, 4000); // Auto-fechar após 4 segundos

        Logger.success('PDF gerado V10.5 com qualidade aprimorada', {
            fileName,
            pages: pageCount,
            pontos: appData.pontos.length,
            images: allImages.length,
            resolution: `${canvas.width}x${canvas.height}px`
        });

    } catch (error) {
        Logger.error('Erro ao gerar PDF', error);

        // ✅ V10.5: Notificação de erro
        showPDFNotification('❌ Erro ao gerar PDF', 'error');
        setTimeout(() => {
            hidePDFNotification();
            alert('Erro ao gerar PDF: ' + error.message + '\n\nTente novamente ou use Ctrl+P para imprimir.');
        }, 2000);
    }
}

// =============================================================================
// 📄 NOVA GERAÇÃO DE PDF COM jsPDF - RÁPIDO E COM FOTOS GRANDES
// =============================================================================
/**
 * 📄 GERAR PDF MELHORADO V2
 * - Layout profissional com grid 2 colunas (entrada/saída)
 * - Carregamento paralelo de fotos (OTIMIZADO)
 * - Fotos em grid 2x2 dentro de cada seção
 * - Status visual com badges
 */
async function generatePDFReport() {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showPDFNotification('❌ Biblioteca jsPDF não carregada', 'error');
            setTimeout(hidePDFNotification, 3000);
            return;
        }

        Logger.info('🚀 Gerando PDF melhorado V2 com layout profissional');
        showPDFNotification('📄 Preparando PDF...', 'progress');

        // ========================================
        // FASE 1: PRÉ-CARREGAR TODAS AS FOTOS EM PARALELO (OTIMIZAÇÃO)
        // ========================================
        showPDFNotification('📸 Carregando fotos em alta qualidade...', 'progress');

        const pontosData = await Promise.all(
            appData.pontos.map(async (ponto) => {
                try {
                    // 🔧 NORMALIZAR IDS para prevenir duplicação de pastas
                    const normalizedPontoId = normalizeNotionId(ponto.id);
                    const normalizedDatabaseId = normalizeNotionId(appData.databaseId);

                    // ✅ CORREÇÃO: Buscar SEQUENCIALMENTE para evitar duplicação de pastas
                    // Primeira chamada cria a estrutura, segunda usa as pastas existentes
                    const entradaData = await DriveAPI.listDriveFiles(ponto.exibidora, normalizedPontoId, 'entrada', normalizedDatabaseId);
                    const saidaData = await DriveAPI.listDriveFiles(ponto.exibidora, normalizedPontoId, 'saida', normalizedDatabaseId);

                    const entradaFiles = (entradaData.files || []).slice(0, 4); // Máx 4 fotos
                    const saidaFiles = (saidaData.files || []).slice(0, 4); // Máx 4 fotos

                    Logger.info(`📸 Ponto ${ponto.endereco}: ${entradaFiles.length} entrada, ${saidaFiles.length} saída`);

                    // Carregar imagens em PARALELO
                    const [entradaResults, saidaResults] = await Promise.all([
                        Promise.allSettled(entradaFiles.map(f => {
                            // ✅ CORRIGIDO: Usar propriedades corretas retornadas pelo backend
                            // Backend retorna: url, thumbnailUrl, downloadUrl, alternativeUrls
                            const url = f.url ||
                                       f.thumbnailUrl ||
                                       f.downloadUrl ||
                                       (f.alternativeUrls && f.alternativeUrls[0]) ||
                                       (f.id ? `https://drive.google.com/uc?id=${f.id}&export=view` : null);

                            Logger.info(`🔄 Carregando entrada: ${f.name}`);
                            Logger.info(`   Propriedades disponíveis:`, {
                                url: f.url?.substring(0, 80),
                                thumbnailUrl: f.thumbnailUrl?.substring(0, 80),
                                downloadUrl: f.downloadUrl?.substring(0, 80),
                                alternativeUrls: f.alternativeUrls?.length || 0
                            });
                            Logger.info(`   URL escolhida: ${url?.substring(0, 100) || 'NENHUMA URL DISPONÍVEL!'}`);

                            if (!url) {
                                return Promise.reject(new Error('URL não disponível'));
                            }

                            return loadImageAsBase64Fast(url);
                        })),
                        Promise.allSettled(saidaFiles.map(f => {
                            // ✅ CORRIGIDO: Usar propriedades corretas retornadas pelo backend
                            const url = f.url ||
                                       f.thumbnailUrl ||
                                       f.downloadUrl ||
                                       (f.alternativeUrls && f.alternativeUrls[0]) ||
                                       (f.id ? `https://drive.google.com/uc?id=${f.id}&export=view` : null);

                            Logger.info(`🔄 Carregando saída: ${f.name}`);
                            Logger.info(`   Propriedades disponíveis:`, {
                                url: f.url?.substring(0, 80),
                                thumbnailUrl: f.thumbnailUrl?.substring(0, 80),
                                downloadUrl: f.downloadUrl?.substring(0, 80),
                                alternativeUrls: f.alternativeUrls?.length || 0
                            });
                            Logger.info(`   URL escolhida: ${url?.substring(0, 100) || 'NENHUMA URL DISPONÍVEL!'}`);

                            if (!url) {
                                return Promise.reject(new Error('URL não disponível'));
                            }

                            return loadImageAsBase64Fast(url);
                        }))
                    ]);

                    // Filtrar apenas imagens que carregaram com sucesso e logar falhas
                    const entradaImages = [];
                    entradaResults.forEach((r, idx) => {
                        if (r.status === 'fulfilled') {
                            entradaImages.push(r.value);
                            Logger.debug(`✅ Entrada ${idx + 1} carregada com sucesso`);
                        } else {
                            Logger.error(`❌ Entrada ${idx + 1} falhou: ${r.reason?.message || 'erro desconhecido'}`);
                        }
                    });

                    const saidaImages = [];
                    saidaResults.forEach((r, idx) => {
                        if (r.status === 'fulfilled') {
                            saidaImages.push(r.value);
                            Logger.debug(`✅ Saída ${idx + 1} carregada com sucesso`);
                        } else {
                            Logger.error(`❌ Saída ${idx + 1} falhou: ${r.reason?.message || 'erro desconhecido'}`);
                        }
                    });

                    Logger.info(`✅ Carregadas: ${entradaImages.length}/${entradaFiles.length} entrada, ${saidaImages.length}/${saidaFiles.length} saída`);

                    return {
                        ponto,
                        entrada: { files: entradaFiles, images: entradaImages },
                        saida: { files: saidaFiles, images: saidaImages }
                    };
                } catch (error) {
                    Logger.debug(`Erro ao carregar fotos do ponto ${ponto.id}`);
                    return {
                        ponto,
                        entrada: { files: [], images: [] },
                        saida: { files: [], images: [] }
                    };
                }
            })
        );

        // Calcular resumo
        const pontosComEntrada = pontosData.filter(p => p.entrada.files.length > 0).length;
        const pontosComSaida = pontosData.filter(p => p.saida.files.length > 0).length;

        // ========================================
        // FASE 2: GERAR PDF COM LAYOUT PROFISSIONAL
        // ========================================
        showPDFNotification('📄 Montando relatório...', 'progress');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;
        let yPos = margin;
        let pageNum = 1;

        const campanhaTitle = appData.pageTitle || 'Campanha Completa';
        const dataAtual = new Date().toLocaleDateString('pt-BR');

        // Carregar logo E-MÍDIAS do site (não usar fallback local)
        let logoBase64 = null;
        try {
            const logoUrl = 'https://emidiastec.com.br/wp-content/smush-avif/2025/03/logo-E-MIDIAS-png-fundo-escuro-HORIZONTAL.png.avif';
            logoBase64 = await loadImageAsBase64Fast(logoUrl);
            Logger.info('✅ Logo E-MÍDIAS carregada do site');
        } catch (error) {
            Logger.info('ℹ️ Logo não disponível, usando texto');
            // Não usar fallback local - ir direto para texto
        }

        // Helper: Adicionar cabeçalho
        const addHeader = () => {
            // Usar cores E-MÍDIAS (#06055B)
            pdf.setFillColor(6, 5, 91); // #06055B - Primary E-MÍDIAS
            pdf.rect(0, 0, pageWidth, 35, 'F');

            // Adicionar logo se disponível
            if (logoBase64) {
                try {
                    pdf.addImage(logoBase64, 'PNG', margin, 8, 40, 20); // Logo 40x20mm
                } catch (e) {
                    // Fallback silencioso para texto
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFontSize(22);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('E-MÍDIAS', margin, 15);

                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('Soluções em Mídia Externa', margin, 22);
                }
            } else {
                // Fallback: texto
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(22);
                pdf.setFont('helvetica', 'bold');
                pdf.text('E-MÍDIAS', margin, 15);

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text('Soluções em Mídia Externa', margin, 22);
            }

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Relatório de Monitoramento', pageWidth - margin, 15, { align: 'right' });

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Data: ${dataAtual}`, pageWidth - margin, 22, { align: 'right' });
            pdf.text(`Página ${pageNum}`, pageWidth - margin, 28, { align: 'right' });

            return 45; // yPos após cabeçalho
        };

        // Primeira página - Cabeçalho
        yPos = addHeader();

        // Carregar ícone da página do Notion (se existir)
        // NOTA: Pode falhar por CORS em ícones hospedados externamente
        let pageIconBase64 = null;
        if (appData.pageIcon) {
            try {
                pageIconBase64 = await loadImageAsBase64Fast(appData.pageIcon);
                Logger.info('✅ Ícone da página carregado com sucesso');
            } catch (error) {
                // Erro de CORS é comum e esperado - usar título sem ícone
                Logger.info('ℹ️ Ícone da página não disponível (CORS/rede) - usando título sem ícone');
            }
        }

        // Título da campanha com gradiente E-MÍDIAS
        pdf.setFillColor(6, 5, 91); // #06055B - Primary E-MÍDIAS
        pdf.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F');

        // Adicionar ícone da página se disponível
        if (pageIconBase64) {
            try {
                pdf.addImage(pageIconBase64, 'PNG', margin + 5, yPos + 5, 15, 15);
                // Título com espaço para o ícone
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text(campanhaTitle, margin + 25, yPos + 13);
            } catch (e) {
                // Fallback silencioso: título centralizado sem ícone
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text(campanhaTitle, pageWidth / 2, yPos + 12, { align: 'center' });
            }
        } else {
            // Título centralizado sem ícone
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text(campanhaTitle, pageWidth / 2, yPos + 12, { align: 'center' });
        }

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Relatório completo de monitoramento de painéis', pageWidth / 2, yPos + 19, { align: 'center' });
        yPos += 32;

        // Cards de resumo
        const cardWidth = (contentWidth - 20) / 3;

        const drawSummaryCard = (x, y, title, value) => {
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(x, y, cardWidth, 18, 2, 2, 'FD');

            pdf.setTextColor(107, 114, 128);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(title, x + cardWidth / 2, y + 6, { align: 'center' });

            pdf.setTextColor(30, 64, 175);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(value.toString(), x + cardWidth / 2, y + 14, { align: 'center' });
        };

        drawSummaryCard(margin, yPos, 'Total de Pontos', appData.pontos.length);
        drawSummaryCard(margin + cardWidth + 10, yPos, 'Pontos com Entrada', pontosComEntrada);
        drawSummaryCard(margin + 2 * cardWidth + 20, yPos, 'Pontos com Saída', pontosComSaida);
        yPos += 28;

        // ========================================
        // RENDERIZAR CADA PONTO
        // ========================================
        for (let i = 0; i < pontosData.length; i++) {
            const { ponto, entrada, saida } = pontosData[i];

            showPDFNotification(`📝 Adicionando ponto ${i + 1}/${pontosData.length} ao PDF...`, 'progress');

            // Calcular altura necessária para o ponto
            const maxFotos = Math.max(entrada.images.length, saida.images.length);
            const numRows = Math.ceil(maxFotos / 2);
            const photoHeight = 35;
            const pontoHeight = 12 + (numRows * photoHeight) + 20;

            // Verificar se precisa de nova página
            if (yPos + pontoHeight > pageHeight - 15) {
                pdf.addPage();
                pageNum++;
                yPos = addHeader();
            }

            // Header do ponto
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(6, 5, 91); // Borda azul E-MÍDIAS
            pdf.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'FD');

            pdf.setTextColor(6, 5, 91); // Texto azul E-MÍDIAS
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${ponto.endereco}`, margin + 2, yPos + 6);

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139); // Gray mais escuro
            pdf.text(`Exibidora: ${ponto.exibidora}`, margin + 2, yPos + 10);

            yPos += 15;

            // Grid 2 colunas: ENTRADA | SAÍDA
            const colWidth = (contentWidth - 5) / 2;

            // Helper: Desenhar seção
            const drawSection = (x, title, files, images, color) => {
                let sectionY = yPos;

                // Header da seção
                pdf.setFillColor(color.r, color.g, color.b);
                pdf.roundedRect(x, sectionY, colWidth, 8, 2, 2, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text(title, x + 2, sectionY + 5.5);
                sectionY += 10;

                // Status badge
                if (files.length > 0) {
                    pdf.setFillColor(220, 252, 231);
                    pdf.setTextColor(22, 101, 52);
                } else {
                    pdf.setFillColor(254, 243, 199);
                    pdf.setTextColor(146, 64, 14);
                }
                pdf.roundedRect(x + 2, sectionY, 20, 5, 1, 1, 'F');
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'bold');
                pdf.text(files.length > 0 ? 'Completo' : 'Pendente', x + 12, sectionY + 3.5, { align: 'center' });
                sectionY += 8;

                // Fotos em grid 2x2
                if (images.length > 0) {
                    const photoW = (colWidth - 6) / 2;
                    const photoH = 30;

                    for (let idx = 0; idx < Math.min(4, images.length); idx++) {
                        const col = idx % 2;
                        const row = Math.floor(idx / 2);
                        const photoX = x + 2 + (col * (photoW + 2));
                        const photoY = sectionY + (row * (photoH + 2));

                        try {
                            pdf.addImage(images[idx], 'JPEG', photoX, photoY, photoW, photoH);
                        } catch (e) {
                            Logger.debug('Erro ao adicionar imagem ao PDF');
                        }
                    }
                } else {
                    // Mensagem "sem fotos"
                    pdf.setTextColor(156, 163, 175);
                    pdf.setFontSize(8);
                    pdf.setFont('helvetica', 'italic');
                    const msg = title.includes('ENTRADA')
                        ? 'Aguardando fotos de instalação'
                        : 'Aguardando fotos de retirada';
                    pdf.text(msg, x + colWidth / 2, sectionY + 10, { align: 'center' });
                }
            };

            // Renderizar colunas com cores E-MÍDIAS
            drawSection(margin, 'ENTRADA', entrada.files, entrada.images, { r: 16, g: 185, b: 129 }); // #10B981 - Success
            drawSection(margin + colWidth + 5, 'SAIDA', saida.files, saida.images, { r: 239, g: 68, b: 68 }); // #EF4444 - Danger

            yPos += Math.max(
                entrada.images.length > 0 ? Math.ceil(entrada.images.length / 2) * 32 + 18 : 28,
                saida.images.length > 0 ? Math.ceil(saida.images.length / 2) * 32 + 18 : 28
            );

            // Linha divisória
            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, yPos, pageWidth - margin, yPos);
            yPos += 8;
        }

        // Rodapé na última página
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text('E-MÍDIAS • Sistema de Monitoramento OOH • checking.emidiastec.com.br', pageWidth / 2, pageHeight - 10, { align: 'center' });
        pdf.text(`Relatório gerado automaticamente em ${dataAtual}`, pageWidth / 2, pageHeight - 6, { align: 'center' });

        // ========================================
        // SALVAR PDF
        // ========================================
        showPDFNotification('💾 Baixando PDF...', 'progress');
        const fileName = `CheckingOOH-${campanhaTitle.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        showPDFNotification(`✅ PDF baixado com sucesso! ${appData.pontos.length} pontos`, 'success');
        setTimeout(hidePDFNotification, 4000);

        Logger.success('PDF gerado com sucesso', {
            fileName,
            pontos: appData.pontos.length,
            pages: pageNum
        });

    } catch (error) {
        Logger.error('Erro ao gerar PDF', error);
        showPDFNotification('❌ Erro ao gerar PDF', 'error');
        setTimeout(() => {
            hidePDFNotification();
            alert('Erro ao gerar PDF: ' + error.message);
        }, 2000);
    }
}

/**
 * 🖼️ CARREGAR IMAGEM COMO BASE64 (VERSÃO RÁPIDA E OTIMIZADA)
 * - Usa timeout de 30s (aceita demora para qualidade)
 * - Compressão JPEG 0.9 (alta qualidade)
 * - Redimensiona para máx 1200px (fotos maiores no PDF)
 */
async function loadImageAsBase64Fast(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        // Timeout de 30 segundos (aceita demora)
        const timeout = setTimeout(() => {
            img.src = '';
            reject(new Error('Timeout ao carregar imagem'));
        }, 30000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');

                // Redimensionar para otimizar (máx 1200px de largura - fotos maiores)
                const maxWidth = 1200;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compressão JPEG 0.9 (alta qualidade)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = (e) => {
            clearTimeout(timeout);
            Logger.error(`Erro ao carregar imagem: ${url?.substring(0, 80)}`);
            reject(new Error(`Erro ao carregar imagem: ${e.type}`));
        };

        // Log da tentativa
        Logger.debug(`Tentando carregar: ${url?.substring(0, 80)}...`);

        img.src = url;
    });
}

/**
 * 🖼️ CARREGAR IMAGEM COMO BASE64 (VERSÃO LEGADO)
 * Mantida para compatibilidade
 */
async function loadImageAsBase64(url) {
    return loadImageAsBase64Fast(url);
}

// 🚀 EXPORTAR FUNÇÕES GLOBAIS
window.togglePontoContent = togglePontoContent;
window.togglePontoLazy = togglePontoLazy;
window.toggleEditMode = toggleEditMode;
window.cancelEditMode = cancelEditMode; // ✅ V10.7.3: Cancelar edição
window.openMediaChoiceModal = openMediaChoiceModal;
window.closeMediaChoiceModal = closeMediaChoiceModal;
window.chooseCamera = chooseCamera;
window.chooseUpload = chooseUpload;
window.deleteFile = deleteFile;
window.downloadAllFiles = downloadAllFiles;
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
window.openFullImage = openFullImage;
window.openMediaCarousel = openMediaCarousel; // ✅ V10: Agora é zoom simples
window.closeMediaCarousel = closeMediaCarousel; // Compatibilidade
window.closeZoomModal = closeZoomModal; // ✅ V10: Nova função de zoom
window.generateCampanhaPDF = generateCampanhaPDF; // ✅ V10: Gerador de PDF (legado)
window.generatePDFReport = generatePDFReport; // ✅ NOVO: Gerador de PDF melhorado
window.calcularBisemana = calcularBisemana; // ✅ V10: Cálculo de bi-semana
window.hideDemoWarning = hideDemoWarning;
window.updateMediaPreview = updateMediaPreview;
window.showSuccessMessage = showSuccessMessage;

Logger.info('Script principal carregado');

// ✅ V10.4: TELA DE CARREGAMENTO COM FRASES OOH - SEM REFERÊNCIAS A DRIVE
const LOADING_TEXTS_OOH = [
    "Sincronizando campanhas...",
    "Verificando evidências...",
    "Carregando pontos de mídia...",
    "Processando fotos...",
    "Checando qualidade das imagens...",
    "Organizando relatórios...",
    "Mapeando localizações...",
    "Preparando dashboard...",
    "🎯 Carregando campanhas ativas...",
    "📸 Processando evidências...",
    "Instalando lona...",
    "Espantando os pombos do outdoor...",
    "Conversando com exibidora...",
    "Ajeitando o ângulo da foto...",
    "A avenida tá cheia hoje, do jeito que a mídia gosta...",
    "Verificando se o painel está iluminado...",
    "Medindo a audiência da esquina...",
    "Negociando com o vento para não derrubar nada...",
    "Conferindo se a arte está reta..."
];

let loadingTextInterval = null;
let currentTextIndex = 0;

/**
 * 🔄 ROTACIONAR TEXTO DE CARREGAMENTO
 */
function rotateLoadingText() {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        currentTextIndex = (currentTextIndex + 1) % LOADING_TEXTS_OOH.length;
        loadingText.textContent = LOADING_TEXTS_OOH[currentTextIndex];
    }
}

/**
 * 🎬 INICIAR TELA DE CARREGAMENTO V10.4
 * ✅ Atualizado para usar #loading-proposta (novo ID)
 */
function startLoadingScreen() {
    const loadingScreen = document.getElementById('loading-proposta');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.classList.remove('hidden');

        // Rotacionar frases a cada 2.5 segundos
        loadingTextInterval = setInterval(rotateLoadingText, 2500);

        Logger.info('Tela de carregamento iniciada V10.4');
    }
}

/**
 * 🏁 ESCONDER TELA DE CARREGAMENTO V10.4
 * ✅ Controle preciso de estados - loading desaparece quando TUDO está pronto
 */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-proposta');
    if (loadingScreen) {
        // Parar rotação de textos IMEDIATAMENTE
        if (loadingTextInterval) {
            clearInterval(loadingTextInterval);
            loadingTextInterval = null;
        }

        // Fade out suave
        loadingScreen.classList.add('hidden');

        // Remover do DOM após transição (800ms conforme modelo)
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 800);

        Logger.info('Tela de carregamento escondida V10.4 - Loading removido completamente');
    }
}

/**
 * 🚫 V10.5: REMOVER TODOS OS TEXTOS "CARREGANDO" DO DOM
 * Elimina QUALQUER texto residual que apareça após a tela de carregamento
 */
function removeAllLoadingTexts() {
    Logger.info('🧹 V10.5: Removendo todos os textos "Carregando"...');

    // 1. FORÇAR ocultação do elemento #loading
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
        loadingElement.style.visibility = 'hidden';
        loadingElement.style.opacity = '0';
        Logger.info('✅ Elemento #loading forçadamente ocultado');
    }

    // 2. Buscar por TODOS os elementos com classe "loading"
    const loadingElements = document.querySelectorAll('.loading, [class*="loading"], [id*="loading"]');
    loadingElements.forEach((element) => {
        // Não remover a tela de carregamento principal (#loading-proposta)
        if (element.id === 'loading-proposta') return;

        const text = element.textContent || '';
        if (text.toLowerCase().includes('carregando')) {
            element.style.display = 'none';
            Logger.info('✅ Elemento com texto "carregando" ocultado:', element.id || element.className);
        }
    });

    // 3. Buscar por textos específicos observados
    const allParagraphs = document.querySelectorAll('p, span, div');
    allParagraphs.forEach((element) => {
        const text = element.textContent?.trim() || '';
        if (text === 'Carregando dados...' ||
            text === 'Carregando...' ||
            text.match(/^Carregando\s+/i)) {
            element.style.display = 'none';
            Logger.info('✅ Texto "Carregando" removido:', text);
        }
    });

    Logger.success('🧹 V10.5: Limpeza de textos "Carregando" concluída');
}

/**
 * 👁️ V10.5: OBSERVADOR PARA REMOVER TEXTOS "CARREGANDO" DINAMICAMENTE
 * Monitora o DOM e remove automaticamente qualquer texto "Carregando" que apareça
 */
let loadingTextObserver = null;

function startLoadingTextObserver() {
    // Não criar múltiplos observers
    if (loadingTextObserver) return;

    Logger.info('👁️ V10.5: Iniciando observador de textos "Carregando"...');

    loadingTextObserver = new MutationObserver((mutations) => {
        let foundLoadingText = false;

        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const text = node.textContent || '';
                    if (text.toLowerCase().includes('carregando')) {
                        foundLoadingText = true;
                    }
                }
            });
        });

        if (foundLoadingText) {
            Logger.info('👁️ Texto "Carregando" detectado dinamicamente, removendo...');
            removeAllLoadingTexts();
        }
    });

    // Observar apenas o container principal
    const container = document.querySelector('.container');
    if (container) {
        loadingTextObserver.observe(container, {
            childList: true,
            subtree: true,
            characterData: false
        });
        Logger.success('👁️ V10.5: Observador iniciado com sucesso');
    }
}

/**
 * 📄 V10.5: NOTIFICAÇÃO FLUTUANTE PARA PDF
 * Sistema de notificação aprimorado com tipos (progress, success, error)
 */
function showPDFNotification(message, type = 'progress') {
    const notification = document.getElementById('pdf-notification');
    const textElement = document.getElementById('pdf-notification-text');
    const spinner = notification.querySelector('.pdf-spinner');

    if (!notification || !textElement) return;

    // Atualizar texto
    textElement.textContent = message;

    // Controlar spinner
    if (spinner) {
        spinner.style.display = type === 'progress' ? 'block' : 'none';
    }

    // Remover classes anteriores
    notification.classList.remove('success', 'error', 'progress');

    // Adicionar classe do tipo
    notification.classList.add(type);

    // Mostrar notificação
    notification.style.display = 'block';
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    Logger.info(`📄 Notificação PDF [${type}]: ${message}`);
}

function hidePDFNotification() {
    const notification = document.getElementById('pdf-notification');
    if (!notification) return;

    notification.classList.remove('show');
    setTimeout(() => {
        notification.style.display = 'none';
    }, 300);
}

/**
 * 📥 V10.7.1: ADICIONAR BOTÕES DE DOWNLOAD NO MODO CAMPANHA
 * CRIA botões de download APENAS em fotos/vídeos (não em containers externos)
 */
function addDownloadButtonsToCampaign() {
    // Verificar se estamos no modo campanha
    const isCampaignMode = appData.mode === 'campanha' ||
                          window.location.search.includes('campanha=');

    if (!isCampaignMode) {
        Logger.debug('Não está no modo campanha, pulando botões de download');
        return;
    }

    Logger.info('📥 V10.7.1: Adicionando botões de download no modo campanha...');

    // Encontrar APENAS media-items que contenham imagens ou vídeos
    const mediaContainers = document.querySelectorAll('.media-preview .media-item, .media-preview-large .media-item');
    let createdButtons = 0;

    mediaContainers.forEach((container) => {
        // ✅ V10.7.2: VERIFICAR se o container realmente tem img, video ou video-thumbnail
        const img = container.querySelector('img');
        const video = container.querySelector('video');
        const videoThumb = container.querySelector('.video-thumbnail');

        if (!img && !video && !videoThumb) {
            Logger.debug('Container sem mídia, pulando...');
            return; // Pular containers sem mídia
        }

        // Verificar se já tem download badge
        let downloadBadge = container.querySelector('.download-badge');

        if (downloadBadge) {
            // Forçar visibilidade
            downloadBadge.style.display = 'flex';
            downloadBadge.style.opacity = '1';
            downloadBadge.style.visibility = 'visible';
            createdButtons++;
            Logger.debug('Download badge já existe, forçando visibilidade');
        } else {
            // CRIAR o botão de download
            let fileId;
            if (img) {
                fileId = extractFileId(img.src);
            } else if (video) {
                fileId = extractFileId(video.src);
            } else if (videoThumb) {
                fileId = videoThumb.dataset.fileId;
            }

            if (!fileId) {
                Logger.debug('Sem file ID, pulando...');
                return;
            }

            downloadBadge = document.createElement('a');
            downloadBadge.className = 'download-badge';
            downloadBadge.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
            downloadBadge.innerHTML = '⬇';
            downloadBadge.title = 'Baixar arquivo';
            downloadBadge.style.cssText = `
                position: absolute;
                top: 4px;
                right: 4px;
                width: 24px;
                height: 24px;
                background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 1px 4px rgba(16, 185, 129, 0.3);
                z-index: 1000;
                text-decoration: none;
                border: 1.5px solid white;
                opacity: 0.7;
                backdrop-filter: blur(4px);
            `;

            downloadBadge.onclick = (e) => {
                e.stopPropagation(); // Não abrir zoom ao clicar no download
            };

            container.appendChild(downloadBadge);
            createdButtons++;
            Logger.debug('Download badge criado');
        }
    });

    Logger.success(`📥 V10.7.1: ${createdButtons} botões de download adicionados/visíveis`);
}

/**
 * 🔗 EXTRAIR FILE ID DO GOOGLE DRIVE URL
 */
function extractFileId(url) {
    if (!url) return '';

    // Tentar extrair de diferentes formatos de URL
    const patterns = [
        /id=([^&]+)/,
        /\/d\/([^/]+)/,
        /\/file\/d\/([^/]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return '';
}

/**
 * 🖼️ V10.6: SISTEMA DE MODAL CORRIGIDO COM ÍNDICES CORRETOS
 * Corrige erro "arquivo não encontrado" e seleção de imagem errada
 */
let currentModalImages = [];
let currentModalIndex = 0;

function setupImageModal() {
    // Verificar se modal já existe
    if (document.getElementById('image-modal-v10-6')) {
        return;
    }

    Logger.info('🖼️ V10.6: Criando modal de imagem corrigido...');

    const modal = document.createElement('div');
    modal.id = 'image-modal-v10-6';
    modal.className = 'image-modal-v10-6';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-backdrop-v10-6" onclick="closeImageModalV106()"></div>
        <div class="modal-content-v10-6">
            <button class="modal-close-v10-6" onclick="closeImageModalV106()">&times;</button>
            <img class="modal-image-v10-6" src="" alt="Evidência">
            <div class="modal-nav-v10-6">
                <button class="modal-prev-v10-6" onclick="navigateModalV106(-1)">❮</button>
                <span class="modal-counter-v10-6">1 de 1</span>
                <button class="modal-next-v10-6" onclick="navigateModalV106(1)">❯</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Adicionar listener de teclado
    document.addEventListener('keydown', handleModalKeyboardV106);

    Logger.success('🖼️ V10.6: Modal criado com sucesso');
}

function handleModalKeyboardV106(e) {
    const modal = document.getElementById('image-modal-v10-6');
    if (!modal || modal.style.display === 'none') return;

    switch(e.key) {
        case 'Escape':
            closeImageModalV106();
            break;
        case 'ArrowLeft':
            navigateModalV106(-1);
            break;
        case 'ArrowRight':
            navigateModalV106(1);
            break;
    }
}

function openImageModalV106(imageUrl, allImages, startIndex) {
    setupImageModal();

    const modal = document.getElementById('image-modal-v10-6');
    const modalImage = modal.querySelector('.modal-image-v10-6');
    const counter = modal.querySelector('.modal-counter-v10-6');

    // Validar parâmetros
    if (!imageUrl || !allImages || !Array.isArray(allImages)) {
        Logger.error('Parâmetros inválidos para modal:', { imageUrl, allImages, startIndex });
        return;
    }

    // Atualizar estado global
    currentModalImages = allImages.filter(img => img && img.src);
    currentModalIndex = Math.max(0, Math.min(startIndex || 0, currentModalImages.length - 1));

    if (currentModalImages.length === 0) {
        Logger.error('Nenhuma imagem válida encontrada');
        return;
    }

    // Mostrar imagem atual
    const currentImage = currentModalImages[currentModalIndex];
    modalImage.src = currentImage.src;
    modalImage.alt = currentImage.alt || `Evidência ${currentModalIndex + 1}`;

    // Atualizar contador
    counter.textContent = `${currentModalIndex + 1} de ${currentModalImages.length}`;

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    Logger.success(`🖼️ Modal aberto: imagem ${currentModalIndex + 1} de ${currentModalImages.length}`);
}

function navigateModalV106(direction) {
    if (currentModalImages.length === 0) return;

    currentModalIndex += direction;

    // Loop circular
    if (currentModalIndex < 0) currentModalIndex = currentModalImages.length - 1;
    if (currentModalIndex >= currentModalImages.length) currentModalIndex = 0;

    // Atualizar imagem
    const modal = document.getElementById('image-modal-v10-6');
    const modalImage = modal.querySelector('.modal-image-v10-6');
    const counter = modal.querySelector('.modal-counter-v10-6');

    const currentImage = currentModalImages[currentModalIndex];
    modalImage.src = currentImage.src;
    modalImage.alt = currentImage.alt || `Evidência ${currentModalIndex + 1}`;
    counter.textContent = `${currentModalIndex + 1} de ${currentModalImages.length}`;

    Logger.debug(`🖼️ Navegou para imagem ${currentModalIndex + 1}`);
}

function closeImageModalV106() {
    const modal = document.getElementById('image-modal-v10-6');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // Limpar estado
    currentModalImages = [];
    currentModalIndex = 0;

    Logger.debug('🖼️ Modal fechado');
}

/**
 * 🔄 V10.7.2: ZOOM SIMPLES - SEM CARROSSEL
 * Abre imagem em zoom, vídeos fazem download automaticamente
 */
function attachImageClickHandlersV106() {
    document.addEventListener('click', (e) => {
        // ✅ V10.7.2: Ignorar vídeos (já têm download próprio)
        if (e.target.closest('.video-thumbnail')) {
            return;
        }

        const imgElement = e.target.closest('img');

        // Ignorar se não é imagem
        if (!imgElement) return;

        // Ignorar se clicou no botão de download ou delete
        if (e.target.closest('.download-badge, .delete-badge')) {
            return;
        }

        // Ignorar logos e imagens de UI
        if (imgElement.classList.contains('loading-logo') ||
            imgElement.classList.contains('top-logo') ||
            imgElement.closest('.loading-screen') ||
            imgElement.closest('.top-header')) {
            return;
        }

        // Apenas imagens dentro de media-preview
        const mediaPreview = imgElement.closest('.media-preview, .media-preview-large');
        if (!mediaPreview) return;

        e.preventDefault();
        e.stopPropagation();

        // ZOOM SIMPLES: Apenas abrir a imagem clicada
        openSimpleZoom(imgElement.src, imgElement.alt || 'Evidência');
    });
}

/**
 * 🔍 V10.6: ZOOM SIMPLES
 * Abre apenas a imagem em tela cheia - SEM navegação
 */
function openSimpleZoom(imageUrl, imageAlt) {
    // Remover zoom antigo se existir
    closeSimpleZoom();

    Logger.info('🔍 V10.6: Abrindo zoom simples');

    const zoomDiv = document.createElement('div');
    zoomDiv.id = 'simple-zoom-v106';
    zoomDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
    `;

    zoomDiv.onclick = closeSimpleZoom;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = imageAlt;
    img.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: transparent;
        border: none;
        color: white;
        font-size: 50px;
        cursor: pointer;
        z-index: 100000;
        width: 60px;
        height: 60px;
    `;
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeSimpleZoom();
    };

    zoomDiv.appendChild(img);
    zoomDiv.appendChild(closeBtn);
    document.body.appendChild(zoomDiv);
    document.body.style.overflow = 'hidden';

    // Fechar com ESC
    document.addEventListener('keydown', handleZoomEscape);
}

function closeSimpleZoom() {
    const zoom = document.getElementById('simple-zoom-v106');
    if (zoom) {
        zoom.remove();
        document.body.style.overflow = '';
    }
    document.removeEventListener('keydown', handleZoomEscape);
}

function handleZoomEscape(e) {
    if (e.key === 'Escape') {
        closeSimpleZoom();
    }
}

/**
 * ✏️ V10.6: CORRIGIR MODO EDIÇÃO COM BOTÕES "-"
 * Botões sempre visíveis em todas as evidências, exceto cards principais
 */
function updateEditModeUI() {
    const editModeActive = Object.values(appData.editMode).some(value => value === true);

    if (editModeActive) {
        document.body.classList.add('edit-mode-active-v10-6');
        Logger.info('✏️ V10.6: Modo edição ativado - botões "-" visíveis');
    } else {
        document.body.classList.remove('edit-mode-active-v10-6');
        Logger.info('👁️ V10.6: Modo edição desativado - botões "-" ocultos');
    }
}

/**
 * 🔍 FILTRAR PONTOS POR PESQUISA
 * Filtra os pontos exibidos baseado no texto digitado
 */
function filterPontos() {
    const searchInput = document.getElementById('search-pontos');
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const pontosItems = document.querySelectorAll('.ponto-item');
    const resultsCount = document.getElementById('search-results-count');

    let visibleCount = 0;
    let totalCount = pontosItems.length;

    pontosItems.forEach(pontoItem => {
        // Buscar texto no título (endereço) e na exibidora
        const pontoInfo = pontoItem.querySelector('.ponto-info');
        const pontoText = pontoInfo ? pontoInfo.textContent.toLowerCase() : '';

        // Verificar se o texto da pesquisa está no conteúdo do ponto
        const matches = searchText === '' || pontoText.includes(searchText);

        if (matches) {
            pontoItem.classList.remove('hidden-by-search');
            visibleCount++;
        } else {
            pontoItem.classList.add('hidden-by-search');
        }
    });

    // Atualizar contador de resultados
    if (resultsCount) {
        if (searchText === '') {
            resultsCount.textContent = '';
        } else {
            resultsCount.textContent = `${visibleCount} de ${totalCount} ponto(s) encontrado(s)`;
        }
    }

    Logger.debug('Filtro de pesquisa aplicado', { searchText, visibleCount, totalCount });
}

// ✅ EXPORTAR FUNÇÕES V10.6
window.addDownloadButtonsToCampaign = addDownloadButtonsToCampaign;
window.openImageModalV106 = openImageModalV106;
window.closeImageModalV106 = closeImageModalV106;
window.navigateModalV106 = navigateModalV106;
window.filterPontos = filterPontos;

// ✅ INICIALIZAR APLICAÇÃO QUANDO O DOM ESTIVER PRONTO
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();

        // ✅ V10.6: Inicializar após carregar
        setTimeout(() => {
            addDownloadButtonsToCampaign();
            attachImageClickHandlersV106();
        }, 2000);
    });
} else {
    initApp();

    // ✅ V10.6: Inicializar após carregar
    setTimeout(() => {
        addDownloadButtonsToCampaign();
        attachImageClickHandlersV106();
    }, 2000);
}
