Add-Type -AssemblyName System.Drawing

$bg = [System.Drawing.Color]::FromArgb(255, 17, 24, 39)      # #111827
$accent = [System.Drawing.Color]::FromArgb(255, 255, 90, 31) # #ff5a1f
$white = [System.Drawing.Color]::White

function New-RoundedRectPath($x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Icon($size, $outPath, $maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $bgBrush = New-Object System.Drawing.SolidBrush $bg
  if ($maskable) {
    # volle Bleed-Flaeche, kein abgerundetes Rechteck, Inhalt kleiner skaliert
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)
    $scale = 0.62
  } else {
    $corner = [double]$size * 0.22
    $path = New-RoundedRectPath 0 0 $size $size $corner
    $g.FillPath($bgBrush, $path)
    $scale = 0.82
  }

  # Hantel (Barbell) mittig zeichnen, skaliert
  $cx = $size / 2.0
  $cy = $size / 2.0
  $barbellW = $size * $scale
  $barbellH = $barbellW * 0.42

  $barH = $barbellH * 0.24
  $plateW = $barbellW * 0.16
  $plateH = $barbellH

  $whiteBrush = New-Object System.Drawing.SolidBrush $white

  # Mittelbalken (bar)
  $barX = $cx - ($barbellW / 2.0) + $plateW
  $barY = $cy - ($barH / 2.0)
  $barW = $barbellW - (2 * $plateW)
  $barPath = New-RoundedRectPath $barX $barY $barW $barH ($barH / 2.0)
  $g.FillPath($whiteBrush, $barPath)

  # linke Hantelscheibe
  $leftX = $cx - ($barbellW / 2.0)
  $leftY = $cy - ($plateH / 2.0)
  $leftPath = New-RoundedRectPath $leftX $leftY $plateW $plateH ($plateW * 0.35)
  $g.FillPath($whiteBrush, $leftPath)

  # rechte Hantelscheibe
  $rightX = $cx + ($barbellW / 2.0) - $plateW
  $rightY = $cy - ($plateH / 2.0)
  $rightPath = New-RoundedRectPath $rightX $rightY $plateW $plateH ($plateW * 0.35)
  $g.FillPath($whiteBrush, $rightPath)

  # Akzent-Punkt auf dem Balken (kleines Detail)
  $dotR = $barH * 0.9
  $accentBrush = New-Object System.Drawing.SolidBrush $accent
  $g.FillEllipse($accentBrush, $cx - ($dotR / 2.0), $cy - ($dotR / 2.0), $dotR, $dotR)

  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$iconsDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

New-Icon 192 (Join-Path $iconsDir "icon-192.png") $false
New-Icon 512 (Join-Path $iconsDir "icon-512.png") $false
New-Icon 192 (Join-Path $iconsDir "icon-maskable-192.png") $true
New-Icon 512 (Join-Path $iconsDir "icon-maskable-512.png") $true

Write-Output "Icons erstellt."
