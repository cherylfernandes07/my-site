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
import { upsertSection, markSourceSynced } from '../lib/db';

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

// Default path — adjust to wherever your XML file lives
const DEFAULT_XML_PATH = path.join(process.cwd(), 'data', 'resume.xml');

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
    isArray: (name) => ['job', 'skill', 'project', 'education', 'item'].includes(name),
  });

  const doc = parser.parse(xmlContent);

  // Navigate to the root — adjust this path to match YOUR XML structure
  // Common patterns: doc.resume, doc.cv, doc.root
  const resume = doc.resume ?? doc.cv ?? doc;

  const sections: ResumeSection[] = [];

  // ── Summary / About ──────────────────────────────
  if (resume.summary || resume.about || resume.objective) {
    const content = String(resume.summary ?? resume.about ?? resume.objective ?? '');
    sections.push({
      section_key: 'summary',
      title: 'Professional Summary',
      content,
      keywords: extractKeywords(content),
    });
  }

  // ── Contact ──────────────────────────────────────
  if (resume.contact) {
    const c = resume.contact;
    const content = [
      c.name && `Name: ${c.name}`,
      c.email && `Email: ${c.email}`,
      c.phone && `Phone: ${c.phone}`,
      c.location && `Location: ${c.location}`,
      c.website && `Website: ${c.website}`,
      c.linkedin && `LinkedIn: ${c.linkedin}`,
      c.github && `GitHub: ${c.github}`,
    ].filter(Boolean).join('\n');

    sections.push({
      section_key: 'contact',
      title: 'Contact Information',
      content,
      keywords: extractKeywords(content),
    });
  }

  // ── Work Experience ──────────────────────────────
  const jobs: any[] = resume.experience?.job
    ?? resume.work?.job
    ?? resume.jobs?.job
    ?? [];

  jobs.forEach((job: any, i: number) => {
    const company = job.company ?? job.employer ?? `Company ${i + 1}`;
    const role    = job.title ?? job.role ?? job.position ?? '';
    const dates   = [job.startDate ?? job.start, job.endDate ?? job.end ?? 'Present']
                      .filter(Boolean).join(' – ');
    const desc    = job.description ?? job.summary ?? job.responsibilities ?? '';
    const content = [role && `Role: ${role}`, dates && `Dates: ${dates}`, desc].filter(Boolean).join('\n');

    sections.push({
      section_key: `experience.${company.toLowerCase().replace(/\s+/g, '_')}`,
      title: `${role} at ${company}`,
      content,
      keywords: extractKeywords(`${company} ${role} ${desc}`),
    });
  });

  // ── Skills ───────────────────────────────────────
  const skillsRaw = resume.skills?.skill
    ?? resume.skills?.category
    ?? resume.skills;

  if (skillsRaw) {
    // Handle both flat list and grouped categories
    const isGrouped = Array.isArray(skillsRaw) && typeof skillsRaw[0] === 'object' && skillsRaw[0].name;

    if (isGrouped) {
      skillsRaw.forEach((group: any) => {
        const groupName = group.name ?? group._name ?? 'Skills';
        const items     = Array.isArray(group.item) ? group.item : [group.item ?? group];
        const content   = items.join(', ');
        sections.push({
          section_key: `skills.${groupName.toLowerCase().replace(/\s+/g, '_')}`,
          title: `Skills: ${groupName}`,
          content,
          keywords: extractKeywords(`${groupName} ${content}`),
        });
      });
    } else {
      const content = Array.isArray(skillsRaw) ? skillsRaw.join(', ') : String(skillsRaw);
      sections.push({
        section_key: 'skills.general',
        title: 'Skills',
        content,
        keywords: extractKeywords(content),
      });
    }
  }

  // ── Education ────────────────────────────────────
  const educationItems: any[] = resume.education?.degree
    ?? resume.education?.item
    ?? resume.education?.school
    ?? (Array.isArray(resume.education) ? resume.education : []);

  educationItems.forEach((edu: any, i: number) => {
    const institution = edu.institution ?? edu.school ?? edu.university ?? `School ${i + 1}`;
    const degree      = edu.degree ?? edu.title ?? edu.qualification ?? '';
    const dates       = [edu.startDate ?? edu.start, edu.endDate ?? edu.end ?? edu.year]
                          .filter(Boolean).join(' – ');
    const content     = [degree, institution, dates].filter(Boolean).join('\n');

    sections.push({
      section_key: `education.${institution.toLowerCase().replace(/\s+/g, '_')}`,
      title: `${degree} – ${institution}`,
      content,
      keywords: extractKeywords(`${institution} ${degree}`),
    });
  });

  // ── Projects ─────────────────────────────────────
  const projects: any[] = resume.projects?.project
    ?? resume.portfolio?.project
    ?? [];

  projects.forEach((proj: any) => {
    const name    = proj.name ?? proj.title ?? 'Project';
    const content = [
      proj.description ?? proj.summary ?? '',
      proj.tech && `Tech: ${proj.tech}`,
      proj.url && `URL: ${proj.url}`,
    ].filter(Boolean).join('\n');

    sections.push({
      section_key: `project.${name.toLowerCase().replace(/\s+/g, '_')}`,
      title: `Project: ${name}`,
      content,
      keywords: extractKeywords(`${name} ${content}`),
    });
  });

  // ── Certifications ───────────────────────────────
  const certs: any[] = resume.certifications?.certification
    ?? resume.certificates?.certificate
    ?? [];

  if (certs.length > 0) {
    const content = certs.map((c: any) =>
      [c.name ?? c.title, c.issuer, c.date ?? c.year].filter(Boolean).join(' · ')
    ).join('\n');

    sections.push({
      section_key: 'certifications',
      title: 'Certifications',
      content,
      keywords: extractKeywords(content),
    });
  }

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
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
