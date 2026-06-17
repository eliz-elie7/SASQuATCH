import { apiFetch } from "./client";

/** Ouverture d'une session par l'enseignant. Retourne id, label, join_code... */
export function openSession(token, label) {
  return apiFetch("/sessions", {
    method: "POST",
    token,
    body: { label },
  });
}

/** Un étudiant rejoint une session via son code. Retourne session_id, label, pseudonym. */
export function joinSession(token, joinCode) {
  return apiFetch("/sessions/join", {
    method: "POST",
    token,
    body: { join_code: joinCode },
  });
}

/** Clôture définitive d'une session par son enseignant créateur. */
export function closeSession(token, sessionId) {
  return apiFetch(`/sessions/${sessionId}/close`, {
    method: "POST",
    token,
  });
}

/** Bannissement temporaire d'un pseudonyme. */
export function banParticipant(token, sessionId, pseudonym) {
  return apiFetch(`/sessions/${sessionId}/ban`, {
    method: "POST",
    token,
    body: { pseudonym },
  });
}

/** Levée d'un bannissement. */
export function unbanParticipant(token, sessionId, pseudonym) {
  return apiFetch(`/sessions/${sessionId}/unban`, {
    method: "POST",
    token,
    body: { pseudonym },
  });
}