import path from "path";

export interface RuntimeBundle {
  label: string;
  entry: string;
  files: Record<string, string>;
}

function cleanPath(value: string): string {
  const normalized = value.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  const safe = path.posix.normalize(normalized || "index.html");
  if (safe.startsWith("..")) {
    return "index.html";
  }
  return safe;
}

export function parseRuntimeBundle(raw: string): RuntimeBundle | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const entry = cleanPath(typeof parsed.entry === "string" ? parsed.entry : "index.html");
    const label = typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "Runtime preview";
    const filesValue = parsed.files;
    if (!filesValue || typeof filesValue !== "object" || Array.isArray(filesValue)) {
      return null;
    }

    const files: Record<string, string> = {};
    for (const [rawFilePath, content] of Object.entries(filesValue)) {
      if (typeof content !== "string") {
        continue;
      }
      files[cleanPath(rawFilePath)] = content;
    }

    if (Object.keys(files).length === 0) {
      return null;
    }

    if (!files[entry]) {
      return null;
    }

    return { label, entry, files };
  } catch {
    return null;
  }
}

export function resolveRuntimeFile(bundle: RuntimeBundle, requestPath?: string): { path: string; content: string } | null {
  const normalized = cleanPath(requestPath || bundle.entry);
  const content = bundle.files[normalized];
  if (typeof content !== "string") {
    return null;
  }
  return { path: normalized, content };
}

export function injectBaseHref(html: string, baseHref: string): string {
  if (/<base\s/i.test(html)) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
  }

  return `<base href="${baseHref}">${html}`;
}

export function getRuntimeContentType(filePath: string): string {
  const extension = path.posix.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "text/plain; charset=utf-8";
  }
}
