import type { MutableRefObject, ReactNode } from 'react';
import type { LayoutAnimationConfig } from 'react-native';
import type MapView from 'react-native-maps';
import type { LatLng, MapViewProps } from 'react-native-maps';
import type SuperCluster from 'supercluster';

export interface Region {
	latitude: number;
	longitude: number;
	latitudeDelta: number;
	longitudeDelta: number;
}

export interface GeoJsonPoint {
	type: 'Point';
	coordinates: [number, number];
}

export interface Feature {
	type: 'Feature';
	geometry: GeoJsonPoint;
	properties: {
		point_count: number;
		point_count_abbreviated?: string;
		index?: number;
		cluster_id?: number;
		cluster?: boolean;
		[key: string]: unknown;
	};
	id?: number | string;
}

export interface ClusterFeature extends Feature {
	properties: {
		cluster?: boolean;
		cluster_id?: number;
		point_count: number;
		index: number;
		[key: string]: unknown;
	};
	geometry: GeoJsonPoint;
}

export interface SpiderMarker extends LatLng {
	index: number;
	centerPoint: LatLng;
}

export interface MarkerData {
	properties: {
		point_count: number;
		index: number;
		[key: string]: unknown;
	};
	geometry: {
		coordinates: [number, number];
	};
}

export interface MarkerStyle {
	width: number;
	height: number;
	size: number;
	fontSize: number;
}

export interface ClusterRenderProps {
	geometry: GeoJsonPoint;
	properties: {
		point_count: number;
		cluster_id?: number;
		cluster?: boolean;
		[key: string]: unknown;
	};
	key: string;
	onPress: () => void;
	clusterColor: string;
	clusterTextColor: string;
	clusterFontFamily?: string;
}

export interface ClusterMarkerProps {
	geometry: GeoJsonPoint;
	properties: {
		point_count: number;
		cluster_id?: number;
		cluster?: boolean;
		[key: string]: unknown;
	};
	onPress: () => void;
	clusterColor: string;
	clusterTextColor: string;
	clusterFontFamily?: string;
	tracksViewChanges: boolean;
}

export interface EdgePadding {
	top: number;
	left: number;
	right: number;
	bottom: number;
}

export interface ClusteredMapViewProps extends Omit<MapViewProps, 'onRegionChangeComplete'> {
	clusteringEnabled?: boolean;
	spiralEnabled?: boolean;
	animationEnabled?: boolean;
	preserveClusterPressBehavior?: boolean;
	tracksViewChanges?: boolean;

	layoutAnimationConf?: LayoutAnimationConfig;

	radius?: number;
	maxZoom?: number;
	minZoom?: number;
	extent?: number;
	nodeSize?: number;
	minPoints?: number;

	edgePadding?: EdgePadding;

	clusterColor?: string;
	clusterTextColor?: string;
	clusterFontFamily?: string;
	selectedClusterId?: string;
	selectedClusterColor?: string;
	spiderLineColor?: string;

	superClusterRef?: MutableRefObject<SuperCluster | null>;
	mapRef?: (ref: MapView | null) => void;
	onClusterPress?: (cluster: Feature, markers?: Feature[]) => void;
	onMarkersChange?: (markers: Feature[]) => void;
	onRegionChangeComplete?: (region: Region, markers?: Feature[]) => void;
	renderCluster?: (props: ClusterRenderProps) => ReactNode;

	children?: ReactNode;
}
