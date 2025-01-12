import speech_recognition as sr

r = sr.Recognizer()
with sr.Microphone() as source:
    print("Say something!")
    audio = r.listen(source)

print("Google Speech Recognition thinks you said " + r.recognize_google(audio, language="de"))