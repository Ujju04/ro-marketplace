import { db, knowledgeChunksTable } from "./db.js";
import { embedText, cosineSimilarity } from "./gemini.js";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import "dotenv/config";

// ── Index all knowledge documents into the vector store ───────────────────────
export async function indexDocuments(docs: { content: string; title: string; source: string; metadata: Record<string, any> }[]): Promise<void> {
  console.log(`📚 Indexing ${docs.length} document chunks...`);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    try {
      // Generate embedding via Gemini text-embedding-004
      const embedding = await embedText(doc.content);

      // @ts-ignore drizzle 0.36 insert type
      await db.insert(knowledgeChunksTable).values({
        content: doc.content,
        embedding: JSON.stringify(embedding),
        source: doc.source,
        title: doc.title,
        metadata: doc.metadata,
      });

      console.log(`  ✅ [${i + 1}/${docs.length}] ${doc.title} (${doc.source})`);

      // Rate limit: Gemini free tier allows 1500 RPD, add small delay
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ❌ Failed to index chunk ${i + 1}:`, err);
    }
  }
  console.log("✅ Indexing complete!");
}

// ── Similarity search — retrieve top-K relevant chunks ────────────────────────
export async function retrieveRelevantChunks(query: string, topK = 4): Promise<{ content: string; title: string; source: string; score: number }[]> {
  try {
    // Get all stored chunks (for cosine similarity in JS)
    // In production with pgvector extension you would do:
    //   SELECT *, embedding <=> $1 AS distance FROM knowledge_chunks ORDER BY distance LIMIT $2
    // Here we do it in application layer to avoid pgvector extension requirement
    const allChunks = await db.select({
      id: knowledgeChunksTable.id,
      content: knowledgeChunksTable.content,
      title: knowledgeChunksTable.title,
      source: knowledgeChunksTable.source,
      embedding: knowledgeChunksTable.embedding,
    }).from(knowledgeChunksTable);

    if (allChunks.length === 0) return [];

    // Embed the query
    const queryEmbedding = await embedText(query);

    // Compute cosine similarity for each chunk
    const scored = allChunks.map(chunk => {
      const chunkEmbedding: number[] = JSON.parse(chunk.embedding);
      const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
      return {
        content: chunk.content,
        title: chunk.title || "",
        source: chunk.source,
        score,
      };
    });

    // Sort by similarity and return top-K
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(c => c.score > 0.5); // only return relevant chunks

  } catch (err) {
    console.error("Vector search error:", err);
    return [];
  }
}

// ── Check if knowledge base is indexed ───────────────────────────────────────
export async function isIndexed(): Promise<boolean> {
  try {
    const result = await db.select({ id: knowledgeChunksTable.id })
      .from(knowledgeChunksTable)
      .limit(1);
    return result.length > 0;
  } catch { return false; }
}

// ── Clear all indexed documents (for re-indexing) ─────────────────────────────
export async function clearIndex(): Promise<void> {
  await db.delete(knowledgeChunksTable);
  console.log("🗑️  Vector store cleared");
}
