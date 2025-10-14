// =============================================================================
// 📄 CLOUDFLARE PAGES FUNCTION - NOTION DATA API
// =============================================================================

export async function onRequest(context) {
    // Permitir CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Responder OPTIONS para CORS preflight
    if (context.request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers
        });
    }

    try {
        // Obter parâmetros da URL
        const url = new URL(context.request.url);
        const pontoId = url.searchParams.get('id');
        const clienteId = url.searchParams.get('idcliente');
        
        if (!pontoId && !clienteId) {
            return new Response(JSON.stringify({ 
                error: 'ID do ponto ou cliente é obrigatório' 
            }), {
                status: 400,
                headers
            });
        }

        // Token do Notion
        const notionToken = context.env.NOTION_TOKEN;
        if (!notionToken) {
            return new Response(JSON.stringify({ 
                error: 'Token do Notion não configurado' 
            }), {
                status: 500,
                headers
            });
        }

        console.log('🔍 Buscando dados no Notion:', { pontoId, clienteId });

        let responseData;

        if (clienteId) {
            // Modo cliente - buscar ponto específico
            responseData = await fetchPontoForCliente(clienteId, notionToken);
        } else {
            // Modo exibidora - buscar todos os pontos da mesma exibidora
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
        }), {
            status: 500,
            headers
        });
    }
}

// =============================================================================
// 🔍 BUSCAR PONTOS PARA EXIBIDORA
// =============================================================================
async function fetchPontosForExibidora(pontoId, notionToken) {
    try {
        console.log('📡 Buscando ponto inicial:', pontoId);

        // Buscar o ponto específico primeiro
        const pontoResponse = await fetch(`https://api.notion.com/v1/pages/${pontoId}`, {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!pontoResponse.ok) {
            throw new Error(`Erro ao buscar ponto: ${pontoResponse.status}`);
        }

        const pontoData = await pontoResponse.json();
        const pontoExtraido = extractPontoData(pontoData);
        const exibidora = pontoExtraido.exibidora;

        console.log('✅ Ponto encontrado:', { 
            id: pontoExtraido.id, 
            exibidora: exibidora 
        });

        // Obter o database parent deste ponto
        const databaseId = pontoData.parent?.database_id;
        if (!databaseId) {
            throw new Error('Não foi possível determinar o database deste ponto');
        }

        console.log('🔍 Database ID detectado:', databaseId);

        // Buscar todos os pontos da mesma exibidora NO MESMO DATABASE
        console.log('🔍 Buscando todos os pontos da exibidora:', exibidora);

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
                    select: {
                        equals: exibidora
                    }
                }
            })
        });

        if (!queryResponse.ok) {
            throw new Error(`Erro ao buscar pontos da exibidora: ${queryResponse.status}`);
        }

        const queryData = await queryResponse.json();
        const pontos = queryData.results.map(extractPontoData);

        console.log('✅ Pontos da exibidora encontrados:', pontos.length);

        return {
            mode: 'exibidora',
            exibidora: exibidora,
            ponto: pontoExtraido,
            pontos: pontos,
            databaseId: databaseId
        };

    } catch (error) {
        console.error('❌ Erro ao buscar pontos para exibidora:', error);
        throw error;
    }
}

// =============================================================================
// 👤 BUSCAR PONTO PARA CLIENTE
// =============================================================================
async function fetchPontoForCliente(clienteId, notionToken) {
    try {
        console.log('👤 Buscando ponto para cliente:', clienteId);

        // Buscar ponto específico
        const pontoResponse = await fetch(`https://api.notion.com/v1/pages/${clienteId}`, {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!pontoResponse.ok) {
            throw new Error(`Erro ao buscar ponto do cliente: ${pontoResponse.status}`);
        }

        const pontoData = await pontoResponse.json();
        const pontoExtraido = extractPontoData(pontoData);

        console.log('✅ Ponto do cliente encontrado:', { 
            id: pontoExtraido.id, 
            endereco: pontoExtraido.endereco 
        });

        return {
            mode: 'cliente',
            ponto: pontoExtraido,
            pontos: [pontoExtraido] // Cliente vê apenas seu ponto
        };

    } catch (error) {
        console.error('❌ Erro ao buscar ponto para cliente:', error);
        throw error;
    }
}

// =============================================================================
// 🔧 EXTRAIR DADOS DO PONTO
// =============================================================================
function extractPontoData(notionPage) {
    try {
        console.log('🔧 Extraindo dados do ponto:', notionPage.id);

        const properties = notionPage.properties || {};
        
        // Função helper para extrair valores
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
                case 'number':
                    return prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
                case 'checkbox':
                    return prop.checkbox || false;
                case 'formula':
                    // Fórmulas podem retornar diferentes tipos
                    if (prop.formula?.type === 'string') {
                        return prop.formula.string || defaultValue;
                    }
                    return defaultValue;
                default:
                    return defaultValue;
            }
        };
        
        // ⚠️ IMPORTANTE: Campos ajustados para sua estrutura real
        const pontoData = {
            id: notionPage.id.replace(/-/g, ''), // Remover hífens
            exibidora: extractValue(properties['Exibidora'], 'Exibidora Desconhecida'),
            endereco: extractValue(properties['Endereço'], 'Endereço não informado'), // Campo Title
            urlExibidora: extractValue(properties['URL Exibidora'], ''),
            urlCliente: extractValue(properties['URL Cliente'], ''),
            // Campos opcionais adicionais (se existirem)
            valor: extractValue(properties['Valor'], 0),
            periodo: extractValue(properties['Período'], ''),
            observacoes: extractValue(properties['Observações'], ''),
            lastUpdate: new Date().toISOString()
        };
        
        console.log('📊 Dados extraídos:', {
            id: pontoData.id,
            exibidora: pontoData.exibidora,
            endereco: pontoData.endereco
        });

        return pontoData;
        
    } catch (error) {
        console.error('❌ Erro ao extrair dados do ponto:', error);
        throw new Error('Erro ao processar dados do Notion');
    }
}
