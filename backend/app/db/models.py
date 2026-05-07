from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class CVProfile(Base):
    __tablename__ = "cv_profiles"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255))
    content = Column(Text)  # The raw text from pdfplumber
    vector_id = Column(Integer) # The index position in the FAISS file