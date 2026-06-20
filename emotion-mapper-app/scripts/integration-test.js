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
    // Test /api/analyze
    const analyzeUrl = `${base.replace(/\/$/, '')}/api/analyze`;
    const payload = { messages: ["I'm absolutely furious — my order arrived broken and customer service ignored me for 3 days!"] };
    console.log('POST', analyzeUrl, payload);
    const r = await fetch(analyzeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.status !== 200) throw new Error(`/api/analyze returned ${r.status}`);
    const body = await r.json();
    if (!body || !Array.isArray(body.results) || body.results.length === 0) throw new Error('/api/analyze returned invalid body');
    console.log('/api/analyze OK, sample:', body.results[0]);

    // Test /api/metrics
    const metricsUrl = `${base.replace(/\/$/, '')}/api/metrics`;
    console.log('GET', metricsUrl);
    const m = await fetch(metricsUrl);
    if (m.status !== 200) throw new Error(`/api/metrics returned ${m.status}`);
    const metrics = await m.json();
    console.log('/api/metrics OK:', metrics);

    console.log('Integration test passed');
    process.exit(0);
  }catch(e){
    console.error('Integration test failed:', e && e.message ? e.message : e);
    process.exit(2);
  }
}

run();
