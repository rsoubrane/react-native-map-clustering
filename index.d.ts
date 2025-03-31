declare module 'rs-react-native-map-clustering' {
	import * as React from 'react';
	import { LayoutAnimationConfig } from 'react-native';
	import MapView, { MapMarker, MapViewProps } from 'react-native-maps';
	import SuperCluster from 'supercluster';

	export interface Region {
		latitude: number;
		longitude: number;
		latitudeDelta: number;
		longitudeDelta: number;
	}

	export interface MarkerData {
		properties: {
			cluster?: boolean;
			cluster_id?: number;
			point_count: number;
			index: number;
			[key: string]: any;
		};
		geometry: {
			coordinates: [number, number]; // [longitude, latitude]
			type: string;
		};
		type?: string;
	}

	export type Cluster = Record<string, any>;

	export interface ClusteredMapViewProps extends MapViewProps {
		radius?: number;
		maxZoom?: number;
		minZoom?: number;
		minPoints?: number;
		extent?: number;
		nodeSize?: number;
		children?: React.ReactNode;
		onClusterPress?: (cluster: Cluster, markers: MapMarker[]) => void;
		onRegionChangeComplete?: (region: Region, details: any) => void;
		onMarkersChange?: (markers: MarkerData[]) => void;
		preserveClusterPressBehavior?: boolean;
		clusteringEnabled?: boolean;
		clusterColor?: string;
		clusterTextColor?: string;
		clusterFontFamily?: string;
		spiderLineColor?: string;
		layoutAnimationConf?: LayoutAnimationConfig;
		animationEnabled?: boolean;
		renderCluster?: (props: any) => React.ReactNode;
		tracksViewChanges?: boolean;
		spiralEnabled?: boolean;
		superClusterRef?: React.MutableRefObject<SuperCluster | null>;
		edgePadding?: { top: number; left: number; right: number; bottom: number };
		selectedClusterId?: string;
		selectedClusterColor?: string;
		mapRef?: (ref: MapView | null) => void;
	}

	export default class ClusteredMapView extends React.Component<ClusteredMapViewProps> {}
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
		[key: string]: any;
	};
	id?: number;
}

export interface MarkerData extends LatLng {
	centerPoint?: LatLng;
	index?: number;
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

export interface SuperClusterType extends SuperCluster {
	getClusterExpansionZoom(clusterId: number): number;
	getCluster(clusterId: number): Feature;
	getLeaves(clusterId: number, limit?: number, offset?: number): Feature[];
	getClusters(bbox: BBox, zoom: number): Feature[];
	load(points: GeoJSON.Feature<GeoJSON.Point>[]): SuperClusterType;
}

export interface ClusteredMapViewProps extends MapViewProps {
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
	onRegionChangeComplete?: (region: Region, details: any) => void;
	renderCluster?: (props: ClusterMarkerProps) => ReactNode;
}

export class ClusteredMapView extends Component<ClusteredMapViewProps> {}
export default ClusteredMapView;
