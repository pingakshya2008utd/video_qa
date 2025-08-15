import requests
import json

url = "https://youtube-transcriptor.p.rapidapi.com/transcript"

querystring = {"video_id":"OxfeK423y2I","lang":"en"}

headers = {
	"x-rapidapi-key": "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b",
	"x-rapidapi-host": "youtube-transcriptor.p.rapidapi.com"
}

response = requests.get(url, headers=headers, params=querystring)

transcript_data = response.json()
transcript=transcript_data[0]["transcriptionAsText"]
print("Transcript  Data:", transcript)

#print(response.json())

with open('output.json', 'w') as f:
   json.dump(response.json(), f, indent=4)