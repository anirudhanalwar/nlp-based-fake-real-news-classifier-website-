
# 📰 Fake News Detection using NLP

A machine learning-based Fake News Detection system built using Python, TF-IDF feature engineering, and classical text classification models.

This project detects whether a news article is **REAL** or **FAKE** based purely on textual content.

---

## 🚀 Project Overview

This system:

- Loads and merges real and fake news datasets
- Performs advanced text preprocessing
- Applies TF-IDF vectorization (unigrams + bigrams)
- Trains and compares:
  - Logistic Regression
  - Multinomial Naive Bayes
- Evaluates performance using:
  - Accuracy
  - Precision
  - Recall
  - F1-score
  - Confusion Matrix
- Extracts most important predictive words
- Performs error analysis

---

## 📊 Dataset

Dataset used:
- Fake and Real News Dataset
- Contains:
  - `True.csv` (Real news articles)
  - `Fake.csv` (Fake news articles)

Total samples: ~44,000+

Each record contains:
- title
- text
- subject
- date

---

## 🧠 Methodology

### 1️⃣ Data Preprocessing
- Removed publisher bias (e.g., "Reuters")
- Lowercasing
- Punctuation removal
- Stopword removal
- Lemmatization
- Combined title + text

### 2️⃣ Feature Engineering
- TF-IDF Vectorizer
- max_features = 5000
- ngram_range = (1, 2)

### 3️⃣ Model Training
- Logistic Regression
- Multinomial Naive Bayes

### 4️⃣ Evaluation Metrics
- Accuracy
- Precision
- Recall
- F1-score
- Confusion Matrix

---

## 📈 Results

| Model | Accuracy |
|--------|----------|
| Logistic Regression | ~98% |
| Naive Bayes | ~94% |

Logistic Regression performed better due to handling correlated text features more effectively.

---

## 🔍 Feature Importance

Top words strongly associated with:

- Fake news → emotionally charged and sensational terms
- Real news → neutral journalistic tone words

---

## ⚠️ Limitations

- Dataset contains source-based bias (e.g., Reuters formatting)
- Model learns writing style patterns, not factual verification
- No real-world fact-checking capability
- Limited to lexical analysis (no contextual embeddings)

---

## 🔮 Future Improvements

- Hyperparameter tuning
- Cross-validation
- Word embeddings (Word2Vec / GloVe)
- Transformer-based models (BERT)
- Real-world fact-check datasets
- Deployment as API

---

## 🛠 Tech Stack

- Python
- Pandas
- NumPy
- NLTK
- Scikit-learn
- Matplotlib
- Seaborn

---

## 📌 How to Run

1. Upload `True.csv` and `Fake.csv`
2. Run notebook cells sequentially
3. Use:

```python
predict_news("your news text here", lr_model, vectorizer)
