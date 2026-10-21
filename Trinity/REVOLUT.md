# Revolut: príjem platieb za služby Trinity

Toto je prvý backendový krok pre jednorazové platby. Nie je to mechanizmus na
zaručený zárobok. Predaj potrebuje konkrétny produkt/službu, cenu a zákazníkov.
Aktuálna implementácia nevytvára verejný obchod, neodosiela zákazníkom správy,
neprideľuje automaticky prístup a neposkytuje nástroje na prevody ani výbery.

Revolut účet zatiaľ nie je pripojený. Typ účtu, predávaný produkt ani živé ceny
neboli potvrdené. Všetky vykonané testy používajú simulované Revolut odpovede.

## Podporovaná cesta

Automatizované prijímanie platieb využíva Revolut Business s Merchant účtom:
[Revolut Merchant – Get started](https://developer.revolut.com/docs/guides/merchant/get-started).
Revolut Pro má vybrané produkty na prijímanie platieb v aplikácii; jeho možnosti
nemožno automaticky považovať za totožné s Merchant API. Osobný účet sa touto
implementáciou nepripája. Pre Pro treba najprv potvrdiť dostupné možnosti účtu.

Server vytvorí objednávku a vráti platobný odkaz, na ktorom zákazník zaplatí
priamo Revolutu. Stav overuje serverovým GET objednávky, nie návratom z prehliadača:
[Hosted Checkout API](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/api).
API kontrakt je pripnutý na `2026-08-17` podľa [Merchant API](https://developer.revolut.com/docs/api/merchant).

## Konfigurácia

Predvolene `REVOLUT_MODE=sandbox`. Testovací produkt `sandbox-test` má 100 centov
EUR a výslovne označuje test bez skutočného predaja. Živé príjmy z neho nevznikajú.
Serverové tajomstvá sa nevracajú v odpovediach a nevkladajú sa do promptov.

| Nastavenie | Význam |
| --- | --- |
| REVOLUT_SANDBOX_SECRET_KEY | Merchant Secret key zo samostatného sandbox účtu |
| REVOLUT_MODE | sandbox alebo production |
| REVOLUT_MERCHANT_SECRET_KEY | Produkčný Merchant Secret key |
| REVOLUT_LIVE_PAYMENTS_ENABLED | Presne true je potrebné pri production |
| REVOLUT_PRODUCTS_JSON | Serverový cenník: pole produktov s id, name, amount_cents, currency |

Príklad formátu cenníka (ukážka, nie schválená živá cena):

```json
[{"id":"sample-service","name":"Ukážková služba","amount_cents":1000,"currency":"EUR"}]
```

Produkčný cenník nemá predvolené produkty. Podporované sú jednorazové EUR
objednávky v rozmedzí 100–1 000 000 centov. Klient nemôže prepísať cenu ani menu.
Sandbox kľúč sa nikdy nepoužíva pre produkčné API a naopak. Prítomnosť kľúča
v konfigurácii ešte nedokazuje jeho platnosť ani schválenie Merchant účtu.

## API dostupné iba vlastníkovi

Všetky cesty vyžadujú existujúcu autentifikovanú owner reláciu Trinity. Bežní
používatelia, samotní administrátori bez owner roly a MCP invoke kľúče nedostávajú
nové platobné oprávnenia. Nepridávajú sa finančné nástroje do verejného chatu/MCP.

| Cesta | Význam |
| --- | --- |
| GET /api/assistant/revolut/status | Režim, dostupnosť konfigurácie a cenník; nie živý test účtu |
| POST /api/assistant/revolut/checkouts | Vytvorenie objednávky z product_id a idempotency_key UUID |
| GET /api/assistant/revolut/payments/:id | Posledný lokálny stav |
| POST /api/assistant/revolut/payments/:id/refresh | Načítanie a kontrola stavu z Revolutu |

Objednávka sa zapíše do samostatnej tabuľky ops_revolut_payments. Existujúca
sandbox peňaženka sa nemení a nikdy sa nepovažuje za bankový zostatok.
`real_money` znamená režim produkčného procesora, nie potvrdenie platby.
`payment_confirmed` znamená iba overený stav completed s outstanding_amount=0.
Nie je to potvrdenie vyplatenia na bankový účet, čistý zisk ani ochrana proti
neskoršiemu refundu/chargebacku. Refundovaná suma sa uvádza samostatne.

## Duplicity, výpadky a overenie

Použi rovnaké idempotency_key pri opakovaní tej istej objednávky. Jedinečnosť
owner+mode+key a INSERT pred externou požiadavkou bránia duplicitnému vytvoreniu
aj pri súbežných požiadavkách. Zmena produktu pod rovnakým kľúčom vráti konflikt.
Revolut create-order sa automaticky neopakuje a nespolieha sa na nepodloženú
podporu Idempotency-Key hlavičky na tomto endpointe.

Po strate odpovede je stav create_unknown. Po prerušení procesu môže zostať
creating. V oboch prípadoch sa požiadavka znovu neodosiela; vlastník musí dohľadať
objednávku v Revolute podľa metadata.trinity_payment_id. Ak sa ID stihlo uložiť,
refresh overí jej stav. Bez vzdialeného ID je potrebná ručná rekonciliácia.
Nedávaj tomu istému neistému nákupu nové UUID.

Overuje sa ID objednávky, typ payment, suma, mena a refundovaná suma. Zamietnutý
alebo chybný response nezaloží potvrdenie úhrady. Povolené checkout hosty sú
obmedzené; HTTP presmerovania API sú zakázané. Odmietnutý checkout odkaz sa nevráti,
ale vzdialené ID zostáva uložené na kontrolu. Webhooky a automatické plnenie nie
sú súčasťou tejto etapy; stav môže byť zastaraný, pokiaľ sa nespustí refresh.

## Overenie a nasadenie

```bash
npm test
```

Testy používajú lokálne D1 a simulovaný Revolut. Pokrývajú aj súbeh, stratu
odpovede, cudzí owner záznam, nesprávnu sumu/menu/typ, nesprávny checkout host,
produkčný režim bez aktivácie a zamietnutie bežného používateľa na API.

Pred nasadením treba aplikovať migráciu 0042_revolut_payments.sql do príslušnej
D1 po zálohe. Samotný Cloudflare Workers Build D1 migrácie automaticky neaplikuje.
Odporúčaný postup je izolovaný sandbox účet → sandbox kľúč → test checkoutu
s testovacou kartou → refresh a kontrola sumy → až potom živá konfigurácia so
schváleným produktom a cenou. Živé platby zatiaľ nie sú zapnuté.

Rollback kódu môže ponechať tabuľku na audit. Nemaž existujúce platobné záznamy
ani neopakuj neurčité objednávky počas návratu verzie.
