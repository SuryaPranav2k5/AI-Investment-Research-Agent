# zip-project.ps1
# Run this script to generate a clean, lightweight ZIP archive for submission.
# It automatically excludes heavy folders like node_modules, .next, and .cache.

$SubFiles = @(
    ".env.example",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "README.md",
    "Setting Up Investment Agent App.md",
    "src",
    "public"
)

$DestPath = "../investment-agent-submission.zip"

Write-Host "Creating submission ZIP archive at: $DestPath..." -ForegroundColor Cyan

if (Test-Path $DestPath) {
    Remove-Item $DestPath -Force
}

Compress-Archive -Path $SubFiles -DestinationPath $DestPath -Force

Write-Host "Archive created successfully! Size: $((Get-Item $DestPath).Length / 1KB) KB" -ForegroundColor Green
Write-Host "You can find the zip file in the parent directory: $(Resolve-Path $DestPath)" -ForegroundColor Yellow
