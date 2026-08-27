// API du classement partagé "Goutte à Goutte"
// Lit / écrit dans une base Upstash Redis (gratuite) :
//   - le top 20 "tous les temps" (un seul score par pseudo : le meilleur)
//   - le total de gouttes collectées par tous les joueurs
//
// Deux variables d'environnement sont nécessaires (à définir sur Vercel) :
//   - UPSTASH_REDIS_REST_URL
//   - UPSTASH_REDIS_REST_TOKEN

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'bioxa_goutte_lb_v1';          // classement tous les temps (JSON)
const BOARD_MAX = 20;                      // places AFFICHÉES dans le jeu
// Places CONSERVÉES en base. Bien plus que ce qui est affiché : sortir du top 20
// ne doit plus effacer un score, sinon un joueur disparaît définitivement le jour
// où vingt personnes font mieux que lui.
const STORE_MAX = 200;
// Clés des anciens classements hebdomadaires, à réintégrer une seule fois (voir
// mergeLegacyWeeks plus bas).
const WEEK_PREFIX = 'bioxa_goutte_lb_week_';
const MERGED_FLAG = 'bioxa_goutte_lb_week_merged_v1';

// Repères affichés à côté de certains pseudos, attribués à la main.
// Ils s'appliquent aussi aux scores enregistrés AVANT la question
// « Patient(e) ou Bioxa ? », et ont priorité sur le choix fait dans le jeu.
// Pour changer une pastille : une ligne à ajouter, modifier ou retirer ici.
// (Les pseudos sont comparés en majuscules, sans accent ni ponctuation.)
const ROLE_BY_NAME = {
  MARGOT: 'B',
  LOLO: 'B',
  WOLPHAI: 'P',
  DOFLAMIN: 'P',
  LPB: '🎤',
};
const TOTAL_KEY = 'bioxa_goutte_total_v1'; // total de gouttes collectées, tous joueurs

// Gouttes déjà attrapées avant la mise en place du compteur partagé.
// Ajoutées comme point de départ (309 + 71 + 44 + 37 = 461).
const SEED_DROPS = 309 + 71 + 44 + 37;

// ---- Filtre de pseudos (affichés en public : on préfère être strict) ----
// Mots interdits cherchés À L'INTÉRIEUR du pseudo (après normalisation).
const BANNED_SUB = [
  'MERDE', 'PUTAIN', 'PUTIN', 'PUTE', 'SALOP', 'CONNAR', 'CONAR', 'ENCUL', 'NIQUE',
  'BITE', 'COUILL', 'BATARD', 'CHIER', 'SUCE', 'PEDE', 'PEDAL', 'TAPETTE',
  'TAFIOL', 'GOUINE', 'NEGRE', 'NEGRO', 'BOUGNOU', 'YOUPIN', 'NAZI', 'HITLER',
  'PENIS', 'VAGIN', 'SEXE', 'PORN', 'XXX',
  'FUCK', 'SHIT', 'BITCH', 'CUNT', 'NIGGER', 'NIGGA',
];
// Mots interdits seulement s'ils constituent TOUT le pseudo (trop courts pour
// une recherche interne : "CUL" déclencherait sur "HERCULE").
const BANNED_EXACT = ['CUL', 'ZOB', 'PD', 'FDP', 'NTM', 'PTN', 'TG', 'KKK', 'SS'];

// Déjoue les contournements du type "PUT1N" ou "M3RDE".
function unleet(s) {
  return s
    .replace(/0/g, 'O').replace(/1/g, 'I').replace(/3/g, 'E')
    .replace(/4/g, 'A').replace(/5/g, 'S').replace(/7/g, 'T')
    .replace(/8/g, 'B');
}

// Nettoie le pseudo : majuscules, accents retirés, lettres/chiffres uniquement,
// 8 caractères max. Si le résultat est vide ou grossier → "JOUEUR".
function cleanName(raw) {
  let name = String(raw || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // é → E, etc.
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (!name) return 'JOUEUR';
  const t = unleet(name);
  if (BANNED_EXACT.includes(t)) return 'JOUEUR';
  for (const w of BANNED_SUB) {
    if (t.includes(w)) return 'JOUEUR';
  }
  return name;
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

// Trie par score décroissant, ne garde que le MEILLEUR score de chaque pseudo,
// et coupe aux 20 premières places. Les anciens classements, qui pouvaient
// contenir plusieurs fois le même pseudo, sont donc nettoyés au passage.
function rank(list, max) {
  const limit = max || BOARD_MAX;
  const best = [];
  const seen = new Set();
  for (const e of (list || []).slice().sort((a, b) => b.score - a.score)) {
    const name = String((e && e.name) || '');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    best.push(e);
    if (best.length >= limit) break;
  }
  return best;
}

// Numéro de semaine ISO (ex. "2026_35") : sert uniquement à retrouver les clés
// des anciens classements hebdomadaires, quand la commande KEYS n'est pas
// disponible.
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
function recentWeekKeys(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 7 * 86400000);
    out.push(WEEK_PREFIX + isoWeekId(d));
  }
  return out;
}

// RÉCUPÉRATION DES SCORES DES ANCIENS CLASSEMENTS HEBDOMADAIRES.
// Avant la refonte, chaque partie était écrite dans DEUX listes : « tous les
// temps » (limitée à 10 places) et « cette semaine ». Un score modeste sortait
// donc du top 10 tout en restant visible dans l'onglet Semaine — et en retirant
// cet onglet, ces joueurs ont disparu de l'affichage. Leurs scores sont toujours
// dans la base tant que la clé de leur semaine n'a pas expiré : on les remet
// dans le classement principal, une seule fois (MERGED_FLAG).
async function mergeLegacyWeeks() {
  if (await redis(['GET', MERGED_FLAG])) return;
  let keys;
  try {
    keys = await redis(['KEYS', WEEK_PREFIX + '*']);   // toutes les semaines encore là
  } catch (e) {
    keys = null;
  }
  if (!Array.isArray(keys) || !keys.length) keys = recentWeekKeys(8); // repli
  const extra = [];
  for (const k of keys) {
    if (k === MERGED_FLAG) continue;
    try {
      const raw = await redis(['GET', k]);
      if (raw) extra.push.apply(extra, JSON.parse(raw));
    } catch (e) { /* une clé illisible ne doit pas bloquer les autres */ }
  }
  const raw = await redis(['GET', KEY]);
  const merged = rank((raw ? JSON.parse(raw) : []).concat(extra), STORE_MAX);
  await redis(['SET', KEY, JSON.stringify(merged)]);
  await redis(['SET', MERGED_FLAG, String(extra.length)]);
}

// Applique ROLE_BY_NAME juste avant l'envoi : ce qui est stocké dans la base
// reste le choix réel du joueur, seul l'affichage est corrigé.
function withRoles(list) {
  return (list || []).map((e) => {
    const fix = ROLE_BY_NAME[String((e && e.name) || '')];
    return fix ? Object.assign({}, e, { r: fix }) : e;
  });
}

// Ajoute une entrée au classement et renvoie la liste conservée.
async function pushBoard(key, entry) {
  const raw = await redis(['GET', key]);
  const list = rank((raw ? JSON.parse(raw) : []).concat([entry]), STORE_MAX);
  await redis(['SET', key, JSON.stringify(list)]);
  return list;
}

module.exports = async (req, res) => {
  // Si les clés Upstash ne sont pas configurées, on renvoie un état vide
  // au lieu de planter (le jeu reste jouable).
  if (!REST_URL || !REST_TOKEN) {
    res.status(200).json({ board: [], total: 0 });
    return;
  }

  try {
    // Réintégration des anciens classements hebdomadaires : ne s'exécute qu'une
    // fois, et un échec ne doit jamais empêcher le classement de s'afficher.
    try { await mergeLegacyWeeks(); } catch (e) { /* réessayé au prochain appel */ }

    // GET : lire le classement + le total de sang collecté
    if (req.method === 'GET') {
      const rawList = await redis(['GET', KEY]);
      const rawTotal = await redis(['GET', TOTAL_KEY]);
      res.status(200).json({
        // rank() ici aussi : l'affichage est propre même avant la prochaine écriture
        board: withRoles(rank(rawList ? JSON.parse(rawList) : [], BOARD_MAX)),
        total: SEED_DROPS + (parseInt(rawTotal, 10) || 0),
      });
      return;
    }

    // POST : ajouter un score au classement, incrémenter le total
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      body = body || {};

      const name = cleanName(body.name); // filtre grossièretés + caractères
      let score = parseInt(body.score, 10);
      if (!Number.isFinite(score)) score = 0;
      score = Math.max(0, Math.min(999999, score)); // garde-fou anti-triche basique

      // Le score peut être multiplié par les combos : le sang collecté se compte
      // en GOUTTES réellement attrapées, jamais en points.
      let drops = parseInt(body.drops, 10);
      if (!Number.isFinite(drops)) drops = score; // anciennes versions du jeu
      drops = Math.max(0, Math.min(score, drops));

      // Grade de donneur : un simple entier 0-4, calculé sur l'appareil du joueur.
      let grade = parseInt(body.grade, 10);
      if (!Number.isFinite(grade)) grade = 0;
      grade = Math.max(0, Math.min(4, grade));
      // Repère choisi par le joueur avant la saisie : 'B' (Bioxa) ou 'P' (patient·e).
      // Toute autre valeur est ignorée : le classement n'affiche alors aucune lettre.
      const role = body.role === 'B' || body.role === 'P' ? body.role : '';
      const entry = { name, score, g: grade };
      if (role) entry.r = role;
      const list = await pushBoard(KEY, entry);
      const total = await redis(['INCRBY', TOTAL_KEY, drops]);

      res.status(200).json({
        board: withRoles(list.slice(0, BOARD_MAX)),
        total: SEED_DROPS + (parseInt(total, 10) || 0),
      });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (e) {
    // En cas d'erreur réseau/base, on renvoie un état vide pour ne pas casser le jeu.
    res.status(200).json({ board: [], total: 0 });
  }
};
