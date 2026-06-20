Analyst Guide — EmotionIQ

Overview
- Use the 'Analyst' tab to get a concise report after running an analysis.
- Export full CSV or the Analyst Report (summary + top low-confidence items) for your internship deliverable.

Suggested workflow (Data Analyst Intern)
1. Upload CSV (Analyze → Batch upload) and run analysis.
2. Open 'Analyst' from the sidebar.
3. Review Quick Metrics and the "Low Confidence / Review Items" list — these are ideal for human QA.
4. Click "Export Report" to download a CSV with a summary and the top 25 low-confidence items for manual review.
5. Use the exported CSV to prepare charts and slides.

Interpretation tips
- "Avg confidence" is model certainty — review items with confidence < 40%.
- "Fallbacks" indicates keyword-based fallback results; cross-check their messages for false positives/negatives.
- For your report, include per-emotion counts and examples of corrected low-confidence items.

Notes
- The app uses DistilBERT via HuggingFace Inference API; model outputs can be noisy — rely on manual review for critical actions.
- The app runs up to 1000 messages per request; if you need to process larger files, split into chunks and re-run.

Contact
- If you need additional fields in the report, tell me which columns to include and I will add them.
