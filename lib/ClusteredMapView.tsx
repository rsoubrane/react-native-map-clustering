import React, { memo, useState, useEffect, useMemo, useRef, forwardRef, useCallback } from 'react';
import { Dimensions, LayoutAnimation, Platform } from 'react-native';
import MapView, { Polyline, Region } from 'react-native-maps';
import SuperCluster from 'supercluster';
import ClusterMarker from './ClusteredMarker';
import { isMarker, markerToGeoJSONFeature, calculateBBox, returnMapZoom, generateSpiral, ensureCoordinates } from './helpers';
import { ClusteredMapProps, Feature, MarkerData, SuperClusterType } from './types';

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
		// State management with proper typing
		const [markers, updateMarkers] = useState<Feature[]>([]);
		const [spiderMarkers, updateSpiderMarker] = useState<MarkerData[]>([]);
		const [otherChildren, updateOtherChildren] = useState<React.ReactNode[]>([]);
		const [clusterChildren, updateClusterChildren] = useState<Feature[]>([]);
		const [superCluster, setSuperCluster] = useState<SuperClusterType | null>(null);
		const [isSpiderfier, setSpiderfier] = useState<boolean>(false);
		const [region, updateRegion] = useState<Region>((restProps.region || restProps.initialRegion) as Region);

		// Internal references
		const mapRefInternal = useRef<MapView>(null);
		const currentRegionRef = useRef(region);

		// Combine refs for external and internal use
		const combinedRef = useCallback(
			(mapViewRef: MapView | null) => {
				// Store ref internally
				if (mapViewRef) {
					mapRefInternal.current = mapViewRef;

					// Forward ref to parent if needed
					if (ref) {
						if (typeof ref === 'function') {
							ref(mapViewRef);
						} else {
							ref.current = mapViewRef;
						}
					}

					// Also call the external mapRef callback
					externalMapRef(mapViewRef);
				}
			},
			[ref, externalMapRef]
		);

		/**
		 * Processes children to extract markers and other components
		 */
		const processChildren = useCallback(() => {
			// Skip processing if clustering is disabled
			if (!clusteringEnabled) {
				updateOtherChildren(React.Children.toArray(children));
				updateMarkers([]);
				return;
			}

			const rawMarkers: Feature[] = [];
			const otherChildrenArray: React.ReactNode[] = [];

			React.Children.forEach(children, (child, index) => {
				if (isMarker(child)) {
					rawMarkers.push(markerToGeoJSONFeature(child, index));
				} else {
					otherChildrenArray.push(child);
				}
			});

			// Initialize SuperCluster
			const cluster = new SuperCluster({
				radius,
				maxZoom,
				minZoom,
				minPoints,
				extent,
				nodeSize
			}) as SuperClusterType;

			// Load points into the cluster
			cluster.load(rawMarkers);

			// Calculate visible markers based on the current region
			let markersInView: Feature[] = [];
			if (currentRegionRef.current) {
				const bbox = calculateBBox(currentRegionRef.current);
				const zoom = returnMapZoom(currentRegionRef.current, bbox, minZoom);
				markersInView = cluster.getClusters(bbox, Math.floor(zoom));
			}

			// Update state
			setSuperCluster(cluster);
			updateMarkers(markersInView);
			updateOtherChildren(otherChildrenArray);

			// Pass superCluster reference to parent if needed
			if (superClusterRef) {
				superClusterRef.current = cluster;
			}

			// Notify parent of marker changes
			onMarkersChange(markersInView);
		}, [children, clusteringEnabled, radius, maxZoom, minZoom, minPoints, extent, nodeSize, superClusterRef, onMarkersChange]);

		/**
		 * Handles region change to update visible markers
		 */
		const handleRegionChangeComplete = useCallback(
			(newRegion: Region) => {
				if (!superCluster || !newRegion) return;

				// Store current region in ref for future use
				currentRegionRef.current = newRegion;
				updateRegion(newRegion);

				// Calculate visible markers based on new region
				const bbox = calculateBBox(newRegion);
				const zoom = returnMapZoom(newRegion, bbox, minZoom);
				const newMarkers = superCluster.getClusters(bbox, Math.floor(zoom));

				// Apply animation on region change if enabled
				if (animationEnabled && Platform.OS === 'ios') {
					LayoutAnimation.configureNext(layoutAnimationConf);
				}

				// Handle spiderfier at high zoom levels
				if (zoom >= 18 && newMarkers.some((m) => m.properties.cluster) && spiralEnabled) {
					setSpiderfier(true);
				} else {
					setSpiderfier(false);
					updateClusterChildren([]);
				}

				// Update markers
				updateMarkers(newMarkers);

				// Notify parent of region and marker changes
				// @ts-ignore
				onRegionChangeComplete(newRegion, newMarkers);
				onMarkersChange(newMarkers);
			},
			[superCluster, minZoom, animationEnabled, layoutAnimationConf, spiralEnabled, onRegionChangeComplete, onMarkersChange]
		);

		/**
		 * Handles cluster press to zoom or expand
		 */
		const handleClusterPress = useCallback(
			(cluster: Feature) => {
				if (!superCluster || !cluster.properties.cluster_id || !mapRefInternal.current) {
					return;
				}

				// Get cluster children
				const children = superCluster.getLeaves(cluster.properties.cluster_id, Infinity);

				// Store cluster children for potential spiderfier use
				updateClusterChildren(children);

				// Either zoom to cluster bounds or show spiderfier
				if (preserveClusterPressBehavior) {
					// Notify parent of cluster press
					onClusterPress(cluster, children);
					return;
				}

				const coordinates = ensureCoordinates(cluster.geometry.coordinates);

				// Calculate zoom level based on cluster expansion
				const expansionZoom = Math.min(superCluster.getClusterExpansionZoom(cluster.properties.cluster_id), maxZoom);

				// If we're at max zoom, show spider pattern
				if (expansionZoom === maxZoom && spiralEnabled) {
					setSpiderfier(true);
				} else {
					// Otherwise zoom to cluster
					mapRefInternal.current.animateCamera(
						{
							center: {
								latitude: coordinates[1],
								longitude: coordinates[0]
							},
							zoom: expansionZoom
						},
						{ duration: 300 }
					);
				}

				// Notify parent of cluster press
				onClusterPress(cluster, children);
			},
			[superCluster, preserveClusterPressBehavior, onClusterPress, maxZoom, spiralEnabled]
		);

		/**
		 * Process spider markers for display when spiderfier is active
		 */
		useEffect(() => {
			if (!spiralEnabled || !superCluster || !isSpiderfier || !clusterChildren) {
				updateSpiderMarker([]);
				return;
			}

			const allSpiderMarkers: MarkerData[] = [];

			markers.forEach((marker, index) => {
				if (marker.properties.cluster) {
					const children =
						marker.properties.cluster_id !== undefined ? superCluster.getLeaves(marker.properties.cluster_id, Infinity) : [];

					const spiderPositions = generateSpiral(marker, children, markers, index);

					allSpiderMarkers.push(...spiderPositions);
				}
			});

			updateSpiderMarker(allSpiderMarkers);
		}, [isSpiderfier, markers, superCluster, spiralEnabled, clusterChildren]);

		// Initialize clustering on mount and when children change
		useEffect(() => {
			processChildren();
		}, [processChildren]);

		/**
		 * Renders a cluster marker
		 */
		const renderClusterMarker = useCallback(
			(marker: Feature) => {
				const isSelected = selectedClusterId === marker.properties.cluster_id;
				const color = isSelected && selectedClusterColor ? selectedClusterColor : clusterColor;

				return renderCluster ? (
					renderCluster({
						...marker,
						// @ts-ignore
						onPress: () => handleClusterPress(marker),
						tracksViewChanges
					})
				) : (
					<ClusterMarker
						key={`cluster-${marker.properties.cluster_id}`}
						{...marker}
						onPress={() => handleClusterPress(marker)}
						clusterColor={color}
						clusterTextColor={clusterTextColor}
						clusterFontFamily={clusterFontFamily}
						tracksViewChanges={tracksViewChanges}
					/>
				);
			},
			[
				renderCluster,
				handleClusterPress,
				clusterColor,
				clusterTextColor,
				clusterFontFamily,
				tracksViewChanges,
				selectedClusterId,
				selectedClusterColor
			]
		);

		/**
		 * Renders all markers - both clusters and individual markers
		 */
		const renderedMarkers = useMemo(() => {
			if (!clusteringEnabled) {
				return children;
			}

			const markerElements = markers.map((marker) => {
				// For clusters, use the custom renderer
				if (marker.properties.cluster) {
					return renderClusterMarker(marker);
				}

				// For individual markers, return the original marker with its original props
				const originalIndex = marker.properties.index;
				const child = originalIndex !== undefined ? React.Children.toArray(children)[originalIndex] : null;
				return child;
			});

			return markerElements;
		}, [markers, children, clusteringEnabled, renderClusterMarker]);

		/**
		 * Renders spider lines connecting clusters to their expanded markers
		 */
		const renderedSpiderLines = useMemo(() => {
			if (!spiralEnabled || !isSpiderfier || spiderMarkers.length === 0) {
				return null;
			}

			return spiderMarkers.map((marker, index) => {
				if (!marker.centerPoint) return null;

				return (
					<Polyline
						key={`spider-line-${index}`}
						coordinates={[
							{ latitude: marker.centerPoint.latitude, longitude: marker.centerPoint.longitude },
							{ latitude: marker.latitude, longitude: marker.longitude }
						]}
						strokeColor={spiderLineColor}
						strokeWidth={1}
					/>
				);
			});
		}, [spiderMarkers, isSpiderfier, spiralEnabled, spiderLineColor]);

		/**
		 * Renders spider markers when a cluster is expanded
		 */
		const renderedSpiderMarkers = useMemo(() => {
			if (!spiralEnabled || !isSpiderfier || spiderMarkers.length === 0 || !children) {
				return null;
			}

			return spiderMarkers.map((marker) => {
				const originalIndex = marker.index;
				if (originalIndex === undefined) return null;

				const originalMarker = React.Children.toArray(children)[originalIndex];
				if (!originalMarker) return null;

				return React.cloneElement(originalMarker as React.ReactElement, {
					// @ts-ignore
					coordinate: {
						latitude: marker.latitude,
						longitude: marker.longitude
					},
					key: `spider-marker-${originalIndex}`
				});
			});
		}, [spiderMarkers, isSpiderfier, spiralEnabled, children]);

		return (
			<MapView {...restProps} ref={combinedRef} onRegionChangeComplete={handleRegionChangeComplete}>
				{renderedMarkers}
				{renderedSpiderLines}
				{renderedSpiderMarkers}
				{otherChildren}
			</MapView>
		);
	}
);

export default memo(ClusteredMapView);
