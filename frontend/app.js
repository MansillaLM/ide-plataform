// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Map configurations
    const mapCenter = [-58.47476, -34.62165]; // Center coordinates from PGW file
    const initialZoom = 17.5;

    // State object to match original project structure
    const appState = {
        map: null,
        datosGeoJSON: null,
        capaSeleccionadaIds: []
    };

    // Initialize MapLibre GL Map
    appState.map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Premium dark style
        center: mapCenter,
        zoom: initialZoom,
        minZoom: 10,
        maxZoom: 22
    });

    const map = appState.map;

    // Add navigation controls (zoom, rotate)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Add CABA-restricted Geocoder (Nominatim API)
    const geocoder = new MaplibreGeocoder({
        forwardGeocode: (config) => {
            const query = config.query;
            // Restricted to Buenos Aires bounding box: -58.5336,-34.5366,-58.3331,-34.7059
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&limit=5&viewbox=-58.5336,-34.5366,-58.3331,-34.7059&bounded=1`;
            return fetch(url)
                .then(response => response.json())
                .then(geojson => geojson)
                .catch(err => {
                    console.error('Geocoder Error:', err);
                    return { type: 'FeatureCollection', features: [] };
                });
        },
        placeholder: 'Buscar dirección en CABA...',
        position: 'top-left',
        showResultsWhileTyping: true
    });
    map.addControl(geocoder, 'top-left');

    // Add Mapbox GL Draw
    const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        },
        defaultMode: 'simple_select'
    });
    map.addControl(draw, 'top-left');

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

    // Stats elements
    const valConteo = document.getElementById('val-conteo');
    const valAreaCambios = document.getElementById('val-area-cambios');
    const btnExportar = document.getElementById('btn-exportar');
    const btnReiniciar = document.getElementById('btn-reiniciar');

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

    // --- SPATIAL ANALYSIS LOGIC ---
    
    function performIntersectionAnalysis(poligonoDibujado) {
        if (!appState.datosGeoJSON) return { count: 0, area: 0, selectedIds: [], features: [] };

        const featuresIntersectados = [];
        const selectedIds = [];
        let areaTotalCambios = 0;

        appState.datosGeoJSON.features.forEach(feature => {
            let intersecta = false;
            try {
                // Attempt 1: Turf intersect
                const interseccion = turf.intersect(poligonoDibujado, feature);
                intersecta = interseccion !== null;
            } catch (err) {
                try {
                    // Attempt 2: Boolean intersects fallback
                    intersecta = turf.booleanIntersects(poligonoDibujado, feature);
                } catch (err2) {
                    try {
                        // Attempt 3: Centroid in Polygon fallback (for topological issues)
                        const centroide = turf.centroid(feature);
                        intersecta = turf.booleanPointInPolygon(centroide, poligonoDibujado);
                    } catch (err3) {
                        console.error('All spatial fallback checks failed for feature:', feature.id, err3);
                    }
                }
            }

            if (intersecta) {
                featuresIntersectados.push(feature);
                // Collect IDs for map filtering. Support 'objectid' and 'id'
                const fid = feature.properties.objectid || feature.properties.id || feature.id;
                if (fid) selectedIds.push(Number(fid));
                areaTotalCambios += turf.area(feature);
            }
        });

        return {
            count: featuresIntersectados.length,
            area: areaTotalCambios,
            selectedIds: selectedIds,
            features: featuresIntersectados
        };
    }

    function updateStats(count, area) {
        valConteo.textContent = count;
        valAreaCambios.textContent = area.toLocaleString('es-AR', { maximumFractionDigits: 2 });
        btnExportar.disabled = count === 0;
    }

    function handleDrawCreated(e) {
        const drawnFeatures = draw.getAll();
        if (drawnFeatures.features.length === 0) return;

        // Use the last drawn feature
        const drawnPolygon = drawnFeatures.features[drawnFeatures.features.length - 1];

        // Perform spatial analysis
        const { count, area, selectedIds } = performIntersectionAnalysis(drawnPolygon);

        appState.capaSeleccionadaIds = selectedIds;
        updateStats(count, area);

        // Filter map to show ONLY selected features
        if (count > 0) {
            // Filter vector fill & line layers using 'objectid' or 'id'
            const filterExpr = ['in', ['get', 'objectid'], ['literal', selectedIds]];
            map.setFilter('vector-shp-fill', filterExpr);
            map.setFilter('vector-shp-line', filterExpr);

            // Display drawn AOI area info in attributes panel
            const aoiArea = turf.area(drawnPolygon);
            infoPlaceholder.classList.remove('active');
            infoDetails.classList.add('active');
            attributesBody.innerHTML = `
                <tr><td>Área AOI Dibujado</td><td>${aoiArea.toLocaleString('es-AR', { maximumFractionDigits: 2 })} m²</td></tr>
                <tr><td>Edificaciones Afectadas</td><td>${count}</td></tr>
                <tr><td>Área Edificada Total</td><td>${area.toLocaleString('es-AR', { maximumFractionDigits: 2 })} m²</td></tr>
            `;
        } else {
            // If no features selected, hide all
            map.setFilter('vector-shp-fill', ['==', ['get', 'objectid'], -1]);
            map.setFilter('vector-shp-line', ['==', ['get', 'objectid'], -1]);
            
            infoPlaceholder.classList.add('active');
            infoDetails.classList.remove('active');
        }
    }

    function handleDrawDeleted() {
        // Reset stats
        updateStats(0, 0);
        
        // Remove filters (show all features again)
        map.setFilter('vector-shp-fill', null);
        map.setFilter('vector-shp-line', null);
        
        // Reset side info panel
        infoPlaceholder.classList.add('active');
        infoDetails.classList.remove('active');
        attributesBody.innerHTML = '';
        appState.capaSeleccionadaIds = [];
    }

    // --- PDF EXPORT LOGIC ---
    
    function handleExportPDF() {
        btnExportar.innerText = 'Generando Informe...';
        btnExportar.disabled = true;

        const drawnFeatures = draw.getAll();
        if (drawnFeatures.features.length > 0) {
            // Zoom to drawn area bounds before capturing
            const bbox = turf.bbox(drawnFeatures.features[0]);
            map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 150, animate: false });
        }

        // Wait for MapLibre to load all tiles and become idle before generating PDF
        map.once('idle', () => {
            const element = document.getElementById('app-container');
            const opt = {
                margin: 5,
                filename: 'informe-cambios-morfologicos.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    // Ignore interactive UI elements like search bar, draw controls and the export buttons
                    ignoreElements: (el) => {
                        return el.id === 'btn-exportar' || 
                               el.id === 'btn-reiniciar' || 
                               el.classList.contains('mapboxgl-ctrl') || 
                               el.classList.contains('maplibregl-ctrl');
                    }
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(element).save().finally(() => {
                btnExportar.innerText = 'Exportar Informe PDF';
                btnExportar.disabled = false;
            });
        });
    }

    function handleReset() {
        draw.deleteAll();
        handleDrawDeleted();
        map.flyTo({ center: mapCenter, zoom: initialZoom });
    }

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

        // 2. ADD VECTOR LAYER (pg_tileserv - cambios_edilicios)
        const vectorSourceId = 'vector-shp';
        const vectorFillLayerId = 'vector-shp-fill';
        const vectorLineLayerId = 'vector-shp-line';

        map.addSource(vectorSourceId, {
            type: 'vector',
            tiles: [
                'http://localhost:7800/public.cambios_edilicios/{z}/{x}/{y}.pbf'
            ]
        });

        // Vector Fill Layer (Translucent styling for polygons - Red themed for building changes)
        map.addLayer({
            id: vectorFillLayerId,
            type: 'fill',
            source: vectorSourceId,
            'source-layer': 'public.cambios_edilicios',
            paint: {
                'fill-color': '#D12D21',
                'fill-opacity': 0.25,
                'fill-outline-color': 'transparent'
            }
        });

        // Vector Outline Layer (Vibrant glow effect)
        map.addLayer({
            id: vectorLineLayerId,
            type: 'line',
            source: vectorSourceId,
            'source-layer': 'public.cambios_edilicios',
            paint: {
                'line-color': '#D12D21',
                'line-width': 2,
                'line-opacity': 0.85
            }
        });

        // Click event on Vector features to inspect attributes when not drawing
        map.on('click', vectorFillLayerId, (e) => {
            // Check if drawing mode is active (draw tool returns draw mode)
            if (draw.getMode() !== 'simple_select' && draw.getMode() !== 'direct_select') return;

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
                    <div class="popup-title">Cambio Edilicio</div>
                    <div class="popup-body">
                        <strong>ID:</strong> ${props.id || props.objectid || 'N/A'}<br>
                        <strong>Área:</strong> ${props.shape_area ? Number(props.shape_area).toFixed(2) : 'N/A'} m²<br>
                        <em>Revisa el panel lateral para ver más detalles.</em>
                    </div>
                `)
                .addTo(map);
        });

        // Hover effect for pointer cursor
        map.on('mousemove', vectorFillLayerId, (e) => {
            if (draw.getMode() === 'simple_select' || draw.getMode() === 'direct_select') {
                map.getCanvas().style.cursor = 'pointer';
            }
        });

        map.on('mouseleave', vectorFillLayerId, () => {
            map.getCanvas().style.cursor = '';
        });

        // --- BIND EVENT LISTENERS FOR DRAWING AND ACTIONS ---
        
        map.on('draw.create', handleDrawCreated);
        map.on('draw.update', handleDrawCreated);
        map.on('draw.delete', handleDrawDeleted);

        btnExportar.addEventListener('click', handleExportPDF);
        btnReiniciar.addEventListener('click', handleReset);

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

        // --- LOAD STATIC GEOJSON FOR SPATIAL QUERY CALCULATIONS ---
        fetch('cambios.geojson')
            .then(res => {
                if (!res.ok) throw new Error('No se pudo descargar cambios.geojson local');
                return res.json();
            })
            .then(data => {
                appState.datosGeoJSON = data;
                console.log('GeoJSON changes loaded for Turf analysis:', data.features.length, 'features');
            })
            .catch(err => {
                console.error('Error fetching cambios.geojson:', err);
                alert('Aviso: cambios.geojson no encontrado localmente. El análisis espacial estará inactivo hasta que se genere.');
            });
    });

    // Handle map error
    map.on('error', (e) => {
        console.error('MapLibre GL Error:', e.error);
        loader.classList.remove('show');
    });
});
