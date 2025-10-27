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
 * @returns {Promise<{id: string, path: string}>} - ID e caminho da pasta final
 */
export async function ensureFolderHierarchy(exibidora, databaseId, pontoId, tipo, accessToken) {
    try {
        console.log('🏗️ === INICIANDO CRIAÇÃO DE HIERARQUIA ===');
        console.log('📋 Parâmetros:', { exibidora, databaseId, pontoId, tipo });

        // PASSO 1: Encontrar pasta CheckingOOH
        console.log('🔍 [1/5] Buscando pasta raiz: CheckingOOH...');
        const checkingFolder = await findFolderInAllDrives('CheckingOOH', accessToken);

        if (!checkingFolder) {
            throw new Error('❌ Pasta CheckingOOH não encontrada. Verifique a configuração do Drive.');
        }

        console.log('✅ Pasta CheckingOOH encontrada:', checkingFolder.id);
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

        // PASSO 3: Campanha (usando databaseId DIRETAMENTE)
        console.log(`🔍 [3/5] Garantindo pasta Campanha: ${databaseId}...`);
        const campanhaFolder = await findOrCreateFolderWithLock(
            databaseId,
            exibidoraFolder.id,
            accessToken,
            checkingFolder.driveId
        );
        console.log('✅ Pasta Campanha:', campanhaFolder.id);

        // PASSO 4: Ponto
        console.log(`🔍 [4/5] Garantindo pasta Ponto: ${pontoId}...`);
        const pontoFolder = await findOrCreateFolderWithLock(
            pontoId,
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

        // Construir caminho completo
        const fullPath = `${basePath}/${exibidora}/${databaseId}/${pontoId}/${tipoFolderName}`;
        console.log('🎉 Hierarquia completa garantida:', fullPath);
        console.log('📊 Estatísticas:', stats);

        return {
            id: tipoFolder.id,
            path: fullPath,
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

        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;

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

console.log('✅ Módulo Drive Hierarchy Manager carregado');
