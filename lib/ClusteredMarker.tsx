import React, { memo, useMemo } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Marker } from 'react-native-maps';
import { returnMarkerStyle } from './helpers';
import { ClusterMarkerProps } from './types';

const ClusteredMarker: React.FC<ClusterMarkerProps> = ({
	geometry,
	properties,
	onPress,
	clusterColor,
	clusterTextColor,
	clusterFontFamily,
	tracksViewChanges
}) => {
	const points = properties.point_count;

	// Memoize style calculations to prevent unnecessary re-renders
	const markerStyle = useMemo(() => returnMarkerStyle(points), [points]);
	const { width, height, fontSize, size } = markerStyle;

	// Create a unique key for the marker based on its coordinates
	const markerKey = useMemo(() => `${geometry.coordinates[0]}_${geometry.coordinates[1]}`, [geometry.coordinates]);

	// Memoize coordinate object to prevent unnecessary re-renders
	const coordinate = useMemo(
		() => ({
			longitude: geometry.coordinates[0],
			latitude: geometry.coordinates[1]
		}),
		[geometry.coordinates]
	);

	return (
		<Marker
			key={markerKey}
			coordinate={coordinate}
			style={{ zIndex: points + 1 }}
			onPress={onPress}
			tracksViewChanges={tracksViewChanges}>
			<TouchableOpacity activeOpacity={0.5} style={[styles.container, { width, height }]}>
				<View
					style={[
						styles.wrapper,
						{
							backgroundColor: clusterColor,
							width,
							height,
							borderRadius: width / 2
						}
					]}
				/>
				<View
					style={[
						styles.cluster,
						{
							backgroundColor: clusterColor,
							width: size,
							height: size,
							borderRadius: size / 2
						}
					]}>
					<Text
						style={[
							styles.text,
							{
								color: clusterTextColor,
								fontSize,
								fontFamily: clusterFontFamily
							}
						]}>
						{points}
					</Text>
				</View>
			</TouchableOpacity>
		</Marker>
	);
};

const styles = StyleSheet.create({
	container: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center'
	},
	wrapper: {
		position: 'absolute',
		opacity: 0.5,
		zIndex: 0
	},
	cluster: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 1
	},
	text: {
		fontWeight: 'bold'
	}
});

// Use React.memo with a custom comparison function for optimal performance
export default memo(ClusteredMarker, (prevProps, nextProps) => {
	return (
		prevProps.geometry.coordinates[0] === nextProps.geometry.coordinates[0] &&
		prevProps.geometry.coordinates[1] === nextProps.geometry.coordinates[1] &&
		prevProps.properties.point_count === nextProps.properties.point_count &&
		prevProps.clusterColor === nextProps.clusterColor &&
		prevProps.clusterTextColor === nextProps.clusterTextColor
	);
});
