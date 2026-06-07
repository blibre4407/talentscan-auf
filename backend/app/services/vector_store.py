import faiss
import numpy as np
import os
from threading import RLock
from app.config import settings

INDEX_PATH = settings.faiss_index_path
DIMENSION = 384  
INDEX_LOCK = RLock()

# FIX: Guarantee directory exists for FAISS
os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)

def get_index():
    with INDEX_LOCK:
        if os.path.exists(INDEX_PATH):
            return faiss.read_index(INDEX_PATH)
        return faiss.IndexFlatIP(DIMENSION) 

def save_vector_to_faiss(vector: list[float]):
    if not vector:
        raise ValueError("Cannot store an empty vector.")

    with INDEX_LOCK:
        index = get_index()
        vector_np = np.array([vector]).astype('float32')
        
        faiss.normalize_L2(vector_np)
        index.add(vector_np)
        vector_id = index.ntotal - 1
        
        faiss.write_index(index, INDEX_PATH)
        return vector_id


def rebuild_faiss_index(vectors: list[list[float]]):
    with INDEX_LOCK:
        index = faiss.IndexFlatIP(DIMENSION)
        if vectors:
            vector_np = np.array(vectors).astype("float32")
            faiss.normalize_L2(vector_np)
            index.add(vector_np)
        faiss.write_index(index, INDEX_PATH)
        return index.ntotal


def get_index_count():
    with INDEX_LOCK:
        return get_index().ntotal

def search_faiss(query_vector: list[float], top_k: int = 5):
    """
    Searches the FAISS index for the closest matches to the query vector.
    Returns the similarity scores and the corresponding vector IDs.
    """
    if not query_vector:
        return [], []

    index = get_index()
    
    # If the index is empty, return empty arrays
    if index.ntotal == 0:
        return [], []
        
    vector_np = np.array([query_vector]).astype('float32')
    
    # Normalize the query vector (Crucial for Cosine Similarity with Inner Product)
    faiss.normalize_L2(vector_np)
    
    # .search returns distances (scores) and indices (vector IDs)
    distances, indices = index.search(vector_np, top_k)
    
    return distances[0], indices[0]
