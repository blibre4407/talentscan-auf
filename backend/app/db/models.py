from sqlalchemy import Column, Integer, String, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class CVProfile(Base):
    __tablename__ = "cv_profiles"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255))
    full_name = Column(String(255), index=True, nullable=True)
    hub = Column(String(100), index=True) 
    is_manual = Column(Boolean, default=False)
    
    # Contact & Structured Data (for manual entries)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    skills = Column(Text, nullable=True)
    experience = Column(Text, nullable=True)
    education = Column(Text, nullable=True)
    
    content = Column(Text)  # The raw searchable text
    vector_id = Column(Integer) 
    file_path = Column(String(500)) # Path to the stored/generated PDF
    parser_source = Column(String(50), nullable=True, default="manual")
    parser_confidence = Column(Integer, nullable=True, default=0)
    parser_missing_sections = Column(Text, nullable=True)
    profile_status = Column(String(50), nullable=True, default="new")
    recruiter_notes = Column(Text, nullable=True, default="")
