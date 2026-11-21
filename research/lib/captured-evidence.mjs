import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { evidenceArchiveRoots } from "./evidence-archive.mjs";

const DEFAULT_PER_ARTICLE_CHARS = 12_000;
const DEFAULT_TOTAL_CHARS = 60_000;
const MIN_CAPTURE_HTML_TEXT_LENGTH = 300;
const USABLE_CAPTURE_STATUSES = new Set(["captured-html", "captured-document", "captured-text"]);
const execFileAsync = promisify(execFile);

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function identityText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function shortHtmlMatchesArticleTitle(article, text) {
  const body = identityText(text);
  if (!body) return false;
  const bodyTokens = body.split(" ").filter(Boolean);
  for (const rawTitle of [article?.title, article?.titleEn]) {
    const title = identityText(rawTitle);
    if (!title) continue;
    if (title.length >= 12 && body.includes(title)) return true;
    const titleTokens = title.split(" ").filter((token) => token.length >= 3);
    const shared = titleTokens.filter((titleToken) => bodyTokens.some((bodyToken) => (
      bodyToken === titleToken
      || (titleToken.length >= 4 && bodyToken.includes(titleToken))
      || (bodyToken.length >= 4 && titleToken.includes(bodyToken))
    )));
    if (titleTokens.length >= 3 && shared.length >= 2) return true;
    if (titleTokens.length <= 2 && shared.some((token) => token.length >= 6)) return true;
  }
  return false;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function extractPdfText(pdfPath) {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return normalizeText(stdout);
  } catch {
    return "";
  }
}

async function readCapture(article, archiveRoot, remainingChars, perArticleChars, pdfTextExtractor) {
  const root = join(archiveRoot, article.id);
  const manifest = await readJson(join(root, "manifest.json"));
  if (!manifest?.latestCapture) {
    return {
      articleId: article.id,
      source: article.source || "",
      sourceUrl: article.sourceUrl || "",
      captureFound: false,
      latestStatus: manifest?.latestStatus || "",
      textLength: 0,
      excerptLength: 0,
      truncated: false,
      text: "",
    };
  }

  let text = "";
  try {
    text = normalizeText(await readFile(join(root, "captures", manifest.latestCapture, "text.txt"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!text && manifest.latestStatus === "captured-document") {
    try {
      text = normalizeText(await pdfTextExtractor(join(root, "captures", manifest.latestCapture, "original.pdf")));
    } catch {
      text = "";
    }
  }
  const limit = Math.max(0, Math.min(perArticleChars, remainingChars));
  const excerpt = limit > 0 ? text.slice(0, limit) : "";
  const latestStatus = manifest.latestStatus || "";
  let qualityStatus = "usable";
  if (!text) qualityStatus = "missing-text";
  else if (!USABLE_CAPTURE_STATUSES.has(latestStatus)) qualityStatus = "status-not-usable";
  else if (latestStatus === "captured-html" && text.length < MIN_CAPTURE_HTML_TEXT_LENGTH) {
    qualityStatus = shortHtmlMatchesArticleTitle(article, text)
      ? "usable-short-html-title-match"
      : "short-html-title-mismatch";
  }
  return {
    articleId: article.id,
    source: article.source || "",
    sourceUrl: article.sourceUrl || "",
    captureFound: qualityStatus.startsWith("usable"),
    latestStatus,
    qualityStatus,
    textLength: text.length,
    excerptLength: excerpt.length,
    truncated: text.length > excerpt.length,
    text: excerpt,
  };
}

export async function buildCapturedEvidence(packet, {
  archiveRoot,
  perArticleChars = DEFAULT_PER_ARTICLE_CHARS,
  totalChars = DEFAULT_TOTAL_CHARS,
  pdfTextExtractor = extractPdfText,
} = {}) {
  if (!packet?.id) throw new Error("captured evidence requires a record inspection");
  const articles = Array.isArray(packet.evidence?.articles) ? packet.evidence.articles : [];
  const roots = evidenceArchiveRoots({ archiveRoot });
  const perArticleLimit = Math.max(1_000, Math.min(30_000, Number(perArticleChars) || DEFAULT_PER_ARTICLE_CHARS));
  const totalLimit = Math.max(perArticleLimit, Math.min(150_000, Number(totalChars) || DEFAULT_TOTAL_CHARS));
  let remaining = totalLimit;
  const captures = [];

  for (const article of articles) {
    const capture = await readCapture(article, roots.archiveRoot, remaining, perArticleLimit, pdfTextExtractor);
    captures.push(capture);
    remaining -= capture.excerptLength;
  }

  return {
    recordId: packet.id,
    archiveRoot: roots.archiveRoot,
    perArticleChars: perArticleLimit,
    totalChars: totalLimit,
    articleCount: articles.length,
    capturedCount: captures.filter(({ captureFound }) => captureFound).length,
    excerptChars: totalLimit - remaining,
    captures,
  };
}
