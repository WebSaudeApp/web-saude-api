# BE-13 — Decisão Técnica: Paginação para o Scroll Infinito (from/size vs search_after)

Este documento registra a decisão técnica referente à estratégia de paginação para o suporte a scroll infinito na busca de estabelecimentos de saúde, atendendo aos requisitos da demanda **BE-13**.

---

## 1. Contexto e Requisitos

O front-end do Web Saúde (módulo de busca e mapa) implementa scroll infinito na lista de resultados (**FE-08**), requisitando páginas adicionais à medida que o usuário rola a tela.

Critérios essenciais:
- As páginas consecutivas não podem pular nem repetir estabelecimentos.
- A resposta deve informar o total de itens e se ainda há itens adicionais para carregar (`temMais: boolean`).
- Baixa latência e simplicidade de integração.

---

## 2. Comparativo entre Abordagens

| Critério | `from / size` | `search_after` (Cursor) |
|---|---|---|
| **Complexidade no Front-end** | Baixa (`pagina=1`, `pagina=2`...) | Média (envio de array de cursor da última linha) |
| **Compatibilidade com DTOs** | Total com `PaginacaoQueryDto` (`pagina`, `limite`) | Requer DTO com token/cursor opaco |
| **Limite de Documentos** | Até 10.000 (`max_result_window`) | Ilimitado |
| **Desempate Estável** | Garantido via `nome.keyword` e `id` | Garantido via `nome.keyword` e `id` |

---

## 3. Decisão Técnica Adotada: `from / size`

Optou-se pela estratégia **`from / size`** pelas seguintes razões técnicas e de negócio:

1. **Volume de Dados Geográfico Delimitado**:
   - A busca por proximidade possui raio máximo delimitado a **50 km** (**BE-12**).
   - Mesmo na maior região metropolitana do Brasil (São Paulo), o número de estabelecimentos de saúde contidos em um raio de 50 km é de poucas centenas, estando ordens de magnitude abaixo do limite de 10.000 documentos do Elasticsearch.

2. **Simplicidade e Consistência de API**:
   - Mantém o contrato uniforme `{ dados, paginacao: { pagina, limite, total, totalPaginas, temMais } }` em toda a API do Web Saúde (tanto para a busca no Elasticsearch quanto para a listagem direta no PostgreSQL).

3. **Garantia de Não-Repetição (Ordem Estável)**:
   - Para evitar que itens sejam repetidos ou pulados durante o scroll infinito, a consulta no Elasticsearch utiliza ordenação composta determinística:
     1. Proximidade: `_geo_distance` (ascendente)
     2. Desempate 1: `nome.keyword` (ascendente)
     3. Desempate 2: `id` (ascendente)
