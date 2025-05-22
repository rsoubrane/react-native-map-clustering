import { ReactNode, RefObject } from 'react';
import { LayoutAnimationConfig } from 'react-native';
import { Region, LatLng, MapViewProps, AnimatedRegion } from 'react-native-maps';
import SuperCluster from 'supercluster';

// ----------------------------------------------------------------------

// Add a MapRegion type that can handle both Region and AnimatedRegion
export type MapRegion = Region | AnimatedRegion;

// Update GeoJsonPoint to be compatible with SuperCluster
export interface GeoJsonPoint {
	type: 'Point';
	coordinates: [number, number]; // [longitude, latitude]
}

// Update Feature to be compatible with SuperCluster's PointFeature
export interface Feature {
	type: 'Feature';
	geometry: GeoJsonPoint;
	properties: {
		point_count: number;
		point_count_abbreviated?: string;
		index?: number;
		cluster_id?: number;
		cluster?: boolean;
		[key: string]: any;
	};
	id?: number | string;
}

// Strongly typed ClusterFeature to minimize type assertions
export interface ClusterFeature extends Feature {
	properties: {
		cluster?: boolean;
		cluster_id?: number;
		point_count: number;
		index: number;
		[key: string]: any;
	};
	geometry: GeoJsonPoint;
}

export interface MarkerData extends LatLng {
	centerPoint?: LatLng;
	index?: number;
}

export interface MarkerStyle {
	width: number;
	height: number;
	size: number;
	fontSize: number;
}

export interface ClusterMarkerProps {
	geometry: GeoJsonPoint;
	properties: {
		point_count: number;
		cluster_id?: number;
		cluster?: boolean;
		[key: string]: any;
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

export interface SuperClusterOptions {
	radius?: number;
	maxZoom?: number;
	minZoom?: number;
	minPoints?: number;
	extent?: number;
	nodeSize?: number;
}

// Add compatibility with SuperCluster types
export interface SuperClusterType extends SuperCluster<Record<string, any>, Record<string, any>> {
	getClusterExpansionZoom(clusterId: number): number;
	getCluster(clusterId: number): Feature;
	getLeaves(clusterId: number, limit?: number, offset?: number): Feature[];
	getClusters(bbox: number[], zoom: number): Feature[];
	load(points: Feature[]): SuperClusterType;
}

export interface ClusteredMapProps extends MapViewProps {
	// Clustering options
	clusteringEnabled?: boolean;
	spiralEnabled?: boolean;
	animationEnabled?: boolean;
	preserveClusterPressBehavior?: boolean;
	tracksViewChanges?: boolean;

	// Animation
	layoutAnimationConf?: LayoutAnimationConfig;

	// SuperCluster options
	radius?: number;
	maxZoom?: number;
	minZoom?: number;
	extent?: number;
	nodeSize?: number;
	minPoints?: number;

	// Map options
	edgePadding?: EdgePadding;

	// Styling
	clusterColor?: string;
	clusterTextColor?: string;
	clusterFontFamily?: string;
	selectedClusterId?: string | number;
	selectedClusterColor?: string;
	spiderLineColor?: string;

	// Refs and callbacks
	superClusterRef?: RefObject<SuperClusterType>;
	mapRef?: (ref: any) => void;
	onClusterPress?: (cluster: Feature, markers?: Feature[]) => void;
	onMarkersChange?: (markers: Feature[]) => void;
	onRegionChangeCompleteCustom?: (region: Region, markers?: Feature[]) => void;

	// Children
	children?: ReactNode;

	/**
	 * Custom render function for clusters
	 */
	renderCluster?: (cluster: Feature) => React.ReactNode;
}
