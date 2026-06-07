// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Map configurations
    const mapCenter = [-58.47476, -34.62165]; // Center coordinates from PGW file
    const initialZoom = 17.5;

    // Initialize MapLibre GL Map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Premium dark style
        center: mapCenter,
        zoom: initialZoom,
        minZoom: 10,
        maxZoom: 22
    });

    // Add navigation controls (zoom, rotate)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // UI Elements
    const latDisplay = document.getElementById('lat-display');
    const lngDisplay = document.getElementById('lng-display');
    const zoomDisplay = document.getElementById('zoom-display');
    const loader = document.getElementById('loader');
    
    // Checkboxes and controls
    const layerRasterCheckbox = document.getElementById('layer-raster');
    const opacityRasterSlider = document.getElementById('opacity-raster');
    const opacityValRaster = document.getElementById('opacity-val-raster');
    const layerVectorCheckbox = document.getElementById('layer-vector');

    // Info panel elements
    const infoPlaceholder = document.getElementById('info-placeholder');
    const infoDetails = document.getElementById('info-details');
    const attributesBody = document.getElementById('attributes-body');

    // Show loading spinner
    loader.classList.add('show');

    // Update coordinate bar on mouse move
    map.on('mousemove', (e) => {
        latDisplay.textContent = e.lngLat.lat.toFixed(6);
        lngDisplay.textContent = e.lngLat.lng.toFixed(6);
    });

    // Update zoom display on zoom end
    map.on('zoom', () => {
        zoomDisplay.textContent = map.getZoom().toFixed(2);
    });

    // Map load callback
    map.on('load', () => {
        console.log('Map loaded successfully.');
        loader.classList.remove('show');
        
        // Initialize coordinates/zoom values
        zoomDisplay.textContent = map.getZoom().toFixed(2);
        const center = map.getCenter();
        latDisplay.textContent = center.lat.toFixed(6);
        lngDisplay.textContent = center.lng.toFixed(6);

        // 1. ADD RASTER LAYER (GeoServer WMS)
        // GeoServer WMS URL from browser perspective: http://localhost:8082/geoserver/wms
        // Layer name: ide:flores_wgs
        const rasterSourceId = 'raster-vuelo';
        const rasterLayerId = 'raster-vuelo-layer';

        map.addSource(rasterSourceId, {
            type: 'raster',
            tiles: [
                'http://localhost:8082/geoserver/wms?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&transparent=true&width=256&height=256&layers=ide:flores_wgs&tiled=true'
            ],
            tileSize: 256
        });

        map.addLayer({
            id: rasterLayerId,
            type: 'raster',
            source: rasterSourceId,
            paint: {
                'raster-opacity': parseFloat(opacityRasterSlider.value) / 100
            }
        });

        // 2. ADD VECTOR LAYER (pg_tileserv)
        // pg_tileserv URL: http://localhost:7800
        const vectorSourceId = 'vector-shp';
        const vectorFillLayerId = 'vector-shp-fill';
        const vectorLineLayerId = 'vector-shp-line';

        map.addSource(vectorSourceId, {
            type: 'vector',
            tiles: [
                'http://localhost:7800/public.shp_wgs/{z}/{x}/{y}.pbf'
            ]
        });

        // Vector Fill Layer (Translucent styling for polygons)
        map.addLayer({
            id: vectorFillLayerId,
            type: 'fill',
            source: vectorSourceId,
            'source-layer': 'public.shp_wgs',
            paint: {
                'fill-color': '#4f46e5',
                'fill-opacity': 0.15,
                'fill-outline-color': 'transparent'
            }
        });

        // Vector Outline Layer (Vibrant glow effect)
        map.addLayer({
            id: vectorLineLayerId,
            type: 'line',
            source: vectorSourceId,
            'source-layer': 'public.shp_wgs',
            paint: {
                'line-color': '#6366f1',
                'line-width': 2,
                'line-opacity': 0.85
            }
        });

        // Hover effect for vector layer
        let hoveredFeatureId = null;

        map.on('mousemove', vectorFillLayerId, (e) => {
            if (e.features.length > 0) {
                map.getCanvas().style.cursor = 'pointer';
            }
        });

        map.on('mouseleave', vectorFillLayerId, () => {
            map.getCanvas().style.cursor = '';
        });

        // Click event on Vector features to inspect attributes
        map.on('click', vectorFillLayerId, (e) => {
            if (e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;

            // Clear table
            attributesBody.innerHTML = '';

            // Populate table with properties
            for (const [key, value] of Object.entries(props)) {
                const row = document.createElement('tr');
                const keyCell = document.createElement('td');
                const valCell = document.createElement('td');

                keyCell.textContent = key;
                valCell.textContent = value !== null ? value : 'NULL';

                row.appendChild(keyCell);
                row.appendChild(valCell);
                attributesBody.appendChild(row);
            }

            // Show details panel
            infoPlaceholder.classList.remove('active');
            infoDetails.classList.add('active');

            // Draw a popup at the click point
            new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`
                    <div class="popup-title">Elemento Seleccionado</div>
                    <div class="popup-body">
                        <strong>ID:</strong> ${props.id || props.gid || 'N/A'}<br>
                        <em>Revisa el panel lateral para ver más detalles.</em>
                    </div>
                `)
                .addTo(map);
        });

        // 3. LAYER CONTROLS BINDING
        
        // Raster Layer Toggle
        layerRasterCheckbox.addEventListener('change', (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            map.setLayoutProperty(rasterLayerId, 'visibility', visibility);
        });

        // Raster Opacity Slider
        opacityRasterSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            opacityValRaster.textContent = `${val}%`;
            map.setPaintProperty(rasterLayerId, 'raster-opacity', parseFloat(val) / 100);
        });

        // Vector Layer Toggle
        layerVectorCheckbox.addEventListener('change', (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            map.setLayoutProperty(vectorFillLayerId, 'visibility', visibility);
            map.setLayoutProperty(vectorLineLayerId, 'visibility', visibility);
        });
    });

    // Handle map error
    map.on('error', (e) => {
        console.error('MapLibre GL Error:', e.error);
        loader.classList.remove('show');
    });
});
