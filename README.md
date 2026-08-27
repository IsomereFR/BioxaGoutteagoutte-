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

## Le jeu

Rendu **réaliste / cyberpunk** dessiné en vectoriel (aucune image externe, aucune
police téléchargée) : ville néon, grille en perspective, gouttes en verre,
traînées lumineuses et ondes de choc.

**Animation d'ouverture** : au lancement, le logo Bioxa se construit branche par
branche (les vertes balaient vers la gauche, les bleues vers le haut), puis
« Bioxa » apparaît lettre par lettre et « LABORATOIRE » se dévoile. Un toucher
passe l'animation. Le logo est tracé à partir du SVG officiel : il reste net à
toutes les tailles.

Mécaniques de jeu :

- Départ direct au **niveau 3**.
- **Combos** : chaque goutte enchaînée fait monter un compteur qui **multiplie
  vraiment les points** (×2 à 8, ×3 à 16, ×4 à 24, ×5 à 32). Une jauge se vide :
  il faut enchaîner pour ne pas le perdre.
- **Prise parfaite** : attraper une goutte pile au centre du tube rapporte un bonus.
- **Goutte en or** : déclenche 5 s de **pluie de gouttes** (que du sang, sans
  pénalité). Elle apparaît sur environ 5 % des chutes, et une garantie force son
  apparition après 14 s sans en voir — sinon beaucoup de parties se terminaient
  sans que le joueur découvre la mécanique.
- **Paliers** (25, 50, 100, 200, 400 points) et **record personnel** célébrés à l'écran.
- **Goutte cristal** : très rare (environ une partie sur douze, une seule par
  partie). Elle tombe lentement, scintille, et l'attraper vaut **+50 points**
  avec un ralenti et un voile bleuté.
- **16 badges à débloquer** (écran « Mes badges » depuis l'accueil) et un
  **grade de donneur** qui monte avec le total de gouttes collectées :
  Apprenti → Donneur → Donneur régulier → Donneur héroïque → Légende Bioxa.
  Le grade apparaît en pastille colorée à côté du pseudo dans le classement.
- **Défi du jour** : une règle spéciale, **la même pour tous**, qui change chaque
  jour (tube fin, chute libre, une seule vie, invasion, ruée vers l'or, précision,
  marathon). Il a son **propre classement**, remis à zéro chaque jour. Les scores du
  défi ne se mélangent pas aux autres classements — les règles étant différentes,
  la comparaison serait faussée. Le jour est calculé en temps universel côté jeu et
  côté serveur, pour que tout le monde ait le même défi au même moment.

> Le score peut être multiplié par les combos, mais le **sang collecté se compte
> en gouttes réellement attrapées** — le compteur collectif reste donc exact.

**Fin de partie** : le jeu demande d'abord si le joueur est **Patient(e)** ou
**Bioxa**. Ce choix ajoute un **P** ou un **B** en pastille à côté de son pseudo dans
le classement (il est mémorisé sur l'appareil et simplement remis en avant la fois
suivante, jamais imposé). Vient ensuite la saisie du pseudo : le champ est **vide**,
rien n'est pré-inscrit, et la validation demande au moins un caractère.

Après avoir validé son pseudo, le joueur voit une **poche de
don (450 mL) se remplir** à l'écran jusqu'au niveau atteint collectivement, puis
sa contribution personnelle en mL. Si la poche se complète, elle est célébrée
avant qu'une nouvelle commence.

Un encart **« Le saviez-vous ? »** y affiche une information sur le don du sang,
différente à chaque partie. Ces repères viennent de la communication publique sur
le don ; ils sont regroupés dans la liste `FACTS` de `index.html` — **à faire
valider par votre service communication** avant diffusion, et faciles à modifier.

L'**écran d'accueil affiche le podium** : le **Top 3** de la semaine (ou de tous
les temps tant que la semaine est vide), avec la pastille P/B de chaque joueur.
Toucher l'encart ouvre le classement complet.

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

## Confidentialité (RGPD)

Le jeu enregistre uniquement un **pseudo** (saisi par le joueur, sans son vrai nom),
la lettre **P** (patient·e) ou **B** (Bioxa) choisie avant la saisie, un **score** et
la **semaine** de jeu, pour faire fonctionner le classement partagé.
Il n'y a **aucun cookie publicitaire**, aucun traceur, aucune donnée de santé.
La **progression** (record, badges, grade, total de gouttes) est gardée dans le
navigateur du joueur (stockage local) et n'est jamais envoyée au serveur — à une
exception près : le numéro du grade (0 à 4) accompagne le score pour être affiché
dans le classement.

- Une page **« Infos & confidentialité »** est accessible depuis l'accueil du jeu.
- Le classement de la semaine est **effacé automatiquement** chaque semaine.
- Base de classement (**Upstash**) à choisir en **région Union européenne** ;
  fonction Vercel exécutée en France (voir `vercel.json`, région `cdg1`).
- Contact DPO affiché dans le jeu : **dpo@bioxa.fr**.
- Les pseudos sont **filtrés côté serveur** (grossièretés remplacées par
  « JOUEUR », caractères limités aux lettres et chiffres).

## Tester en local (facultatif)

Avec l'outil Vercel installé (`npm i -g vercel`) :

```bash
vercel dev
```

Le jeu sera disponible sur `http://localhost:3000`.
