$f$srcPath = "C:\Users\Fabian Napoles\tiempolibre-appweb\artifacts\delivery-saas\src"
$files = Get-ChildItem -Path $srcPath -Recurse -File | Where-Object { $_.Extension -eq ".tsx" -or $_.Extension -eq ".ts" }
$totalFiles = 0

foreach ($file in $files) {
    $original = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $content = $original
    
    # Reemplazos
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â", "—"
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â¢", "•"
    $content = $content -replace "Ãƒâ€šÃ‚Â¡", "¡"
    $content = $content -replace "Ãƒâ€šÃ‚Â¿", "¿"
    $content = $content -replace "ÃƒÂ¡", "á"
    $content = $content -replace "ÃƒÂ©", "é"
    $content = $content -replace "ÃƒÂ­", "í"
    $content = $content -replace "ÃƒÂ³", "ó"
    $content = $content -replace "ÃƒÂº", "ú"
    $content = $content -replace "ÃƒÂ±", "ñ"
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $totalFiles++
        Write-Host ("Corregido: " + $file.Name) -ForegroundColor Green
    }
}

Write-Host ("Total: " + $totalFiles) -ForegroundColor Yellowiles = Get-ChildItem "artifacts\api-server\src" -Recurse -Filter "*.ts" | Select-String -Pattern "Ã|Â" | Select-Object -ExpandProperty Path -Unique; foreach ($file in $files) { $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8); $c = $c.Replace("Ã³", "ó").Replace("Ã­", "í").Replace("Ã©", "é").Replace("Ã¡", "á").Replace("Ã±", "ñ").Replace("Ãº", "ú").Replace("Ã¼", "ü").Replace("Â©", "©").Replace("Â¿", "¿").Replace("Â¡", "¡"); [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8); Write-Host "Corregido: $file" }
