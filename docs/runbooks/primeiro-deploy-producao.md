# Runbook: Checklist do Primeiro Deploy na Hospedagem Paga (Produção)

> **Issue de Referência:** BE-33 (#55)  
> **Classificação:** Procedimento Operacional Padrão (SOP)  
> **Ambientes da Arquitetura:**
> - **Ambiente de Testes / Staging:** Render ([https://web-saude-api.onrender.com](https://web-saude-api.onrender.com)) alimentado pela branch `main`.
> - **Ambiente de Produção:** Hospedagem paga definitiva (ex.: AWS, Render pago, Railway, Google Cloud) alimentada exclusivamente pela branch `producao`.

---

## 1. Objetivo

Garantir que a primeira implantação da **Web Saúde API** em ambiente de produção real seja um procedimento seguro, repetível, sem surpresas de quebra de schema em banco com histórico, sem índices vazios no Elasticsearch e com health check confiável.

---

## 2. Matriz de Pré-requisitos Técnicos

Antes de iniciar o deploy em produção, todas as issues bloqueantes devem estar validadas e mergeadas na branch `producao`:

| Issue | Requisito | Como Verificar |
| :--- | :--- | :--- |
| **#37** | Módulo `/especialidades` ativo e funcional | `GET /especialidades` retorna lista de especialidades cadastradas (status 200). |
| **#38** | Health check desacoplado | `GET /health` responde 200 se o PostgreSQL estiver ativo (o corpo informa `elasticsearch: desconectado`, sem mudar o status HTTP). Conferir parando o ES e chamando `/health`. |
| **BE-31 (#53)** | Higienização de logs (LGPD) | Uma busca com `lat`, `lng` e `termo` gera log só com os **nomes** dos parâmetros (ex.: `GET /estabelecimentos [lat,lng,termo] 200 12ms`), nunca os valores. |
| **BE-34 (#59)** | Rate limit com anti-spoofing | Cabeçalho `X-Frontend-Proxy-Secret` compartilhado entre frontend e backend para validar `X-Forwarded-For`. |
| **QA-05 (#56)** | CI de upgrade de migrations | PR para `producao` executou o job `upgrade-migrations` com sucesso no GitHub Actions. |
| **QA-07 (#58)** | Isolamento de testes | A guarda `guard-test-env` bloqueia testes contra banco ou ES remotos. |

---

## 3. Configuração de Variáveis de Ambiente em Produção

Cadastrar as seguintes variáveis no painel da hospedagem de produção (todas obrigatórias, sem valores padrão de desenvolvimento):

```ini
# Ambiente
NODE_ENV=production
PORT=10000

# Banco de Dados Relacional (PostgreSQL - Supabase ou RDS)
# Pooler em modo transação (porta 6543) para operações da aplicação:
DATABASE_URL="postgresql://postgres:[SENHA]@[HOST-POOLER]:6543/postgres?pgbouncer=true"
# Conexão direta ou modo sessão (porta 5432) para migrations:
DIRECT_URL="postgresql://postgres:[SENHA]@[HOST-SESSION]:5432/postgres"

# CORS (origens estritas do front-end de produção - NUNCA use '*')
CORS_ORIGINS="https://app.websaude.com.br,https://admin.websaude.com.br"

# Rate Limiting Perimetral
THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=100
FRONTEND_PROXY_SECRET="[GERAR-SEGREDO-CRIPTOGRAFICO-MINIMO-32-CHARS]"
TRUST_PROXY=1

# Documentação Swagger (false por segurança em produção se for privada)
SWAGGER_ENABLED=true
PRODUCTION_URL="https://api.websaude.com.br"

# Cluster de Busca (Elasticsearch)
ELASTICSEARCH_NODE="https://[HOST-ELASTICSEARCH]:9200"
ELASTICSEARCH_API_KEY="[CHAVE-DE-API-DO-ELASTICSEARCH]"
# Ou se autenticar por Basic Auth:
# ELASTICSEARCH_USERNAME="elastic"
# ELASTICSEARCH_PASSWORD="[SENHA]"
```

> **Atenção (Front-End):** No painel da interface gráfica (`web-saude-interface`), configure a variável `WEB_SAUDE_API_URL` apontando para a URL oficial da API de produção (não deixe apontando para o Render de testes).

---

## 4. Procedimento de Marco Zero no Banco de Dados (Decisão D4)

> ⚠️ **REGRA DE OURO:** Uma migration aplicada num banco em que não é possível dar reset torna-se **imutável**. O squash inicial de migrations é legítimo se for deliberado, documentado e com dump prévio. **A partir do primeiro dado real, só migrations novas, para frente.**

### Passo 4.0: Saber o estado do banco antes de qualquer coisa
A migration `20261027120000_init_estabelecimentos` cria tudo do zero (sem `IF NOT EXISTS`). Num banco que já tem as 11 migrations antigas ela falha com `type "TipoContato" already exists`, e a migration falhada trava os deploys seguintes (`P3009`) até um `prisma migrate resolve` manual.

```sql
-- Retorna NULL se o banco nunca recebeu migrations (a tabela não existe)
SELECT to_regclass('public._prisma_migrations');
-- Se NÃO for NULL, liste o histórico:
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;
```
- **Banco vazio** (resultado `NULL`; produção nova): vá direto ao 4.2.
- **Banco com as migrations antigas** (ex.: o banco de teste): faça o reset do 4.1 antes do 4.2.

> **Evidência pendente (registrar no PR #28 antes do aceite):** o Render sobe o `607c4db` com sucesso, mas o `_prisma_migrations` do banco de teste só tem as migrations antigas. Anexar o log do deploy desse commit e o campo *Docker Command* do painel do Render. Hoje o `CMD` do Dockerfile **não executa `migrate deploy`** (commit `0be2145`): em qualquer hospedagem, a migration é um passo **manual** deste runbook.

### Passo 4.1: Backup e reset (só se o banco já tiver histórico)
Antes de qualquer comando destrutivo, **confirme que está no banco certo** (host e nome devem ser os do ambiente que você quer resetar):
```sql
SELECT current_database(), inet_server_addr(), current_user;
```
Faça o dump e **verifique** que ele é legível antes de seguir:
```bash
ARQ="backup_marco_zero_$(date +%Y%m%d_%H%M%S).dump"
pg_dump -h [HOST_BANCO] -U postgres -d postgres -F c -b -v -f "$ARQ" && pg_restore --list "$ARQ" > /dev/null && echo "DUMP OK"
```
*Só continue se aparecer `DUMP OK`. Guarde o arquivo em local externo e seguro.*

Preferência: **recriar o banco/projeto vazio** (é o caminho que preserva extensões, papéis e permissões da hospedagem). Se for realmente preciso resetar no mesmo banco, remova **somente os objetos da aplicação** (não use `DROP SCHEMA public CASCADE`, que também apaga extensões como `unaccent` e permissões do schema `public` em bancos gerenciados como o Supabase):
```sql
BEGIN;
DROP TABLE IF EXISTS contatos, horarios_funcionamento, midias, estabelecimento_especialidades,
  estabelecimentos, enderecos, especialidades, tipos_estabelecimento, _prisma_migrations CASCADE;
DROP TYPE IF EXISTS "DiaSemana", "TipoContato", "TipoMidia";
-- confira o que sobrou antes de confirmar:
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
COMMIT;  -- ou ROLLBACK; se algo estiver errado
```
A extensão `unaccent` é recriada pela própria migration (`CREATE EXTENSION IF NOT EXISTS`).

### Passo 4.2: Aplicação das migrations
Com `DIRECT_URL` (modo sessão):
```bash
npx prisma migrate deploy
```

### Passo 4.3: Validação da tabela de migrations
```sql
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC;
```
*Critério: todas as linhas com `finished_at` preenchido e `rolled_back_at` nulo.*

### Passo 4.4: Repor os dados de teste
Se houve reset, repor os dados necessários (o seed de `tipos_estabelecimento` já vem na migration). Os dados dos módulos removidos (usuários, avaliações) ficam só no dump.

### Passo 4.5: Registro
Registrar no PR/ADR: "squash pré-lançamento; daqui em diante, migrations aplicadas são imutáveis".

---

## 5. Carga Inicial e Sincronização do Elasticsearch

O contêiner da aplicação não executa reindexação automática no boot para evitar sobrecarga. A carga inicial deve ser disparada manualmente pós-deploy:

### Passo 5.1: Inicialização do Índice e Mapeamento
```bash
npm run es:init
```
*Garante a criação do índice `estabelecimentos_v1` com analisador `asciifolding` e normalizador `lowercase` + `asciifolding`, campos `geo_point` e vinculação do alias `estabelecimentos`.*

### Passo 5.2: Reindexação dos Dados Relacionais
```bash
npm run reindex
```

### Passo 5.3: Conferência Rigorosa de Contagem (Paridade)
Como o script de reindexação processa em lotes, execute a conferência manual de cardinalidade:
1. No PostgreSQL:
   ```sql
   SELECT count(*) FROM estabelecimentos;
   ```
2. No Elasticsearch:
   ```bash
   curl -s -H "Authorization: ApiKey $ELASTICSEARCH_API_KEY" "$ELASTICSEARCH_NODE/estabelecimentos/_count"
   ```
*Critério: O campo `count` do Elasticsearch deve coincidir com o total de registros do PostgreSQL.*

---

## 6. Bateria de Testes de Fumaça (Smoke Tests)

Com a API publicada, execute a validação operacional imediata dos 4 fluxos críticos:

```bash
# 1. Health Check
curl -i https://[URL_PRODUCAO]/health
# Esperado: HTTP 200 OK com status conectado

# 2. Especialidades
curl -i https://[URL_PRODUCAO]/especialidades
# Esperado: HTTP 200 OK com array JSON de especialidades

# 3. Busca Textual sem Localização
curl -i "https://[URL_PRODUCAO]/estabelecimentos?termo=hospital"
# Esperado: HTTP 200 OK com lista paginada

# 4. Busca Geográfica com Raio
curl -i "https://[URL_PRODUCAO]/estabelecimentos?lat=-8.0631&lng=-34.8711&raioKm=10"
# Esperado: HTTP 200 OK com itens ordenados por distanciaKm
```


---

## 7. Procedimento de Rollback

Caso o deploy apresente incompatibilidade impeditiva:
1. Reverter o tráfego de DNS / proxy para a versão anterior ou ativar página de manutenção.
2. Se o banco sofreu mutação indevida, restaurar o dump do Marco Zero:
   ```bash
   pg_restore -h [HOST_BANCO] -U postgres -d postgres -c -v "backup_marco_zero_XXXXX.dump"
   ```
3. Investigar o erro nos logs de observabilidade antes de nova tentativa.
