// app/api/sections/route.ts
// Serves all content_sections to the client for Fuse.js search.
// Called once on chat mount — results are cached in React state.

import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const rows = await sql`
    SELECT
      cs.id,
      s.slug  AS source_slug,
      cs.section_key,
      cs.title,
      cs.content,
      cs.keywords
    FROM content_sections cs
    JOIN sources s ON s.id = cs.source_id
    ORDER BY cs.section_key
  `;

  return Response.json(
    { sections: rows },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}