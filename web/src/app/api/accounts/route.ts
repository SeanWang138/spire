import { NextRequest, NextResponse } from "next/server";
import { connect, keyStores, KeyPair, utils } from "near-api-js";

export const dynamic = "force-dynamic";

const DEFAULT_SUBACCOUNT_FUNDING_YOCTO = "600000000000000000000000"; // 0.60 NEAR
const NEAR_YOCTO_DECIMALS = 24;

function nearDecimalToYocto(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = frac
    .padEnd(NEAR_YOCTO_DECIMALS, "0")
    .slice(0, NEAR_YOCTO_DECIMALS);
  const yocto = `${whole}${paddedFrac}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(yocto) > 0n ? yocto : null;
}

function resolveFundingYocto(): string {
  const envYocto = process.env.SUBACCOUNT_FUNDING_YOCTO?.trim();
  if (envYocto && /^\d+$/.test(envYocto)) {
    const normalized = BigInt(envYocto);
    if (normalized > 0n) {
      return normalized.toString();
    }
  }
  const envNear = process.env.AUTO_ACCOUNT_FUNDING_NEAR?.trim();
  if (envNear) {
    const converted = nearDecimalToYocto(envNear);
    if (converted) {
      return converted;
    }
  }
  return DEFAULT_SUBACCOUNT_FUNDING_YOCTO;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_id, public_key } = body;

    if (!account_id || typeof account_id !== "string") {
      return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
    }

    const parentAccountId = (
      process.env.NEAR_PARENT_ACCOUNT_ID ||
      process.env.NEXT_PUBLIC_CONTRACT_ID ||
      "spire.testnet"
    ).trim();
    const parentPrivateKey = (
      process.env.NEAR_PARENT_PRIVATE_KEY ||
      process.env.KEEPER_PRIVATE_KEY ||
      ""
    ).trim();
    const rpcUrl = (
      process.env.NEAR_RPC_URL || "https://rpc.testnet.fastnear.com"
    ).trim();
    const fundingYocto = resolveFundingYocto();

    // If private key is configured (e.g. in Vercel Environment Variables), execute real on-chain creation
    if (parentPrivateKey) {
      try {
        const targetPublicKey = public_key
          ? utils.PublicKey.from(public_key)
          : KeyPair.fromRandom("ed25519").getPublicKey();

        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey(
          "testnet",
          parentAccountId,
          KeyPair.fromString(parentPrivateKey as Parameters<typeof KeyPair.fromString>[0])
        );
        const near = await connect({ networkId: "testnet", nodeUrl: rpcUrl, keyStore } as never);
        const parent = await near.account(parentAccountId);

        await parent.createAccount(account_id, targetPublicKey, BigInt(fundingYocto));

        return NextResponse.json({
          success: true,
          status: "provisioned",
          account_id,
          public_key: targetPublicKey.toString(),
          onchain: true,
          funding_yocto: fundingYocto,
          keyMode: "ephemeral-full-access",
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // If account already exists on-chain, reject with 409 so a new browser session
        // cannot silently bind a mismatched local keypair to an existing account.
        if (errMsg.includes("already exists") || errMsg.includes("AccountAlreadyExists")) {
          return NextResponse.json(
            {
              error: `Account "${account_id}" already exists on-chain. Please choose a different name.`,
            },
            { status: 409 }
          );
        }
        console.error("[API Accounts] On-chain creation error:", err);
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        error: "TESTNET_FAUCET_NOT_CONFIGURED",
        message:
          "Configure NEAR_PARENT_PRIVATE_KEY in environment to provision live testnet accounts.",
      },
      { status: 503 }
    );
  } catch (error: unknown) {
    console.error("[API Accounts] Request parsing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
