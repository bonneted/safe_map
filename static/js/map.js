// static/js/map.js

var map; // Define map globally at the top of the file
var startMarker, endMarker;
var polylines = []; // Array to store references to all polylines
var accidentsOnRoads = false;
var accidentsCoord = false;
var BlackBackground = false;
var zoomToRoute = false;

var colors = ['#009900', '#ffff00', '#ff9900', '#ff0000']; // From green to red
var labels = ['0', '0-1', '1-2', '> 2']; 

var legend = L.control({position: 'bottomright'});

legend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend'),
        values = ["0", "0-1", "1-2", "> 2"];
    var labels = [];

    // HTML for the checkboxes
    var checkboxesHtml = `
        <div class="checkboxes">
            <h4>Show accidents :</h4>
            <input type="checkbox" id="accidentsCoords">
            <label for="accidentsCoords">coords</label><br>
            <input type="checkbox" id="accidentsPerRoads" checked>
            <label for="accidentsPerRoads">per roads</label><br>
            <input type="checkbox" id="mapBackground" >
            <label for="mapBackground">background</label>
        </div>
    `;

    // Generate a label with a colored square for each interval
    for (var i = 0; i < values.length; i++) {
        labels.push('<div class="item"><i style="background:' + colors[i] + '"></i> ' + values[i] + '</div>');
    }

    // Combine checkboxes HTML with the legend labels
    div.innerHTML = checkboxesHtml + labels.join(' ')
    L.DomEvent.disableClickPropagation(div);
    return div;
}


function getColorForAccidents(numAccidents) {
    if (numAccidents > 2) return '#ff0000'; // red for more than 50 accidents
    else if (numAccidents > 1) return '#ff9900'; // orange for 21-50 accidents
    else if (numAccidents > 0) return '#ffff00'; // yellow for 11-20 accidents
    else return '#009900'; // green for 0-10 accidents
}

function setLayersOrder() {
    if (accidentsOnRoads) accidentsOnRoads.bringToFront();
    if (accidentsCoord) accidentsCoord.bringToFront();
    if (polylines.length > 0) polylines.forEach(polyline => polyline.bringToFront());
}


function toggleAccidentsOnRoads(map) {
    if (!document.getElementById('accidentsPerRoads').checked) {
        if (accidentsOnRoads){
            map.removeLayer(accidentsOnRoads);
            accidentsOnRoads = false;
        }
    } else {
    document.getElementById('loader').style.display = 'flex';
    fetch('/static/data/edges.geojson')
    .then(response => response.json())
    .then(data => {
        if (accidentsOnRoads) {
            map.removeLayer(accidentsOnRoads);
        }
        var dataType = document.getElementById('dataTypeSelect').value;
        accidentsOnRoads = L.geoJson(data, {
            style: function(feature) {
                var numAccidents = feature.properties[dataType];
                var color = getColorForAccidents(numAccidents);
                return {color: color, weight: 2};
            }
        }).addTo(map);
        setLayersOrder();
    })
    .finally(() => document.getElementById('loader').style.display = 'none');
    }
}

function toggleAccidentsCoord(map) {
    if (!document.getElementById('accidentsCoords').checked) {
        if (accidentsCoord){
            map.removeLayer(accidentsCoord);
            accidentsCoord = false;
        }
    } else if (!accidentsCoord) {
    document.getElementById('loader').style.display = 'flex';
    fetch('/static/data/munich_accidents_2018_2022.geojson')
    .then(response => response.json())
    .then(data => {
        if (accidentsCoord) {
            map.removeLayer(accidentsCoord);
        }
        accidentsCoord = L.geoJson(data, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 3,
                    weight: 0,
                    opacity: 0.5,
                    fillOpacity: 0.5
                });
            }
        }).addTo(map);
        setLayersOrder();
    })
    .finally(() => document.getElementById('loader').style.display = 'none');
    }
}


function toggleBackground(map) {
    var isChecked = document.getElementById('mapBackground').checked;
    
    if (isChecked) {
        // Check if the blackBackground already exists; if not, create it
        if (!BlackBackground) {
            // Define bounds that cover the entire world
            var bounds = [[-90, -180], [90, 180]];
            // Create a rectangle covering the entire map with a black fill
            BlackBackground = L.rectangle(bounds, {color: "#000", weight: 1, fillOpacity: 1}).addTo(map);
            // Ensure it goes behind any other map features
            BlackBackground.bringToBack();
        } else {
            // If it exists but is not on the map, add it
            BlackBackground.addTo(map);
            BlackBackground.bringToBack();
        }
    } else {
        // If the checkbox is not checked and the layer exists, remove it
        if (BlackBackground) {
            map.removeLayer(BlackBackground);
        }
    }
}
    


function initializeMap() {
    map = L.map('mapid').setView([48.152726, 11.532033], 13.8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    var bbox = [[48.178301, 11.479089], [48.126705, 11.585432]];
    var bounds = L.latLngBounds(bbox[0], bbox[1]);
    // Create a rectangle with red fill on the bounds
    var redRectangle = L.rectangle(bounds, {color: "red", weight: 3, fill : false}).addTo(map);


    // First route calculation
    var marienplatz = L.latLng(48.137393,11.575448)
    var nympenburg = L.latLng(48.158268,11.503314)
    startMarker = L.marker(marienplatz).addTo(map).bindPopup("Marienplatz", {autoClose: false}).openPopup();
    endMarker = L.marker(nympenburg).addTo(map).bindPopup("Nymphenburg",{autoClose: false}).openPopup();



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
        } else {
            L.popup().setLatLng(e.latlng).setContent('Please select a point within the red rectangle').openOn(map);
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
    endMarker = L.marker(nympenburg).addTo(map).bindPopup("Nymphenburg").openPopup();

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

document.getElementById('dataTypeSelect').addEventListener('change', function() {showData(map) });
document.getElementById('showAccidentData').addEventListener('change', function() {
    if (document.getElementById('showAccidentData').checked) {
        legend.addTo(map); // Adjust based on your needs; you might want to always show or conditionally show the legend
        document.getElementById('accidentsCoords').addEventListener('change', function() { toggleAccidentsCoord(map); });
        document.getElementById('accidentsPerRoads').addEventListener('change', function() { toggleAccidentsOnRoads(map); });
        document.getElementById('mapBackground').addEventListener('change', function() { toggleBackground(map); });
        toggleAccidentsCoord(map);
        toggleAccidentsOnRoads(map);
        toggleBackground(map);
    } else {
        if (accidentsOnRoads) map.removeLayer(accidentsOnRoads);
        if (accidentsCoord) map.removeLayer(accidentsCoord);
        if (legend) map.removeControl(legend);
    }
});


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

// Get the modal
var modal = document.getElementById("helpModal");

// Get the button that opens the modal
var btn = document.getElementById("helpBtn");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the page loads, open the modal
window.onload = function() {
    modal.style.display = "grid";
}

// When the user clicks the button, open the modal 
btn.onclick = function() {
    modal.style.display = "grid";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
    modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}



