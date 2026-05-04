// =============================================================================
// 🔒 MÓDULO DE SEGURANÇA - CHECKING OOH
// =============================================================================
// Funções compartilhadas para garantir segurança em todos os endpoints

/**
 * 🛡️ CONFIGURAÇÃO DE CORS SEGURO
 * Lista branca de origens permitidas
 */
const ALLOWED_ORIGINS = [
    'https://checkingooh.pages.dev',
    'https://checking-ooh.pages.dev',
    // Adicione seus domínios customizados aqui:
    // 'https://seudominio.com',
];

// Permitir localhost apenas em desenvolvimento
const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
if (isDevelopment) {
    ALLOWED_ORIGINS.push('http://localhost:8788', 'http://127.0.0.1:8788');
}

/** Origens Cloudflare Pages (produção + preview com hash). */
const PAGES_PREVIEW_HOST = /^https:\/\/[a-z0-9-]+\.(checkingooh|checking-ooh)\.pages\.dev$/i;

/**
 * Indica se o browser pode chamar as APIs a partir desta origem.
 * Inclui subdomínios de preview do Pages (*.checkingooh.pages.dev).
 */
export function isOriginAllowed(origin) {
    if (!origin) return false;
    const o = origin.replace(/\/$/, '');
    if (ALLOWED_ORIGINS.some((allowed) => o === allowed || o.startsWith(`${allowed}/`))) {
        return true;
    }
    if (PAGES_PREVIEW_HOST.test(o)) return true;
    if (isDevelopment && (o.includes('localhost') || o.includes('127.0.0.1'))) return true;
    return false;
}

/**
 * 🛡️ OBTER HEADERS CORS SEGUROS
 * Valida origem e retorna headers apropriados
 */
export function getSecureCorsHeaders(request) {
    const origin = request.headers.get('Origin');

    const isAllowed = isOriginAllowed(origin);

    const headers = {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    if (isAllowed) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Access-Control-Max-Age'] = '86400';
    }

    return headers;
}

/**
 * 🧹 VALIDAR E SANITIZAR PARÂMETROS
 * Valida formato e remove caracteres perigosos
 */
export function validateAndSanitize(param, type = 'string', maxLength = 255) {
    if (!param || param === 'null' || param === 'undefined') {
        return null;
    }

    // Converter para string e remover espaços
    let sanitized = String(param).trim();

    // Verificar comprimento
    if (sanitized.length > maxLength) {
        throw new Error(`Parâmetro muito longo (máx: ${maxLength} caracteres)`);
    }

    switch (type) {
        case 'notionId':
            // IDs do Notion: 32 caracteres hexadecimais (com ou sem hífens)
            if (!/^[a-f0-9]{32}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sanitized)) {
                throw new Error('Formato de ID inválido');
            }
            break;

        case 'filename':
            // Permitir apenas caracteres seguros em nomes de arquivo
            if (!/^[a-zA-Z0-9\s._-]+$/.test(sanitized)) {
                throw new Error('Nome de arquivo contém caracteres inválidos');
            }
            // Prevenir path traversal
            if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
                throw new Error('Nome de arquivo inválido');
            }
            break;

        case 'foldername':
            // Nomes de pasta: alfanuméricos (incluindo acentos), espaços, hífens e underscores
            // \p{L} = qualquer letra Unicode (incluindo acentuação)
            // \p{N} = qualquer número Unicode
            if (!/^[\p{L}\p{N}\s_-]+$/u.test(sanitized)) {
                throw new Error('Nome contém caracteres inválidos');
            }
            // Prevenir path traversal
            if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
                throw new Error('Nome inválido');
            }
            break;

        case 'tipo':
            // Tipo deve ser apenas 'entrada' ou 'saida'
            if (!['entrada', 'saida', 'Entrada', 'Saida'].includes(sanitized)) {
                throw new Error('Tipo inválido');
            }
            sanitized = sanitized.toLowerCase();
            break;

        case 'string':
        default:
            // Remover caracteres potencialmente perigosos
            sanitized = sanitized.replace(/[<>\"'`]/g, '');
            break;
    }

    return sanitized;
}

/**
 * 📝 LOG SEGURO
 * Loga informações sem expor dados sensíveis
 */
export function secureLog(level, message, data = null) {
    if (!isDevelopment && level === 'info') {
        return;
    }
    const timestamp = new Date().toISOString();
    const prefix = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    }[level] || 'ℹ️';

    if (data && !isDevelopment) {
        data = maskSensitiveData(data);
    }

    const sink = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    sink(`${prefix} [${timestamp}] ${message}`, data || '');
}

/**
 * 🎭 MASCARAR DADOS SENSÍVEIS
 * Remove/mascara informações sensíveis antes de logar
 */
function maskSensitiveData(data) {
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    const masked = { ...data };
    const sensitiveKeys = ['token', 'key', 'password', 'secret', 'authorization', 'email'];

    Object.keys(masked).forEach(key => {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            masked[key] = '[REDACTED]';
        } else if (typeof masked[key] === 'object') {
            masked[key] = maskSensitiveData(masked[key]);
        }
    });

    return masked;
}

/**
 * ❌ RESPOSTA DE ERRO SEGURA
 * Retorna erro sem expor detalhes internos em produção
 */
export function secureErrorResponse(error, status = 500, headers = {}) {
    const errorMessage = isDevelopment
        ? {
            error: 'Erro no servidor',
            message: error.message,
            stack: error.stack
          }
        : {
            error: 'Erro no servidor',
            message: 'Ocorreu um erro ao processar sua solicitação.'
          };

    secureLog('error', 'Erro capturado', errorMessage);

    return new Response(JSON.stringify(errorMessage), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });
}

/**
 * 🔐 VALIDAR TAMANHO DE ARQUIVO
 * Valida se o arquivo está dentro dos limites
 */
export function validateFileSize(file, maxSizeMB = 100) {
    const maxBytes = maxSizeMB * 1024 * 1024;

    if (!file) {
        throw new Error('Nenhum arquivo fornecido');
    }

    if (file.size > maxBytes) {
        throw new Error(`Arquivo muito grande (máx: ${maxSizeMB}MB)`);
    }

    if (file.size === 0) {
        throw new Error('Arquivo vazio');
    }

    return true;
}

/**
 * 🔍 VALIDAR TIPO DE ARQUIVO
 * Valida MIME type do arquivo
 */
export function validateFileType(file) {
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
    ];

    if (!file || !file.type) {
        throw new Error('Tipo de arquivo não especificado');
    }

    if (!allowedTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido');
    }

    return true;
}

/**
 * ✅ VALIDAÇÃO COMPLETA DE UPLOAD
 * Valida todos os aspectos de um upload
 */
export function validateUploadRequest(formData) {
    const file = formData.get('file');
    const exibidora = formData.get('exibidora');
    const pontoId = formData.get('pontoId');
    const tipo = formData.get('tipo');
    const databaseId = formData.get('databaseId');

    // Validar arquivo
    validateFileSize(file);
    validateFileType(file);

    // Validar e sanitizar parâmetros
    const validated = {
        file,
        exibidora: validateAndSanitize(exibidora, 'foldername', 100),
        pontoId: validateAndSanitize(pontoId, 'notionId', 40),
        tipo: validateAndSanitize(tipo, 'tipo', 10),
        databaseId: validateAndSanitize(databaseId, 'notionId', 40)
    };

    // Verificar se todos os campos obrigatórios estão presentes
    if (!validated.exibidora || !validated.pontoId || !validated.tipo || !validated.databaseId) {
        throw new Error('Campos obrigatórios ausentes');
    }

    return validated;
}

/**
 * 🛡️ RATE LIMITING SIMPLES
 * Previne abuso de API (usando Maps em memória)
 */
const rateLimitMap = new Map();

export function checkRateLimit(identifier, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const key = identifier;

    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    const record = rateLimitMap.get(key);

    // Reset se a janela expirou
    if (now > record.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    // Incrementar contador
    record.count++;

    if (record.count > maxRequests) {
        return false;
    }

    return true;
}

if (isDevelopment) {
    secureLog('info', 'Módulo de segurança carregado', { isDevelopment });
}
