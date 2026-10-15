-- Latitude e longitude passam a ser obrigatórias no endereço (de
-- estabelecimentos e de usuários). Se algum endereço ainda estiver sem
-- coordenadas, a migration para sem alterar nada: preencha as coordenadas
-- que faltam e rode de novo.
DO $$
DECLARE
  sem_coordenadas integer;
BEGIN
  SELECT count(*) INTO sem_coordenadas
  FROM "enderecos"
  WHERE "latitude" IS NULL OR "longitude" IS NULL;

  IF sem_coordenadas > 0 THEN
    RAISE EXCEPTION '% endereço(s) sem latitude ou longitude. Preencha antes de aplicar esta migration.', sem_coordenadas;
  END IF;
END $$;

ALTER TABLE "enderecos"
  ALTER COLUMN "latitude" SET NOT NULL,
  ALTER COLUMN "longitude" SET NOT NULL;
