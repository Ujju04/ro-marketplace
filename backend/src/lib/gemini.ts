import "dotenv/config";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY not set — chatbot will fall back to rule-based mode");
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

let _cachedModel: string | null = null;

export async function resolveBestModel(): Promise<string> {
  if (_cachedModel) return _cachedModel;
  _cachedModel = "gemini-2.5-flash";
  return _cachedModel;
}

export function getChatModel(modelName?: string) {
  if (!genAI) throw new Error("GEMINI_API_KEY not configured");
  return genAI.getGenerativeModel({
    model: modelName || "gemini-2.5-flash",
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 1024 },
  });
}

export async function embedText(text: string): Promise<number[]> {
  if (!genAI) throw new Error("GEMINI_API_KEY not configured");
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

export const geminiAvailable = !!process.env.GEMINI_API_KEY;