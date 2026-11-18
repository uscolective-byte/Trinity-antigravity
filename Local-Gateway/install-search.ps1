$ErrorActionPreference='Stop'
if(-not [Environment]::Is64BitOperatingSystem){throw 'Ripgrep installer supports Windows x64.'}
$version='15.2.0'
$expected='71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5'
$destination=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "Trinity/tools/ripgrep/$version"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$archive=Join-Path $destination 'ripgrep.zip'
if(!(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){
 Invoke-WebRequest "https://github.com/BurntSushi/ripgrep/releases/download/$version/ripgrep-$version-x86_64-pc-windows-msvc.zip" -OutFile $archive
}
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Official archive checksum mismatch.'}
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
$binary=Join-Path $destination "ripgrep-$version-x86_64-pc-windows-msvc/rg.exe"
& $binary --version
if($LASTEXITCODE -ne 0){throw 'Installed search binary failed its version check.'}
