from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import re
import string
import os

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# download once
nltk.download('stopwords')
nltk.download('wordnet')

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

stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

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

if __name__ == '__main__':
    app.run(debug=True)