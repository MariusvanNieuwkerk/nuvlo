// Eenmalig seed-script: leest data/stories.json + data/characters.json + data/image-usage.json
// en print INSERT-SQL die we via de Supabase MCP execute_sql kunnen uitvoeren. Niet onderdeel
// van de runtime app — alleen gebruikt tijdens de migratie van lokale files naar Supabase.
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const stories = JSON.parse(await fs.readFile(path.join(dataDir, "stories.json"), "utf-8")) as {
    children: { id: string; name: string; age: number }[];
    stories: Record<string, unknown>[];
  };

  const lines: string[] = [];
  // children
  for (const c of stories.children) {
    lines.push(
      `insert into children (id, name, age) values ('${c.id}', '${c.name.replace(/'/g, "''")}', ${c.age}) on conflict (id) do nothing;`,
    );
  }

  // image_usage (één record met datum + count)
  let usage: Record<string, { date: string; count: number }> = {};
  try {
    usage = JSON.parse(await fs.readFile(path.join(dataDir, "image-usage.json"), "utf-8"));
  } catch {}
  for (const [childId, rec] of Object.entries(usage)) {
    lines.push(
      `insert into image_usage (child_id, date, count) values ('${childId}', '${rec.date}', ${rec.count}) on conflict (child_id, date) do nothing;`,
    );
  }

  // stories
  for (const s of stories.stories) {
    const row = {
      id: s.id,
      child_id: s.childId,
      title: s.title,
      hero: s.hero,
      character: s.character,
      bible: s.bible,
      summary: s.summary ?? "",
      status: s.status,
      chapters: s.chapters,
      cover_url: s.coverUrl ?? null,
      favorite: s.favorite ?? false,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    };
    const json = (v: unknown) =>
      `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    const txt = (v: unknown) =>
      v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;
    lines.push(
      `insert into stories (id, child_id, title, hero, character, bible, summary, status, chapters, cover_url, favorite, created_at, updated_at) values ('${row.id}', '${row.child_id}', ${txt(row.title)}, ${json(row.hero)}, ${json(row.character)}, ${json(row.bible)}, ${txt(row.summary)}, ${txt(row.status)}, ${json(row.chapters)}, ${txt(row.cover_url)}, ${row.favorite ? "true" : "false"}, '${row.created_at}', '${row.updated_at}') on conflict (id) do nothing;`,
    );
  }

  // characters (migratie van data/characters.json, momenteel leeg)
  let chars: { characters: Record<string, unknown>[] } = { characters: [] };
  try {
    chars = JSON.parse(await fs.readFile(path.join(dataDir, "characters.json"), "utf-8"));
  } catch {}
  for (const c of chars.characters) {
    const json = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    const txt = (v: unknown) =>
      v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;
    lines.push(
      `insert into characters (id, child_id, name, kind, appearance, image_style_hint, portrait_url, source_story_ids, series_note, notes, created_at) values ('${c.id}', '${c.childId}', ${txt(c.name)}, ${txt(c.kind)}, ${json(c.appearance)}, ${txt(c.imageStyleHint)}, ${txt(c.portraitUrl)}, '${JSON.stringify(c.sourceStoryIds ?? []).replace(/'/g, "''")}'::uuid[], ${txt(c.seriesNote)}, ${txt(c.notes)}, '${c.createdAt}') on conflict (id) do nothing;`,
    );
  }

  // Print naar stdout — we kopiëren dit naar de MCP execute_sql-call.
  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
