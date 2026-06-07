# Wait for GeoServer to start
Write-Host "Waiting for GeoServer to start..."
$url = "http://localhost:8082/geoserver/rest/about/version.json"
$max_retries = 40
$retry_count = 0
$success = $false

$headers = @{
    Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:geoserver"))
}

while (-not $success -and $retry_count -lt $max_retries) {
    try {
        $response = Invoke-WebRequest -Uri $url -Headers $headers -Method Get -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $success = $true
            Write-Host "GeoServer is up and running!"
        }
    }
    catch {
        $retry_count++
        Write-Host "GeoServer not ready yet. Retrying ($retry_count/$max_retries)..."
        Start-Sleep -Seconds 3
    }
}

if (-not $success) {
    Write-Error "GeoServer failed to start in time."
    exit 1
}

# 1. Create Workspace
Write-Host "Creating workspace 'ide'..."
$workspaceXml = "<workspace><name>ide</name></workspace>"
try {
    Invoke-RestMethod -Uri "http://localhost:8082/geoserver/rest/workspaces" -Headers $headers -Method Post -ContentType "text/xml" -Body $workspaceXml
    Write-Host "Workspace 'ide' created."
} catch {
    Write-Host "Workspace might already exist."
}

# 2. Create Coverage Store (Pointing to /data/flores_wgs.tif inside container)
Write-Host "Creating coverage store 'flores'..."
$storeXml = "<coverageStore><name>flores</name><type>GeoTIFF</type><enabled>true</enabled><workspace>ide</workspace><url>file:///data/flores_wgs.tif</url></coverageStore>"
try {
    Invoke-RestMethod -Uri "http://localhost:8082/geoserver/rest/workspaces/ide/coveragestores" -Headers $headers -Method Post -ContentType "text/xml" -Body $storeXml
    Write-Host "Coverage store 'flores' created."
} catch {
    Write-Host "Coverage store might already exist."
}

# 3. Create Coverage Layer and Publish it
Write-Host "Creating coverage layer 'flores_wgs'..."
$coverageXml = "<coverage><name>flores_wgs</name><title>flores_wgs</title><srs>EPSG:4326</srs></coverage>"
try {
    Invoke-RestMethod -Uri "http://localhost:8082/geoserver/rest/workspaces/ide/coveragestores/flores/coverages" -Headers $headers -Method Post -ContentType "text/xml" -Body $coverageXml
    Write-Host "Coverage layer 'flores_wgs' created and published!"
} catch {
    Write-Host "Coverage layer might already exist."
}

Write-Host "GeoServer configuration completed successfully."
