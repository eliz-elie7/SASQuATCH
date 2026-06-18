import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { openSession, closeSession, banParticipant, unbanParticipant } from "../api/sessions";
import { listSessionQuestions, listQuestionsByPseudonym } from "../api/questions";
import { useSessionSocket } from "../hooks/useSessionSocket";
import { ApiError } from "../api/client";

// Adresse de l'administrateur destinataire des demandes de
// désanonymisation. À adapter si le compte admin change.
const ADMIN_EMAIL = "djihintomahugnon@gmail.com";

export function TeacherDashboard() {
  const { token, signOut } = useAuth();
  const [session, setSession] = useState(null); // { id, label, join_code }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Dashboard enseignant</h1>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
            Se déconnecter
          </button>
        </div>

        {!session ? (
          <OpenSessionForm token={token} onOpened={setSession} />
        ) : (
          <SessionView token={token} session={session} onClosed={() => setSession(null)} />
        )}
      </div>
    </div>
  );
}

// Transforme une liste plate de questions en groupes { root, clarifications[] }.
// Les clarifications (parent_id non null) sont rattachées à leur question
// parente. Les questions dont le parent est introuvable (cas théoriquement
// impossible en pratique) sont traitées comme des questions racines.
function groupQuestions(questions) {
  const roots = [];
  const clarificationsByParent = {};

  for (const q of questions) {
    if (!q.parent_id) {
      roots.push(q);
    } else {
      if (!clarificationsByParent[q.parent_id]) {
        clarificationsByParent[q.parent_id] = [];
      }
      clarificationsByParent[q.parent_id].push(q);
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

  async function handleSubmit(e) {
    e.preventDefault();
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
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-md">
      <h2 className="font-medium text-slate-900 mb-4">Ouvrir une session de cours</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Cours Réseaux S6"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-slate-900 text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
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

  const { isConnected, lastEvent } = useSessionSocket(session.id, token);

  // Chargement initial : récupère les questions déjà soumises avant que
  // le WebSocket ait été ouvert (voir CONTRAT_API_FRONTEND.md).
  useEffect(() => {
    listSessionQuestions(token, session.id)
      .then((data) => setQuestions(data.questions))
      .catch(() => {
        /* silencieux : le dashboard reste utilisable même si ce chargement échoue */
      });
  }, [session.id, token]);

  // Traitement des événements WebSocket reçus en temps réel.
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
          prev.map((q) =>
            q.id === lastEvent.question_id ? { ...q, satisfaction: lastEvent.satisfaction } : q
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

  function handleFlagForDeanon(question) {
    // Pas d'appel API ici : on ne peut PAS déclencher la désanonymisation
    // depuis l'interface enseignant (§2.3.3, réservé à l'admin). On se
    // contente d'ouvrir un brouillon d'e-mail pré-rempli vers l'admin,
    // qui décidera lui-même s'il donne suite à la demande.
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

    setFlagFeedback("Ouverture de votre client mail...");
    setTimeout(() => setFlagFeedback(null), 4000);
  }

  return (
    <div>
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-slate-900">{session.label}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Code de session :{" "}
              <span className="font-mono font-semibold text-slate-900 text-base">{session.join_code}</span>
            </p>
          </div>
          <div className="text-right">
            <StatusBadge isConnected={isConnected} isClosed={isClosed} />
            {!isClosed && (
              <button
                onClick={handleClose}
                className="mt-2 block text-sm text-red-600 hover:text-red-700"
              >
                Clôturer la session
              </button>
            )}
          </div>
        </div>
      </section>

      {isClosed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Cette session a été clôturée.
        </p>
      )}

      <section className="space-y-3">
        {questions.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Aucune question pour l'instant.</p>
        )}
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
              <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
                {clarifications.map((c) => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                    <span className="text-xs text-slate-400 block mb-1">
                      ↳ Clarification de <span className="font-mono">{c.pseudonym}</span>
                    </span>
                    <p className="text-slate-700">{c.content}</p>
                    <SatisfactionBadge satisfaction={c.satisfaction} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {flagFeedback && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm rounded-lg px-4 py-2 shadow-lg">
          {flagFeedback}
        </div>
      )}

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
    return <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">Clôturée</span>;
  }
  return isConnected ? (
    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">● Temps réel actif</span>
  ) : (
    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">● Déconnecté</span>
  );
}

function QuestionCard({ question, isBanned, onToggleBan, onSelectPseudonym, onFlagForDeanon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={onSelectPseudonym}
            className="text-xs font-mono text-slate-400 hover:text-slate-600 hover:underline"
            title="Voir le fil de ce pseudonyme"
          >
            {question.pseudonym}
          </button>
          <p className="text-sm text-slate-900 mt-1">{question.content}</p>
          <SatisfactionBadge satisfaction={question.satisfaction} />
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          <button
            onClick={onToggleBan}
            className={`text-xs px-2 py-1 rounded-lg ${
              isBanned
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            {isBanned ? "Lever le bannissement" : "Bannir"}
          </button>
          <button
            onClick={onFlagForDeanon}
            className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
            title="Ouvrir un e-mail pré-rempli pour signaler cette question à l'administrateur"
          >
            Signaler à l'admin
          </button>
        </div>
      </div>
    </div>
  );
}

function SatisfactionBadge({ satisfaction }) {
  if (!satisfaction) return null;

  const isSatisfied = satisfaction === "satisfied";
  return (
    <span
      className={`inline-block text-xs mt-1 px-2 py-0.5 rounded-full ${
        isSatisfied ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {isSatisfied ? "👍 Compris" : "👎 Pas clair"}
    </span>
  );
}
function PseudonymThreadModal({ token, sessionId, pseudonym, onClose }) {
  const [questions, setQuestions] = useState(null); // null = en chargement
  const [error, setError] = useState(null);

  useEffect(() => {
    listQuestionsByPseudonym(token, sessionId, pseudonym)
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de connexion."));
  }, [token, sessionId, pseudonym]);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-900">
            Fil de <span className="font-mono">{pseudonym}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">
            Fermer
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {questions === null && !error && (
          <p className="text-sm text-slate-400">Chargement...</p>
        )}

        {questions && questions.length === 0 && (
          <p className="text-sm text-slate-400">Aucune question trouvée pour ce pseudonyme.</p>
        )}

        <div className="space-y-2">
          {questions?.map((q) => (
            <div
              key={q.id}
              className={`rounded-lg p-3 text-sm border ${
                q.is_filtered
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              {q.parent_id && (
                <span className="text-xs text-slate-400 block mb-1">↳ Clarification</span>
              )}
              <p>{q.content}</p>
              {q.is_filtered && (
                <span className="text-xs mt-1 block">Filtrée ({q.filter_reason})</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}