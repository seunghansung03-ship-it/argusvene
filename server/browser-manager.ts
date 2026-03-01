import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";
const SESSION_TIMEOUT = 10 * 60 * 1000;
const SCREENSHOT_INTERVAL = 600;
const VIEWPORT = { width: 1280, height: 720 };

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  lastActivity: number;
  screenshotInterval: ReturnType<typeof setInterval> | null;
  listeners: Set<(data: Buffer) => void>;
  currentUrl: string;
}

let browserInstance: Browser | null = null;
const sessions = new Map<string, BrowserSession>();

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });
  }
  return browserInstance;
}

export async function createSession(userId: string): Promise<{ sessionId: string }> {
  if (sessions.has(userId)) {
    const existing = sessions.get(userId)!;
    existing.lastActivity = Date.now();
    return { sessionId: userId };
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await page.goto("about:blank");

  const session: BrowserSession = {
    context,
    page,
    lastActivity: Date.now(),
    screenshotInterval: null,
    listeners: new Set(),
    currentUrl: "about:blank",
  };

  sessions.set(userId, session);
  startScreenshotLoop(userId, session);
  return { sessionId: userId };
}

function startScreenshotLoop(userId: string, session: BrowserSession) {
  if (session.screenshotInterval) return;

  session.screenshotInterval = setInterval(async () => {
    if (session.listeners.size === 0) return;
    try {
      const screenshot = await session.page.screenshot({
        type: "jpeg",
        quality: 55,
      });
      session.currentUrl = session.page.url();
      for (const listener of session.listeners) {
        listener(screenshot);
      }
    } catch {
    }
  }, SCREENSHOT_INTERVAL);
}

export function addScreenshotListener(userId: string, listener: (data: Buffer) => void): () => void {
  const session = sessions.get(userId);
  if (!session) return () => {};
  session.listeners.add(listener);
  return () => session.listeners.delete(listener);
}

export async function navigateTo(userId: string, url: string): Promise<{ success: boolean; url: string }> {
  const session = sessions.get(userId);
  if (!session) throw new Error("No browser session");

  session.lastActivity = Date.now();
  if (!url.startsWith("http")) url = "https://" + url;
  try {
    await session.page.goto(url, { timeout: 15000, waitUntil: "domcontentloaded" });
    session.currentUrl = session.page.url();
    return { success: true, url: session.currentUrl };
  } catch (e: any) {
    return { success: false, url: e.message };
  }
}

export async function performAction(
  userId: string,
  action: BrowserAction
): Promise<{ success: boolean; message: string }> {
  const session = sessions.get(userId);
  if (!session) throw new Error("No browser session");

  session.lastActivity = Date.now();
  try {
    switch (action.type) {
      case "click":
        await session.page.mouse.click(action.x!, action.y!);
        await session.page.waitForTimeout(500);
        return { success: true, message: `Clicked at (${action.x}, ${action.y})` };

      case "type":
        if (action.x !== undefined && action.y !== undefined) {
          await session.page.mouse.click(action.x, action.y);
          await session.page.waitForTimeout(200);
        }
        await session.page.keyboard.type(action.text!, { delay: 30 });
        return { success: true, message: `Typed "${action.text}"` };

      case "scroll":
        await session.page.mouse.wheel(0, action.deltaY || 300);
        await session.page.waitForTimeout(300);
        return { success: true, message: `Scrolled ${action.deltaY || 300}px` };

      case "press":
        await session.page.keyboard.press(action.key!);
        await session.page.waitForTimeout(300);
        return { success: true, message: `Pressed ${action.key}` };

      case "back":
        await session.page.goBack();
        await session.page.waitForTimeout(500);
        return { success: true, message: "Navigated back" };

      case "forward":
        await session.page.goForward();
        await session.page.waitForTimeout(500);
        return { success: true, message: "Navigated forward" };

      case "wait":
        await session.page.waitForTimeout(action.duration || 1000);
        return { success: true, message: `Waited ${action.duration || 1000}ms` };

      default:
        return { success: false, message: `Unknown action: ${action.type}` };
    }
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getScreenshot(userId: string): Promise<Buffer | null> {
  const session = sessions.get(userId);
  if (!session) return null;
  try {
    return await session.page.screenshot({ type: "jpeg", quality: 60 });
  } catch {
    return null;
  }
}

export async function getCurrentUrl(userId: string): Promise<string> {
  const session = sessions.get(userId);
  if (!session) return "";
  return session.page.url();
}

export async function destroySession(userId: string) {
  const session = sessions.get(userId);
  if (!session) return;

  if (session.screenshotInterval) clearInterval(session.screenshotInterval);
  session.listeners.clear();
  try {
    await session.context.close();
  } catch {}
  sessions.delete(userId);
}

export function hasSession(userId: string): boolean {
  return sessions.has(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      console.log(`[browser-manager] Cleaning up inactive session for user: ${userId}`);
      destroySession(userId);
    }
  }
}, 60000);

export interface BrowserAction {
  type: "click" | "type" | "scroll" | "press" | "back" | "forward" | "wait";
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  deltaY?: number;
  duration?: number;
}

export async function shutdownAll() {
  for (const userId of sessions.keys()) {
    await destroySession(userId);
  }
  if (browserInstance) {
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
  }
}
