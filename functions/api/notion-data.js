// =============================================================================
// 📄 CLOUDFLARE PAGES FUNCTION - NOTION DATA API (CORRIGIDO)
// =============================================================================

export async function onRequest(context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response('', { status: 200, headers });
    }

    try {
        const url = new URL(context.request.url);
        const pontoId = url.searchParams.get('id');
        const campanhaId = url.searchParams.get('campanha');

        if (!pontoId && !campanhaId) {
            return new Response(JSON.stringify({
                error: 'ID do ponto ou campanha é obrigatório'
            }), { status: 400, headers });
        }

        const notionToken = context.env.NOTION_TOKEN;
        if (!notionToken) {
            return new Response(JSON.stringify({
                error: 'Token do Notion não configurado'
            }), { status: 500, headers });
        }

        console.log('🔍 Buscando dados no Notion...', { pontoId, campanhaId });

        let responseData;

        if (campanhaId) {
            responseData = await fetchPontosByCampanha(campanhaId, notionToken);
        } else {
            responseData = await fetchPontosForExibidora(pontoId, notionToken);
        }

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('💥 Erro na função Notion:', error);
        return new Response(JSON.stringify({ 
            error: 'Erro interno do servidor',
            details: error.message
        }), { status: 500, headers });
    }
}

// =============================================================================
// 🔍 BUSCAR PONTOS PARA EXIBIDORA (CORRIGIDO)
// =============================================================================
async function fetchPontosForExibidora(pontoId, notionToken) {
    try {
        console.log('📡 Buscando ponto inicial:', pontoId);

        const normalizedId = normalizeNotionId(pontoId);
        console.log('🔧 ID normalizado:', normalizedId);

        // Buscar o ponto específico primeiro
        const pontoResponse = await fetch(`https://api.notion.com/v1/pages/${normalizedId}`, {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!pontoResponse.ok) {
            const errorText = await pontoResponse.text();
            throw new Error(`Erro ao buscar ponto: ${pontoResponse.status} - ${errorText}`);
        }

        const pontoData = await pontoResponse.json();
        const pontoExtraido = extractPontoData(pontoData);
        const exibidora = pontoExtraido.exibidora;

        console.log('✅ Ponto encontrado:', { 
            id: pontoExtraido.id, 
            exibidora: exibidora,
            endereco: pontoExtraido.endereco
        });

        // Obter o database parent
        const rawDatabaseId = pontoData.parent?.database_id;
        if (!rawDatabaseId) {
            throw new Error('Não foi possível determinar o database deste ponto');
        }

        // ✅ CRÍTICO: Normalizar databaseId para garantir consistência
        const databaseId = normalizeNotionId(rawDatabaseId);
        console.log('🗄️ Database ID (raw):', rawDatabaseId);
        console.log('🗄️ Database ID (normalizado):', databaseId);

        // ✅ CORREÇÃO: Filtro para campo TEXT em vez de SELECT
        console.log('🔍 Buscando pontos da exibidora:', exibidora);

        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    property: 'Exibidora',
                    rich_text: {  // ✅ MUDANÇA: rich_text em vez de select
                        equals: exibidora
                    }
                }
            })
        });

        if (!queryResponse.ok) {
            const errorText = await queryResponse.text();
            throw new Error(`Erro ao buscar pontos da exibidora: ${queryResponse.status} - ${errorText}`);
        }

        const queryData = await queryResponse.json();
        const pontos = queryData.results.map(extractPontoData);

        console.log('✅ Pontos da exibidora encontrados:', pontos.length);

        return {
            success: true,
            mode: 'exibidora',
            exibidora: exibidora,
            ponto: pontoExtraido,
            pontos: pontos,
            databaseId: databaseId,
            totalPontos: pontos.length
        };

    } catch (error) {
        console.error('❌ Erro ao buscar pontos para exibidora:', error);
        throw error;
    }
}

// =============================================================================
// 📋 BUSCAR TÍTULO DA PÁGINA PAI (NOTION)
// =============================================================================
async function fetchPageTitle(databaseId, notionToken) {
    try {
        console.log('📄 Buscando título da página pai do database:', databaseId);

        // 1. Buscar informações do database
        const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!databaseResponse.ok) {
            console.warn('⚠️ Não foi possível buscar dados do database');
            return null;
        }

        const databaseData = await databaseResponse.json();

        // 2. Verificar se tem página pai
        const parentPageId = databaseData.parent?.page_id;
        if (!parentPageId) {
            console.log('ℹ️ Database não tem página pai');
            return null;
        }

        console.log('📄 Página pai encontrada:', parentPageId);

        // 3. Buscar título da página pai
        const pageResponse = await fetch(`https://api.notion.com/v1/pages/${parentPageId}`, {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!pageResponse.ok) {
            console.warn('⚠️ Não foi possível buscar página pai');
            return null;
        }

        const pageData = await pageResponse.json();

        // 4. Extrair título e ícone
        const titleProperty = pageData.properties?.title || pageData.properties?.Name;
        const title = titleProperty?.title?.[0]?.text?.content || null;

        // 5. Extrair ícone (pode ser emoji ou external/file)
        const icon = pageData.icon;
        let iconUrl = null;

        if (icon) {
            if (icon.type === 'external') {
                iconUrl = icon.external?.url;
            } else if (icon.type === 'file') {
                iconUrl = icon.file?.url;
            } else if (icon.type === 'emoji') {
                // Emojis não podemos usar diretamente
                iconUrl = null;
            }
        }

        console.log('✅ Título da página pai extraído:', title);
        console.log('✅ Ícone da página pai:', iconUrl || 'Nenhum');

        return { title, iconUrl };

    } catch (error) {
        console.error('❌ Erro ao buscar título da página pai:', error);
        return null;
    }
}

// =============================================================================
// 📋 BUSCAR TODOS OS PONTOS DE UMA CAMPANHA
// =============================================================================
async function fetchPontosByCampanha(campanhaId, notionToken) {
    try {
        console.log('📋 Buscando todos os pontos da campanha:', campanhaId);

        const normalizedId = normalizeNotionId(campanhaId);
        console.log('🔧 Database ID (raw):', campanhaId);
        console.log('🔧 Database ID (normalizado):', normalizedId);

        // Buscar título e ícone da página pai
        const pageInfo = await fetchPageTitle(normalizedId, notionToken);
        const pageTitle = pageInfo?.title || null;
        const pageIcon = pageInfo?.iconUrl || null;

        // Buscar TODOS os pontos do database (sem filtro)
        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${normalizedId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                page_size: 100 // Buscar até 100 pontos
            })
        });

        if (!queryResponse.ok) {
            const errorText = await queryResponse.text();
            throw new Error(`Erro ao buscar pontos da campanha: ${queryResponse.status} - ${errorText}`);
        }

        const queryData = await queryResponse.json();
        const pontos = queryData.results.map(extractPontoData);

        console.log('✅ Pontos da campanha encontrados:', pontos.length);

        return {
            success: true,
            mode: 'campanha',
            pontos: pontos,
            databaseId: normalizedId, // ✅ CRÍTICO: Retornar ID normalizado, não o raw
            totalPontos: pontos.length,
            pageTitle: pageTitle, // ✅ Incluir título da página pai
            pageIcon: pageIcon // ✅ Incluir ícone da página pai
        };

    } catch (error) {
        console.error('❌ Erro ao buscar pontos da campanha:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 NORMALIZAR ID DO NOTION
// =============================================================================
function normalizeNotionId(id) {
    if (!id) return id;

    const cleanId = id.replace(/-/g, '');

    if (cleanId.length === 32) {
        return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20, 32)}`;
    }

    return id;
}

// =============================================================================
// 🔧 EXTRAIR DADOS DO PONTO (CORRIGIDO)
// =============================================================================
function extractPontoData(notionPage) {
    try {
        console.log('🔧 Extraindo dados do ponto:', notionPage.id);

        const properties = notionPage.properties || {};
        
        const extractValue = (prop, defaultValue = '') => {
            if (!prop) return defaultValue;
            
            try {
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
                    case 'number':
                        return prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
                    case 'checkbox':
                        return prop.checkbox || false;
                    case 'formula':
                        if (prop.formula?.type === 'string') {
                            return prop.formula.string || defaultValue;
                        }
                        return defaultValue;
                    default:
                        console.warn(`⚠️ Tipo de propriedade não reconhecido: ${prop.type}`);
                        return defaultValue;
                }
            } catch (error) {
                console.error(`❌ Erro ao extrair propriedade ${prop.type}:`, error);
                return defaultValue;
            }
        };
        
        // ✅ CAMPOS CORRIGIDOS: Exibidora como rich_text
        // ✅ CRÍTICO: Normalizar ID do ponto para formato com hífens
        const pontoData = {
            id: normalizeNotionId(notionPage.id), // ✅ Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            idOriginal: notionPage.id,
            exibidora: extractValue(properties['Exibidora'], 'Exibidora Desconhecida'), // rich_text
            endereco: extractValue(properties['Endereço'], 'Endereço não informado'), // title
            urlExibidora: extractValue(properties['URL Exibidora'], ''),
            urlCliente: extractValue(properties['URL Cliente'], ''),
            valor: extractValue(properties['Valor'], 0),
            periodo: extractValue(properties['Período'], ''),
            observacoes: extractValue(properties['Observações'], ''),
            lastUpdate: new Date().toISOString(),
            createdTime: notionPage.created_time,
            lastEditedTime: notionPage.last_edited_time
        };
        
        console.log('📊 Dados extraídos:', {
            id: pontoData.id,
            exibidora: pontoData.exibidora,
            endereco: pontoData.endereco
        });

        return pontoData;
        
    } catch (error) {
        console.error('❌ Erro ao extrair dados do ponto:', error);
        throw new Error(`Erro ao processar dados do Notion: ${error.message}`);
    }
}
