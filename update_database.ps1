# 1. Rename table from shp_wgs to cambios_edilicios
Write-Host "Renaming table shp_wgs to cambios_edilicios..."
docker exec -i ide-db psql -U postgres -d idedb -c "ALTER TABLE shp_wgs RENAME TO cambios_edilicios;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Notice: Table shp_wgs rename failed (it might already be renamed or database is starting)."
} else {
    Write-Host "Table successfully renamed!"
}

# 2. Export cambios_edilicios table as GeoJSON to frontend/cambios.geojson
Write-Host "Exporting cambios_edilicios to GeoJSON for Turf analysis..."
$query = @"
SELECT jsonb_build_object(
    'type',     'FeatureCollection',
    'features', jsonb_agg(features.feature)
)
FROM (
  SELECT jsonb_build_object(
      'type',       'Feature',
      'id',         COALESCE(objectid::int, id::int, gid),
      'geometry',   ST_AsGeoJSON(geom)::jsonb,
      'properties', to_jsonb(inputs) - 'geom'
  ) AS feature
  FROM (SELECT * FROM cambios_edilicios) inputs
) features;
"@

# Run query inside container and output directly to /data/frontend/cambios.geojson to avoid PowerShell UTF-16LE redirection bug
docker exec -i ide-db psql -U postgres -d idedb -t -A -c "$query" -o /data/frontend/cambios.geojson

if ($LASTEXITCODE -eq 0 -and (Test-Path frontend/cambios.geojson)) {
    Write-Host "GeoJSON successfully exported in UTF-8 to frontend/cambios.geojson!"
} else {
    Write-Error "Failed to export GeoJSON."
}
