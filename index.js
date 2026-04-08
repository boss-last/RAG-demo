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

  // ─── Fonction RAG ─────────────────────────────────────────
  async function askRAG(question) {
    const results = await collection.query({
      queryTexts: [question],
      nResults: 3
    });

    const relevantDocs = results.documents[0];

    const context = relevantDocs
      .map((doc, i) => `[Document ${i + 1}] ${doc}`)
      .join('\n\n');

    const prompt = `Voici des documents de référence :

${context}

Question : ${question}

Réponds en te basant uniquement sur les documents ci-dessus.`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content;
  }

  // ─── Test ──────────────────────────────────────────────────
  const answer = await askRAG('Comment fonctionne les domaines Grails ?');
  console.log('\n🤖 Réponse :\n', answer);
}

main();