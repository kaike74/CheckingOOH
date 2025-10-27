// =============================================================================
// ⚙️ CONFIGURAÇÕES DO SISTEMA CHECKING OOH
// =============================================================================

/**
 * 🔧 VARIÁVEIS DE CONFIGURAÇÃO
 * 
 * IMPORTANTE: Configure as variáveis de ambiente no Cloudflare Pages:
 * - NOTION_TOKEN
 * - GOOGLE_SERVICE_ACCOUNT_KEY (recomendado) ou GOOGLE_DRIVE_API_KEY
 * - GOOGLE_DRIVE_FOLDER_ID (opcional, padrão é 'root')
 */

const CONFIG = {
    // 🚀 MODO DE PRODUÇÃO
    PRODUCTION_MODE: true, // true = logs mínimos, false = logs completos

    // 🗄️ CONFIGURAÇÕES INTERNAS
    INTERNAL: {
        FIELDS: {
            EXIBIDORA: 'Exibidora',
            ENDERECO: 'Endereço',
            URL_EXIBIDORA: 'URL Exibidora',
            URL_CLIENTE: 'URL Cliente'
        }
    },

    // 📂 CONFIGURAÇÕES DE UPLOAD
    UPLOAD: {
        ALLOWED_TYPES: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/mov',
            'video/avi',
            'video/quicktime'
        ],

        // Tamanho máximo por arquivo (em bytes)
        MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB

        // Máximo de arquivos por upload
        MAX_FILES_PER_UPLOAD: 5
    },

    // 🧪 MODO DEMONSTRAÇÃO
    DEMO: {
        // true = usar dados fictícios, false = usar APIs reais
        ENABLED: false,

        // Dados fictícios para demonstração
        SAMPLE_DATA: [
            {
                id: '12345678901234567890123456789012',
                exibidora: 'Exibidora Central',
                endereco: 'Av. Paulista, 1000 - São Paulo, SP'
            },
            {
                id: '12345678901234567890123456789013',
                exibidora: 'Exibidora Central', 
                endereco: 'Rua Augusta, 500 - São Paulo, SP'
            },
            {
                id: '12345678901234567890123456789014',
                exibidora: 'Exibidora Norte',
                endereco: 'Av. Faria Lima, 2000 - São Paulo, SP'
            }
        ],
        
        // Imagens de exemplo para demonstração
        SAMPLE_IMAGES: [
            'https://picsum.photos/300/300?random=1',
            'https://picsum.photos/300/300?random=2',
            'https://picsum.photos/300/300?random=3'
        ]
    },
    
    // 🎨 CONFIGURAÇÕES DE INTERFACE
    UI: {
        // Animações
        ANIMATION_DURATION: 300,

        // Mensagens
        MESSAGES: {
            LOADING: 'Carregando dados...',
            ERROR_CONNECTION: 'Erro ao conectar com o servidor',
            ERROR_DATA: 'Erro ao carregar dados',
            SUCCESS_UPLOAD: 'Arquivo(s) enviado(s) com sucesso!',
            ERROR_UPLOAD: 'Erro ao enviar arquivo(s)',
            CONFIRM_DELETE: 'Tem certeza que deseja excluir este arquivo?'
        }
    },
    
    // 📱 CONFIGURAÇÕES DA CÂMERA
    CAMERA: {
        // Configurações de vídeo
        VIDEO_CONSTRAINTS: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment' // Câmera traseira por padrão
        },
        
        // Qualidade da foto capturada (0.1 - 1.0)
        PHOTO_QUALITY: 0.8,
        
        // Formato da foto
        PHOTO_FORMAT: 'image/jpeg'
    }
};

/**
 * 🔍 DETECTAR MODO DE OPERAÇÃO
 * Determina se deve usar modo exibidora ou cliente baseado na URL
 */
function getOperationMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const pontoId = urlParams.get('id');
    const clienteId = urlParams.get('idcliente');
    
    if (clienteId) {
        return {
            mode: 'cliente',
            id: clienteId,
            readonly: true
        };
    } else if (pontoId) {
        return {
            mode: 'exibidora', 
            id: pontoId,
            readonly: false
        };
    } else {
        return {
            mode: 'error',
            id: null,
            readonly: true
        };
    }
}

/**
 * 🔧 VALIDAR CONFIGURAÇÕES
 * Verifica se as configurações necessárias estão preenchidas
 */
function validateConfig() {
    const errors = [];
    
    if (!CONFIG.DEMO.ENABLED) {
        // Em produção, as variáveis de ambiente são verificadas no backend
        // Aqui apenas validamos configurações locais
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * 🎯 OBTER URL DA API
 * Retorna a URL base para as chamadas de API
 */
function getApiBaseUrl() {
    // Em produção no Cloudflare Pages
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return '';
    }
    
    // Em desenvolvimento local
    return 'http://localhost:8788';
}

/**
 * 📝 LOG DE DEBUG
 * Sistema de log que respeita o modo de produção
 */
const Logger = {
    info: (message, data = null) => {
        if (!CONFIG.PRODUCTION_MODE) {
            console.log(`ℹ️ [CheckingOOH] ${message}`, data || '');
        }
    },

    success: (message, data = null) => {
        if (!CONFIG.PRODUCTION_MODE) {
            console.log(`✅ [CheckingOOH] ${message}`, data || '');
        }
    },

    warning: (message, data = null) => {
        // Warnings sempre aparecem, mesmo em produção
        console.warn(`⚠️ [CheckingOOH] ${message}`, data || '');
    },

    error: (message, error = null) => {
        // Erros sempre aparecem, mesmo em produção
        console.error(`❌ [CheckingOOH] ${message}`, error || '');
    },

    debug: (message, data = null) => {
        if (!CONFIG.PRODUCTION_MODE && CONFIG.DEMO.ENABLED) {
            console.log(`🐛 [CheckingOOH Debug] ${message}`, data || '');
        }
    }
};

// 🚀 EXPORTAR CONFIGURAÇÕES
window.CONFIG = CONFIG;
window.getOperationMode = getOperationMode;
window.validateConfig = validateConfig; 
window.getApiBaseUrl = getApiBaseUrl;
window.Logger = Logger;

if (!CONFIG.PRODUCTION_MODE) {
    Logger.info('Configurações carregadas', { demo: CONFIG.DEMO.ENABLED, production: CONFIG.PRODUCTION_MODE });
}
