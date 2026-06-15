-- ============================================================
-- SASQuATCH - Jeu de données de test
-- À exécuter APRÈS sasquatch_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Utilisateurs (1 admin, 1 enseignant, 2 étudiants)
-- Les valeurs "_enc" sont ici de simples chaînes de test
-- (le vrai chiffrement AES-256 sera fait côté backend).
-- password_hash = bcrypt('test1234') -> exemple générique
-- ------------------------------------------------------------

INSERT INTO users (id, institutional_id_enc, nom_enc, prenom_enc, email_enc, role, password_hash, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'enc_admin_id',   'enc_Boiret', 'enc_Adrien', 'enc_admin@insa.fr',
        'admin',   '$2b$12$examplehashadmin000000000000000000000000000000000000', true),

    ('22222222-2222-2222-2222-222222222222', 'enc_teacher_id', 'enc_Dupont', 'enc_Marie', 'enc_teacher@insa.fr',
        'teacher', '$2b$12$examplehashteacher0000000000000000000000000000000000', true),

    ('33333333-3333-3333-3333-333333333333', 'enc_student1_id', 'enc_Mezrigui', 'enc_Imen', 'enc_student1@insa.fr',
        'student', '$2b$12$examplehashstudent1000000000000000000000000000000000', true),

    ('44444444-4444-4444-4444-444444444444', 'enc_student2_id', 'enc_Diallo', 'enc_Abdoulaye', 'enc_student2@insa.fr',
        'student', '$2b$12$examplehashstudent2000000000000000000000000000000000', true);

UPDATE users SET created_by = '11111111-1111-1111-1111-111111111111'
WHERE role IN ('teacher', 'student');

-- ------------------------------------------------------------
-- 2. Session de cours ouverte par l'enseignant
-- secret_key généré ici comme exemple (en vrai : random bytes côté serveur)
-- ------------------------------------------------------------

INSERT INTO sessions (id, teacher_id, label, join_code, secret_key, is_active)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Cours de Bases de Données - Séance 1',
    'AB12C3',
    gen_random_bytes(32),
    true
);

-- ------------------------------------------------------------
-- 3. Participation des étudiants (pseudonymes calculés
--    normalement = HMAC(secret_key, user.id), ici simplifiés)
-- ------------------------------------------------------------

INSERT INTO session_participants (session_id, user_id, pseudonym)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'PSEUDO_ABCDE1'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'PSEUDO_FGHIJ2');

-- ------------------------------------------------------------
-- 4. Questions
-- ------------------------------------------------------------

INSERT INTO questions (id, session_id, pseudonym, content)
VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PSEUDO_ABCDE1',
        'Quelle est la différence entre une clé primaire et une clé étrangère ?'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PSEUDO_FGHIJ2',
        'Peut-on avoir plusieurs clés étrangères dans une même table ?');

-- Message de clarification rattaché à la première question
INSERT INTO questions (session_id, pseudonym, parent_id, content)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'PSEUDO_ABCDE1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Précision : je parle dans le cas d''une relation 1-N.'
);

-- Réponse signalée comme satisfaisante
UPDATE questions
SET satisfaction = 'satisfied'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- ------------------------------------------------------------
-- 5. Test : bannissement temporaire d'un pseudonyme
-- ------------------------------------------------------------

UPDATE session_participants
SET is_banned = true
WHERE session_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND pseudonym = 'PSEUDO_FGHIJ2';

-- ------------------------------------------------------------
-- 6. Test : désanonymisation administrative journalisée
-- ------------------------------------------------------------

INSERT INTO deanonymization_logs (requested_by, session_id, question_id, pseudonym, resolved_user_enc, reason)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'PSEUDO_ABCDE1',
    'enc_resolved_identity_student1',
    'Test de désanonymisation pour vérification du schéma'
);

-- ============================================================
-- REQUÊTES DE VÉRIFICATION
-- ============================================================

-- A. Vérifier les utilisateurs et leur rôle
SELECT id, role, is_active, created_by FROM users;

-- B. Vérifier la session et son code d'accès
SELECT id, label, join_code, is_active, started_at FROM sessions;

-- C. Vérifier les participants et leur statut de bannissement
SELECT session_id, pseudonym, is_banned FROM session_participants;

-- D. Vérifier le fil de questions (question + clarification)
SELECT id, pseudonym, parent_id, content, satisfaction
FROM questions
ORDER BY submitted_at;

-- E. Toutes les questions d'un même pseudonyme (fonctionnalité §2.4.1)
SELECT id, content, submitted_at
FROM questions
WHERE session_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND pseudonym = 'PSEUDO_ABCDE1'
ORDER BY submitted_at;

-- F. Vérifier le journal de désanonymisation
SELECT pseudonym, reason, requested_at FROM deanonymization_logs;

-- G. Vérifier la configuration de modération
SELECT config_key, config_value FROM moderation_config;

-- H. TEST de contrainte : doit échouer (closed_by != teacher_id)
-- Décommenter pour tester :
-- UPDATE sessions SET ended_at = now(), is_active = false,
--   closed_by = '11111111-1111-1111-1111-111111111111'
-- WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- => ERREUR attendue : chk_closed_by_is_teacher

-- I. TEST clôture correcte (par l'enseignant créateur)
UPDATE sessions
SET ended_at = now(), is_active = false, closed_by = teacher_id
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT id, is_active, ended_at, closed_by FROM sessions;