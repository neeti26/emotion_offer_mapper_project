# app.py

import streamlit as st
import pandas as pd
from utils import predict_emotion, map_offer, visualize_emotions

st.set_page_config(page_title="Customer Emotion to Offer Mapper", layout="wide")

st.title("🎯 Customer Emotion to Offer Mapper")
st.markdown("Upload customer feedback and automatically detect **emotions** & assign **personalized offers**!")

uploaded_file = st.file_uploader("📤 Upload a CSV file with a column `message`", type="csv")

if uploaded_file:
    df = pd.read_csv(uploaded_file)

    if 'message' not in df.columns:
        st.error("❌ The uploaded file must contain a 'message' column.")
    else:
        st.success("✅ File uploaded successfully!")
        st.write("📄 Preview of uploaded data:")
        st.dataframe(df.head())

        if st.button("🚀 Run Emotion Detection"):
            with st.spinner("Analyzing emotions..."):
                df["Predicted Emotion"] = df["message"].apply(predict_emotion)
                df["Suggested Offer"] = df["Predicted Emotion"].apply(map_offer)

            st.subheader("📈 Results")
            st.dataframe(df.head(20))

            # Visualize
            st.subheader("📊 Emotion Visualizations")
            fig_bar, fig_pie = visualize_emotions(df)
            st.plotly_chart(fig_bar, use_container_width=True)
            st.plotly_chart(fig_pie, use_container_width=True)

            # Download button
            st.download_button("📥 Download Full Results CSV", df.to_csv(index=False), file_name="emotion_offer_results.csv", mime="text/csv")
