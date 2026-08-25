#Requires -RunAsAdministrator

param(
  [ValidateRange(1, 65535)]
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$RuleName = "Sala13-LAN-TCP-$Port"
$DisplayName = "Sala13 LAN (TCP $Port)"
$ExistingRule = Get-NetFirewallRule -Name $RuleName -ErrorAction SilentlyContinue

if ($null -eq $ExistingRule) {
  New-NetFirewallRule `
    -Name $RuleName `
    -DisplayName $DisplayName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -Profile Private | Out-Null
  Write-Host "Regola Windows Firewall creata: $DisplayName" -ForegroundColor Green
} else {
  Set-NetFirewallRule -Name $RuleName -Enabled True -Action Allow -Profile Private | Out-Null
  Write-Host "Regola Windows Firewall gia presente e attivata: $DisplayName" -ForegroundColor Green
}

Write-Host "`nIndirizzi da provare sugli altri dispositivi della stessa rete:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    -not $_.IPAddress.StartsWith("169.254.") -and
    $_.AddressState -eq "Preferred"
  } |
  Sort-Object InterfaceAlias, IPAddress |
  ForEach-Object {
    Write-Host ("  {0}: http://{1}:{2}" -f $_.InterfaceAlias, $_.IPAddress, $Port)
  }

Write-Host "`nIl tuo amico deve usare l'IP del PC che esegue npm start." -ForegroundColor Yellow
