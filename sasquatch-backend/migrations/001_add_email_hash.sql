-- Migration : ajout de la recherche déterministe sur l'email
-- À exécuter sur la base sasquatch (table users vide, donc sans risque)

BEGIN;

-- 1. Supprimer la contrainte d'unicité sur la colonne chiffrée
--    (elle ne peut jamais matcher deux chiffrements du même email)
ALTER TABLE public.users DROP CONSTRAINT users_email_enc_key;

-- 2. Ajouter la colonne de hash déterministe (HMAC-SHA256, encodé base64)
ALTER TABLE public.users ADD COLUMN email_hash text NOT NULL;

-- 3. La contrainte d'unicité doit porter sur le hash, pas sur le chiffré
ALTER TABLE public.users ADD CONSTRAINT users_email_hash_key UNIQUE (email_hash);

COMMIT;