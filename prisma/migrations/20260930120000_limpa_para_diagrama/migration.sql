-- Cutover para o schema 100% igual ao diagrama de classes: remove tudo que não
-- está nele. Único campo fora do diagrama mantido de propósito: Midia.bytes
-- (conteúdo real das imagens).
--
-- Nada é apagado sem cópia: antes de qualquer DROP, os dados removidos são
-- arquivados no schema "legado" (fora do schema public, que é o único que o
-- Prisma gerencia e o único exposto pela API do Supabase). Lá ficam login e
-- senha, contatos e flags dos usuários, dono e fluxo de aprovação das unidades,
-- timestamps, e cópias completas das tabelas sessions, email_verifications,
-- password_resets, favorites e audit_logs.
--
-- Depois desta migration a API não autentica mais ninguém nem aprova unidades:
-- essas funções saíram do código junto com o schema.

-- ============================================================
-- 1. Arquivo dos dados que vão ser removidos
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "legado";

CREATE TABLE "legado"."usuarios" AS
SELECT "id", "email", "phone", "passwordHash", "emailVerified", "isActive",
       "createdAt", "updatedAt", "deletedAt"
FROM "usuarios";

CREATE TABLE "legado"."estabelecimentos" AS
SELECT "id", "ownerId", "description", "status"::text AS "status",
       "approvalStatus"::text AS "approvalStatus", "rejectionReason",
       "averageRating", "createdAt", "updatedAt", "deletedAt"
FROM "estabelecimentos";

CREATE TABLE "legado"."especialidades" AS
SELECT "id", "createdAt", "updatedAt" FROM "especialidades";

CREATE TABLE "legado"."horarios_funcionamento" AS
SELECT "id", "active" FROM "horarios_funcionamento";

CREATE TABLE "legado"."midias" AS
SELECT "id", "isMain", "createdAt" FROM "midias";

CREATE TABLE "legado"."enderecos" AS
SELECT "id", "createdAt", "updatedAt" FROM "enderecos";

CREATE TABLE "legado"."contatos" AS
SELECT "id", "createdAt" FROM "contatos";

CREATE TABLE "legado"."reviews" AS
SELECT "id", "updatedAt" FROM "reviews";

CREATE TABLE "legado"."sessions" AS TABLE "sessions";
CREATE TABLE "legado"."email_verifications" AS TABLE "email_verifications";
CREATE TABLE "legado"."password_resets" AS TABLE "password_resets";
CREATE TABLE "legado"."favorites" AS TABLE "favorites";
CREATE TABLE "legado"."audit_logs" AS TABLE "audit_logs";

-- ============================================================
-- 2. E-mail e telefone dos usuários viram Contato, como já acontece com os
--    estabelecimentos. Contas encerradas (deletedAt) foram anonimizadas e não
--    têm contato real para levar.
-- ============================================================
INSERT INTO "contatos" ("id", "usuarioId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'EMAIL', lower(btrim("email"))
FROM "usuarios"
WHERE "deletedAt" IS NULL AND "email" IS NOT NULL AND btrim("email") <> '';

INSERT INTO "contatos" ("id", "usuarioId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'TELEFONE', btrim("phone")
FROM "usuarios"
WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL AND btrim("phone") <> '';

-- ============================================================
-- 3. Sem deletedAt, unidades removidas por soft delete voltariam a aparecer na
--    busca. Elas já estão arquivadas no passo 1 e saem de vez, com o endereço.
-- ============================================================
CREATE TEMP TABLE "enderecos_removidos" AS
SELECT "enderecoId" AS "id" FROM "estabelecimentos" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "estabelecimentos" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "enderecos" WHERE "id" IN (SELECT "id" FROM "enderecos_removidos");
DROP TABLE "enderecos_removidos";

-- ============================================================
-- 4. Tabelas inteiras que não existem no diagrama
-- ============================================================
DROP TABLE "sessions";
DROP TABLE "email_verifications";
DROP TABLE "password_resets";
DROP TABLE "favorites";
DROP TABLE "audit_logs";

-- ============================================================
-- 5. Usuario: fica só com id, nome, cpf, genero, endereco, contatos, tipo
-- ============================================================
ALTER TABLE "usuarios"
  DROP COLUMN "email",
  DROP COLUMN "phone",
  DROP COLUMN "passwordHash",
  DROP COLUMN "emailVerified",
  DROP COLUMN "isActive",
  DROP COLUMN "createdAt",
  DROP COLUMN "updatedAt",
  DROP COLUMN "deletedAt";

-- ============================================================
-- 6. Estabelecimento: fica só com id, nome, tipo, endereco, contatos,
--    especialidades, midias, horarios, reviews. O vínculo com o "dono"
--    (Usuario) some junto, porque o diagrama não modela essa relação.
-- ============================================================
ALTER TABLE "estabelecimentos" DROP CONSTRAINT "estabelecimentos_ownerId_fkey";
DROP INDEX "estabelecimentos_ownerId_idx";
DROP INDEX "estabelecimentos_tipoId_approvalStatus_status_idx";
ALTER TABLE "estabelecimentos"
  DROP COLUMN "description",
  DROP COLUMN "ownerId",
  DROP COLUMN "status",
  DROP COLUMN "approvalStatus",
  DROP COLUMN "rejectionReason",
  DROP COLUMN "averageRating",
  DROP COLUMN "createdAt",
  DROP COLUMN "updatedAt",
  DROP COLUMN "deletedAt";
CREATE INDEX "estabelecimentos_tipoId_idx" ON "estabelecimentos"("tipoId");
DROP TYPE "HealthUnitStatus";
DROP TYPE "ApprovalStatus";

-- ============================================================
-- 7. Especialidade: fica só com id, nome
-- ============================================================
ALTER TABLE "especialidades"
  DROP COLUMN "createdAt",
  DROP COLUMN "updatedAt";

-- ============================================================
-- 8. HorarioFuncionamento: remove "active" (não existe no diagrama). O índice
--    único (estabelecimentoId, diaSemana) já atende a busca por estabelecimento.
-- ============================================================
ALTER TABLE "horarios_funcionamento" DROP COLUMN "active";
DROP INDEX "horarios_funcionamento_estabelecimentoId_idx";

-- ============================================================
-- 9. Midia: remove isMain e createdAt. "bytes" foi mantido de propósito.
-- ============================================================
ALTER TABLE "midias"
  DROP COLUMN "isMain",
  DROP COLUMN "createdAt";

-- ============================================================
-- 10. Endereco: remove createdAt/updatedAt
-- ============================================================
ALTER TABLE "enderecos"
  DROP COLUMN "createdAt",
  DROP COLUMN "updatedAt";

-- ============================================================
-- 11. Contato: remove createdAt
-- ============================================================
ALTER TABLE "contatos" DROP COLUMN "createdAt";

-- ============================================================
-- 12. Review: remove updatedAt. O índice por estabelecimentoId é mantido (as
--     listagens filtram só por ele); a migration seguinte o recria caso um
--     banco já tenha rodado a versão anterior desta, que o removia.
-- ============================================================
ALTER TABLE "reviews" DROP COLUMN "updatedAt";
