import React, {
	forwardRef,
	type MutableRefObject,
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { Dimensions, LayoutAnimation, Platform, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { type MapMarkerProps, Polyline, type Region as RNMRegion } from 'react-native-maps';
import SuperCluster from 'supercluster';
import ClusterMarker from './clustered-marker';
import { calculateBBox, generateSpiral, isMarker, markerToGeoJSONFeature, returnMapZoom } from './helpers';
import type { ClusteredMapViewProps, ClusterFeature, Feature, GeoJsonPoint, MarkerData, Region, SpiderMarker } from './types';

const { width, height } = Dimensions.get('window');

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
		const [superCluster, setSuperCluster] = useState<SuperCluster | null>(null);
		const [currentRegion, updateRegion] = useState<Region>((restProps.region || restProps.initialRegion) as unknown as Region);

		const [isSpiderfier, updateSpiderfier] = useState<boolean>(false);
		const [clusterChildren, updateClusterChildren] = useState<ClusterFeature[] | null>(null);
		const mapRefCurrent = useRef<MapView | null>(null);
		const currentRegionRef = useRef<Region>(currentRegion);
		const superClusterRef_ = useRef<SuperCluster | null>(null);
		const externalClusterRef = useRef(superClusterRef);

		useLayoutEffect(() => {
			currentRegionRef.current = currentRegion;
		}, [currentRegion]);

		useLayoutEffect(() => {
			superClusterRef_.current = superCluster;
		}, [superCluster]);

		const propsChildren = useMemo(() => React.Children.toArray(children), [children]);

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

			let cancelled = false;

			const processChildrenInBatch = () => {
				const batchSize = 500;
				const totalChildren = propsChildren.length;
				let processedCount = 0;

				const processNextBatch = () => {
					if (cancelled) return;

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
						if (!cancelled) createCluster();
					}
				};

				processNextBatch();
			};

			const createCluster = () => {
				const cluster = new SuperCluster(clusterOptions);
				cluster.load(rawData);

				const region = currentRegionRef.current;
				const bBox = calculateBBox(region);
				const zoom = returnMapZoom(region, bBox, minZoom);
				const markers = cluster.getClusters(bBox, zoom) as ClusterFeature[];

				updateMarkers(markers);
				updateChildren(otherChildren);
				setSuperCluster(cluster);

				if (externalClusterRef.current) {
					externalClusterRef.current.current = cluster;
				}
			};

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
				processChildrenInBatch();
			}

			return () => {
				cancelled = true;
			};
		}, [propsChildren, clusteringEnabled, clusterOptions, minZoom]);

		useEffect(() => {
			if (!spiralEnabled) return;

			if (!isSpiderfier || markers.length === 0) {
				if (spiderMarkers.length > 0) {
					updateSpiderMarker([]);
				}
				return;
			}

			const generateSpiderMarkers = () => {
				const allSpiderMarkers: SpiderMarker[] = [];
				const processedClusters = new Set<number>();

				const markersToProcess = markers.length > 100 ? markers.slice(0, 100) : markers;

				markersToProcess.forEach((marker, i) => {
					if (!marker.properties.cluster || !marker.properties.cluster_id) return;

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

			if (Platform.OS === 'web') {
				generateSpiderMarkers();
			} else {
				requestAnimationFrame(generateSpiderMarkers);
			}
		}, [isSpiderfier, markers, spiralEnabled, superCluster, spiderMarkers.length]);

		const handleRegionChangeComplete = useCallback(
			(region: RNMRegion) => {
				const typedRegion: Region = region as unknown as Region;

				if (!superCluster || !typedRegion) {
					const emptyMarkers: Feature[] = [];
					if (typeof onRegionChangeComplete === 'function') {
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

				requestAnimationFrame(() => {
					if (typeof onMarkersChange === 'function') {
						onMarkersChange(clusteredMarkers as Feature[]);
					}
					if (typeof onRegionChangeComplete === 'function') {
						onRegionChangeComplete(typedRegion, clusteredMarkers as Feature[]);
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

		const handleClusterPress = useCallback(
			(cluster: ClusterFeature) => () => {
				const sc = superClusterRef_.current;
				if (!sc || !mapRefCurrent.current) return;

				const clusterId = cluster.properties.cluster_id;
				if (clusterId === undefined) {
					updateClusterChildren([]);
					if (typeof onClusterPress === 'function') {
						onClusterPress(cluster as Feature, []);
					}
					return;
				}

				const leaves = sc.getLeaves(clusterId, Infinity) as ClusterFeature[];
				updateClusterChildren(leaves);

				if (preserveClusterPressBehavior) {
					requestAnimationFrame(() => {
						if (typeof onClusterPress === 'function') {
							onClusterPress(cluster as Feature, leaves as Feature[]);
						}
					});
					return;
				}

				try {
					const expansionZoom = Math.min(sc.getClusterExpansionZoom(clusterId), maxZoom);
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
						onClusterPress(cluster as Feature, leaves as Feature[]);
					}
				} catch {
					requestAnimationFrame(() => {
						const coordinates = leaves.map(({ geometry }) => ({
							latitude: geometry.coordinates[1],
							longitude: geometry.coordinates[0]
						}));

						if (coordinates.length > 0) {
							mapRefCurrent.current?.fitToCoordinates(coordinates, { edgePadding });
						}
						if (typeof onClusterPress === 'function') {
							onClusterPress(cluster as Feature, leaves as Feature[]);
						}
					});
				}
			},
			[preserveClusterPressBehavior, maxZoom, edgePadding, onClusterPress]
		);

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
			<MapView {...restProps} ref={setMapRef} onRegionChangeComplete={handleRegionChangeComplete}>
				{markers.map((marker, idx) => {
					if (!marker || !marker.properties) {
						return null;
					}

					const key = `marker-item-${marker.properties.cluster_id ?? marker.properties.index ?? idx}`;

					if (marker.properties.point_count === 0) {
						const markerIndex = marker.properties.index;
						if (typeof markerIndex === 'number' && markerIndex >= 0 && markerIndex < propsChildren.length) {
							const childElement = propsChildren[markerIndex];
							if (React.isValidElement(childElement)) {
								return React.cloneElement(childElement as React.ReactElement<{ key?: string }>, { key });
							}
						}
						return null;
					}

					if (isSpiderfier) {
						return null;
					}

					if (renderCluster) {
						return renderCluster({
							...marker,
							key,
							onPress: handleClusterPress(marker),
							clusterColor,
							clusterTextColor,
							clusterFontFamily
						});
					}

					const geometry = marker.geometry;
					const coordinates = geometry?.coordinates;

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
							geometry={marker.geometry as GeoJsonPoint}
							properties={marker.properties}
							onPress={handleClusterPress(marker)}
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
				{spiderMarkers.map((marker) => {
					if (!marker || typeof marker.index !== 'number' || marker.index < 0 || marker.index >= propsChildren.length) {
						return null;
					}
					const childElement = propsChildren[marker.index] as React.ReactElement<MapMarkerProps>;
					if (React.isValidElement(childElement)) {
						const newProps: Partial<MapMarkerProps> & { key: string; style?: StyleProp<ViewStyle> } = {
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
				{spiderMarkers.map((marker, index) => {
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
