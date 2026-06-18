import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { openSession, closeSession, banParticipant, unbanParticipant } from "../api/sessions";
import { listSessionQuestions } from "../api/questions";
import { useSessionSocket } from "../hooks/useSessionSocket";
import { ApiError } from "../api/client";

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
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            isBanned={bannedPseudonyms.has(q.pseudonym)}
            onToggleBan={() => handleToggleBan(q.pseudonym)}
          />
        ))}
      </section>
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

function QuestionCard({ question, isBanned, onToggleBan }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-mono text-slate-400">{question.pseudonym}</span>
          <p className="text-sm text-slate-900 mt-1">{question.content}</p>
        </div>
        <button
          onClick={onToggleBan}
          className={`text-xs px-2 py-1 rounded-lg shrink-0 ${
            isBanned
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}
        >
          {isBanned ? "Lever le bannissement" : "Bannir"}
        </button>
      </div>
    </div>
  );
}