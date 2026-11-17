$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$postgresHostPort = "55432"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required. Install Docker Desktop and run this command again."
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "Java 21 is required. Install Java 21 and run this command again."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm is required. Install Node.js 20+ and run this command again."
}

$javaPath = (Get-Command java).Source
$env:JAVA_HOME = Split-Path (Split-Path $javaPath -Parent) -Parent
$env:POSTGRES_PASSWORD = "prowise-dev-password"
$env:POSTGRES_HOST_PORT = $postgresHostPort
$env:DB_URL = "jdbc:postgresql://localhost:$postgresHostPort/prowise"
$env:DB_USERNAME = "prowise"
$env:DB_PASSWORD = "prowise-dev-password"
$env:JWT_SIGNING_KEY = "local-development-signing-key-change-me-32-bytes"

Write-Host "Starting PostgreSQL on port $postgresHostPort..."
docker compose --project-directory $root up -d
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL failed to start."
}

Write-Host "Starting backend on http://localhost:8080..."
$backendProcess = Start-Process `
    -FilePath (Join-Path $backend "mvnw.cmd") `
    -WorkingDirectory $backend `
    -ArgumentList "spring-boot:run" `
    -PassThru

Write-Host "Starting frontend on http://localhost:3000..."
$frontendProcess = Start-Process `
    -FilePath "npm.cmd" `
    -WorkingDirectory $frontend `
    -ArgumentList "run", "dev" `
    -PassThru

Write-Host ""
Write-Host "Prowise is starting:"
Write-Host "  Backend:  http://localhost:8080/v1/health"
Write-Host "  Frontend: http://localhost:3000"
Write-Host "Close this window or press Ctrl+C to stop the application processes."

try {
    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) {
        Start-Sleep -Seconds 2
        $backendProcess.Refresh()
        $frontendProcess.Refresh()
    }
}
finally {
    if (-not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id
    }
    if (-not $frontendProcess.HasExited) {
        Stop-Process -Id $frontendProcess.Id
    }
    docker compose --project-directory $root down
}
