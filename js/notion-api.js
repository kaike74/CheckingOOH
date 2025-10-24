// =============================================================================
// 📄 INTEGRAÇÃO COM NOTION API - CHECKING OOH
// =============================================================================

/**
 * 🔍 BUSCAR PONTOS POR ID
 * Busca um ponto específico no Notion e retorna todos os pontos da mesma exibidora
 */
async function fetchPontosFromNotion(pontoId) {
    try {
        Logger.info('Buscando pontos no Notion', { pontoId });
        
        // 🧪 MODO DEMO - RETORNAR DADOS FICTÍCIOS
        if (CONFIG.DEMO.ENABLED) {
            Logger.info('Modo demo ativo - usando dados fictícios');
            return mockNotionResponse(pontoId);
        }
        
        // 🔗 CHAMADA REAL PARA A API
        const response = await fetch(`${getApiBaseUrl()}/api/notion-data?id=${pontoId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }
        
        const data = await response.json();
        Logger.success('Pontos carregados do Notion', data);
        
        return data;
        
    } catch (error) {
        Logger.error('Erro ao buscar pontos no Notion', error);
        throw error;
    }
}

/**
 * 📋 BUSCAR TODOS OS PONTOS DE UMA CAMPANHA (NOVO)
 * Busca todos os pontos de uma campanha específica (todas exibidoras)
 */
async function fetchPontosByCampanha(campanhaId) {
    try {
        Logger.info('Buscando pontos da campanha', { campanhaId });

        // 🧪 MODO DEMO
        if (CONFIG.DEMO.ENABLED) {
            const allSampleData = CONFIG.DEMO.SAMPLE_DATA;

            return {
                mode: 'campanha',
                pontos: allSampleData, // Retornar todos os pontos de exemplo
                databaseId: campanhaId,
                totalCount: allSampleData.length
            };
        }

        // 🔗 CHAMADA REAL PARA A API
        const response = await fetch(`${getApiBaseUrl()}/api/notion-data?campanha=${campanhaId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }

        const data = await response.json();
        Logger.success('Pontos da campanha carregados', data);

        return data;

    } catch (error) {
        Logger.error('Erro ao buscar pontos da campanha', error);
        throw error;
    }
}

/**
 * 🔍 BUSCAR PONTO PARA CLIENTE
 * Busca apenas um ponto específico para visualização do cliente
 */
async function fetchPontoForCliente(clienteId) {
    try {
        Logger.info('Buscando ponto para cliente', { clienteId });
        
        // 🧪 MODO DEMO
        if (CONFIG.DEMO.ENABLED) {
            const allSampleData = CONFIG.DEMO.SAMPLE_DATA;
            const ponto = allSampleData.find(p => p.id === clienteId) || allSampleData[0];

            return {
                mode: 'cliente',
                ponto: ponto,
                pontos: [ponto], // Cliente vê apenas seu ponto
                databaseId: 'demo-database-id-12345', // ✅ CORREÇÃO: Adicionar databaseId para modo demo cliente
                exibidora: ponto.exibidora
            };
        }
        
        // 🔗 CHAMADA REAL PARA A API
        const response = await fetch(`${getApiBaseUrl()}/api/notion-data?idcliente=${clienteId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }
        
        const data = await response.json();
        Logger.success('Ponto carregado para cliente', data);
        
        return data;
        
    } catch (error) {
        Logger.error('Erro ao buscar ponto para cliente', error);
        throw error;
    }
}

/**
 * 🧪 RESPOSTA MOCK PARA MODO DEMO
 * Simula a resposta da API do Notion com dados fictícios
 */
function mockNotionResponse(pontoId) {
    Logger.debug('Gerando resposta mock do Notion');
    
    const allSampleData = CONFIG.DEMO.SAMPLE_DATA;
    const pontoEspecifico = allSampleData.find(p => p.id === pontoId);
    
    if (!pontoEspecifico) {
        Logger.warning('Ponto não encontrado no modo demo, usando primeiro ponto');
        const firstPonto = allSampleData[0];
        return {
            mode: 'exibidora',
            exibidora: firstPonto.exibidora,
            ponto: firstPonto,
            pontos: allSampleData.filter(p => p.exibidora === firstPonto.exibidora),
            databaseId: 'demo-database-id-12345' // ✅ CORREÇÃO: Adicionar databaseId
        };
    }

    // Filtrar pontos da mesma exibidora
    const pontosDaExibidora = allSampleData.filter(p => p.exibidora === pontoEspecifico.exibidora);

    return {
        mode: 'exibidora',
        exibidora: pontoEspecifico.exibidora,
        ponto: pontoEspecifico,
        pontos: pontosDaExibidora,
        databaseId: 'demo-database-id-12345' // ✅ CORREÇÃO: Adicionar databaseId
    };
}

/**
 * 🔄 ATUALIZAR STATUS DO PONTO
 * Atualiza o status de um ponto no Notion (opcional)
 */
async function updatePontoStatus(pontoId, status, tipo) {
    try {
        Logger.info('Atualizando status do ponto', { pontoId, status, tipo });
        
        // 🧪 MODO DEMO - SIMULAR SUCESSO
        if (CONFIG.DEMO.ENABLED) {
            Logger.debug('Modo demo - simulando atualização de status');
            await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
            return { success: true };
        }
        
        // 🔗 CHAMADA REAL PARA A API
        const response = await fetch(`${getApiBaseUrl()}/api/notion-update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: pontoId,
                status: status,
                tipo: tipo,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }
        
        const result = await response.json();
        Logger.success('Status atualizado no Notion', result);
        
        return result;
        
    } catch (error) {
        Logger.error('Erro ao atualizar status no Notion', error);
        // Não falhar se não conseguir atualizar o status
        return { success: false, error: error.message };
    }
}

/**
 * 📊 EXTRAIR DADOS DO PONTO
 * Processa os dados vindos do Notion e padroniza a estrutura
 */
function extractPontoData(notionPage) {
    try {
        const properties = notionPage.properties || {};
        
        // Função helper para extrair valores do Notion
        const extractValue = (prop, defaultValue = '') => {
            if (!prop) return defaultValue;
            
            switch (prop.type) {
                case 'title':
                    return prop.title?.[0]?.text?.content || defaultValue;
                case 'rich_text':
                    return prop.rich_text?.[0]?.text?.content || defaultValue;
                case 'select':
                    return prop.select?.name || defaultValue;
                case 'multi_select':
                    return prop.multi_select?.map(item => item.name).join(', ') || defaultValue;
                case 'url':
                    return prop.url || defaultValue;
                case 'email':
                    return prop.email || defaultValue;
                case 'phone_number':
                    return prop.phone_number || defaultValue;
                case 'date':
                    return prop.date?.start || defaultValue;
                default:
                    return defaultValue;
            }
        };
        
        // Mapear campos do Notion para estrutura padronizada
        const pontoData = {
            id: notionPage.id,
            exibidora: extractValue(properties[CONFIG.NOTION.FIELDS.EXIBIDORA], 'Exibidora'),
            ponto: extractValue(properties[CONFIG.NOTION.FIELDS.PONTO], 'Ponto'),
            endereco: extractValue(properties[CONFIG.NOTION.FIELDS.ENDERECO], 'Endereço não informado'),
            urlExibidora: extractValue(properties[CONFIG.NOTION.FIELDS.URL_EXIBIDORA], ''),
            urlCliente: extractValue(properties[CONFIG.NOTION.FIELDS.URL_CLIENTE], ''),
            status: extractValue(properties[CONFIG.NOTION.FIELDS.STATUS], 'Pendente'),
            campanha: extractValue(properties[CONFIG.NOTION.FIELDS.CAMPANHA], ''),
            lastUpdate: new Date().toISOString()
        };
        
        Logger.debug('Dados do ponto extraídos', pontoData);
        return pontoData;
        
    } catch (error) {
        Logger.error('Erro ao extrair dados do ponto', error);
        throw new Error('Erro ao processar dados do Notion');
    }
}

/**
 * 🔍 VALIDAR ID DO NOTION
 * Verifica se o ID fornecido tem o formato correto do Notion
 */
function validateNotionId(id) {
    if (!id) return false;
    
    // Remover hífens para validação
    const cleanId = id.replace(/-/g, '');
    
    // ID do Notion deve ter 32 caracteres hexadecimais
    const notionIdRegex = /^[0-9a-f]{32}$/i;
    return notionIdRegex.test(cleanId);
}

/**
 * 🧹 LIMPAR ID DO NOTION
 * Remove hífens do ID para uso nas APIs
 */
function cleanNotionId(id) {
    if (!id) return '';
    return id.replace(/-/g, '');
}

// 🚀 EXPORTAR FUNÇÕES
window.NotionAPI = {
    fetchPontosFromNotion,
    fetchPontoForCliente,
    fetchPontosByCampanha, // ✅ NOVO: Buscar pontos por campanha
    updatePontoStatus,
    extractPontoData,
    validateNotionId,
    cleanNotionId
};

Logger.info('Módulo Notion API carregado');
