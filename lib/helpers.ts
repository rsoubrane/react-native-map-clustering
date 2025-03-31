import GeoViewport from '@mapbox/geo-viewport';
import { Dimensions } from 'react-native';
import { Region } from 'react-native-maps';
import { Feature, MarkerData, MarkerStyle } from './types';

const { width, height } = Dimensions.get('window');

/**
 * Checks if a child is a marker that can be clustered
 */
export const isMarker = (child: any): boolean => child?.props?.coordinate && child.props.cluster !== false;

/**
 * Calculates the bounding box for a map region
 */
export const calculateBBox = (region: Region): [number, number, number, number] => {
	let lngD: number;
	if (region.longitudeDelta < 0) lngD = region.longitudeDelta + 360;
	else lngD = region.longitudeDelta;

	return [
		region.longitude - lngD, // westLng - min lng
		region.latitude - region.latitudeDelta, // southLat - min lat
		region.longitude + lngD, // eastLng - max lng
		region.latitude + region.latitudeDelta // northLat - max lat
	];
};

/**
 * Returns the zoom level for a given region
 */
export const returnMapZoom = (region: Region, bBox: [number, number, number, number], minZoom: number): number => {
	const viewport = region.longitudeDelta >= 40 ? { zoom: minZoom } : GeoViewport.viewport(bBox, [width, height]);

	return viewport.zoom;
};

/**
 * Converts a marker to a GeoJSON feature
 */
export const markerToGeoJSONFeature = (marker: any, index: number): Feature => {
	return {
		type: 'Feature',
		geometry: {
			coordinates: [marker.props.coordinate.longitude, marker.props.coordinate.latitude],
			type: 'Point'
		},
		properties: {
			point_count: 0,
			index,
			..._removeChildrenFromProps(marker.props)
		}
	};
};

/**
 * Generates a spiral pattern for displaying markers in a cluster
 */
export const generateSpiral = (marker: Feature, clusterChildren: Feature[], markers: Feature[], index: number): MarkerData[] => {
	const { properties, geometry } = marker;
	const count = properties.point_count;
	const centerLocation = geometry.coordinates;

	const res: MarkerData[] = [];
	let angle = 0;
	let start = 0;

	// Calculate starting point in the children array
	for (let i = 0; i < index; i++) {
		start += markers[i].properties.point_count || 0;
	}

	// Generate spiral positions for each marker
	for (let i = 0; i < count; i++) {
		angle = 0.25 * (i * 0.5);
		const latitude = centerLocation[1] + 0.0002 * angle * Math.cos(angle);
		const longitude = centerLocation[0] + 0.0002 * angle * Math.sin(angle);

		if (clusterChildren[i + start]) {
			res.push({
				index: clusterChildren[i + start].properties.index,
				longitude,
				latitude,
				centerPoint: {
					latitude: centerLocation[1],
					longitude: centerLocation[0]
				}
			});
		}
	}

	return res;
};

/**
 * Returns the style for a cluster marker based on the number of points
 */
export const returnMarkerStyle = (points: number): MarkerStyle => {
	if (points >= 50) {
		return {
			width: 84,
			height: 84,
			size: 64,
			fontSize: 20
		};
	}

	if (points >= 25) {
		return {
			width: 78,
			height: 78,
			size: 58,
			fontSize: 19
		};
	}

	if (points >= 15) {
		return {
			width: 72,
			height: 72,
			size: 54,
			fontSize: 18
		};
	}

	if (points >= 10) {
		return {
			width: 66,
			height: 66,
			size: 50,
			fontSize: 17
		};
	}

	if (points >= 8) {
		return {
			width: 60,
			height: 60,
			size: 46,
			fontSize: 17
		};
	}

	if (points >= 4) {
		return {
			width: 54,
			height: 54,
			size: 40,
			fontSize: 16
		};
	}

	return {
		width: 48,
		height: 48,
		size: 36,
		fontSize: 15
	};
};

/**
 * Removes the children prop from marker props
 */
const _removeChildrenFromProps = (props: Record<string, any>): Record<string, any> => {
	const newProps: Record<string, any> = {};
	for (const key of Object.keys(props)) {
		if (key !== 'children') {
			newProps[key] = props[key];
		}
	}
	return newProps;
};

/**
 * Ensures that coordinates from SuperCluster are in the correct format
 */
// Define the Position type as an array of numbers (e.g., [longitude, latitude])
type Position = [number, number];

export const ensureCoordinates = (coords: Position): [number, number] => {
	if (!coords || coords.length < 2) return [0, 0];
	return [coords[0], coords[1]];
};

/**
 * Converts SuperCluster features to our Feature type
 */
export const convertClusterToFeature = (cluster: any): Feature => {
	return {
		type: 'Feature',
		geometry: {
			type: 'Point',
			coordinates: ensureCoordinates(cluster.geometry.coordinates)
		},
		properties: {
			...cluster.properties,
			point_count: cluster.properties.point_count || 0
		},
		id: cluster.id
	};
};

/**
 * Converts an array of SuperCluster features to our Feature[] type
 */
export const convertToFeatureArray = (clusters: any[]): Feature[] => {
	if (!clusters || !Array.isArray(clusters)) return [];

	return clusters.map((cluster) => {
		// Handle the case where coordinates might be undefined or not an array with enough elements
		let coordinates: [number, number] = [0, 0];

		if (
			cluster.geometry &&
			cluster.geometry.coordinates &&
			Array.isArray(cluster.geometry.coordinates) &&
			cluster.geometry.coordinates.length >= 2
		) {
			coordinates = [cluster.geometry.coordinates[0], cluster.geometry.coordinates[1]];
		}

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates
			},
			properties: {
				...cluster.properties,
				point_count: cluster.properties.point_count || 0
			},
			id: cluster.id
		};
	});
};
