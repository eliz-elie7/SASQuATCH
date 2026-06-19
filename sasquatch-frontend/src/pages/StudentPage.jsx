import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { joinSession } from "../api/sessions";
import { submitQuestion, setSatisfaction } from "../api/questions";
import { ApiError } from "../api/client";

export function StudentPage() {
  const { token, signOut } = useAuth();
  const [session, setSession] = useState(null); // { session_id, label, pseudonym }

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="page-shell__inner dashboard-layout" style={{ maxWidth: 1040 }}>
        <header className="dashboard-topbar">
          <div>
            <p className="page-kicker">Espace étudiant</p>
            <h1 className="page-title">Questions en direct</h1>
          </div>
          <button onClick={signOut} className="ghost-btn">
            Se déconnecter
          </button>
        </header>

        {!session ? (
          <JoinSessionForm token={token} onJoined={setSession} />
        ) : (
          <QuestionSubmissionView token={token} session={session} onLeave={() => setSession(null)} />
        )}
      </div>
    </div>
  );
}

function JoinSessionForm({ token, onJoined }) {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await joinSession(token, joinCode.toUpperCase());
      onJoined(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card surface-card--hero" style={{ maxWidth: 520 }}>
      <h2 className="page-title" style={{ marginTop: 0, fontSize: "1.45rem" }}>
        Rejoindre une session
      </h2>

      <form onSubmit={handleSubmit} className="form-stack" style={{ marginTop: 16 }}>
        <input
          type="text"
          required
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Code de session (ex: H549ME)"
          maxLength={6}
          className="field-input field-input--mono"
        />
        {error && <p className="notice notice--error">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="primary-btn">
          {isSubmitting ? "Connexion..." : "Rejoindre"}
        </button>
      </form>
    </section>
  );
}

function QuestionSubmissionView({ token, session, onLeave }) {
  const [content, setContent] = useState("");
  const [submittedQuestions, setSubmittedQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const question = await submitQuestion(token, session.session_id, content);
      setSubmittedQuestions((prev) => [...prev, question]);
      setContent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetSatisfaction(questionId, satisfaction) {
    try {
      const updated = await setSatisfaction(token, questionId, satisfaction);
      setSubmittedQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
    } catch {
      // Silencieux : un échec ici n'empêche pas de continuer à utiliser la page.
    }
  }

  return (
    <div className="dashboard-layout">
      <section className="surface-card">
        <div className="dashboard-topbar" style={{ alignItems: "center" }}>
          <div>
            <span className="soft-chip">Session active</span>
            <h2 className="page-title" style={{ marginTop: 12, fontSize: "1.45rem" }}>
              {session.label}
            </h2>
            <p className="field-hint" style={{ marginTop: 8 }}>
              Pseudonyme : <span className="field-input--mono" style={{ padding: 0 }}>{session.pseudonym}</span>
            </p>
          </div>
          <button onClick={onLeave} className="ghost-btn">
            Quitter
          </button>
        </div>
      </section>

      <section className="surface-card surface-card--hero">
        <h3 className="page-title" style={{ marginTop: 0, fontSize: "1.45rem" }}>
          Poser une nouvelle question
        </h3>
        <p className="field-hint" style={{ marginTop: 6 }}>
          Votre question sera visible immédiatement pour l'enseignant.
        </p>
        <form onSubmit={handleSubmit} className="form-stack" style={{ marginTop: 16 }}>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tapez clairement votre question..."
            rows={4}
            className="field-textarea"
          />
          {error && <p className="notice notice--error">{error}</p>}
          <div className="button-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="field-hint">Débit : max 3 questions / minute</span>
            <button type="submit" disabled={isSubmitting} className="primary-btn">
              {isSubmitting ? "Envoi..." : "Envoyer la question"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="page-kicker" style={{ marginTop: 8 }}>Mes questions actives ({submittedQuestions.length})</h3>
        {submittedQuestions.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.5rem 0" }}>
            Aucune question pour le moment.
          </div>
        ) : (
          <div className="mini-list mini-list--gap-lg" style={{ marginTop: 12 }}>
            {submittedQuestions.map((q) => (
              <SubmittedQuestionCard
                key={q.id}
                question={q}
                token={token}
                session={session}
                onSatisfaction={(satisfaction) => handleSetSatisfaction(q.id, satisfaction)}
                onClarificationSent={(clarification) => setSubmittedQuestions((prev) => [...prev, clarification])}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SubmittedQuestionCard({ question, token, session, onSatisfaction, onClarificationSent }) {
  const [showClarifyForm, setShowClarifyForm] = useState(false);
  const [clarifyContent, setClarifyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // On masque le bouton "Clarifier" si la question est elle-même déjà
  // une clarification (parent_id non null) : on n'imbrique pas plus
  // d'un niveau pour garder l'interface simple.
  const isRootQuestion = question.parent_id === null || question.parent_id === undefined;

  async function handleClarify(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await submitQuestion(token, session.session_id, clarifyContent, question.id);
      onClarificationSent(result);
      setClarifyContent("");
      setShowClarifyForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="question-card question-card--compact">
      {question.parent_id && <span className="soft-chip" style={{ marginBottom: 8 }}>Clarification</span>}
      <div className="question-card__meta">
        <p style={{ margin: 0, color: "var(--text)" }}>{question.content}</p>
        <span className={`status-chip ${question.satisfaction === "satisfied" ? "status-chip--satisfied" : question.satisfaction === "unsatisfied" ? "status-chip--danger" : "status-chip--closed"}`}>
          {question.satisfaction === "satisfied" ? "Compris" : question.satisfaction === "unsatisfied" ? "Pas clair" : "En attente"}
        </span>
      </div>

      <div className="question-card__actions" style={{ marginTop: 12 }}>
        <button
          onClick={() => onSatisfaction("satisfied")}
          className={`secondary-btn ${question.satisfaction === "satisfied" ? "status-chip--satisfied" : ""}`}
          type="button"
        >
          Compris
        </button>
        <button
          onClick={() => onSatisfaction("unsatisfied")}
          className={`secondary-btn ${question.satisfaction === "unsatisfied" ? "status-chip--danger" : ""}`}
          type="button"
        >
          Pas clair
        </button>
        {isRootQuestion && (
          <button
            onClick={() => setShowClarifyForm((v) => !v)}
            className="ghost-btn"
            type="button"
          >
            {showClarifyForm ? "Annuler" : "Clarifier"}
          </button>
        )}
      </div>

      {showClarifyForm && (
        <form onSubmit={handleClarify} className="form-stack" style={{ marginTop: 12 }}>
          <textarea
            required
            value={clarifyContent}
            onChange={(e) => setClarifyContent(e.target.value)}
            placeholder="Précisez votre question..."
            rows={2}
            className="field-textarea"
          />
          {error && <p className="notice notice--error">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="primary-btn">
            {isSubmitting ? "Envoi..." : "Envoyer la clarification"}
          </button>
        </form>
      )}
    </article>
  );
}