Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$workspace = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $workspace "assets"
$brandingDir = Join-Path $assetsDir "branding"
$darkSourcePath = "C:\Users\PC SOFT\Downloads\IMG_2194.png"

if (-not (Test-Path $darkSourcePath)) {
  throw "Logo source not found: $darkSourcePath"
}

New-Item -ItemType Directory -Force -Path $brandingDir | Out-Null

function New-Canvas([int]$width, [int]$height) {
  return New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Set-HighQuality([System.Drawing.Graphics]$graphics) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Test-IsBackground([System.Drawing.Color]$color) {
  return ($color.R -le 24 -and $color.G -le 24 -and $color.B -le 24)
}

function Get-RowClusters([System.Drawing.Bitmap]$bitmap) {
  $clusters = New-Object System.Collections.Generic.List[object]
  $inCluster = $false
  $start = 0

  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    $activePixels = 0
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      if (-not (Test-IsBackground ($bitmap.GetPixel($x, $y)))) {
        $activePixels++
      }
    }

    $rowActive = $activePixels -gt 5
    if ($rowActive -and -not $inCluster) {
      $start = $y
      $inCluster = $true
    } elseif (-not $rowActive -and $inCluster) {
      $clusters.Add([pscustomobject]@{ Start = $start; End = $y - 1 }) | Out-Null
      $inCluster = $false
    }
  }

  if ($inCluster) {
    $clusters.Add([pscustomobject]@{ Start = $start; End = $bitmap.Height - 1 }) | Out-Null
  }

  return $clusters
}

function Get-Bounds([System.Drawing.Bitmap]$bitmap, [int]$startRow, [int]$endRow) {
  $minX = $bitmap.Width
  $minY = $bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($y = $startRow; $y -le $endRow; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      if (-not (Test-IsBackground ($bitmap.GetPixel($x, $y)))) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0 -or $maxY -lt 0) {
    throw "Could not find logo bounds."
  }

  return [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
}

function Build-TransparentLogo([System.Drawing.Bitmap]$source, [System.Drawing.Rectangle]$bounds, [System.Drawing.Color]$fillColor) {
  $output = New-Canvas $bounds.Width $bounds.Height

  for ($y = 0; $y -lt $bounds.Height; $y++) {
    for ($x = 0; $x -lt $bounds.Width; $x++) {
      $pixel = $source.GetPixel($bounds.X + $x, $bounds.Y + $y)
      if (-not (Test-IsBackground $pixel)) {
        $output.SetPixel($x, $y, $fillColor)
      } else {
        $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      }
    }
  }

  return $output
}

function Draw-Centered([System.Drawing.Bitmap]$canvas, [System.Drawing.Bitmap]$image, [double]$maxWidthRatio, [double]$maxHeightRatio) {
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    Set-HighQuality $graphics
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $targetWidth = [double]$canvas.Width * $maxWidthRatio
    $targetHeight = [double]$canvas.Height * $maxHeightRatio
    $scale = [Math]::Min($targetWidth / $image.Width, $targetHeight / $image.Height)
    $drawWidth = [int][Math]::Round($image.Width * $scale)
    $drawHeight = [int][Math]::Round($image.Height * $scale)
    $drawX = [int][Math]::Round(($canvas.Width - $drawWidth) / 2)
    $drawY = [int][Math]::Round(($canvas.Height - $drawHeight) / 2)

    $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
  } finally {
    $graphics.Dispose()
  }
}

function Build-SolidIcon([System.Drawing.Bitmap]$image, [int]$size, [double]$widthRatio, [double]$heightRatio, [string]$backgroundHex) {
  $canvas = New-Canvas $size $size
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    Set-HighQuality $graphics
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($backgroundHex))

    $targetWidth = [double]$size * $widthRatio
    $targetHeight = [double]$size * $heightRatio
    $scale = [Math]::Min($targetWidth / $image.Width, $targetHeight / $image.Height)
    $drawWidth = [int][Math]::Round($image.Width * $scale)
    $drawHeight = [int][Math]::Round($image.Height * $scale)
    $drawX = [int][Math]::Round(($size - $drawWidth) / 2)
    $drawY = [int][Math]::Round(($size - $drawHeight) / 2)

    $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
  } finally {
    $graphics.Dispose()
  }

  return $canvas
}

$source = [System.Drawing.Bitmap]::FromFile($darkSourcePath)
try {
  $clusters = Get-RowClusters $source
  if ($clusters.Count -lt 1) {
    throw "Could not detect logo rows."
  }

  $markCluster = $clusters[0]
  $wordmarkStart = $clusters[0].Start
  $wordmarkEnd = $clusters[$clusters.Count - 1].End

  $markBounds = Get-Bounds $source $markCluster.Start $markCluster.End
  $wordmarkBounds = Get-Bounds $source $wordmarkStart $wordmarkEnd

  $white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

  $logoMark = Build-TransparentLogo $source $markBounds $white
  $logoWordmark = Build-TransparentLogo $source $wordmarkBounds $white

  Save-Png $logoMark (Join-Path $brandingDir "logo-mark-white.png")
  Save-Png $logoWordmark (Join-Path $brandingDir "logo-wordmark-white.png")

  $adaptive = New-Canvas 1024 1024
  Draw-Centered $adaptive $logoMark 0.72 0.72
  Save-Png $adaptive (Join-Path $assetsDir "adaptive-icon.png")

  $icon = Build-SolidIcon $logoMark 1024 0.68 0.68 "#258767"
  Save-Png $icon (Join-Path $assetsDir "icon.png")

  $favicon = Build-SolidIcon $logoMark 256 0.68 0.68 "#258767"
  Save-Png $favicon (Join-Path $assetsDir "favicon.png")

  $splash = New-Canvas 1400 1400
  Draw-Centered $splash $logoWordmark 0.70 0.26
  Save-Png $splash (Join-Path $assetsDir "splash-icon.png")
} finally {
  $source.Dispose()
}
