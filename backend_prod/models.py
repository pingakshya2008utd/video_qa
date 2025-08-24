import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from db import Base


class SourceTypeEnum(str):
    UPLOADED = "uploaded"
    YOUTUBE = "youtube"


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    parent_id = Column(String, ForeignKey("folders.id"), nullable=True)
    source_type = Column(String, nullable=False, index=True)  # "uploaded" or "youtube"
    created_at = Column(DateTime, default=datetime.now(timezone.utc), nullable=False)

    parent = relationship("Folder", remote_side=[id])
    videos = relationship("Video", back_populates="folder")


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True)  # we align with existing video_id (uuid or youtube id)
    user_id = Column(String, index=True, nullable=True)
    source_type = Column(String, nullable=False, index=True)  # "uploaded" or "youtube"
    title = Column(String, nullable=True)

    # YouTube specific
    youtube_id = Column(String, index=True, nullable=True)
    youtube_url = Column(String, nullable=True)

    # Uploaded specific / storage
    s3_key = Column(String, nullable=True)
    thumb_key = Column(String, nullable=True)
    transcript_s3_key = Column(String, nullable=True)
    local_path = Column(String, nullable=True)

    # Transcripts and formatting
    transcript_text = Column(Text, nullable=True)
    transcript_json = Column(JSONB, nullable=True)
    formatted_transcript = Column(Text, nullable=True)
    formatting_status = Column(JSONB, nullable=True)
    
    # Download and processing status
    download_status = Column(JSONB, nullable=True)  # Stores download progress/status
    download_path = Column(String, nullable=True)   # Path to downloaded video file
    
    # Upload progress tracking
    upload_status = Column(JSONB, nullable=True)    # Stores upload progress/status

    # Organization
    folder_id = Column(String, ForeignKey("folders.id"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.now(timezone.utc), nullable=False)

    folder = relationship("Folder", back_populates="videos")


