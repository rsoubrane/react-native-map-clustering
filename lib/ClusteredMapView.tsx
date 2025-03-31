import React, { memo, useState, useEffect, useMemo, useRef, forwardRef, ReactNode, MutableRefObject } from 'react';
import { Dimensions, LayoutAnimation, Platform, LayoutAnimationConfig } from 'react-native';
import MapView, { Polyline, MapViewProps, Region as RNMRegion, Details } from 'react-native-maps';
import SuperCluster from 'supercluster';
import ClusterMarker from './ClusteredMarker';
import {
	isMarker,
	markerToGeoJSONFeature,
	calculateBBox,
	returnMapZoom,
	generateSpiral,
	Region,
	MarkerData,
	SpiderMarker
} from './helpers';

export interface ClusteredMapViewProps extends MapViewProps {
	radius?: number;
	maxZoom?: number;
	minZoom?: number;
	minPoints?: number;
	extent?: number;
	nodeSize?: number;
	children?: ReactNode;
	onClusterPress?: (cluster: any, markers: any[]) => void;
	onRegionChangeComplete?: (region: Region, markers: MarkerData[] | Details) => void;
	onMarkersChange?: (markers: MarkerData[]) => void;
	preserveClusterPressBehavior?: boolean;
	clusteringEnabled?: boolean;
	clusterColor?: string;
	clusterTextColor?: string;
	clusterFontFamily?: string;
	spiderLineColor?: string;
	layoutAnimationConf?: LayoutAnimationConfig;
	animationEnabled?: boolean;
	renderCluster?: (props: any) => ReactNode;
	tracksViewChanges?: boolean;
	spiralEnabled?: boolean;
	superClusterRef?: MutableRefObject<SuperCluster | null>;
	edgePadding?: { top: number; left: number; right: number; bottom: number };
	selectedClusterId?: string;
	selectedClusterColor?: string;
	mapRef?: (ref: MapView | null) => void;
}

type ClusterFeature = GeoJSON.Feature<GeoJSON.Point> & {
	properties: {
		cluster?: boolean;
		cluster_id?: number;
		point_count: number;
		index: number;
		[key: string]: any;
	};
};

const ClusteredMapView = forwardRef<MapView, ClusteredMapViewProps>(
	(
		{
			radius = Dimensions.get('window').width * 0.06,
			maxZoom = 20,
			minZoom = 1,
			minPoints = 2,
			extent = 512,
			nodeSize = 64,
			children,
			onClusterPress = () => {},
			onRegionChangeComplete = () => {},
			onMarkersChange = () => {},
			preserveClusterPressBehavior = false,
			clusteringEnabled = true,
			clusterColor = '#00B386',
			clusterTextColor = '#FFFFFF',
			clusterFontFamily,
			spiderLineColor = '#FF0000',
			layoutAnimationConf = LayoutAnimation.Presets.spring,
			animationEnabled = true,
			renderCluster,
			tracksViewChanges = false,
			spiralEnabled = true,
			superClusterRef = { current: null },
			edgePadding = { top: 50, left: 50, right: 50, bottom: 50 },
			selectedClusterId,
			selectedClusterColor,
			mapRef = () => {},
			...restProps
		},
		ref
	) => {
		const [markers, updateMarkers] = useState<ClusterFeature[]>([]);
		const [spiderMarkers, updateSpiderMarker] = useState<SpiderMarker[]>([]);
		const [otherChildren, updateChildren] = useState<ReactNode[]>([]);
		const [superCluster, setSuperCluster] = useState<SuperCluster<any, any> | null>(null);
		const [currentRegion, updateRegion] = useState<Region>((restProps.region || restProps.initialRegion) as unknown as Region);

		const [isSpiderfier, updateSpiderfier] = useState<boolean>(false);
		const [clusterChildren, updateClusterChildren] = useState<ClusterFeature[] | null>(null);
		const mapRefCurrent = useRef<MapView | null>(null);

		const propsChildren = useMemo(() => React.Children.toArray(children), [children]);

		useEffect(() => {
			const rawData: SuperCluster.PointFeature<SuperCluster.AnyProps>[] = [];
			const otherChildren: ReactNode[] = [];

			if (!clusteringEnabled) {
				updateSpiderMarker([]);
				updateMarkers([]);
				updateChildren(propsChildren);
				setSuperCluster(null);
				return;
			}

			propsChildren.forEach((child, index) => {
				if (isMarker(child)) {
					const feature = markerToGeoJSONFeature(child, index);
					rawData.push({
						...feature,
						properties: feature.properties || {}
					});
				} else {
					otherChildren.push(child);
				}
			});

			const superCluster = new SuperCluster({
				radius,
				maxZoom,
				minZoom,
				minPoints,
				extent,
				nodeSize
			});

			superCluster.load(rawData);

			const bBox = calculateBBox(currentRegion);
			const zoom = returnMapZoom(currentRegion, bBox, minZoom);
			const markers = superCluster.getClusters(bBox, zoom) as ClusterFeature[];

			updateMarkers(markers);
			updateChildren(otherChildren);
			setSuperCluster(superCluster);

			if (superClusterRef) {
				superClusterRef.current = superCluster;
			}
		}, [propsChildren, clusteringEnabled]);

		useEffect(() => {
			if (!spiralEnabled) return;

			if (isSpiderfier && markers.length > 0) {
				const allSpiderMarkers: SpiderMarker[] = [];
				let spiralChildren: ClusterFeature[] = [];
				markers.forEach((marker, i) => {
					if (marker.properties.cluster && superCluster && marker.properties.cluster_id !== undefined) {
						spiralChildren = superCluster.getLeaves(marker.properties.cluster_id, Infinity) as ClusterFeature[];
					}
					const positions = generateSpiral(
						marker as unknown as MarkerData,
						spiralChildren,
						markers as unknown as MarkerData[],
						i
					);
					allSpiderMarkers.push(...positions);
				});

				updateSpiderMarker(allSpiderMarkers);
			} else {
				updateSpiderMarker([]);
			}
		}, [isSpiderfier, markers]);

		const _onRegionChangeComplete = (region: RNMRegion) => {
			const typedRegion: Region = region as unknown as Region;

			if (superCluster && typedRegion) {
				const bBox = calculateBBox(typedRegion);
				const zoom = returnMapZoom(typedRegion, bBox, minZoom);
				const clusteredMarkers = superCluster.getClusters(bBox, zoom) as ClusterFeature[];

				if (animationEnabled && Platform.OS === 'ios') {
					LayoutAnimation.configureNext(layoutAnimationConf);
				}

				if (zoom >= 18 && clusteredMarkers.length > 0 && clusterChildren) {
					if (spiralEnabled) updateSpiderfier(true);
				} else if (spiralEnabled) {
					updateSpiderfier(false);
				}

				updateMarkers(clusteredMarkers);
				onMarkersChange(clusteredMarkers as unknown as MarkerData[]);
				onRegionChangeComplete(typedRegion, clusteredMarkers as unknown as MarkerData[]);
				updateRegion(typedRegion);
			} else {
				onRegionChangeComplete(typedRegion, []);
			}
		};

		const _onClusterPress = (cluster: ClusterFeature) => () => {
			if (!superCluster) return;

			const children =
				cluster.properties.cluster_id !== undefined
					? (superCluster.getLeaves(cluster.properties.cluster_id, Infinity) as ClusterFeature[])
					: [];

			updateClusterChildren(children);

			if (preserveClusterPressBehavior) {
				onClusterPress(cluster, children);
				return;
			}

			const coordinates = children.map(({ geometry }) => ({
				latitude: geometry.coordinates[1],
				longitude: geometry.coordinates[0]
			}));

			mapRefCurrent.current?.fitToCoordinates(coordinates, {
				edgePadding
			});

			onClusterPress(cluster, children);
		};

		return (
			<MapView
				{...restProps}
				ref={(map) => {
					mapRefCurrent.current = map;
					if (ref) {
						if (typeof ref === 'function') {
							ref(map);
						} else {
							(ref as MutableRefObject<MapView | null>).current = map;
						}
					}
					mapRef(map);
				}}
				onRegionChangeComplete={_onRegionChangeComplete}>
				{markers.map((marker) =>
					marker.properties.point_count === 0 ? (
						propsChildren[marker.properties.index]
					) : !isSpiderfier ? (
						renderCluster ? (
							renderCluster({
								onPress: _onClusterPress(marker),
								clusterColor,
								clusterTextColor,
								clusterFontFamily,
								...marker
							})
						) : (
							<ClusterMarker
								key={`cluster-${marker.properties.cluster_id}`}
								{...marker}
								properties={{
									...marker.properties,
									cluster_id: marker.properties.cluster_id ?? -1
								}}
								geometry={{
									...marker.geometry,
									coordinates: marker.geometry.coordinates as [number, number]
								}}
								onPress={_onClusterPress(marker)}
								clusterColor={
									selectedClusterId === String(marker.properties.cluster_id)
										? selectedClusterColor || clusterColor
										: clusterColor
								}
								clusterTextColor={clusterTextColor}
								clusterFontFamily={clusterFontFamily}
								tracksViewChanges={tracksViewChanges}
							/>
						)
					) : null
				)}
				{otherChildren}
				{spiderMarkers.map((marker) => {
					return propsChildren[marker.index]
						? React.cloneElement(
								propsChildren[marker.index] as React.ReactElement,
								{
									key: `${marker.index}-${marker.latitude}-${marker.longitude}`,
									coordinate: {
										latitude: marker.latitude,
										longitude: marker.longitude
									},
									style: { zIndex: 1000 }
								} as any
							)
						: null;
				})}
				{spiderMarkers.map((marker, index) => (
					<Polyline
						key={index}
						coordinates={[marker.centerPoint, marker, marker.centerPoint]}
						strokeColor={spiderLineColor}
						strokeWidth={1}
					/>
				))}
			</MapView>
		);
	}
);

export default memo(ClusteredMapView);
