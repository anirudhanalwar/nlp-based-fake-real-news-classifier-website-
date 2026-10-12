from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import re
import string
import os
import json
import urllib.request

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

try:
    stop_words = set(stopwords.words('english'))
except Exception:
    nltk.download('stopwords', quiet=True)
    stop_words = set(stopwords.words('english'))

try:
    lemmatizer = WordNetLemmatizer()
    lemmatizer.lemmatize('test')
except Exception:
    nltk.download('wordnet', quiet=True)
    lemmatizer = WordNetLemmatizer()

app = Flask(__name__)
CORS(app)

# ✅ get absolute path of current file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ✅ correct file paths
model_path = os.path.join(BASE_DIR, "model.pkl")
vectorizer_path = os.path.join(BASE_DIR, "vectorizer.pkl")

# ✅ load model + vectorizer safely
with open(model_path, "rb") as f:
    model = pickle.load(f)

with open(vectorizer_path, "rb") as f:
    vectorizer = pickle.load(f)

def predict_news(text):
    text = text.lower()
    text = re.sub(r'\d+', '', text)
    text = text.translate(str.maketrans('', '', string.punctuation))

    tokens = text.split()
    tokens = [word for word in tokens if word not in stop_words]
    tokens = [lemmatizer.lemmatize(word) for word in tokens]

    cleaned_text = " ".join(tokens)

    vectorized_text = vectorizer.transform([cleaned_text])

    prediction = model.predict(vectorized_text)[0]
    probability = model.predict_proba(vectorized_text)[0]

    label = "REAL" if prediction == 1 else "FAKE"
    confidence = round(max(probability) * 100, 2)

    return label, confidence

@app.route('/')
def home():
    return "Fake News API Running"

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()

    # ✅ safer handling (avoid crash)
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data['text']
    label, confidence = predict_news(text)

    return jsonify({
        "prediction": label,
        "confidence": confidence
    })

def load_env_vars():
    env_file = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip("'\""))

load_env_vars()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.8-flash"
]

def call_gemini_fact_check(claim_text):
    prompt = f"""You are a professional, objective Fact Checker. Analyze the following news, claim, or statement to verify whether it is factually true or false.

Claim: \"{claim_text}\"

Respond in strict JSON with:
{{
  \"verdict\": \"TRUE\" | \"FALSE\" | \"PARTIALLY TRUE\" | \"MISLEADING\" | \"UNVERIFIED\",
  \"confidence\": 95,
  \"summary\": \"One or two concise sentences stating the verdict.\",
  \"explanation\": \"Clear, contextual paragraph explaining why it is true or false.\"
}}
Respond ONLY with the raw JSON object, without markdown fences or additional text."""

    payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
    last_err = None

    for m in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEMINI_API_KEY}"
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                res = json.loads(response.read().decode("utf-8"))
                raw_text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean = raw_text
                if clean.startswith("```"):
                    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.IGNORECASE)
                    clean = re.sub(r"\s*```$", "", clean)
                fb = clean.find("{")
                lb = clean.rfind("}")
                if fb != -1 and lb != -1:
                    clean = clean[fb:lb+1]
                try:
                    return json.loads(clean)
                except Exception:
                    return {
                        "verdict": "VERIFIED",
                        "confidence": 90,
                        "summary": "",
                        "explanation": raw_text
                    }
        except Exception as e:
            last_err = e
            continue

    raise Exception(f"All Gemini models failed: {last_err}")

@app.route('/fact-check', methods=['POST'])
def fact_check():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data['text']
    try:
        result = call_gemini_fact_check(text)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")

def clean_scraped_data(raw_data):
    meta = raw_data.get('data', {}).get('metadata', {})
    title = meta.get('title') or meta.get('ogTitle') or 'News Article'
    desc = meta.get('description') or meta.get('ogDescription') or ''
    markdown = raw_data.get('data', {}).get('markdown', '')

    clean = re.sub(r'!\[.*?\]\(.*?\)', '', markdown)
    clean = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'#{1,6}\s*', '', clean)

    paragraphs = [p.strip() for p in clean.split('\n') if len(p.strip()) > 35]
    filtered = [p for p in paragraphs if not any(w in p.lower() for w in ['cookie', 'privacy policy', 'subscribe', 'all rights reserved', 'advertisement', 'sign in', 'log in'])]

    lead = ' '.join(filtered[:2]) if filtered else ''
    if len(lead) > 500:
        lead = lead[:500] + '...'

    summary = desc.strip() if desc.strip() else (lead[:200] + '...' if len(lead) > 200 else lead)

    llm_claim = f"{title}. {summary}".strip()
    ml_text = f"{title}. {lead}".strip()
    if len(ml_text) > 600:
        ml_text = ml_text[:600]

    return {
        "title": title,
        "summary": summary,
        "llm_claim": llm_claim,
        "ml_text": ml_text
    }

@app.route('/scrape', methods=['POST'])
def scrape_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "No url provided"}), 400

    target_url = data['url']
    req = urllib.request.Request(
        "https://api.firecrawl.dev/v1/scrape",
        data=json.dumps({"url": target_url, "formats": ["markdown"], "onlyMainContent": True}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_res = json.loads(resp.read().decode("utf-8"))
            extracted = clean_scraped_data(raw_res)
            return jsonify({
                "success": True,
                "url": target_url,
                **extracted
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    import socket
    port = 5000
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('127.0.0.1', 5000)) == 0:
            port = 5001
    print(f"Starting server on http://127.0.0.1:{port}")
    app.run(debug=True, port=port)