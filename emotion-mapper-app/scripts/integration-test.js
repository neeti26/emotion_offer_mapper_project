const http = require('http');
const https = require('https');

function fetch(url, opts={}){
  return new Promise((resolve, reject)=>{
    const lib = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const options = {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
    };
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', c=> data += c);
      res.on('end', ()=>{
        resolve({ status: res.statusCode, headers: res.headers, text: ()=>Promise.resolve(data), json: ()=>{ try{ return Promise.resolve(JSON.parse(data)); }catch(e){ return Promise.reject(e);} } });
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

async function run(){
  try{
    const base = process.env.PRODUCTION_URL || 'https://emotion-mapper-app.vercel.app';
    console.log('Using PRODUCTION_URL=', base);
    // Test configuration (override via env)
    const MAX_ATTEMPTS = parseInt(process.env.IT_MAX_ATTEMPTS || '6', 10);
    const BASE_DELAY_MS = parseInt(process.env.IT_BASE_DELAY_MS || '2000', 10);
    const LABEL_WHITELIST = (process.env.IT_LABEL_WHITELIST || 'joy,anger,sadness,fear,love,surprise').split(',').map(s=>s.trim());
    const CONFIDENCE_THRESHOLD = parseInt(process.env.IT_CONFIDENCE_THRESHOLD || '30', 10);

    // helper: retry wrapper
    async function retryable(fn, label){
      for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++){
        try {
          return await fn();
        } catch (e) {
          console.warn(`${label} attempt ${attempt} failed:`, e && e.message ? e.message : e);
          if (attempt === MAX_ATTEMPTS) throw e;
          const delay = BASE_DELAY_MS * Math.pow(1.8, attempt-1) + Math.floor(Math.random()*500);
          console.log(`Waiting ${delay}ms before retry`);
          await new Promise(r=>setTimeout(r, delay));
        }
      }
    }

    // Test /api/analyze with retries
    const analyzeUrl = `${base.replace(/\/$/, '')}/api/analyze`;
    const payload = { messages: ["I'm absolutely furious — my order arrived broken and customer service ignored me for 3 days!"] };
    console.log('POST', analyzeUrl, payload);
    const r = await retryable(async ()=>{
      const res = await fetch(analyzeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.status !== 200) throw new Error(`/api/analyze returned ${res.status}`);
      return res.json();
    }, 'analyze');

    if (!r || !Array.isArray(r.results) || r.results.length === 0) throw new Error('/api/analyze returned invalid body');
    const sample = r.results[0];
    console.log('/api/analyze sample:', sample);
    const emotion = (sample.emotion || '').toString().toLowerCase();
    const confidence = Number(sample.confidence || 0);
    if (!LABEL_WHITELIST.includes(emotion)) throw new Error(`Unexpected emotion label: ${emotion}`);
    if (confidence < CONFIDENCE_THRESHOLD) throw new Error(`Confidence ${confidence} below threshold ${CONFIDENCE_THRESHOLD}`);

    // Test /api/metrics with retries
    const metricsUrl = `${base.replace(/\/$/, '')}/api/metrics`;
    console.log('GET', metricsUrl);
    const metrics = await retryable(async ()=>{
      const res = await fetch(metricsUrl);
      if (res.status !== 200) throw new Error(`/api/metrics returned ${res.status}`);
      return res.json();
    }, 'metrics');
    console.log('/api/metrics OK:', metrics);

    console.log('Integration test passed');
    process.exit(0);
  }catch(e){
    console.error('Integration test failed:', e && e.message ? e.message : e);
    process.exit(2);
  }
}

run();
