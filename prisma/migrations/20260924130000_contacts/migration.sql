-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL', 'SITE');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tipo" "ContactType" NOT NULL,
    "valor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- Migra os contatos gravados nas colunas de health_units (ignora vazios)
INSERT INTO "contacts" ("id", "unitId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'TELEFONE', btrim("phone")
FROM "health_units" WHERE "phone" IS NOT NULL AND btrim("phone") <> '';

INSERT INTO "contacts" ("id", "unitId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'WHATSAPP', btrim("whatsapp")
FROM "health_units" WHERE "whatsapp" IS NOT NULL AND btrim("whatsapp") <> '';

INSERT INTO "contacts" ("id", "unitId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'EMAIL', btrim("email")
FROM "health_units" WHERE "email" IS NOT NULL AND btrim("email") <> '';

INSERT INTO "contacts" ("id", "unitId", "tipo", "valor")
SELECT gen_random_uuid()::text, "id", 'SITE', btrim("website")
FROM "health_units" WHERE "website" IS NOT NULL AND btrim("website") <> '';

-- AlterTable
ALTER TABLE "health_units"
    DROP COLUMN "email",
    DROP COLUMN "phone",
    DROP COLUMN "whatsapp",
    DROP COLUMN "website";

-- CreateIndex
CREATE UNIQUE INDEX "contacts_unitId_tipo_valor_key" ON "contacts"("unitId", "tipo", "valor");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "health_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
