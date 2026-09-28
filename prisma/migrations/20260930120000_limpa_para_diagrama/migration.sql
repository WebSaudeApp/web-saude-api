-- Deixa o schema 100% igual ao diagrama de classes: remove tudo que não está
-- nele. Único campo fora do diagrama que foi mantido de propósito: Midia.bytes
-- (conteúdo real das imagens), decisão explícita.
--
-- ATENÇÃO: esta migration é destrutiva e definitiva. Ela apaga login/senha
-- (passwordHash, email, sessões, verificação de e-mail, redefinição de
-- senha), o dono e o fluxo de aprovação de cada estabelecimento, os
-- favoritos e o log de auditoria. Depois dela não é mais possível autenticar
-- nem aprovar/reprovar unidades pelo banco atual. Só reversível restaurando
-- o backup feito antes de rodar (backups/websaude-pre-diagrama-*.dump).

-- ============================================================
-- 1. Tabelas inteiras que não existem no diagrama
-- ============================================================
DROP TABLE "sessions";
DROP TABLE "email_verifications";
DROP TABLE "password_resets";
DROP TABLE "favorites";
DROP TABLE "audit_logs";

-- ============================================================
-- 2. Usuario: fica só com id, nome, cpf, genero, endereco, contatos, tipo
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
-- 3. Estabelecimento: fica só com id, nome, tipo, endereco, contatos,
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
-- 4. Especialidade: fica só com id, nome
-- ============================================================
ALTER TABLE "especialidades"
  DROP COLUMN "createdAt",
  DROP COLUMN "updatedAt";

-- ============================================================
-- 5. HorarioFuncionamento: remove "active" (não existe no diagrama)
-- ============================================================
ALTER TABLE "horarios_funcionamento" DROP COLUMN "active";
DROP INDEX "horarios_funcionamento_estabelecimentoId_idx";

-- ============================================================
-- 6. Midia: remove isMain e createdAt. "bytes" foi mantido de propósito.
-- ============================================================
ALTER TABLE "midias"
  DROP COLUMN "isMain",
  DROP COLUMN "createdAt";

-- ============================================================
-- 7. Endereco: remove createdAt/updatedAt
-- ============================================================
ALTER TABLE "enderecos"
  DROP COLUMN "createdAt",
  DROP COLUMN "updatedAt";

-- ============================================================
-- 8. Contato: remove createdAt
-- ============================================================
ALTER TABLE "contatos" DROP COLUMN "createdAt";

-- ============================================================
-- 9. Review: remove updatedAt
-- ============================================================
ALTER TABLE "reviews" DROP COLUMN "updatedAt";
DROP INDEX "reviews_estabelecimentoId_idx";
