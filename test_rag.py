"""
MultiModal RAG System for Video Processing 
=========================================================
This script implements a multimodal RAG (Retrieval-Augmented Generation) system
for video processing using LlamaIndex, LanceDB, and for more affordable
vision and embedding services.

Features:
- Extract frames from video
- Process both visual and audio content
- Build a query engine for natural language video search
"""

import os
import cv2
import shutil
import numpy as np
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional
import base64
import ssl

# LlamaIndex imports
from llama_index.core import SimpleDirectoryReader
from llama_index.core import StorageContext
from llama_index.core.indices.multi_modal.base import MultiModalVectorStoreIndex
from llama_index.vector_stores.lancedb import LanceDBVectorStore
from llama_index.core.schema import ImageNode, TextNode, Document
from llama_index.core.response.notebook_utils import display_source_node
from llama_index.core.schema import ImageNode
ssl._create_default_https_context = ssl._create_unverified_context
# Optional: Speech-to-Text for audio processing
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("Whisper not available. Audio transcription will be skipped.")


class VideoRAGSystem:
 
    
    def __init__(
        self, 
        db_path: str = "lancedb",
        text_table: str = "text_collection",
        image_table: str = "image_collection",
        frame_rate: int = 1,
       
    ):
        self.db_path = db_path
        self.text_table = text_table
        self.image_table = image_table
        self.frame_rate = frame_rate
        
        
        # Create storage context with vector stores
        self._initialize_storage()
        
       
    
    def _initialize_storage(self):
        """Set up the vector stores for text and images."""
        # Create vector stores for text and images
        self.text_store = LanceDBVectorStore(uri="lancedb", table_name="text_collection")
        self.image_store = LanceDBVectorStore(uri="lancedb", table_name="image_collection")
        
        # Create storage context
        self.storage_context = StorageContext.from_defaults(
            vector_store=self.text_store, 
            image_store=self.image_store
        )
    
    def extract_frames(self, video_path: str, output_folder: str) -> List[str]:
        """
        Extract frames from a video file at the specified frame rate.
        
        Args:
            video_path: Path to the video file
            output_folder: Folder to save extracted frames
            
        Returns:
            List of paths to extracted frame images
        """
        # Create output directory if it doesn't exist
        os.makedirs(output_folder, exist_ok=True)
        
        # Open the video file
        video = cv2.VideoCapture(video_path)
        fps = video.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps / self.frame_rate)
        
        # Extract frames
        frame_paths = []
        frame_count = 0
        success = True
        
        while success:
            success, frame = video.read()
            
            if not success:
                break
                
            if frame_count % frame_interval == 0:
                frame_path = os.path.join(output_folder, f"frame_{frame_count:06d}.jpg")
                cv2.imwrite(frame_path, frame)
                frame_paths.append(frame_path)
                
            frame_count += 1
        
        video.release()
        print(f"Extracted {len(frame_paths)} frames from video")
        return frame_paths
    
    def transcribe_audio(self, video_path: str, output_folder: str) -> str:
        """
        
        Args:
            video_path: Path to the video file
            output_folder: Folder to save transcription
            
        Returns:
            Path to the transcription file
        """
        transcript_path = os.path.join(output_folder, "transcript.txt")
        
        # Try using local Whisper if available
        if WHISPER_AVAILABLE:
            print("Transcribing audio using Whisper...")
            # Load Whisper model
            model = whisper.load_model("base")
            
            # Transcribe audio
            result = model.transcribe(video_path)
            
            # Save transcription
            with open(transcript_path, "w") as f:
                f.write(result["text"])
        
        
        print(f"Transcription saved to {transcript_path}")
        return transcript_path
    
    def process_video(self, video_path: str, process_audio: bool = True) -> Dict[str, Any]:
        """
        Process a video file by extracting frames and optionally transcribing audio.
        
        Args:
            video_path: Path to the video file
            process_audio: Whether to transcribe audio
            
        Returns:
            Dictionary with processing results
        """
        video_name = Path(video_path).stem
        output_folder = f"processed_{video_name}"
        
        # Clean up existing output folder if it exists
        if os.path.exists(output_folder):
            shutil.rmtree(output_folder)
        
        # Extract frames
        frame_paths = self.extract_frames(video_path, output_folder)
        
        # Transcribe audio if requested
        transcript_path = None
        if process_audio:
            transcript_path = self.transcribe_audio(video_path, output_folder)
        
        return {
            "output_folder": output_folder,
            "frame_paths": frame_paths,
            "transcript_path": transcript_path
        }

    def build_index(self, output_folder: str) -> MultiModalVectorStoreIndex:
        """
      
        
        Args:
            output_folder: Folder containing processed frames and transcript
            
        Returns:
            Multimodal vector store index
        """
        # Load documents (images and transcription)
        documents = SimpleDirectoryReader(output_folder).load_data()
        
        # Create the MultiModal index with specified embedding models
        index = MultiModalVectorStoreIndex.from_documents(
            documents,
            storage_context=self.storage_context,
            #embed_model=self.text_embed_model,
            #image_embed_model=self.image_embed_model
        )

        retriever_engine = index.as_retriever(
            similarity_top_k=4, image_similarity_top_k=10
            )
        print("------------------Retrieving results------------------")
        
        query_str = "Hashing by division"
        retrieval_results = retriever_engine.retrieve(query_str)
        #print(retrieval_results)
        retrieved_image = []
        retrieved_text = []
        for res_node in retrieval_results:
            if isinstance(res_node.node, ImageNode):
                retrieved_image.append(res_node.node.metadata["file_path"])
            else:
                display_source_node(res_node, source_length=200)
                retrieved_text.append(res_node.text)
        print("retrieved image length", len(retrieved_image))

        for i, img_path in enumerate(retrieved_image):
            # Read the image
            img = cv2.imread(img_path)
            if img is not None:
                # Create a unique window name for each image
                window_name = f"Image {i+1}"
                
                # Create a window that can be resized by the user
                cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
                
                # Display the image in that window
                cv2.imshow(window_name, img)
                
                print(f"Displaying {img_path} in window '{window_name}'")
            else:
                print(f"Failed to load image: {img_path}")
        
        cv2.waitKey(0)

        

        '''
        for im in retrieved_image:
            img=cv2.imread(im)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            cv2.imshow('Image', img)
            cv2.waitKey(0)  # Wait for any key press
        '''
        
        image_documents = SimpleDirectoryReader(input_dir=output_folder, input_files=retrieved_image).load_data()
        context_str = "".join(retrieved_text)

        

        '''

        retrieved_image = []
        retrieved_text = []
        for res_node in retrieval_results:
            if isinstance(res_node.node, ImageNode):
                retrieved_image.append(res_node.node.metadata["file_path"])
            else:
                display_source_node(res_node, source_length=200)
                retrieved_text.append(res_node.text)
        '''

   
        
        
        print(f"Built multimodal index with {len(documents)} documents")
        return index
    
    def create_query_engine(self, index: MultiModalVectorStoreIndex):
        """
        Create a query engine for the multimodal index.
        
        Args:
            index: The multimodal vector store index
            
        Returns:
            Multimodal query engine
        """
        # Remove the duplicate multi_modal_llm parameter
        return index.as_query_engine(
            similarity_top_k=5, image_similarity_top_k=5
        )

    
    
    def full_pipeline(self, video_path: str, process_audio: bool = True):
        """
        Run the complete video processing pipeline.
        
        Args:
            video_path: Path to the video file
            process_audio: Whether to transcribe audio
            
        Returns:
            Query engine for video RAG
        """
        # Process video
        process_results = self.process_video(video_path, process_audio)
        
        # Build index
        index = self.build_index(process_results["output_folder"])
        '''
        
        # Create query engine
        query_engine = self.create_query_engine(index)
        
        print(f"Video RAG pipeline complete. You can now query the video.")'
        '''
        return query_engine


# Example usage
if __name__ == "__main__":
    print("Running Video RAG System with")
    # Initialize the system
    video_rag = VideoRAGSystem(
        frame_rate=1,  # Extract 1 frame per second
    )
    
    # Process a video and create a query engine
    query_engine = video_rag.full_pipeline(
        video_path="video.mp4",
        process_audio=True
    )
    
    # Query the video
    response = query_engine.query("What is a hash map?")
    print(response)

    # Optional: Save response to a file
    with open("query_response.txt", "w") as f:
        f.write(str(response))
