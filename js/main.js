// =============================================================================
// 🚀 SCRIPT PRINCIPAL - CHECKING OOH
// =============================================================================

const appData = {
    mode: null, // 'exibidora' ou 'cliente'
    exibidora: null,
    pontos: [],
    pontoAtual: null,
    databaseId: null, // ID da campanha
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

        // Atualizar header
        updatePageHeader(`📋 Campanha Completa`, `Visualização Geral • ${appData.pontos.length} ponto(s) de todas as exibidoras`);

        // ✅ V10: Adicionar botão PDF no header
        addPDFButton();

        // Renderizar pontos (modo read-only como cliente, mas layout expandido como exibidora)
        await renderPontos(true); // true = read-only (sem edição)

        Logger.success('Dados da campanha carregados', {
            pontosCount: appData.pontos.length,
            campanhaId: appData.databaseId
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
        `;
    } else {
        // Modo campanha/read-only: sem botões de ação
        actionsDiv.innerHTML = '';
    }

    secaoDiv.appendChild(actionsDiv);
    
    // Preview de mídia
    const previewDiv = document.createElement('div');
    // ✅ MELHORIA: Grid maior no modo cliente (fotos maiores)
    previewDiv.className = readOnly ? 'media-preview media-preview-large' : 'media-preview';
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
        const result = await DriveAPI.listDriveFiles(exibidora, ponto.id, tipo, appData.databaseId);

        if (result.success && result.files.length > 0) {
            // ✅ CORREÇÃO: Passar container como parâmetro
            updateMediaPreview(ponto.id, tipo, result.files, readOnly, container);
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
        console.error(`❌ Container preview-${pontoId}-${tipo} não encontrado!`);
        return;
    }

    console.log(`📸 updateMediaPreview: Renderizando ${files.length} arquivos para ponto ${pontoId} (${tipo}) [modo: ${readOnly ? 'CAMPANHA' : 'EXIBIDORA'}]`);

    container.innerHTML = '';

    if (files.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748B; font-size: 12px;">Nenhum arquivo</p>';
        updateMediaCount(pontoId, tipo, 0);
        return;
    }

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
            // ✅ CORREÇÃO: Usar index correto do array ao clicar
            mediaItem.onclick = () => openMediaCarousel(pontoId, tipo, currentIndex);
        
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
                console.log(`🔄 ${file.name}: ${file.alternativeUrls.length} URLs alternativas disponíveis`);
            } else {
                console.warn(`⚠️ ${file.name}: Sem URLs alternativas!`);
            }

            // ✅ NOVO: Handler de erro com fallback automático
            img.onerror = function() {
                console.warn(`⚠️ Erro ao carregar imagem: ${this.src}`);
                handleImageError(this);
            };

            // ✅ NOVO: Log quando carrega com sucesso
            img.onload = function() {
                console.log(`✅ Imagem carregada com sucesso: ${this.dataset.fileName} [${this.naturalWidth}x${this.naturalHeight}]`);
            };

            img.src = file.url;
            console.log(`🖼️ [${readOnly ? 'CLIENTE' : 'EXIBIDORA'}] Carregando imagem ${file.name} de: ${file.url}`);

            // ✅ MELHORIA: Timestamp removido conforme solicitado
            mediaItem.appendChild(img);
        }
        
        // ✅ CORREÇÃO: Badge de delete sempre criado, mas inicialmente escondido (modo exibidora)
        if (!readOnly) {
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'delete-badge';
            deleteBtn.innerHTML = '−'; // Sinal de menos
            const currentEditMode = isEditMode(pontoId, tipo);
            deleteBtn.style.display = currentEditMode ? 'flex' : 'none';
            deleteBtn.dataset.pontoId = pontoId;
            deleteBtn.dataset.tipo = tipo;
            console.log(`🗑️ Badge criado para ${file.name} (${pontoId}-${tipo}): ${currentEditMode ? 'VISÍVEL' : 'OCULTO'}`);
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Não abrir carrossel ao clicar no -
                deleteFile(file.id, file.name, pontoId, tipo);
            };
            mediaItem.appendChild(deleteBtn);
        }

        // ✅ MELHORIA: Botão de download individual (modo cliente)
        if (readOnly) {
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
                    loadPontoMediaIfNeeded(ponto, 'entrada'),
                    loadPontoMediaIfNeeded(ponto, 'saida')
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
                    Promise.all([
                        loadPontoMediaIfNeeded(ponto, 'entrada'),
                        loadPontoMediaIfNeeded(ponto, 'saida')
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
    
    // ✅ CORREÇÃO: Apenas mostrar/ocultar badges de delete do container específico
    const container = document.getElementById(`preview-${pontoId}-${tipo}`);
    if (container) {
        const deleteButtons = container.querySelectorAll('.delete-badge');
        console.log(`🔧 Toggle modo edição: ${deleteButtons.length} badges encontrados para ${pontoId}-${tipo}`);
        deleteButtons.forEach(badge => {
            badge.style.display = appData.editMode[key] ? 'flex' : 'none';
        });
    } else {
        console.error(`❌ Container preview-${pontoId}-${tipo} não encontrado ao alternar modo edição!`);
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
        const result = await DriveAPI.listDriveFiles(exibidora, pontoId, tipo, appData.databaseId);
        
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

                <div style="background: linear-gradient(135deg, #F1F5F9 0%, #E0E7FF 100%); padding: 20px; border-radius: 12px; border: 2px solid #06055B;">
                    <h3 style="color: #06055B; margin-bottom: 10px;">📋 Modo Campanha</h3>
                    <p style="color: #64748B; font-size: 14px;">Visualize todos os pontos de uma campanha:</p>
                    <code style="background: white; padding: 8px 12px; border-radius: 6px; display: block; margin-top: 10px;">
                        ?campanha=DATABASE_ID
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
 * 📥 BAIXAR TODOS OS ARQUIVOS (MODO CLIENTE)
 * ✅ CORREÇÃO: Download direto sem abrir abas (evita bloqueio de pop-ups)
 */
async function downloadAllFiles(pontoId, tipo) {
    try {
        Logger.info('Baixando todos os arquivos', { pontoId, tipo });

        // ✅ CORREÇÃO: Buscar ponto para obter exibidora correta
        const ponto = appData.pontos.find(p => p.id === pontoId);
        const exibidora = ponto?.exibidora || appData.exibidora;

        // Buscar arquivos
        const result = await DriveAPI.listDriveFiles(exibidora, pontoId, tipo, appData.databaseId);

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
                console.log(`📥 Download iniciado ${downloadCount}/${result.files.length}: ${file.name}`);
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
    pdfButton.onclick = generateCampanhaPDF;
    pdfButton.style.cssText = `
        padding: 12px 24px;
        font-size: 16px;
    `;

    buttonContainer.appendChild(pdfButton);
    headerContent.appendChild(buttonContainer);

    Logger.info('Botão PDF adicionado ao header');
}

/**
 * 📄 GERAR PDF DA CAMPANHA (V10)
 * Cria relatório PDF com todos os pontos e fotos
 */
async function generateCampanhaPDF() {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('Biblioteca jsPDF não carregada. Por favor, recarregue a página.');
            return;
        }

        Logger.info('Gerando PDF da campanha');
        showLoading();

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        let yPosition = 20;

        // Cabeçalho do relatório
        pdf.setFontSize(18);
        pdf.setFont(undefined, 'bold');
        pdf.text('Relatório de Campanha OOH', 105, yPosition, { align: 'center' });

        yPosition += 10;
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Total de pontos: ${appData.pontos.length}`, 105, yPosition, { align: 'center' });
        pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, yPosition + 6, { align: 'center' });

        yPosition += 20;

        // Processar cada ponto
        for (const ponto of appData.pontos) {
            // Verificar se precisa de nova página
            if (yPosition > 250) {
                pdf.addPage();
                yPosition = 20;
            }

            // Título do ponto
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            pdf.text(`${ponto.endereco}`, 20, yPosition);
            yPosition += 8;

            pdf.setFontSize(10);
            pdf.setFont(undefined, 'normal');
            pdf.text(`Exibidora: ${ponto.exibidora}`, 20, yPosition);
            yPosition += 10;

            // Buscar fotos de Entrada
            try {
                const resultEntrada = await DriveAPI.listDriveFiles(ponto.exibidora, ponto.id, 'entrada', appData.databaseId);
                if (resultEntrada.success && resultEntrada.files.length > 0) {
                    pdf.setFontSize(11);
                    pdf.setFont(undefined, 'bold');
                    pdf.text('📥 Entrada', 20, yPosition);
                    yPosition += 6;

                    for (const foto of resultEntrada.files.slice(0, 3)) { // Limitar a 3 fotos por tipo
                        if (yPosition > 240) {
                            pdf.addPage();
                            yPosition = 20;
                        }

                        // Bi-semana
                        if (foto.createdTime) {
                            const bisemana = calcularBisemana(foto.createdTime);
                            pdf.setFontSize(8);
                            pdf.setFont(undefined, 'normal');
                            pdf.text(bisemana, 25, yPosition);
                            yPosition += 6;
                        }

                        // Tentar adicionar imagem (com fallback)
                        try {
                            if (foto.url && !DriveAPI.isVideoFile(foto.mimeType)) {
                                pdf.text(`[Foto: ${foto.name}]`, 25, yPosition);
                                yPosition += 6;
                            }
                        } catch (imgError) {
                            pdf.text(`[Erro ao carregar: ${foto.name}]`, 25, yPosition);
                            yPosition += 6;
                        }
                    }

                    yPosition += 4;
                }
            } catch (error) {
                Logger.warning('Erro ao buscar fotos de entrada para PDF', error);
            }

            // Buscar fotos de Saída
            try {
                const resultSaida = await DriveAPI.listDriveFiles(ponto.exibidora, ponto.id, 'saida', appData.databaseId);
                if (resultSaida.success && resultSaida.files.length > 0) {
                    if (yPosition > 240) {
                        pdf.addPage();
                        yPosition = 20;
                    }

                    pdf.setFontSize(11);
                    pdf.setFont(undefined, 'bold');
                    pdf.text('📤 Saída', 20, yPosition);
                    yPosition += 6;

                    for (const foto of resultSaida.files.slice(0, 3)) {
                        if (yPosition > 240) {
                            pdf.addPage();
                            yPosition = 20;
                        }

                        // Bi-semana
                        if (foto.createdTime) {
                            const bisemana = calcularBisemana(foto.createdTime);
                            pdf.setFontSize(8);
                            pdf.setFont(undefined, 'normal');
                            pdf.text(bisemana, 25, yPosition);
                            yPosition += 6;
                        }

                        // Tentar adicionar nome do arquivo
                        try {
                            if (foto.url && !DriveAPI.isVideoFile(foto.mimeType)) {
                                pdf.text(`[Foto: ${foto.name}]`, 25, yPosition);
                                yPosition += 6;
                            }
                        } catch (imgError) {
                            pdf.text(`[Erro ao carregar: ${foto.name}]`, 25, yPosition);
                            yPosition += 6;
                        }
                    }

                    yPosition += 4;
                }
            } catch (error) {
                Logger.warning('Erro ao buscar fotos de saída para PDF', error);
            }

            yPosition += 8; // Espaço entre pontos
        }

        // Salvar PDF
        const fileName = `campanha-${appData.databaseId}-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        hideLoading();
        showSuccessMessage('📄 PDF gerado com sucesso!');
        Logger.success('PDF gerado', { fileName });

    } catch (error) {
        hideLoading();
        Logger.error('Erro ao gerar PDF', error);
        alert('Erro ao gerar PDF: ' + error.message);
    }
}

// 🚀 EXPORTAR FUNÇÕES GLOBAIS
window.togglePontoContent = togglePontoContent;
window.togglePontoLazy = togglePontoLazy;
window.toggleEditMode = toggleEditMode;
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
window.generateCampanhaPDF = generateCampanhaPDF; // ✅ V10: Gerador de PDF
window.calcularBisemana = calcularBisemana; // ✅ V10: Cálculo de bi-semana
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
