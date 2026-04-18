require('dotenv/config');
const { ChromaClient } = require('chromadb');
const { DefaultEmbeddingFunction } = require('@chroma-core/default-embed');
const Groq = require('groq-sdk');

// ─── Connexion ───────────────────────────────────────────
const client = new ChromaClient({ host: 'localhost', port: 8100 });
const groq = new Groq();
const embedder = new DefaultEmbeddingFunction();

async function main() {
  // ─── Créer la collection ─────────────────────────────────
  const collection = await client.getOrCreateCollection({
    name: 'documentation',
    embeddingFunction: embedder,
    metadata: { 'hnsw:space': 'cosine' }
  });

  // ─── Documents à indexer ─────────────────────────────────
  const documents = [
    'Grails est un framework web open source basé sur Groovy et Spring Boot. Il suit le paradigme Convention over Configuration, ce qui réduit la quantité de code à écrire.',
  'Les contrôleurs Grails étendent la classe BaseController. Ils utilisent sendSuccess() pour renvoyer une réponse JSON réussie et sendError() pour renvoyer une erreur.',
  'Dans Grails, les actions d\'un contrôleur sont des méthodes Groovy simples. Elles peuvent recevoir des paramètres via params.id ou via la liaison automatique de commandes (command objects).',
  'Les services Grails sont des classes annotées avec @Service ou placées dans grails-app/services. Ils sont injectés automatiquement par Spring dans les contrôleurs via leur nom en camelCase.',
  'GORM est l\'ORM de Grails. Il permet de définir des entités avec des contraintes (constraints), des relations (hasMany, belongsTo, hasOne) et des requêtes dynamiques comme User.findByEmail().',
  'Les vues Grails utilisent GSP (Groovy Server Pages), similaires aux JSP. Elles peuvent utiliser des tags comme <g:if>, <g:each> et <g:link> pour générer du HTML dynamique.',
  'La configuration de Grails se fait dans application.yml ou application.groovy. On y définit la source de données, les environnements (development, test, production) et les plugins.',
  'Les plugins Grails s\'installent via build.gradle. Les plus courants sont Spring Security pour l\'authentification, Asset Pipeline pour les ressources statiques, et Mail pour l\'envoi d\'emails.',
  'Les intercepteurs Grails (Interceptors) remplacent les filtres. Ils permettent d\'exécuter du code avant (before) ou après (after) une action de contrôleur, par exemple pour vérifier l\'authentification.',
  'Les tests dans Grails utilisent Spock Framework. Un test de contrôleur étend GrailsUnitTest et un test d\'intégration étend GrailsIntegrationTest. Les specs Spock s\'écrivent avec given/when/then.'
  ];

  const ids = documents.map((_, i) => `doc_${i}`);
  const metadatas = documents.map((_, i) => ({
    source: 'cours_bootcamp',
    index: i
  }));

  await collection.add({ ids, documents, metadatas });
  console.log(`✅ ${documents.length} documents indexés.`);

  // ─── Fonction RAG Avancée ─────────────────────────────────
  async function askRAG(question) {
    console.log(`\n🔍 Question originale : "${question}"`);

    // 1. Multi-query generation
    console.log(`⏳ Génération de requêtes alternatives...`);
    const multiQueryPrompt = `Tu es un assistant IA. Ta tâche est de générer 3 formulations différentes pour la question suivante afin d'améliorer la recherche dans une base de données vectorielle. 
Ne réponds qu'avec les 3 questions, séparées par de simples retours à la ligne, sans puces ni texte introductif.
Question originale: ${question}`;

    const mqResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      messages: [{ role: 'user', content: multiQueryPrompt }]
    });

    const variations = mqResponse.choices[0].message.content.split('\n').filter(q => q.trim().length > 0);
    const searchQueries = [question, ...variations];
    console.log(`✅ Requêtes utilisées pour la recherche :`);
    searchQueries.forEach(q => console.log(`   - ${q}`));

    // 2. Recherche ChromaDB & Déduplication
    console.log(`⏳ Recherche dans ChromaDB...`);
    const results = await collection.query({
      queryTexts: searchQueries,
      nResults: 2 // On prend les 2 meilleurs pour CHAQUE variante
    });

    const uniqueDocsMap = new Map();
    for (let i = 0; i < searchQueries.length; i++) {
        const queryDocs = results.documents[i];
        const queryIds = results.ids[i];
        for (let j = 0; j < queryDocs.length; j++) {
            if (!uniqueDocsMap.has(queryIds[j])) {
                uniqueDocsMap.set(queryIds[j], queryDocs[j]);
            }
        }
    }
    
    const retrievedDocs = Array.from(uniqueDocsMap.values());
    console.log(`✅ ${retrievedDocs.length} documents uniques récupérés après déduplication.`);

    // 3. Contextual Compression
    console.log(`⏳ Compression du contexte...`);
    const compressedDocs = [];
    for (let i = 0; i < retrievedDocs.length; i++) {
      const doc = retrievedDocs[i];
      const compressPrompt = `Voici un document :
"${doc}"

Ta tâche : Extraire de ce document UNIQUEMENT les informations pertinentes pour répondre à la question suivante : "${question}".
Si le document ne contient aucune information pertinente, réponds exactement par "NON_PERTINENT". Ne rajoute aucun autre texte.`;

      const compressResponse = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        messages: [{ role: 'user', content: compressPrompt }]
      });

      const extracted = compressResponse.choices[0].message.content.trim();
      if (!extracted.includes("NON_PERTINENT")) {
         compressedDocs.push(extracted);
      }
    }

    console.log(`✅ Contexte compressé (${compressedDocs.length} blocs d'informations pertinents retenus).`);

    if (compressedDocs.length === 0) {
       return "Désolé, je n'ai trouvé aucune information pertinente dans la base de connaissances pour répondre à cette question.";
    }

    const context = compressedDocs
      .map((doc, i) => `[Info ${i + 1}] ${doc}`)
      .join('\n\n');

    // 4. Génération de la réponse (avec Self-RAG basique / vérification)
    console.log(`⏳ Génération de la réponse finale...`);
    const finalPrompt = `Tu es un expert technique. Voici des informations extraites de notre documentation de référence par un système RAG :

${context}

Question de l'utilisateur : ${question}

Réponds avec précision en te basant UNIQUEMENT sur les segments ci-dessus. Si la réponse ne s'y trouve pas totalement, dis-le clairement, n'invente rien.`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'user', content: finalPrompt }]
    });

    return response.choices[0].message.content;
  }

  // ─── Test ──────────────────────────────────────────────────
  const answer = await askRAG('Comment fonctionne les domaines Grails ?');
  console.log('\n🤖 Réponse :\n', answer);
}

main();