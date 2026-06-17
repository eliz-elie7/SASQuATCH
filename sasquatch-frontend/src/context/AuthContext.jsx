import { createContext, useContext, useState } from "react";

// Concept React à connaître : un Context permet de partager une donnée
// (ici : qui est connecté) à travers toute l'application, sans avoir à
// la repasser manuellement de composant parent en composant enfant à
// chaque niveau ("prop drilling"). On l'utilise via le hook useAuth()
// défini en bas de ce fichier, depuis n'importe quel composant.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // On initialise depuis sessionStorage pour survivre à un rechargement
  // de page (sessionStorage, pas localStorage : effacé à la fermeture
  // de l'onglet, plus prudent pour un token d'authentification).
  const [token, setToken] = useState(() => sessionStorage.getItem("token"));
  const [role, setRole] = useState(() => sessionStorage.getItem("role"));

  function signIn(newToken, newRole) {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("role", newRole);
    setToken(newToken);
    setRole(newRole);
  }

  function signOut() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    setToken(null);
    setRole(null);
  }

  const value = {
    token,
    role,
    isAuthenticated: Boolean(token),
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() doit être utilisé à l'intérieur d'un <AuthProvider>");
  }
  return context;
}