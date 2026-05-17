// scripts/seed-xml.ts
// One-time (and re-runnable) seed script for your XML resume.
// Safe to run multiple times — uses upsert so no duplicates.
//
// Usage:
//   npx tsx scripts/seed-xml.ts
//   npx tsx scripts/seed-xml.ts --file path/to/resume.xml
//
// Requires DATABASE_URL in your .env.local (or Vercel env vars).

import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { sql, upsertSection, markSourceSynced } from '../lib/db';


// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

// Default path — adjust to wherever your XML file lives
const DEFAULT_XML_PATH = path.join(process.cwd(), 'public', 'assets', 'docs', 'resume_template.xml');

const SOURCE_SLUG = 'xml';


// ─────────────────────────────────────────
// XML → section chunks
//
// CUSTOMIZE THIS for your actual XML structure.
// The examples below assume a common resume XML shape.
// Each chunk becomes one row in content_sections.
// ─────────────────────────────────────────

interface ResumeSection {
  section_key: string;
  title: string;
  content: string;
  keywords: string[];
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction: lowercase words over 3 chars, deduped
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
  )].slice(0, 50); // cap at 50 keywords per section
}

function parseResumeXml(xmlContent: string): ResumeSection[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    isArray: (name) => ['job', 'skill', 'category', 'degree', 'cert', 'project', 'item', 'bullet', 'area'].includes(name),
  });

  const doc = parser.parse(xmlContent);
  const resume = doc.resume ?? doc.cv ?? doc;
  const sections: ResumeSection[] = [];

  // ── Personal / Contact ───────────────────────────
  if (resume.personal) {
    const p = resume.personal;
    const content = [
      p.name        && `Name: ${p.name}`,
      p.title       && `Title: ${p.title}`,
      p.email       && `Email: ${p.email}`,
      p.phone       && `Phone: ${p.phone}`,
      p.location    && `Location: ${p.location}`,
      p.linkedin    && `LinkedIn: ${p.linkedin}`,
      p.website     && `Website: ${p.website}`,
      p.portfolio   && `Portfolio: ${p.portfolio}`,
    ].filter(Boolean).join('\n');

    sections.push({
      section_key: 'contact',
      title: 'Contact Information',
      content,
      keywords: extractKeywords(content),
    });
  }

  // ── Summary ──────────────────────────────────────
  if (resume.summary) {
    const content = String(resume.summary).trim();
    sections.push({
      section_key: 'summary',
      title: 'Professional Summary',
      content,
      keywords: extractKeywords(content),
    });
  }

  // ── Skills (grouped categories) ──────────────────
  // XML: <skills><category name="Technical"><skill>...</skill></category></skills>
  const categories: any[] = resume.skills?.category ?? [];
  categories.forEach((cat: any) => {
    const groupName = cat._name ?? cat.name ?? 'General';
    const rawSkills: any[] = cat.skill ?? [];
    const skills = rawSkills.map((s: any) =>
      typeof s === 'string' ? s : s['#text'] ?? s._ ?? JSON.stringify(s)
    );
    const content = skills.join(', ');
    sections.push({
      section_key: `skills.${groupName.toLowerCase().replace(/[\s&]+/g, '_')}`,
      title: `Skills: ${groupName}`,
      content,
      keywords: extractKeywords(`${groupName} ${content}`),
    });
  });

  // ── Work Experience ──────────────────────────────
  // XML: <experience><job><company>...</company><bullets><bullet>...</bullet></bullets></job></experience>
  const jobs: any[] = resume.experience?.job ?? [];
  jobs.forEach((job: any, i: number) => {
    const company = job.company ?? `Company ${i + 1}`;
    const role    = job.title ?? job.role ?? '';
    const start   = job.start ?? '';
    const end     = job.end   ?? 'Present';
    const dates   = [start, end].filter(Boolean).join(' – ');
    const desc    = job.description ?? '';
    const bullets: string[] = job.bullets?.bullet ?? [];
    const content = [
      role     && `Role: ${role}`,
      dates    && `Dates: ${dates}`,
      desc     && `Summary: ${desc}`,
      bullets.length && `Highlights:\n${bullets.map(b => `- ${b}`).join('\n')}`,
    ].filter(Boolean).join('\n');

    sections.push({
      section_key: `experience.${company.toLowerCase().replace(/[\s,.()/]+/g, '_').replace(/_+/g, '_')}`,
      title: `${role} at ${company}`,
      content,
      keywords: extractKeywords(`${company} ${role} ${desc} ${bullets.join(' ')}`),
    });
  });

  // ── Education ────────────────────────────────────
  // XML: <education><degree><school>...</school><credential>...</credential></degree></education>
  const degrees: any[] = resume.education?.degree ?? [];
  degrees.forEach((edu: any) => {
    const school     = edu.school ?? edu.institution ?? 'Unknown School';
    const credential = edu.credential ?? edu.degree ?? '';
    const content    = [credential, school].filter(Boolean).join('\n');
    sections.push({
      section_key: `education.${school.toLowerCase().replace(/[\s,]+/g, '_')}`,
      title: `${credential} – ${school}`,
      content,
      keywords: extractKeywords(`${school} ${credential}`),
    });
  });

  // ── Certifications ───────────────────────────────
  // XML: <certifications><cert><name>...</name><issuer>...</issuer><grade>...</grade></cert></certifications>
  const certs: any[] = resume.certifications?.cert ?? [];
  if (certs.length > 0) {
    const content = certs.map((c: any) =>
      [c.name, c.issuer && `Issuer: ${c.issuer}`, c.grade && `Grade: ${c.grade}`]
        .filter(Boolean).join(' · ')
    ).join('\n');
    sections.push({
      section_key: 'certifications',
      title: 'Certifications',
      content,
      keywords: extractKeywords(content),
    });
  }

  // ── Academic Work ────────────────────────────────
  // XML: <academic><area>...</area></academic>
  const areas: string[] = resume.academic?.area ?? [];
  if (areas.length > 0) {
    const content = areas.join(', ');
    sections.push({
      section_key: 'academic',
      title: 'Academic Work & Research Areas',
      content,
      keywords: extractKeywords(content),
    });
  }

  // ── Other (Hackathons & Volunteering) ────────────
  // XML: <other><category name="..."><item>...</item></category></other>
  const otherCats: any[] = resume.other?.category ?? [];
  otherCats.forEach((cat: any) => {
    const groupName = cat._name ?? cat.name ?? 'Other';
    const items: string[] = cat.item ?? [];
    const content = items.join('\n');
    sections.push({
      section_key: `other.${groupName.toLowerCase().replace(/[\s&]+/g, '_')}`,
      title: groupName,
      content,
      keywords: extractKeywords(`${groupName} ${content}`),
    });
  });

  return sections;
}


// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────

async function main() {
  const xmlPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_XML_PATH;

  if (!fs.existsSync(xmlPath)) {
    console.error(`❌  XML file not found: ${xmlPath}`);
    console.error(`    Pass a path: npx tsx scripts/seed-xml.ts path/to/resume.xml`);
    process.exit(1);
  }

  console.log(`📄  Reading ${xmlPath}`);
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');

  console.log('🔍  Parsing XML...');
  let sections: ResumeSection[];
  try {
    sections = parseResumeXml(xmlContent);
  } catch (err) {
    console.error('❌  Failed to parse XML:', err);
    process.exit(1);
  }

  if (sections.length === 0) {
    console.warn('⚠️   No sections extracted. Check your XML structure and the parseResumeXml function.');
    process.exit(1);
  }

  console.log(`✅  Extracted ${sections.length} sections:`);
  sections.forEach(s => console.log(`    • ${s.section_key} (${s.keywords.length} keywords)`));

  console.log('\n⬆️   Upserting into Neon...');
  let inserted = 0;
  for (const section of sections) {
    try {
      await upsertSection(
        SOURCE_SLUG,
        section.section_key,
        section.title,
        section.content,
        section.keywords
      );
      inserted++;
    } catch (err) {
      console.error(`    ❌ Failed to upsert ${section.section_key}:`, err);
    }
  }

  await markSourceSynced(SOURCE_SLUG);

  console.log(`\n🎉  Done — ${inserted}/${sections.length} sections upserted.`);
  console.log(`    Source '${SOURCE_SLUG}' marked as synced.`);

  // Clear stale cache entries for this source so users always get fresh answers
  console.log('\n🗑️   Clearing stale cache entries for source: xml...');
  try {
    await sql`
      DELETE FROM query_cache
      WHERE sources_used @> ARRAY['xml']::TEXT[]
    `;
    console.log('    Cache cleared. ✓');
  } catch (err) {
    console.warn('    ⚠️  Cache clear failed (non-fatal):', err);
  }

}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});