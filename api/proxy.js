const https = require('https');
const AF_KEY = '6027f198abfd437c070148bc65c2e643';

const cache = {};
// Cache TTLs
const TTL = {
  live: 30000,       // 30s for live
  stats: 60000,      // 1min for stats (reduces requests significantly)
  standings: 600000, // 10min for standings
  fixtures: 120000,  // 2min for fixture lists
  default: 60000
};

function getCacheTTL(endpoint) {
  if (endpoint.includes('live=all')) return TTL.live;
  if (endpoint.includes('statistics')) return TTL.stats;
  if (endpoint.includes('standings')) return TTL.standings;
  if (endpoint.includes('fixtures')) return TTL.fixtures;
  return TTL.default;
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
        catch(e) { reject(new Error('JSON parse error')); }
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
  const ttl = getCacheTTL(endpoint);

  if (cache[endpoint] && (now - cache[endpoint].time) < ttl) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[endpoint].data);
  }

  try {
    const data = await httpsGet(`https://v3.football.api-sports.io${endpoint}`);
    cache[endpoint] = { data, time: now };
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch(e) {
    // Return cached data even if expired on error
    if (cache[endpoint]) return res.json(cache[endpoint].data);
    return res.status(500).json({ error: e.message });
  }
};
