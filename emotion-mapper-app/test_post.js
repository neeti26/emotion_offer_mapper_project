(async ()=>{
  try {
    const res = await fetch('https://emotion-mapper-app.vercel.app/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: ["I'm absolutely furious — my order arrived broken and customer service ignored me for 3 days!"] })
    });
    console.log('STATUS', res.status);
    const text = await res.text();
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log('RAW', text); }
  } catch (e) {
    console.error('ERR', e);
  }
})();
