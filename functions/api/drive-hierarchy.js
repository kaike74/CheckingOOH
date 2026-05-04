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
        console.log('🏗️ === INICIANDO CRIAÇÃO DE HIERARQUIA ===');

        // ✅ CRÍTICO: Normalizar databaseId e pontoId antes de usar
        const normalizedDatabaseId = normalizeNotionId(databaseId);
        const normalizedPontoId = normalizeNotionId(pontoId);
        console.log('📋 Parâmetros (raw):', { exibidora, databaseId, pontoId, tipo });
        console.log('📋 Parâmetros (normalized):', {
            exibidora,
            databaseId: normalizedDatabaseId,
            pontoId: normalizedPontoId,
            tipo
        });

        // PASSO 1: Encontrar pasta CheckingOOH
        console.log('🔍 [1/5] Buscando pasta raiz: CheckingOOH...', {
            temFolderId: Boolean(options.checkingOohFolderId),
            temSharedDriveId: Boolean(options.sharedDriveId)
        });
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

        console.log('✅ Pasta CheckingOOH encontrada:', checkingFolder.id, checkingFolder.driveId || 'My Drive');
        const basePath = 'CheckingOOH';

        // PASSO 2: Exibidora
        console.log(`🔍 [2/5] Garantindo pasta Exibidora: ${exibidora}...`);
        const exibidoraFolder = await findOrCreateFolderWithLock(
            exibidora,
            checkingFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        console.log('✅ Pasta Exibidora:', exibidoraFolder.id);

        // PASSO 3: Campanha (usando databaseId NORMALIZADO)
        console.log(`🔍 [3/5] Garantindo pasta Campanha: ${normalizedDatabaseId}...`);
        const campanhaFolder = await findOrCreateFolderWithLock(
            normalizedDatabaseId,
            exibidoraFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        console.log('✅ Pasta Campanha:', campanhaFolder.id);

        // PASSO 4: Ponto (usando pontoId NORMALIZADO)
        console.log(`🔍 [4/5] Garantindo pasta Ponto: ${normalizedPontoId}...`);
        const pontoFolder = await findOrCreateFolderWithLock(
            normalizedPontoId,
            campanhaFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        console.log('✅ Pasta Ponto:', pontoFolder.id);

        // PASSO 5: Tipo (Entrada/Saida)
        const tipoFolderName = tipo === 'entrada' ? 'Entrada' : 'Saida';
        console.log(`🔍 [5/5] Garantindo pasta Tipo: ${tipoFolderName}...`);
        const tipoFolder = await findOrCreateFolderWithLock(
            tipoFolderName,
            pontoFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        console.log('✅ Pasta Tipo:', tipoFolder.id);

        // Construir caminho completo (usando IDs normalizados)
        const fullPath = `${basePath}/${exibidora}/${normalizedDatabaseId}/${normalizedPontoId}/${tipoFolderName}`;
        console.log('🎉 Hierarquia completa garantida:', fullPath);
        console.log('📊 Estatísticas:', stats);

        // Para files.list em Shared Drives, corpora=drive exige driveId; a pasta raiz
        // "CheckingOOH" às vezes vem sem driveId na busca, mas as pastas filhas sim.
        const sharedDriveIdForList =
            tipoFolder.driveId ||
            pontoFolder.driveId ||
            campanhaFolder.driveId ||
            exibidoraFolder.driveId ||
            checkingFolder.driveId ||
            null;
        if (sharedDriveIdForList) {
            console.log('📌 sharedDriveIdForList (listagem):', sharedDriveIdForList);
        }

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
        console.error('❌ Erro ao garantir hierarquia de pastas:', error);
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
        console.log(`⏳ Lock detectado para "${folderName}" - aguardando operação em andamento...`);
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
                    console.warn(`⚠️ Encontradas ${searchResult.files.length} pastas duplicadas com nome "${folderName}". Usando a primeira.`);
                }
                console.log(`✅ Pasta "${folderName}" já existe (ID: ${searchResult.files[0].id})`);
                stats.cacheHits++;
                return searchResult.files[0];
            }
        }

        // CRIAR NOVA PASTA
        console.log(`📁 Criando nova pasta: "${folderName}"...`);
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
        console.log(`✅ Pasta "${folderName}" criada com sucesso (ID: ${newFolder.id})`);

        return newFolder;

    } catch (error) {
        console.error(`❌ Erro ao buscar/criar pasta "${folderName}":`, error);
        throw error;
    }
}

// =============================================================================
// 🌐 METADATA + BUSCA CheckingOOH (Shared Drive / env / desambiguação)
// =============================================================================

async function getDriveFileMetadata(fileId, accessToken) {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,driveId&supportsAllDrives=true`;
    const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) {
        const t = await r.text();
        console.error('❌ files.get', String(fileId).slice(0, 16), r.status, t.slice(0, 500));
        return null;
    }
    return r.json();
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
        console.error(
            '❌ fetchCheckingOOHCandidates',
            sharedDriveId ? `driveId=${sharedDriveId}` : 'allDrives',
            response.status,
            t.slice(0, 500)
        );
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
        console.log('✅ Único candidato CheckingOOH:', candidates[0].id);
        return candidates[0];
    }

    console.warn(
        `⚠️ ${candidates.length} pastas "CheckingOOH" — desambiguação pela exibidora "${exibidoraName}" (ids: ${candidates.map((c) => c.id).join(', ')})`
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
            console.log('✅ CheckingOOH escolhido (contém a exibidora):', root.id);
            return root;
        }
    }

    const onSharedDrive = candidates.filter((f) => f.driveId);
    if (onSharedDrive.length === 1) {
        console.warn(
            '⚠️ Exibidora ainda não existe — usando o único CheckingOOH com driveId em Shared Drive.'
        );
        return onSharedDrive[0];
    }

    const shared = candidates.find((f) => f.driveId);
    console.warn('⚠️ Fallback: primeiro CheckingOOH com driveId ou primeiro da lista.');
    return shared || candidates[0];
}

/**
 * options.checkingOohFolderId — ID da pasta CheckingOOH (evita pesquisa; resolve permissões só-partilha).
 * options.sharedDriveId — se definido (sem ID fixo da pasta), pesquisa "CheckingOOH"
 *   primeiro neste Shared Drive; só se vazio usa corpora=allDrives.
 */
async function resolveCheckingOOHRootFolder(accessToken, exibidoraName, options = {}) {
    const explicit = String(options.checkingOohFolderId || '').trim();
    if (explicit) {
        const meta = await getDriveFileMetadata(explicit, accessToken);
        if (!meta) {
            throw new Error(
                'GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID: files.get falhou (403/404). Confirme o ID na URL do Drive e que a service account tem acesso.'
            );
        }
        if (meta.mimeType !== 'application/vnd.google-apps.folder') {
            throw new Error(
                `GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID não é uma pasta (mime=${meta.mimeType}).`
            );
        }
        console.log('✅ CheckingOOH por ID fixo (env):', meta.id, meta.name);
        return { id: meta.id, name: meta.name || 'CheckingOOH', driveId: meta.driveId || null };
    }

    const sd = String(options.sharedDriveId || '').trim();
    let candidates = [];

    // Com drive partilhado configurado: procurar primeiro SÓ lá (corpora=drive).
    // Só depois tentar allDrives — evita depender de pesquisa global quando a SA
    // só tem acesso como membro do Shared Drive.
    if (sd) {
        candidates = await fetchCheckingOOHCandidates(accessToken, sd);
        console.log('🔍 CheckingOOH candidatos (Shared Drive primeiro, driveId=):', candidates.length, sd);
    }
    if (candidates.length === 0) {
        candidates = await fetchCheckingOOHCandidates(accessToken, null);
        console.log('🔍 CheckingOOH candidatos (fallback corpora=allDrives):', candidates.length);
    }

    return pickCheckingOOHFromCandidates(candidates, exibidoraName, accessToken);
}

// =============================================================================
// 🌐 BUSCAR PASTA EM TODOS OS DRIVES
// =============================================================================
/**
 * Busca uma pasta em My Drive + Shared Drives
 * Prioriza Shared Drives se encontrar
 *
 * @param {string} folderName - Nome da pasta
 * @param {string} accessToken - Token de acesso
 * @returns {Promise<{id: string, name: string, driveId: string|null}>} - Pasta encontrada ou null
 */
async function findFolderInAllDrives(folderName, accessToken) {
    try {
        console.log(`🌐 Buscando pasta "${folderName}" em todos os drives...`);

        const escapedFolderName = folderName.replace(/'/g, "\\'");
        const query = `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name,driveId)`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar pasta: ${response.status}`);
        }

        const result = await response.json();

        if (result.files && result.files.length > 0) {
            // Priorizar Shared Drive
            const sharedDriveFolder = result.files.find(f => f.driveId);
            const selectedFolder = sharedDriveFolder || result.files[0];

            console.log(`✅ Pasta "${folderName}" encontrada:`, {
                id: selectedFolder.id,
                driveId: selectedFolder.driveId || 'My Drive'
            });

            return selectedFolder;
        }

        console.log(`❌ Pasta "${folderName}" não encontrada em nenhum drive`);
        return null;

    } catch (error) {
        console.error(`❌ Erro ao buscar pasta "${folderName}":`, error);
        throw error;
    }
}

// =============================================================================
// 📊 FUNÇÕES UTILITÁRIAS
// =============================================================================

/**
 * Limpa todos os locks (útil para debugging)
 */
export function clearAllLocks() {
    folderCreationLocks.clear();
    console.log('🔓 Todos os locks foram limpos');
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
    console.log('📊 Estatísticas resetadas');
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
    const cid = String(env.GOOGLE_DRIVE_CHECKINGOOH_FOLDER_ID || env.CHECKINGOOH_ROOT_FOLDER_ID || '').trim();
    const sid = String(env.GOOGLE_DRIVE_SHARED_DRIVE_ID || '').trim();
    return {
        ...(cid ? { checkingOohFolderId: cid } : {}),
        ...(sid ? { sharedDriveId: sid } : {})
    };
}

console.log('✅ Módulo Drive Hierarchy Manager carregado');
