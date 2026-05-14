import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { embedDocument, embedQuery } from "../lib/embeddings";

async function test() {
  console.log("Testing embedDocument...");
  const docVector = await embedDocument("I am a software engineer with 5 years experience.");
  console.log("✅ Document embedding works");
  console.log(`   Vector length: ${docVector.length}`);  // should be 768
  console.log(`   First 3 values: ${docVector.slice(0, 3)}`);

  console.log("\nTesting embedQuery...");
  const queryVector = await embedQuery("What is your experience?");
  console.log("✅ Query embedding works");
  console.log(`   Vector length: ${queryVector.length}`);  // should be 768
}

test().catch(console.error);