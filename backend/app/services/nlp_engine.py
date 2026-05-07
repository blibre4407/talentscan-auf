from sentence_transformers import SentenceTransformer

# We load the model globally so it only downloads/initializes once when the server starts
# Note: The very first time this runs, it will download ~400MB of model weights.
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
model = SentenceTransformer(MODEL_NAME)

def generate_vector(text: str) -> list[float]:
    """
    Converts a string of text into a 384-dimensional mathematical vector.
    """
    # Prevent empty strings from breaking the model
    if not text.strip():
        return []
        
    # The model.encode function handles the heavy AI lifting
    vector = model.encode(text)
    
    # Convert the numpy array to a standard Python list of floats 
    # so it can be easily stored in databases or sent as JSON
    return vector.tolist()