-- ============================================================
-- SASQuATCH — Schéma PostgreSQL Complet et Sécurisé
-- ============================================================

-- Nettoyage complet (évite les conflits si le script est rejoué)
DROP VIEW IF EXISTS v_questions_visible CASCADE;
DROP VIEW IF EXISTS v_active_participants CASCADE;
DROP TABLE IF EXISTS deanonymization_logs CASCADE;
DROP TABLE IF EXISTS moderation_config CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS satisfaction_status CASCADE;

-- Extension nécessaire pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types énumérés
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE satisfaction_status AS ENUM ('satisfied', 'unsatisfied');

-- Table 1 : Utilisateurs
CREATE TABLE users (
    id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    institutional_id_enc  TEXT            NOT NULL,
    nom_enc               TEXT            NOT NULL,
    prenom_enc            TEXT            NOT NULL,
    email_enc             TEXT            NOT NULL UNIQUE,
    role                  user_role       NOT NULL,
    password_hash         TEXT            NOT NULL,
    is_active             BOOLEAN         NOT NULL DEFAULT FALSE,
    activation_token      TEXT            NULL,
    activation_token_exp  TIMESTAMP       NULL,
    created_at            TIMESTAMP       NOT NULL DEFAULT NOW(),
    created_by            UUID            NULL REFERENCES users(id)
);

-- Table 2 : Sessions de cours
CREATE TABLE sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID        NOT NULL REFERENCES users(id),
    label           TEXT        NOT NULL,
    join_code       CHAR(6)     NOT NULL,
    secret_key      BYTEA       NOT NULL,
    started_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMP   NULL,
    closed_by       UUID        NULL REFERENCES users(id),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_closed_by_is_teacher CHECK (closed_by IS NULL OR closed_by = teacher_id),
    CONSTRAINT chk_active_consistency CHECK (
        (is_active = TRUE  AND ended_at IS NULL) OR 
        (is_active = FALSE AND ended_at IS NOT NULL)
    )
);

-- Table 3 : Inscriptions des participants
CREATE TABLE session_participants (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id),
    pseudonym       VARCHAR(52) NOT NULL,
    is_banned       BOOLEAN     NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_user UNIQUE (session_id, user_id)
);

-- Table 4 : Questions et clarifications
CREATE TABLE questions (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID                NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    pseudonym       VARCHAR(52)         NOT NULL,
    parent_id       UUID                NULL REFERENCES questions(id),
    content         TEXT                NOT NULL,
    is_filtered     BOOLEAN             NOT NULL DEFAULT FALSE,
    filter_reason   TEXT                NULL,
    satisfaction    satisfaction_status NULL,
    theme_cluster   INTEGER             NULL,
    submitted_at    TIMESTAMP           NOT NULL DEFAULT NOW()
);

-- Table 5 : Configuration globale de la modération
CREATE TABLE moderation_config (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key      TEXT        NOT NULL UNIQUE,
    config_value    TEXT        NOT NULL,
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_by      UUID        NULL REFERENCES users(id)
);

-- Table 6 : Logs d'administration (Désanonymisation)
CREATE TABLE deanonymization_logs (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by        UUID        NOT NULL REFERENCES users(id),
    session_id          UUID        NOT NULL REFERENCES sessions(id),
    question_id         UUID        NOT NULL REFERENCES questions(id),
    pseudonym           VARCHAR(52) NOT NULL,
    resolved_user_enc   TEXT        NOT NULL,
    reason              TEXT        NOT NULL,
    requested_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_deanon_question UNIQUE (question_id)
);

-- Indexations pour les performances
CREATE INDEX idx_users_role ON users(role);
CREATE UNIQUE INDEX uq_sessions_join_code_active ON sessions(join_code) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_teacher_id ON sessions(teacher_id);
CREATE INDEX idx_session_participants_session_pseudonym ON session_participants(session_id, pseudonym);
CREATE INDEX idx_questions_session_id ON questions(session_id);

-- Initialisation des paramètres par défaut
INSERT INTO moderation_config (config_key, config_value) VALUES
    ('blacklist', '[]'),