# Konsolidácia repozitárov Trinity — 31.10.2026

## Potvrdená história

Kanonický repozitár: https://github.com/uscolective-byte/Trinity-antigravity
Historický: https://github.com/uscolective-byte/trinity-morhfeus

Porovnanie GitHub commitov k dátumu auditu:
- Starý `trinity-morhfeus/main` HEAD: `c0a808b174109f9a1b55250705d23e982c44019d`.
- Kanonický `Trinity-antigravity/main` HEAD: `910204984d9e82945811bd3142850f2fab11be2e`.
- GitHub compare v kanonickom repozitári: status `ahead`,
  40 commitov ahead, 0 behind, merge base = starý HEAD.
- **Hlavnú vetvu netreba znovu mergovať:** jej obsah je už súčasťou
  kanonického repozitára. Nezačínať history rewrite, force push ani
  masový cherry-pick 40 commitov.

## Rozpracované funkcie — individuálne posúdenie

- Starý repo PR #68: read-only WordPress connector; preveriť oddelený
  `Trinity/services/wordpress-connector.js`, testy a integračný dispatcher.
- Starý repo PR #51: ChatGPT ↔ Copilot Studio shared-notes bridge;
  porovnať s novým Trinity-antigravity PR #15 a nezduplikovať OAuth.
- Starý repo PR #64: Streetline UI; konfliktné so súčasným Omni-Dev chat
  a neoverenou browser QA.
- Starý repo PR #53: wallet/domain truth + UI; vybrať iba otestované
  nekonfliktné opravy.
- Starý repo PR #46: starý UI/runtime restore; neprenášať wholesale.
- Kanonický repo PR #14: Marketplace; PR #15: Microsoft/Graph;
  PR #13: Telegram; PR #22: secrets/release/konfigurácia. Nie sú zlúčené.

## Nasadzovanie a autorizácia

Po prechode testami sa produkčný release vydáva **iba** z kanonického
`main`, staging cez `--env staging`. Starý repo musí prestať byť
produkčným deploy zdrojom; pred archiváciou overiť všetky webhooky,
GitHub Actions, Vercel project mappings a Cloudflare Workers Builds.
Pri tejto kontrole nebol starý repozitár archivovaný ani zmazaný.
Nenahrádzať chýbajúce secrets tokenmi z iného prostredia.

## Kritériá úspechu

1. Kanonické GitHub CI a CodeQL fungujú a majú použiteľné logy.
2. `npm run docs:check` existuje; release docs opisujú obe domény.
3. `scripts/source-policy.mjs` nepripustí legacy origin pre sync/deploy.
4. Evolution Engine defaultne mieri na kanonický repozitár.
5. Všetky prenášané PR majú vlastné testy a presné commity.
6. Cloudflare /health a /ready potvrdia deployed SHA, prostredie a version ID.
