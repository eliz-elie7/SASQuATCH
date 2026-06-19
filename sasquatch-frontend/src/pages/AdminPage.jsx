import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { createUser, deanonymize } from "../api/admin";
import { ApiError } from "../api/client";

export function AdminPage() {
  const { token, signOut } = useAuth();

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="page-shell__inner dashboard-layout" style={{ maxWidth: 1100 }}>
        <header className="dashboard-topbar">
          <div>
            <p className="page-kicker">Espace administrateur</p>
            <h1 className="page-title">Gérer les accès et les désanonymisations</h1>
            <p className="page-subtitle">
              Les actions sensibles restent visibles, tracées et mieux séparées pour limiter les erreurs de lecture.
            </p>
          </div>
          <button onClick={signOut} className="ghost-btn">
            Se déconnecter
          </button>
        </header>

        <div className="section-grid section-grid--two">
          <CreateUserForm token={token} />
          <DeanonymizeForm token={token} />
        </div>
      </div>
    </div>
  );
}

function CreateUserForm({ token }) {
  const [form, setForm] = useState({
    institutional_id: "",
    nom: "",
    prenom: "",
    email: "",
    role: "student",
  });
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const result = await createUser(token, form);
      setFeedback({
        type: "success",
        message: `Compte créé (id: ${result.id}). Un e-mail d'activation a été envoyé.`,
      });
      setForm({ institutional_id: "", nom: "", prenom: "", email: "", role: "student" });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof ApiError ? err.message : "Erreur de connexion au serveur.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card surface-card--hero">
      <span className="hero-badge">Création de compte</span>
      <h2 className="page-title" style={{ marginTop: 14, fontSize: "1.55rem" }}>
        Créer un compte
      </h2>
      <p className="page-subtitle">
        Les nouveaux comptes reçoivent un e-mail d’activation et apparaissent dans le bon rôle immédiatement.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3" style={{ marginTop: 18 }}>
        <Field label="Identifiant institutionnel" value={form.institutional_id} onChange={updateField("institutional_id")} />
        <Field label="Rôle" as="select" value={form.role} onChange={updateField("role")}>
          <option value="student">Étudiant</option>
          <option value="teacher">Enseignant</option>
        </Field>
        <Field label="Nom" value={form.nom} onChange={updateField("nom")} />
        <Field label="Prénom" value={form.prenom} onChange={updateField("prenom")} />
        <div className="col-span-2">
          <Field label="E-mail" type="email" value={form.email} onChange={updateField("email")} />
        </div>

        {feedback && (
          <p className={`col-span-2 notice ${feedback.type === "success" ? "notice--success" : "notice--error"}`}>
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="col-span-2 primary-btn"
        >
          {isSubmitting ? "Création..." : "Créer le compte"}
        </button>
      </form>
    </section>
  );
}

function DeanonymizeForm({ token }) {
  const [questionId, setQuestionId] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsSubmitting(true);
    try {
      const data = await deanonymize(token, { question_id: questionId, reason });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card surface-card--hero">
      <span className="hero-badge">Action sensible</span>
      <h2 className="page-title" style={{ marginTop: 14, fontSize: "1.55rem" }}>
        Désanonymiser une contribution
      </h2>
      <p className="page-subtitle">
        Action exceptionnelle et journalisée. Une justification est obligatoire.
      </p>
      <form onSubmit={handleSubmit} className="form-stack" style={{ marginTop: 18 }}>
        <Field
          label="ID de la question (transmis par l'enseignant)"
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
        />
        <Field label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} />

        {error && (
          <p className="notice notice--error">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="primary-btn"
        >
          {isSubmitting ? "Recherche..." : "Désanonymiser"}
        </button>
      </form>

      {result && (
        <div className="notice notice--warning" style={{ marginTop: 16 }}>
          <p style={{ marginTop: 0 }}>
            <strong>Pseudonyme :</strong> {result.pseudonym}
          </p>
          <p><strong>Identité :</strong> {result.prenom} {result.nom}</p>
          <p><strong>E-mail :</strong> {result.email}</p>
          <p><strong>Identifiant institutionnel :</strong> {result.institutional_id}</p>
          <p className="field-hint" style={{ marginBottom: 0 }}>Journalisé (log_id: {result.log_id})</p>
        </div>
      )}
    </section>
  );
}

function Field({ label, as = "input", type = "text", value, onChange, children }) {
  const className = as === "select" ? "field-select" : type === "email" ? "field-input" : "field-input";

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {as === "select" ? (
        <select value={value} onChange={onChange} className={className}>
          {children}
        </select>
      ) : (
        <input type={type} required value={value} onChange={onChange} className={className} />
      )}
    </label>
  );
}