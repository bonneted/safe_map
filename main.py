# %%
import matplotlib.pyplot as plt
import networkx as nx
import osmnx as ox
import numpy as np
import os
import plotly.graph_objects as go
import folium
from matplotlib.colors import LinearSegmentedColormap
from flask import Flask, render_template, request, jsonify
import geopandas as gpd
# from flask_cors import CORS

# %%
dir_path = os.path.dirname(os.path.realpath(__file__))
graph_path = os.path.join(dir_path,"..","data", "munich_with_predicted_accidents_all.graphml")
munich_graph_accident = ox.load_graphml(graph_path)

# Convert graph edges and nodes to GeoDataFrames
edges_gdf = ox.graph_to_gdfs(munich_graph_accident, nodes=False, edges=True)
nodes_gdf = ox.graph_to_gdfs(munich_graph_accident, nodes=True, edges=False)

# Save to GeoJSON (Alternatively, you can keep them in memory if you prefer)
# edges_gdf.to_file('edges.geojson', driver='GeoJSON')
# nodes_gdf.to_file('nodes.geojson', driver='GeoJSON')


for node in munich_graph_accident.nodes:
    munich_graph_accident.nodes[node]['num_accidents'] = float(munich_graph_accident.nodes[node]['num_accidents'])

for a,b,c in munich_graph_accident.edges:
    munich_graph_accident.edges[a,b,c]['num_accidents'] = float(munich_graph_accident.edges[a,b,c]['num_accidents'])
    munich_graph_accident.edges[a,b,c]['predicted_accidents'] = max(0,float(munich_graph_accident.edges[a,b,0]['predicted_accidents']))

for edge in munich_graph_accident.edges:
    munich_graph_accident.edges[edge]['total_accidents'] = munich_graph_accident.nodes[edge[0]]['num_accidents'] + munich_graph_accident.nodes[edge[1]]['num_accidents'] + munich_graph_accident.edges[edge]['num_accidents']

def get_route_cost(graph, route_nodes,cost_type='num_accidents'):
    route_edges = list(zip(route_nodes[:-1], route_nodes[1:]))
    edge_accidents_list = [data.get(cost_type, 0) if (u, v) in route_edges or (v, u) in route_edges else 0 for u, v, data in graph.edges(data=True)]
    nodes_accidents_list = [data.get(cost_type, 0) if node in route_nodes else 0 for node, data in graph.nodes(data=True)]
    total_accidents = sum(edge_accidents_list) + sum(nodes_accidents_list)
    return total_accidents

# # Convert graph edges and nodes to GeoDataFrames
# edges_gdf = ox.graph_to_gdfs(munich_graph_accident, nodes=False, edges=True)
# nodes_gdf = ox.graph_to_gdfs(munich_graph_accident, nodes=True, edges=False)

# edges_gdf = edges_gdf.drop(columns=['osmid',  'lanes', 'name', 'reversed', 'width'])

# # # Save to GeoJSON (Alternatively, you can keep them in memory if you prefer)
# edges_gdf.to_file('static/edges.geojson', driver='GeoJSON')
# nodes_gdf.to_file('static/nodes.geojson', driver='GeoJSON')


# %%



app = Flask(__name__)
# CORS(app)  # Enable CORS for all routes

@app.route('/')
def index():
    # Generate a Folium map
    marienplatz = (11.575448,48.137393)
    nympenburg = (11.503314,48.158268)

    bbox = [48.178301, 11.479089, 48.126705, 11.585432]
    start_coords = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
    folium_map = folium.Map(location=start_coords, zoom_start=14)
    
    # Draw bounding box
    folium.Rectangle(bounds=[(bbox[0], bbox[1]), (bbox[2], bbox[3])], color="red", fill=False).add_to(folium_map)
    
    # Render the map as HTML
    map_html = folium_map._repr_html_()
    
    return render_template('index.html', map_html=map_html)


# Route to handle path calculation
@app.route('/calculate_path', methods=['POST'])
def calculate_path():
    data = request.json
    start = data['start']
    end = data['end']
    data_type = data['data_type']
    alpha = float(data['alpha'])  # From 0 (shortest) to 1 (safest)

    nodes_start = ox.nearest_nodes(munich_graph_accident, X=start['lng'], Y=start['lat'])
    nodes_end = ox.nearest_nodes(munich_graph_accident, X=end['lng'], Y=end['lat'])

    for edge in munich_graph_accident.edges:
        munich_graph_accident.edges[edge]['cost'] = alpha * munich_graph_accident.edges[edge][data_type] + (1 - alpha) * munich_graph_accident.edges[edge]["length"]/250 

    route = nx.shortest_path(munich_graph_accident, nodes_start, nodes_end, weight='cost')
    route_latlng = [(munich_graph_accident.nodes[node]['y'], munich_graph_accident.nodes[node]['x']) for node in route]
    
    return jsonify(route_latlng)


if __name__ == '__main__':
    app.run(debug=True)