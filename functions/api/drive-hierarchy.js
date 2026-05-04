// =============================================================================
// 📁 DRIVE HIERARCHY MANAGER - CHECKING OOH
// =============================================================================
// Módulo compartilhado para gerenciar a hierarquia de pastas no Google Drive
// Previne duplicações e garante consistência entre upload e listagem
// =============================================================================

// 🔒 MUTEX GLOBAL PARA PREVENIR DUPLICAÇÃO DE PASTAS EM PARALELO
// Armazena promessas de criação de pastas em andamento
const folderCreationLocks = new Map();

// 📊 ESTATÍSTICAS DE OPERAÇÕES (opcional, para debug)
const stats = {
    cacheHits: 0,
    cacheMisses: 0,
    locksAvoided: 0
};

// =============================================================================
// 🏗️ FUNÇÃO PRINCIPAL: GARANTIR HIERARQUIA COMPLETA
// =============================================================================
/**
 * Garante que toda a hierarquia de pastas existe no Drive
 * Hierarquia: CheckingOOH > Exibidora > Campanha (databaseId) > Ponto > Tipo
 *
 * @param {string} exibidora - Nome da exibidora
 * @param {string} databaseId - ID do database do Notion (usado como nome da campanha)
 * @param {string} pontoId - ID do ponto
 * @param {string} tipo - 'entrada' ou 'saida'
 * @param {string} accessToken - Token de acesso do Google Drive
 * @param {object} [options] - Opcional: { checkingOohFolderId, sharedDriveId } (env Cloudflare)
 * @returns {Promise<{id: string, path: string}>} - ID e caminho da pasta final
 */
export async function ensureFolderHierarchy(exibidora, databaseId, pontoId, tipo, accessToken, options = {}) {
    try {
        const normalizedDatabaseId = normalizeNotionId(databaseId);
        const normalizedPontoId = normalizeNotionId(pontoId);

        const checkingFolder = await resolveCheckingOOHRootFolder(accessToken, exibidora, options);

        if (!checkingFolder) {
            throw new Error(
                '❌ Pasta CheckingOOH não encontrada pela API. ' +
                    'Em Shared Drives, só partilhar a pasta com o e-mail da service account muitas vezes NÃO basta: ' +
                    'adicione a conta de serviço como membro do Drive partilhado "REDE COMPARTILHADA E-RÁDIOS" (ou equivalente), ' +
                    'OU defina no Cloudflare a variável GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID com o ID da pasta CheckingOOH (trecho da URL após /folders/), ' +
                    'OU GOOGLE_DRIVE_SHARED_DRIVE_ID com o ID do drive partilhado (URL …/drive/folders/DRIVE_ID na raiz do drive).'
            );
        }

        const basePath = 'CheckingOOH';

        const exibidoraFolder = await findOrCreateFolderWithLock(
            exibidora,
            checkingFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        const campanhaFolder = await findOrCreateFolderWithLock(
            normalizedDatabaseId,
            exibidoraFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        const pontoFolder = await findOrCreateFolderWithLock(
            normalizedPontoId,
            campanhaFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        const tipoFolder = await findOrCreateFolderWithLock(
            tipoFolderName,
            pontoFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        const fullPath = `${basePath}/${exibidora}/${normalizedDatabaseId}/${normalizedPontoId}/${tipoFolderName}`;

        // Para files.list em Shared Drives, corpora=drive exige driveId; a pasta raiz
        // "CheckingOOH" às vezes vem sem driveId na busca, mas as pastas filhas sim.
        const sharedDriveIdForList =
            tipoFolder.driveId ||
            pontoFolder.driveId ||
            campanhaFolder.driveId ||
            exibidoraFolder.driveId ||
            checkingFolder.driveId ||
            null;

        return {
            id: tipoFolder.id,
            path: fullPath,
            normalizedDatabaseId: normalizedDatabaseId, // ✅ Retornar IDs normalizados
            normalizedPontoId: normalizedPontoId, // ✅ Retornar IDs normalizados
            sharedDriveIdForList,
            folders: {
                checking: checkingFolder,
                exibidora: exibidoraFolder,
                campanha: campanhaFolder,
                ponto: pontoFolder,
                tipo: tipoFolder
            }
        };

    } catch (error) {
        console.error('ensureFolderHierarchy', error?.message || error);
        throw error;
    }
}

// =============================================================================
// 🔒 FIND OR CREATE COM MUTEX (PREVINE DUPLICAÇÕES PARALELAS)
// =============================================================================
/**
 * Busca ou cria uma pasta com proteção contra duplicação paralela
 * Se múltiplas requisições tentarem criar a mesma pasta simultaneamente,
 * apenas uma criará e as outras aguardarão e reutilizarão o resultado
 *
 * @param {string} folderName - Nome da pasta
 * @param {string} parentId - ID da pasta pai
 * @param {string} accessToken - Token de acesso
 * @param {string} driveId - ID do Shared Drive (opcional)
 * @returns {Promise<{id: string, name: string}>} - Pasta encontrada ou criada
 */
async function findOrCreateFolderWithLock(folderName, parentId, accessToken, driveId = null) {
    const lockKey = `${parentId}/${folderName}`;

    // Se já há uma operação em andamento para esta pasta, aguardar
    if (folderCreationLocks.has(lockKey)) {
        stats.locksAvoided++;
        return await folderCreationLocks.get(lockKey);
    }

    // Criar nova promessa de criação e armazená-la no lock
    const creationPromise = findOrCreateFolderInternal(folderName, parentId, accessToken, driveId);
    folderCreationLocks.set(lockKey, creationPromise);

    try {
        const result = await creationPromise;
        return result;
    } finally {
        // Remover lock após conclusão
        folderCreationLocks.delete(lockKey);
    }
}

// =============================================================================
// 📁 FIND OR CREATE INTERNAL (LÓGICA REAL)
// =============================================================================
/**
 * Busca ou cria uma pasta (função interna)
 * Esta função contém a lógica real de busca e criação
 */
async function findOrCreateFolderInternal(folderName, parentId, accessToken, driveId = null) {
    try {
        // BUSCAR PASTA EXISTENTE
        const escapedFolderName = folderName.replace(/'/g, "\\'");
        const query = `name='${escapedFolderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,driveId)`;

        const searchResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (searchResponse.ok) {
            const searchResult = await searchResponse.json();

            if (searchResult.files && searchResult.files.length > 0) {
                if (searchResult.files.length > 1) {
                    console.warn(`drive-hierarchy: ${searchResult.files.length} pastas duplicadas "${folderName}", usando a primeira`);
                }
                stats.cacheHits++;
                return searchResult.files[0];
            }
        }

        stats.cacheMisses++;

        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };

        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Erro ao criar pasta "${folderName}": ${createResponse.status} - ${errorText}`);
        }

        const newFolder = await createResponse.json();
        return newFolder;

    } catch (error) {
        console.error('findOrCreateFolderInternal', folderName, error?.message || error);
        throw error;
    }
}

// =============================================================================
// 🌐 METADATA + BUSCA CheckingOOH (Shared Drive / env / desambiguação)
// =============================================================================

/** 403 com mensagem típica quando a API não foi ativada no projeto GCP. */
function isGoogleDriveApiDisabledInProject(detail) {
    const d = String(detail || '');
    return (
        /Google Drive API has not been used in project/i.test(d) ||
        (/Google Drive API/i.test(d) && /is disabled/i.test(d) && /Enable it/i.test(d))
    );
}

/** Normaliza ID colado no Cloudflare (URL completa, aspas, espaços). */
function sanitizeDriveFileId(raw) {
    if (raw == null) return '';
    let s = String(raw).trim();
    if (!s) return '';
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    const fromUrl = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (fromUrl) return fromUrl[1];
    return s.replace(/\s+/g, '');
}

/**
 * @returns {Promise<{ ok: true, id: string, name?: string, mimeType: string, driveId?: string|null } | { ok: false, status: number, detail: string }>}
 */
async function getDriveFileMetadata(fileId, accessToken) {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,driveId&supportsAllDrives=true`;
    const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) {
        const t = await r.text();
        console.error('files.get', String(fileId).slice(0, 12), r.status);
        return { ok: false, status: r.status, detail: t.slice(0, 400) };
    }
    const meta = await r.json();
    return { ok: true, ...meta };
}

/** Lista pastas com nome exato CheckingOOH; opcionalmente só dentro de um Shared Drive. */
async function fetchCheckingOOHCandidates(accessToken, sharedDriveId = null) {
    const escapedRoot = 'CheckingOOH'.replace(/'/g, "\\'");
    const query = `name='${escapedRoot}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    let url =
        'https://www.googleapis.com/drive/v3/files' +
        `?q=${encodeURIComponent(query)}` +
        '&supportsAllDrives=true&includeItemsFromAllDrives=true' +
        '&fields=files(id,name,driveId)&pageSize=100';
    if (sharedDriveId) {
        url += `&corpora=drive&driveId=${encodeURIComponent(sharedDriveId)}`;
    } else {
        url += '&corpora=allDrives';
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const t = await response.text();
        console.error('fetchCheckingOOHCandidates', response.status, (sharedDriveId || 'allDrives').toString().slice(0, 24));
        return [];
    }

    const result = await response.json();
    return result.files || [];
}

/**
 * Vários "CheckingOOH": preferir o que já contém a subpasta da exibidora.
 */
async function pickCheckingOOHFromCandidates(candidates, exibidoraName, accessToken) {
    if (!candidates.length) {
        return null;
    }

    if (candidates.length === 1) {
        return candidates[0];
    }

    console.warn(
        `CheckingOOH: ${candidates.length} candidatos, desambiguar por exibidora "${exibidoraName}"`
    );

    const escapedEx = String(exibidoraName || '').replace(/'/g, "\\'");

    for (const root of candidates) {
        const q2 = `name='${escapedEx}' and '${root.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const url2 = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q2)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)&pageSize=5`;
        const r2 = await fetch(url2, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!r2.ok) {
            continue;
        }
        const j2 = await r2.json();
        if (j2.files && j2.files.length > 0) {
            return root;
        }
    }

    const onSharedDrive = candidates.filter((f) => f.driveId);
    if (onSharedDrive.length === 1) {
        return onSharedDrive[0];
    }

    const shared = candidates.find((f) => f.driveId);
    console.warn('CheckingOOH: fallback para primeiro candidato em Shared Drive');
    return shared || candidates[0];
}

/**
 * options.checkingOohFolderId — ID da pasta CheckingOOH (evita pesquisa; resolve permissões só-partilha).
 * options.sharedDriveId — se definido (sem ID fixo da pasta), pesquisa "CheckingOOH"
 *   primeiro neste Shared Drive; só se vazio usa corpora=allDrives.
 */
async function resolveCheckingOOHRootFolder(accessToken, exibidoraName, options = {}) {
    const sd = sanitizeDriveFileId(options.sharedDriveId || '');
    const explicit = sanitizeDriveFileId(options.checkingOohFolderId || '');

    if (explicit) {
        const meta = await getDriveFileMetadata(explicit, accessToken);
        if (meta.ok) {
            if (meta.mimeType !== 'application/vnd.google-apps.folder') {
                throw new Error(
                    `GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID não é uma pasta (mime=${meta.mimeType}).`
                );
            }
            return { id: meta.id, name: meta.name || 'CheckingOOH', driveId: meta.driveId || null };
        }

        if (meta.status === 403) {
            if (isGoogleDriveApiDisabledInProject(meta.detail)) {
                throw new Error(
                    'Google Drive API não está ativada no projeto Google Cloud da sua service account (erro 403 do Google). ' +
                        'No console: APIs e serviços → Biblioteca → pesquise "Google Drive API" → Ativar. ' +
                        'Use o mesmo projeto do campo project_id no JSON (GOOGLE_SERVICE_ACCOUNT_KEY). Aguarde 1–2 minutos e teste de novo.'
                );
            }
            throw new Error(
                'GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID: Google devolveu 403 (sem permissão na pasta ou no drive). ' +
                    'No Google Drive: drive partilhado → Gerir membros → adicione o client_email do JSON com função Conteúdo (ou partilhe a pasta CheckingOOH com esse e-mail). ' +
                    `Resposta: ${meta.detail.slice(0, 220)}`
            );
        }

        if (meta.status === 404 && sd) {
            /* fallback: descoberta por nome no shared drive */
        } else if (!meta.ok) {
            throw new Error(
                `GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID: files.get falhou (HTTP ${meta.status}). Confirme o ID e o JSON da mesma service account no Cloudflare (Preview vs Production). ${meta.detail.slice(0, 120)}`
            );
        }
    }

    // Descoberta por nome (sem ID fixo, ou fallback após 404 no ID fixo com shared drive)
    let candidates = [];

    // Com drive partilhado configurado: procurar primeiro SÓ lá (corpora=drive).
    // Só depois tentar allDrives — evita depender de pesquisa global quando a SA
    // só tem acesso como membro do Shared Drive.
    if (sd) {
        candidates = await fetchCheckingOOHCandidates(accessToken, sd);
    }
    if (candidates.length === 0) {
        candidates = await fetchCheckingOOHCandidates(accessToken, null);
    }

    return pickCheckingOOHFromCandidates(candidates, exibidoraName, accessToken);
}

// =============================================================================
// 📊 FUNÇÕES UTILITÁRIAS
// =============================================================================

/**
 * Limpa todos os locks (útil para debugging)
 */
export function clearAllLocks() {
    folderCreationLocks.clear();
}

/**
 * Retorna estatísticas de operações
 */
export function getStats() {
    return { ...stats };
}

/**
 * Reseta estatísticas
 */
export function resetStats() {
    stats.cacheHits = 0;
    stats.cacheMisses = 0;
    stats.locksAvoided = 0;
}

// =============================================================================
// 🧪 VALIDAÇÃO DE PARÂMETROS
// =============================================================================
/**
 * Valida os parâmetros da hierarquia
 */
export function validateHierarchyParams(exibidora, databaseId, pontoId, tipo) {
    const errors = [];

    if (!exibidora || typeof exibidora !== 'string') {
        errors.push('Exibidora inválida ou ausente');
    }

    if (!databaseId || typeof databaseId !== 'string') {
        errors.push('DatabaseId inválido ou ausente');
    }

    if (!pontoId || typeof pontoId !== 'string') {
        errors.push('PontoId inválido ou ausente');
    }

    if (!tipo || !['entrada', 'saida'].includes(tipo)) {
        errors.push('Tipo deve ser "entrada" ou "saida"');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// =============================================================================
// 🔧 NORMALIZAR ID DO NOTION
// =============================================================================
/**
 * Normaliza IDs do Notion para formato com hífens
 * Garante consistência independente do formato de entrada
 *
 * @param {string} id - ID do Notion (com ou sem hífens)
 * @returns {string} - ID normalizado no formato padrão
 */
function normalizeNotionId(id) {
    if (!id) return id;

    // Remover hífens e unificar minúsculas (pastas no Drive seguem o formato Notion em minúsculas)
    const cleanId = id.replace(/-/g, '').toLowerCase();

    // Se tem 32 caracteres hex, formatar 8-4-4-4-12
    if (cleanId.length === 32 && /^[a-f0-9]{32}$/.test(cleanId)) {
        return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20, 32)}`;
    }

    return id;
}

/**
 * Opções de hierarquia a partir das variáveis Cloudflare / .dev.vars
 * - GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID ou CHECKINGOOH_ROOT_FOLDER_ID: ID da pasta CheckingOOH
 * - GOOGLE_DRIVE_SHARED_DRIVE_ID: ID do Drive partilhado (pesquisa CheckingOOH primeiro lá; depois allDrives se vazio)
 */
export function buildDriveHierarchyOptions(env) {
    if (!env || typeof env !== 'object') {
        return {};
    }
    const cid = sanitizeDriveFileId(env.GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID || env.CHECKINGOOH_ROOT_FOLDER_ID || '');
    const sid = sanitizeDriveFileId(env.GOOGLE_DRIVE_SHARED_DRIVE_ID || '');
    return {
        ...(cid ? { checkingOohFolderId: cid } : {}),
        ...(sid ? { sharedDriveId: sid } : {})
    };
}

