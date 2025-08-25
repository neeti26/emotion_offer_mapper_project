# Emotion Offer Mapper Project

## 📌 Overview
This project analyzes customer messages, detects **emotions** and maps them to **personalized offers**.  
It provides a simple pipeline:  

**CSV input → Emotion detection → Offer mapping → CSV output**

The goal is to help businesses understand customer sentiments at scale and respond with the right offers.

---

## 📂 Project Structure
emotion_offer_mapper_project/
│
├── app.py # Main application entry
├── utils.py # Helper/utility functions
├── requirements.txt # Dependencies list
├── input_messages_100k.csv # Full input dataset
├── output_with_emotions.csv# Sample output with detected emotions
├── sample_100.csv # Small dataset for testing
├── .gitignore # Files ignored by Git
├── .gitattributes # Line ending normalization rules
└── pycache/ # Cache (ignored)

---

## ⚙️ Installation

1. **Clone the repo**
```bash
git clone https://github.com/neeti26/emotion_offer_mapper_project.git
cd emotion_offer_mapper_project

## Create a virtual environment
python -m venv venv
# Activate it:
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

Install dependencies
pip install -r requirements.txt

▶️ Usage
Run with the full dataset:
python app.py

Input: input_messages_100k.csv
Output: output_with_emotions.csv

Run with a small test dataset:
python app.py --input sample_100.csv

📑 Git Setup
This repo uses .gitignore and .gitattributes to keep the codebase clean:

.gitignore (ignores temporary and unnecessary files)
__pycache__/
*.pyc
*.pyo
*.pyd
*.sqlite3
.env
.DS_Store
<img width="1080" height="437" alt="image" src="https://github.com/user-attachments/assets/f0049946-2bb6-41c5-8af1-ca2ab9bdb0f0" />


