// API du classement partagé "Goutte à Goutte"
// Lit / écrit le top 10 dans une base Upstash Redis (gratuite).
//
// Deux variables d'environnement sont nécessaires (à définir sur Vercel) :
//   - UPSTASH_REDIS_REST_URL
//   - UPSTASH_REDIS_REST_TOKEN
// On les obtient en créant une base sur https://console.upstash.com (voir README).

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'bioxa_goutte_lb_v1';          // top 10 des scores (JSON)
const TOTAL_KEY = 'bioxa_goutte_total_v1'; // total de gouttes collectées, tous joueurs

// Envoie une commande Redis via l'API REST d'Upstash.
async function redis(command) {
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

module.exports = async (req, res) => {
  // Si les clés Upstash ne sont pas configurées, on renvoie un état vide
  // au lieu de planter (le jeu reste jouable).
  if (!REST_URL || !REST_TOKEN) {
    res.status(200).json({ board: [], total: 0 });
    return;
  }

  try {
    // GET : lire le classement + le total de sang collecté
    if (req.method === 'GET') {
      const rawList = await redis(['GET', KEY]);
      const rawTotal = await redis(['GET', TOTAL_KEY]);
      res.status(200).json({
        board: rawList ? JSON.parse(rawList) : [],
        total: parseInt(rawTotal, 10) || 0,
      });
      return;
    }

    // POST : ajouter un score, incrémenter le total, renvoyer l'état à jour
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      body = body || {};

      const name = String(body.name || '???').toUpperCase().slice(0, 8);
      let score = parseInt(body.score, 10);
      if (!Number.isFinite(score)) score = 0;
      score = Math.max(0, Math.min(999999, score)); // garde-fou anti-triche basique

      const raw = await redis(['GET', KEY]);
      let list = raw ? JSON.parse(raw) : [];
      list.push({ name, score });
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 10);

      await redis(['SET', KEY, JSON.stringify(list)]);
      // 1 goutte = 1 point : on ajoute le score de la partie au total global.
      const total = await redis(['INCRBY', TOTAL_KEY, score]);

      res.status(200).json({ board: list, total: parseInt(total, 10) || 0 });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (e) {
    // En cas d'erreur réseau/base, on renvoie un état vide pour ne pas casser le jeu.
    res.status(200).json({ board: [], total: 0 });
  }
};
