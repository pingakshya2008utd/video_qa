import os
from openai import OpenAI
import base64
from dotenv import load_dotenv
import json
from typing import Dict, Any
from google import genai

# Load environment variables
load_dotenv()

class OpenAIVisionClient:
    def __init__(self):
        """Initialize the OpenAI client with API key from environment variables"""
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"  # OpenAI's vision model
    
    def _encode_image(self, image_path):
        """Encode image file to base64 string"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def ask_text_only(self, prompt, context=""):
        """Ask a text-only question"""
        try:
            messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"Context: {context}\n\nQuestion: {prompt}"}]

            response = self.client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500,
            temperature=0
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"
    
    def ask_with_image(self, prompt, image_path):
        """Ask a question with both text prompt and image"""
        try:
            # Encode the image
            base64_image = self._encode_image(image_path)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"
    
    def ask_with_image_url(self, prompt, image_url):
        """Ask a question with a text prompt and an image URL"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"


class GeminiQuizClient:
    def __init__(self, model_name: str = "gemini-1.5-flash"):
        """Initialize Gemini client."""
        self.client = genai.Client()

    def generate_quiz(
        self,
        transcript: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        include_explanations: bool = True,
        language: str = "en",
    ) -> Dict[str, Any]:
        """
        Generate a quiz as structured JSON from a transcript.

        Returns a dict following the response schema.
        """
        if not transcript or not transcript.strip():
            raise ValueError("Transcript is empty")

        # JSON Schema for structured output
        response_schema: Dict[str, Any] = {
            "type": "object",
            "properties": {
                "metadata": {
                    "type": "object",
                    "properties": {
                        "video_context_excerpt": {"type": "string"},
                        "num_questions": {"type": "integer"},
                        "difficulty": {"type": "string"},
                        "language": {"type": "string"},
                    },
                    "required": [
                        "num_questions",
                        "difficulty",
                        "language",
                    ],
                },
                "quiz": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "difficulty": {"type": "string"},
                            "question": {"type": "string"},
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 3,
                                "maxItems": 5
                            },
                            "answer": {
                                "type": "string"
                            },
                            "explanation": {"type": "string"},
                        },
                        "required": ["id", "question", "options", "answer"],
                    },
                },
            },
            "required": ["quiz", "metadata"],
        }

        instruction = (
            "You are generating quizzes for Vidya AI, an app that helps learners study YouTube videos. "
            "Use ONLY the provided transcript as ground truth. Do not invent facts. "
            "Create MCQ-only questions that assess understanding of key ideas and relationships, not trivial recall. "
            "Cover the main concepts across the whole video (balanced coverage). "
            "Write clear, unambiguous items with concise wording. Avoid double negatives and avoid timecode references. "
            "Options must be mutually exclusive, plausible, and grounded in the transcript with exactly one correct answer. "
            "The 'answer' value MUST exactly match the text of the correct option. "
            "Output must be valid JSON matching the provided schema; do not include any markdown or commentary."
        )

        # # Limit transcript size for safety; Gemini 1.5 supports large contexts, but we keep a cap
        # max_chars = 120_000
        # safe_transcript = transcript[:max_chars]

        prompt = (
            f"Language: {language}\n"
            f"Difficulty: {difficulty}\n"
            f"Question type: MCQ only\n"
            f"Total questions: {num_questions}\n"
            f"Include explanations: {'yes' if include_explanations else 'no'}\n\n"
            "Authoring guidelines:\n"
            "- Use only facts from the transcript; no outside knowledge.\n"
            "- Prioritize conceptual understanding over rote recall.\n"
            "- Ensure each question is self-contained and unambiguous.\n"
            "- Provide 3–5 unique, mutually exclusive options with one correct answer.\n"
            "- Avoid 'All of the above'/'None of the above' unless explicitly stated in the transcript.\n"
            "- The 'answer' must exactly equal one of the provided options.\n"
            "- If explanations are included, keep them brief and cite only transcript-grounded rationale.\n\n"
            "Transcript (YouTube video) begins below. Base all content on this text only.\n"
            # + safe_transcript
            + transcript
        )

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=instruction + "\n" + prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            },
        )

        # Parse JSON text
        text = getattr(response, "text", None)
        if not text:
            # Fallback: try candidates
            candidates = getattr(response, "candidates", None)
            if candidates and len(candidates) > 0:
                text = getattr(candidates[0], "content", None)
        if not text:
            raise RuntimeError("Empty response from Gemini")

        try:
            data = json.loads(text)
        except Exception:
            # Some SDKs return already-structured dict-like; attempt direct return
            if isinstance(text, dict):
                data = text
            else:
                # As a last resort wrap raw text
                data = {"raw": text}

        # Enrich metadata if missing
        data.setdefault("metadata", {})
        data["metadata"].setdefault("num_questions", num_questions)
        data["metadata"].setdefault("difficulty", difficulty)
        data["metadata"].setdefault("language", language)
        excerpt = transcript[:500]
        data["metadata"].setdefault("video_context_excerpt", excerpt)

        # Best-effort normalization to ensure MCQ-only with answers present
        quiz_items = data.get("quiz", []) if isinstance(data, dict) else []
        normalized_items = []
        for index, item in enumerate(quiz_items):
            if not isinstance(item, dict):
                continue
            if item.get("type") != "mcq":
                item["type"] = "mcq"
            # Ensure id
            item.setdefault("id", f"q{index+1}")
            # Ensure options list
            options = item.get("options") or []
            if not isinstance(options, list):
                options = [str(options)]
            item["options"] = [str(opt) for opt in options]
            # Ensure answer present and is string
            answer = item.get("answer")
            if isinstance(answer, bool):
                # convert boolean to string option if any matches, otherwise stringify
                answer = str(answer)
            if isinstance(answer, list):
                answer = answer[0] if answer else ""
            if answer is None:
                # If missing, attempt to infer by heuristic (do nothing reliable); mark empty
                answer = ""
            item["answer"] = str(answer)
            normalized_items.append(item)
        if isinstance(data, dict):
            data["quiz"] = normalized_items
        return data


# Example usage
if __name__ == "__main__":
    # Initialize the client
    vision_client = OpenAIVisionClient()
    
    # Example 1: Text-only question
    #text_response = vision_client.ask_text_only("Write a small story about a cat.")
    #print("Text-only response:")
    #print(text_response)
    #print("\n" + "="*50 + "\n")
    
    # Example 2: Question with local image
    # Make sure you have an image file named 'example.jpg' in the current directory
    try:
        
        image_response = vision_client.ask_with_image(
            "What objects do you see in this image?",
            "plane.jpg"
        )
        print("Image analysis response:")
        print(image_response)
        
        print("\n" + "="*50 + "\n")
    except Exception as e:
        print(f"Error with local image: {e}")
    
    # Example 3: Question with image URL
    '''
    image_url_response = vision_client.ask_with_image_url(
        "Describe this image in detail",
        "https://example.com/image.jpg"  # Replace with a valid image URL
    )
    '''
    print("Image URL response:")
    #print(image_url_response)