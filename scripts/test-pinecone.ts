import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pinecone } from "@pinecone-database/pinecone";

async function test() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const indexes = await pc.listIndexes();
  console.log("✅ Pinecone connected");
  console.log("Indexes:", indexes);
}

test().catch(console.error);