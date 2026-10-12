## Účel zmeny
<!-- Čo sa mení, prečo a na aký modul to vplýva? -->

## Riziká, ochrana dát a rollback
- Riziko: low / medium / high / critical
- Komponent:
- Rollback plán:
- Zmeny schémy D1 / R2 / secrets: áno / nie

## AI Change Policy
- Generované AI: áno / nie
- Ak áno, aktualizuj `.github/ai-change.json` a over schema validáciu.
- `reviewed: true` v JSON **nie je dôkazom ľudského review**; platí iba skutočné schválenie od CODEOWNER v GitHube.

## Definition of Done — zaškrtni len s dôkazom
- [ ] Build úspešný (odkaz na Actions run)
- [ ] Testy úspešné (odkaz na Actions run)
- [ ] Lint úspešný alebo označený ako nezavedený
- [ ] TypeScript kontrola úspešná alebo označená ako nezavedená
- [ ] Security / dependency scan úspešný (odkaz na scan)
- [ ] Staging deploy úspešný (URL + skutočné version/commit ID), alebo výslovne N/A
- [ ] Audit receipt vytvorený a dohľadateľný, alebo výslovne N/A
- [ ] CODEOWNER review dokončené v GitHube
- [ ] Revert/rollback postup zdokumentovaný

## Evidencia
- Commit SHA:
- CI run:
- Staging URL:
- Audit receipt:
- Reviewer:
