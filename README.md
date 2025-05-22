# React Native Map Clustering

![npm version](https://img.shields.io/npm/v/rs-react-native-map-clustering.svg)
![license](https://img.shields.io/npm/l/rs-react-native-map-clustering.svg)
![downloads](https://img.shields.io/npm/dt/rs-react-native-map-clustering.svg)

A powerful React Native module that elegantly handles map clustering with full TypeScript support.

Works seamlessly with **Expo** and **react-native-cli** 🚀

> This is a maintained fork of [react-native-map-clustering](https://github.com/venits/react-native-map-clustering) with SuperCluster v8.0.1 and complete TypeScript typings.

## 📋 Table of Contents

- [React Native Map Clustering](#react-native-map-clustering)
  - [📋 Table of Contents](#-table-of-contents)
  - [✨ Features](#-features)
  - [📦 Installation](#-installation)
  - [🚀 Quick Start](#-quick-start)
  - [🔍 TypeScript Support](#-typescript-support)
  - [⚙️ Props](#️-props)
  - [📱 Examples](#-examples)
    - [Animate Map to Region](#animate-map-to-region)
    - [Custom Cluster Rendering](#custom-cluster-rendering)
  - [🤝 Support](#-support)
    - [Happy Coding! 💖🚀](#happy-coding-)

## ✨ Features

- **Fully typed** with comprehensive TypeScript declarations
- **High performance** clustering using SuperCluster v8.0.1
- **Customizable** markers, clusters, and animations
- **Spider mode** for elegant handling of overlapping markers
- **Optimized rendering** with minimal re-renders for smooth performance
- **Compatible** with both Expo and React Native CLI
- **Cross-platform** with full iOS and Android support

## 📦 Installation

```bash
# Using npm
npm install rs-react-native-map-clustering react-native-maps --save

# Using yarn
yarn add rs-react-native-map-clustering react-native-maps

# Using pnpm
pnpm add rs-react-native-map-clustering react-native-maps
```

## 🚀 Quick Start

```jsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'rs-react-native-map-clustering';
import { Marker } from 'react-native-maps';

export default function App() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 52.5,
          longitude: 19.2,
          latitudeDelta: 8.5,
          longitudeDelta: 8.5,
        }}
      >
        <Marker coordinate={{ latitude: 52.4, longitude: 18.7 }} />
        <Marker coordinate={{ latitude: 52.1, longitude: 18.4 }} />
        <Marker coordinate={{ latitude: 52.6, longitude: 18.3 }} />
        <Marker coordinate={{ latitude: 51.6, longitude: 18.0 }} />
        <Marker coordinate={{ latitude: 53.1, longitude: 18.8 }} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
```

## 🔍 TypeScript Support

The library comes with full TypeScript support and exports helpful types for your development.

```tsx
import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { ClusteredMapProps } from 'rs-react-native-map-clustering';
import { Marker } from 'react-native-maps';

const INITIAL_REGION = {
  latitude: 52.5,
  longitude: 19.2,
  latitudeDelta: 8.5,
  longitudeDelta: 8.5,
};

const App = () => {
  const mapRef = useRef<MapView>(null);
  
  // Access to exported types
  const clusteringOptions: Partial<ClusteredMapProps> = {
    clusterColor: '#FF0000',
    spiralEnabled: true,
    tracksViewChanges: false
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        initialRegion={INITIAL_REGION}
        style={styles.map}
        {...clusteringOptions}
      >
        <Marker coordinate={{ latitude: 52.4, longitude: 18.7 }} />
        <Marker coordinate={{ latitude: 52.1, longitude: 18.4 }} />
        <Marker coordinate={{ latitude: 52.6, longitude: 18.3 }} />
        <Marker coordinate={{ latitude: 51.6, longitude: 18.0 }} />
        <Marker coordinate={{ latitude: 53.1, longitude: 18.8 }} />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default App;
```

## ⚙️ Props

| Name                                        | Type                  | Default                                      | Description                                                              |
| ------------------------------------------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| **clusterColor**                            | String                | #00B386                                      | Background color of clusters                                             |
| **clusterTextColor**                        | String                | #FFFFFF                                      | Color of text in clusters                                                |
| **clusterFontFamily**                       | String                | undefined                                    | Font family of text in clusters                                          |
| **onClusterPress(cluster, markers)**        | Function              | () => {}                                     | Handles cluster click events with cluster data and its markers           |
| **tracksViewChanges**                       | Boolean               | false                                        | Controls whether cluster markers track view changes                      |
| **radius**                                  | Number                | window.width * 6%                            | [SuperCluster radius](https://github.com/mapbox/supercluster#options)    |
| **extent**                                  | Number                | 512                                          | [SuperCluster extent](https://github.com/mapbox/supercluster#options)    |
| **minZoom**                                 | Number                | 1                                            | [SuperCluster minZoom](https://github.com/mapbox/supercluster#options)   |
| **maxZoom**                                 | Number                | 20                                           | [SuperCluster maxZoom](https://github.com/mapbox/supercluster#options)   |
| **minPoints**                               | Number                | 2                                            | [SuperCluster minPoints](https://github.com/mapbox/supercluster#options) |
| **preserveClusterPressBehavior**            | Boolean               | false                                        | If true, disables auto-zooming when clicking on a cluster                |
| **edgePadding**                             | Object                | { top: 50, left: 50, bottom: 50, right: 50 } | Padding for `fitToCoordinates` when focusing on clusters                 |
| **animationEnabled**                        | Boolean               | true                                         | Enables animations for clusters (iOS only)                               |
| **layoutAnimationConf**                     | LayoutAnimationConfig | LayoutAnimation.Presets.spring               | Animation configuration for clusters (iOS only)                          |
| **onRegionChangeComplete(region, markers)** | Function              | () => {}                                     | Called when map region finishes changing                                 |
| **onMarkersChange(markers)**                | Function              | () => {}                                     | Called when markers data changes                                         |
| **superClusterRef**                         | MutableRefObject      | {}                                           | Provides direct access to the SuperCluster instance                      |
| **clusteringEnabled**                       | Boolean               | true                                         | Enables/disables clustering functionality                                |
| **spiralEnabled**                           | Boolean               | true                                         | Controls spiral view for overlapping markers                             |
| **renderCluster**                           | Function              | undefined                                    | Custom rendering function for clusters                                   |
| **spiderLineColor**                         | String                | #FF0000                                      | Color of lines connecting markers in spider mode                         |

## 📱 Examples

### Animate Map to Region

```jsx
import React, { useRef } from "react";
import { Button, View, StyleSheet } from "react-native";
import MapView from "rs-react-native-map-clustering";
import { Marker } from "react-native-maps";

const App = () => {
  const mapRef = useRef(null);

  const animateToRegion = () => {
    mapRef.current?.animateToRegion({
      latitude: 42.5,
      longitude: 15.2,
      latitudeDelta: 7.5,
      longitudeDelta: 7.5,
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 52.5,
          longitude: 19.2,
          latitudeDelta: 8.5,
          longitudeDelta: 8.5,
        }}
      />
      <Button onPress={animateToRegion} title="Animate to Italy" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default App;
```

### Custom Cluster Rendering

```jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView from "rs-react-native-map-clustering";
import { Marker } from "react-native-maps";

const CustomClusterMarker = ({ onPress, geometry, properties }) => {
  const { point_count } = properties;
  return (
    <Marker
      coordinate={{
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
      }}
      onPress={onPress}
    >
      <View style={styles.customCluster}>
        <Text style={styles.customClusterText}>{point_count}</Text>
      </View>
    </Marker>
  );
};

const App = () => {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 52.5,
          longitude: 19.2,
          latitudeDelta: 8.5,
          longitudeDelta: 8.5,
        }}
        renderCluster={CustomClusterMarker}
      >
        {/* Add your markers here */}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customCluster: {
    backgroundColor: "purple",
    borderRadius: 25,
    padding: 10,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  customClusterText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});

export default App;
```

## 🤝 Support

Feel free to create issues and pull requests on the [GitHub repository](https://github.com/rsoubrane/react-native-map-clustering). We welcome contributions and feedback to make this library even better.

### Happy Coding! 💖🚀
