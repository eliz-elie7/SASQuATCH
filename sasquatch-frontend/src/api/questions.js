import { apiFetch } from "./client";

/** Soumission d'une question (ou clarification si parentId fourni). */
export function submitQuestion(token, sessionId, content, parentId = null) {
  return apiFetch("/questions", {
    method: "POST",
    token,
    body: { session_id: sessionId, content, parent_id: parentId },
  });
}

/** Liste les questions déjà soumises pour une session (chargement initial du dashboard). */
export function listSessionQuestions(token, sessionId, includeFiltered = false) {
  return apiFetch(`/questions/sessions/${sessionId}?include_filtered=${includeFiltered}`, {
    token,
  });
}

/** Fil de toutes les questions d'un même pseudonyme dans une session. */
export function listQuestionsByPseudonym(token, sessionId, pseudonym) {
  return apiFetch(`/questions/sessions/${sessionId}/pseudonym/${pseudonym}`, {
    token,
  });
}

/** Signale si la réponse à une question convient ou pas à son auteur. */
export function setSatisfaction(token, questionId, satisfaction) {
  return apiFetch(`/questions/${questionId}/satisfaction`, {
    method: "PATCH",
    token,
    body: { satisfaction },
  });
}

/**
 * Regroupe sémantiquement les questions par thèmes (IA locale,
 * sentence-transformers + K-Means). Retourne { "Thème 1": [...], ... }.
 */
export function clusterQuestions(token, questions, themesCount = 3) {
  return apiFetch(`/questions/cluster?themes_count=${themesCount}`, {
    method: "POST",
    token,
    body: { questions },
  });
}