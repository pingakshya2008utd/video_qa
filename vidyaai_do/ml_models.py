import os
from openai import OpenAI
import base64
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

class OpenAIVisionClient:
    def __init__(self):
        """Initialize the OpenAI client with API key from environment variables"""
        self.client = OpenAI(api_key="")
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
