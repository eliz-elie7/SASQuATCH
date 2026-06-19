import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const ROLE_REDIRECT = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
};

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { access_token, role } = await login(email, password);
      signIn(access_token, role);
      navigate(ROLE_REDIRECT[role] ?? "/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell page-shell--auth">
      <form onSubmit={handleSubmit} className="surface-card surface-card--hero" style={{ width: "min(420px, 100%)" }}>
        <div>
          <p className="page-kicker">SASQuATCH</p>
          <h2 className="page-title" style={{ marginTop: 0, fontSize: "1.45rem" }}>
            Connexion
          </h2>
        </div>

        <label className="field">
          <span className="field-label">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            placeholder="email"
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span className="field-label">Mot de passe</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="notice notice--error">{error}</p>}

        <button type="submit" disabled={isSubmitting} className="primary-btn">
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
