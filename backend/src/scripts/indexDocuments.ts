#!/usr/bin/env tsx
/**
 * Index all RO knowledge documents into the vector store.
 * Run once before starting the server:
 *   npm run index-docs
 * Re-run whenever you update knowledgeBase.ts
 */

import "dotenv/config";
import { knowledgeDocs, chunkDocument } from "../lib/knowledgeBase.js";
import { indexDocuments, clearIndex, isIndexed } from "../lib/vectorStore.js";

async function main() {
  console.log("🚀 AquaCare RAG Knowledge Base Indexer");
  console.log("======================================\n");

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set in .env file");
    console.error("   Get a free key at: https://aistudio.google.com");
    process.exit(1);
  }

  // Check if already indexed
  const alreadyIndexed = await isIndexed();
  if (alreadyIndexed) {
    console.log("⚠️  Knowledge base already indexed.");
    const args = process.argv.slice(2);
    if (!args.includes("--force")) {
      console.log("   Use 'npm run index-docs -- --force' to re-index");
      process.exit(0);
    }
    console.log("   --force flag detected, clearing and re-indexing...\n");
    await clearIndex();
  }

  // Chunk all documents
  const allChunks: { content: string; title: string; source: string; metadata: Record<string, any> }[] = [];
  for (const doc of knowledgeDocs) {
    const chunks = chunkDocument(doc);
    allChunks.push(...chunks);
    console.log(`📄 ${doc.title}: ${chunks.length} chunks`);
  }

  console.log(`\n📊 Total: ${knowledgeDocs.length} documents → ${allChunks.length} chunks\n`);
  console.log("🔗 Generating embeddings with gemini-embedding-001...\n");
  
  await indexDocuments(allChunks);

  console.log("\n✅ Knowledge base ready for RAG queries!");
  console.log("   Start the server: npm run dev\n");
  process.exit(0);
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
