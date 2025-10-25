import os
import json
import urllib.request
import urllib.error

key = os.environ["GEMINI_API_KEY"]
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

payload = {
    "contents": [{
        "parts": [{"text": "Hello, write a 3 word greeting"}]
    }]
}

req_data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    url,
    data=req_data,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req) as response:
        print("Success:")
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print(e.read().decode("utf-8"))
except Exception as e:
    print("Error:", e)
