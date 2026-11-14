/**
 * SpireFi — Automated 1080p Hackathon Demo Scene Choreographer (Playwright)
 *
 * Drives http://localhost:3000 across all 6 Acts in exact millisecond sync
 * with the synthesized neural voice-over segments in `scripts/demo/.tmp/timings.json`.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Resolve Playwright from local or global npm installation
function loadPlaywright() {
  const candidates = [
    "playwright",
    "@playwright/test",
    path.join(
      process.env.APPDATA || "",
      "npm",
      "node_modules",
      "@playwright",
      "cli",
      "node_modules",
      "playwright"
    ),
  ];
  for (const modPath of candidates) {
    try {
      return require(modPath);
    } catch {
      // try next
    }
  }
  throw new Error("Could not resolve playwright module.");
}

const { chromium } = loadPlaywright();

const ROOT_DIR = process.cwd();
const TMP_DIR = path.join(ROOT_DIR, "scripts", "demo", ".tmp");
const TIMINGS_PATH = path.join(TMP_DIR, "timings.json");
const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3000";

const DEMO_ACCOUNT_ID = "raider-seven.spire.testnet";

// Rich on-chain-shaped demo trophy SVG for the Floor 3 Conqueror showcase
const CONQUEROR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="voidCore" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#c084fc" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#6d28d9" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#090a0f" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="28" fill="#090a0f" stroke="url(#goldRim)" stroke-width="6"/>
  <circle cx="200" cy="180" r="118" fill="url(#voidCore)" stroke="#a855f7" stroke-width="2" stroke-dasharray="6 4"/>
  <polygon points="200,72 246,162 312,175 256,228 270,302 200,262 130,302 144,228 88,175 154,162" fill="none" stroke="url(#goldRim)" stroke-width="4"/>
  <polygon points="200,98 228,172 200,245 172,172" fill="#f59e0b" fill-opacity="0.88"/>
  <text x="200" y="344" text-anchor="middle" fill="#f8fafc" font-family="Georgia, serif" font-size="18" font-weight="bold" letter-spacing="2">APEX VOID CONQUEROR</text>
  <text x="200" y="368" text-anchor="middle" fill="#fbbf24" font-family="monospace" font-size="12" letter-spacing="1.5">FLOOR III · ROUND #4 · SPIRE.TESTNET</text>
</svg>`;

const CONQUEROR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CONQUEROR_SVG)}`;

function encodeJsonResult(payload) {
  return Array.from(Buffer.from(JSON.stringify(payload), "utf8"));
}

const DEMO_PUBLIC_KEY = `ed25519:${"6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"}`;

// Inject HUD overlay + cursor helper into every navigated page
const HUD_INIT_SCRIPT = () => {
  const pub = "ed25519:" + "6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp";
  const sec = "ed25519:" + "11111111111111111111111111111111" + "6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp";
  const SESSION = {
    accountId: "raider-seven.spire.testnet",
    publicKey: pub,
    secretKey: sec,
    createdAt: Date.now() - 3600_000,
    allowanceNear: 0.6,
    keyMode: "ephemeral-full-access",
    provision: "confirmed",
  };
  try {
    localStorage.setItem("spire_session_v3", JSON.stringify(SESSION));
    localStorage.setItem(
      "spirefi.raid.log.v1:raider-seven.spire.testnet",
      JSON.stringify([
        {
          id: "seed-1",
          timestamp: new Date(Date.now() - 95_000).toLocaleTimeString(),
          floor: 1,
          element: "Solar",
          stance: "Aggressive",
          damage: 268,
          isCombo: true,
          txHash: "8fK3x9QpLmN2vR7tY4wZ1cB5nJ6mH8gD3sF4aP9qW2eR",
        },
        {
          id: "seed-2",
          timestamp: new Date(Date.now() - 42_000).toLocaleTimeString(),
          floor: 2,
          element: "Void",
          stance: "Pierce",
          damage: 312,
          isCombo: true,
          txHash: "4dL9m2XzPqW7kC3nR8vT1bY5jH6gF2sA9wE4uI7oP3xK",
        },
      ])
    );
    localStorage.setItem(
      "spirefi.vault.history.v1:raider-seven.spire.testnet",
      JSON.stringify([
        {
          id: "vh-1",
          at: Date.now() - 240_000,
          kind: "deposit",
          detail: "Provisioned Citadel Pouch (+0.35 NEAR starter allocation)",
          txHash: "9aB2c4D6e8F0g2H4j6K8l0M2n4P6q8R0s2T4u6V8w0X2",
        },
        {
          id: "vh-2",
          at: Date.now() - 120_000,
          kind: "back",
          detail: "Staked 0.50 NEAR into Floor 1 Backer Vault (50,000,000 shares)",
          txHash: "3xY5z7A9b1C3d5E7f9G1h3J5k7L9m1N3p5Q7r9S1t3U5",
        },
      ])
    );
  } catch {
    // ignore storage errors
  }

  window.__spireInstallHud = () => {
    if (document.getElementById("spire-demo-hud-root")) return;

    const style = document.createElement("style");
    style.textContent = `
      #spire-demo-hud-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483640;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .spire-demo-top-pill {
        position: absolute;
        top: 18px;
        right: 24px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 16px;
        border-radius: 999px;
        background: rgba(9, 10, 15, 0.88);
        border: 1px solid rgba(245, 158, 11, 0.45);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(245, 158, 11, 0.18);
        backdrop-filter: blur(12px);
      }
      .spire-demo-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 10px #10b981;
        animation: spirePulse 1.6s infinite ease-in-out;
      }
      @keyframes spirePulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.28); opacity: 0.7; }
      }
      .spire-demo-top-text {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #f8fafc;
      }
      .spire-demo-top-sub {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        color: #fbbf24;
        padding-left: 8px;
        border-left: 1px solid rgba(255,255,255,0.16);
      }
      .spire-demo-lower-third {
        position: absolute;
        left: 50%;
        bottom: 26px;
        transform: translateX(-50%);
        width: min(1180px, 88vw);
        background: linear-gradient(180deg, rgba(13, 15, 23, 0.92) 0%, rgba(7, 8, 13, 0.96) 100%);
        border: 1px solid rgba(245, 158, 11, 0.42);
        border-left: 4px solid #f59e0b;
        border-radius: 14px;
        padding: 14px 24px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.82), 0 0 32px rgba(245, 158, 11, 0.12);
        backdrop-filter: blur(14px);
        transition: opacity 0.28s ease, transform 0.28s ease;
      }
      .spire-demo-act-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .spire-demo-act-badge {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11.5px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #fbbf24;
      }
      .spire-demo-act-metric {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11.5px;
        font-weight: 600;
        color: #38bdf8;
      }
      .spire-demo-caption {
        font-size: 18.5px;
        line-height: 1.42;
        font-weight: 600;
        color: #f8fafc;
        letter-spacing: 0.01em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
      }
      .spire-demo-cursor {
        position: absolute;
        width: 26px;
        height: 26px;
        margin-left: -13px;
        margin-top: -13px;
        border-radius: 50%;
        border: 2.5px solid #fbbf24;
        background: radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0) 70%);
        box-shadow: 0 0 18px rgba(251, 191, 36, 0.8);
        transition: left 0.42s cubic-bezier(0.22, 1, 0.36, 1), top 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s ease;
        z-index: 2147483645;
        left: 960px;
        top: 540px;
      }
      .spire-demo-cursor.clicking {
        transform: scale(0.72);
        border-color: #38bdf8;
        box-shadow: 0 0 28px rgba(56, 189, 248, 0.95);
      }
      .spire-demo-outro {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 40%, rgba(28, 25, 38, 0.95) 0%, rgba(7, 8, 12, 0.98) 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.45s ease;
        text-align: center;
        padding: 40px;
      }
      .spire-demo-outro.visible {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "spire-demo-hud-root";
    root.innerHTML = `
      <div class="spire-demo-top-pill">
        <span class="spire-demo-dot"></span>
        <span class="spire-demo-top-text">SPIREFI · NEAR TESTNET (spire.testnet)</span>
        <span class="spire-demo-top-sub" id="spire-demo-hud-route">GAMES TRACK</span>
      </div>
      <div class="spire-demo-lower-third" id="spire-demo-lower">
        <div class="spire-demo-act-row">
          <span class="spire-demo-act-badge" id="spire-demo-badge">ACT I · INVISIBLE ONBOARDING</span>
          <span class="spire-demo-act-metric" id="spire-demo-metric">0.60 NEAR EPHEMERAL GUEST SESSION</span>
        </div>
        <div class="spire-demo-caption" id="spire-demo-caption">
          Initializing SpireFi Citadel on NEAR Testnet...
        </div>
      </div>
      <div class="spire-demo-cursor" id="spire-demo-cursor"></div>
      <div class="spire-demo-outro" id="spire-demo-outro">
        <div style="font-family: monospace; font-size: 14px; letter-spacing: 0.2em; color: #fbbf24; margin-bottom: 14px;">
          BUILT AT NEAR HACKATHON · GAMES WITH REAL ECONOMIES
        </div>
        <div style="font-family: Georgia, serif; font-size: 56px; font-weight: 800; color: #f8fafc; letter-spacing: -0.02em; margin-bottom: 16px;">
          SPIREFI · THE OBSIDIAN CITADEL
        </div>
        <div style="font-size: 21px; color: #cbd5e1; max-width: 780px; line-height: 1.5; margin-bottom: 32px;">
          Self-Balancing Boss Resistances · 3-Floor Co-op Jackpots · Deterministic NPC Bonding Curve · Dynamic On-Chain NEP-171 SVG Trophies
        </div>
        <div style="display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; font-family: monospace; font-size: 15px;">
          <div style="padding: 12px 22px; border-radius: 10px; background: rgba(245,158,11,0.16); border: 1px solid #f59e0b; color: #fbbf24; font-weight: 700;">
            Contract: spire.testnet
          </div>
          <div style="padding: 12px 22px; border-radius: 10px; background: rgba(56,189,248,0.14); border: 1px solid #38bdf8; color: #38bdf8; font-weight: 700;">
            github.com/SeanWang138/SpireFi
          </div>
          <div style="padding: 12px 22px; border-radius: 10px; background: rgba(168,85,247,0.16); border: 1px solid #a855f7; color: #e9d5ff; font-weight: 700;">
            @NEARProtocol · #NEARHackathon
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  };

  window.__spireSetHud = ({ badge, metric, caption, route }) => {
    window.__spireInstallHud();
    if (badge !== undefined) {
      const el = document.getElementById("spire-demo-badge");
      if (el) el.textContent = badge;
    }
    if (metric !== undefined) {
      const el = document.getElementById("spire-demo-metric");
      if (el) el.textContent = metric;
    }
    if (caption !== undefined) {
      const el = document.getElementById("spire-demo-caption");
      if (el) el.textContent = caption;
    }
    if (route !== undefined) {
      const el = document.getElementById("spire-demo-hud-route");
      if (el) el.textContent = route;
    }
  };

  window.__spireMoveCursor = (x, y, click = false) => {
    window.__spireInstallHud();
    const c = document.getElementById("spire-demo-cursor");
    if (!c) return;
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    if (click) {
      c.classList.add("clicking");
      setTimeout(() => c.classList.remove("clicking"), 240);
    }
  };

  window.__spireShowOutro = () => {
    window.__spireInstallHud();
    const outro = document.getElementById("spire-demo-outro");
    if (outro) outro.classList.add("visible");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.__spireInstallHud());
  } else {
    window.__spireInstallHud();
  }
};

async function setHud(page, data) {
  await page.evaluate((d) => {
    if (window.__spireSetHud) window.__spireSetHud(d);
  }, data);
}

async function moveCursorToSelector(page, selector, clickElement = false) {
  try {
    const loc = page.locator(selector).first();
    if ((await loc.count()) > 0) {
      const box = await loc.boundingBox();
      if (box) {
        const cx = Math.round(box.x + box.width / 2);
        const cy = Math.round(box.y + box.height / 2);
        await page.evaluate(
          ([x, y, clk]) => {
            if (window.__spireMoveCursor) window.__spireMoveCursor(x, y, clk);
          },
          [cx, cy, clickElement]
        );
        if (clickElement) {
          await loc.click({ timeout: 1500 }).catch(() => {});
        }
        return;
      }
    }
  } catch {
    // ignore missing selector
  }
}

async function moveCursorXY(page, x, y, pulse = false) {
  await page.evaluate(
    ([px, py, clk]) => {
      if (window.__spireMoveCursor) window.__spireMoveCursor(px, py, clk);
    },
    [x, y, pulse]
  );
}

async function runCaptionsOverWindow(page, actMeta, captions, totalMs, actions = []) {
  const start = Date.now();
  const capCount = captions.length;
  const slotMs = totalMs / capCount;

  let actionIdx = 0;
  const sortedActions = [...actions].sort((a, b) => a.atMs - b.atMs);

  for (let i = 0; i < capCount; i++) {
    await setHud(page, {
      badge: actMeta.badge,
      metric: actMeta.metric,
      route: actMeta.route,
      caption: captions[i],
    });

    const targetEnd = Math.round((i + 1) * slotMs);
    while (Date.now() - start < targetEnd) {
      const elapsed = Date.now() - start;
      while (
        actionIdx < sortedActions.length &&
        elapsed >= sortedActions[actionIdx].atMs
      ) {
        const act = sortedActions[actionIdx++];
        try {
          await act.run();
        } catch {
          // continue smoothly
        }
      }
      await page.waitForTimeout(120);
    }
  }

  // Run any remaining actions
  while (actionIdx < sortedActions.length) {
    try {
      await sortedActions[actionIdx++].run();
    } catch {
      // ignore
    }
  }

  const remaining = totalMs - (Date.now() - start);
  if (remaining > 0) {
    await page.waitForTimeout(remaining);
  }
}

async function main() {
  if (!fs.existsSync(TIMINGS_PATH)) {
    throw new Error(`Missing timings file at ${TIMINGS_PATH}`);
  }
  const timings = JSON.parse(fs.readFileSync(TIMINGS_PATH, "utf8"));
  const videoDir = path.join(TMP_DIR, "raw_video");
  fs.mkdirSync(videoDir, { recursive: true });

  const chromeCandidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter((p) => p && fs.existsSync(p));

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromeCandidates[0],
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 },
    },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(HUD_INIT_SCRIPT);

  const page = await context.newPage();

  // Enrich demo raider account views so the UI displays active balances, weapons, backer shares, and Floor 3 SVG NFT while preserving live protocol RPC views
  await page.route(/(\/api\/rpc|rpc\.testnet\.)/, async (route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      return route.continue();
    }
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      return route.continue();
    }

    const params = body?.params;
    if (body?.method === "query" && params?.request_type === "view_access_key_list") {
      if (params?.account_id === DEMO_ACCOUNT_ID) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              keys: [
                {
                  public_key: DEMO_PUBLIC_KEY,
                  access_key: { nonce: 42, permission: "FullAccess" },
                },
              ],
              block_height: 189500123,
              block_hash: "8fK3x9QpLmN2vR7tY4wZ1cB5nJ6mH8gD3sF4aP9qW2eR",
            },
          }),
        });
      }
    }

    if (body?.method === "query" && params?.request_type === "view_account") {
      if (params?.account_id === DEMO_ACCOUNT_ID) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              amount: "245000000000000000000000", // 0.245 NEAR Silent Gas Tank
              locked: "0",
              code_hash: "11111111111111111111111111111111",
              storage_usage: 540,
              block_height: 189500123,
              block_hash: "8fK3x9QpLmN2vR7tY4wZ1cB5nJ6mH8gD3sF4aP9qW2eR",
            },
          }),
        });
      }
    }

    if (body?.method === "query" && params?.request_type === "call_function") {
      const fn = params?.method_name;
      let args = {};
      try {
        args = JSON.parse(Buffer.from(params.args_base64 || "", "base64").toString("utf8"));
      } catch {
        // ignore
      }

      if (fn === "get_balance" && args?.account_id === DEMO_ACCOUNT_ID) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              result: encodeJsonResult("850000000000000000000000"), // 0.85 NEAR Citadel Pouch
              logs: [],
              block_height: 189500123,
            },
          }),
        });
      }

      if (fn === "get_inventory" && args?.account_id === DEMO_ACCOUNT_ID) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              result: encodeJsonResult({
                weapons: [3, 2, 2],
                starter_locked: [1, 0, 0],
                materials: {
                  "ore:iron": 18,
                  "essence:solar": 9,
                  "essence:frost": 6,
                  "essence:void": 8,
                },
              }),
              logs: [],
              block_height: 189500123,
            },
          }),
        });
      }

      if (fn === "get_backer" && args?.account_id === DEMO_ACCOUNT_ID) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              result: encodeJsonResult({
                shares: "50000000", // 0.50 NEAR staked
                pending_dividend: "42500000000000000000000", // 0.0425 NEAR earned
              }),
              logs: [],
              block_height: 189500123,
            },
          }),
        });
      }

      if (fn === "nft_total_supply") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              result: encodeJsonResult("3"),
              logs: [],
              block_height: 189500123,
            },
          }),
        });
      }

      if (fn === "nft_token") {
        const tid = String(args?.token_id || "1");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? "dontcare",
            result: {
              result: encodeJsonResult({
                token_id: tid,
                owner_id: DEMO_ACCOUNT_ID,
                metadata: {
                  title: `SpireFi Floor 3 Conqueror #${tid}`,
                  description:
                    "Dynamic On-Chain NEP-171 SVG Trophy minted upon slaying Kaelen, Void Sovereign on Floor 3.",
                  media: CONQUEROR_DATA_URI,
                  copies: 1,
                },
              }),
              logs: [],
              block_height: 189500123,
            },
          }),
        });
      }
    }

    return route.continue();
  });

  // Pre-warm landing page before timed choreography
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const recStartMs = Date.now();
  const acts = timings.acts;

  // =========================================================================
  // ACT 1: Landing Hero & Invisible 0.60 NEAR Guest Onboarding
  // =========================================================================
  await runCaptionsOverWindow(
    page,
    {
      badge: "ACT I · INVISIBLE ONBOARDING · ZERO WALLET POPUPS",
      metric: "0.60 NEAR EPHEMERAL SESSION · SPIRE.TESTNET",
      route: "CITADEL GATE (/)",
    },
    [
      "On-chain RPGs usually break in two places: wallet popups scare players away, and static weapon metas drain the economy.",
      "Meet SpireFi on NEAR Testnet — enter the 3D Obsidian Citadel in one click with an auto-funded 0.60 NEAR guest session and silent gas tank.",
    ],
    acts[0].SlotMs,
    [
      {
        atMs: 900,
        run: async () => moveCursorXY(page, 960, 420, true),
      },
      {
        atMs: 3600,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 520, behavior: "smooth" }));
          await moveCursorXY(page, 620, 560, false);
        },
      },
      {
        atMs: 7200,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 1080, behavior: "smooth" }));
          await moveCursorXY(page, 960, 620, true);
        },
      },
      {
        atMs: 10500,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        },
      },
    ]
  );

  // =========================================================================
  // ACT 2: Sanctum Raid — 3-Floor Co-op, 13,500 bps Resistance & Boss Tribute
  // =========================================================================
  await page.goto(`${BASE_URL}/game/raid`, { waitUntil: "domcontentloaded" });
  await runCaptionsOverWindow(
    page,
    {
      badge: "ACT II · SELF-BALANCING BOSS META · 13,500 BPS CONSERVED",
      metric: "SOLAR + FROST + VOID = 13,500 BPS · MAX ±2,500/EPOCH",
      route: "SANCTUM RAID (/game/raid)",
    },
    [
      "Inside the Sanctum Raid, boss resistances adapt to global weapon supply every hour — without developer patches.",
      "Solar, Frost, and Void strictly conserve 13,500 basis points. Over-stacking past 7,000 bps triggers Boss Tribute weapon confiscation.",
    ],
    acts[1].SlotMs,
    [
      {
        atMs: 1200,
        run: async () => moveCursorXY(page, 960, 380, true),
      },
      {
        atMs: 4200,
        run: async () => {
          // Click Floor 2 tab if present
          await moveCursorToSelector(page, 'button:has-text("Floor 2")', true);
        },
      },
      {
        atMs: 7800,
        run: async () => {
          // Click Floor 3 tab if present
          await moveCursorToSelector(page, 'button:has-text("Floor 3")', true);
        },
      },
      {
        atMs: 11200,
        run: async () => {
          // Return to Floor 1 for combat strike (avoid matching header button)
          await moveCursorToSelector(page, 'button:has-text("Floor 1")', true);
        },
      },
    ]
  );

  // =========================================================================
  // ACT 3: Tactical Stance, Silent Combat Strike & Supply-Driven Weapon Forge
  // =========================================================================
  await runCaptionsOverWindow(
    page,
    {
      badge: "ACT III · ZERO-POPUP COMBAT & SUPPLY-DRIVEN FORGING",
      metric: "TICKET SPLIT: 70% JACKPOT · 15% BACKER · 10% BUYBACK · 5% MERCHANT",
      route: "COMBAT & FORGE (/game/raid)",
    },
    [
      "Every raid strike signs silently in the background. Entry tickets split transparently across Jackpot, Backer Vault, Buyback, and Merchant.",
      "Forging or reforging Solar, Frost, and Void weapons immediately updates global supply and shifts next epoch's resistance.",
    ],
    acts[2].SlotMs,
    [
      {
        atMs: 1200,
        run: async () => {
          await moveCursorToSelector(page, 'button:has-text("Pierce"), button:has-text("Aggressive"), button:has-text("Feint")', true);
        },
      },
      {
        atMs: 3800,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 380, behavior: "smooth" }));
          await moveCursorXY(page, 960, 580, true);
        },
      },
      {
        atMs: 7200,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 760, behavior: "smooth" }));
          await moveCursorXY(page, 520, 640, true);
        },
      },
      {
        atMs: 10800,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        },
      },
    ]
  );

  // =========================================================================
  // ACT 4: NPC Material Bazaar (±10% Bonding Curve) + Time-Warp Simulator
  // =========================================================================
  await page.goto(`${BASE_URL}/game/merchant`, { waitUntil: "domcontentloaded" });
  await runCaptionsOverWindow(
    page,
    {
      badge: "ACT IV · DETERMINISTIC NPC BAZAAR · ±10% BONDING CURVE",
      metric: "0.05 NEAR BASE · 100 TARGET STOCK · 1.0 NEAR SOLVENCY FLOOR",
      route: "NPC BAZAAR (/game/merchant)",
    },
    [
      "Need crafting materials? The on-chain NPC Bazaar prices Iron Ore and Essences along a deterministic bonding curve around a 100-unit target.",
      "Players can also drag the interactive Time-Warp Simulator to stress-test market depth, spreads, and resistance shifts in real time.",
    ],
    acts[3].SlotMs,
    [
      {
        atMs: 1400,
        run: async () => moveCursorXY(page, 580, 420, true),
      },
      {
        atMs: 4800,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 520, behavior: "smooth" }));
          await moveCursorXY(page, 1140, 520, true);
        },
      },
      {
        atMs: 8200,
        run: async () => {
          // Interact with range slider in MarketSimulator if visible
          const sliders = page.locator('input[type="range"]');
          if ((await sliders.count()) > 0) {
            await sliders.first().fill("180").catch(() => {});
          }
          await moveCursorXY(page, 980, 640, true);
        },
      },
    ]
  );

  // =========================================================================
  // ACT 5: Backer Vault (15% Yield) & Dynamic On-Chain NEP-171 SVG Trophy NFT
  // =========================================================================
  await page.goto(`${BASE_URL}/game/vault`, { waitUntil: "domcontentloaded" });
  await runCaptionsOverWindow(
    page,
    {
      badge: "ACT V · BACKER VAULT YIELD & ON-CHAIN NEP-171 SVG TROPHY",
      metric: "15% TICKET DIVIDENDS · O(1) SCALED ACCOUNTING · PROCEDURAL SVG NFT",
      route: "TREASURY VAULT (/game/vault)",
    },
    [
      "In the Treasury Vault, liquidity backers earn 15% of every raid ticket via O(1) dividend accounting across rounds.",
      "And conquering Floor Three mints a procedural NEP-171 Trophy NFT — with its SVG artwork rendered 100% on-chain.",
    ],
    acts[4].SlotMs,
    [
      {
        atMs: 1200,
        run: async () => {
          await moveCursorToSelector(page, 'button:has-text("Backer"), [role="tab"]:has-text("Backer")', true);
        },
      },
      {
        atMs: 5200,
        run: async () => {
          await moveCursorToSelector(page, 'button:has-text("Trophies"), button:has-text("Trophy"), [role="tab"]:has-text("Trophies")', true);
          await page.evaluate(() => window.scrollTo({ top: 260, behavior: "smooth" }));
        },
      },
      {
        atMs: 8200,
        run: async () => moveCursorXY(page, 960, 540, true),
      },
    ]
  );

  // =========================================================================
  // ACT 6: Deterministic Epoch Oracle (/game/ai) & Closing Call-to-Action Card
  // =========================================================================
  await page.goto(`${BASE_URL}/game/ai`, { waitUntil: "domcontentloaded" });
  await runCaptionsOverWindow(
    page,
    {
      badge: "ACT VI · DETERMINISTIC EPOCH ORACLE · ZERO AI CREDITS REQUIRED",
      metric: "55/55 AUTOMATED CHECKS · LIVE ON SPIRE.TESTNET",
      route: "EPOCH ORACLE (/game/ai)",
    },
    [
      "Powered by a zero-AI-credit deterministic keeper and verified by 55 automated checks on spire.testnet.",
      "SpireFi proves on-chain games on NEAR can run transparent, self-sustaining economies. Try the live Citadel today!",
    ],
    acts[5].SlotMs,
    [
      {
        atMs: 1200,
        run: async () => moveCursorXY(page, 740, 380, true),
      },
      {
        atMs: 4200,
        run: async () => {
          await page.evaluate(() => window.scrollTo({ top: 440, behavior: "smooth" }));
          await moveCursorXY(page, 1080, 520, true);
        },
      },
      {
        atMs: Math.max(2000, acts[5].SlotMs - 2100),
        run: async () => {
          await page.evaluate(() => {
            if (window.__spireShowOutro) window.__spireShowOutro();
          });
        },
      },
    ]
  );

  const video = page.video();
  await context.close();
  await browser.close();

  const recordedPath = await video.path();
  const outputMeta = {
    recordedPath,
    recStartMs,
    totalElapsedMs: Date.now() - recStartMs,
  };
  fs.writeFileSync(
    path.join(TMP_DIR, "recorded_meta.json"),
    JSON.stringify(outputMeta, null, 2)
  );
  console.log("Recorded raw video:", recordedPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
