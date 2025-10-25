import os
from backend.services.auto_analyze_service import auto_analyze_service

def test_gemini():
    api_key = os.environ["GEMINI_API_KEY"]
    video_path = "/home/unknown/Documents/for masi/outputs/processed/#trend [-uTeYhvpVKI].mp4"
    
    print(f"Testing Gemini auto analyze on: {video_path}")
    
    temp_dir = ".temp_test_gemini"
    os.makedirs(temp_dir, exist_ok=True)
    
    frames = auto_analyze_service._extract_frames(video_path, temp_dir, num_frames=2)
    print(f"Extracted frames: {frames}")
    
    if frames:
        import base64
        import requests
        import urllib3
        urllib3.disable_warnings()

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        parts = [{"text": "Analyze these frames from a video clip. Generate a very short, engaging, natural voiceover script (2 sentences max) describing what is happening."}]
        for f in frames:
            with open(f, "rb") as image_file:
                b64_data = base64.b64encode(image_file.read()).decode("utf-8")
            parts.append({"inlineData": {"mimeType": "image/jpeg", "data": b64_data}})

        payload = {"contents": [{"parts": parts}]}
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30, verify=False)
        print("Raw Response:", response.json())
    else:
        print("Failed to extract frames.")

if __name__ == "__main__":
    test_gemini()
