// Export components
export { default as ClusteredMapView } from './lib/ClusteredMapView';
export { default as ClusterMarker } from './lib/ClusteredMarker';

// Export helper functions
export {
	isMarker,
	calculateBBox,
	returnMapZoom,
	markerToGeoJSONFeature,
	generateSpiral,
	returnMarkerStyle,
	ensureCoordinates
} from './lib/helpers';

// Export types for consumers
export type {
	ClusteredMapProps,
	ClusterMarkerProps,
	Feature,
	MarkerData,
	MarkerStyle,
	SuperClusterType,
	SuperClusterOptions,
	EdgePadding
} from './lib/types';

// Default export for backward compatibility
export { default } from './lib/ClusteredMapView';
