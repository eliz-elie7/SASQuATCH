from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
# Importation de tes fonctions de sécurité et de hachage
from auth_utils import hash_password, verify_password, verify_teacher_role, verify_admin_role

# ------------------------------------------------------------
# 1. CONFIGURATION D'UNFAUX SERVEUR POUR LE TEST
# ------------------------------------------------------------
app = FastAPI()

# On crée une fausse route réservée aux profs protégée par ta barrière
@app.get("/test-prof")
async def route_prof(role: str = Depends(verify_teacher_role)):
    return {"status": "Succès", "msg": "Accès autorisé pour le Professeur"}

# On crée une fausse route réservée à l'admin protégée par ta barrière
@app.get("/test-admin")
async def route_admin(role: str = Depends(verify_admin_role)):
    return {"status": "Succès", "msg": "Accès autorisé pour l'Administrateur"}

# On initialise le client de simulation
client = TestClient(app)


# ------------------------------------------------------------
# 2. LES SCRIPTS DE TEST UNITAIRES
# ------------------------------------------------------------
def run_auth_tests():
    print("=== DÉBUT DES TESTS UNITAIRES DE SÉCURITÉ D'ACCÈS ===")

    # --- TEST A : Vérification du Hachage Bcrypt ---
    print("\n[Test A] Vérification du hachage de mot de passe...")
    mot_de_passe_eleve = "Insa2026!Secured"
    
    # Étape 1 : On hache
    hachage = hash_password(mot_de_passe_eleve)
    print(f"  -> Mot de passe en clair : {mot_de_passe_eleve}")
    print(f"  -> Empreinte générée (Bcrypt) : {hachage}")
    
    assert mot_de_passe_eleve != hachage, "Erreur CRITIQUE : Le mot de passe apparaît en clair !"
    
    # Étape 2 : On vérifie le bon mot de passe
    correct = verify_password(mot_de_passe_eleve, hachage)
    assert correct is True, "Erreur : La vérification a échoué avec le bon mot de passe."
    
    # Étape 3 : On vérifie un mauvais mot de passe
    incorrect = verify_password("MauvaisMotDePasse", hachage)
    assert incorrect is False, "Erreur : Bcrypt a validé un mauvais mot de passe !"
    
    print("  SUCCÈS : La brique Bcrypt est parfaitement étanche.")


    # --- TEST B : Sécurisation du Visualiseur Enseignant (§2.1.2) ---
    print("\n[Test B] Test des droits sur la route Enseignant...")
    
    # Étape 1 : Un étudiant essaie de forcer l'entrée
    response_eleve = client.get("/test-prof", headers={"Authorization": "Bearer token_student"})
    print(f"  -> Un étudiant tente d'entrer chez le prof. Code HTTP reçu : {response_eleve.status_code}")
    assert response_eleve.status_code == 403, "Erreur : Un étudiant a pu accéder à une zone Enseignant !"

    # Étape 2 : Le prof légitime se connecte
    response_prof = client.get("/test-prof", headers={"Authorization": "Bearer token_teacher"})
    print(f"  -> Le prof se connecte. Code HTTP reçu : {response_prof.status_code}")
    assert response_prof.status_code == 200, "Erreur : Le prof a été bloqué par erreur !"
    
    print(" SUCCÈS : Cloisonnement Étudiant/Enseignant validé.")


    # --- TEST C : Sécurisation de la Zone Administrative (§2.3.3) ---
    print("\n[Test C] Test des droits sur la route Administrative...")
    
    # Étape 1 : Le prof tente d'accéder à la désanonymisation administrative
    response_prof_sur_admin = client.get("/test-admin", headers={"Authorization": "Bearer token_teacher"})
    print(f"  -> Le prof tente de forcer la zone Admin. Code HTTP reçu : {response_prof_sur_admin.status_code}")
    assert response_prof_sur_admin.status_code == 403, "Erreur : Un enseignant a pu accéder à des privilèges Admin !"

    # Étape 2 : L'administrateur légitime se connecte
    response_admin = client.get("/test-admin", headers={"Authorization": "Bearer token_admin"})
    print(f"  -> L'admin se connecte. Code HTTP reçu : {response_admin.status_code}")
    assert response_admin.status_code == 200, "Erreur : L'admin a été bloqué."
    
    print(" SUCCÈS : Cloisonnement Enseignant/Administrateur validé.")


    # --- TEST D : Refus des connexions anonymes/sans badge ---
    print("\n[Test D] Test d'intrusion sans jeton valide...")
    response_pirate = client.get("/test-prof", headers={"Authorization": "Bearer faux_token_clandestin"})
    print(f"  -> Tentative d'intrusion sans jeton valide. Code HTTP reçu : {response_pirate.status_code}")
    assert response_pirate.status_code == 401, "Erreur : Le système a laissé passer un jeton inconnu !"
    
    print(" SUCCÈS : Blocage des connexions suspectes validé.")

    print("\n=== TOUT EST PARFAIT ! LA MATRICE DES DROITS DE TON SCRIPT EST VALIDÉE A 100% ===")

if __name__ == "__main__":
    run_auth_tests()