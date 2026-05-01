const https = require('https');
const AF_KEY = '6027f198abfd437c070148bc65c2e643';

const cache = {};
const CACHE_LIVE = 30000;    // 30 сек
const CACHE_STATIC = 300000; // 5 мин

function getCacheTTL(endpoint) {
  if (endpoint.includes('standings') || endpoint.includes('leagues')) return CACHE_STATIC;
  if (endpoint.includes('live')) return CACHE_LIVE;
  return 60000; // 1 мин за останалото
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'x-apisports-key': AF_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const endpoint = req.query.endpoint || '';
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

  const now = Date.now();
  if (cache[endpoint] && (now - cache[endpoint].time) < getCacheTTL(endpoint)) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[endpoint].data);
  }

  try {
    const url = `https://v3.football.api-sports.io${endpoint}`;
    const data = await httpsGet(url);
    cache[endpoint] = { data, time: now };
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
