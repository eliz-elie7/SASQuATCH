from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from typing import List, Dict

# Chargement du modèle gratuit en local (léger et optimisé pour le CPU)
model = SentenceTransformer('all-MiniLM-L6-v2')

def regrouper_questions_par_theme(questions: List[Dict], n_clusters: int = 3) -> Dict[str, List[Dict]]:
    """
    Prend une liste de questions, extrait leur sens vectoriel (embeddings),
    et applique un algorithme K-Means pour les regrouper par thèmes.
    """
    if not questions:
        return {}
    
    # On ajuste le nombre de groupes si on a très peu de questions
    actual_clusters = min(n_clusters, len(questions))
    if actual_clusters < 2:
        return {"Thème Unique": questions}
    
    # 1. On extrait le texte de chaque question
    # (S'adapte si la clé s'appelle 'content' ou 'text' dans ton modèle)
    textes = [q.get('content', q.get('text', '')) for q in questions]
    
    # 2. L'IA génère les vecteurs sémantiques gratuitement en local
    embeddings = model.encode(textes)
    
    # 3. K-Means calcule les distances géométriques pour regrouper les phrases proches
    kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=10)
    kmeans.fit(embeddings)
    
    # 4. On trie les questions d'origine dans les bons paquets
    groupes = {f"Thème {i+1}": [] for i in range(actual_clusters)}
    for idx, label in enumerate(kmeans.labels_):
        nom_theme = f"Thème {label+1}"
        groupes[nom_theme].append(questions[idx])
        
    return groupes