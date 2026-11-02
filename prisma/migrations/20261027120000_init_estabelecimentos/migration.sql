-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL', 'SITE');

-- CreateEnum
CREATE TYPE "TipoMidia" AS ENUM ('FOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO');

-- CreateTable
CREATE TABLE "tipos_estabelecimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "tipos_estabelecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estabelecimentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "enderecoId" TEXT NOT NULL,

    CONSTRAINT "estabelecimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estabelecimento_especialidades" (
    "estabelecimentoId" TEXT NOT NULL,
    "especialidadeId" TEXT NOT NULL,

    CONSTRAINT "estabelecimento_especialidades_pkey" PRIMARY KEY ("estabelecimentoId","especialidadeId")
);

-- CreateTable
CREATE TABLE "horarios_funcionamento" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaAbertura" TIME NOT NULL,
    "horaFechamento" TIME NOT NULL,
    "atende24h" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "horarios_funcionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "midias" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "tipo" "TipoMidia" NOT NULL DEFAULT 'FOTO',
    "url" TEXT NOT NULL,
    "legenda" TEXT,
    "bytes" BYTEA,

    CONSTRAINT "midias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "tipo" "TipoContato" NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_estabelecimento_nome_key" ON "tipos_estabelecimento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_enderecoId_key" ON "estabelecimentos"("enderecoId");

-- CreateIndex
CREATE INDEX "estabelecimentos_tipoId_idx" ON "estabelecimentos"("tipoId");

-- CreateIndex
CREATE UNIQUE INDEX "especialidades_nome_key" ON "especialidades"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_funcionamento_estabelecimentoId_diaSemana_key" ON "horarios_funcionamento"("estabelecimentoId", "diaSemana");

-- CreateIndex
CREATE INDEX "midias_estabelecimentoId_idx" ON "midias"("estabelecimentoId");

-- CreateIndex
CREATE INDEX "enderecos_cidade_estado_idx" ON "enderecos"("cidade", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_estabelecimentoId_tipo_valor_key" ON "contatos"("estabelecimentoId", "tipo", "valor");

-- AddForeignKey
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "tipos_estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "enderecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estabelecimento_especialidades" ADD CONSTRAINT "estabelecimento_especialidades_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estabelecimento_especialidades" ADD CONSTRAINT "estabelecimento_especialidades_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "especialidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_funcionamento" ADD CONSTRAINT "horarios_funcionamento_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "midias" ADD CONSTRAINT "midias_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed inicial de tipos de estabelecimento
INSERT INTO "tipos_estabelecimento" ("id", "nome") VALUES
  ('11111111-1111-4111-8111-111111111111', 'HOSPITAL'),
  ('22222222-2222-4222-8222-222222222222', 'CLINICA')
ON CONFLICT ("nome") DO NOTHING;

