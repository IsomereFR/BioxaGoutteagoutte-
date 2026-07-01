# 🩸 Goutte à Goutte — Bioxa

Petit jeu web (attrape les gouttes, évite les virus) avec un **classement partagé
entre tous les joueurs**.

- Le jeu : `index.html`
- Le classement (côté serveur) : `api/leaderboard.js`
- La base de données du classement : **Upstash Redis** (gratuit)
- L'hébergement : **Vercel** (gratuit)

---

## Comment ça marche (en deux mots)

1. Le navigateur affiche `index.html` (le jeu).
2. Quand un joueur termine une partie, le jeu appelle l'adresse `/api/leaderboard`.
3. Ce petit programme (`api/leaderboard.js`) enregistre le score dans Upstash
   et renvoie le **top 10** commun à tout le monde, ainsi que le **total de sang
   collecté** par l'ensemble des joueurs.

Le classement est **consultable à tout moment** depuis le menu (bouton
« VOIR LE CLASSEMENT »), avec deux onglets : **Cette semaine** et **Tous les
temps** (le classement de la semaine se réinitialise tout seul chaque semaine).

L'écran du classement affiche aussi le sang total collecté par tous les joueurs
(**1 goutte = 1 point = 50 µL**), converti en litres et en **poches de sang**
(1 poche = 450 mL), avec une jauge de progression vers la poche suivante. Le
total apparaît également sur l'écran d'accueil.

---

## 📋 Mise en ligne, pas à pas (aucune compétence technique requise)

Vous aurez besoin de **3 comptes gratuits** : GitHub, Upstash et Vercel.
Suivez les étapes dans l'ordre. Voir le détail « où cliquer » dans la réponse
qui accompagne ce projet, ou ci-dessous en version courte.

### 1) Upstash (la base du classement)

1. Allez sur **https://console.upstash.com** → **Sign Up** (créez un compte gratuit).
2. Cliquez **Create Database**.
3. Donnez un nom (ex. `goutte`), choisissez une région proche, laissez le reste
   par défaut, puis **Create**.
4. Dans la page de la base, section **REST API**, copiez ces deux valeurs :
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   Gardez-les sous la main pour l'étape Vercel.

### 2) Vercel (la mise en ligne)

1. Allez sur **https://vercel.com** → **Sign Up** → **Continue with GitHub**.
2. Cliquez **Add New… → Project**, puis importez ce dépôt GitHub.
3. **Avant de cliquer Deploy**, ouvrez **Environment Variables** et ajoutez les
   deux valeurs copiées chez Upstash :
   - Nom : `UPSTASH_REDIS_REST_URL`  → Valeur : (l'URL copiée)
   - Nom : `UPSTASH_REDIS_REST_TOKEN` → Valeur : (le token copié)
4. Cliquez **Deploy**. Au bout d'une minute, Vercel vous donne une adresse
   publique du type `https://votre-projet.vercel.app`. C'est l'adresse à partager.

> Si vous oubliez les variables d'environnement, le jeu fonctionne quand même
> mais le classement reste vide. Ajoutez-les puis **Redeploy**.

---

## Tester en local (facultatif)

Avec l'outil Vercel installé (`npm i -g vercel`) :

```bash
vercel dev
```

Le jeu sera disponible sur `http://localhost:3000`.
