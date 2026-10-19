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
- [Backup e restauração](#backup-e-restauração)
- [O que não commitar](#o-que-não-commitar)
- [Roadmap](#roadmap)
- [Regras de desenvolvimento](#regras-de-desenvolvimento)

---

## Objetivo

A plataforma permite que visitantes e usuários autenticados encontrem unidades de saúde, vejam detalhes, avaliem e favoritem estabelecimentos.

Três papéis autenticados:

| Papel | Descrição |
| --- | --- |
| `PATIENT` | Paciente: busca, favoritos, avaliações, perfil |
| `FUNCTIONAL` | Gestor de unidade: cadastro, rascunho, envio para aprovação |
| `ADMIN` | Administrador: aprovação, usuários, especialidades, auditoria |

Visitantes podem pesquisar sem conta.

![Papéis da plataforma](docs/images/papeis.svg)

---

## Status da implementação

| Item | Status |
| --- | --- |
| NestJS + TypeScript | Pronto |
| ConfigModule + validação de `.env` | Pronto |
| Prisma + PostgreSQL (Supabase) | Pronto |
| Docker Compose (PostgreSQL local) | Pronto |
| ValidationPipe global | Pronto |
| Helmet | Pronto |
| CORS | Pronto |
| Rate limiting | Pronto |
| Swagger/OpenAPI | Pronto |
| Health check (`GET /health`) | Pronto |
| Módulos de domínio (esqueleto) | Pronto |
| Login, JWT, refresh token | Pronto — FASE 2 |
| Unidades, especialidades, horários, imagens | Pronto — FASE 3 |
| Favoritos e avaliações | Pronto — FASE 4 |
| Fluxo do gestor | Pronto — FASE 5 |
| Painel admin | Pronto — FASE 6 |
| CI/CD, logs, backup operacional | Pronto — FASE 7 |

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
| JWT + refresh token | Autenticação |
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
| `JWT_ACCESS_SECRET` | string longa | Segredo do access token |
| `JWT_REFRESH_SECRET` | string longa (diferente) | Segredo do refresh token |
| `JWT_ACCESS_EXPIRES` | `15m` | Validade do access token |
| `JWT_REFRESH_EXPIRES` | `7d` | Validade do refresh token |
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

Modelos atuais: `User`, `Session`, `EmailVerification`, `PasswordReset`, `HealthUnit`, `Specialty`, `UnitSpecialty`, `OpeningHour`, `UnitImage`, `Review`, `Favorite`, `AuditLog`.

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

### Saúde da API

| Método | Rota | Auth |
| --- | --- | --- |
| `GET` | `/` | pública |
| `GET` | `/health` | pública (fora do rate limit) |

`GET /` devolve `{ "message": "api online" }`.

`GET /health` verifica a API e o PostgreSQL.

**200**

```json
{
  "status": "ok",
  "database": "connected"
}
```

**503** — banco indisponível.

### Autenticação (FASE 2)

| Método | Rota | Auth |
| --- | --- | --- |
| `POST` | `/auth/register` | pública |
| `POST` | `/auth/login` | pública |
| `POST` | `/auth/refresh` | pública |
| `POST` | `/auth/logout` | JWT |
| `POST` | `/auth/verify-email` | pública |
| `POST` | `/auth/resend-verification` | pública |
| `POST` | `/auth/forgot-password` | pública |
| `POST` | `/auth/reset-password` | pública |
| `GET` | `/users/me` | JWT |

Cadastro público só `PATIENT` ou `FUNCTIONAL`. Access token ~15 min; refresh 7 dias, revogável.

![Fluxo de autenticação JWT](docs/images/autenticacao.svg)

Entre no portal em `/docs` com e-mail e senha. O token entra sozinho nas rotas autenticadas.

### Perfil, favoritos e avaliações (FASE 4)

| Método | Rota | Auth |
| --- | --- | --- |
| `PATCH` | `/users/me` | JWT (nome e telefone) |
| `PATCH` | `/users/me/password` | JWT |
| `DELETE` | `/users/me` | JWT (confirma com senha; anonimiza dados) |
| `GET` | `/users/me/favorites` | JWT `PATIENT` |
| `GET` | `/users/me/reviews` | JWT `PATIENT` |
| `POST` | `/health-units/:id/favorite` | JWT `PATIENT` |
| `DELETE` | `/health-units/:id/favorite` | JWT `PATIENT` |
| `GET` | `/health-units/:id/reviews` | pública (unidade publicada) |
| `POST` | `/health-units/:id/reviews` | JWT `PATIENT` (uma por unidade) |
| `PATCH` | `/reviews/:id` | JWT dono da avaliação |
| `DELETE` | `/reviews/:id` | JWT dono da avaliação |

Favorito duplicado e avaliação duplicada retornam **409**. Gestor não avalia a própria unidade. A média `averageRating` é recalculada a cada avaliação. Encerrar a conta revoga sessões, remove favoritos, anonimiza nome/e-mail/telefone e faz soft delete das unidades do gestor.

### Estabelecimentos e busca geográfica (UC01 / Etapa 3)

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `GET` | `/estabelecimentos` | pública | Busca de unidades por filtros e por proximidade geográfica (`geo_distance`) |
| `GET` | `/estabelecimentos/tipos` | pública | Lista os tipos de estabelecimentos (`HOSPITAL`, `CLINICA`) |
| `GET` | `/estabelecimentos/:id` | pública | Detalhes completos da unidade (endereço, horários, especialidades, fotos) |
| `POST` | `/estabelecimentos` | JWT `FUNCTIONAL` | Cadastra novo estabelecimento com endereço |
| `PATCH` | `/estabelecimentos/:id` | JWT dono | Edição parcial de dados da unidade |
| `DELETE` | `/estabelecimentos/:id` | JWT dono | Exclusão lógica da unidade |
| `PUT` | `/estabelecimentos/:id/especialidades` | JWT dono | Define especialidades atendidas |
| `PUT` | `/estabelecimentos/:id/horarios` | JWT dono | Define horários de funcionamento |
| `POST` | `/estabelecimentos/:id/midias` | JWT dono | Upload de imagens (JPG/PNG/WEBP até 5MB) |
| `DELETE` | `/estabelecimentos/:id/midias/:midiaId` | JWT dono | Remove imagem |
| `GET` | `/estabelecimentos/:id/reviews` | pública | Lista avaliações da unidade paginadas (`pagina`, `limite`) |
| `POST` | `/estabelecimentos/:id/reviews` | JWT `PATIENT` | Cria uma avaliação com nota de 1 a 5 |

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
> **Resiliência / Fallback**: Se o Elasticsearch estiver indisponível ou offline, a API faz fallback transparente para a busca relacional no PostgreSQL.

Detalhes da especificação completa: [docs/casos-de-uso/UC01-pesquisar-estabelecimentos.md](docs/casos-de-uso/UC01-pesquisar-estabelecimentos.md).

Imagens ficam em `uploads/health-units/` e são servidas em `/uploads/health-units/...`.

Aprovação pelo admin: `PATCH /admin/health-units/:id/approve` ou `reject`.

### Painel admin (FASE 6)

| Método | Rota | Auth |
| --- | --- | --- |
| `GET` | `/admin/dashboard` | JWT `ADMIN` |
| `GET` | `/admin/health-units/pending` | JWT `ADMIN` |
| `PATCH` | `/admin/health-units/:id/approve` | JWT `ADMIN` — `PENDING` → `APPROVED` + `ACTIVE` |
| `PATCH` | `/admin/health-units/:id/reject` | JWT `ADMIN` — corpo `{ "reason": "..." }` |
| `GET` | `/admin/users` | JWT `ADMIN` (filtros `role`, `isActive`, paginação) |
| `PATCH` | `/admin/users/:id/status` | JWT `ADMIN` — `{ "isActive": true\|false }` |
| `POST` | `/admin/specialties` | JWT `ADMIN` |
| `PATCH` | `/admin/specialties/:id` | JWT `ADMIN` |
| `DELETE` | `/admin/specialties/:id` | JWT `ADMIN` (só se não estiver em uso) |
| `GET` | `/admin/audit` | JWT `ADMIN` |

Admin **não** aprova a própria unidade, **não** altera o próprio status e **não** desativa outros administradores. Ações ficam em `audit_logs`.

### Fluxo do gestor (FASE 5)

| Método | Rota | Auth |
| --- | --- | --- |
| `GET` | `/health-units/mine` | JWT `FUNCTIONAL` (filtro opcional `approvalStatus`) |
| `POST` | `/health-units/:id/submit` | JWT dono — `DRAFT` ou `REJECTED` → `PENDING` |
| `POST` | `/health-units/:id/withdraw` | JWT dono — `PENDING` → `DRAFT` |
| `PATCH` | `/health-units/:id/status` | JWT dono — só se `APPROVED` (`ACTIVE` / `INACTIVE`) |

Envio exige ao menos **uma especialidade** e **um horário**. Enquanto estiver `PENDING`, edição de dados, especialidades, horários e imagens retorna **409**. Unidade `REJECTED` devolve `rejectionReason` em `GET /health-units/mine`; ao reenviar, o motivo é limpo.

![Fluxo de aprovação da unidade](docs/images/fluxo-unidade.svg)

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

| Módulo | Papel agora | Papel futuro |
| --- | --- | --- |
| `health` | `GET /health` | Continua |
| `database` | `PrismaService` global | Continua |
| `common` | Validação de env | DTOs, filtros, paginação |
| `auth` | Registro, login, JWT, refresh | 2FA (endurecimento futuro) |
| `users` | Perfil, senha, exclusão de conta | Continua |
| `health-units` | CRUD, busca, envio para aprovação | Continua |
| `specialties` | Lista e cadastro | Edição/remoção no admin |
| `reviews` | Avaliações e média da unidade | Continua |
| `favorites` | Favoritos do paciente | Continua |
| `admin` | Dashboard, aprovação, usuários | Continua |
| `notifications` | Esqueleto | Avisos in-app |
| `audit` | Logs de ações administrativas | Continua |

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
│   ├── docs/
│   ├── admin/
│   ├── audit/
│   ├── auth/
│   ├── common/
│   ├── database/
│   ├── favorites/
│   ├── health/
│   ├── health-units/
│   ├── notifications/
│   ├── reviews/
│   ├── specialties/
│   ├── users/
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
- **Senha** — nunca será armazenada em texto puro (FASE 2: bcrypt)

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
| `npm run backup` | Dump lógico via `pg_dump` (`scripts/backup.ps1`) |
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

## Backup e restauração

Backup que nunca foi restaurado em teste **não** conta como backup.

Na máquina de desenvolvimento (requer `pg_dump` no PATH):

```bash
npm run backup
```

O arquivo vai para `backups/websaude-AAAAMMDD-HHMMSS.dump` (gitignored).

### Supabase

1. No painel: **Project Settings → Database → Backups** (PITR, se o plano permitir).
2. Dump lógico:

```bash
pg_dump "$DIRECT_URL" --format=custom --file=backup-websaude.dump
```

Guarde o arquivo fora da máquina de desenvolvimento (object storage, cofre da equipe). Não commitar dumps.

### PostgreSQL local (Docker)

```bash
docker compose exec postgres pg_dump -U postgres -d websaude --format=custom -f /tmp/backup.dump
docker compose cp postgres:/tmp/backup.dump ./backup-websaude.dump
```

### Restaurar

```bash
pg_restore --clean --if-exists --dbname="$DIRECT_URL" backup-websaude.dump
```

Local:

```bash
docker compose cp ./backup-websaude.dump postgres:/tmp/backup.dump
docker compose exec postgres pg_restore --clean --if-exists -U postgres -d websaude /tmp/backup.dump
```

### Como validar a restauração

1. Restaurar em um banco **separado** (nunca direto em produção na primeira vez).
2. Conferir `GET /health`.
3. Conferir contagem de tabelas críticas (quando existirem: `User`, `HealthUnit`, etc.).
4. Só então considerar o backup válido.

---

## O que não commitar

Já coberto pelo `.gitignore`:

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.env` e variantes locais
- logs, cache, temporários
- `uploads/` (imagens enviadas)
- `backups/*.dump`

Pode ir para o Git: código-fonte, `package.json`, `package-lock.json`, `.env.example`, Prisma schema/migrations, Dockerfiles.

---

## Roadmap

1. **FASE 1 — Base** (feita): NestJS, Prisma, Docker, Helmet, CORS, rate limit, Swagger, health.
2. **FASE 2 — Autenticação** (feita): User, register, login, JWT, refresh, logout, verificação de e-mail, recuperação de senha, guards.
3. **FASE 3 — Unidades** (feita): HealthUnit, especialidades, horários, imagens, busca, filtros, paginação.
4. **FASE 4 — Paciente** (feita): perfil, favoritos, avaliações, alteração de senha, exclusão de conta.
5. **FASE 5 — Gestor** (feita): minhas unidades, rascunho, envio para aprovação, edição, motivo de rejeição.
6. **FASE 6 — Admin** (feita): dashboard, pendências, aprovar/rejeitar, ativar/desativar usuários, especialidades, auditoria.
7. **FASE 7 — Qualidade** (feita): testes amplos, logs HTTP, backup operacional, CI/CD.

Cada fase só avança com autorização explícita.

---

## Regras de desenvolvimento

- Não trocar NestJS, PostgreSQL ou Prisma sem autorização.
- Não instalar dependência sem necessidade clara.
- Não colocar secret no código nem senha no Git.
- Não desabilitar segurança para “fazer funcionar”.
- Não usar `any` sem necessidade.
- Não ignorar erro de TypeScript.
- Controllers magros; regra no service.
- Lint, testes e build depois de mudanças importantes.
- Visitante pesquisa sem login; gestor só edita a própria unidade; admin nunca deixa o gestor aprovar a si mesmo.

---

## Licença

`UNLICENSED` — uso interno do projeto Web Saúde.
