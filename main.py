# %%

import networkx as nx
import osmnx as ox
import os
from flask import Flask, render_template, request, jsonify
# import geopandas as gpd
# from flask_cors import CORS

# %%
dir_path = os.path.dirname(os.path.realpath(__file__))
graph_path = os.path.join(dir_path,"static", "munich_with_predicted_accidents_all.graphml")
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

    return render_template('index.html')


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
    route_latlngs = []

    for i in range(len(route) - 1):
        u, v = route[i], route[i + 1]
        edge_data = munich_graph_accident.get_edge_data(u, v)
        
        # Get the first (or only) edge's geometry
        key = next(iter(edge_data))
        geom = edge_data[key].get('geometry', None)
        
        # If the edge has a geometry, extend the route_latlngs list with its coordinates
        if geom:
            coords = list(geom.coords)
            route_latlngs.extend([(lat, lng) for lng, lat in coords])
        else:
            # Fallback to node positions if no geometry is found
            start_y, start_x = munich_graph_accident.nodes[u]['y'], munich_graph_accident.nodes[u]['x']
            end_y, end_x = munich_graph_accident.nodes[v]['y'], munich_graph_accident.nodes[v]['x']
            route_latlngs.extend([(start_y, start_x), (end_y, end_x)])

    # Deduplicate consecutive coordinates
    route_latlngs = [route_latlngs[i] for i in range(len(route_latlngs)) if i == 0 or route_latlngs[i] != route_latlngs[i-1]]

    
    return jsonify(route_latlngs)


if __name__ == '__main__':
    app.run(debug=True)