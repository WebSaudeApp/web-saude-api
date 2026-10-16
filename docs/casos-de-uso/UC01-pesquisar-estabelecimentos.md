# UC01 — Pesquisa de estabelecimentos

Este documento descreve as alterações realizadas na busca do serviço de estabelecimentos e nas avaliações exibidas a partir do resultado, seguindo a especificação "UC01 – Pesquisar estabelecimentos de saúde".

## Serviço de busca

O método `EstabelecimentosService.search()` aceita os filtros `termo`, `tipo`, `especialidade`, `cidade` e `estado`, além da paginação por `pagina` e `limite`. Os filtros são combinados (RN04).

- `termo` pesquisa parcialmente em nome, cidade, bairro e especialidade (RN03).
- A busca por texto e cidade ignora acentos e diferenças entre maiúsculas e minúsculas (RN02, RN03).
- `cidade` é comparada pelo nome completo (RN02).
- `especialidade` aceita o ID ou o nome exato (RN06, A2).
- Os tipos aceitos são `HOSPITAL` e `CLINICA`, gravados assim no banco. O valor recebido é convertido para maiúsculas antes da comparação, então `clinica` encontra `CLINICA` (RN05).
- Os resultados são ordenados por nome (RN07).
- A paginação usa página 1 e limite 20 como padrões (RN08).
- A resposta da busca tem o formato `{ dados, paginacao }`. Quando a página pedida passa da última, `dados` vem vazio e `paginacao.total` mantém o total real (E5).
- Uma falha no banco é propagada pelo serviço (E6).

## Detalhe do estabelecimento

O método `EstabelecimentosService.findOne()` devolve o estabelecimento com endereço, coordenadas, especialidades, horários e mídias (passo 11, RN11, RN12). Um ID inexistente gera `404` com a mensagem "Estabelecimento não encontrado." (E8).

## Avaliações de um resultado

A rota `GET /estabelecimentos/{id}/reviews` chama `ReviewsService.listByEstabelecimento()` e devolve as avaliações da mais recente para a mais antiga, com nota, comentário, data e autor (A5). A paginação segue a mesma regra da busca: `pagina` e `limite`, 20 itens por padrão e resposta `{ dados, paginacao }` (RN08). Se o estabelecimento não existir, a resposta é `404` (E8).

A listagem de avaliações por usuário (`GET /usuarios/{id}/reviews`) não faz parte do UC01 e continua com a paginação anterior (`page`, `limit` e `{ data, meta }`).

## Banco de dados

A migration `20261016120000_tipo_clinica` renomeia o tipo `CLINIC`, herdado do enum antigo, para `CLINICA`. Só o nome muda: o ID continua o mesmo, então os estabelecimentos ligados a ele não são alterados. Em bancos que já têm `CLINICA`, a migration não faz nada.

## Testes unitários

Os testes chamam os serviços diretamente, sem passar pelo controller ou pela rota HTTP. As chamadas ao Prisma são simuladas; os testes não conectam a um banco de dados. O nome de cada teste indica o item da especificação que ele verifica.

`src/estabelecimentos/estabelecimentos.service.spec.ts`:

| Teste                                                                | Itens da especificação |
| -------------------------------------------------------------------- | ---------------------- |
| Busca sem filtros, com paginação padrão e mapeamento dos campos      | RN07, RN08, RN11       |
| Filtros combinados, texto normalizado e tipo `CLINICA`               | RN04, RN05, RN08       |
| Nenhum estabelecimento atende ao filtro                              | E1                     |
| Página além da última mantém o total real                            | E5                     |
| Especialidade enviada pelo ID                                        | A2, RN06               |
| Falha no banco é propagada                                           | E6                     |
| Detalhe com endereço, coordenadas, especialidades, mídias e horários | Passo 11, RN11, RN12   |
| ID inexistente gera `404`                                            | E8                     |

`src/reviews/reviews.service.spec.ts`:

| Teste                                                                             | Itens da especificação |
| --------------------------------------------------------------------------------- | ---------------------- |
| Avaliações da mais recente para a mais antiga, com nota, comentário, data e autor | A5                     |
| Paginação com `pagina` e `limite`                                                 | A5, RN08               |
| 20 avaliações por página como padrão                                              | A5, RN08               |
| Estabelecimento inexistente gera `404`                                            | A5, E8                 |

As regras que não pertencem aos serviços ficam fora desses testes: a recusa de parâmetros desconhecidos (RN09) é feita pela validação dos DTOs, o limite de requisições (RN10) pelo guard da API e a localização do visitante (RN14 a RN16) pelo front-end. A busca real no banco, com acentos e trechos de palavras (CA01, CA02, CA07 e CA10), depende de testes de integração.
