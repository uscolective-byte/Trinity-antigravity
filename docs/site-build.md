# Dokumentačný web — lokálny build

MkDocs konfigurácia je v koreňovom mkdocs.yml a závislosť v requirements-docs.txt. Build sa vykonáva v izolovanom Python virtual environment; MkDocs sa nepridáva do runtime závislostí Trinity.

## Inštalácia a build — Windows

~~~powershell
python -m venv .venv-docs
$py = '.venv-docs/Scripts/python.exe'
& $py -m pip install -r requirements-docs.txt
if ($LASTEXITCODE -ne 0) { throw 'DOCS_DEPENDENCIES_FAILED' }
& $py -m mkdocs build --strict
if ($LASTEXITCODE -ne 0) { throw 'DOCS_BUILD_FAILED' }
~~~

## Inštalácia a build — Bash

~~~bash
python3 -m venv .venv-docs
. .venv-docs/bin/activate
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict
~~~

## Lokálny preview

~~~powershell
& .venv-docs/Scripts/python.exe -m mkdocs serve --dev-addr 127.0.0.1:8008
~~~

Build generuje statický web do site/. Výstupný adresár site/ sa nemá commitovať, ak repo politika neurčuje inak. Vyhľadávanie zabezpečuje MkDocs search plugin.
