-- Alinha os models ao diagrama de classes (Web Saúde), preservando os dados existentes.
-- Estratégia: RENAME de tabelas/colunas/constraints (sem perda de dado) + ALTER para
-- converter tipos, seguido da criação das tabelas novas (tipos_usuario,
-- tipos_estabelecimento, enderecos, contatos) e da migração dos dados que hoje vivem
-- em colunas soltas para essas tabelas.

-- ============================================================
-- 1. RENAME de tabelas para os nomes do diagrama
-- ============================================================
ALTER TABLE "users" RENAME TO "usuarios";
ALTER TABLE "health_units" RENAME TO "estabelecimentos";
ALTER TABLE "specialties" RENAME TO "especialidades";
ALTER TABLE "unit_specialties" RENAME TO "estabelecimento_especialidades";
ALTER TABLE "opening_hours" RENAME TO "horarios_funcionamento";
ALTER TABLE "unit_images" RENAME TO "midias";

-- ============================================================
-- 2. RENAME das constraints (pkey/unique) para acompanhar as tabelas
-- ============================================================
ALTER TABLE "usuarios" RENAME CONSTRAINT "users_pkey" TO "usuarios_pkey";
ALTER TABLE "estabelecimentos" RENAME CONSTRAINT "health_units_pkey" TO "estabelecimentos_pkey";
ALTER TABLE "especialidades" RENAME CONSTRAINT "specialties_pkey" TO "especialidades_pkey";
ALTER TABLE "estabelecimento_especialidades" RENAME CONSTRAINT "unit_specialties_pkey" TO "estabelecimento_especialidades_pkey";
ALTER TABLE "horarios_funcionamento" RENAME CONSTRAINT "opening_hours_pkey" TO "horarios_funcionamento_pkey";
ALTER TABLE "midias" RENAME CONSTRAINT "unit_images_pkey" TO "midias_pkey";

ALTER INDEX "users_email_key" RENAME TO "usuarios_email_key";
ALTER INDEX "specialties_name_key" RENAME TO "especialidades_nome_key";
ALTER INDEX "health_units_ownerId_idx" RENAME TO "estabelecimentos_ownerId_idx";
ALTER INDEX "unit_images_unitId_idx" RENAME TO "midias_estabelecimentoId_idx";

-- ============================================================
-- 3. RENAME de colunas simples (sem mudança de tipo)
-- ============================================================
ALTER TABLE "usuarios" RENAME COLUMN "name" TO "nome";
ALTER TABLE "estabelecimentos" RENAME COLUMN "name" TO "nome";
ALTER TABLE "especialidades" RENAME COLUMN "name" TO "nome";

ALTER TABLE "estabelecimento_especialidades" RENAME COLUMN "unitId" TO "estabelecimentoId";
ALTER TABLE "estabelecimento_especialidades" RENAME COLUMN "specialtyId" TO "especialidadeId";

ALTER TABLE "horarios_funcionamento" RENAME COLUMN "unitId" TO "estabelecimentoId";
ALTER TABLE "midias" RENAME COLUMN "unitId" TO "estabelecimentoId";

ALTER TABLE "reviews" RENAME COLUMN "unitId" TO "estabelecimentoId";
ALTER TABLE "reviews" RENAME COLUMN "userId" TO "autorId";
ALTER TABLE "reviews" RENAME COLUMN "rating" TO "nota";
ALTER TABLE "reviews" RENAME COLUMN "comment" TO "comentario";
ALTER TABLE "reviews" RENAME COLUMN "createdAt" TO "criadoEm";

ALTER TABLE "favorites" RENAME COLUMN "unitId" TO "estabelecimentoId";
ALTER TABLE "favorites" RENAME COLUMN "userId" TO "usuarioId";

ALTER TABLE "sessions" RENAME COLUMN "userId" TO "usuarioId";
ALTER TABLE "email_verifications" RENAME COLUMN "userId" TO "usuarioId";
ALTER TABLE "password_resets" RENAME COLUMN "userId" TO "usuarioId";

-- ============================================================
-- 4. RENAME das foreign keys e índices que citam as colunas acima
-- ============================================================
ALTER TABLE "estabelecimentos" RENAME CONSTRAINT "health_units_ownerId_fkey" TO "estabelecimentos_ownerId_fkey";

ALTER TABLE "estabelecimento_especialidades" RENAME CONSTRAINT "unit_specialties_unitId_fkey" TO "estabelecimento_especialidades_estabelecimentoId_fkey";
ALTER TABLE "estabelecimento_especialidades" RENAME CONSTRAINT "unit_specialties_specialtyId_fkey" TO "estabelecimento_especialidades_especialidadeId_fkey";

ALTER TABLE "horarios_funcionamento" RENAME CONSTRAINT "opening_hours_unitId_fkey" TO "horarios_funcionamento_estabelecimentoId_fkey";
DROP INDEX "opening_hours_unitId_dayOfWeek_key";
DROP INDEX "opening_hours_unitId_idx";

ALTER TABLE "midias" RENAME CONSTRAINT "unit_images_unitId_fkey" TO "midias_estabelecimentoId_fkey";

ALTER TABLE "reviews" RENAME CONSTRAINT "reviews_userId_fkey" TO "reviews_autorId_fkey";
ALTER TABLE "reviews" RENAME CONSTRAINT "reviews_unitId_fkey" TO "reviews_estabelecimentoId_fkey";
ALTER INDEX "reviews_userId_unitId_key" RENAME TO "reviews_autorId_estabelecimentoId_key";
ALTER INDEX "reviews_unitId_idx" RENAME TO "reviews_estabelecimentoId_idx";

ALTER TABLE "favorites" RENAME CONSTRAINT "favorites_userId_fkey" TO "favorites_usuarioId_fkey";
ALTER TABLE "favorites" RENAME CONSTRAINT "favorites_unitId_fkey" TO "favorites_estabelecimentoId_fkey";
ALTER INDEX "favorites_unitId_idx" RENAME TO "favorites_estabelecimentoId_idx";

ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_userId_fkey" TO "sessions_usuarioId_fkey";
ALTER INDEX "sessions_userId_idx" RENAME TO "sessions_usuarioId_idx";
ALTER TABLE "email_verifications" RENAME CONSTRAINT "email_verifications_userId_fkey" TO "email_verifications_usuarioId_fkey";
ALTER INDEX "email_verifications_userId_idx" RENAME TO "email_verifications_usuarioId_idx";
ALTER TABLE "password_resets" RENAME CONSTRAINT "password_resets_userId_fkey" TO "password_resets_usuarioId_fkey";
ALTER INDEX "password_resets_userId_idx" RENAME TO "password_resets_usuarioId_idx";

-- ============================================================
-- 5. TipoUsuario e TipoEstabelecimento: as tabelas substituem os enums
--    UserRole e HealthUnitType. Cada valor de enum vira uma linha, e o
--    mesmo texto (PATIENT, FUNCTIONAL, ADMIN, HOSPITAL, CLINIC) é
--    preservado como "nome", para não perder o significado do dado atual.
-- ============================================================
CREATE TABLE "tipos_usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "tipos_usuario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_usuario_nome_key" ON "tipos_usuario"("nome");

CREATE TABLE "tipos_estabelecimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "tipos_estabelecimento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_estabelecimento_nome_key" ON "tipos_estabelecimento"("nome");

INSERT INTO "tipos_usuario" ("id", "nome")
SELECT gen_random_uuid()::text, unnest(enum_range(NULL::"UserRole"))::text;

INSERT INTO "tipos_estabelecimento" ("id", "nome")
SELECT gen_random_uuid()::text, unnest(enum_range(NULL::"HealthUnitType"))::text;

ALTER TABLE "usuarios" ADD COLUMN "tipoId" TEXT;
UPDATE "usuarios" u SET "tipoId" = t."id"
FROM "tipos_usuario" t WHERE t."nome" = u."role"::text;
ALTER TABLE "usuarios" ALTER COLUMN "tipoId" SET NOT NULL;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tipoId_fkey"
  FOREIGN KEY ("tipoId") REFERENCES "tipos_usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuarios" DROP COLUMN "role";
DROP TYPE "UserRole";

ALTER TABLE "estabelecimentos" ADD COLUMN "tipoId" TEXT;
UPDATE "estabelecimentos" e SET "tipoId" = t."id"
FROM "tipos_estabelecimento" t WHERE t."nome" = e."type"::text;
ALTER TABLE "estabelecimentos" ALTER COLUMN "tipoId" SET NOT NULL;
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_tipoId_fkey"
  FOREIGN KEY ("tipoId") REFERENCES "tipos_estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "health_units_type_approvalStatus_status_idx";
ALTER TABLE "estabelecimentos" DROP COLUMN "type";
DROP TYPE "HealthUnitType";
CREATE INDEX "estabelecimentos_tipoId_approvalStatus_status_idx" ON "estabelecimentos"("tipoId", "approvalStatus", "status");

-- ============================================================
-- 6. Usuario: novos campos do diagrama (cpf, genero) e a ligação
--    opcional com Endereco (será preenchida no passo 8).
-- ============================================================
ALTER TABLE "usuarios" ADD COLUMN "cpf" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "genero" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "enderecoId" TEXT;

-- ============================================================
-- 7. Endereco: extrai o endereço embutido em "estabelecimentos"
--    para a tabela própria, incluindo o novo campo "bairro".
-- ============================================================
CREATE TABLE "enderecos" (
    "id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "enderecos_cidade_estado_idx" ON "enderecos"("cidade", "estado");

ALTER TABLE "estabelecimentos" ADD COLUMN "enderecoId" TEXT;
UPDATE "estabelecimentos" SET "enderecoId" = gen_random_uuid()::text;

INSERT INTO "enderecos" (
    "id", "cep", "logradouro", "numero", "complemento", "cidade", "estado",
    "latitude", "longitude", "createdAt", "updatedAt"
)
SELECT "enderecoId", "cep", "street", "number", "complement", "city", "state",
       "latitude"::double precision, "longitude"::double precision, "createdAt", "updatedAt"
FROM "estabelecimentos";

ALTER TABLE "estabelecimentos" ALTER COLUMN "enderecoId" SET NOT NULL;
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_enderecoId_key" UNIQUE ("enderecoId");
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_enderecoId_fkey"
  FOREIGN KEY ("enderecoId") REFERENCES "enderecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "health_units_city_state_idx";
ALTER TABLE "estabelecimentos"
  DROP COLUMN "street",
  DROP COLUMN "number",
  DROP COLUMN "complement",
  DROP COLUMN "city",
  DROP COLUMN "state",
  DROP COLUMN "cep",
  DROP COLUMN "latitude",
  DROP COLUMN "longitude";

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_enderecoId_key" UNIQUE ("enderecoId");
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_enderecoId_fkey"
  FOREIGN KEY ("enderecoId") REFERENCES "enderecos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 8. Contato: extrai email/phone/whatsapp/website de "estabelecimentos"
--    para a tabela própria (0..* por estabelecimento ou por usuário).
-- ============================================================
CREATE TYPE "TipoContato" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL', 'SITE');

CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT,
    "usuarioId" TEXT,
    "tipo" "TipoContato" NOT NULL,
    "valor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

INSERT INTO "contatos" ("id", "estabelecimentoId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'TELEFONE', btrim("phone")
FROM "estabelecimentos" WHERE "phone" IS NOT NULL AND btrim("phone") <> '';

INSERT INTO "contatos" ("id", "estabelecimentoId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'WHATSAPP', btrim("whatsapp")
FROM "estabelecimentos" WHERE "whatsapp" IS NOT NULL AND btrim("whatsapp") <> '';

INSERT INTO "contatos" ("id", "estabelecimentoId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'EMAIL', btrim("email")
FROM "estabelecimentos" WHERE "email" IS NOT NULL AND btrim("email") <> '';

INSERT INTO "contatos" ("id", "estabelecimentoId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'SITE', btrim("website")
FROM "estabelecimentos" WHERE "website" IS NOT NULL AND btrim("website") <> '';

ALTER TABLE "estabelecimentos"
  DROP COLUMN "email",
  DROP COLUMN "phone",
  DROP COLUMN "whatsapp",
  DROP COLUMN "website";

CREATE UNIQUE INDEX "contatos_estabelecimentoId_tipo_valor_key" ON "contatos"("estabelecimentoId", "tipo", "valor");
CREATE UNIQUE INDEX "contatos_usuarioId_tipo_valor_key" ON "contatos"("usuarioId", "tipo", "valor");

ALTER TABLE "contatos" ADD CONSTRAINT "contatos_estabelecimentoId_fkey"
  FOREIGN KEY ("estabelecimentoId") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 9. HorarioFuncionamento: dia da semana em português (DiaSemana) e
--    horários como tipo "time", mais o novo campo atende24h.
-- ============================================================
CREATE TYPE "DiaSemana" AS ENUM ('DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO');

ALTER TABLE "horarios_funcionamento" ADD COLUMN "diaSemana" "DiaSemana";
UPDATE "horarios_funcionamento" SET "diaSemana" = CASE "dayOfWeek"
  WHEN 'SUNDAY' THEN 'DOMINGO'
  WHEN 'MONDAY' THEN 'SEGUNDA'
  WHEN 'TUESDAY' THEN 'TERCA'
  WHEN 'WEDNESDAY' THEN 'QUARTA'
  WHEN 'THURSDAY' THEN 'QUINTA'
  WHEN 'FRIDAY' THEN 'SEXTA'
  WHEN 'SATURDAY' THEN 'SABADO'
END::"DiaSemana";
ALTER TABLE "horarios_funcionamento" ALTER COLUMN "diaSemana" SET NOT NULL;
ALTER TABLE "horarios_funcionamento" DROP COLUMN "dayOfWeek";
DROP TYPE "DayOfWeek";

ALTER TABLE "horarios_funcionamento"
  ALTER COLUMN "openTime" TYPE TIME USING "openTime"::time,
  ALTER COLUMN "closeTime" TYPE TIME USING "closeTime"::time;
ALTER TABLE "horarios_funcionamento" RENAME COLUMN "openTime" TO "horaAbertura";
ALTER TABLE "horarios_funcionamento" RENAME COLUMN "closeTime" TO "horaFechamento";

ALTER TABLE "horarios_funcionamento" ADD COLUMN "atende24h" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "horarios_funcionamento_estabelecimentoId_diaSemana_key" ON "horarios_funcionamento"("estabelecimentoId", "diaSemana");
CREATE INDEX "horarios_funcionamento_estabelecimentoId_idx" ON "horarios_funcionamento"("estabelecimentoId");

-- ============================================================
-- 10. Midia: novo campo "tipo" (fotos existentes viram FOTO) e "legenda".
-- ============================================================
CREATE TYPE "TipoMidia" AS ENUM ('FOTO', 'VIDEO');
ALTER TABLE "midias" ADD COLUMN "tipo" "TipoMidia" NOT NULL DEFAULT 'FOTO';
ALTER TABLE "midias" ADD COLUMN "legenda" TEXT;
