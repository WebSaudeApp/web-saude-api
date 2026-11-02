# BE-08 — Processo de Obtenção e Correção de Coordenadas das Unidades

Este documento registra a decisão técnica e os processos operacionais para a obtenção, validação e correção das coordenadas geográficas das unidades de saúde no Web Saúde, atendendo aos requisitos da demanda **BE-08**.

---

## 1. Contexto dos Dados Existentes (Ambiente de Testes)

- **Natureza dos Dados Atuais**: Os 50 estabelecimentos cadastrados atualmente no PostgreSQL (Supabase) são **dados fictícios de teste (seeds/mocks)**.
- **Coordenadas Sintéticas**: Os valores de `latitude` e `longitude` atualmente gravados são números sintéticos gerados unicamente para testes de infraestrutura e viabilização das consultas do Elasticsearch. **Eles não correspondem a endereços físicos reais** e muitas dessas unidades nem existem no mundo real.
- **Estado Técnico no Elasticsearch**: Para fins de desenvolvimento de software, esses números fictícios foram indexados no campo `localizacao` (`geo_point`) no alias `estabelecimentos` apenas para permitir o desenvolvimento e os testes do algoritmo de busca por proximidade.
- **Necessidade de Coordenadas Reais**: Quando o sistema receber estabelecimentos reais ou for para produção, as coordenadas reais deverão ser obtidas e corrigidas seguindo os processos descritos abaixo.

---

## 2. Decisão Técnica: Obtenção de Coordenadas para Novas Unidades

O cadastro de uma nova unidade de saúde exige coordenadas precisas para que a busca por proximidade funcione corretamente. Para apoiar o gestor e evitar erros de digitação:

1. **Preenchimento Automático por Geocodificação (Front-End)**:
   - Ao preencher o endereço ou CEP da unidade, o front-end consulta a API do **ViaCEP** para obter logradouro, bairro, cidade e UF.
   - O endereço completo é enviado para o serviço de geocodificação escolhido: **Nominatim / OpenStreetMap** (gratuito e de código aberto) ou **Google Maps Geocoding API** (em ambiente de produção de alta demanda).
   - As coordenadas resultantes são pré-preenchidas nos campos de `latitude` e `longitude`.

2. **Ajuste Fino Visual com Mapa Interativo (Leaflet)**:
   - Um mapa interativo é exibido na tela de cadastro/edição com um marcador posicionado nas coordenadas geocodificadas.
   - O gestor pode arrastar o pino diretamente para a portaria ou entrada principal da unidade de saúde.
   - Permite também a digitação manual de latitude e longitude caso o gestor possua os dados exatos obtidos por GPS/dispositivo móvel.

3. **Validação Obrigatória na API (Back-End)**:
   - Conforme implementado na **BE-07**, o `EnderecoDto` valida estritamente os limites geográficos do Brasil:
     - Latitude: entre `-34` e `6`
     - Longitude: entre `-74` e `-28`
   - Coordenadas ausentes, nulas, invertidas ou fora do Brasil são rejeitadas com erro `400` e mensagem em português.

---

## 3. Processo para Corrigir Coordenadas Incorretas

Se uma unidade estiver com localização imprecisa ou com coordenadas desatualizadas:

1. **Quem pode corrigir**:
   - Gestores responsáveis pelo estabelecimento ou administradores do sistema com perfil autorizado.

2. **Rota da API utilizada**:
   - A correção é feita via requisição HTTP `PATCH /estabelecimentos/:id`.
   - O payload aceita a atualização parcial do endereço, informando apenas as novas coordenadas ou o endereço completo:
     ```json
     {
       "endereco": {
         "latitude": -8.05389,
         "longitude": -34.88111
       }
     }
     ```

3. **Reflexo Imediato na Busca (Elasticsearch)**:
   - Graças à sincronização em tempo real (**BE-15**), a chamada ao método `update` atualiza a tabela `enderecos` no PostgreSQL e propaga automaticamente o novo ponto `geo_point` para o Elasticsearch.
   - A unidade passa a responder instantaneamente às buscas geográficas na nova posição, sem necessidade de reiniciar a aplicação ou reindexar manualmente.

4. **Correções em Lote e Recuperação**:
   - Em caso de inconsistências em massa, o comando `npm run reindex` (**BE-16**) pode ser executado para conferir e reconstruir o índice completo a partir dos dados do PostgreSQL.
