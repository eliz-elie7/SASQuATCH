import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { openSession, closeSession, banParticipant, unbanParticipant } from "../api/sessions";
import { listSessionQuestions, listQuestionsByPseudonym, clusterQuestions } from "../api/questions";
import { useSessionSocket } from "../hooks/useSessionSocket";
import { ApiError } from "../api/client";

const ADMIN_EMAIL = "djihintomahugnon@gmail.com";

export function TeacherDashboard() {
  const { token, signOut } = useAuth();
  const [session, setSession] = useState(null);

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="page-shell__inner dashboard-layout" style={{ maxWidth: 1120 }}>
        <header className="dashboard-topbar">
          <div>
            <p className="page-kicker">Espace enseignant</p>
            <h1 className="page-title">Dashboard enseignant</h1>
          </div>
          <button onClick={signOut} className="ghost-btn">
            Se déconnecter
          </button>
        </header>

        {!session ? (
          <OpenSessionForm token={token} onOpened={setSession} />
        ) : (
          <SessionView token={token} session={session} onClosed={() => setSession(null)} />
        )}
      </div>
    </div>
  );
}

function groupQuestions(questions) {
  const roots = [];
  const clarificationsByParent = {};

  for (const question of questions) {
    if (!question.parent_id) {
      roots.push(question);
    } else {
      if (!clarificationsByParent[question.parent_id]) {
        clarificationsByParent[question.parent_id] = [];
      }
      clarificationsByParent[question.parent_id].push(question);
    }
  }

  return roots.map((root) => ({
    root,
    clarifications: (clarificationsByParent[root.id] || []).sort(
      (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at)
    ),
  }));
}

function OpenSessionForm({ token, onOpened }) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await openSession(token, label);
      onOpened(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card surface-card--hero" style={{ maxWidth: 540 }}>
      <h2 className="page-title" style={{ marginTop: 0, fontSize: "1.45rem" }}>
        Ouvrir une session
      </h2>
      <form onSubmit={handleSubmit} className="form-stack" style={{ marginTop: 16 }}>
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Cours Réseaux S6"
          className="field-input"
        />
        {error && <p className="notice notice--error">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="primary-btn">
          {isSubmitting ? "Ouverture..." : "Ouvrir la session"}
        </button>
      </form>
    </section>
  );
}

function SessionView({ token, session, onClosed }) {
  const [questions, setQuestions] = useState([]);
  const [bannedPseudonyms, setBannedPseudonyms] = useState(new Set());
  const [isClosed, setIsClosed] = useState(false);
  const [selectedPseudonym, setSelectedPseudonym] = useState(null);
  const [flagFeedback, setFlagFeedback] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [isClustering, setIsClustering] = useState(false);
  const [showFiltered, setShowFiltered] = useState(false);

  const { isConnected, lastEvent } = useSessionSocket(session.id, token);

  useEffect(() => {
    listSessionQuestions(token, session.id, showFiltered)
      .then((data) => setQuestions(data.questions))
      .catch(() => {
        /* silencieux */
      });
  }, [session.id, token, showFiltered]);

  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case "new_question":
        setQuestions((prev) => [...prev, lastEvent.question]);
        break;
      case "participant_banned":
        setBannedPseudonyms((prev) => new Set(prev).add(lastEvent.pseudonym));
        break;
      case "participant_unbanned":
        setBannedPseudonyms((prev) => {
          const next = new Set(prev);
          next.delete(lastEvent.pseudonym);
          return next;
        });
        break;
      case "session_closed":
        setIsClosed(true);
        break;
      case "satisfaction_updated":
        setQuestions((prev) =>
          prev.map((question) =>
            question.id === lastEvent.question_id ? { ...question, satisfaction: lastEvent.satisfaction } : question
          )
        );
        break;
      default:
        break;
    }
  }, [lastEvent]);

  async function handleClose() {
    await closeSession(token, session.id);
    onClosed();
  }

  async function handleToggleBan(pseudonym) {
    if (bannedPseudonyms.has(pseudonym)) {
      await unbanParticipant(token, session.id, pseudonym);
    } else {
      await banParticipant(token, session.id, pseudonym);
    }
  }

  async function handleCluster() {
    setIsClustering(true);
    try {
      const visibleQuestions = questions.filter((question) => !question.is_filtered);
      if (visibleQuestions.length < 2) return;
      const result = await clusterQuestions(token, visibleQuestions);
      setClusters(result);
    } catch {
      /* silencieux */
    } finally {
      setIsClustering(false);
    }
  }

  function handleFlagForDeanon(question) {
    const subject = `[SASQuATCH] Demande de désanonymisation - session ${session.label}`;
    const body = [
      "Bonjour,",
      "",
      "Je signale la contribution suivante pour désanonymisation :",
      "",
      `Session : ${session.label} (id : ${session.id})`,
      `Pseudonyme concerné : ${question.pseudonym}`,
      `ID de la question : ${question.id}`,
      `Contenu : ${question.content}`,
      "",
      "Motif : ",
      "",
      "Merci.",
    ].join("\n");

    const mailtoUrl = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    setFlagFeedback("Ouverture du client mail...");
    setTimeout(() => setFlagFeedback(null), 3000);
  }

  const visibleQuestions = questions.filter((question) => !question.is_filtered);
  const filteredQuestions = questions.filter((question) => question.is_filtered);

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
              Code : <span className="field-input--mono" style={{ padding: 0 }}>{session.join_code}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <StatusBadge isConnected={isConnected} isClosed={isClosed} />
            <button
              onClick={() => setShowFiltered((value) => !value)}
              className="secondary-btn"
              type="button"
            >
              {showFiltered ? "Masquer filtrées" : `Voir filtrées (${filteredQuestions.length})`}
            </button>
            {!isClosed && (
              <button onClick={handleClose} className="ghost-btn">
                Clôturer
              </button>
            )}
          </div>
        </div>
      </section>

      {!isClosed && visibleQuestions.length >= 2 && (
        <div>
          <button onClick={handleCluster} disabled={isClustering} className="secondary-btn">
            {isClustering ? "Analyse..." : "Regrouper par thèmes"}
          </button>
        </div>
      )}

      {isClosed && <p className="notice notice--warning">Cette session a été clôturée.</p>}

      <section className="mini-list mini-list--gap-lg">
        {questions.length === 0 && <p className="empty-state">Aucune question pour l'instant.</p>}
        {groupQuestions(questions).map(({ root, clarifications }) => (
          <div key={root.id}>
            <QuestionCard
              question={root}
              isBanned={bannedPseudonyms.has(root.pseudonym)}
              onToggleBan={() => handleToggleBan(root.pseudonym)}
              onSelectPseudonym={() => setSelectedPseudonym(root.pseudonym)}
              onFlagForDeanon={() => handleFlagForDeanon(root)}
            />
            {clarifications.length > 0 && (
              <div className="thread-line mini-list" style={{ marginTop: 10 }}>
                {clarifications.map((clarification) => (
                  <div key={clarification.id} className="question-card question-card--compact">
                    <span className="soft-chip" style={{ marginBottom: 8 }}>
                      Clarification de <span className="field-input--mono" style={{ padding: 0 }}>{clarification.pseudonym}</span>
                    </span>
                    <p style={{ margin: 0 }}>{clarification.content}</p>
                    <SatisfactionBadge satisfaction={clarification.satisfaction} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {flagFeedback && <div className="floating-toast surface-card surface-card--compact">{flagFeedback}</div>}

      {clusters && <ClusterModal clusters={clusters} onClose={() => setClusters(null)} />}

      {selectedPseudonym && (
        <PseudonymThreadModal
          token={token}
          sessionId={session.id}
          pseudonym={selectedPseudonym}
          onClose={() => setSelectedPseudonym(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ isConnected, isClosed }) {
  if (isClosed) {
    return <span className="status-chip status-chip--closed">Clôturée</span>;
  }

  return isConnected ? (
    <span className="status-chip status-chip--active">Temps réel actif</span>
  ) : (
    <span className="status-chip status-chip--offline">Déconnecté</span>
  );
}

function QuestionCard({ question, isBanned, onToggleBan, onSelectPseudonym, onFlagForDeanon }) {
  return (
    <article className="question-card">
      <div className="question-card__header">
        <div className="question-card__meta">
          <button
            onClick={onSelectPseudonym}
            className="ghost-btn"
            style={{ padding: 0, alignSelf: "flex-start", fontSize: "0.76rem" }}
            title="Voir le fil"
          >
            {question.pseudonym}
          </button>
          {question.is_filtered && (
            <span className="status-chip status-chip--warning" style={{ alignSelf: "flex-start" }}>
              Filtrée
            </span>
          )}
          <p style={{ margin: 0, fontSize: "0.98rem", lineHeight: 1.6 }}>{question.content}</p>
          {question.is_filtered && question.filter_reason && (
            <p className="field-hint" style={{ margin: 0 }}>
              {question.filter_reason}
            </p>
          )}
          <SatisfactionBadge satisfaction={question.satisfaction} />
        </div>
        <div className="question-card__actions">
          <button onClick={onToggleBan} className="secondary-btn" type="button">
            {isBanned ? "Lever le bannissement" : "Bannir"}
          </button>
          <button onClick={onFlagForDeanon} className="secondary-btn" type="button">
            Signaler à l'admin
          </button>
        </div>
      </div>
    </article>
  );
}

function SatisfactionBadge({ satisfaction }) {
  if (!satisfaction) return null;

  const isSatisfied = satisfaction === "satisfied";
  return <span className={`status-chip ${isSatisfied ? "status-chip--satisfied" : "status-chip--danger"}`}>{isSatisfied ? "Compris" : "Pas clair"}</span>;
}

function PseudonymThreadModal({ token, sessionId, pseudonym, onClose }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listQuestionsByPseudonym(token, sessionId, pseudonym)
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de connexion."));
  }, [token, sessionId, pseudonym]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-topbar" style={{ alignItems: "center", marginBottom: 16 }}>
          <h3 className="page-title" style={{ fontSize: "1.35rem" }}>
            Fil de <span className="field-input--mono" style={{ padding: 0 }}>{pseudonym}</span>
          </h3>
          <button onClick={onClose} className="ghost-btn">
            Fermer
          </button>
        </div>

        {error && <p className="notice notice--error">{error}</p>}
        {questions === null && !error && <p className="empty-state" style={{ padding: "1rem 0" }}>Chargement...</p>}
        {questions && questions.length === 0 && <p className="empty-state" style={{ padding: "1rem 0" }}>Aucune question trouvée.</p>}

        <div className="mini-list">
          {questions?.map((question) => (
            <div key={question.id} className="question-card question-card--compact">
              {question.parent_id && <span className="soft-chip" style={{ marginBottom: 8 }}>Clarification</span>}
              <p style={{ margin: 0 }}>{question.content}</p>
              {question.is_filtered && question.filter_reason && (
                <p className="field-hint" style={{ margin: "6px 0 0" }}>
                  Filtrée : {question.filter_reason}
                </p>
              )}
              {question.is_filtered && (
                <span className="status-chip status-chip--warning" style={{ marginTop: 8 }}>
                  Filtrée ({question.filter_reason})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClusterModal({ clusters, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-topbar" style={{ alignItems: "center", marginBottom: 16 }}>
          <h3 className="page-title" style={{ fontSize: "1.35rem" }}>Regroupement thématique</h3>
          <button onClick={onClose} className="ghost-btn">
            Fermer
          </button>
        </div>

        <div className="mini-list">
          {Object.entries(clusters).map(([theme, questions]) => (
            <div key={theme} className="question-card question-card--compact">
              <p style={{ margin: 0, fontWeight: 700 }}>{theme} ({questions.length})</p>
              <div className="mini-list" style={{ marginTop: 10 }}>
                {questions.map((question) => (
                  <p key={question.id} style={{ margin: 0, color: "var(--text-muted)" }}>{question.content}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}