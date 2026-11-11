import { NextRequest, NextResponse } from "next/server";
import { connect, keyStores, KeyPair, utils } from "near-api-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_id, public_key } = body;

    if (!account_id || typeof account_id !== "string") {
      return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
    }

    const parentAccountId =
      process.env.NEAR_PARENT_ACCOUNT_ID ||
      process.env.NEXT_PUBLIC_CONTRACT_ID ||
      "spire.testnet";
    const parentPrivateKey =
      process.env.NEAR_PARENT_PRIVATE_KEY ||
      process.env.KEEPER_PRIVATE_KEY ||
      "";
    const rpcUrl =
      process.env.NEAR_RPC_URL || "https://rpc.testnet.fastnear.com";
    const fundingYocto =
      process.env.SUBACCOUNT_FUNDING_YOCTO || "100000000000000000000000"; // 0.1 NEAR

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
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // If account already exists on-chain, treat as success/confirmed
        if (errMsg.includes("already exists") || errMsg.includes("AccountAlreadyExists")) {
          return NextResponse.json({
            success: true,
            status: "provisioned",
            account_id,
            onchain: true,
            note: "Account already exists on testnet",
          });
        }
        console.error("[API Accounts] On-chain creation error:", err);
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
    }

    // Preview / Sandbox fallback when NEAR_PARENT_PRIVATE_KEY is not yet populated
    return NextResponse.json({
      success: true,
      status: "provisioned",
      account_id,
      public_key: public_key || "ed25519:mock_preview_key",
      onchain: false,
      message: "Preview mode provisioned. Configure NEAR_PARENT_PRIVATE_KEY in environment for live on-chain sub-account creation.",
    });
  } catch (error: unknown) {
    console.error("[API Accounts] Request parsing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
