import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { basename, dirname, join, relative, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { writeJson } from "./files.mjs";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const MAX_ATTEMPTS_IN_MANIFEST = 100;
const MIN_USABLE_TEXT_LENGTH = 300;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function textEncoding(contentTypeHeader, body) {
  const header = String(contentTypeHeader || "");
  const declared = header.match(/charset\s*=\s*["']?([^;"'\s]+)/iu)?.[1];
  if (declared) return declared.toLowerCase();
  const head = body.subarray(0, Math.min(body.length, 4096)).toString("latin1");
  const meta = head.match(/<meta\b[^>]*(?:charset\s*=\s*["']?([^"'\s/>]+)|content\s*=\s*["'][^"']*charset=([^"';\s]+))/iu);
  return String(meta?.[1] || meta?.[2] || "utf-8").toLowerCase();
}

function decodeTextBody(body, contentTypeHeader) {
  const encoding = textEncoding(contentTypeHeader, body);
  try {
    return { text: new TextDecoder(encoding).decode(body), encoding };
  } catch {
    return { text: new TextDecoder("utf-8").decode(body), encoding: "utf-8" };
  }
}

function normalizedHost(value) {
  return String(value || "").toLowerCase().replace(/^www\./u, "");
}

function samePublisherHost(left, right) {
  const a = normalizedHost(left);
  const b = normalizedHost(right);
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function privateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224
  );
}

function privateIpv6(address) {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1") return true;
  if (/^(?:fc|fd)/u.test(value)) return true;
  if (/^fe[89ab]/u.test(value)) return true;
  if (value.startsWith("2001:db8:") || value === "2001:db8::") return true;
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/u);
  return mapped ? privateIpv4(mapped[1]) : false;
}

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !privateIpv4(address);
  if (family === 6) return !privateIpv6(address);
  return false;
}

async function resolvePublicHttpUrl(value, { lookupImpl = dnsLookup } = {}) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("only public HTTP(S) evidence URLs are supported");
  if (url.username || url.password) throw new Error("evidence URLs must not contain credentials");
  const host = normalizedHost(url.hostname);
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("evidence destination is not public");
  }
  const literalFamily = isIP(url.hostname);
  const addresses = literalFamily
    ? [{ address: url.hostname, family: literalFamily }]
    : await lookupImpl(url.hostname, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("evidence destination resolves to a non-public address");
  }
  return { url, addresses };
}

export async function assertPublicHttpUrl(value, options = {}) {
  return (await resolvePublicHttpUrl(value, options)).url;
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["lt", "<"],
    ["gt", ">"],
    ["quot", '"'],
    ["apos", "'"],
    ["nbsp", " "],
    ["ndash", "–"],
    ["mdash", "—"],
    ["hellip", "…"],
  ]);
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named.get(key) ?? match;
  });
}

function findArticleBodies(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) findArticleBodies(item, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (typeof value.articleBody === "string") out.push(value.articleBody);
  for (const child of Object.values(value)) findArticleBodies(child, out);
  return out;
}

function jsonLdText(html) {
  const candidates = [];
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  for (const match of html.matchAll(pattern)) {
    try {
      candidates.push(...findArticleBodies(JSON.parse(match[1].trim())));
    } catch {
      // Malformed publisher metadata is ignored; visible HTML is still available.
    }
  }
  return candidates.sort((a, b) => b.length - a.length)[0] || "";
}

function visibleHtmlText(html) {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/iu);
  let value = articleMatch?.[1] || html;
  value = value
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<(?:script|style|noscript|svg|nav|header|footer|form|aside)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|nav|header|footer|form|aside)>/giu, " ")
    .replace(/<(?:br|p|div|li|h[1-6]|section)\b[^>]*>/giu, "\n")
    .replace(/<[^>]+>/gu, " ");
  return decodeHtmlEntities(value)
    .replace(/[ \t\f\v]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function extractReadableHtml(html) {
  const structured = decodeHtmlEntities(jsonLdText(html)).replace(/\s+/gu, " ").trim();
  const visible = visibleHtmlText(html);
  return structured.length >= MIN_USABLE_TEXT_LENGTH ? structured : visible;
}

function tagAttributes(tag) {
  const attributes = new Map();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

export function extractCanonicalUrl(html, finalUrl) {
  const final = new URL(finalUrl);
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const attributes = tagAttributes(match[0]);
    const rel = String(attributes.get("rel") || "").toLowerCase().split(/\s+/u);
    const href = attributes.get("href");
    if (!href || !rel.includes("canonical")) continue;
    try {
      const candidate = new URL(href, final);
      if (["http:", "https:"].includes(candidate.protocol) && samePublisherHost(candidate.hostname, final.hostname)) {
        return candidate.href;
      }
    } catch {
      // Ignore malformed publisher canonical links.
    }
  }
  return "";
}

async function readBoundedBody(response, maxBytes) {
  if (Buffer.isBuffer(response.body)) {
    if (response.body.length > maxBytes) throw new Error(`response exceeds ${maxBytes} byte capture limit`);
    return response.body;
  }
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`response exceeds ${maxBytes} byte capture limit`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`response exceeds ${maxBytes} byte capture limit`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function pinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    const family = typeof options === "number" ? options : Number(options?.family || 0);
    const compatible = family ? addresses.filter((entry) => Number(entry.family) === family) : addresses;
    const list = compatible.length ? compatible : addresses;
    if (typeof options === "object" && options?.all) {
      callback(null, list.map(({ address, family: itemFamily }) => ({ address, family: Number(itemFamily) })));
      return;
    }
    callback(null, list[0].address, Number(list[0].family));
  };
}

function nativePublicRequest(url, addresses, { timeoutMs, maxBytes }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = requestImpl(url, {
      method: "GET",
      lookup: pinnedLookup(addresses),
      headers: {
        "user-agent": "BorderClashEvidence/1.0 (+research archive)",
        accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.2",
      },
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("capture timeout"));
    });
    request.on("error", rejectPromise);
    request.on("response", (response) => {
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy(new Error(`response exceeds ${maxBytes} byte capture limit`));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on("error", rejectPromise);
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        resolvePromise({
          status: Number(response.statusCode || 0),
          ok: Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 300,
          headers: {
            get(name) {
              const value = response.headers[String(name).toLowerCase()];
              return Array.isArray(value) ? value.join(", ") : value == null ? null : String(value);
            },
          },
          body,
        });
      });
    });
    request.end();
  });
}

function statusForHttp(code) {
  if ([408, 425, 429].includes(code) || code >= 500) return "transient-failure";
  if (code === 401 || code === 403 || code === 404 || code === 410 || code === 451) return "access-blocked";
  return "access-blocked";
}

function destinationFailureStatus(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || error || "");
  if (["EAI_AGAIN", "ENOTFOUND", "ETIMEOUT", "ECONNRESET", "ECONNREFUSED"].includes(code)) {
    return "transient-failure";
  }
  if (/\b(?:EAI_AGAIN|ENOTFOUND|DNS|lookup timed out)\b/iu.test(message)) {
    return "transient-failure";
  }
  return "blocked-destination";
}

export async function fetchEvidence(
  requestedUrl,
  {
    fetchImpl,
    lookupImpl = dnsLookup,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
  } = {},
) {
  let current;
  let addresses;
  try {
    ({ url: current, addresses } = await resolvePublicHttpUrl(requestedUrl, { lookupImpl }));
  } catch (error) {
    return {
      status: destinationFailureStatus(error),
      requestedUrl,
      error: String(error?.message || error),
      redirectChain: [],
    };
  }
  const redirectChain = [];
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = fetchImpl
        ? await fetchImpl(current.href, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": "BorderClashEvidence/1.0 (+research archive)",
            accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.2",
          },
        })
        : await nativePublicRequest(current, addresses, { timeoutMs, maxBytes });
    } catch (error) {
      clearTimeout(timer);
      const message = String(error?.name === "AbortError" ? "capture timeout" : error?.message || error);
      return {
        status: message.includes("capture limit") ? "too-large" : "transient-failure",
        requestedUrl,
        finalUrl: current.href,
        redirectChain,
        error: message,
      };
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      clearTimeout(timer);
      const location = response.headers.get("location");
      if (!location) {
        return { status: "access-blocked", requestedUrl, finalUrl: current.href, redirectChain, error: "redirect has no location" };
      }
      if (redirect === maxRedirects) {
        return { status: "transient-failure", requestedUrl, finalUrl: current.href, redirectChain, error: "too many redirects" };
      }
      let next;
      try {
        const resolved = await resolvePublicHttpUrl(new URL(location, current).href, { lookupImpl });
        next = resolved.url;
        addresses = resolved.addresses;
      } catch (error) {
        return {
          status: destinationFailureStatus(error),
          requestedUrl,
          finalUrl: current.href,
          redirectChain,
          error: String(error?.message || error),
        };
      }
      redirectChain.push({ from: current.href, to: next.href, status: response.status });
      current = next;
      continue;
    }
    if (!response.ok) {
      clearTimeout(timer);
      return {
        status: statusForHttp(response.status),
        requestedUrl,
        finalUrl: current.href,
        redirectChain,
        httpStatus: response.status,
        error: `HTTP ${response.status}`,
      };
    }
    let body;
    try {
      body = await readBoundedBody(response, maxBytes);
    } catch (error) {
      clearTimeout(timer);
      const message = String(error?.message || error);
      return {
        status: message.includes("capture limit") ? "too-large" : "transient-failure",
        requestedUrl,
        finalUrl: current.href,
        redirectChain,
        error: message,
      };
    }
    clearTimeout(timer);
    const contentTypeHeader = String(response.headers.get("content-type") || "application/octet-stream");
    const contentType = contentTypeHeader
      .split(";")[0].trim().toLowerCase();
    const result = {
      status: "unsupported-format",
      requestedUrl,
      finalUrl: current.href,
      redirectChain,
      contentType,
      body,
      sha256: sha256(body),
      byteLength: body.length,
    };
    if (contentType === "text/html" || contentType === "application/xhtml+xml") {
      const decoded = decodeTextBody(body, contentTypeHeader);
      const html = decoded.text;
      const text = extractReadableHtml(html);
      return {
        ...result,
        status: text.length >= MIN_USABLE_TEXT_LENGTH ? "captured-html" : "unusable-extraction",
        canonicalUrl: extractCanonicalUrl(html, current.href),
        encoding: decoded.encoding,
        text,
      };
    }
    if (contentType === "application/pdf") return { ...result, status: "captured-document" };
    if (contentType.startsWith("text/")) {
      const decoded = decodeTextBody(body, contentTypeHeader);
      const text = decoded.text.trim();
      return { ...result, status: text ? "captured-text" : "unusable-extraction", encoding: decoded.encoding, text };
    }
    return result;
  }
  return { status: "transient-failure", requestedUrl, redirectChain, error: "capture ended unexpectedly" };
}

function archiveRoots({ archiveRoot, backupRoot } = {}) {
  const home = process.env.USERPROFILE || process.env.HOME || process.cwd();
  return {
    archiveRoot: resolve(archiveRoot || process.env.BORDERCLASH_EVIDENCE_ARCHIVE || join(home, ".borderclash", "evidence")),
    backupRoot: resolve(backupRoot || process.env.BORDERCLASH_EVIDENCE_BACKUP || join(home, ".borderclash", "evidence-backup")),
  };
}

export function evidenceArchiveRoots(options = {}) {
  return archiveRoots(options);
}

async function readManifest(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function safeArticleId(articleId) {
  const id = String(articleId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/u.test(id)) throw new Error("invalid article id for evidence archive");
  return id;
}

async function copyFileIfMissing(source, destination) {
  try {
    await stat(destination);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }
}

async function syncBackup(articleRoot, backupArticleRoot, captureFiles) {
  await mkdir(backupArticleRoot, { recursive: true });
  for (const relativePath of captureFiles) {
    await copyFileIfMissing(join(articleRoot, relativePath), join(backupArticleRoot, relativePath));
  }
}

export async function storeEvidenceAttempt(articleId, fetched, options = {}) {
  const id = safeArticleId(articleId);
  const { archiveRoot, backupRoot } = archiveRoots(options);
  const articleRoot = join(archiveRoot, id);
  const backupArticleRoot = join(backupRoot, id);
  const manifestPath = join(articleRoot, "manifest.json");
  await mkdir(join(articleRoot, "captures"), { recursive: true });
  const now = Number(options.now ?? Date.now());
  const prior = await readManifest(manifestPath);
  const manifest = prior || {
    schemaVersion: 1,
    articleId: id,
    createdAt: now,
    attempts: [],
  };
  const attempt = {
    attemptedAt: now,
    status: fetched.status,
    requestedUrl: fetched.requestedUrl || "",
    finalUrl: fetched.finalUrl || "",
    canonicalUrl: fetched.canonicalUrl || "",
    httpStatus: fetched.httpStatus ?? null,
    error: fetched.error || "",
  };
  const captureFiles = [];
  if (Buffer.isBuffer(fetched.body)) {
    const actualSha256 = sha256(fetched.body);
    if (!fetched.sha256 || fetched.sha256 !== actualSha256) {
      throw new Error("evidence body SHA-256 does not match capture metadata");
    }
    if (Number(fetched.byteLength) !== fetched.body.length) {
      throw new Error("evidence body length does not match capture metadata");
    }
  }
  if (Buffer.isBuffer(fetched.body) && fetched.sha256) {
    const key = fetched.sha256;
    const captureRoot = join(articleRoot, "captures", key);
    await mkdir(captureRoot, { recursive: true });
    const metadata = {
      schemaVersion: 1,
      articleId: id,
      capturedAt: now,
      status: fetched.status,
      requestedUrl: fetched.requestedUrl || "",
      finalUrl: fetched.finalUrl || "",
      canonicalUrl: fetched.canonicalUrl || "",
      redirectChain: fetched.redirectChain || [],
      contentType: fetched.contentType || "",
      encoding: fetched.encoding || "",
      byteLength: fetched.byteLength,
      sha256: fetched.sha256,
      textLength: typeof fetched.text === "string" ? fetched.text.length : 0,
    };
    const metadataPath = join(captureRoot, "metadata.json");
    if (!(await pathExists(metadataPath))) await writeJson(metadataPath, metadata);
    captureFiles.push(relative(articleRoot, metadataPath));
    if (fetched.contentType === "application/pdf") {
      const originalPath = join(captureRoot, "original.pdf");
      if (!(await pathExists(originalPath))) await writeFile(originalPath, fetched.body);
      captureFiles.push(relative(articleRoot, originalPath));
    } else if (fetched.contentType?.startsWith("text/") || ["text/html", "application/xhtml+xml"].includes(fetched.contentType)) {
      const originalPath = join(captureRoot, "original.gz");
      if (!(await pathExists(originalPath))) await writeFile(originalPath, gzipSync(fetched.body));
      captureFiles.push(relative(articleRoot, originalPath));
    } else {
      const originalPath = join(captureRoot, "original.bin");
      if (!(await pathExists(originalPath))) await writeFile(originalPath, fetched.body);
      captureFiles.push(relative(articleRoot, originalPath));
    }
    if (typeof fetched.text === "string" && fetched.text) {
      const textPath = join(captureRoot, "text.txt");
      if (!(await pathExists(textPath))) await writeFile(textPath, fetched.text + "\n", "utf8");
      captureFiles.push(relative(articleRoot, textPath));
    }
    attempt.captureKey = key;
    manifest.latestCapture = key;
  }
  manifest.latestStatus = fetched.status;
  manifest.updatedAt = now;
  manifest.attempts = [...(manifest.attempts || []), attempt].slice(-MAX_ATTEMPTS_IN_MANIFEST);
  await writeJson(manifestPath, manifest);
  await syncBackup(articleRoot, backupArticleRoot, captureFiles);
  await writeJson(join(backupArticleRoot, "manifest.json"), manifest);
  return {
    articleId: id,
    status: fetched.status,
    latestCapture: manifest.latestCapture || "",
    archiveRoot,
    backupRoot,
  };
}

export async function captureArticle(article, options = {}) {
  const id = safeArticleId(article?.id);
  const { archiveRoot } = archiveRoots(options);
  const manifestPath = join(archiveRoot, id, "manifest.json");
  const existing = await readManifest(manifestPath);
  const usable = new Set(["captured-html", "captured-document", "captured-text"]);
  if (!options.force && existing && usable.has(existing.latestStatus) && existing.latestCapture) {
    return { articleId: id, status: existing.latestStatus, latestCapture: existing.latestCapture, reused: true };
  }
  const fetched = await fetchEvidence(article.sourceUrl, options);
  return storeEvidenceAttempt(id, fetched, options);
}

async function fileHashes(root) {
  const output = new Map();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else output.set(relative(root, path).replaceAll("\\", "/"), sha256(await readFile(path)));
    }
  }
  await walk(root);
  return output;
}

export async function verifyArchiveCopy(articleId, options = {}) {
  const id = safeArticleId(articleId);
  const { archiveRoot, backupRoot } = archiveRoots(options);
  const primary = join(archiveRoot, id);
  const backup = join(backupRoot, id);
  const [left, right] = await Promise.all([fileHashes(primary), fileHashes(backup)]);
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort();
  const mismatches = keys.filter((key) => left.get(key) !== right.get(key));
  return { articleId: id, ok: mismatches.length === 0, mismatches, files: keys.length };
}

export async function restoreArchiveCopy(articleId, destinationRoot, options = {}) {
  const id = safeArticleId(articleId);
  const { backupRoot } = archiveRoots(options);
  const source = join(backupRoot, id);
  const destination = join(resolve(destinationRoot), id);
  await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
  const sourceHashes = await fileHashes(source);
  const restoredHashes = await fileHashes(destination);
  const keys = [...new Set([...sourceHashes.keys(), ...restoredHashes.keys()])].sort();
  const mismatches = keys.filter((key) => sourceHashes.get(key) !== restoredHashes.get(key));
  return { articleId: id, destination, ok: mismatches.length === 0, mismatches, files: keys.length };
}

export async function readCapturedOriginal(articleId, captureKey, options = {}) {
  const id = safeArticleId(articleId);
  const { archiveRoot } = archiveRoots(options);
  const root = join(archiveRoot, id, "captures", captureKey);
  const metadata = JSON.parse(await readFile(join(root, "metadata.json"), "utf8"));
  if (metadata.contentType === "application/pdf") return readFile(join(root, "original.pdf"));
  if (metadata.contentType?.startsWith("text/") || ["text/html", "application/xhtml+xml"].includes(metadata.contentType)) {
    return gunzipSync(await readFile(join(root, "original.gz")));
  }
  return readFile(join(root, "original.bin"));
}

export async function readEvidenceSnapshot(articleId, options = {}) {
  const id = safeArticleId(articleId);
  const { archiveRoot, backupRoot } = archiveRoots(options);
  const manifestPath = join(archiveRoot, id, "manifest.json");
  const manifest = await readManifest(manifestPath);
  if (!manifest) {
    return {
      articleId: id,
      found: false,
      archiveRoot,
      backupRoot,
      manifest: null,
      metadata: null,
    };
  }
  let metadata = null;
  if (manifest.latestCapture) {
    try {
      metadata = JSON.parse(await readFile(
        join(archiveRoot, id, "captures", manifest.latestCapture, "metadata.json"),
        "utf8",
      ));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return {
    articleId: id,
    found: true,
    archiveRoot,
    backupRoot,
    manifest,
    metadata,
  };
}
