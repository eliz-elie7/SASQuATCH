import os
from crypto_maison import generate_session_pseudonym, encrypt_user_data, decrypt_user_data

def run_tests():
    print("=== DÉBUT DES TESTS CRYPTO ===")
    
    # 0. Configuration des clés secrètes globales (générées aléatoirement)
    # Dans l'application réelle, MASTER_KEY sera cachée dans l'environnement (.env)
    # SECRET_KEY_COURS_1 sera détruite à la clôture de la session de cours
    MASTER_KEY = os.urandom(32) # Clé de 256 bits pour l'AES
    SECRET_KEY_COURS_1 = os.urandom(32) # Secret S pour le cours de lundi
    SECRET_KEY_COURS_2 = os.urandom(32) # Secret S pour le cours de mardi
    
    student_id = "550e8400-e29b-41d4-a716-446655440000" # Exemple d'UUID d'un élève (Abdoulaye)
    student_name = "Imen"
    
    # ------------------------------------------------------------
    # TEST 1 : Stabilité du pseudonyme au cours d'une même session
    # ------------------------------------------------------------
    pseudo_1 = generate_session_pseudonym(SECRET_KEY_COURS_1, student_id)
    pseudo_2 = generate_session_pseudonym(SECRET_KEY_COURS_1, student_id)
    
    print(f"\n[Test 1] Génération du pseudonyme pour '{student_name}' :")
    print(f"  -> Essai 1 : {pseudo_1}")
    print(f"  -> Essai 2 : {pseudo_2}")
    
    assert pseudo_1 == pseudo_2, "Erreur: Le pseudonyme doit être identique pour une même session !"
    print(" SUCCÈS : Le pseudonyme est stable et déterministe pour la session.")

    # ------------------------------------------------------------
    # TEST 2 : Changement de pseudonyme entre deux sessions différentes
    # ------------------------------------------------------------
    pseudo_cours_2 = generate_session_pseudonym(SECRET_KEY_COURS_2, student_id)
    print(f"\n[Test 2] Pseudonyme du même élève au cours suivant :")
    print(f"  -> Session Lundi : {pseudo_1}")
    print(f"  -> Session Mardi : {pseudo_cours_2}")
    
    assert pseudo_1 != pseudo_cours_2, "Erreur: Le pseudonyme ne doit pas être le même d'un cours à l'autre !"
    print(" SUCCÈS : L'anonymat longitudinal est respecté (anti-profilage).")

    # ------------------------------------------------------------
    # TEST 3 : Chiffrement et Déchiffrement AES-256 (Table Users)
    # ------------------------------------------------------------
    print(f"\n[Test 3] Chiffrement des données de l'élève :")
    print(f"  -> Donnée en clair : {student_name}")
    
    # Chiffrement
    encrypted_name = encrypt_user_data(student_name, MASTER_KEY)
    print(f"  -> Chaîne stockée dans MySQL (chiffrée) : {encrypted_name}")
    
    # Vérification que ce n'est plus en clair
    assert student_name != encrypted_name, "Erreur: Le nom apparaît en clair !"
    
    # Déchiffrement (Simulation procédure admin de désanonymisation)
    decrypted_name = decrypt_user_data(encrypted_name, MASTER_KEY)
    print(f"  -> Donnée déchiffrée par l'Admin : {decrypted_name}")
    
    assert student_name == decrypted_name, "Erreur: Le déchiffrement n'a pas restitué le nom correct."
    print(" SUCCÈS : Le tunnel de chiffrement/déchiffrement AES-256 est parfaitement étanche.")

    print("\n=== TOUS LES TESTS SONT AU VERT ! TON SCRIPT EST VALIDE. ===")

if __name__ == "__main__":
    # Si besoin, exécute d'abord dans ton terminal : pip install pycryptodome
    run_tests()