from pydantic import BaseModel
from typing import Optional, List, Any


class FolderCreate(BaseModel):
    user_id: str
    name: str
    parent_id: Optional[str] = None
    source_type: str  # "uploaded" | "youtube"


class FolderOut(BaseModel):
    id: str
    user_id: str
    name: str
    parent_id: Optional[str]
    source_type: str

    class Config:
        from_attributes = True


class VideoOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    source_type: str
    title: Optional[str] = None
    youtube_id: Optional[str] = None
    youtube_url: Optional[str] = None
    s3_key: Optional[str] = None
    thumb_key: Optional[str] = None
    transcript_s3_key: Optional[str] = None
    local_path: Optional[str] = None
    transcript_text: Optional[str] = None
    formatted_transcript: Optional[str] = None
    folder_id: Optional[str] = None

    class Config:
        from_attributes = True


class MoveVideoRequest(BaseModel):
    video_id: str
    target_folder_id: Optional[str]


