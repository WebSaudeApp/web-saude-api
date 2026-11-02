# UC01 — Pesquisa de estabelecimentos

Este documento descreve as alterações realizadas na busca do serviço de estabelecimentos e nas avaliações exibidas a partir do resultado, seguindo a especificação "UC01 – Pesquisar estabelecimentos de saúde" e as regras de paridade estrita entre PostgreSQL e Elasticsearch (D13, BE-30).

## Serviço de busca

O método `EstabelecimentosService.search()` aceita os filtros `termo`, `tipo`, `especialidade`, `cidade` e `estado`, além da paginação por `pagina` e `limite`. Os filtros são combinados (RN04). A mesma busca retorna exatamente o mesmo conjunto de estabelecimentos com ou sem localização (dentro do raio), seguindo regras idênticas nos dois motores:

- **Termo (RN03 / 8c):** pesquisa parcialmente em nome, cidade, bairro e especialidade. O termo **não** pesquisa logradouro (evita falsos positivos com "Rua", "Avenida" etc.).
- **Tolerância a digitação (8b):** sem tolerância a erro de digitação (`fuzziness`) por enquanto; termo busca correspondência exata de tokens ou substrings.
- **Normalização de acentos e caixa (RN02, RN03):** a busca por texto, cidade e especialidade ignora acentos e diferenças entre maiúsculas e minúsculas. No PostgreSQL, a normalização utiliza a extensão nativa `unaccent` combinada com `lower()` e `normalize('NFD')`. No Elasticsearch, o índice utiliza analisador customizado com `asciifolding` e subcampos `keyword` com normalizador `lowercase` + `asciifolding`.
- **Cidade (RN02):** `cidade` é comparada pelo nome completo exato (insensível a acentos e maiúsculas) nos dois motores; buscar "São José" não casa com "São José do Egito". Com geolocalização informada, o filtro espacial é regido pelo raio (8a).
- **Especialidade (RN06, A2):** aceita o ID ou o nome exato da especialidade (insensível a acentos e maiúsculas); buscar "Clínica" não casa com "Clínica Geral" ou "Clínica Médica".
- **Tipo (RN05):** os tipos aceitos são `HOSPITAL` e `CLINICA`, gravados assim no banco. O valor recebido é normalizado para maiúsculas sem acento antes da comparação, então `clinica` ou `clínica` encontra `CLINICA`. Tipos inexistentes devolvem lista vazia sem erro (CA07).
- **Geolocalização e Fallback (BE-09, BE-10, BE-28):** a busca aceita parâmetros de geolocalização `lat`, `lng` e `raioKm` (padrão 10 km, máximo 50 km). Quando fornecidos, a busca é executada via Elasticsearch com ordenação por distância geográfica e cálculo de `distanciaKm` (1 casa decimal). Caso o Elasticsearch esteja indisponível, há fallback automático e transparente para a busca geográfica no PostgreSQL (Haversine).
- **Documento do índice (8d):** horários de funcionamento foram removidos do documento de indexação do Elasticsearch (YAGNI), já que a busca não filtra por horário e os dados completos vêm do PostgreSQL (RN11).
- **Ordenação:** sem coordenadas, os resultados são ordenados alfabeticamente por nome (RN07). Com coordenadas, são ordenados por proximidade com desempate estável por `nome.keyword` e `id`.
- **Paginação:** usa página 1 e limite 20 como padrões (RN08) e inclui a propriedade booleana `temMais` para simplificar a integração com infinite scroll no front-end (`temMais: pagina < totalPaginas`).
- **Resposta:** tem o formato `{ dados, paginacao }`. Quando a página pedida passa da última, `dados` vem vazio e `paginacao.total` mantém o total real (E5).
- **Tratamento de erro:** uma falha no banco é propagada pelo serviço (E6).

## Detalhe do estabelecimento

O método `EstabelecimentosService.findOne()` devolve o estabelecimento com endereço, coordenadas, especialidades, horários e mídias (passo 11, RN11, RN12). Um ID inexistente gera `404` com a mensagem "Estabelecimento não encontrado." (E8).

## Avaliações de um resultado

A rota `GET /estabelecimentos/{id}/reviews` chama `ReviewsService.listByEstabelecimento()` e devolve as avaliações da mais recente para a mais antiga, com nota, comentário, data e autor (A5). A paginação segue a mesma regra da busca: `pagina` e `limite`, 20 itens por padrão e resposta `{ dados, paginacao }` (RN08). Se o estabelecimento não existir, a resposta é `404` (E8).

A listagem de avaliações por usuário (`GET /usuarios/{id}/reviews`) não faz parte do UC01 e continua com a paginação anterior (`page`, `limit` e `{ data, meta }`).

## Banco de dados

- A migration `20261016120000_tipo_clinica` renomeia o tipo `CLINIC` para `CLINICA`.
- A migration `20261102120000_indice_enderecos_coordenadas` cria o índice composto `enderecos_latitude_longitude_idx` nas colunas `latitude` e `longitude` para acelerar o fallback geográfico (BE-28).
- A migration `20261102140000_extensao_unaccent` ativa a extensão `unaccent` no PostgreSQL para busca textual acentuada sem perda de performance e independente de collation/locale (BE-30).

## Testes automatizados

### Testes unitários (`src/estabelecimentos/estabelecimentos.service.spec.ts`)

| Teste | Itens da especificação |
| --- | --- |
| Busca sem filtros, com paginação padrão e mapeamento dos campos | RN07, RN08, RN11 |
| Filtros combinados, texto normalizado e tipo `CLINICA` | RN04, RN05, RN08 |
| Nenhum estabelecimento atende ao filtro | E1 |
| Página além da última mantém o total real | E5 |
| Especialidade enviada pelo ID | A2, RN06 |
| Falha no banco é propagada | E6 |
| Detalhe com endereço, coordenadas, especialidades, mídias e horários | Passo 11, RN11, RN12 |
| ID inexistente gera `404` | E8 |
| Tipo inexistente (`LABORATORIO`) devolve lista vazia, sem erro | RN05, E1, CA07 |
| Especialidade inexistente devolve lista vazia | RN06, E1 |
| Termo com bairro e cidade com acento chegam ao SQL sem acento e em minúsculas | RN02, RN03, CA02, CA10 |
| Busca no SQL usa unaccent e normaliza maiúsculas acentuadas e NFD | BE-30, RN02, RN03 |
| Última página parcial: 23 estabelecimentos, `limite=10` e `pagina=3` trazem 3 itens e 3 páginas | RN08, A3, A4, CA06 |
| Busca geográfica por proximidade via Elasticsearch com cálculo de `distanciaKm` e ordenação | BE-09, BE-10 |
| Busca geográfica com filtros combinados (termo, tipo, especialidade, cidade/estado) | BE-11 |
| Fallback seguro para SQL quando Elasticsearch falha ou está indisponível | BE-28 |
| Paginação para scroll infinito sem repetição de itens e com flag `temMais` | BE-13 |

### Testes de paridade E2E (`test/paridade-busca.e2e-spec.ts`)

| Teste de Paridade | Validação estrita entre PostgreSQL e Elasticsearch |
| --- | --- |
| Cidade exata | "São José" traz apenas e1; "São José do Egito" (e2) é excluído nos dois motores |
| Especialidade exata | "Clínica" traz apenas e3; "Clínica Geral" (e4) e "Clínica Médica" (e5) são excluídos nos dois motores |
| Termo sem fuzziness | "Unimed" traz apenas e3; "Unimar" (e4) é excluído nos dois motores |
| Termo sem logradouro | "Rua das Flores" não traz nenhum estabelecimento (e1 e e3 excluídos da busca por termo) |
