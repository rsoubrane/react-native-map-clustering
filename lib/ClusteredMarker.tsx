import { FC, memo, useMemo } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Marker } from 'react-native-maps';
import { returnMarkerStyle } from './helpers';
import { ClusterMarkerProps } from './types';

// ----------------------------------------------------------------------

const ClusteredMarker: FC<ClusterMarkerProps> = ({
	geometry,
	properties,
	onPress,
	clusterColor,
	clusterTextColor,
	clusterFontFamily,
	tracksViewChanges
}) => {
	const points = properties.point_count;
	const { width, height, fontSize, size } = returnMarkerStyle(points);

	// Memoize style calculations to avoid recalculation on re-renders
	const markerStyle = useMemo(
		() => ({
			containerStyle: { width, height },
			wrapperStyle: {
				backgroundColor: clusterColor,
				width,
				height,
				borderRadius: width / 2
			},
			clusterStyle: {
				backgroundColor: clusterColor,
				width: size,
				height: size,
				borderRadius: size / 2
			},
			textStyle: {
				color: clusterTextColor,
				fontSize,
				fontFamily: clusterFontFamily,
				fontWeight: 'bold' as const
			},
			zIndex: points + 1
		}),
		[points, clusterColor, clusterTextColor, clusterFontFamily, width, height, size, fontSize]
	);

	// Generate a stable key from coordinates and cluster ID
	const markerKey = useMemo(
		() => `${geometry.coordinates[0]}_${geometry.coordinates[1]}_${properties.cluster_id || ''}`,
		[geometry.coordinates, properties.cluster_id]
	);

	// Memoize the marker content to prevent unnecessary re-renders
	const markerContent = useMemo(
		() => (
			<TouchableOpacity activeOpacity={0.5} style={[styles.container, markerStyle.containerStyle]}>
				<View style={[styles.wrapper, markerStyle.wrapperStyle]} />
				<View style={[styles.cluster, markerStyle.clusterStyle]}>
					<Text style={[styles.text, markerStyle.textStyle]}>{points}</Text>
				</View>
			</TouchableOpacity>
		),
		[markerStyle, points]
	);

	// Memoize coordinate to prevent unnecessary re-renders
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
			style={{ zIndex: markerStyle.zIndex }}
			onPress={onPress}
			tracksViewChanges={tracksViewChanges}>
			{markerContent}
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

export default memo(ClusteredMarker);
