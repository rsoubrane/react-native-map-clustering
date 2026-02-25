import GeoViewport from '@mapbox/geo-viewport';
import type { ReactElement, ReactNode } from 'react';
import { Dimensions } from 'react-native';
import type { ClusterFeature, MarkerData, MarkerStyle, Region, SpiderMarker } from './types';

const { width, height } = Dimensions.get('window');

interface MarkerElement {
	props: {
		coordinate: { latitude: number; longitude: number };
		cluster?: boolean;
		children?: ReactNode;
		[key: string]: unknown;
	};
}

const isMarkerElement = (child: ReactNode): child is ReactElement<MarkerElement['props']> => {
	if (!child || typeof child !== 'object' || !('props' in child)) return false;
	const props = (child as ReactElement).props as Record<string, unknown>;
	return !!props.coordinate && props.cluster !== false;
};

export { isMarkerElement as isMarker };

export const calculateBBox = (region: Region): [number, number, number, number] => {
	const lngD = region.longitudeDelta < 0 ? region.longitudeDelta + 360 : region.longitudeDelta;

	return [
		region.longitude - lngD,
		region.latitude - region.latitudeDelta,
		region.longitude + lngD,
		region.latitude + region.latitudeDelta
	];
};

export const returnMapZoom = (region: Region, bBox: [number, number, number, number], minZoom: number): number => {
	const viewport = region.longitudeDelta >= 40 ? { zoom: minZoom } : GeoViewport.viewport(bBox, [width, height]);
	return viewport.zoom;
};

export const markerToGeoJSONFeature = (
	marker: ReactElement<MarkerElement['props']>,
	index: number
): { type: 'Feature'; geometry: { coordinates: [number, number]; type: 'Point' }; properties: Record<string, unknown> } => {
	const { children: _, ...props } = marker.props;
	return {
		type: 'Feature',
		geometry: {
			coordinates: [props.coordinate.longitude, props.coordinate.latitude],
			type: 'Point'
		},
		properties: {
			point_count: 0,
			index,
			...props
		}
	};
};

const ANGLE_CACHE: ReadonlyMap<string, { cos: number; sin: number }> = (() => {
	const map = new Map<string, { cos: number; sin: number }>();
	for (let i = 0; i < 200; i += 0.25) {
		const angle = 0.25 * (i * 0.5);
		map.set(angle.toFixed(2), {
			cos: Math.cos(angle),
			sin: Math.sin(angle)
		});
	}
	return map;
})();

const getCachedTrig = (angle: number): { cos: number; sin: number } => {
	return ANGLE_CACHE.get(angle.toFixed(2)) ?? { cos: Math.cos(angle), sin: Math.sin(angle) };
};

export const generateSpiral = (
	marker: MarkerData,
	clusterChildren: ClusterFeature[],
	markers: MarkerData[],
	index: number
): SpiderMarker[] => {
	const { properties, geometry } = marker;
	const count = properties.point_count;
	const centerLocation = geometry.coordinates;

	const centerPoint = {
		latitude: centerLocation[1],
		longitude: centerLocation[0]
	};

	if (count > 500) {
		const sampleSize = 75;
		const sampleStep = Math.floor(count / sampleSize);
		const spiralDensity = 0.0006;
		const result: SpiderMarker[] = [];

		for (let i = 0; i < sampleSize; i++) {
			const child = clusterChildren[i * sampleStep];
			if (!child?.properties || typeof child.properties.index !== 'number') continue;

			const angle = 0.25 * (i * 0.5);
			const { cos: cosAngle, sin: sinAngle } = getCachedTrig(angle);

			result.push({
				index: child.properties.index,
				longitude: centerLocation[0] + spiralDensity * angle * sinAngle,
				latitude: centerLocation[1] + spiralDensity * angle * cosAngle,
				centerPoint
			});
		}

		return result;
	}

	const maxSpiderPoints = count > 200 ? 75 : count > 100 ? 50 : count;
	const res: SpiderMarker[] = [];

	let start = 0;
	if (index > 0) {
		for (let i = 0; i < index; i++) {
			start += markers[i].properties.point_count || 0;
		}
	}

	const spiralDensity = count > 100 ? 0.0004 : count > 50 ? 0.0003 : 0.00025;
	const step = count > maxSpiderPoints ? Math.floor(count / maxSpiderPoints) : 1;
	const positions = Math.min(count, maxSpiderPoints);

	for (let i = 0; i < positions; i++) {
		const actualIndex = i * step;
		const angle = 0.25 * (actualIndex * 0.5);
		const { cos: cosAngle, sin: sinAngle } = getCachedTrig(angle);

		const child = clusterChildren[actualIndex + start];
		if (!child?.properties || typeof child.properties.index !== 'number') continue;

		res.push({
			index: child.properties.index,
			longitude: centerLocation[0] + spiralDensity * angle * sinAngle,
			latitude: centerLocation[1] + spiralDensity * angle * cosAngle,
			centerPoint
		});
	}

	return res;
};

const MARKER_STYLES: Record<number, MarkerStyle> = {
	4: { width: 54, height: 54, size: 40, fontSize: 16 },
	8: { width: 60, height: 60, size: 46, fontSize: 17 },
	10: { width: 66, height: 66, size: 50, fontSize: 17 },
	15: { width: 72, height: 72, size: 54, fontSize: 18 },
	25: { width: 78, height: 78, size: 58, fontSize: 19 },
	50: { width: 84, height: 84, size: 64, fontSize: 20 },
	100: { width: 90, height: 90, size: 70, fontSize: 22 }
};

const DEFAULT_STYLE: MarkerStyle = {
	width: 48,
	height: 48,
	size: 36,
	fontSize: 15
};

export const returnMarkerStyle = (points: number): MarkerStyle => {
	if (MARKER_STYLES[points]) return MARKER_STYLES[points];
	if (points > 100) return MARKER_STYLES[100];
	if (points > 50) return MARKER_STYLES[50];
	if (points > 25) return MARKER_STYLES[25];
	if (points > 15) return MARKER_STYLES[15];
	if (points > 10) return MARKER_STYLES[10];
	if (points > 8) return MARKER_STYLES[8];
	if (points > 4) return MARKER_STYLES[4];
	return DEFAULT_STYLE;
};
