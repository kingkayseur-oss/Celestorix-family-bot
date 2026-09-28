# ♛ CELESTØRIX FAMILY WhatsApp Bot

Bot WhatsApp Node.js + Baileys avec connexion par **pairing code** (pas de QR).

## Fonctions incluses

- `.menu`
- `.rejoit la famille`
- `.clx`
- `.channel`
- `.qg`
- `.ping`
- `.owner`
- `.rules`
- `.groupinfo`
- `.admins`
- et un catalogue de 100+ commandes prêt à être étendu.

### Système « Rejoins la famille »

1. L'utilisateur écrit `.rejoint la famille`.
2. Le bot demande d'ajouter `CLX` au nom WhatsApp.
3. L'utilisateur envoie le lien d'un groupe où il est administrateur.
4. Le bot lit les informations publiques de l'invitation.
5. Il exige au moins 100 membres.
6. Il rejoint temporairement le groupe pour vérifier que l'expéditeur est administrateur.
7. Si les conditions sont validées, il envoie `QG_LINK`.
8. Il quitte ensuite le groupe soumis.

> Remarque : le nom WhatsApp visible par le bot n'est pas une preuve cryptographique de l'ajout de CLX. La vérification CLX est donc une convention. Le statut administrateur et le nombre de membres sont vérifiés côté groupe.

## Variables Render

- `QG_LINK` = lien de ton groupe QG
- `CHANNEL_LINK` = lien de ta chaîne WhatsApp
- `PANEL_KEY` = mot de passe long du panneau
- `OWNER_NUMBER` = ton numéro au format international
- `CLAN_TAG` = CLX
- `MIN_MEMBERS` = 100

## Déploiement

1. Mets ce dossier dans un dépôt GitHub.
2. Sur Render, crée un **Web Service** depuis ce dépôt.
3. Build command : `npm install`
4. Start command : `npm start`
5. Ajoute les variables ci-dessus dans Environment.
6. Ouvre l'URL Render.
7. Entre `PANEL_KEY` + ton numéro.
8. Le site affiche le pairing code.
9. Dans WhatsApp, ouvre Appareils connectés et choisis l'option de connexion avec un numéro.
10. Saisis le code.

Render demande que le serveur écoute sur `0.0.0.0` et sur la variable `PORT`; ce projet le fait déjà.

## Netlify

Le `public/index.html` est une interface statique simple. Pour séparer le frontend sur Netlify, il faudra modifier l'URL de l'API afin qu'elle pointe vers ton service Render.

Pour un premier déploiement, tu peux aussi utiliser directement le panel servi par Render : cela évite la configuration CORS.

## Sécurité

Ne mets jamais `PANEL_KEY`, les identifiants WhatsApp ou le dossier `auth/` dans GitHub.
