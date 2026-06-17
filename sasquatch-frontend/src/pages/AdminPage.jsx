import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { createUser, deanonymize } from "../api/admin";
import { ApiError } from "../api/client";

export function AdminPage() {
  const { token, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Espace administrateur</h1>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
            Se déconnecter
          </button>
        </div>

        <CreateUserForm token={token} />
        <div className="h-6" />
        <DeanonymizeForm token={token} />
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
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <h2 className="font-medium text-slate-900 mb-4">Créer un compte</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
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
          <p
            className={`col-span-2 text-sm rounded-lg px-3 py-2 border ${
              feedback.type === "success"
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-red-600 bg-red-50 border-red-200"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="col-span-2 bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
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
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <h2 className="font-medium text-slate-900 mb-1">Désanonymiser une contribution</h2>
      <p className="text-xs text-slate-500 mb-4">
        Action exceptionnelle et journalisée. Une justification est obligatoire.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ID de la question" value={questionId} onChange={(e) => setQuestionId(e.target.value)} />
        <Field label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-slate-900 text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Recherche..." : "Désanonymiser"}
        </button>
      </form>

      {result && (
        <div className="mt-4 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
          <p><strong>Pseudonyme :</strong> {result.pseudonym}</p>
          <p><strong>Identité :</strong> {result.prenom} {result.nom}</p>
          <p><strong>E-mail :</strong> {result.email}</p>
          <p><strong>Identifiant institutionnel :</strong> {result.institutional_id}</p>
          <p className="text-xs text-amber-600 mt-2">Journalisé (log_id: {result.log_id})</p>
        </div>
      )}
    </section>
  );
}

function Field({ label, as = "input", type = "text", value, onChange, children }) {
  const className =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
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