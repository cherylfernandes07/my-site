import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";

export interface Chunk {
  id: string;
  text: string;
  source: "resume" | "website";
  type: string;
}

export function chunkResume(xmlText: string): Chunk[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) =>
      ["job", "bullet", "skill", "category", "degree", "cert", "area", "item"].includes(name),
  });

  const parsed = parser.parse(xmlText);
  const resume = parsed.resume;
  const chunks: Chunk[] = [];

  // --- Personal + Summary ---
  const p = resume.personal;
  chunks.push({
    id: "personal",
    source: "resume",
    type: "personal",
    text: `Name: ${p.name}. Title: ${p.title}. Location: ${p.location}. Email: ${p.email}. LinkedIn: ${p.linkedin}. Portfolio: ${p.portfolio}.`,
  });

  chunks.push({
    id: "summary",
    source: "resume",
    type: "summary",
    text: `Professional summary: ${resume.summary?.trim()}`,
  });

  // --- Skills — one chunk per category ---
  const categories = resume.skills?.category || [];
  categories.forEach((cat: { "@_name"?: string; skill?: string[] }) => {
    const categoryName = cat["@_name"] ?? "general";
    const skills = (cat.skill || []).join(", ");
    chunks.push({
      id: `skills-${categoryName.toLowerCase().replace(/\s+/g, "-")}`,
      source: "resume",
      type: "skills",
      text: `${categoryName} skills: ${skills}`,
    });
  });

  // --- Experience — one chunk per job ---
  const jobs = resume.experience?.job || [];
  jobs.forEach((job: {
    title?: string;
    company?: string;
    start?: string;
    end?: string;
    location?: string;
    description?: string;
    bullets?: { bullet?: string[] };
  }, i: number) => {
    const bullets = (job.bullets?.bullet || []).join(" ");
    chunks.push({
      id: `job-${i}`,
      source: "resume",
      type: "experience",
      text: `Role: ${job.title ?? ""} at ${job.company ?? ""} (${job.start ?? ""} – ${job.end ?? ""}). Location: ${job.location ?? ""}. ${job.description ?? ""} ${bullets}`,
    });
  });

  // --- Education ---
  const degrees = resume.education?.degree || [];
  const educationText = degrees
    .map((d: { credential?: string; school?: string }) => `${d.credential ?? ""} from ${d.school ?? ""}`)
    .join(". ");
  chunks.push({
    id: "education",
    source: "resume",
    type: "education",
    text: `Education: ${educationText}`,
  });

  // --- Certifications ---
  const certs = resume.certifications?.cert || [];
  const certText = certs
    .map((c: { name?: string; issuer?: string; grade?: string }) => `${c.name ?? ""} by ${c.issuer ?? ""} (${c.grade ?? ""})`)
    .join(". ");
  if (certText) {
    chunks.push({
      id: "certifications",
      source: "resume",
      type: "certifications",
      text: `Certifications: ${certText}`,
    });
  }

  // --- Academic areas ---
  const areas = resume.academic?.area || [];
  chunks.push({
    id: "academic",
    source: "resume",
    type: "academic",
    text: `Academic focus areas: ${areas.join(", ")}`,
  });

  // --- Hackathons & Volunteering ---
  const otherCategories = resume.other?.category || [];
  otherCategories.forEach((cat: { "@_name"?: string; item?: string[] }, i: number) => {
    const items = (cat.item || []).join(" ");
    chunks.push({
      id: `other-${i}`,
      source: "resume",
      type: "other",
      text: `${cat["@_name"] ?? "Other"}: ${items}`,
    });
  });

  return chunks;
}

// --- Website chunker (unchanged) ---
//
export function chunkWebsite(html: string, url: string): Chunk[] {
  const $ = cheerio.load(html);
  const chunks: Chunk[] = [];
  const sourceUrl = url.trim();

  $("nav, footer, script, style, .cookie-banner").remove();

  $("h1, h2, h3").each((i, heading) => {
    const title = $(heading).text().trim();
    let content = "";

    $(heading)
      .nextUntil("h1, h2, h3")
      .each((_, el) => {
        content += $(el).text().trim() + " ";
      });

    if (content.trim().length > 20) {
      chunks.push({
        id: `web-${i}`,
        text: `Source URL: ${sourceUrl}. ${title}: ${content.trim()}`,
        source: "website",
        type: "webpage",
      });
    }
  });

  return chunks;
}