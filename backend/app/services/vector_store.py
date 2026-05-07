import faiss
import numpy as np
import os

# Path to save the FAISS index in the persistent Docker volume
INDEX_PATH = "data/talentscan.index"
DIMENSION = 384  # Matches our MiniLM model output

def get_index():
    if os.path.exists(INDEX_PATH):
        return faiss.read_index(INDEX_PATH)
    # Create a new index if it doesn't exist
    return faiss.IndexFlatIP(DIMENSION)  # Inner Product for Cosine Similarity

def save_vector_to_faiss(vector: list[float]):
    index = get_index()
    # Convert list to a numpy array of type float32
    vector_np = np.array([vector]).astype('float32')
    
    # Normalize the vector for Cosine Similarity
    faiss.normalize_L2(vector_np)
    
    # Add to index and get its position
    index.add(vector_np)
    vector_id = index.ntotal - 1
    
    # Save the updated index back to the disk
    faiss.write_index(index, INDEX_PATH)
    return vector_id