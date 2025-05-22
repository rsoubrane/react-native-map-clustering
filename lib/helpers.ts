import { ReactNode } from 'react';
import { Dimensions } from 'react-native';
import GeoViewport from '@mapbox/geo-viewport';

// ----------------------------------------------------------------------

const { width, height } = Dimensions.get('window');

export interface Region {
	latitude: number;
	longitude: number;
	latitudeDelta: number;
	longitudeDelta: number;
}

export interface MarkerData {
	properties: {
		point_count: number;
		index: number;
		[key: string]: any;
	};
	geometry: {
		coordinates: [number, number]; // [longitude, latitude]
	};
}

export interface MarkerProps {
	coordinate: {
		latitude: number;
		longitude: number;
	};
	cluster?: boolean;
	[key: string]: any;
}

export interface SpiderMarker {
	index: number;
	longitude: number;
	latitude: number;
	centerPoint: {
		latitude: number;
		longitude: number;
	};
}

export interface ClusterStyleProps {
	width: number;
	height: number;
	size: number;
	fontSize: number;
}

export const isMarker = (child: ReactNode): boolean => {
	return !!(child && (child as any).props && (child as any).props.coordinate && (child as any).props.cluster !== false);
};

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

export const returnMapZoom = (region: Region, bBox: [number, number, number, number], minZoom: number): number => {
	const viewport = region.longitudeDelta >= 40 ? { zoom: minZoom } : GeoViewport.viewport(bBox, [width, height]);
	return viewport.zoom;
};

export const markerToGeoJSONFeature = (marker: any, index: number): any => {
	// Avoid object spread for better performance
	const props = _removeChildrenFromProps(marker.props);
	return {
		type: 'Feature',
		geometry: {
			coordinates: [marker.props.coordinate.longitude, marker.props.coordinate.latitude],
			type: 'Point'
		},
		properties: {
			point_count: 0,
			index,
			...props
		}
	};
};

// Pre-calculate cosine and sine values for common angles for faster spiral generation
const ANGLE_CACHE: Record<string, { cos: number; sin: number }> = {};
for (let i = 0; i < 200; i += 0.25) {
	const angle = 0.25 * (i * 0.5);
	ANGLE_CACHE[angle.toFixed(2)] = {
		cos: Math.cos(angle),
		sin: Math.sin(angle)
	};
}

export const generateSpiral = (marker: MarkerData, clusterChildren: any[], markers: MarkerData[], index: number): SpiderMarker[] => {
	const { properties, geometry } = marker;
	const count = properties.point_count;
	const centerLocation = geometry.coordinates;

	// Performance optimization for extremely large clusters
	if (count > 500) {
		// For extremely large clusters, just generate a sample of locations
		// to prevent browser slowdown
		const sampleSize = 75; // Fixed sample size for giant clusters
		const sampleStep = Math.floor(count / sampleSize);

		// Pre-calculate everything needed for the spiral
		const centerPoint = {
			latitude: centerLocation[1],
			longitude: centerLocation[0]
		};

		// Use higher density for fewer points so they spread out more
		const spiralDensity = 0.0006;
		const result: SpiderMarker[] = [];

		// Sample evenly through the cluster children
		for (let i = 0; i < sampleSize; i++) {
			const childIndex = i * sampleStep;
			if (!clusterChildren[childIndex]) continue;

			const angle = 0.25 * (i * 0.5);

			// Use cached trig values when possible (huge performance boost)
			const angleKey = angle.toFixed(2);
			const { cos: cosAngle, sin: sinAngle } = ANGLE_CACHE[angleKey] || { cos: Math.cos(angle), sin: Math.sin(angle) };

			if (
				clusterChildren[childIndex] &&
				clusterChildren[childIndex].properties &&
				typeof clusterChildren[childIndex].properties.index === 'number'
			) {
				result.push({
					index: clusterChildren[childIndex].properties.index,
					longitude: centerLocation[0] + spiralDensity * angle * sinAngle,
					latitude: centerLocation[1] + spiralDensity * angle * cosAngle,
					centerPoint
				});
			}
		}

		return result;
	}

	// For very large clusters, limit the number of rendered spider legs for performance
	const maxSpiderPoints = count > 200 ? 75 : count > 100 ? 50 : count;

	const res: SpiderMarker[] = [];
	let angle = 0;

	// Avoid unnecessary calculations by skipping start index computation if it's not needed
	let start = 0;
	if (index > 0) {
		// Fast start index calculation with caching
		if (index < markers.length / 2) {
			// For markers in the first half, iterate forward
			for (let i = 0; i < index; i++) {
				start += markers[i].properties.point_count || 0;
			}
		} else {
			// For markers in the second half, use sum difference optimization
			start = 0;
			for (let i = 0; i < markers.length; i++) {
				if (i < index) {
					start += markers[i].properties.point_count || 0;
				}
			}
		}
	}

	// Pre-calculate centerPoint for reuse
	const centerPoint = {
		latitude: centerLocation[1],
		longitude: centerLocation[0]
	};

	// Adaptive spiral density based on cluster size
	const spiralDensity = count > 100 ? 0.0004 : count > 50 ? 0.0003 : 0.00025;

	// Calculate step size once
	const step = count > maxSpiderPoints ? Math.floor(count / maxSpiderPoints) : 1;
	const positions = Math.min(count, maxSpiderPoints);

	// Use object pooling to reduce GC pressure
	const point = { latitude: 0, longitude: 0 };

	// Batch creation of all markers
	for (let i = 0; i < positions; i++) {
		const actualIndex = i * step;
		angle = 0.25 * (actualIndex * 0.5);

		// Use cached trig values when possible (huge performance boost)
		const angleKey = angle.toFixed(2);
		const cached = ANGLE_CACHE[angleKey];
		const cosAngle = cached ? cached.cos : Math.cos(angle);
		const sinAngle = cached ? cached.sin : Math.sin(angle);

		point.latitude = centerLocation[1] + spiralDensity * angle * cosAngle;
		point.longitude = centerLocation[0] + spiralDensity * angle * sinAngle;

		const childIndex = actualIndex + start;
		if (
			clusterChildren[childIndex] &&
			clusterChildren[childIndex].properties &&
			typeof clusterChildren[childIndex].properties.index === 'number'
		) {
			res.push({
				index: clusterChildren[childIndex].properties.index,
				longitude: point.longitude,
				latitude: point.latitude,
				centerPoint
			});
		}
	}

	return res;
};

// Create a lookup table for marker styles for common cluster sizes
const MARKER_STYLES: Record<number, ClusterStyleProps> = {
	4: { width: 54, height: 54, size: 40, fontSize: 16 },
	8: { width: 60, height: 60, size: 46, fontSize: 17 },
	10: { width: 66, height: 66, size: 50, fontSize: 17 },
	15: { width: 72, height: 72, size: 54, fontSize: 18 },
	25: { width: 78, height: 78, size: 58, fontSize: 19 },
	50: { width: 84, height: 84, size: 64, fontSize: 20 },
	100: { width: 90, height: 90, size: 70, fontSize: 22 }
};

// Default style for small clusters
const DEFAULT_STYLE: ClusterStyleProps = {
	width: 48,
	height: 48,
	size: 36,
	fontSize: 15
};

/**
 * Optimized marker style calculation that uses a lookup table for common values
 * to avoid repetitive condition checks for better performance with large datasets
 */
export const returnMarkerStyle = (points: number): ClusterStyleProps => {
	// Check common sizes first
	if (MARKER_STYLES[points]) {
		return MARKER_STYLES[points];
	}

	// For very large clusters, cap the size
	if (points > 100) {
		return MARKER_STYLES[100];
	}

	// For intermediate values, find the closest lower bound
	if (points > 50) return MARKER_STYLES[50];
	if (points > 25) return MARKER_STYLES[25];
	if (points > 15) return MARKER_STYLES[15];
	if (points > 10) return MARKER_STYLES[10];
	if (points > 8) return MARKER_STYLES[8];
	if (points > 4) return MARKER_STYLES[4];

	// Default style for small clusters
	return DEFAULT_STYLE;
};

const _removeChildrenFromProps = (props: any): object => {
	const { children, ...newProps } = props;
	return newProps;
};
