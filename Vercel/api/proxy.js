const https = require('https');

const FD_KEY = 'e091521cbb614d8e9fb894ad977e0513';
const AF_KEY = '6027f198abfd437c070148bc65c2e643';

const cache = {};
const CACHE_LIVE = 30000;
const CACHE_STATIC = 300000;

function getCacheTTL(url) {
  if (url.includes('standings') || url.includes('leagues')) return CACHE_STATIC;
  return CACHE_LIVE;
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { source, endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

  const cacheKey = `${source}_${endpoint}`;
  const now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].time) < getCacheTTL(endpoint)) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[cacheKey].data);
  }

  try {
    let url, headers;
    if (source === 'af') {
      url = `https://v3.football.api-sports.io${endpoint}`;
      headers = { 'x-apisports-key': AF_KEY };
    } else {
      url = `https://api.football-data.org/v4${endpoint}`;
      headers = { 'X-Auth-Token': FD_KEY };
    }

    const data = await httpsGet(url, headers);
    cache[cacheKey] = { data, time: now };
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
