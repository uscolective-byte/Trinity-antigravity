# Skript na bezpečné uloženie META_APP_SECRET do Cloudflare Worker secrets
# Hodnota sa zadáva ako SecureString (hviezdičky na obrazovke), nezapisuje sa do logov ani git repozitára.

Write-Host "=== TRinity Meta App Secret Setup ===" -ForegroundColor Cyan
Write-Host "Tento skript bezpečne uloží App Secret pre aplikáciu 1105151122389213." -ForegroundColor Gray
Write-Host "Zadaj Meta App Secret z portálu developers.facebook.com (App Settings > Basic):" -ForegroundColor Yellow

$SecureSecret = Read-Host -AsSecureString "Meta App Secret"
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureSecret)
$PlainSecret = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

if ([string]::IsNullOrWhiteSpace($PlainSecret)) {
    Write-Host "Chyba: Zadaný reťazec bol prázdny. Tajomstvo nebolo zmenené." -ForegroundColor Red
    exit 1
}

Push-Location "C:\Users\saboi\Trinity-antigravity\Trinity"
try {
    Write-Host "Ukladám tajomstvo do Cloudflare..." -ForegroundColor Cyan
    $PlainSecret | npx wrangler secret put META_APP_SECRET
    Write-Host "Úspech: META_APP_SECRET bol bezpečne uložený do produkčného workera trinity." -ForegroundColor Green
} finally {
    $PlainSecret = $null
    Pop-Location
}
