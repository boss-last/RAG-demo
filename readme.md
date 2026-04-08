# RAG Demo — Node.js + ChromaDB + Groq

Système de Retrieval-Augmented Generation (RAG) en local.  
Les documents sont indexés dans ChromaDB, puis Groq (Llama 3.3) génère une réponse basée sur les documents pertinents.

---

## Prérequis

- [Node.js](https://nodejs.org) v18 ou supérieur
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installé et démarré
- Un compte [Groq](https://console.groq.com) avec une clé API gratuite

---

## Installation

### 1. Cloner ou télécharger le projet

```bash
cd Desktop
mkdir rag-demo && cd rag-demo
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la clé API

Crée un fichier `.env` à la racine du projet :

GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx

> Récupère ta clé sur [console.groq.com](https://console.groq.com) → API Keys → Create API Key

---

## Lancer le projet

### Étape 1 — Démarrer ChromaDB (Terminal 1)

```bash
docker run -p 8100:8000 chromadb/chroma
```

> Laisse ce terminal ouvert pendant toute la durée d'utilisation.

### Étape 2 — Lancer le script (Terminal 2)

```bash
node index.js
```

---

## Structure du projet
rag-demo/
├── .env              ← Clé API Groq (ne pas committer)
├── .gitignore        ← Exclut .env et node_modules
├── package.json      ← Dépendances du projet
├── index.js          ← Programme principal
└── README.md         ← Ce fichier

---

## Dépendances

| Package | Rôle |
|---|---|
| `chromadb` | Client Node.js pour ChromaDB |
| `@chroma-core/default-embed` | Fonction d'embedding par défaut |
| `groq-sdk` | Client Node.js pour l'API Groq |
| `dotenv` | Charge les variables d'environnement depuis `.env` |

---

## Comment ça fonctionne
Question
│
▼
ChromaDB ──── recherche les 3 documents les plus proches
│
▼
Groq (Llama 3.3) ──── génère une réponse basée sur ces documents
│
▼
Réponse affichée dans le terminal