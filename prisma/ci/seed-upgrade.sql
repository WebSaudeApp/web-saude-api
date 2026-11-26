-- QA-05 (#56): dados minimos usados pelo teste de upgrade de migrations.
-- O CI le ESTE arquivo da release base (origin/producao), entao ele sempre casa com o schema
-- daquela release. Ao mudar o schema (coluna NOT NULL nova, renomeacao), atualize-o junto
-- com a migration: a proxima release o usara como base.
INSERT INTO "tipos_estabelecimento" ("id", "nome")
VALUES ('11111111-1111-4111-8111-111111111111', 'HOSPITAL')
ON CONFLICT ("nome") DO NOTHING;

INSERT INTO "enderecos" ("id", "cep", "logradouro", "numero", "bairro", "cidade", "estado", "latitude", "longitude")
VALUES ('end-upgrade-seed-1', '50000-000', 'Av. Teste Upgrade', '100', 'Centro', 'Recife', 'PE', -8.05, -34.88)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "estabelecimentos" ("id", "nome", "tipoId", "enderecoId")
VALUES (
  'est-upgrade-seed-1',
  'Unidade Teste Upgrade',
  (SELECT "id" FROM "tipos_estabelecimento" WHERE "nome" = 'HOSPITAL'),
  'end-upgrade-seed-1'
)
ON CONFLICT ("id") DO NOTHING;
