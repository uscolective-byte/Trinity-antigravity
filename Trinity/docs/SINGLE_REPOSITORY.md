# Jeden zdroj pre produkciu Trinity

Kanonický zdroj je [Trinity Antigravity](https://github.com/uscolective-byte/Trinity-antigravity) vo vetve **main**. Produkčný Worker vychádza z adresára [Trinity](../).

| Doména | Prostredie Wrangler | Worker |
| --- | --- | --- |
| auru.space | Bez pomenovaného prostredia | `trinity` |
| auru.dev | Bez pomenovaného prostredia | `trinity` |

Obe domény majú spoločnú produkčnú konfiguráciu v [wrangler.jsonc](../wrangler.jsonc). Overenie vývojovej verzie rob lokálne alebo v oddelenom testovacom nasadení s vlastnými dátami a prístupmi.

## Príprava vydania

1. Over zdrojový commit na GitHube a výsledky testov.
2. Produkčný [workflow](../../.github/workflows/self-deploy.yml) spúšťa vetva `main`. Sleduj konkrétny beh workflowu.
3. Pred prípadnou migráciou D1 identifikuj databázu a vytvor zálohu. Postup je v [prevádzkovom návode](../../docs/runbooks/deploy-and-migrate.md).
4. Po nasadení over pripravenosť a značku commitu na oboch doménach.

Z koreňa čistého checkoutu stiahni projektové závislosti a spusti:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build:worker
```

Po nasadení spusti z koreňa:

```powershell
$releaseCommit = git rev-parse HEAD
node Trinity/scripts/verify-deployment.mjs https://auru.space $releaseCommit
node Trinity/scripts/verify-deployment.mjs https://auru.dev $releaseCommit
```

Pri každej externej integrácii over samostatnú autorizovanú akciu. Do záznamu vydania ulož celý commit SHA, ID verzie Workera, čas a výsledky overenia.
