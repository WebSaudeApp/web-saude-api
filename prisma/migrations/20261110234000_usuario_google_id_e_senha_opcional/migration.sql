-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "usuarios" ALTER COLUMN "senhaHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_googleId_key" ON "usuarios"("googleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuarios_googleId_idx" ON "usuarios"("googleId");
