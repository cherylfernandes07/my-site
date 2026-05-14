import { Pinecone } from "@pinecone-database/pinecone";

function getIndex() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }
  if (!process.env.PINECONE_INDEX) {
    throw new Error("PINECONE_INDEX is not set");
  }
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return pc.index(process.env.PINECONE_INDEX);
}

export { getIndex };