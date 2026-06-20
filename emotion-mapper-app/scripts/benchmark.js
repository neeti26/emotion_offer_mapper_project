const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function fetch(url, opts={}){
  return new Promise((resolve, reject)=>{
    const lib = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const options = { method: opts.method || 'GET', headers: opts.headers || {}, hostname: u.hostname, port: u.port || (u.protocol==='https:'?443:80), path: u.pathname + u.search };
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', c=> data += c);
      res.on('end', ()=> resolve({ status: res.statusCode, text: ()=>Promise.resolve(data), json: ()=>Promise.resolve(JSON.parse(data)) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body==='string'?opts.body:JSON.stringify(opts.body));
    req.end();
  });
}

async function run(){
  try{
    const base = process.env.TARGET_URL || 'https://emotion-mapper-app.vercel.app';
    const NUM = parseInt(process.env.NUM || '100', 10);
    const file = process.env.FILE || path.resolve(__dirname, '..', '..', 'sample_100.csv');
    const csvPath = path.resolve(file);
    let raw;
    try {
      raw = fs.readFileSync(csvPath, 'utf8');
    } catch (e) {
      // fallback: use bundled sample_100.csv and expand to NUM by repeating
      const samplePath = path.resolve(__dirname, '..', '..', 'sample_100.csv');
      raw = fs.readFileSync(samplePath, 'utf8');
      console.warn('Requested file not found; using sample and repeating to reach', NUM);
    }
    const lines = raw.split(/\r?\n/).filter(Boolean);
    // assume header present or not; extract first column values
    const msgsAll = lines.map(l => {
      const cols = l.split(',');
      return cols.slice(0).join(',').replace(/^\d+/, '').trim();
    }).filter(Boolean);
    // build msgs to requested NUM by repeating sample rows if needed
    const msgs = [];
    for (let i = 0; msgs.length < NUM; i++) {
      const base = msgsAll[i % msgsAll.length] || `message ${i}`;
      msgs.push(`${base} [#${i+1}]`);
    }
    console.log('Loaded', msgs.length, 'messages');

    const url = `${base.replace(/\/$/,'')}/api/analyze`;
    const payload = { messages: msgs };
    console.log('Posting to', url);
    const t0 = Date.now();
    const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const text = await res.text();
    const took = Date.now() - t0;
    console.log('Status:', res.status, 'Time ms:', took);
    try{ console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 800)); }catch(e){ console.log('Response truncated'); }
    console.log('Benchmark complete');
  }catch(e){ console.error('Benchmark failed', e); process.exit(2); }
}

run();
