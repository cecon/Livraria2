const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

// Read-only verification of the legacy ledger; never marks migrations applied.
async function main() {
  const db = new PrismaClient();
  try {
    const dir = path.resolve(__dirname, "../../migrations");
    const rows = await db.$queryRaw`
      select version, sha256, baseline from public.livraria_schema_migrations order by version`;
    const records = new Map(rows.map(row => [row.version, row]));
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
    const missing = [];
    const changed = [];
    const versions = new Set(files.map(file => file.slice(0, -4)));
    const unrepresented = rows.filter(row => !versions.has(row.version)).map(row => row.version);
    for (const file of files) {
      const version = file.slice(0, -4);
      const row = records.get(version);
      const source = fs.readFileSync(path.join(dir, file));
      const hash = crypto.createHash("sha256").update(source).digest("hex");
      const lfHash = crypto.createHash("sha256").update(source.toString("utf8").replaceAll("\r\n", "\n")).digest("hex");
      if (!row) missing.push(version);
      else if (!row.baseline && row.sha256 !== hash && row.sha256 !== lfHash) changed.push(version);
    }
    console.log(JSON.stringify({ arquivos: files.length, registrados: rows.length, missing, changed, unrepresented }));
    if (missing.length || changed.length || unrepresented.length) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => { console.error("Falha na verificacao da baseline"); process.exitCode = 1; });
