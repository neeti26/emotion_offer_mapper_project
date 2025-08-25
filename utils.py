# utils.py

import pandas as pd
from transformers import pipeline
import plotly.express as px

# Load sentiment model once
emotion_classifier = pipeline("text-classification", model="bhadresh-savani/distilbert-base-uncased-emotion", return_all_scores=False)

# Emotion to Offer Mapping
emotion_offer_map = {
    "joy": "Offer 30% off on premium plans",
    "anger": "Free consultation to resolve concerns",
    "sadness": "Send personalized coupon and apology",
    "fear": "Assure with extended return guarantee",
    "love": "Exclusive loyalty rewards",
    "surprise": "Flash sale access or freebie",
}

def predict_emotion(text):
    try:
        result = emotion_classifier(text)
        return result[0]['label']
    except:
        return "unknown"

def map_offer(emotion):
    return emotion_offer_map.get(emotion.lower(), "Default 10% off for everyone")

def visualize_emotions(df):
    emotion_counts = df['Predicted Emotion'].value_counts().reset_index()
    emotion_counts.columns = ['Emotion', 'Count']

    fig_bar = px.bar(
        emotion_counts,
        x='Emotion',
        y='Count',
        title='Emotion Distribution',
        color='Emotion'
    )

    fig_pie = px.pie(
        emotion_counts,
        names='Emotion',
        values='Count',
        title='Emotion Proportion'
    )

    return fig_bar, fig_pie
