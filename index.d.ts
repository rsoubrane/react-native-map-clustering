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
