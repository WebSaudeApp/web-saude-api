-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- Migra o endereço das unidades existentes: cada unidade ganha um endereço próprio
ALTER TABLE "health_units" ADD COLUMN "addressId" TEXT;
UPDATE "health_units" SET "addressId" = gen_random_uuid()::text;

INSERT INTO "addresses" (
    "id", "cep", "logradouro", "numero", "complemento", "cidade", "estado",
    "latitude", "longitude", "createdAt", "updatedAt"
)
SELECT
    "addressId", "cep", "street", "number", "complement", "city", "state",
    "latitude", "longitude", "createdAt", "updatedAt"
FROM "health_units";

ALTER TABLE "health_units" ALTER COLUMN "addressId" SET NOT NULL;

-- DropIndex
DROP INDEX "health_units_city_state_idx";

-- AlterTable
ALTER TABLE "health_units"
    DROP COLUMN "street",
    DROP COLUMN "number",
    DROP COLUMN "complement",
    DROP COLUMN "city",
    DROP COLUMN "state",
    DROP COLUMN "cep",
    DROP COLUMN "latitude",
    DROP COLUMN "longitude";

-- CreateIndex
CREATE INDEX "addresses_cidade_estado_idx" ON "addresses"("cidade", "estado");
CREATE UNIQUE INDEX "health_units_addressId_key" ON "health_units"("addressId");

-- AddForeignKey
ALTER TABLE "health_units" ADD CONSTRAINT "health_units_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
