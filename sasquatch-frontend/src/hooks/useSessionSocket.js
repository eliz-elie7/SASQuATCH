import { useEffect, useRef, useState } from "react";
import { wsUrl } from "../api/client";

/**
 * Ouvre une connexion WebSocket vers /ws/sessions/{sessionId} et expose
 * les événements reçus du serveur (nouvelle question, bannissement,
 * clôture de session) -- voir CONTRAT_API_FRONTEND.md pour le détail
 * des messages possibles.
 *
 * Concept React important : useEffect avec un tableau de dépendances
 * [sessionId, token] signifie "ouvre la connexion quand le composant
 * apparaît, ferme-la et rouvre-en une nouvelle si sessionId ou token
 * changent, et ferme-la proprement si le composant disparaît" (le
 * `return` à l'intérieur de useEffect est la fonction de nettoyage).
 */
export function useSessionSocket(sessionId, token) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !token) return;

    const socket = new WebSocket(wsUrl(`/ws/sessions/${sessionId}?token=${token}`));
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    socket.onerror = () => setIsConnected(false);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastEvent(data);
    };

    // Fonction de nettoyage : appelée automatiquement par React quand
    // le composant qui utilise ce hook disparaît (ex: l'enseignant
    // quitte la page du dashboard), ou avant de rouvrir une nouvelle
    // connexion si sessionId/token changent.
    return () => {
      socket.close();
    };
  }, [sessionId, token]);

  return { isConnected, lastEvent };
}