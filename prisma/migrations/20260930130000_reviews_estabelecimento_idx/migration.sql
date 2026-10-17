-- Listagens e recálculo de nota filtram reviews só por estabelecimento. O índice
-- único (autorId, estabelecimentoId) começa por autorId e não atende essa busca.
-- IF NOT EXISTS: bancos novos já mantêm o índice; só quem rodou a versão
-- anterior da migration de limpeza (que o removia) precisa recriá-lo.
CREATE INDEX IF NOT EXISTS "reviews_estabelecimentoId_idx" ON "reviews"("estabelecimentoId");
