$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "Java 21 is required. Install Java 21 and run this command again."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm is required. Install Node.js 20+ and run this command again."
}

$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
# Secrets (database, JWT, SMTP) are read by the backend from backend/.env (git-ignored); they are never set here,
# because environment variables would override that file. Copy backend/.env.example to backend/.env first.
if (-not (Test-Path (Join-Path $backend ".env"))) {
    throw "backend/.env is missing. Copy backend/.env.example to backend/.env and fill in your values."
}
$env:API_BACKEND_URL = "http://localhost:8080"

$postgresService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if (-not $postgresService) {
    throw "PostgreSQL Windows service 'postgresql-x64-18' was not found."
}
if ($postgresService.Status -ne "Running") {
    Write-Host "Starting PostgreSQL service..."
    Start-Service -Name "postgresql-x64-18"
}

Write-Host "Starting backend on http://localhost:8080..."
$backendProcess = Start-Process `
    -FilePath (Join-Path $backend "mvnw.cmd") `
    -WorkingDirectory $backend `
    -ArgumentList "spring-boot:run", "-Dspring-boot.run.arguments=--server.port=8080" `
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
}
