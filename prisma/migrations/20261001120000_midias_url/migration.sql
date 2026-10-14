-- A rota que serve o arquivo da mídia passou de /unit-images/:id para
-- /midias/:id. As URLs gravadas acompanham, senão as fotos param de abrir.
UPDATE "midias"
SET "url" = regexp_replace("url", '^/unit-images/', '/midias/')
WHERE "url" LIKE '/unit-images/%';
