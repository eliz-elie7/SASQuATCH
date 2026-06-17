import { apiFetch } from "./client";

/**
 * Connexion. Retourne { access_token, token_type, role }.
 */
export function login(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

/**
 * Activation du compte (première connexion via lien e-mail).
 * Retourne { message }.
 */
export function activateAccount(activationToken, newPassword) {
  return apiFetch("/auth/activate", {
    method: "POST",
    body: { activation_token: activationToken, new_password: newPassword },
  });
}