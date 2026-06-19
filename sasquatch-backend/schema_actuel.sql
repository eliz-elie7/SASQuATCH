--
-- PostgreSQL database dump
--

\restrict 8fxvDNqVfIKnWs79cd5u7YMLsd5JscwKYBKbMKTfYcI0SaeQRujkJahP3IVJ4KA

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: satisfaction_status; Type: TYPE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TYPE public.satisfaction_status AS ENUM (
    'satisfied',
    'unsatisfied'
);


ALTER TYPE public.satisfaction_status OWNER TO sasquatch_dev_user;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TYPE public.user_role AS ENUM (
    'student',
    'teacher',
    'admin'
);


ALTER TYPE public.user_role OWNER TO sasquatch_dev_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: deanonymization_logs; Type: TABLE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TABLE public.deanonymization_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requested_by uuid NOT NULL,
    session_id uuid NOT NULL,
    question_id uuid NOT NULL,
    pseudonym text NOT NULL,
    resolved_user_enc text NOT NULL,
    reason text NOT NULL,
    requested_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deanonymization_logs OWNER TO sasquatch_dev_user;

--
-- Name: moderation_config; Type: TABLE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TABLE public.moderation_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text NOT NULL,
    config_value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


ALTER TABLE public.moderation_config OWNER TO sasquatch_dev_user;

--
-- Name: questions; Type: TABLE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    pseudonym text NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    is_filtered boolean DEFAULT false,
    filter_reason text,
    satisfaction public.satisfaction_status,
    theme_cluster integer,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.questions OWNER TO sasquatch_dev_user;

--
-- Name: session_participants; Type: TABLE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TABLE public.session_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    pseudonym text NOT NULL,
    is_banned boolean DEFAULT false,
    joined_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.session_participants OWNER TO sasquatch_dev_user;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    label text NOT NULL,
    join_code character(6) NOT NULL,
    secret_key bytea NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    ended_at timestamp without time zone,
    closed_by uuid,
    is_active boolean DEFAULT true
);


ALTER TABLE public.sessions OWNER TO sasquatch_dev_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: sasquatch_dev_user
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institutional_id_enc text NOT NULL,
    nom_enc text NOT NULL,
    prenom_enc text NOT NULL,
    email_enc text NOT NULL,
    role public.user_role NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT false,
    activation_token text,
    activation_token_exp timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    email_hash text NOT NULL,
    activation_code text
);


ALTER TABLE public.users OWNER TO sasquatch_dev_user;

--
-- Name: deanonymization_logs deanonymization_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.deanonymization_logs
    ADD CONSTRAINT deanonymization_logs_pkey PRIMARY KEY (id);


--
-- Name: moderation_config moderation_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.moderation_config
    ADD CONSTRAINT moderation_config_config_key_key UNIQUE (config_key);


--
-- Name: moderation_config moderation_config_pkey; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.moderation_config
    ADD CONSTRAINT moderation_config_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: session_participants session_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_pkey PRIMARY KEY (id);


--
-- Name: session_participants session_participants_session_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_session_id_user_id_key UNIQUE (session_id, user_id);


--
-- Name: sessions sessions_join_code_key; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_join_code_key UNIQUE (join_code);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_hash_key; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_hash_key UNIQUE (email_hash);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: deanonymization_logs deanonymization_logs_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.deanonymization_logs
    ADD CONSTRAINT deanonymization_logs_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: deanonymization_logs deanonymization_logs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.deanonymization_logs
    ADD CONSTRAINT deanonymization_logs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: deanonymization_logs deanonymization_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.deanonymization_logs
    ADD CONSTRAINT deanonymization_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: moderation_config moderation_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.moderation_config
    ADD CONSTRAINT moderation_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: questions questions_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.questions(id);


--
-- Name: questions questions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: session_participants session_participants_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: session_participants session_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: sessions sessions_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sasquatch_dev_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 8fxvDNqVfIKnWs79cd5u7YMLsd5JscwKYBKbMKTfYcI0SaeQRujkJahP3IVJ4KA

