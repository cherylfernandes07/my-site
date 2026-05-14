import fs from "fs/promises";
import path from "path";

const docsDirectory = path.join(process.cwd(), "public", "assets", "docs");
const supportedExtensions = new Set([".json", ".md", ".mdx", ".txt", ".xml"]);

export async function loadKnowledgeBase(): Promise<string> {
  try {
    const entries = await fs.readdir(docsDirectory, { withFileTypes: true });
    const documentFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(docsDirectory, entry.name))
      .filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()));

    const documents = await Promise.all(
      documentFiles.map(async (filePath) => {
        const contents = await fs.readFile(filePath, "utf-8");
        return `--- ${path.basename(filePath)} ---\n${contents}`;
      })
    );

    return documents.filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}