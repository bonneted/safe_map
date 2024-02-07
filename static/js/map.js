// static/js/map.js

var map; // Define map globally at the top of the file
var startMarker, endMarker;
var polylines = []; // Array to store references to all polylines
var accident_layer = false;
var zoomToRoute = false;

function getColorForAccidents(numAccidents) {
    if (numAccidents > 2) return '#ff0000'; // red for more than 50 accidents
    else if (numAccidents > 1) return '#ff9900'; // orange for 21-50 accidents
    else if (numAccidents > 0) return '#ffff00'; // yellow for 11-20 accidents
    else return '#009900'; // green for 0-10 accidents
}

function addGraphLayer(map) {
    // Function to determine color based on the number of accidents
    if (accident_layer) {
        map.removeLayer(accident_layer);
    }

    var showAccidentData = document.getElementById('showAccidentData').checked;
    if (!showAccidentData) return;

    var dataType = document.getElementById('dataTypeSelect').value;
    console.log(dataType);

    // Load and add the edges GeoJSON layer with dynamic styling
    fetch('/static/edges.geojson')
    .then(response => response.json())
    .then(data => {
        accident_layer = L.geoJson(data, {
            style: function(feature) {
                var numAccidents = feature.properties[dataType];
                var color = getColorForAccidents(numAccidents);
                return {color: color, weight: 2};
            }
        }).addTo(map);
    });
    calculatePath();
}



function initializeMap() {
    map = L.map('mapid').setView([48.152726, 11.532033], 13.8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    var bbox = [[48.178301, 11.479089], [48.126705, 11.585432]];
    var outerBounds = [[48.0, 11.3], [48.0, 11.8], [48.3, 11.8], [48.3, 11.3]]; // Example outer bounds
    var bboxlimit = [[48.126705, 11.479089], [48.126705, 11.585432], [48.178301, 11.585432], [48.178301, 11.479089]];
    
    // Reverse the bbox coordinates for the hole effect
    var bboxReversed = bboxlimit.slice().reverse();
    
    // Create a polygon with a hole
    var polygonWithHole = [
        outerBounds, // Outer boundary
        bboxReversed // Inner boundary (bbox as hole)
    ];
    
    L.polygon(polygonWithHole, {
        color: 'red', // Color for the outer area
        fillOpacity: 0.2, // Adjust for desired opacity for the outer area
        weight: 1
    }).addTo(map).bindPopup("Area not covered by the model");

    // First route calculation
    var marienplatz = L.latLng(48.137393,11.575448)
    var nympenburg = L.latLng(48.158268,11.503314)
    startMarker = L.marker(marienplatz).addTo(map).bindPopup("Marienplatz", {autoClose: false}).openPopup();
    endMarker = L.marker(nympenburg).addTo(map).bindPopup("Nymphenburg",{autoClose: false}).openPopup();

    // URLs to your GeoJSON files
    var edgesGeojsonURL = '{{ url_for("static", filename="edges.geojson") }}';

    var nodesGeojsonURL = '{{ url_for("static", filename="nodes.geojson") }}';

    // Call the function to add the graph layer to the map

    zoomToRoute = true;
    calculatePath();

    var clickCount = 0;

    map.on('click', function(e) {
        // Check if the click is inside the bbox
        if (e.latlng.lat <= bbox[0][0] && e.latlng.lat >= bbox[1][0] && e.latlng.lng >= bbox[0][1] && e.latlng.lng <= bbox[1][1]) {
            // Toggle between start and end marker placement
            if (clickCount % 2 === 0) {
                if (startMarker) map.removeLayer(startMarker);
                startMarker = L.marker(e.latlng).addTo(map).bindPopup("Start").openPopup();
            } else {
                if (endMarker) map.removeLayer(endMarker);
                endMarker = L.marker(e.latlng).addTo(map).bindPopup("End", {autoClose: true}).openPopup();
                calculatePath();
            }
            clickCount++;
        }
    });
}

function cleanPolylines() {
    polylines.forEach(function(polyline) {
        map.removeLayer(polyline);
    });
    polylines = [];
}

document.addEventListener('DOMContentLoaded', initializeMap);


document.getElementById('homeBtn').addEventListener('click', function() {
    map.setView([48.152726, 11.532033], 13.8);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    // Remove all polylines
    cleanPolylines();
    document.getElementById('keepLinesAlive').checked = false;

    // First route calculation
    var marienplatz = L.latLng(48.137393,11.575448)
    var nympenburg = L.latLng(48.158268,11.503314)
    startMarker = L.marker(marienplatz).addTo(map).bindPopup("Marienplatz", {autoClose: false}).openPopup();
    endMarker = L.marker(nympenburg).addTo(map).bindPopup("Nympenburg").openPopup();

    zoomToRoute = true;
    calculatePath();

});


// Define function to calculate path
function calculatePath() {
    if (startMarker && endMarker) {
        var start = startMarker.getLatLng();
        var end = endMarker.getLatLng();
        var dataType = document.getElementById('dataTypeSelect').value;
        var dataTypeName = document.getElementById('dataTypeSelect').options[document.getElementById('dataTypeSelect').selectedIndex].text;
        var alpha = document.getElementById('alphaSlider').value;
        var keepLinesAlive = document.getElementById('keepLinesAlive').checked;
        var showAccidentData = document.getElementById('showAccidentData').checked;


        fetch('/calculate_path', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                start: {lat: start.lat, lng: start.lng},
                end: {lat: end.lat, lng: end.lng},
                data_type: dataType,
                alpha: alpha
            }),
        })
        .then(response => response.json())
        .then(routeLatlng => {
            var color = getColorForAlpha(alpha);
            if (polylines.length > 0 && !keepLinesAlive) cleanPolylines();

            if (showAccidentData) {
                var newPolyline = L.polyline(routeLatlng, {color: `rgba(0, 123, 255, 1)`, weight: 5, lineJoin: 'round'}).addTo(map).bindPopup(`Route based on ${dataTypeName} data with safety factor ${alpha}`, {autoClose: true})
                polylines.push(newPolyline); // Store the reference
            } else {
                var newPolyline = L.polyline(routeLatlng, {color: `rgba(0,0,0,0.6)`, weight: 5, lineJoin: 'round'}).addTo(map).bindPopup(`Route based on ${dataTypeName} data with safety factor ${alpha}`, {autoClose: true})
                polylines.push(newPolyline); // Store the reference
                newPolyline = L.polyline(routeLatlng, {color: color, weight: 2, lineJoin: 'round'}).addTo(map).bindPopup(`Route based on ${dataTypeName} data with safety factor ${alpha}`, {autoClose: true})
                polylines.push(newPolyline); // Store the reference
            }

            if (keepLinesAlive) newPolyline.openPopup();

            // Zoom to the polyline
            if (zoomToRoute) map.fitBounds(newPolyline.getBounds(), {padding: [20, 20]});
            zoomToRoute = false;

        })
        .catch(error => console.error('Error:', error));
    } else {
        alert("Please select both start and end points on the map.");
    }
}


// Add event listener for automatic recalculation when alpha changes
document.getElementById('alphaSlider').addEventListener('change', calculatePath);

// Add event listener for automatic recalculation when data type changes
document.getElementById('dataTypeSelect').addEventListener('change', function() {addGraphLayer(map) });

// Add event listener for showing/hiding accident data
document.getElementById('showAccidentData').addEventListener('change', function() {addGraphLayer(map) });

// Add event listener for keeping lines alive
document.getElementById('keepLinesAlive').addEventListener('change', function() { calculatePath() });

function getColorForAlpha(alpha) {

    // Interpolate between colors based on alpha value
    let r, g;
    if (alpha <= 0.5) {
        // Interpolate between red (255,0,0) and yellow (255,255,0)
        r = 255;
        g = Math.round(2 * alpha * 255);
    } else {
        // Interpolate between yellow (255,255,0) and green (0,255,0)
        r = Math.round(255 * (1 - 2 * (alpha - 0.5)));
        g = 255;
    }
    return `rgba(${r},${g},0,0.9)`;
}

