import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { chunkResume, chunkWebsite, Chunk } from "../lib/chunker";
import { embedDocument } from "../lib/embeddings";
import { getIndex } from "../lib/pinecone";

dotenv.config({ path: ".env.local" });

const WEBSITE_URL = process.env.WEBSITE_URL || "https://your-site.vercel.app";
const RESUME_XML_PATH = process.env.RESUME_XML_PATH || "public/assets/docs/resume_template.xml";

async function ingest() {
  const chunks: Chunk[] = [];

  // 1. Parse resume XML
  console.log("📄 Parsing resume...");
  const xmlPath = path.resolve(process.cwd(), RESUME_XML_PATH);
  const xml = fs.readFileSync(xmlPath, "utf-8");
  chunks.push(...chunkResume(xml));

  // 2. Scrape website
  console.log("🌐 Scraping website...");
  const res = await fetch(WEBSITE_URL);
  const html = await res.text();
  chunks.push(...chunkWebsite(html, WEBSITE_URL));

  console.log(`✅ ${chunks.length} chunks ready`);

  // 3. Embed each chunk and upsert to Pinecone
  console.log("🔢 Embedding and uploading to Pinecone...");

  for (const chunk of chunks) {
    const vector = await embedDocument(chunk.text);

    await getIndex().upsert({
      records: [
      {
        id: chunk.id,
        values: vector,
        metadata: {
          text: chunk.text,
          source: chunk.source,
          type: chunk.type,
        },
      },
    ]
  });

    console.log(`  ✓ ${chunk.id}`);
  }

  console.log("🎉 Ingest complete!");
}

ingest().catch(console.error);