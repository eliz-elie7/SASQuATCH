import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { activateAccount } from "../api/auth";
import { ApiError } from "../api/client";

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  // Si le token est dans l'URL (lien cliqué), on l'utilise directement.
  // Sinon, l'utilisateur peut saisir le code court reçu dans le mail.
  const [manualCode, setManualCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

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

    // On envoie soit le token (depuis l'URL), soit le code court saisi.
    const activationToken = tokenFromUrl || null;
    const activationCode = !tokenFromUrl ? manualCode.toUpperCase().trim() : null;

    if (!activationToken && !activationCode) {
      setError("Veuillez saisir votre code d'activation.");
      return;
    }

    setIsSubmitting(true);
    try {
      await activateAccount(activationToken, activationCode, password);
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
        {/* Champ de code court — affiché uniquement si on n'a pas de token dans l'URL */}
        {!tokenFromUrl && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Code d'activation
              <span className="text-xs font-normal text-slate-400 ml-1">(reçu par e-mail)</span>
            </label>
            <input
              type="text"
              required
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Ex: AB3K7M2P"
              maxLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        )}

        {tokenFromUrl && (
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-4">
            Lien d'activation reconnu — choisissez simplement votre mot de passe.
          </p>
        )}

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