<#
.SYNOPSIS
Validates UniFi Network credentials and stores Windows environment variables for unifi-network-mcp.

.EXAMPLE
./scripts/setup-unifi-mcp-env.ps1 -Username "mcp-local-admin"

.EXAMPLE
$credential = Get-Credential
./scripts/setup-unifi-mcp-env.ps1 -Credential $credential -ControllerHost 192.168.1.1
#>

[CmdletBinding()]
param(
    [string]$ControllerHost = "192.168.1.1",
    [int]$Port = 443,
    [string]$Site = "default",
    [ValidateSet("auto", "proxy", "direct")]
    [string]$ControllerType = "auto",
    [string]$Username,
    [securestring]$Password,
    [pscredential]$Credential,
    [switch]$VerifySsl,
    [switch]$Machine,
    [ValidateSet("lazy", "eager", "meta_only")]
    [string]$ToolRegistrationMode = "eager",
    [int]$TimeoutSec = 15
)

$ErrorActionPreference = "Stop"

function Enable-InsecureCertificatePolicy {
    if ($VerifySsl) {
        return
    }

    if ($PSVersionTable.PSVersion.Major -lt 6) {
        if (-not ("TrustAllCertsPolicy" -as [type])) {
            Add-Type -TypeDefinition @"
using System.Net;
using System.Security.Cryptography.X509Certificates;

public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(
        ServicePoint srvPoint,
        X509Certificate certificate,
        WebRequest request,
        int certificateProblem
    ) {
        return true;
    }
}
"@
        }

        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
    }

    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
}

function ConvertTo-PlainText {
    param([Parameter(Mandatory = $true)][securestring]$SecureString)

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Get-UniFiCredential {
    if ($Credential) {
        return $Credential
    }

    if (-not $Username) {
        $Username = Read-Host "UniFi local username"
    }

    if (-not $Password) {
        $Password = Read-Host "UniFi password" -AsSecureString
    }

    return [pscredential]::new($Username, $Password)
}

function Get-UniFiControllerTarget {
    if ($ControllerHost -match "^https?://") {
        $uri = [uri]$ControllerHost
        $targetPort = if ($uri.IsDefaultPort) { $Port } else { $uri.Port }
        return [pscustomobject]@{
            Host    = $uri.Host
            Port    = $targetPort
            BaseUri = "$($uri.Scheme)://$($uri.Host):$targetPort"
        }
    }

    return [pscustomobject]@{
        Host    = $ControllerHost
        Port    = $Port
        BaseUri = "https://$ControllerHost`:$Port"
    }
}

function Invoke-UniFiJson {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [object]$Body
    )

    $parameters = @{
        Method      = $Method
        Uri         = $Uri
        WebSession  = $Session
        Headers     = @{ Accept = "application/json" }
        TimeoutSec  = $TimeoutSec
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body | ConvertTo-Json -Depth 10
    }

    if (-not $VerifySsl -and $PSVersionTable.PSVersion.Major -ge 6) {
        $parameters.SkipCertificateCheck = $true
    }

    Invoke-RestMethod @parameters
}

function Test-UniFiNetworkApi {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUri,
        [Parameter(Mandatory = $true)][string]$User,
        [Parameter(Mandatory = $true)][string]$PlainPassword,
        [Parameter(Mandatory = $true)][ValidateSet("auto", "proxy", "direct")][string]$Mode
    )

    $attempts = @()
    if ($Mode -eq "auto" -or $Mode -eq "proxy") {
        $attempts += [pscustomobject]@{
            Type      = "proxy"
            LoginPath = "/api/auth/login"
            Probes    = @(
                "/proxy/network/api/self/sites",
                "/proxy/network/api/s/$Site/self",
                "/proxy/network/api/s/$Site/stat/sysinfo"
            )
        }
    }
    if ($Mode -eq "auto" -or $Mode -eq "direct") {
        $attempts += [pscustomobject]@{
            Type      = "direct"
            LoginPath = "/api/login"
            Probes    = @(
                "/api/self/sites",
                "/api/s/$Site/self",
                "/api/s/$Site/stat/sysinfo"
            )
        }
    }

    $errors = New-Object System.Collections.Generic.List[string]

    foreach ($attempt in $attempts) {
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        try {
            $loginResponse = Invoke-UniFiJson -Method POST -Uri "$BaseUri$($attempt.LoginPath)" -Session $session -Body @{
                username   = $User
                password   = $PlainPassword
                rememberMe = $true
            }

            if ($loginResponse.meta -and $loginResponse.meta.rc -and $loginResponse.meta.rc -ne "ok") {
                throw "Login response was '$($loginResponse.meta.rc)'."
            }

            $lastProbeError = $null
            foreach ($probe in $attempt.Probes) {
                try {
                    Invoke-UniFiJson -Method GET -Uri "$BaseUri$probe" -Session $session | Out-Null
                    return [pscustomobject]@{
                        ControllerType = $attempt.Type
                        ProbePath      = $probe
                    }
                }
                catch {
                    $lastProbeError = $_.Exception.Message
                }
            }

            throw "Login succeeded, but Network API probes failed. Last probe error: $lastProbeError"
        }
        catch {
            $errors.Add("$($attempt.Type): $($_.Exception.Message)") | Out-Null
        }
    }

    throw "Unable to validate UniFi Network login at $BaseUri. $($errors -join ' | ')"
}

function Set-UserEnvironmentVariable {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value,
        [Parameter(Mandatory = $true)][string]$Scope
    )

    [Environment]::SetEnvironmentVariable($Name, $Value, $Scope)
}

Enable-InsecureCertificatePolicy

$scope = if ($Machine) { "Machine" } else { "User" }
$target = Get-UniFiControllerTarget
$baseUri = $target.BaseUri
$uniFiCredential = Get-UniFiCredential
$plainPassword = ConvertTo-PlainText -SecureString $uniFiCredential.Password

try {
    Write-Host "Validating UniFi Network login at $baseUri ..."
    $validation = Test-UniFiNetworkApi -BaseUri $baseUri -User $uniFiCredential.UserName -PlainPassword $plainPassword -Mode $ControllerType

    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_HOST" -Value $target.Host -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_USERNAME" -Value $uniFiCredential.UserName -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_PASSWORD" -Value $plainPassword -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_PORT" -Value ([string]$target.Port) -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_SITE" -Value $Site -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_VERIFY_SSL" -Value ($(if ($VerifySsl) { "true" } else { "false" })) -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_CONTROLLER_TYPE" -Value $validation.ControllerType -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_NETWORK_TOOL_PERMISSION_MODE" -Value "confirm" -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_TOOL_REGISTRATION_MODE" -Value $ToolRegistrationMode -Scope $scope
    Set-UserEnvironmentVariable -Name "UNIFI_POLICY_NETWORK_DELETE" -Value "false" -Scope $scope

    Write-Host "UniFi login validated using '$($validation.ControllerType)' API ($($validation.ProbePath))." -ForegroundColor Green
    Write-Host "Stored UniFi MCP environment variables at '$scope' scope:" -ForegroundColor Green
    Write-Host "  UNIFI_NETWORK_HOST=$($target.Host)"
    Write-Host "  UNIFI_NETWORK_USERNAME=$($uniFiCredential.UserName)"
    Write-Host "  UNIFI_NETWORK_PASSWORD=<redacted>"
    Write-Host "  UNIFI_NETWORK_PORT=$($target.Port)"
    Write-Host "  UNIFI_NETWORK_SITE=$Site"
    Write-Host "  UNIFI_NETWORK_VERIFY_SSL=$(if ($VerifySsl) { 'true' } else { 'false' })"
    Write-Host "  UNIFI_NETWORK_CONTROLLER_TYPE=$($validation.ControllerType)"
    Write-Host "  UNIFI_NETWORK_TOOL_PERMISSION_MODE=confirm"
    Write-Host "  UNIFI_TOOL_REGISTRATION_MODE=$ToolRegistrationMode"
    Write-Host "  UNIFI_POLICY_NETWORK_DELETE=false"
    Write-Host "Restart VS Code so MCP servers inherit the updated environment." -ForegroundColor Yellow
}
finally {
    $plainPassword = $null
}