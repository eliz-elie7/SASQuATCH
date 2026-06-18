import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { activateAccount } from "../api/auth";
import { ApiError } from "../api/client";

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const activationToken = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const navigate = useNavigate();

  // Cas d'erreur immédiat : pas de token dans l'URL (lien mal copié,
  // page ouverte directement sans passer par l'e-mail...).
  if (!activationToken) {
    return (
      <CenteredCard>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Lien d'activation invalide ou incomplet. Vérifiez que vous avez copié le lien
          complet depuis l'e-mail reçu.
        </p>
      </CenteredCard>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setIsSubmitting(true);
    try {
      await activateAccount(activationToken, password);
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <CenteredCard>
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Votre compte a été activé avec succès.
        </p>
        <Link
          to="/login"
          className="mt-4 block text-center bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Se connecter
        </Link>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <h1 className="text-xl font-semibold text-slate-900">Activer votre compte</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Choisissez votre mot de passe</p>

      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Confirmer le mot de passe</label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Activation..." : "Activer mon compte"}
        </button>
      </form>
    </CenteredCard>
  );
}

function CenteredCard({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}