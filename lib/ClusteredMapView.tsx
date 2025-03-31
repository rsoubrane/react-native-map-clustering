import React, { memo, useState, useEffect, useMemo, useRef, forwardRef } from 'react';
import { Dimensions, LayoutAnimation, Platform } from 'react-native';
import MapView, { Polyline, Region } from 'react-native-maps';
import SuperCluster from 'supercluster';
import ClusterMarker from './ClusteredMarker';
import { isMarker, markerToGeoJSONFeature, calculateBBox, returnMapZoom, generateSpiral, convertToFeatureArray } from './helpers';
import { ClusteredMapProps, Feature, MarkerData, SuperClusterOptions } from './types';

/**
 * A map view that automatically clusters markers based on zoom level
 */
const ClusteredMapView = forwardRef<MapView, ClusteredMapProps>(
	(
		{
			// SuperCluster options
			radius = Dimensions.get('window').width * 0.06,
			maxZoom = 20,
			minZoom = 1,
			minPoints = 2,
			extent = 512,
			nodeSize = 64,

			// Content
			children,

			// Callbacks
			onClusterPress = () => {},
			onRegionChangeComplete = () => {},
			onMarkersChange = () => {},

			// Behavior
			preserveClusterPressBehavior = false,
			clusteringEnabled = true,

			// Styling
			clusterColor = '#00B386',
			clusterTextColor = '#FFFFFF',
			clusterFontFamily,
			spiderLineColor = '#FF0000',

			// Animation
			layoutAnimationConf = LayoutAnimation.Presets.spring,
			animationEnabled = true,

			// Customization
			renderCluster,
			tracksViewChanges = false,
			spiralEnabled = true,

			// Refs
			superClusterRef,
			edgePadding = { top: 50, left: 50, right: 50, bottom: 50 },

			// Selection
			selectedClusterId,
			selectedClusterColor,

			// Map ref
			mapRef: externalMapRef = () => {},

			...restProps
		},
		ref
	) => {
		// State management optimizations with proper typing
		const [markers, updateMarkers] = useState<Feature[]>([]);
		const [spiderMarkers, updateSpiderMarker] = useState<MarkerData[]>([]);
		const [otherChildren, updateChildren] = useState<React.ReactNode[]>([]);
		const [superCluster, setSuperCluster] = useState<SuperCluster | null>(null);
		const [currentRegion, updateRegion] = useState<Region | undefined>(
			restProps.region ? (restProps.region as Region) : restProps.initialRegion
		);
		const [isSpiderfier, updateSpiderfier] = useState(false);
		const [clusterChildren, updateClusterChildren] = useState<Feature[] | null>(null);
		const mapRef = useRef<MapView | null>(null);

		// Memoize children to prevent unnecessary re-renders
		const propsChildren = useMemo(() => React.Children.toArray(children), [children]);

		// Initialize SuperCluster with proper typing and memoization
		useEffect(() => {
			const rawData: Feature[] = [];
			const otherChildrenNodes: React.ReactNode[] = [];

			// Skip clustering if disabled
			if (!clusteringEnabled) {
				updateSpiderMarker([]);
				updateMarkers([]);
				updateChildren(propsChildren);
				setSuperCluster(null);
				return;
			}

			// Separate markers from other children
			propsChildren.forEach((child, index) => {
				if (isMarker(child)) {
					rawData.push(markerToGeoJSONFeature(child, index));
				} else {
					otherChildrenNodes.push(child);
				}
			});

			// Configure SuperCluster with proper typing
			const clusterOptions: SuperClusterOptions = {
				radius,
				maxZoom,
				minZoom,
				minPoints,
				extent,
				nodeSize
			};

			const cluster = new SuperCluster(clusterOptions);
			cluster.load(rawData);

			// Calculate initial clusters if region exists
			if (currentRegion) {
				const bBox = calculateBBox(currentRegion as Region);
				const zoom = returnMapZoom(currentRegion as Region, bBox, minZoom);
				const rawClusters = cluster.getClusters(bBox, zoom);
				const clusterMarkers = convertToFeatureArray(rawClusters);

				updateMarkers(clusterMarkers);
				updateChildren(otherChildrenNodes);
				setSuperCluster(cluster);

				// Update ref if provided
				if (superClusterRef) {
					// @ts-ignore
					superClusterRef.current = cluster;
				}
			}
		}, [propsChildren, clusteringEnabled, radius, maxZoom, minZoom, minPoints, extent, nodeSize, currentRegion]);

		useEffect(() => {
			if (!spiralEnabled || !superCluster) return;

			if (isSpiderfier && markers.length > 0) {
				const allSpiderMarkers: MarkerData[] = [];

				markers.forEach((marker, i) => {
					if (marker.properties.cluster && marker.properties.cluster_id !== undefined) {
						const spiralChildren = superCluster.getLeaves(marker.properties.cluster_id, Infinity);

						// @ts-ignore
						const positions = generateSpiral(marker, spiralChildren, markers, i);
						allSpiderMarkers.push(...positions);
					}
				});

				updateSpiderMarker(allSpiderMarkers);
			} else {
				updateSpiderMarker([]);
			}
		}, [isSpiderfier, markers, superCluster, spiralEnabled]);

		const _onRegionChangeComplete = (region: Region) => {
			if (superCluster && region) {
				const bBox = calculateBBox(region);
				const zoom = returnMapZoom(region, bBox, minZoom);
				const rawClusters = superCluster.getClusters(bBox, zoom);
				const clusterMarkers = convertToFeatureArray(rawClusters);

				if (animationEnabled && Platform.OS === 'ios') {
					LayoutAnimation.configureNext(layoutAnimationConf);
				}

				if (zoom >= 18 && clusterMarkers.length > 0 && clusterChildren) {
					if (spiralEnabled) updateSpiderfier(true);
				} else if (spiralEnabled) updateSpiderfier(false);

				updateMarkers(clusterMarkers);
				onMarkersChange(clusterMarkers);
				// @ts-ignore
				onRegionChangeComplete(region, clusterMarkers);
				updateRegion(region);
			} else {
				// @ts-ignore
				onRegionChangeComplete(region);
			}
		};

		const _onClusterPress = (cluster: Feature) => () => {
			if (!superCluster || cluster.properties.cluster_id === undefined) return;

			const rawChildren = superCluster.getLeaves(cluster.properties.cluster_id, Infinity);
			const children = convertToFeatureArray(rawChildren);
			updateClusterChildren(children);

			if (preserveClusterPressBehavior) {
				onClusterPress(cluster, children);
				return;
			}

			const coordinates = children.map(({ geometry }) => ({
				latitude: geometry.coordinates[1],
				longitude: geometry.coordinates[0]
			}));

			mapRef.current?.fitToCoordinates(coordinates, {
				edgePadding
			});

			onClusterPress(cluster, children);
		};

		return (
			<MapView
				{...restProps}
				ref={(map) => {
					if (map) {
						mapRef.current = map;
						if (ref) {
							if (typeof ref === 'function') {
								ref(map);
							} else {
								ref.current = map;
							}
						}
						externalMapRef(map);
					}
				}}
				onRegionChangeComplete={_onRegionChangeComplete}>
				{markers.map((marker) => {
					if (marker.properties.point_count === 0) {
						return propsChildren[marker.properties.index!];
					}

					if (!isSpiderfier && marker.properties.cluster) {
						if (renderCluster) {
							return renderCluster({
								onPress: _onClusterPress(marker),
								clusterColor:
									selectedClusterId === marker.properties.cluster_id
										? selectedClusterColor || clusterColor
										: clusterColor,
								clusterTextColor,
								clusterFontFamily,
								tracksViewChanges: tracksViewChanges,
								...marker
							});
						}

						return (
							<ClusterMarker
								key={`cluster-${marker.properties.cluster_id}`}
								{...marker}
								onPress={_onClusterPress(marker)}
								clusterColor={
									selectedClusterId === marker.properties.cluster_id ? selectedClusterColor || clusterColor : clusterColor
								}
								clusterTextColor={clusterTextColor}
								clusterFontFamily={clusterFontFamily}
								tracksViewChanges={tracksViewChanges}
							/>
						);
					}

					return null;
				})}

				{otherChildren}

				{spiderMarkers.map((marker: MarkerData, index: number) => {
					const child = propsChildren[marker.index!];
					return child
						? React.cloneElement(child as React.ReactElement<any>, {
								key: `spider-${marker.index}-${index}`,
								coordinate: {
									latitude: marker.latitude,
									longitude: marker.longitude
								}
							})
						: null;
				})}

				{spiderMarkers.map((marker: MarkerData, index: number) => (
					<Polyline
						key={`spider-line-${index}`}
						coordinates={[marker.centerPoint!, { latitude: marker.latitude, longitude: marker.longitude }]}
						strokeColor={spiderLineColor}
						strokeWidth={1}
					/>
				))}
			</MapView>
		);
	}
);

export default memo(ClusteredMapView);
