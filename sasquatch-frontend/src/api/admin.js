import { apiFetch } from "./client";

/**
 * Création d'un compte (étudiant ou enseignant) par l'admin.
 * Retourne { id, role, is_active }.
 */
export function createUser(token, { institutional_id, nom, prenom, email, role }) {
  return apiFetch("/admin/users", {
    method: "POST",
    token,
    body: { institutional_id, nom, prenom, email, role },
  });
}

/**
 * Désanonymisation d'une contribution. Action sensible, journalisée
 * côté serveur. Retourne l'identité réelle en clair (voir CONTRAT_API_FRONTEND.md).
 */
export function deanonymize(token, { question_id, reason }) {
  return apiFetch("/admin/deanonymize", {
    method: "POST",
    token,
    body: { question_id, reason },
  });
}