import { GoogleGenAI } from "@google/genai";

function getClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables");
  }

  return new GoogleGenAI({ apiKey });
}

// Used in ingest.ts - for chunks being stored
export async function embedDocument(text: string): Promise<number[]> {
  const result = await getClient().models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768
    },
  });
  return result.embeddings![0].values!;
}

// Used in route.ts - for the user's question at query time
export async function embedQuery(text: string): Promise<number[]> {
  const result = await getClient().models.embedContent({
    model: "gemini-embedding-001",
    contents: [{ parts: [{ text }] }],
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    },
  });
  return result.embeddings![0].values!;
}