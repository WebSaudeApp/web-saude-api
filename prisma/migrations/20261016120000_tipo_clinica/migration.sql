-- O tipo de estabelecimento CLINIC (herdado do enum antigo, em inglês) passa
-- a se chamar CLINICA, como na especificação do UC01 (RN05). Só o nome muda:
-- o id continua o mesmo, então os estabelecimentos ligados a ele não mudam.
UPDATE "tipos_estabelecimento"
SET "nome" = 'CLINICA'
WHERE "nome" = 'CLINIC'
  AND NOT EXISTS (
    SELECT 1 FROM "tipos_estabelecimento" WHERE "nome" = 'CLINICA'
  );
