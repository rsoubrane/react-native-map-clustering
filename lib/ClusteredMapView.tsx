import React, { memo, useState, useEffect, useMemo, useRef, forwardRef, ReactNode, MutableRefObject, useCallback } from 'react';
import { Dimensions, LayoutAnimation, Platform, LayoutAnimationConfig } from 'react-native';
import MapView, { Polyline, MapViewProps, Region as RNMRegion, Details, MapMarkerProps } from 'react-native-maps';
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
import { GeoJsonPoint, Feature as ClusterMapFeature } from './types';

const { width, height } = Dimensions.get('window');

// ----------------------------------------------------------------------

export interface ClusteredMapViewProps extends MapViewProps {
	radius?: number;
	maxZoom?: number;
	minZoom?: number;
	minPoints?: number;
	extent?: number;
	nodeSize?: number;
	children?: ReactNode;
	onClusterPress?: (cluster: ClusterMapFeature, markers: ClusterMapFeature[]) => void;
	onRegionChangeComplete?: (region: Region, markers: ClusterMapFeature[] | Details) => void;
	onMarkersChange?: (markers: ClusterMapFeature[]) => void;
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

		// Memoize cluster options to avoid recreating the cluster unnecessarily
		const clusterOptions = useMemo(
			() => ({
				radius,
				maxZoom,
				minZoom,
				minPoints,
				extent,
				nodeSize
			}),
			[radius, maxZoom, minZoom, minPoints, extent, nodeSize]
		);

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

			// Process children in batches for better performance with large datasets
			const processChildrenInBatch = () => {
				const batchSize = 500;
				const totalChildren = propsChildren.length;
				let processedCount = 0;

				const processNextBatch = () => {
					const endIndex = Math.min(processedCount + batchSize, totalChildren);

					for (let i = processedCount; i < endIndex; i++) {
						const child = propsChildren[i];
						if (isMarker(child)) {
							const feature = markerToGeoJSONFeature(child, i);
							rawData.push({
								...feature,
								properties: feature.properties || {}
							});
						} else {
							otherChildren.push(child);
						}
					}

					processedCount = endIndex;

					if (processedCount < totalChildren) {
						setTimeout(processNextBatch, 0);
					} else {
						// All children processed, create the cluster
						createCluster();
					}
				};

				// Start processing
				processNextBatch();
			};

			const createCluster = () => {
				const superCluster = new SuperCluster(clusterOptions);

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
			};

			// For small datasets, process synchronously
			if (propsChildren.length <= 1000) {
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
				createCluster();
			} else {
				// For large datasets, process in batches
				processChildrenInBatch();
			}
		}, [propsChildren, clusteringEnabled, clusterOptions, currentRegion, minZoom]);

		useEffect(() => {
			if (!spiralEnabled) return;

			// Skip unnecessary calculations if not in spider mode or no markers
			if (!isSpiderfier || markers.length === 0) {
				if (spiderMarkers.length > 0) {
					updateSpiderMarker([]);
				}
				return;
			}

			// Defer spider calculations to next frame for UI responsiveness
			const generateSpiderMarkers = () => {
				const allSpiderMarkers: SpiderMarker[] = [];
				const processedClusters = new Set<number>();

				// Only process clusters with reasonable sizes or limit processing
				const markersToProcess = markers.length > 100 ? markers.slice(0, 100) : markers;

				markersToProcess.forEach((marker, i) => {
					if (!marker.properties.cluster || !marker.properties.cluster_id) return;

					// Skip already processed clusters
					if (processedClusters.has(marker.properties.cluster_id)) return;
					processedClusters.add(marker.properties.cluster_id);

					let spiralChildren: ClusterFeature[] = [];
					if (superCluster) {
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
			};

			// Use requestAnimationFrame for smoother UI
			if (Platform.OS === 'web') {
				generateSpiderMarkers();
			} else {
				requestAnimationFrame(generateSpiderMarkers);
			}
		}, [isSpiderfier, markers, spiralEnabled, superCluster, spiderMarkers.length]);

		const _onRegionChangeComplete = useCallback(
			(region: RNMRegion) => {
				const typedRegion: Region = region as unknown as Region;

				if (!superCluster || !typedRegion) {
					// Ensure onRegionChangeComplete is called with Feature[] if it expects it, or handle Details
					const emptyMarkers: ClusterMapFeature[] = [];
					if (typeof onRegionChangeComplete === 'function') {
						// Assuming Details is not the primary path when superCluster is null
						onRegionChangeComplete(typedRegion, emptyMarkers);
					}
					return;
				}

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
				updateRegion(typedRegion);

				// Defer callbacks to next frame to keep UI responsive
				requestAnimationFrame(() => {
					if (typeof onMarkersChange === 'function') {
						onMarkersChange(clusteredMarkers as ClusterMapFeature[]);
					}
					if (typeof onRegionChangeComplete === 'function') {
						onRegionChangeComplete(typedRegion, clusteredMarkers as ClusterMapFeature[]);
					}
				});
			},
			[
				superCluster,
				minZoom,
				animationEnabled,
				layoutAnimationConf,
				spiralEnabled,
				clusterChildren,
				onMarkersChange,
				onRegionChangeComplete
			]
		);

		const _onClusterPress = useCallback(
			(cluster: ClusterFeature) => () => {
				if (!superCluster || !mapRefCurrent.current) return;

				const clusterId = cluster.properties.cluster_id;
				if (clusterId === undefined) {
					updateClusterChildren([]);
					if (typeof onClusterPress === 'function') {
						onClusterPress(cluster as ClusterMapFeature, []);
					}
					return;
				}

				const leaves = superCluster.getLeaves(clusterId, Infinity) as ClusterFeature[];
				updateClusterChildren(leaves);

				// For preserveClusterPressBehavior, just handle callback directly
				if (preserveClusterPressBehavior) {
					requestAnimationFrame(() => {
						if (typeof onClusterPress === 'function') {
							onClusterPress(cluster as ClusterMapFeature, leaves as ClusterMapFeature[]);
						}
					});
					return;
				}

				// For better performance, immediately animate to the ideal zoom level
				try {
					const expansionZoom = Math.min(superCluster.getClusterExpansionZoom(clusterId), maxZoom);
					const [lng, lat] = cluster.geometry.coordinates;

					const latDelta = 100 / 2 ** (expansionZoom - 1);
					const lngDelta = latDelta * (width / height);

					mapRefCurrent.current.animateToRegion(
						{
							latitude: lat,
							longitude: lng,
							latitudeDelta: latDelta,
							longitudeDelta: lngDelta
						},
						250
					);

					if (typeof onClusterPress === 'function') {
						onClusterPress(cluster as ClusterMapFeature, leaves as ClusterMapFeature[]);
					}
				} catch {
					// Fallback to original behavior if expansion zoom fails
					requestAnimationFrame(() => {
						const coordinates = leaves.map(({ geometry }) => ({
							latitude: geometry.coordinates[1],
							longitude: geometry.coordinates[0]
						}));

						if (coordinates.length > 0) {
							mapRefCurrent.current?.fitToCoordinates(coordinates, { edgePadding });
						}
						if (typeof onClusterPress === 'function') {
							onClusterPress(cluster as ClusterMapFeature, leaves as ClusterMapFeature[]);
						}
					});
				}
			},
			[superCluster, preserveClusterPressBehavior, maxZoom, edgePadding, onClusterPress, width, height] // Added width, height
		);

		// Use memoized ref callback to avoid unnecessary re-renders
		const setMapRef = useCallback(
			(map: MapView | null) => {
				mapRefCurrent.current = map;
				if (ref) {
					if (typeof ref === 'function') {
						ref(map);
					} else {
						(ref as MutableRefObject<MapView | null>).current = map;
					}
				}
				mapRef(map);
			},
			[ref, mapRef]
		);

		return (
			<MapView {...restProps} ref={setMapRef} onRegionChangeComplete={_onRegionChangeComplete}>
				{markers &&
					Array.isArray(markers) &&
					markers.map((marker, idx) => {
						// Basic safety check for marker and its properties
						if (!marker || !marker.properties) {
							return null;
						}

						const key = `marker-item-${marker.properties.cluster_id ?? marker.properties.index ?? idx}`;

						// Handle individual markers (not clusters)
						if (marker.properties.point_count === 0) {
							const markerIndex = marker.properties.index;
							if (typeof markerIndex === 'number' && markerIndex >= 0 && markerIndex < propsChildren.length) {
								const childElement = propsChildren[markerIndex];
								if (React.isValidElement(childElement)) {
									// Ensure the childElement accepts a key prop
									return React.cloneElement(childElement as React.ReactElement<{ key?: string }>, { key });
								}
							}
							return null;
						}

						// Handle clusters
						if (isSpiderfier) {
							return null;
						}

						if (renderCluster) {
							return renderCluster({
								...marker,
								key,
								onPress: _onClusterPress(marker),
								clusterColor,
								clusterTextColor,
								clusterFontFamily
							});
						}

						const geometry = marker.geometry;
						const coordinates = geometry?.coordinates;

						// This check ensures coordinates is [number, number]
						if (
							!geometry ||
							!Array.isArray(coordinates) ||
							coordinates.length !== 2 ||
							typeof coordinates[0] !== 'number' ||
							typeof coordinates[1] !== 'number'
						) {
							return null;
						}

						return (
							<ClusterMarker
								key={key}
								// After the above check, marker.geometry conforms to GeoJsonPoint structure for coordinates
								geometry={marker.geometry as GeoJsonPoint}
								properties={marker.properties}
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
						);
					})}
				{otherChildren}
				{spiderMarkers &&
					Array.isArray(spiderMarkers) &&
					spiderMarkers.map((marker) => {
						if (!marker || typeof marker.index !== 'number' || marker.index < 0 || marker.index >= propsChildren.length) {
							return null;
						}
						const childElement = propsChildren[marker.index] as React.ReactElement<MapMarkerProps>; // Cast to a more specific type
						if (React.isValidElement(childElement)) {
							const newProps: Partial<MapMarkerProps> & { key: string; style?: any } = {
								key: `spider-${marker.index}-${marker.latitude}-${marker.longitude}`,
								coordinate: {
									latitude: marker.latitude,
									longitude: marker.longitude
								},
								style: {
									...(typeof childElement.props.style === 'object' && childElement.props.style !== null
										? childElement.props.style
										: {}),
									zIndex: 1000
								}
							};
							return React.cloneElement(childElement, newProps);
						}
						return null;
					})}
				{spiderMarkers &&
					Array.isArray(spiderMarkers) &&
					spiderMarkers.map((marker, index) => {
						if (
							!marker ||
							!marker.centerPoint ||
							typeof marker.latitude !== 'number' ||
							typeof marker.longitude !== 'number' ||
							typeof marker.centerPoint.latitude !== 'number' ||
							typeof marker.centerPoint.longitude !== 'number'
						) {
							return null;
						}
						return (
							<Polyline
								key={`poly-${index}`}
								coordinates={[
									{ latitude: marker.centerPoint.latitude, longitude: marker.centerPoint.longitude },
									{ latitude: marker.latitude, longitude: marker.longitude },
									{ latitude: marker.centerPoint.latitude, longitude: marker.centerPoint.longitude }
								]}
								strokeColor={spiderLineColor}
								strokeWidth={1}
							/>
						);
					})}
			</MapView>
		);
	}
);

export default memo(ClusteredMapView);
