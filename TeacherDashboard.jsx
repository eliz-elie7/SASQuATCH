import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { openSession, closeSession, banParticipant, unbanParticipant } from "../api/sessions";
import { listSessionQuestions, listQuestionsByPseudonym } from "../api/questions";
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
  const [selectedPseudonym, setSelectedPseudonym] = useState(null);

  // ÉTATS POUR L'INTELLIGENCE ARTICIELLE
  const [themes, setThemes] = useState(null);
  const [isClustering, setIsClustering] = useState(false);

  const { isConnected, lastEvent } = useSessionSocket(session.id, token);

  // Chargement initial
  useEffect(() => {
    listSessionQuestions(token, session.id)
      .then((data) => {
        if (data && data.questions) {
          setQuestions(data.questions);
        }
      })
      .catch(() => {});
  }, [session.id, token]);

  // Traitement des événements WebSocket reçus en temps réel
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case "new_question":
        setQuestions((prev) => [...prev, lastEvent.question]);
        setThemes(null); // On réinitialise le tri IA pour pouvoir recalculer avec la nouvelle question
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

  // FONCTION D'APPEL À LA ROUTE DE CLUSTERING IA
  async function handleClusterQuestions() {
    if (!questions || questions.length === 0) return;
    setIsClustering(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/questions/cluster?themes_count=3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questions }),
      });
      const data = await response.json();
      setThemes(data);
    } catch (err) {
      console.error("Erreur de tri IA:", err);
    } finally {
      setIsClustering(false);
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
          <div className="text-right flex flex-col items-end gap-2">
            <StatusBadge isConnected={isConnected} isClosed={isClosed} />
            
            {/* LE BOUTON RESTE ACCESSIBLE EN PERMANENCE ICI */}
            <button
              onClick={themes ? () => setThemes(null) : handleClusterQuestions}
              disabled={isClustering}
              className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {isClustering ? "Tri IA..." : themes ? "Voir liste normale" : "Regrouper par thèmes (IA)"}
            </button>

            {!isClosed && (
              <button
                onClick={handleClose}
                className="text-sm text-red-600 hover:text-red-700 mt-1"
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

      {/* ZONE DE RENDU DES QUESTIONS (CLASSIQUES OU TRIÉES PAR L'IA) */}
      <section className="space-y-3">
        {questions.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Aucune question pour l'instant.</p>
        )}

        {themes ? (
          Object.keys(themes).map((themeName) => (
            <div key={themeName} className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">{themeName}</h3>
              {themes[themeName].map((q) => (
                <div key={q.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-slate-800">{q.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{q.pseudonym}</p>
                </div>
              ))}
            </div>
          ))
        ) : (
          questions.map((q) => (
            <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedPseudonym(selectedPseudonym === q.pseudonym ? null : q.pseudonym)}
                  className="text-xs font-mono text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {q.pseudonym}
                </button>
              </div>
              <p className="text-sm text-slate-800 mt-1">{q.content}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function StatusBadge({ isConnected, isClosed }) {
  if (isClosed) return <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Session clôturée</span>;
  if (isConnected) return <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Connecté</span>;
  return <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Déconnecté</span>;
}