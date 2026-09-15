# Web Saúde API

Backend da plataforma **Web Saúde**: busca e consulta de unidades de saúde (hospitais e clínicas).

O frontend (`web-saude-ui`) é um projeto separado. Esta API concentra autenticação, regras de negócio, permissões, validação, acesso ao banco e segurança.

```
web-saude/
├── web-saude-api/    ← este repositório
└── web-saude-ui/
```

**Versão atual:** `0.0.1` — **FASE 3 (unidades)** concluída.  
Fases 1–3 prontas. Favoritos, avaliações, fluxo de aprovação do gestor e painel admin ainda **não** estão implementados.

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
- [Swagger](#swagger)
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
| Favoritos e avaliações | Pendente — FASE 4 |
| Fluxo do gestor | Pendente — FASE 5 |
| Painel admin | Pendente — FASE 6 |
| CI/CD, logs avançados, 2FA | Pendente — FASE 7 |

---

## Stack

| Tecnologia | Uso |
| --- | --- |
| NestJS 11 | Framework HTTP |
| TypeScript | Linguagem |
| PostgreSQL 16 | Banco de dados |
| Prisma 6 | ORM e migrations |
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
- Conta Supabase **ou** Docker (para PostgreSQL local)
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

Preencha `DATABASE_URL` e `DIRECT_URL` no `.env`.  
O arquivo `.env` **não deve ir para o Git**.

### 3. Instalar dependências

```bash
npm install
```

O Prisma Client é gerado automaticamente no `postinstall`.

### 4. Subir o banco (se for local)

Com Supabase, pule este passo. Com Docker:

```bash
docker compose up -d postgres
```

### 5. Iniciar a API

```bash
npm run start:dev
```

- API: [http://localhost:3000](http://localhost:3000)
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)

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
| `SWAGGER_ENABLED` | `true` | `true` em desenvolvimento; `false` em produção |
| `JWT_ACCESS_SECRET` | string longa | Segredo do access token |
| `JWT_REFRESH_SECRET` | string longa (diferente) | Segredo do refresh token |
| `JWT_ACCESS_EXPIRES` | `15m` | Validade do access token |
| `JWT_REFRESH_EXPIRES` | `7d` | Validade do refresh token |

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

Modelos atuais: `User`, `Session`, `EmailVerification`, `PasswordReset`, `HealthUnit`, `Specialty`, `UnitSpecialty`, `OpeningHour`, `UnitImage`.

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

### Unidades e especialidades (FASE 3)

| Método | Rota | Auth |
| --- | --- | --- |
| `GET` | `/health-units` | pública (só `APPROVED` + `ACTIVE`) |
| `GET` | `/health-units/mine` | JWT `FUNCTIONAL` |
| `GET` | `/health-units/:id` | pública se publicada; dono/admin vê rascunho |
| `POST` | `/health-units` | JWT `FUNCTIONAL` (cria `DRAFT` / `INACTIVE`) |
| `PATCH` | `/health-units/:id` | JWT dono |
| `DELETE` | `/health-units/:id` | JWT dono (soft delete) |
| `PUT` | `/health-units/:id/specialties` | JWT dono |
| `PUT` | `/health-units/:id/opening-hours` | JWT dono |
| `POST` | `/health-units/:id/images` | JWT dono (multipart, JPG/PNG/WEBP, máx. 5MB, 10 por unidade) |
| `PATCH` | `/health-units/:id/images/:imageId/main` | JWT dono |
| `DELETE` | `/health-units/:id/images/:imageId` | JWT dono |
| `GET` | `/specialties` | pública |
| `POST` | `/specialties` | JWT `FUNCTIONAL` ou `ADMIN` |

Busca pública (`GET /health-units`) aceita `search`, `type`, `city`, `state`, `specialty`, `rating`, `sort` (`name` \| `createdAt` \| `rating`) e paginação `page` / `limit` (máx. 100). Resposta: `{ data, meta }`.

Imagens ficam em `uploads/health-units/` e são servidas em `/uploads/health-units/...`.

Aprovação de unidades é da **FASE 6**. Enquanto isso, testes e o Prisma Studio podem marcar uma unidade como `APPROVED` + `ACTIVE` para ela aparecer na busca pública.

### Rotas previstas (ainda não existem)

| Método | Rota | Fase |
| --- | --- | --- |
| `POST` | `/health-units/:id/favorite` | 4 |
| `GET` | `/users/me/favorites` | 4 |
| `PATCH` | `/admin/health-units/:id/approve` | 6 |
| `PATCH` | `/admin/health-units/:id/reject` | 6 |

---

## Swagger

Com `SWAGGER_ENABLED=true`:

[http://localhost:3000/docs](http://localhost:3000/docs)

A documentação já está preparada para Bearer JWT (usado a partir da FASE 2). Em produção, desligue o Swagger (`SWAGGER_ENABLED=false`).

---

## Arquitetura

Fluxo padrão das próximas fases:

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
| `auth` | Registro, login, JWT, refresh | 2FA na FASE 7 |
| `users` | `GET /users/me` | Perfil, papéis, LGPD |
| `health-units` | CRUD, busca, imagens, horários | Envio para aprovação (FASE 5) |
| `specialties` | Lista e cadastro | Gestão avançada no admin |
| `reviews` | Esqueleto | Avaliações |
| `favorites` | Esqueleto | Favoritos |
| `admin` | Esqueleto | Aprovação, dashboard, usuários |
| `notifications` | Esqueleto | Avisos in-app |
| `audit` | Esqueleto | Logs de auditoria |

---

## Estrutura de pastas

```
web-saude-api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
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

---

## Scripts npm

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | Sobe a API em watch |
| `npm run start:debug` | Sobe com debugger |
| `npm run start:prod` | Sobe a build (`dist/`) |
| `npm run build` | Compila TypeScript |
| `npm run lint` | ESLint (com `--fix`) |
| `npm run format` | Prettier |
| `npm test` | Testes unitários |
| `npm run test:watch` | Unitários em watch |
| `npm run test:cov` | Coverage |
| `npm run test:e2e` | Testes E2E |
| `npm run prisma:generate` | Gera o Prisma Client |

---

## Testes

```bash
npm test
npm run test:e2e
```

Na FASE 3 já há:

- unitário do `GET /health` e da paginação
- E2E de auth (registro, login, token)
- E2E de unidades (paciente 403, dono edita, outro gestor 403, rascunho oculto, busca paginada)

Ainda virão: aprovação/rejeição, avaliação duplicada, favorito duplicado, exclusão de conta.

Variáveis mínimas para os testes estão em `test/setup-env.ts`.

---

## Docker

### PostgreSQL local

```bash
docker compose up -d postgres
docker compose ps
docker compose logs -f postgres
docker compose down
```

Credenciais locais padrão: usuário `postgres`, senha `postgres`, banco `websaude`, porta `5432`.

Redis está **comentado** no `docker-compose.yml`, reservado para cache/filas (BullMQ) em fase futura. Não subir Redis só por subir.

### Imagem da API

```bash
docker build -t web-saude-api .
docker run --env-file .env -p 3000:3000 web-saude-api
```

O `Dockerfile` usa Node 22 Alpine, instala dependências, gera o Prisma Client e compila a API.

---

## Backup e restauração

Backup que nunca foi restaurado em teste **não** conta como backup.

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

Pode ir para o Git: código-fonte, `package.json`, `package-lock.json`, `.env.example`, Prisma schema/migrations, Dockerfiles.

---

## Roadmap

1. **FASE 1 — Base** (feita): NestJS, Prisma, Docker, Helmet, CORS, rate limit, Swagger, health.
2. **FASE 2 — Autenticação** (feita): User, register, login, JWT, refresh, logout, verificação de e-mail, recuperação de senha, guards.
3. **FASE 3 — Unidades** (feita): HealthUnit, especialidades, horários, imagens, busca, filtros, paginação.
4. **FASE 4 — Paciente:** perfil, favoritos, avaliações, alteração de senha, exclusão de conta.
5. **FASE 5 — Gestor:** minhas unidades, rascunho, envio para aprovação, edição, motivo de rejeição.
6. **FASE 6 — Admin:** dashboard, pendências, aprovar/rejeitar, ativar/desativar usuários, especialidades, auditoria.
7. **FASE 7 — Qualidade:** testes amplos, logs, backup operacional, CI/CD.

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
