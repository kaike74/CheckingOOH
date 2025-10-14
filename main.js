/* ============================================
   CHECKING OOH - JAVASCRIPT PRINCIPAL
   ============================================ */

// ==========================================
// CONFIGURAÇÕES GLOBAIS
// ==========================================
const CONFIG = {
    // Modo Demo: true = usa dados mockados, false = usa APIs reais
    DEMO_MODE: true,
    
    // URL da API do Cloudflare Workers
    API_URL: 'https://seu-worker.seu-subdominio.workers.dev',
    
    // Configurações do Notion (preenchidas no notion-api.js)
    NOTION_TOKEN: '',
    NOTION_DATABASE_ID: '',
    
    // Configurações do Google Drive (preenchidas no drive-api.js)
    DRIVE_CLIENT_ID: '',
    DRIVE_API_KEY: '',
    DRIVE_FOLDER_ID: '',
};

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
let currentPoint = null;
let currentAction = null;
let userType = 'exhibitor'; // 'exhibitor' ou 'client'
let cameraStream = null;
let allPoints = [];

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Checking OOH iniciado');
    initializeApp();
});

async function initializeApp() {
    try {
        // Obter parâmetros da URL
        const urlParams = new URLSearchParams(window.location.search);
        const pointId = urlParams.get('id');
        const clientId = urlParams.get('idcliente');
        
        // Determinar tipo de usuário
        if (clientId) {
            userType = 'client';
            document.getElementById('user-type-badge').textContent = '👤 Visualização Cliente';
            document.getElementById('user-type-badge').style.background = 'var(--success-green)';
        } else {
            userType = 'exhibitor';
            document.getElementById('user-type-badge').textContent = '🏢 Exibidora';
        }
        
        // Carregar dados
        if (CONFIG.DEMO_MODE) {
            console.log('📝 Modo Demo ativado - carregando dados mockados');
            await loadDemoData(pointId || clientId);
        } else {
            console.log('🌐 Carregando dados da API');
            await loadRealData(pointId || clientId);
        }
        
        // Ocultar loading e mostrar conteúdo
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao inicializar app:', error);
        showError('Erro ao carregar dados. Por favor, recarregue a página.');
    }
}

// ==========================================
// DADOS DEMO (MOCKADOS)
// ==========================================
async function loadDemoData(pointId) {
    // Simular delay de carregamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dados mockados
    const demoData = {
        exhibitor: 'Outdoor Plus',
        campaign: 'Campanha Verão 2025',
        points: [
            {
                id: 'ponto-001',
                name: 'Ponto 001 - Av. Paulista',
                address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
                type: 'Outdoor',
                size: '9x3m',
                files: {
                    entrada: [
                        { type: 'image', url: 'https://picsum.photos/400/300?random=1', name: 'foto1.jpg' },
                        { type: 'image', url: 'https://picsum.photos/400/300?random=2', name: 'foto2.jpg' }
                    ],
                    saida: [
                        { type: 'image', url: 'https://picsum.photos/400/300?random=3', name: 'foto3.jpg' }
                    ]
                }
            },
            {
                id: 'ponto-002',
                name: 'Ponto 002 - Av. Faria Lima',
                address: 'Av. Brigadeiro Faria Lima, 2000 - Jardim Paulistano, São Paulo - SP',
                type: 'Busdoor',
                size: 'Padrão',
                files: {
                    entrada: [
                        { type: 'video', url: 'https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4', name: 'video1.mp4' }
                    ],
                    saida: []
                }
            },
            {
                id: 'ponto-003',
                name: 'Ponto 003 - Shopping Center',
                address: 'Shopping Iguatemi, Piso 2 - São Paulo - SP',
                type: 'Mídia Indoor',
                size: '2x2m',
                files: {
                    entrada: [],
                    saida: []
                }
            }
        ]
    };
    
    // Preencher informações da exibidora
    document.getElementById('exhibitor-name').textContent = demoData.exhibitor;
    document.getElementById('campaign-name').textContent = demoData.campaign;
    
    // Filtrar pontos se for cliente específico
    if (userType === 'client' && pointId) {
        allPoints = demoData.points.filter(p => p.id === pointId);
    } else {
        allPoints = demoData.points;
    }
    
    // Renderizar pontos
    renderPoints(allPoints);
}

// ==========================================
// DADOS REAIS (API)
// ==========================================
async function loadRealData(pointId) {
    try {
        // Aqui você faria a chamada real para a API do Notion
        const data = await fetchNotionData(pointId);
        
        // Preencher informações
        document.getElementById('exhibitor-name').textContent = data.exhibitor;
        document.getElementById('campaign-name').textContent = data.campaign;
        
        // Filtrar pontos se necessário
        if (userType === 'client' && pointId) {
            allPoints = data.points.filter(p => p.id === pointId);
        } else {
            allPoints = data.points;
        }
        
        // Carregar arquivos do Drive para cada ponto
        for (let point of allPoints) {
            point.files = await fetchDriveFiles(point.id);
        }
        
        // Renderizar pontos
        renderPoints(allPoints);
        
    } catch (error) {
        console.error('Erro ao carregar dados reais:', error);
        throw error;
    }
}

// ==========================================
// RENDERIZAÇÃO DE PONTOS
// ==========================================
function renderPoints(points) {
    const pointsSection = document.getElementById('points-section');
    pointsSection.innerHTML = '';
    
    points.forEach(point => {
        const pointCard = createPointCard(point);
        pointsSection.appendChild(pointCard);
    });
}

function createPointCard(point) {
    const card = document.createElement('div');
    card.className = 'point-card';
    card.dataset.pointId = point.id;
    
    // Contar arquivos
    const entradaCount = point.files.entrada?.length || 0;
    const saidaCount = point.files.saida?.length || 0;
    
    card.innerHTML = `
        <div class="point-header">
            <h3>${point.name}</h3>
            <p>${point.address}</p>
        </div>
        
        <div class="point-body">
            <!-- Coluna de Informações -->
            <div class="point-info">
                <div class="point-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                    </svg>
                    <div>
                        <strong>Tipo de Mídia</strong>
                        <span>${point.type}</span>
                    </div>
                </div>
                
                <div class="point-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <div>
                        <strong>Endereço</strong>
                        <span>${point.address}</span>
                    </div>
                </div>
                
                <div class="point-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    <div>
                        <strong>Tamanho</strong>
                        <span>${point.size}</span>
                    </div>
                </div>
            </div>
            
            <!-- Coluna de Ações -->
            <div class="point-actions">
                ${createActionBlock('entrada', 'Entrada', entradaCount, point.id, userType)}
                ${createActionBlock('saida', 'Saída', saidaCount, point.id, userType)}
            </div>
        </div>
    `;
    
    return card;
}

function createActionBlock(type, label, fileCount, pointId, userType) {
    const typeClass = type === 'entrada' ? 'entrada' : 'saida';
    const isExhibitor = userType === 'exhibitor';
    
    return `
        <div class="action-block ${typeClass}">
            <div class="action-header" onclick="toggleActionBlock(this)">
                <div class="action-title">
                    <span class="action-badge ${typeClass}">${label}</span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">${fileCount} arquivo(s)</span>
                </div>
                <svg class="expand-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            
            <div class="action-content">
                <div class="action-buttons">
                    ${isExhibitor ? `
                        <button class="btn btn-primary" onclick="openCamera('${pointId}', '${type}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                            Tirar Foto
                        </button>
                        
                        <button class="btn btn-secondary" onclick="openUploadModal('${pointId}', '${type}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Fazer Upload
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-outline" onclick="viewFiles('${pointId}', '${type}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Ver Arquivos
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// FUNÇÕES DE INTERAÇÃO
// ==========================================

// Toggle dos blocos de ação
function toggleActionBlock(header) {
    const content = header.nextElementSibling;
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
        content.classList.remove('collapsed');
        header.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
        header.classList.add('collapsed');
    }
}

// Abrir modal de upload
function openUploadModal(pointId, actionType) {
    currentPoint = pointId;
    currentAction = actionType;
    
    const modal = document.getElementById('upload-modal');
    const modalTitle = document.getElementById('modal-title');
    modalTitle.textContent = `Upload - ${actionType === 'entrada' ? 'Entrada' : 'Saída'}`;
    
    modal.classList.add('active');
    
    // Reset do input
    document.getElementById('file-input').value = '';
    document.getElementById('upload-progress').style.display = 'none';
}

function closeUploadModal() {
    document.getElementById('upload-modal').classList.remove('active');
    currentPoint = null;
    currentAction = null;
}

// Upload de arquivos
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    
    // Click para selecionar arquivos
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-magenta)';
        uploadArea.style.background = 'var(--bg-light)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
        
        const files = e.dataTransfer.files;
        handleFileUpload(files);
    });
    
    // Mudança no input
    fileInput.addEventListener('change', (e) => {
        handleFileUpload(e.target.files);
    });
});

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    
    console.log(`📤 Enviando ${files.length} arquivo(s)...`);
    
    // Mostrar progresso
    document.getElementById('upload-progress').style.display = 'block';
    const progressFill = document.getElementById('progress-fill');
    const uploadStatus = document.getElementById('upload-status');
    
    try {
        if (CONFIG.DEMO_MODE) {
            // Simular upload
            for (let i = 0; i < files.length; i++) {
                const progress = ((i + 1) / files.length) * 100;
                progressFill.style.width = `${progress}%`;
                uploadStatus.textContent = `Enviando arquivo ${i + 1} de ${files.length}...`;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            showSuccess('Arquivos enviados com sucesso!');
            closeUploadModal();
            
            // Atualizar contadores (em modo demo, apenas simula)
            const point = allPoints.find(p => p.id === currentPoint);
            if (point && point.files[currentAction]) {
                // Adicionar arquivos mockados
                for (let file of files) {
                    const fileType = file.type.startsWith('video/') ? 'video' : 'image';
                    point.files[currentAction].push({
                        type: fileType,
                        url: fileType === 'image' ? `https://picsum.photos/400/300?random=${Date.now()}` : 'https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4',
                        name: file.name
                    });
                }
                // Re-renderizar o ponto
                renderPoints(allPoints);
            }
            
        } else {
            // Upload real via API
            const formData = new FormData();
            for (let file of files) {
                formData.append('files', file);
            }
            formData.append('pointId', currentPoint);
            formData.append('actionType', currentAction);
            
            const response = await fetch(`${CONFIG.API_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Erro no upload');
            
            const result = await response.json();
            showSuccess('Arquivos enviados com sucesso!');
            closeUploadModal();
            
            // Atualizar lista de arquivos
            await loadRealData(currentPoint);
        }
        
    } catch (error) {
        console.error('Erro no upload:', error);
        showError('Erro ao enviar arquivos. Tente novamente.');
    }
}

// Visualizar arquivos
function viewFiles(pointId, actionType) {
    const point = allPoints.find(p => p.id === pointId);
    if (!point) return;
    
    const files = point.files[actionType] || [];
    
    const modal = document.getElementById('view-modal');
    const modalTitle = document.getElementById('view-modal-title');
    const mediaGrid = document.getElementById('media-grid');
    
    modalTitle.textContent = `${point.name} - ${actionType === 'entrada' ? 'Entrada' : 'Saída'} (${files.length})`;
    
    // Limpar grid
    mediaGrid.innerHTML = '';
    
    if (files.length === 0) {
        mediaGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">Nenhum arquivo encontrado</p>';
    } else {
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'media-item';
            
            if (file.type === 'image') {
                item.innerHTML = `<img src="${file.url}" alt="${file.name}" loading="lazy">`;
            } else {
                item.innerHTML = `
                    <video src="${file.url}" controls></video>
                    <div class="play-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </div>
                `;
            }
            
            mediaGrid.appendChild(item);
        });
    }
    
    modal.classList.add('active');
}

function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

// ==========================================
// CÂMERA
// ==========================================
async function openCamera(pointId, actionType) {
    currentPoint = pointId;
    currentAction = actionType;
    
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');
    
    try {
        // Solicitar acesso à câmera
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' },
            audio: false 
        });
        
        video.srcObject = cameraStream;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Erro ao acessar câmera:', error);
        showError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
}

function closeCameraModal() {
    const modal = document.getElementById('camera-modal');
    modal.classList.remove('active');
    
    // Parar stream da câmera
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

async function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');
    
    // Definir tamanho do canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Capturar frame do vídeo
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Converter para blob
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Fechar modal da câmera
        closeCameraModal();
        
        // Fazer upload da foto
        await handleFileUpload([file]);
        
    }, 'image/jpeg', 0.9);
}

// ==========================================
// NOTIFICAÇÕES
// ==========================================
function showSuccess(message) {
    const toast = document.getElementById('success-toast');
    const messageEl = document.getElementById('success-message');
    
    messageEl.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showError(message) {
    const toast = document.getElementById('error-toast');
    const messageEl = document.getElementById('error-message');
    
    messageEl.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// ==========================================
// FECHAR MODAIS AO CLICAR FORA
// ==========================================
window.addEventListener('click', (e) => {
    const uploadModal = document.getElementById('upload-modal');
    const viewModal = document.getElementById('view-modal');
    const cameraModal = document.getElementById('camera-modal');
    
    if (e.target === uploadModal) closeUploadModal();
    if (e.target === viewModal) closeViewModal();
    if (e.target === cameraModal) closeCameraModal();
});

console.log('✅ Main.js carregado com sucesso');
