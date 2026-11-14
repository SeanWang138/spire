# SpireFi — Official NEAR Hackathon X (Twitter) Demo Post Kit

> **Submission Checklist (`HACKATHON.md` Section 2):**
> - Attach video: [`docs/demo/spirefi-hackathon-demo.mp4`](file:///d:/Project/Near/spirefi/docs/demo/spirefi-hackathon-demo.mp4) (`1920×1080` H.264 + AAC with English Neural Voice-Over & Cinema HUD Captions)
> - Required tags included: `@NEARProtocol` and `#NEARHackathon`
> - Community amplification tags included: `@NearLegion` and `@NearBuilders`
> - Public Repository URL included: `https://github.com/SeanWang138/SpireFi`

---

## Option 1 — Main Demo Post (Recommended, Concise & High-Impact)

```text
Most on-chain RPGs fail in two places: wallet popups kill onboarding, and static weapon metas drain the economy.

We built SpireFi at NEAR HACKATHON — a 3-floor co-op Citadel RPG on spire.testnet with a self-balancing on-chain economy:

⚔️ 1-click 0.60 NEAR guest session & silent gas tank (zero wallet popups)
🛡️ Boss resistances conserve 13,500 bps across Solar/Frost/Void & shift hourly from global weapon supply
⚖️ Deterministic NPC Material Bazaar (±10% bonding curve) + O(1) Backer Vault yield (15% of raid tickets)
🏆 Dynamic NEP-171 SVG Trophy NFTs rendered 100% on-chain on Floor 3 kill

Built on @NEARProtocol for #NEARHackathon (@NearLegion @NearBuilders)

Repo & 5-min Judge Quickstart:
https://github.com/SeanWang138/SpireFi

Which elemental meta would you stack first — Solar, Frost, or Void? 👇
```

---

## Option 2 — Reply Thread (Optional Technical Follow-up Tweet)

```text
How NEAR makes SpireFi's economic loop possible under the hood:

1/ Ephemeral Testnet Guest Subaccounts (`<raider>.spire.testnet`) auto-fund 0.60 NEAR (`claim_starter` + 0.35 NEAR Citadel Pouch + ~0.245 NEAR Silent Gas Tank) so every combat strike & forge action signs in <1.5s without popups.

2/ Every raid ticket (0.10 / 0.15 / 0.25 NEAR) splits atomically on-chain:
• 70% Floor Jackpot (90% damage pro-rata + 10% kill bonus)
• 15% Backer Vault (`1e18`-scaled O(1) dividend accumulator)
• 10% Floor Weapon Buyback Pool
• 5% NPC Merchant Cash Reserve

3/ Zero external AI credits required: our deterministic `epoch-only` keeper settles hourly resistance shifts (`max ±2,500 bps/epoch`) and streams live NEP-297 events over WebSocket.

Verify live on `spire.testnet`:
https://github.com/SeanWang138/SpireFi
```

