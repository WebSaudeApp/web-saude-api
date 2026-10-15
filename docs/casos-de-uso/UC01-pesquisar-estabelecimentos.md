# UC01 — Pesquisa de estabelecimentos

Este documento descreve as alterações realizadas na busca do serviço de estabelecimentos.

## Serviço de busca

O método `EstabelecimentosService.search()` aceita os filtros `termo`, `tipo`, `especialidade`, `cidade` e `estado`, além da paginação por `pagina` e `limite`. Os filtros são combinados.

- `termo` pesquisa parcialmente em nome, cidade, bairro e especialidade.
- A busca por texto e cidade ignora acentos e diferenças entre maiúsculas e minúsculas.
- `cidade` é comparada pelo nome completo.
- `especialidade` aceita o ID ou o nome exato.
- O tipo `CLINICA` é convertido para `CLINIC`, valor utilizado pelo model.
- Os resultados são ordenados por nome.
- A paginação usa página 1 e limite 20 como padrões.
- A resposta da busca tem o formato `{ dados, paginacao }`.

## Testes unitários

Os testes em `src/estabelecimentos/estabelecimentos.service.spec.ts` chamam o serviço diretamente, sem passar pelo controller ou pela rota HTTP. Eles verificam a paginação e o mapeamento dos resultados, a combinação e normalização dos filtros e o retorno vazio quando não há correspondências. As chamadas ao Prisma são simuladas; os testes não conectam a um banco de dados.
