// Configuration de base pour parler au backend FastAPI.
// Toute la logique d'appel HTTP transite par apiFetch() ci-dessous,
// pour ne jamais dupliquer la gestion du token et des erreurs dans
// chaque fichier api/*.js.

const API_BASE_URL = "http://localhost:8000";

/**
 * Wrapper autour de fetch() qui :
 * - préfixe l'URL avec API_BASE_URL
 * - ajoute automatiquement le header Authorization si un token est fourni
 * - convertit le corps en JSON automatiquement
 * - lève une erreur JS lisible si le backend renvoie un code d'erreur
 *   (le backend répond toujours { detail: "..." } en cas d'erreur,
 *   voir CONTRAT_API_FRONTEND.md)
 */
export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Le backend renvoie parfois une réponse vide (ex: certains 204).
  // On essaie de parser le JSON, mais sans planter si c'est vide.
  let data = null;
  const text = await response.text();
  if (text) {
    data = JSON.parse(text);
  }

  if (!response.ok) {
    // FastAPI renvoie systématiquement { detail: "message" } en erreur.
    const message = data?.detail || `Erreur ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function wsUrl(path) {
  // Construit l'URL WebSocket à partir de la même base, en remplaçant
  // le protocole http(s) par ws(s).
  return `${API_BASE_URL.replace(/^http/, "ws")}${path}`;
}