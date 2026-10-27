# Web Saúde API

Backend da plataforma **Web Saúde**: busca e consulta de unidades de saúde (hospitais e clínicas).

![Capa da Web Saúde API](docs/images/capa.png)

O frontend (`web-saude-interface`) é um projeto separado. Esta API concentra autenticação, regras de negócio, permissões, validação, acesso ao banco e segurança.

Documentação da API no visual da plataforma: [https://web-saude-api.onrender.com/docs](https://web-saude-api.onrender.com/docs)

```
web-saude/
├── web-saude-api/         ← este repositório
└── web-saude-interface/
```

**Versão atual:** `0.0.1` — **FASE 7 (qualidade)** concluída.  
Fases 1–7 prontas. 2FA e avisos in-app ficam como endurecimento futuro.

---

## Sumário

- [Objetivo](#objetivo)
- [Status da implementação](#status-da-implementação)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Começando](#começando)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Como rodar](#como-rodar)
- [Endpoints disponíveis](#endpoints-disponíveis)
- [Documentação](#documentação)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Segurança já configurada](#segurança-já-configurada)
- [Scripts npm](#scripts-npm)
- [Testes](#testes)
- [Docker](#docker)
- [O que não commitar](#o-que-não-commitar)
- [Regras de desenvolvimento](#regras-de-desenvolvimento)

---

## Objetivo

A plataforma **Web Saúde** permite que pacientes e visitantes encontrem unidades de saúde (hospitais e clínicas) de forma ágil e inteligente, utilizando busca textual com tolerância a acentos e busca por proximidade geográfica (`geo_distance`) alimentada pelo **Elasticsearch** e persistida no **PostgreSQL (Supabase)**.

---

## Status da implementação

| Item | Status |
| --- | --- |
| NestJS + TypeScript | Pronto |
| ConfigModule + validação de `.env` | Pronto |
| Prisma + PostgreSQL (Supabase) | Pronto |
| Docker Compose (PostgreSQL, Elasticsearch, Kibana) | Pronto |
| Elasticsearch 8 (índice, `geo_point`, analisador `asciifolding`) | Pronto |
| Sincronização em tempo real e reindexação | Pronto |
| Busca por proximidade geográfica (`lat`, `lng`, `raioKm`) | Pronto |
| Paginação para scroll infinito (`temMais`, `totalPaginas`) | Pronto |
| Resiliência / Fallback relacional no PostgreSQL | Pronto |
| ValidationPipe global + DTOs em português | Pronto |
| Helmet + CORS | Pronto |
| Rate limiting (`ThrottlerModule`) | Pronto |
| Swagger/OpenAPI + Portal customizado (`/docs`) | Pronto |
| Health check operacional (`GET /health` com banco e Elasticsearch) | Pronto |
| CI/CD no GitHub Actions | Pronto |

---

## Stack

| Tecnologia | Uso |
| --- | --- |
| NestJS 11 | Framework HTTP |
| TypeScript | Linguagem |
| PostgreSQL 16 | Banco de dados |
| Prisma 6 | ORM e migrations |
| Elasticsearch 8 | Busca textual e geográfica (geo_distance) |
| Supabase | PostgreSQL hospedado (padrão atual) |
| Swagger | Documentação da API |
| Helmet | Headers HTTP de segurança |
| class-validator / class-transformer | Validação de entrada |
| Jest + Supertest | Testes unitários e E2E |
| Docker | PostgreSQL local e imagem da API |

Node.js recomendado: **22 LTS**.

---

## Pré-requisitos

- Node.js 22+
- npm 11+
- Docker Desktop (para rodar Elasticsearch, Kibana e PostgreSQL local)
- Conta Supabase (opcional, caso utilize banco PostgreSQL gerenciado em nuvem)
- Git

---

## Começando

### 1. Clonar / abrir o projeto

```bash
cd web-saude-api
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha `DATABASE_URL` e `DIRECT_URL` no `.env`. As variáveis do Elasticsearch já vêm pré-configuradas para o ambiente local (`http://localhost:9200`).  
O arquivo `.env` **não deve ir para o Git**.

### 3. Instalar dependências

```bash
npm install
```

O Prisma Client é gerado automaticamente no `postinstall`.

### 4. Subir os serviços com Docker (PostgreSQL, Elasticsearch e Kibana)

Para iniciar os serviços de infraestrutura local:

```bash
# Subir o Elasticsearch e o Kibana (painel visual):
docker compose up -d elasticsearch kibana

# Se você não usa Supabase e prefere o PostgreSQL local em container:
docker compose up -d postgres
```

- **Elasticsearch**: [http://localhost:9200](http://localhost:9200) (motor de busca textual e geo_distance)
- **Kibana**: [http://localhost:5601](http://localhost:5601) (painel visual e console Dev Tools)

### 5. Inicializar o índice e sincronizar os dados no Elasticsearch

Com o container do Elasticsearch rodando, prepare o índice e sincronize os dados:

```bash
# 1. Cria o índice 'estabelecimentos_v1' com mapeamento geo_point e analisador asciifolding:
npm run es:init

# 2. Sincroniza todos os estabelecimentos do PostgreSQL para o Elasticsearch:
npm run reindex
```

### 6. Iniciar a API

```bash
npm run start:dev
```

- **API**: [http://localhost:3000](http://localhost:3000)
- **Health check**: [http://localhost:3000/health](http://localhost:3000/health)
- **Swagger / Documentação**: [http://localhost:3000/docs](http://localhost:3000/docs)

---

## Variáveis de ambiente

Todas as variáveis abaixo são **obrigatórias**. A API não sobe se alguma estiver ausente ou inválida.

| Variável | Exemplo | Descrição |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `production` ou `test` |
| `PORT` | `3000` | Porta HTTP |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Origens permitidas, separadas por vírgula. **Nunca** use `*` em produção |
| `DATABASE_URL` | connection string do pooler (porta `6543`) | Prisma em runtime (modo transação / PgBouncer) |
| `DIRECT_URL` | connection string de sessão (porta `5432`) | Prisma Migrate e DDL |
| `THROTTLE_TTL_MS` | `60000` | Janela do rate limit, em milissegundos |
| `THROTTLE_LIMIT` | `100` | Máximo de requisições por IP na janela |
| `SWAGGER_ENABLED` | `true` | Painel em `/docs`. `true` em desenvolvimento e na Render atual |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | URL do cluster Elasticsearch (opcional, padrão `http://localhost:9200`) |
| `ELASTICSEARCH_USERNAME` | `elastic` | Usuário para autenticação básica no Elasticsearch (opcional) |
| `ELASTICSEARCH_PASSWORD` | `sua-senha` | Senha para autenticação básica no Elasticsearch (opcional) |
| `ELASTICSEARCH_API_KEY` | `chave-api-base64` | Chave de API para Elastic Cloud (opcional) |

### Senha na connection string

Caracteres especiais da senha precisam estar **URL-encoded**:

| Caractere | Encode |
| --- | --- |
| `#` | `%23` |
| `@` | `%40` |
| `%` | `%25` |
| ` ` (espaço) | `%20` |

Exemplo de URLs (placeholders):

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
```

PostgreSQL local (Docker):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/websaude"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/websaude"
```

---

## Banco de dados

### Prisma

Arquivo: `prisma/schema.prisma`

- `DATABASE_URL` — queries da aplicação (pooler)
- `DIRECT_URL` — migrations

Modelos atuais: `TipoEstabelecimento`, `Estabelecimento`, `Especialidade`, `EstabelecimentoEspecialidade`, `HorarioFuncionamento`, `Midia`, `Endereco`, `Contato`.

Comandos:

```bash
npx prisma generate          # gera o client
npx prisma migrate dev       # cria migration (a partir da FASE 2)
npx prisma migrate deploy    # aplica migrations em produção
npx prisma studio            # UI local das tabelas
```

Nunca altere o banco na mão de forma descontrolada. Sempre via migration versionada.

### Health check do banco

O `PrismaService` executa `SELECT 1` no `GET /health`.

---

## Como rodar

| Modo | Comando | Quando usar |
| --- | --- | --- |
| Desenvolvimento (watch) | `npm run start:dev` | Dia a dia |
| Debug | `npm run start:debug` | Breakpoints |
| Produção (já compilado) | `npm run build` e `npm run start:prod` | Deploy |

A API escuta em `http://localhost:${PORT}`.

---

## Endpoints disponíveis

### Saúde e Disponibilidade da API

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `GET` | `/` | pública | Retorna status simplificado (`{ "mensagem": "api online" }`) |
| `GET` | `/health` | pública (fora do rate limit) | Verifica integridade do PostgreSQL e do cluster Elasticsearch |
| `GET` | `/disponibilidade` | pública | Alias para `/health` |

Exemplo de resposta **200 OK**:
```json
{
  "status": "ok",
  "banco": "conectado",
  "elasticsearch": "conectado"
}
```

---

### Estabelecimentos e Busca Geográfica

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `GET` | `/estabelecimentos` | pública | Busca com filtros avançados e proximidade geográfica (`geo_distance`) |
| `GET` | `/estabelecimentos/tipos` | pública | Lista os tipos suportados (`HOSPITAL`, `CLINICA`) |
| `GET` | `/estabelecimentos/:id` | pública | Detalhes completos da unidade (endereço, horários, especialidades, fotos) |
| `POST` | `/estabelecimentos` | pública | Cadastra novo estabelecimento de saúde |
| `PATCH` | `/estabelecimentos/:id` | pública | Edição parcial dos dados da unidade |
| `DELETE` | `/estabelecimentos/:id` | pública | Exclusão lógica da unidade |
| `PUT` | `/estabelecimentos/:id/especialidades` | pública | Vincula especialidades atendidas |
| `PUT` | `/estabelecimentos/:id/horarios` | pública | Define quadro de horários de funcionamento |
| `POST` | `/estabelecimentos/:id/midias` | pública | Upload de fotos (JPG/PNG/WEBP até 5MB) |
| `DELETE` | `/estabelecimentos/:id/midias/:midiaId` | pública | Remove foto associada |
| `GET` | `/midias/:id` | pública | Detalhes de mídia específica |

#### Parâmetros de Busca Geográfica (`GET /estabelecimentos`):
- `termo`: texto livre em nome, cidade, bairro e especialidade (ignora acentos via `asciifolding`).
- `tipo`: tipo da unidade (`HOSPITAL` ou `CLINICA`).
- `especialidade`: ID ou nome da especialidade.
- `cidade` e `estado`: filtros textuais exatos ou parciais.
- `lat` e `lng`: coordenadas de geolocalização do usuário (ex: `-5.09194`, `-42.80336`).
- `raioKm`: raio de alcance em quilômetros (padrão `10`, máximo `50`).
- `pagina` e `limite`: controle de paginação (padrão `1` e `20`).

**Formato da resposta:**
```json
{
  "dados": [
    {
      "id": "uuid-da-unidade",
      "nome": "Hospital Regional Justino Luz",
      "tipo": { "id": "uuid", "nome": "HOSPITAL" },
      "endereco": {
        "cidade": "Picos",
        "estado": "PI",
        "latitude": -7.07897,
        "longitude": -41.46825
      },
      "distanciaKm": 1.2,
      "notaMedia": 4.5,
      "totalReviews": 12
    }
  ],
  "paginacao": {
    "pagina": 1,
    "limite": 20,
    "total": 45,
    "totalPaginas": 3,
    "temMais": true
  }
}
```

> **Scroll Infinito**: O campo `temMais` (`pagina < totalPaginas`) informa diretamente ao front-end se há novas páginas para carregar.  
> **Resiliência / Fallback**: Se o cluster Elasticsearch estiver temporariamente indisponível, a API faz fallback transparente para busca relacional no PostgreSQL.

---

## Documentação

O `/docs` **não usa Swagger UI**. É um portal no visual do Web Saúde: header, cards, papéis e login com e-mail/senha.

- Local: [http://localhost:3000/docs](http://localhost:3000/docs)
- Produção: [https://web-saude-api.onrender.com/docs](https://web-saude-api.onrender.com/docs)

Arquivos: `docs-assets/index.html`, `app.css`, `app.js`. A spec OpenAPI continua em `/docs-json` para ferramentas.

Entre com a mesma conta da plataforma. Depois abra uma rota e clique em **Enviar**.

![Portal de documentação Web Saúde](docs/images/portal.png)

---

## Arquitetura

![Arquitetura da API](docs/images/arquitetura.svg)

Fluxo interno de cada request:

```
Controller → DTO / Validation → Guard / Authorization → Service → Prisma → PostgreSQL
```

Regras de negócio ficam nos **services**, não nos controllers.

Módulos atuais:

| Módulo | Descrição / Responsabilidade |
| --- | --- |
| `busca` | Integração com Elasticsearch (indexação, busca full-text e geo_distance) |
| `common` | Configuração, filtros globais, interceptors, DTOs e validações |
| `database` | `PrismaService` global conectado ao PostgreSQL |
| `disponibilidade` | Health check (`GET /health`, `GET /`, status do banco e elasticsearch) |
| `docs` | Portal customizado de documentação da API (`/docs`) e OpenAPI (`/docs-json`) |
| `estabelecimentos` | Gestão completa de unidades de saúde, busca com geolocalização, horários e mídias |

---

## Estrutura de pastas

```
web-saude-api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   └── images/
├── docs-assets/
├── src/
│   ├── busca/
│   ├── common/
│   ├── database/
│   ├── disponibilidade/
│   ├── docs/
│   ├── estabelecimentos/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

---

## Segurança já configurada

- **Helmet** — headers HTTP
- **CORS** — lista explícita em `CORS_ORIGINS`; `*` bloqueado em produção
- **Rate limit** — 100 requisições / 60s por IP (ajustável). Endpoints de auth terão limite mais restrito na FASE 2
- **ValidationPipe** — `whitelist`, `forbidNonWhitelisted`, `transform`
- **Secrets** — somente no `.env`, nunca no código

O que **nunca** deve ir para logs: senha, JWT, refresh token, código de e-mail, token de recuperação, connection string.

Cada request autenticado ou público gera uma linha `METHOD /path status duração`. Corpos e headers sensíveis não são logados. Erros 500 vão para o logger sem stack na resposta HTTP.

---

## Scripts npm

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | Sobe a API em watch |
| `npm run start:debug` | Sobe com debugger |
| `npm run start:prod` | Sobe a build (`dist/`) |
| `npm run build` | Compila TypeScript |
| `npm run lint` | ESLint (com `--fix`) |
| `npm run lint:ci` | ESLint sem alterar arquivos (usado no GitHub Actions) |
| `npm run format` | Prettier |
| `npm test` | Testes unitários |
| `npm run test:watch` | Unitários em watch |
| `npm run test:cov` | Coverage |
| `npm run test:e2e` | Testes E2E (incluindo testes com Elasticsearch) |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run es:init` | Cria o índice `estabelecimentos_v1` com analisador `asciifolding`, mapeamento `geo_point` e alias |
| `npm run reindex` | Reindexa todos os estabelecimentos do PostgreSQL para o Elasticsearch |

---

## Testes

```bash
npm test
npm run test:e2e
```

Na FASE 7 já há:

- unitários extras (tokens, redação de logs, fluxo do gestor)
- E2E de auth, unidades, paciente, gestor e admin
- GitHub Actions (lint, migrate, unit, e2e, build) em todo push/PR para `main`
- log HTTP (método, rota, status, duração) sem senha/JWT
- dump operacional em `backups/` (`npm run backup`)

2FA e notificações in-app ficam como endurecimento futuro.

Variáveis mínimas para os testes estão em `test/setup-env.ts`.

---

## CI/CD

Workflow: `.github/workflows/ci.yml`.

Em cada push e pull request para `main`:

1. Sobe PostgreSQL 16
2. `npm ci`
3. `npm run lint:ci`
4. `npx prisma migrate deploy`
5. `npm test` e `npm run test:e2e`
6. `npm run build`

Deploy na Render continua por `autoDeploy` no `render.yaml`. A imagem Docker aplica `prisma migrate deploy` na subida.

---

## Docker

### Subir todos os serviços locais (PostgreSQL, Elasticsearch e Kibana)

Você pode subir toda a infraestrutura local com um único comando:

```bash
# Sobe todos os containers em background:
docker compose up -d

# Verificar se todos os containers estão saudáveis (healthy/up):
docker compose ps

# Acompanhar logs de todos os serviços:
docker compose logs -f

# Parar todos os serviços:
docker compose down
```

Serviços disponíveis:
- **API NestJS**: [http://localhost:3000](http://localhost:3000)
- **Elasticsearch 8**: [http://localhost:9200](http://localhost:9200)
- **Kibana (UI visual)**: [http://localhost:5601](http://localhost:5601)
- **PostgreSQL 16**: `localhost:5432`

---

### PostgreSQL local

```bash
docker compose up -d postgres
docker compose ps
docker compose logs -f postgres
docker compose down
```

Credenciais locais padrão: usuário `postgres`, senha `postgres`, banco `websaude`, porta `5432`.

Redis está **comentado** no `docker-compose.yml`, reservado para cache/filas (BullMQ) em fase futura. Não subir Redis só por subir.

### Elasticsearch local e Kibana

O Elasticsearch é utilizado para a busca textual tolerante a variações e acentos (`asciifolding`) e busca geográfica por proximidade (`geo_distance` / `geo_point`).

```bash
# Subir o Elasticsearch local com Docker (porta 9200)
docker compose up -d elasticsearch

# Verificar status do serviço
docker compose ps elasticsearch

# Testar se o nó está respondendo
curl -s http://localhost:9200/_cat/health?v

# Ver logs do Elasticsearch
docker compose logs -f elasticsearch

# Parar o serviço
docker compose stop elasticsearch

# Subir a interface visual do Kibana (opcional, porta 5601)
docker compose up -d kibana
```

**Kibana (Painel Visual):**
- Acesse via navegador em: [http://localhost:5601](http://localhost:5601)
- Permite gerenciar índices, checar mapeamentos e utilizar a ferramenta **Dev Tools** para testes manuais de consultas DSL (`geo_distance`, `match`, etc.).

**Configurações do container local:**
- Imagem: `docker.elastic.co/elasticsearch/elasticsearch:8.15.2` (nó único: `discovery.type=single-node`)
- Limites de memória: `512MB` de heap JVM (`ES_JAVA_OPTS=-Xms512m -Xmx512m`)
- Segurança local: `xpack.security.enabled=false` (acesso direto em `http://localhost:9200` para agilizar desenvolvimento)
- Persistência: volume nomeado `elasticsearch_data` em `/usr/share/elasticsearch/data`
- Healthcheck: validação contínua da saúde do cluster a cada 10s

#### Decisão de Produção para o Elasticsearch

Como o **Render** (onde a API está hospedada) não fornece serviço gerenciado de Elasticsearch, foram avaliadas as seguintes opções para o ambiente de produção:

1. **Elastic Cloud (SaaS gerenciado da Elastic):**
   - *Custo estimado:* ~\$16 a \$30 / mês (cluster de entrada com 1GB a 2GB RAM).
   - *Vantagens:* Gerenciado diretamente pela Elastic, com backups, patches de segurança e alta confiabilidade automáticos.
   - *Conexão:* HTTPS com `ELASTICSEARCH_NODE` e `ELASTICSEARCH_API_KEY` (ou Basic Auth).
2. **Servidor VPS Próprio (Hetzner / DigitalOcean / AWS Lightsail):**
   - *Custo estimado:* ~\$6 a \$12 / mês (instância 4GB RAM rodando Elasticsearch em Docker atrás de proxy SSL).
   - *Vantagens:* Custo fixo previsível e maior capacidade de memória para a mesma faixa de preço.

**Decisão Adotada:**
A API NestJS é totalmente agnóstica de provedor: a conexão é configurada via `ELASTICSEARCH_NODE`, `ELASTICSEARCH_USERNAME` e `ELASTICSEARCH_PASSWORD` (ou `ELASTICSEARCH_API_KEY`). Para produção inicial, adota-se **Elastic Cloud (plano inicial)** ou **VPS dedicada com Docker**, garantindo isolamento da memória do Elasticsearch em relação ao container da API.

### Imagem da API

```bash
docker build -t web-saude-api .
docker run --env-file .env -p 3000:3000 web-saude-api
```

O `Dockerfile` usa Node 22 Alpine, instala dependências, gera o Prisma Client e compila a API.

---

## O que não commitar

Já coberto pelo `.gitignore`:

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.env` e variantes locais
- logs, cache, temporários
- `uploads/` (imagens enviadas)

Pode ir para o Git: código-fonte, `package.json`, `package-lock.json`, `.env.example`, Prisma schema/migrations, Dockerfiles.

---

## Regras de desenvolvimento

- Não trocar NestJS, PostgreSQL ou Prisma sem autorização.
- Não instalar dependência sem necessidade clara.
- Não colocar secret no código nem credencial no Git.
- Não desabilitar segurança para “fazer funcionar”.
- Não usar `any` sem necessidade.
- Não ignorar erro de TypeScript.
- Controllers magros; regras de negócio e busca nos services.
- Lint, testes unitários e build depois de mudanças importantes.

---

## Licença

`UNLICENSED` — uso interno do projeto Web Saúde.
