import ClusteredMapView from './lib/ClusteredMapView';

// Export the main component
export default ClusteredMapView;
export { ClusteredMapView };

// Export type definitions for usage in consumer applications
export type {
	ClusteredMapProps,
	Feature,
	MarkerData,
	GeoJsonPoint,
	ClusterMarkerProps,
	EdgePadding,
	SuperClusterOptions
} from './lib/types';
