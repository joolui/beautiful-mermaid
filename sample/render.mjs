import { renderMermaid, renderMermaidAscii, THEMES } from "beautiful-mermaid";
import { readdirSync, readFileSync, writeFileSync, watch } from "fs";
import { basename, join } from "path";

const SRC_DIR = new URL("./src/", import.meta.url).pathname;
const OUT_DIR = new URL("./out/", import.meta.url).pathname;
const THEME = THEMES["github-light"];
const WATCH = process.argv.includes("--watch");

async function render(file) {
  const input = readFileSync(join(SRC_DIR, file), "utf-8");
  const name = basename(file, ".mmd");

  const svg = await renderMermaid(input, {
    ...THEME,
    surface: '#f6faff',
    border: '#a6d4fd',
  });
  const svgFile = name + ".svg";
  writeFileSync(join(OUT_DIR, svgFile), svg);

  const ascii = renderMermaidAscii(input);
  const txtFile = name + ".txt";
  writeFileSync(join(OUT_DIR, txtFile), ascii);

  console.log(`  ${file} -> out/${svgFile}, out/${txtFile}`);
}

async function renderAll() {
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".mmd"));
  if (files.length === 0) {
    console.log("No .mmd files found in src/");
    return;
  }
  console.log(`Rendering ${files.length} diagram(s)...`);
  for (const file of files) {
    await render(file);
  }
  console.log("Done.");
}

await renderAll();

if (WATCH) {
  console.log("\nWatching src/ for changes...");
  watch(SRC_DIR, async (_, filename) => {
    if (filename?.endsWith(".mmd")) {
      console.log(`\nChanged: ${filename}`);
      await render(filename).catch((err) =>
        console.error(`Error rendering ${filename}:`, err.message)
      );
    }
  });
}
