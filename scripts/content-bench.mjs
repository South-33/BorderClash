import { loadContentQuality } from "../lib/content-quality.mjs";

const result = await loadContentQuality();
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
