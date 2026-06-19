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
        <span className="hero-badge">Compte activé</span>
        <p className="notice notice--success" style={{ marginTop: 16 }}>
          Votre compte a été activé avec succès.
        </p>
        <Link
          to="/login"
          className="primary-btn"
          style={{ marginTop: 16, display: "block", textAlign: "center", textDecoration: "none" }}
        >
          Se connecter
        </Link>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <span className="hero-badge">Première connexion</span>
      <h1 className="page-title" style={{ marginTop: 14 }}>
        Activer votre compte
      </h1>
      <p className="page-subtitle">Choisissez votre mot de passe pour finaliser votre accès.</p>

      <form onSubmit={handleSubmit} className="form-stack" style={{ marginTop: 20 }}>
        {/* Champ de code court — affiché uniquement si on n'a pas de token dans l'URL */}
        {!tokenFromUrl && (
          <label className="field">
            <span className="field-label">
              Code d'activation <span className="field-hint">(reçu par e-mail)</span>
            </span>
            <input
              type="text"
              required
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Ex: AB3K7M2P"
              maxLength={8}
              className="field-input field-input--mono"
            />
          </label>
        )}

        {tokenFromUrl && (
          <p className="notice notice--info">
            Lien d'activation reconnu — choisissez simplement votre mot de passe.
          </p>
        )}

        <label className="field">
          <span className="field-label">Mot de passe</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
        />
        </label>

        <label className="field">
          <span className="field-label">Confirmer le mot de passe</span>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="field-input"
        />
        </label>

        {error && (
          <p className="notice notice--error">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="primary-btn"
        >
          {isSubmitting ? "Activation..." : "Activer mon compte"}
        </button>
      </form>
    </CenteredCard>
  );
}

function CenteredCard({ children }) {
  return (
    <div className="page-shell page-shell--auth">
      <div className="surface-card surface-card--hero" style={{ width: "min(460px, 100%)" }}>
        {children}
      </div>
    </div>
  );
}