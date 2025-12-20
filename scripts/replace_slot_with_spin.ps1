# Replace standalone word 'slot' -> 'spin' in text files, skipping fenced code blocks
$extensions = '*.md','*.html','*.txt','*.json'
$files = Get-ChildItem -Path . -Recurse -Include $extensions | Where-Object { -not $_.PSIsContainer }
$pattern = '(?i)\bslot\b'
foreach ($f in $files) {
  $content = Get-Content -Raw -Encoding UTF8 $f.FullName
n  $lines = $content -split "\r?\n"
  $inFence = $false
  $changed = $false
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -match '^\s*```') {
      $inFence = -not $inFence
      continue
    }
    if (-not $inFence) {
      $newLine = [System.Text.RegularExpressions.Regex]::Replace($line, $pattern, 'spin')
      if ($newLine -ne $line) { $lines[$i] = $newLine; $changed = $true }
    }
  }
  if ($changed) {
    $out = [string]::Join("`n", $lines)
    Set-Content -Path $f.FullName -Value $out -Encoding UTF8
    Write-Output "Updated: $($f.FullName)"
  }
}
Write-Output "Done."
