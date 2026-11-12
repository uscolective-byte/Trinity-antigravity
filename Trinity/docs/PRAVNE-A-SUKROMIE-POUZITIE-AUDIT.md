# Trinity — právny a súkromný súlad: podklady, nie garancia

**Stav:** interný auditný register a návrh na dokončenie. Tento súbor ani verejná právna stránka nie sú právnym stanoviskom a samy osebe nedokazujú súlad.

## Zistenia z existujúcich textov

Súčasné texty v `Trinity/src/compliance-shield.js` a `Trinity/docs/GDPR-VYHLASENIE-A-SUHLAS.md` uvádzajú konkrétne právne základy, retenčné lehoty, bezpečnostné vlastnosti, kontakty, práva ku generovaným výstupom a limity zodpovednosti. Tieto tvrdenia treba doložiť alebo opraviť: zdrojový kód sám nedokazuje skutočnú konfiguráciu, retenčnú dobu, zmluvné postavenie, účtovnú povinnosť, rozsah DPA, export/výmaz všetkých kópií, ani to, že súhlas je vhodným právnym základom každej operácie.

Pred zverejnením nového záväzného znenia vlastník musí potvrdiť právne meno a adresu prevádzkovateľa, kontaktnú adresu, či je určený DPO, publikum a B2C/B2B režim, ceny/platby/refundácie, obchodné podmienky, geografické cielenie, poskytovateľov a zmluvy. Neznáme fakty sú zámerne označené ako blokujúce údaje, nie doplnené odhadom.

## GDPR a slovenský zákon

Pre každý účel spracúvania treba viesť záznam: kategórie údajov a osôb, účel, samostatný právny základ, príjemcov/sprostredkovateľov, transfery, lehotu alebo kritériá výmazu a bezpečnostné opatrenia. Súhlas je len jeden z právnych základov a musí byť slobodný, konkrétny, informovaný, jednoznačný a odvolateľný; nesmie nahrádzať zmluvu, zákonnú povinnosť alebo oprávnený záujem bez analýzy. Overiť oznamovaciu povinnosť podľa čl. 13/14, práva, lehoty odpovedí, proces overenia identity, spracovateľské zmluvy podľa čl. 28, zabezpečenie podľa čl. 32, incidentový proces a posúdenie DPIA/DPO podľa čl. 35/37.

Zákon SR č. 18/2018 Z. z. uplatniť spolu s GDPR a aktuálnym znením slovenských predpisov. Neuvádzať konkrétne retenčné doby (napr. 90/365 dní alebo 10 rokov) bez mapy dát a právneho potvrdenia. Neuvádzať absolútne tvrdenia typu „žiadny prenos“, „žiadna telemetria“, „všetky údaje sú šifrované“ bez technického a zmluvného dôkazu.

## Poskytovatelia, transfery a cookies

Zostaviť skutočný register providerov podľa produkčných bindingov a účtov: Cloudflare, modelové API (ak sú zapnuté), Google OAuth/AI, GitHub, Microsoft, Meta, Telegram, e-mailová služba a ďalšie aktívne konektory. Pri každom potvrdiť rolu, spracúvané údaje, región, DPA, subprocesorov, retenčné/mazacie možnosti a prenos mimo EHP a použitú záruku. Nevyvodzovať aktívne používanie len z názvu konektora v UI.

Inventarizovať cookies, local/session storage, analytics, pixel a podobné identifikátory. Ak sa používajú nevyhnutné/voliteľné technológie, navrhnúť informovanie a súhlas podľa príslušnej ePrivacy a slovenskej úpravy; overiť správanie pri odmietnutí a odvolaní. Súčasné neoverené tvrdenie o „nulovej telemetrii“ odstrániť, kým nie je doložené.

## AI Act a AI používanie

Zmapovať konkrétny účel, používateľov, deployera/provider rolu, rozhodovacie dopady, ľudský dohľad, logovanie, transparentnosť a zakázané/high-risk use cases. AI Act má fázované uplatňovanie; neoznačovať Trinity všeobecne ako „v súlade“ bez klasifikácie a povinností pre konkrétne funkcie. K 12. 11. 2026 sa aplikovateľnosť jednotlivých ustanovení určuje podľa prechodných ustanovení nariadenia (EÚ) 2024/1689, nie marketingovým tvrdením o všeobecnom HITL.

## Spotrebiteľské a duševné vlastníctvo

Ak službu kupujú spotrebitelia, právnik musí preveriť slovenské transpozičné predpisy k digitálnemu obsahu a službám, predzmluvné informácie, cenu, dodanie, súlad, aktualizácie, odstúpenie/ukončenie a nápravu. Všeobecná klauzula „as-is“ nemôže odňať kogentné práva spotrebiteľa. Licencia musí rozlíšiť Trinity kód a závislosti, user content, AI výstup, tretie strany a osobitné podmienky modelových providerov; nesľubovať výlučné vlastníctvo AI výstupu bez právneho základu.

## Vykonávací zoznam

1. Vlastník doplní identitu, kontakty, obchodný model, cieľové krajiny a B2C/B2B rozsah.
2. Technický správca vytvorí skutočnú dátovú mapu a register aktívnych spracovateľov/transferov.
3. Určí sa právny základ a retenčné pravidlá pre každý účel; vykoná sa LIA/DPIA screening.
4. Overia sa funkčné procesy prístup/oprava/výmaz/obmedzenie/export/námietka/sťažnosť a incidenty.
5. Pripravia sa DPA, zmluvy, spotrebiteľské informácie, licenčné podmienky a ePrivacy oznámenia.
6. Slovenský právnik skontroluje finálne znenia. Až potom sa odstráni tento návrhový status a dátum účinnosti sa nastaví na skutočný deň zverejnenia.

## Oficiálne zdroje (kontrolované 12. 11. 2026)

- GDPR, nariadenie (EÚ) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/
- Slovenský Úrad na ochranu osobných údajov, právny základ a zákon č. 18/2018 Z. z.: https://dataprotection.gov.sk/files/metod-urad/6/zakonnost_aktualizovana_verzia_22-01-2019.pdf
- AI Act, nariadenie (EÚ) 2024/1689: https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng
- Digitálny obsah a služby, smernica (EÚ) 2019/770: https://eur-lex.europa.eu/eli/dir/2019/770/oj

Pred produkčným zverejnením znovu overiť aktuálne konsolidované znenie a vnútroštátnu transpozíciu.
