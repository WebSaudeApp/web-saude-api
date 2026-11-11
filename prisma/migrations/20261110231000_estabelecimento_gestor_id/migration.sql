-- AlterTable
ALTER TABLE "estabelecimentos" ADD COLUMN IF NOT EXISTS "gestorId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "estabelecimentos_gestorId_idx" ON "estabelecimentos"("gestorId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'estabelecimentos_gestorId_fkey'
    ) THEN
        ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
