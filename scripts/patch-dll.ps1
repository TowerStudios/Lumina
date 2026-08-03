# 查找 wcdb_init 函数地址，并搜索 -1006 (0xFFFFFC0E) 的位置
$dllPath = "G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll"
Write-Host "DLL Path: $dllPath"
Write-Host "Exists: $(Test-Path $dllPath)"
$bytes = [System.IO.File]::ReadAllBytes($dllPath)
Write-Host "Read $($bytes.Length) bytes"

# PE header offset at 0x3C
$peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
$optHeaderOffset = $peOffset + 24
$sizeOfOptionalHeader = [BitConverter]::ToUInt16($bytes, $peOffset + 20)
$exportTableRVA = [BitConverter]::ToUInt32($bytes, $optHeaderOffset + 112)

# Section headers
$numberOfSections = [BitConverter]::ToUInt16($bytes, $peOffset + 6)
$sectionOffset = $optHeaderOffset + $sizeOfOptionalHeader
$sections = @()
for ($i = 0; $i -lt $numberOfSections; $i++) {
    $secOff = $sectionOffset + ($i * 40)
    $sections += [PSCustomObject]@{
        VirtualAddress = [BitConverter]::ToUInt32($bytes, $secOff + 12)
        VirtualSize = [BitConverter]::ToUInt32($bytes, $secOff + 8)
        PointerToRawData = [BitConverter]::ToUInt32($bytes, $secOff + 20)
    }
}

function RvaToOffset($rva) {
    foreach ($sec in $sections) {
        if ($rva -ge $sec.VirtualAddress -and $rva -lt ($sec.VirtualAddress + $sec.VirtualSize)) {
            return $sec.PointerToRawData + ($rva - $sec.VirtualAddress)
        }
    }
    return -1
}

# 获取导出表
$exportDirOffset = RvaToOffset $exportTableRVA
$numberOfNames = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 24)
$addressOfNames = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 32)
$addressOfNameOrdinals = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 36)
$addressOfFunctions = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 28)

$nameOffset = RvaToOffset $addressOfNames
$ordinalOffset = RvaToOffset $addressOfNameOrdinals
$funcOffset = RvaToOffset $addressOfFunctions

# 查找 wcdb_init 的导出地址
$wcdbInitRva = -1
$wcdbInitOffset = -1
for ($i = 0; $i -lt $numberOfNames; $i++) {
    $nameRva2 = [BitConverter]::ToUInt32($bytes, $nameOffset + ($i * 4))
    $nameOff2 = RvaToOffset $nameRva2
    $end = $nameOff2
    while ($bytes[$end] -ne 0) { $end++ }
    $funcName = [System.Text.Encoding]::ASCII.GetString($bytes, $nameOff2, $end - $nameOff2)
    if ($funcName -eq 'wcdb_init') {
        $ordinal = [BitConverter]::ToUInt16($bytes, $ordinalOffset + ($i * 2))
        $wcdbInitRva = [BitConverter]::ToUInt32($bytes, $funcOffset + ($ordinal * 4))
        $wcdbInitOffset = RvaToOffset $wcdbInitRva
        Write-Host ("wcdb_init RVA: 0x{0:X}, FileOffset: 0x{1:X}" -f $wcdbInitRva, $wcdbInitOffset)
        break
    }
}

if ($wcdbInitOffset -lt 0) {
    Write-Host "未找到 wcdb_init"
    exit
}

# 读取 wcdb_init 函数的字节（前 256 字节）
Write-Host ""
Write-Host "=== wcdb_init 前 256 字节 ==="
$funcBytes = $bytes[$wcdbInitOffset..($wcdbInitOffset + 255)]
$hex = ($funcBytes | ForEach-Object { $_.ToString('X2') }) -join ' '
Write-Host $hex

# 搜索 -1006 (0xFFFFFC0E) 的位置
# 在 x64 中，mov eax, -1006 通常是 B8 0E FC FF FF
# 或者 mov eax, 0FFFFFC0Eh
Write-Host ""
Write-Host "=== 搜索 -1006 (B8 0E FC FF FF) ==="
$pattern = [byte[]](0xB8, 0x0E, 0xFC, 0xFF, 0xFF)
$found = @()
for ($i = 0; $i -lt ($bytes.Length - 5); $i++) {
    $match = $true
    for ($j = 0; $j -lt 5; $j++) {
        if ($bytes[$i + $j] -ne $pattern[$j]) { $match = $false; break }
    }
    if ($match) { $found += $i }
}
Write-Host "找到 $($found.Count) 处 B8 0E FC FF FF (mov eax, -1006)"
foreach ($pos in $found) {
    # 计算这个位置在哪个函数中
    $rva = -1
    foreach ($sec in $sections) {
        if ($pos -ge $sec.PointerToRawData -and $pos -lt ($sec.PointerToRawData + $sec.VirtualSize)) {
            $rva = $sec.VirtualAddress + ($pos - $sec.PointerToRawData)
            break
        }
    }
    Write-Host ("  位置: FileOffset=0x{0:X}, RVA=0x{1:X}" -f $pos, $rva)
    # 显示前后的字节
    $startByte = [Math]::Max(0, $pos - 8)
    $endByte = [Math]::Min($bytes.Length - 1, $pos + 12)
    $context = ($bytes[$startByte..$endByte] | ForEach-Object { $_.ToString('X2') }) -join ' '
    Write-Host "  上下文: $context"
}

# 也搜索 -1005 (0xFFFFFC0B)
Write-Host ""
Write-Host "=== 搜索 -1005 (B8 0B FC FF FF) ==="
$pattern2 = [byte[]](0xB8, 0x0B, 0xFC, 0xFF, 0xFF)
$found2 = @()
for ($i = 0; $i -lt ($bytes.Length - 5); $i++) {
    $match = $true
    for ($j = 0; $j -lt 5; $j++) {
        if ($bytes[$i + $j] -ne $pattern2[$j]) { $match = $false; break }
    }
    if ($match) { $found2 += $i }
}
Write-Host "找到 $($found2.Count) 处 B8 0B FC FF FF (mov eax, -1005)"
foreach ($pos in $found2) {
    $rva = -1
    foreach ($sec in $sections) {
        if ($pos -ge $sec.PointerToRawData -and $pos -lt ($sec.PointerToRawData + $sec.VirtualSize)) {
            $rva = $sec.VirtualAddress + ($pos - $sec.PointerToRawData)
            break
        }
    }
    Write-Host ("  位置: FileOffset=0x{0:X}, RVA=0x{1:X}" -f $pos, $rva)
}
