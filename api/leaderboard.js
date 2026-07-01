// API du classement partagé "Goutte à Goutte"
// Lit / écrit dans une base Upstash Redis (gratuite) :
//   - le top 10 "tous les temps"
//   - le top 10 "de la semaine" (remis à zéro chaque semaine, automatiquement)
//   - le total de gouttes collectées par tous les joueurs
//
// Deux variables d'environnement sont nécessaires (à définir sur Vercel) :
//   - UPSTASH_REDIS_REST_URL
//   - UPSTASH_REDIS_REST_TOKEN

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'bioxa_goutte_lb_v1';          // top 10 tous les temps (JSON)
const TOTAL_KEY = 'bioxa_goutte_total_v1'; // total de gouttes collectées, tous joueurs

// Gouttes déjà attrapées avant la mise en place du compteur partagé.
// Ajoutées comme point de départ (309 + 71 + 44 + 37 = 461).
const SEED_DROPS = 309 + 71 + 44 + 37;

// Numéro de semaine ISO (ex. "2026_27"), pour la clé du classement hebdomadaire.
function isoWeekId(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;            // lundi = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3);      // jeudi de la semaine
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return date.getUTCFullYear() + '_' + String(week).padStart(2, '0');
}
function weekKeyNow() {
  return 'bioxa_goutte_lb_week_' + isoWeekId(new Date());
}

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

// Ajoute une entrée dans une liste "top 10" (triée par score décroissant).
async function pushTop10(key, entry) {
  const raw = await redis(['GET', key]);
  let list = raw ? JSON.parse(raw) : [];
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 10);
  await redis(['SET', key, JSON.stringify(list)]);
  return list;
}

module.exports = async (req, res) => {
  // Si les clés Upstash ne sont pas configurées, on renvoie un état vide
  // au lieu de planter (le jeu reste jouable).
  if (!REST_URL || !REST_TOKEN) {
    res.status(200).json({ board: [], week: [], total: 0 });
    return;
  }

  try {
    const wKey = weekKeyNow();

    // GET : lire les deux classements + le total de sang collecté
    if (req.method === 'GET') {
      const rawList = await redis(['GET', KEY]);
      const rawWeek = await redis(['GET', wKey]);
      const rawTotal = await redis(['GET', TOTAL_KEY]);
      res.status(200).json({
        board: rawList ? JSON.parse(rawList) : [],
        week: rawWeek ? JSON.parse(rawWeek) : [],
        total: SEED_DROPS + (parseInt(rawTotal, 10) || 0),
      });
      return;
    }

    // POST : ajouter un score aux deux classements, incrémenter le total
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      body = body || {};

      const name = String(body.name || '???').toUpperCase().slice(0, 8);
      let score = parseInt(body.score, 10);
      if (!Number.isFinite(score)) score = 0;
      score = Math.max(0, Math.min(999999, score)); // garde-fou anti-triche basique

      const entry = { name, score };
      const list = await pushTop10(KEY, entry);
      const week = await pushTop10(wKey, entry);
      // 1 goutte = 1 point : on ajoute le score de la partie au total global.
      const total = await redis(['INCRBY', TOTAL_KEY, score]);

      res.status(200).json({
        board: list,
        week,
        total: SEED_DROPS + (parseInt(total, 10) || 0),
      });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (e) {
    // En cas d'erreur réseau/base, on renvoie un état vide pour ne pas casser le jeu.
    res.status(200).json({ board: [], week: [], total: 0 });
  }
};
