import os
from openai import OpenAI
import base64
from dotenv import load_dotenv
import httpx
from system_prompt import SYSTEM_PROMPT_FORMATTED, SYSTEM_PROMPT_INITIAL
from typing import Dict, Any
import json
# Removed google.generativeai import - using OpenAI instead

# Load environment variables
load_dotenv()

class OpenAIVisionClient:
    def __init__(self):
        """Initialize the OpenAI client with API key from environment variables"""
        self.client = OpenAI() 
        self.model = "gpt-4o"  # OpenAI's vision model
    
    def _encode_image(self, image_path):
        """Encode image file to base64 string"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
        
    def ask_text_only(self, prompt, context=""):
        """Ask a text-only question with the appropriate system prompt based on transcript type"""
        try:
            # Check if the context contains timestamp markers
            has_timestamps = False
            if context and isinstance(context, str):
                # Look for timestamp patterns like "00:00 - 00:00" in the transcript
                has_timestamps = any(":" in line and " - " in line for line in context.split('\n') if line.strip())
            
            # Select the appropriate system prompt based on timestamp availability
            system_prompt = SYSTEM_PROMPT_FORMATTED if has_timestamps else SYSTEM_PROMPT_INITIAL
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context: {context}\n\nQuestion: {prompt}"}
            ]

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=1000,  # Increased for detailed responses
                temperature=0.3   # Slightly increased for more natural language
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"
        
        
    def ask_with_image(self, prompt, image_path, context=""):
        """Ask a question with both text prompt and image with the appropriate system prompt"""
        try:
            # Check if the context contains timestamp markers
            has_timestamps = False
            if context and isinstance(context, str):
                # Look for timestamp patterns like "00:00 - 00:00" in the transcript
                has_timestamps = any(":" in line and " - " in line for line in context.split('\n') if line.strip())
            
            # Select the appropriate system prompt based on timestamp availability
            system_prompt = SYSTEM_PROMPT_FORMATTED if has_timestamps else SYSTEM_PROMPT_INITIAL
            
            # Encode the image
            base64_image = self._encode_image(image_path)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Context (Video Transcript): {context}\n\nPlease analyze this video frame along with the provided transcript context and answer the following question: {prompt}"
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
                max_tokens=1000  # Increased for detailed responses
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

class OpenAIQuizClient:
    def __init__(self, model_name: str = "gpt-4o"):
        """Initialize OpenAI client."""
        self.client = OpenAI()  # Uses OPENAI_API_KEY from environment
        self.model = model_name

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
            + transcript
        )

        try:
            # Create the full prompt
            full_prompt = instruction + "\n" + prompt
            
            # Generate content using OpenAI with structured output
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a quiz generation assistant. Generate only valid JSON responses that match the provided schema exactly."},
                    {"role": "user", "content": full_prompt}
                ],
                response_format={"type": "json_object"},
                max_tokens=4000,
                temperature=0.3
            )

            # Parse JSON text
            text = response.choices[0].message.content
            if not text:
                raise RuntimeError("Empty response from OpenAI")

            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                print(f"Raw response: {text}")
                raise

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

        except Exception as e:
            print(f"Error generating quiz: {e}")
            raise

# Sample American Civil War transcript for testing
AMERICAN_CIVIL_WAR_TRANSCRIPT = """
Welcome to today's lecture on the American Civil War, one of the most defining conflicts in United States history. The Civil War lasted from 1861 to 1865 and fundamentally transformed the nation.

The roots of the Civil War can be traced back to deep-seated tensions between the Northern and Southern states over slavery, states' rights, and economic differences. The Northern states had developed a more industrialized economy based on manufacturing and commerce, while the Southern states relied heavily on an agricultural economy sustained by slave labor, particularly in cotton production.

The Missouri Compromise of 1820 attempted to maintain balance between free and slave states by admitting Missouri as a slave state and Maine as a free state. However, this was only a temporary solution. The Kansas-Nebraska Act of 1854, which allowed territories to decide for themselves whether to allow slavery, led to violent conflicts known as "Bleeding Kansas."

The election of Abraham Lincoln in 1860 was the final catalyst. Lincoln, representing the Republican Party, opposed the expansion of slavery into new territories, though he initially stated he would not interfere with slavery where it already existed. Southern states saw his election as a threat to their way of life and began seceding from the Union.

South Carolina was the first state to secede on December 20, 1860, followed by Mississippi, Florida, Alabama, Georgia, Louisiana, and Texas. These seven states formed the Confederate States of America in February 1861, with Jefferson Davis as their president and Montgomery, Alabama, as their capital, which later moved to Richmond, Virginia.

The war officially began on April 12, 1861, when Confederate forces attacked Fort Sumter in Charleston Harbor, South Carolina. The Union garrison, led by Major Robert Anderson, surrendered after a 34-hour bombardment. This attack galvanized Northern public opinion and led to Lincoln's call for 75,000 volunteers to suppress the rebellion.

Four more states - Virginia, Arkansas, North Carolina, and Tennessee - joined the Confederacy after Fort Sumter, while four slave states - Delaware, Maryland, Kentucky, and Missouri - remained in the Union as border states. The loyalty of these border states was crucial to the Union cause.

The early years of the war saw mixed results for both sides. The First Battle of Bull Run in July 1861 was a Confederate victory that shattered Northern illusions of a quick war. The battle demonstrated that this would be a long and bloody conflict. General Irvin McDowell led the Union forces, while Generals P.G.T. Beauregard and Joseph E. Johnston commanded the Confederates.

In the Western theater, Union General Ulysses S. Grant emerged as a capable leader. His victories at Fort Henry and Fort Donelson in February 1862 gave the Union control of important river routes and earned Grant national recognition. The Battle of Shiloh in April 1862, while a Union victory, was one of the bloodiest battles to that point, with over 23,000 total casualties.

The Peninsula Campaign of 1862 saw Union General George B. McClellan advance toward Richmond but fail to capture the Confederate capital. Robert E. Lee, who had assumed command of the Army of Northern Virginia, launched a series of attacks known as the Seven Days Battles, forcing McClellan to retreat.

The Second Battle of Bull Run in August 1862 was another Confederate victory under Lee and General Thomas "Stonewall" Jackson. This victory emboldened Lee to launch his first invasion of the North, leading to the Battle of Antietam on September 17, 1862. This single-day battle was the bloodiest in American history, with over 22,700 casualties. Although tactically inconclusive, Antietam was a strategic Union victory as it halted Lee's invasion and gave Lincoln the political capital to issue the preliminary Emancipation Proclamation.

The Emancipation Proclamation, issued on January 1, 1863, declared slaves in rebellious states to be free. While it didn't immediately free all slaves, it transformed the war from a conflict about preserving the Union into a moral crusade against slavery. This made it much less likely that European powers, particularly Britain and France, would recognize or support the Confederacy.

The year 1863 marked a turning point in the war. The Battle of Gettysburg, fought from July 1-3, 1863, was Lee's second and final invasion of the North. The three-day battle resulted in over 50,000 total casualties and ended with Lee's retreat back to Virginia. On the same day Gettysburg ended, Grant captured Vicksburg, Mississippi, giving the Union complete control of the Mississippi River and effectively splitting the Confederacy in two.

Lincoln delivered the Gettysburg Address on November 19, 1863, at the dedication of the national cemetery at Gettysburg. In just 272 words, Lincoln redefined the war as a struggle for the principles of human equality and democracy, stating that "these dead shall not have died in vain" and calling for "a new birth of freedom."

Grant's success in the Western theater led to his promotion to General-in-Chief of all Union armies in March 1864. He developed a coordinated strategy to attack the Confederacy on multiple fronts simultaneously, preventing Confederate forces from reinforcing each other. Grant would personally oversee the Virginia campaign against Lee, while General William Tecumseh Sherman would march through Georgia.

The Overland Campaign of 1864 saw Grant and Lee engage in a series of brutal battles - the Wilderness, Spotsylvania Court House, and Cold Harbor. Unlike previous Union generals, Grant refused to retreat after tactical defeats and continued pressing south toward Richmond. His strategy of attrition, while costly in Union lives, was gradually wearing down Lee's smaller army.

Sherman's Atlanta Campaign culminated in the capture of Atlanta in September 1864, providing a crucial boost to Lincoln's re-election campaign. Sherman's subsequent March to the Sea from Atlanta to Savannah was a campaign of total war, destroying military targets and civilian infrastructure to break the South's will to fight. Sherman's forces cut a 60-mile-wide swath of destruction across Georgia.

The election of 1864 was crucial for the war's continuation. Lincoln faced Democratic challenger George B. McClellan, who ran on a platform of negotiating peace with the Confederacy. Lincoln's victory, aided by soldier votes and Sherman's capture of Atlanta, ensured the war would continue until the Union was preserved and slavery ended.

By early 1865, the Confederacy was collapsing. Sherman had turned north through the Carolinas, while Grant maintained pressure on Lee around Petersburg and Richmond. On April 2, 1865, Lee was forced to abandon Petersburg and Richmond. Jefferson Davis and the Confederate government fled the capital.

Lee's army, reduced to about 28,000 men and desperately short of supplies, was surrounded by Grant's forces. On April 9, 1865, Lee surrendered to Grant at Appomattox Court House, Virginia. Grant's generous terms allowed Confederate soldiers to keep their horses and return home, helping to begin the process of national reconciliation.

The assassination of Abraham Lincoln by John Wilkes Booth on April 14, 1865, just five days after Lee's surrender, shocked the nation and complicated Reconstruction. Vice President Andrew Johnson assumed the presidency during this critical period.

The Civil War's consequences were profound and lasting. Over 600,000 Americans died, making it the deadliest conflict in American history. The war preserved the Union, ended slavery, and established the federal government's supremacy over states' rights. The Thirteenth Amendment, ratified in December 1865, formally abolished slavery throughout the United States.

Economically, the war accelerated Northern industrialization while devastating the Southern economy. The destruction of the plantation system and the emancipation of four million enslaved people fundamentally transformed Southern society. Reconstruction, the period from 1865 to 1877, would attempt to rebuild the South and integrate freed slaves into American society, though with mixed and often tragic results.

The Civil War also marked a revolution in military technology and tactics. The use of railroads, telegraphs, photography, and new weapons like rifled muskets and artillery changed warfare forever. Generals like Grant, Sherman, and Lee became legendary figures, their strategies studied in military academies worldwide.

In conclusion, the American Civil War was not just a military conflict but a social, political, and moral revolution that redefined the United States. It settled the questions of secession and slavery that had plagued the nation since its founding, though the struggle for true equality would continue long after the guns fell silent. The war's legacy continues to influence American politics, society, and identity to this day.
"""

# Example usage
if __name__ == "__main__":
    # Initialize the clients
    vision_client = OpenAIVisionClient()
    quiz_client = OpenAIQuizClient()
    
    # Test the quiz generation functionality
    print("Testing OpenAI GPT-4o Quiz Generation...")
    print("="*70)
    
    try:
        # Generate a quiz from the American Civil War transcript
        quiz_result = quiz_client.generate_quiz(
            transcript=AMERICAN_CIVIL_WAR_TRANSCRIPT,
            num_questions=7,
            difficulty="medium",
            include_explanations=True,
            language="en"
        )
        
        print("Quiz generation successful!")
        print(f"Generated {len(quiz_result.get('quiz', []))} questions")
        print("\nQuiz Preview:")
        print("-" * 50)
        
        # Display the first few questions as a preview
        quiz_items = quiz_result.get('quiz', [])
        for i, question in enumerate(quiz_items[:3]):  # Show first 3 questions
            print(f"\nQuestion {i+1}: {question.get('question', 'N/A')}")
            options = question.get('options', [])
            for j, option in enumerate(options):
                print(f"  {chr(65+j)}) {option}")
            print(f"Correct Answer: {question.get('answer', 'N/A')}")
            if question.get('explanation'):
                print(f"Explanation: {question.get('explanation')}")
            print("-" * 30)
        
        # Save the full quiz to a file
        with open('civil_war_quiz.json', 'w') as f:
            json.dump(quiz_result, f, indent=2)
        print(f"\nFull quiz saved to 'civil_war_quiz.json'")
        
        # Display metadata
        metadata = quiz_result.get('metadata', {})
        print(f"\nQuiz Metadata:")
        print(f"- Number of questions: {metadata.get('num_questions')}")
        print(f"- Difficulty: {metadata.get('difficulty')}")
        print(f"- Language: {metadata.get('language')}")
        print(f"- Context excerpt: {metadata.get('video_context_excerpt', '')[:100]}...")
        
    except Exception as e:
        print(f"Error testing quiz generation: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    
    # Example vision test (if you have an image)
    print("\nTesting Vision Client...")
    try:
        # Uncomment and modify if you have a test image
        # image_response = vision_client.ask_with_image(
        #     "What objects do you see in this image?",
        #     "plane.jpg"
        # )
        # print("Image analysis response:")
        # print(image_response)
        
        print("Vision client test skipped (no test image provided)")
        
    except Exception as e:
        print(f"Error with vision client: {e}")
