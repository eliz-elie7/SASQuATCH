import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { joinSession } from "../api/sessions";
import { submitQuestion, setSatisfaction } from "../api/questions";
import { ApiError } from "../api/client";

export function StudentPage() {
  const { token, signOut } = useAuth();
  const [session, setSession] = useState(null); // { session_id, label, pseudonym }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Espace étudiant</h1>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
            Se déconnecter
          </button>
        </div>

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
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <h2 className="font-medium text-slate-900 mb-4">Rejoindre une session</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Code de session (ex: H549ME)"
          maxLength={6}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-slate-900 text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
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
    <div>
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-slate-900">{session.label}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Vous participez en tant que{" "}
              <span className="font-mono font-semibold text-slate-900">{session.pseudonym}</span>
            </p>
          </div>
          <button onClick={onLeave} className="text-sm text-slate-500 hover:text-slate-700">
            Quitter
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-medium text-slate-900 mb-3">Poser une question</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Votre question..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-slate-900 text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Envoi..." : "Envoyer"}
          </button>
        </form>
      </section>

      {submittedQuestions.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-slate-500 mb-2">Vos questions dans cette session</h3>
          <div className="space-y-2">
            {submittedQuestions.map((q) => (
              <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
                <p className="text-slate-700">{q.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-400">La réponse vous convient-elle ?</span>
                  <button
                    onClick={() => handleSetSatisfaction(q.id, "satisfied")}
                    className={`text-xs px-2 py-1 rounded-lg ${
                      q.satisfaction === "satisfied"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    👍 Compris
                  </button>
                  <button
                    onClick={() => handleSetSatisfaction(q.id, "unsatisfied")}
                    className={`text-xs px-2 py-1 rounded-lg ${
                      q.satisfaction === "unsatisfied"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    👎 Pas clair
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}