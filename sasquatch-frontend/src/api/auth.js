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
 * Activation du compte (première connexion).
 * Passer soit activationToken (depuis le lien e-mail), soit activationCode
 * (code court saisi manuellement). L'autre doit être null.
 */
export function activateAccount(activationToken, activationCode, newPassword) {
  return apiFetch("/auth/activate", {
    method: "POST",
    body: {
      activation_token: activationToken,
      activation_code: activationCode,
      new_password: newPassword,
    },
  });
}