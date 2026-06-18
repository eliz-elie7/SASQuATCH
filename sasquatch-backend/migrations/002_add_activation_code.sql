-- Migration : ajout du code court d'activation (alternative au lien e-mail)
-- À exécuter sur la base sasquatch_db

BEGIN;

ALTER TABLE public.users ADD COLUMN activation_code TEXT;

COMMIT;