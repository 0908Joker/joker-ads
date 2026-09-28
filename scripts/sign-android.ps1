param(
    [Parameter(Mandatory)][string]$Jdk,
    [Parameter(Mandatory)][string]$BuildTools,
    [Parameter(Mandatory)][string]$InputApk,
    [Parameter(Mandatory)][string]$OutputApk,
    [Parameter(Mandatory)][string]$KeyDirectory,
    [switch]$CreateKey
)
$ErrorActionPreference = 'Stop'
$inputFile = (Resolve-Path -LiteralPath $InputApk).Path
$outputFile = [IO.Path]::GetFullPath($OutputApk)
$keyRoot = [IO.Path]::GetFullPath($KeyDirectory)
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($keyRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) -eq $repoRoot -or
    $keyRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Signing keys must be stored outside the repository.'
}
if ($inputFile -eq $outputFile) { throw 'Use a separate signed output file.' }
New-Item -ItemType Directory -Force -Path $keyRoot | Out-Null
$userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $keyRoot /inheritance:r /grant:r "*$($userSid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect the signing directory.' }
$keyFile = Join-Path $keyRoot 'dewu-release.p12'
$passwordFile = Join-Path $keyRoot 'password.dpapi'
$previousPassword = $env:DEWU_APK_PASSWORD
$previousJava = $env:JAVA_HOME
$aligned = $null
try {
    $env:JAVA_HOME = (Resolve-Path -LiteralPath $Jdk).Path
    if (!(Test-Path -LiteralPath $keyFile)) {
        if (!$CreateKey) { throw 'Signing key missing; explicitly use -CreateKey for the first package.' }
        if (Test-Path -LiteralPath $passwordFile) { throw 'Incomplete key directory: recover it before creating another identity.' }
        $randomBytes = New-Object byte[] 32
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        $generator.GetBytes($randomBytes)
        $generator.Dispose()
        $env:DEWU_APK_PASSWORD = [Convert]::ToBase64String($randomBytes)
        $secure = ConvertTo-SecureString $env:DEWU_APK_PASSWORD -AsPlainText -Force
        ConvertFrom-SecureString $secure | Set-Content -LiteralPath $passwordFile -Encoding ascii
        & (Join-Path $Jdk 'bin/keytool.exe') -genkeypair -alias dewu-release -keyalg RSA -keysize 3072 -validity 10000 `
            -dname 'CN=Dewu Android Release' -storetype PKCS12 -keystore $keyFile `
            -storepass:env DEWU_APK_PASSWORD -keypass:env DEWU_APK_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Key generation failed; preserve the key directory for recovery.' }
    } else {
        $secure = ConvertTo-SecureString (Get-Content -LiteralPath $passwordFile -Raw).Trim()
        $env:DEWU_APK_PASSWORD = [Net.NetworkCredential]::new('', $secure).Password
    }
    $outputDirectory = Split-Path -Parent $outputFile
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    $aligned = Join-Path $outputDirectory ('.aligned-' + [Guid]::NewGuid().ToString('N') + '.apk')
    & (Join-Path $BuildTools 'zipalign.exe') -P 16 -f 4 $inputFile $aligned
    if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
    & (Join-Path $BuildTools 'apksigner.bat') sign --ks $keyFile --ks-key-alias dewu-release `
        --ks-pass env:DEWU_APK_PASSWORD --key-pass env:DEWU_APK_PASSWORD --out $outputFile $aligned
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
    $verification = & (Join-Path $BuildTools 'apksigner.bat') verify --verbose --print-certs $outputFile
    if ($LASTEXITCODE -ne 0) { throw 'Signed APK did not verify.' }
    $verification | Set-Content -LiteralPath ($outputFile + '.signature.txt') -Encoding utf8
    $hash = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($outputFile))" | Set-Content -LiteralPath ($outputFile + '.sha256') -Encoding ascii
    Write-Output "Signed and verified: $outputFile"
    Write-Output "SHA-256: $hash"
} finally {
    $env:DEWU_APK_PASSWORD = $previousPassword
    $env:JAVA_HOME = $previousJava
    if ($aligned -and (Test-Path -LiteralPath $aligned)) { Remove-Item -LiteralPath $aligned }
}
