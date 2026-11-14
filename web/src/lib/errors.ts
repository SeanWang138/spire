export interface FormattedContractError {
  title: string;
  message: string;
  recoveryHref?: string;
  recoveryLabel?: string;
  isStaleKey?: boolean;
}

const RAW_RPC_URL_RE = /https?:\/\/[^\s"'<>]+/gi;

function extractRawMessage(err: unknown): string {
  if (!err) return "Unknown transaction error.";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const anyErr = err as Error & { type?: string; kind?: unknown };
    const extra = anyErr.kind ? ` ${JSON.stringify(anyErr.kind)}` : "";
    return `${err.message}${extra}`.trim();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Translates raw NEAR / contract panics and RPC failures into clear in-world copy
 * with actionable recovery paths — never leaking internal RPC URLs or raw JSON panics.
 */
export function formatContractError(err: unknown): FormattedContractError {
  const raw = extractRawMessage(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("no matching key pair") ||
    lower.includes("can not sign transactions") ||
    lower.includes("unknown_account") ||
    lower.includes("does not exist while viewing")
  ) {
    return {
      title: "Session Key Unavailable",
      message:
        "The saved browser key for this guest subaccount does not match an active key on NEAR Testnet (or the account expired/reset). Clear this stale session to forge a fresh subaccount.",
      recoveryHref: "/game/start",
      recoveryLabel: "Reset & Create Fresh Raider",
      isStaleKey: true,
    };
  }

  if (raw.includes("E_NO_SESSION")) {
    return {
      title: "Guest Account Required",
      message: "Forge a 1-click guest subaccount before executing on-chain actions.",
      recoveryHref: "/game/start",
      recoveryLabel: "Create Guest Account",
    };
  }

  if (raw.includes("E_NOTHING_TO_CLAIM")) {
    return {
      title: "Nothing Ready to Claim",
      message:
        "No completed boss jackpots or seized weapons are claimable for this account yet. Defeat a floor boss first.",
      recoveryHref: "/game/raid",
      recoveryLabel: "Enter Spire Raid",
    };
  }

  if (raw.includes("E_INSUFFICIENT_BALANCE")) {
    return {
      title: "Citadel Pouch Too Low",
      message:
        "Your Citadel Pouch balance is too low for this raid ticket or merchant purchase. Top up your Pouch in Vault.",
      recoveryHref: "/game/vault?tab=pouch",
      recoveryLabel: "Top Up Citadel Pouch",
    };
  }

  if (raw.includes("E_COOLDOWN")) {
    return {
      title: "Altar Cooling Down",
      message: "The gathering altar requires 30 seconds between harvests.",
    };
  }

  if (raw.includes("E_EPOCH_CAP") || /\bE_CAP\b/.test(raw)) {
    return {
      title: "Hourly Epoch Cap Reached",
      message:
        "You reached the per-epoch cap for this action. Wait for the next hourly epoch rollover or continue in Raid.",
    };
  }

  if (raw.includes("E_ALREADY_CLAIMED")) {
    return {
      title: "Starter Already Claimed",
      message: "This guest account already holds its starter weapons and materials.",
    };
  }

  if (raw.includes("E_PAYOUT_CLAIMED")) {
    return {
      title: "Already Claimed",
      message: "Rewards for this floor round were already claimed by your account.",
    };
  }

  if (raw.includes("E_INSUFFICIENT_ITEM")) {
    return {
      title: "Missing Materials or Gear",
      message:
        "You do not hold enough ore, essence, or unlocked non-starter weapons for this recipe.",
      recoveryHref: "/game/forge",
      recoveryLabel: "Return to Forge",
    };
  }

  if (
    raw.includes("E_SHOP_CLOSED") ||
    raw.includes("E_MERCHANT_CLOSED")
  ) {
    return {
      title: "Merchant Reserve Paused",
      message:
        "The NPC Merchant cash reserve is below its 1.0 NEAR minimum buffer. Wait for raid ticket inflows before trading.",
    };
  }

  if (raw.includes("E_OUT_OF_STOCK")) {
    return {
      title: "Merchant Out of Stock",
      message: "The NPC Merchant has fewer units in stock than requested. Lower your quantity or sell supplies instead.",
    };
  }

  if (raw.includes("E_VOLUME_CAP")) {
    return {
      title: "Epoch Volume Cap Reached",
      message:
        "This item or buyback channel hit its hourly epoch quota (40 buys/item or 5 floor / 2 account buybacks per epoch).",
    };
  }

  if (raw.includes("E_RESERVE_LOW") || raw.includes("E_MERCHANT_INSUFFICIENT_CASH")) {
    return {
      title: "Pool Reserve Too Low",
      message:
        "The target buyback, merchant, or dividend pool lacks sufficient liquidity for that payout right now.",
    };
  }

  if (raw.includes("E_INVALID_ARGS")) {
    return {
      title: "Invalid Action Parameters",
      message: "Check your selected quantity, floor, or NEAR amount and try again.",
    };
  }

  if (/E_FLOOR_LOCKED|E_ROUND_LOCKED|floor is locked/i.test(raw)) {
    return {
      title: "Floor Locked",
      message: "Defeat the preceding floor boss before attacking or selling to this floor.",
    };
  }

  if (raw.includes("E_NO_WEAPON")) {
    return {
      title: "No Weapon Available",
      message:
        "You hold 0 weapons of the selected element. Forge a weapon or pick an equipped element.",
      recoveryHref: "/game/forge",
      recoveryLabel: "Open Forge",
    };
  }

  if (raw.includes("E_SAME_EPOCH")) {
    return {
      title: "Epoch Shift Cooling Down",
      message: "The current hourly epoch resistance shift is already active on-chain.",
    };
  }

  if (
    raw.includes("E_REPLAY_DETECTED") ||
    raw.includes("E_INVALID_PROPOSAL") ||
    raw.includes("E_EXCEEDS_MAX_SHIFT") ||
    raw.includes("E_UNAUTHORIZED")
  ) {
    return {
      title: "Relayer Proposal Guard Triggered",
      message:
        "An administrative keeper or signed AI proposal was rejected by on-chain authorization, nonce replay, or safety bounds.",
    };
  }

  if (raw.includes("RESERVE_CHECK_UNAVAILABLE")) {
    return {
      title: "Reserve Guard Busy",
      message:
        "Faucet creation paused momentarily because live contract reserve views could not be verified on NEAR RPC. Please retry shortly.",
    };
  }

  if (raw.includes("FAUCET_RESERVE_FLOOR_REACHED") || raw.includes("FAUCET_EMPTY")) {
    return {
      title: "Citadel Gates Resting",
      message:
        "Testnet guest provisioning is temporarily paused to protect active jackpot reserves. Import an existing Recovery Key or retry shortly.",
    };
  }

  if (raw.includes("ACCOUNT_EXISTS") || lower.includes("already taken")) {
    return {
      title: "Name Already Taken",
      message: "That subaccount handle is already claimed on NEAR Testnet. Pick another name.",
    };
  }

  if (raw.includes("429") || lower.includes("rate limit") || lower.includes("too many")) {
    return {
      title: "Provisioning Cooldown",
      message:
        "Too many guest accounts were created recently from this network. Wait a little while or restore an existing key.",
    };
  }

  if (
    raw.includes("VIEW_UNAVAILABLE") ||
    raw.includes("RELAYER_UNAVAILABLE") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("timeout")
  ) {
    return {
      title: "NEAR Testnet RPC Busy",
      message:
        "Testnet nodes are temporarily slow or unreachable. Retrying across backup endpoints failed—please try again in a few seconds.",
    };
  }

  const sanitized = raw
    .replace(RAW_RPC_URL_RE, "[testnet-node]")
    .replace(/\{"index":\d+.*"Smart contract panicked: panicked at [^:]+:\d+:\d+:\\n([^"]+)"\}+/g, "$1")
    .trim();

  const clipped = sanitized.length > 220 ? `${sanitized.slice(0, 217)}...` : sanitized;
  return {
    title: "Transaction Rejected",
    message: clipped || "The action could not be confirmed on NEAR Testnet.",
  };
}

export function formatContractErrorMessage(err: unknown): string {
  const formatted = formatContractError(err);
  return `${formatted.title}: ${formatted.message}`;
}
