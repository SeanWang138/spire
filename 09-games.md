# 09. Games With Real Economies

**Track id:** `games` · **Tagline:** The economy is the gameplay

Build NPCs with wallets, player-owned markets and economies that evolve without a dev patch. Judges score the game loop, with a bonus if players never notice the chain.

**Lean on:** Agent NPCs, social login, NEAR Intents, NEP-245

## Start here

- [NEP-245 multi token standard](https://github.com/near/NEPs/blob/master/neps/nep-0245.md)
- [near-dapp agent skill](https://github.com/near/agent-skills/tree/main/skills/near-dapp)
- [What are intents](https://docs.near-intents.org/getting-started/what-are-intents)

## Prompt

```text
Track: Games With Real Economies (id: games).

Build [a market-town game]. Players gather materials and trade with NPC merchants. Each merchant is an agent with its own wallet and inventory, and sets prices from its stock and recent demand. If players flood the market with iron, iron gets cheap. If a merchant goes broke, it closes its shop until someone invests in it.

Requirements:
- Items are NEP-245 multi tokens, so one contract holds every item type.
- Players sign in with a social or email login. No seed phrases, no wallet popups, no gas prompts in the normal game loop.
- Merchant pricing rules live in one readable file. Show a merchant's reasoning in a tooltip.
- A fast-forward mode that simulates a week of trading in a minute, so judges can watch the economy move.

Design the game loop on paper first: what the player does every 30 seconds, every 5 minutes and every session. Show me that before any code.
```
