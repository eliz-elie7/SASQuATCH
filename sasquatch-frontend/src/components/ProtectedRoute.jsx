import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Empêche l'accès à une route si l'utilisateur n'est pas connecté, ou
 * si son rôle ne fait pas partie de allowedRoles. Reflète la matrice de
 * droits stricte du cahier des charges (§2.1.2) : un étudiant ne doit
 * jamais pouvoir afficher l'interface enseignant, et inversement.
 */
export function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}