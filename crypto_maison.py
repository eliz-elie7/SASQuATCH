import hmac
import hashlib
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

def generate_session_pseudonym(secret_key: bytes, user_id: str) -> str:
    """
    Calcule le HMAC-SHA256 de l'user_id avec la secret_key de la session,
    l'encode en Base32 et renvoie un pseudonyme court (8 caractères).
    Conforme au paragraphe §5.3 du Cahier des Charges.
    """
    # 1. Conversion de l'user_id (string) en octets (bytes)
    user_id_bytes = user_id.encode('utf-8')
    
    # 2. Calcul du HMAC-SHA256 via le module natif hashlib
    hmac_object = hmac.new(secret_key, user_id_bytes, hashlib.sha256)
    hmac_digest = hmac_object.digest()
    
    # 3. Encodage en Base32 pour obtenir des caractères alphanumériques lisibles
    base32_encoded = base64.b32encode(hmac_digest).decode('utf-8')
    
    # 4. Troncation à 8 caractères pour la lisibilité par le professeur (ex: A7R3E2KX)
    short_pseudonym = base32_encoded[:8]
    
    return short_pseudonym


def encrypt_user_data(plain_text: str, master_key: bytes) -> str:
    """
    Chiffre une donnée sensible (nom, prénom, email) en AES-256 mode CBC.
    Retourne une chaîne de caractères en Base64 stockable dans MySQL (TEXT).
    Conforme au paragraphe §3.1 du Cahier des Charges.
    """
    # 1. Génération d'un Vecteur d'Initialisation (IV) aléatoire de 16 octets (128 bits)
    # L'IV doit changer à chaque chiffrement, même pour un même texte
    iv = AES.get_random_bytes(16)
    
    # 2. Initialisation du chiffreur AES-256 (la clé doit faire 32 octets / 256 bits)
    cipher = AES.new(master_key, AES.MODE_CBC, iv)
    
    # 3. Application du Padding (remplissage) pour que le texte soit un multiple de 16 octets
    padded_data = pad(plain_text.encode('utf-8'), AES.block_size)
    
    # 4. Chiffrement effectif
    encrypted_bytes = cipher.encrypt(padded_data)
    
    # 5. On concatène l'IV (obligatoire pour déchiffrer) et le message chiffré
    # On encode le tout en Base64 pour que MySQL puisse le stocker sous forme de texte brut
    result_base64 = base64.b64encode(iv + encrypted_bytes).decode('utf-8')
    
    return result_base64


def decrypt_user_data(cipher_text_base64: str, master_key: bytes) -> str:
    """
    Déchiffre une donnée issue de la table MySQL 'users' en AES-256 CBC.
    Utilisé par l'administrateur lors d'une procédure de désanonymisation (§2.3.3).
    """
    # 1. Décodage du Base64 pour récupérer les octets bruts
    raw_data = base64.b64decode(cipher_text_base64.encode('utf-8'))
    
    # 2. Extraction de l'IV (les 16 premiers octets) et du texte chiffré (le reste)
    iv = raw_data[:16]
    encrypted_bytes = raw_data[16:]
    
    # 3. Initialisation du déchiffreur avec la même clé et l'IV extrait
    cipher = AES.new(master_key, AES.MODE_CBC, iv)
    
    # 4. Déchiffrement
    decrypted_padded_bytes = cipher.decrypt(encrypted_bytes)
    
    # 5. Retrait du Padding et conversion en chaîne de caractères classique (string)
    plain_text = unpad(decrypted_padded_bytes, AES.block_size).decode('utf-8')
    
    return plain_text