// Eenmalig seed-script: leest data/stories.json + data/characters.json + data/image-usage.json
// en print INSERT-SQL voor Supabase execute_sql. Base64-encoding van jsonb-velden vermijdt
// alle escape-hell door de MCP JSON-transportlaag (base64 bevat alleen [A-Za-z0-9+/=]).
import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const stories = JSON.parse(await fs.readFile(path.join(dataDir, "stories.json"), "utf-8"));

const b64 = (s) => Buffer.from(s, "utf-8").toString("base64");
// jsonb-veld: encode de JSON-string naar base64, decode in SQL naar bytea → text → jsonb.
const jsonb = (v) => `convert_from(decode('${b64(JSON.stringify(v))}', 'base64'), 'utf8')::jsonb`;
// text-veld: base64 → decode → text.
const txt = (v) =>
  v === null || v === undefined ? "null" : `convert_from(decode('${b64(String(v))}', 'base64'), 'utf8')`;

const lines = [];
for (const c of stories.children) {
  lines.push(
    `insert into children (id, name, age) values ('${c.id}', ${txt(c.name)}, ${c.age}) on conflict (id) do nothing;`,
  );
}

let usage = {};
try { usage = JSON.parse(await fs.readFile(path.join(dataDir, "image-usage.json"), "utf-8")); } catch {}
for (const [childId, rec] of Object.entries(usage)) {
  lines.push(
    `insert into image_usage (child_id, date, count) values ('${childId}', '${rec.date}', ${rec.count}) on conflict (child_id, date) do nothing;`,
  );
}

for (const s of stories.stories) {
  lines.push(
    `insert into stories (id, child_id, title, hero, character, bible, summary, status, chapters, cover_url, favorite, created_at, updated_at) values ('${s.id}', '${s.childId}', ${txt(s.title)}, ${jsonb(s.hero)}, ${jsonb(s.character)}, ${jsonb(s.bible)}, ${txt(s.summary ?? "")}, ${txt(s.status)}, ${jsonb(s.chapters)}, ${txt(s.coverUrl ?? "")}, ${s.favorite ? "true" : "false"}, '${s.createdAt}', '${s.updatedAt}') on conflict (id) do nothing;`,
  );
}

let chars = { characters: [] };
try { chars = JSON.parse(await fs.readFile(path.join(dataDir, "characters.json"), "utf-8")); } catch {}
for (const c of chars.characters) {
  const arrB64 = b64(JSON.stringify(c.sourceStoryIds ?? []));
  lines.push(
    `insert into characters (id, child_id, name, kind, appearance, image_style_hint, portrait_url, source_story_ids, series_note, notes, created_at) values ('${c.id}', '${c.childId}', ${txt(c.name)}, ${txt(c.kind)}, ${jsonb(c.appearance)}, ${txt(c.imageStyleHint)}, ${txt(c.portraitUrl ?? "")}, convert_from(decode('${arrB64}', 'base64'), 'utf8')::uuid[], ${txt(c.seriesNote ?? "")}, ${txt(c.notes ?? "")}, '${c.createdAt}') on conflict (id) do nothing;`,
  );
}

process.stdout.write(lines.join("\n") + "\n");
