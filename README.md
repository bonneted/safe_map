# Safe Route
A routing algorithm that takes safety into account.
[![Safe Route GUI](https://github.com/bonneted/safe_map/blob/main/static/img/SafeRoutePreview.png)](https://flask-production-73d6.up.railway.app/)

### How to Use This Tool

- **Plotting a Route:** Click on the map twice to set the starting and ending points for your route.
- **Choose Data Type:** Choose between "collected" accident data or "predicted" risk based on road properties.
- **Adjust Risk Coefficient:** Use the slider to weigh the safety importance in the route calculation.
- **Keep Routes Alive:** Enable this option to display multiple routes simultaneously.
- **Show Data:** Plot accidents coordinates and/or roads risk scores on the map.

### More Information

This routing algorithm was developed during a hackathon organized within the Greydient ITN project. For more information, please visit the [Greydient website](https://www.greydient.eu/).

The objective was to incorporate safety considerations into the routing algorithm by using a database of recorded accidents. The initial step involved mapping the accident data onto the road network sourced from OpenStreetMap using a nearest neighbor search technique. This allowed for the calculation of the number of accidents encountered along each route, forming the basis of a cost function termed "collected data". Secondly, we established statistical correlations between road attributes (such as road type, speed limit, and number of lanes, all from OpenStreetMap) and the frequency of accidents. These statistics were used to assign a risk score to each road segment, thereby creating a more robust cost function, referred to as "predicted data", that compensates for non-representative data. The effectiveness of this approach is demonstrated by the reduction in unnecessary detours when switching from collected to predicted data.

**Note:** To be truly relevant, the accident data should be weighted by the traffic volume. This is not the case here, but it could be added in the future.
