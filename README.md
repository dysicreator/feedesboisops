# Herboristerie La Fée des Bois – Suivi Opérationnel

Application web pour le suivi des indicateurs de performance, récoltes, ingrédients, travailleurs, conditionnements, intrants agricoles, recettes, fabrication et transformation pour Herboristerie La Fée des Bois.

## Démarrage (Développement Local)

Cette application est conçue pour être servie par un serveur de fichiers statiques. Elle n'a pas de dépendances `npm` à installer pour la production car elle utilise un `importmap` pour charger les modules directement dans le navigateur.

1.  Pour un développement facile, installez les dépendances de développement (comme `vite` pour un rechargement à chaud).
    ```bash
    npm install
    ```
2.  Démarrez le serveur de développement.
    ```bash
    npm run dev
    ```
3.  Ouvrez votre navigateur à l'adresse fournie (généralement `http://localhost:5173` ou similaire).

## Déploiement

Pour déployer, servez simplement les fichiers statiques ( `index.html`, `index.tsx`, etc.) à partir de la racine du projet.

## Configuration Firebase

Le projet est pré-configuré pour se connecter à un projet Firebase. Pour que tout fonctionne, vous devez configurer les éléments suivants dans votre console Firebase.

### 1. Règles de Sécurité Firestore

Allez dans votre projet Firebase, puis **Firestore Database** -> **Règles** et collez les règles suivantes :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
Cliquez sur **Publier**.

### 2. Domaines Autorisés pour l'Authentification

Pour permettre la connexion depuis votre environnement local et de production, allez dans **Authentication** -> **Settings** -> **Authorized domains** et ajoutez les domaines suivants à la liste :

- `localhost`
- `herboristerie-la-fee-des-bois.firebaseapp.com`
- `herboristerie-la-fee-des-bois.web.app`
- `127.0.0.1`
- `localhost:5173` (ou tout autre port que votre serveur de développement local utilise)
