# ============================================
# CORRECCION DE CARACTERES CORRUPTOS - VERSION 2
# ============================================

$srcPath = "C:\Users\Fabian Napoles\tiempolibre-appweb\artifacts\delivery-saas\src"

Write-Host "Buscando archivos .tsx y .ts..." -ForegroundColor Cyan

$files = Get-ChildItem -Path $srcPath -Recurse -File | Where-Object { 
    $_.Extension -eq ".tsx" -or $_.Extension -eq ".ts" 
}

$totalFiles = 0

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $original = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # Convertir bytes a texto para buscar patrones
    $content = $original
    
    # Reemplazos basados en los patrones reales de tu app
    # Estos son los textos corruptos exactos que vi en tu output
    
    # Patrones de doble encoding (UTF-8 interpretado como Latin-1 dos veces)
    
    # "Sin plan" y guiones largos
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â", "—"
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â¢", "•"
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦", "…"
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°Ã‚Â¥", "≥"
    $content = $content -replace "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°", "≥"
    
    # Signos de exclamacion e interrogacion
    $content = $content -replace "Ãƒâ€šÃ‚Â¡", "¡"
    $content = $content -replace "Ãƒâ€šÃ‚Â¿", "¿"
    
    # Vocales con tilde (triple encoding)
    $content = $content -replace "ÃƒÂ¡", "á"
    $content = $content -replace "ÃƒÂ©", "é"
    $content = $content -replace "ÃƒÂ­", "í"
    $content = $content -replace "ÃƒÂ³", "ó"
    $content = $content -replace "ÃƒÂº", "ú"
    $content = $content -replace "ÃƒÂ", "ú"
    
    # Vocales mayusculas
    $content = $content -replace "ÃƒÂ", "Ú"
    $content = $content -replace "Ãƒâ€œ", "Ó"
    $content = $content -replace "ÃƒÂ", "Á"
    $content = $content -replace "Ãƒâ€°", "É"
    $content = $content -replace "ÃƒÂ", "Í"
    
    # N con tilde
    $content = $content -replace "ÃƒÂ±", "ñ"
    $content = $content -replace "Ãƒâ€˜", "Ñ"
    
    # Otros caracteres especiales
    $content = $content -replace "ÃƒÂ¼", "ü"
    $content = $content -replace "ÃƒÂ§", "ç"
    
    # Aun, aun
    $content = $content -replace "ÃƒÂºn", "ún"
    $content = $content -replace "AÃƒÂºn", "Aún"
    
    # Ultimo, ultima
    $content = $content -replace "ÃƒÅ¡ltim", "últim"
    $content = $content -replace "ÃƒÅ¡ltim", "Últim"
    
    # Numero
    $content = $content -replace "ÃƒÂºmero", "úmero"
    $content = $content -replace "NÃƒÂº", "Nú"
    
    # Segun
    $content = $content -replace "segÃƒÂºn", "según"
    
    # Volumen
    $content = $content -replace "VolÃƒÂºmen", "Volúmen"
    
    # Optimo
    $content = $content -replace "Ãƒâ€œptimo", "Óptimo"
    $content = $content -replace "ÃƒÅ“ptimo", "Óptimo"
    
    # Unica
    $content = $content -replace "ÃƒÂºnica", "única"
    
    # Ultima milla
    $content = $content -replace "ÃƒÂºltima", "última"
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $totalFiles++
        Write-Host ("Corregido: " + $file.Name) -ForegroundColor Green
    }
}

Write-Host ""
Write-Host ("Total archivos corregidos: " + $totalFiles) -ForegroundColor Yellow
Write-Host ""
Write-Host "Verificando que no queden caracteres corruptos..." -ForegroundColor Cyan

# Verificacion
$remaining = Get-ChildItem -Path $srcPath -Recurse -File | Where-Object { 
    $_.Extension -eq ".tsx" -or $_.Extension -eq ".ts" 
} | Select-String -Pattern "Ãƒ" | Select-Object Path, LineNumber, Line

if ($remaining) {
    Write-Host "Aun quedan algunos caracteres corruptos:" -ForegroundColor Red
    $remaining | Select-Object -First 10
} else {
    Write-Host "¡Perfecto! No quedan caracteres corruptos." -ForegroundColor Green
}