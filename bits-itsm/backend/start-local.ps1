param(
    [string]$DatabaseUser = 'postgres',
    [string]$DatabaseName = 'bitsolve',
    [switch]$ApplyPendingMigrations
)

$ErrorActionPreference = 'Stop'
$previousJava = $env:JAVA_HOME
$previousPath = $env:Path
$previousPassword = $env:DB_PASSWORD
$previousUser = $env:DB_USER
$previousUrl = $env:DB_URL
$previousPgPassword = $env:PGPASSWORD
$previousDebug = $env:DEBUG
$secret = $null
try {
    $candidates = @($env:JAVA_HOME)
    $extensions = Join-Path $env:USERPROFILE '.vscode\extensions'
    if (Test-Path $extensions) {
        $candidates += Get-ChildItem $extensions -Directory -Filter 'redhat.java-*' |
            Sort-Object LastWriteTime -Descending |
            ForEach-Object { Get-ChildItem (Join-Path $_.FullName 'jre') -Directory -ErrorAction SilentlyContinue } |
            Select-Object -ExpandProperty FullName
    }
    $jdk = $candidates | Where-Object {
        $_ -and (Test-Path (Join-Path $_ 'bin\javac.exe')) -and
        (Test-Path (Join-Path $_ 'release')) -and
        (Select-String -LiteralPath (Join-Path $_ 'release') -Pattern '^JAVA_VERSION="25[."]' -Quiet)
    } | Select-Object -First 1
    if (!$jdk) { throw 'JDK 25 was not found. Set JAVA_HOME to your JDK 25 directory for this terminal.' }
    $env:JAVA_HOME = $jdk
    $env:Path = "$jdk\bin;$env:Path"
    $env:DB_USER = $DatabaseUser
    $env:DEBUG = $null
    if ($DatabaseName -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') { throw 'Use a simple PostgreSQL database name.' }
    $env:DB_URL = "jdbc:postgresql://localhost:5432/$DatabaseName"
    if (!$env:DB_PASSWORD) {
        $secret = Read-Host "PostgreSQL password for $DatabaseUser" -AsSecureString
        $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
    }
    $psql = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin\psql.exe'
    if (!(Test-Path $psql)) { throw 'PostgreSQL 18 psql is required for the migration safety check.' }
    $env:PGPASSWORD = $env:DB_PASSWORD
    $applied = & $psql -X -w -h localhost -p 5432 -U $DatabaseUser -d $DatabaseName -At -v ON_ERROR_STOP=1 -c 'select version from flyway_schema_history where success order by installed_rank'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Flyway history. No application startup or migration was attempted.' }
    $pending = Get-ChildItem (Join-Path $PSScriptRoot 'src\main\resources\db\migration') -Filter 'V*__*.sql' |
        Where-Object { ($_.BaseName -split '__')[0].Substring(1) -notin @($applied) }
    if ($pending -and !$ApplyPendingMigrations) {
        throw "Pending migrations: $($pending.Name -join ', '). Back up and review them first. Use -ApplyPendingMigrations only when you intend to apply them."
    }
    Push-Location $PSScriptRoot
    try {
        & .\mvnw.cmd spring-boot:run
        if ($LASTEXITCODE -ne 0) { throw "Backend exited with code $LASTEXITCODE. See the startup log above." }
    } finally { Pop-Location }
} finally {
    $env:JAVA_HOME = $previousJava
    $env:Path = $previousPath
    $env:DB_PASSWORD = $previousPassword
    $env:DB_USER = $previousUser
    $env:DB_URL = $previousUrl
    $env:PGPASSWORD = $previousPgPassword
    $env:DEBUG = $previousDebug
    if ($secret) { $secret.Dispose() }
}
