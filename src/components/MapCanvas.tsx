import React, { useState, useCallback, forwardRef } from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import MapView, { MapViewProps } from 'react-native-maps';

interface MapCanvasProps extends MapViewProps {
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * MapView needs explicit width/height on iOS for reliable pan/zoom gestures.
 */
const MapCanvas = forwardRef<MapView, MapCanvasProps>(function MapCanvas(
  { containerStyle, style, children, onLayout: onLayoutProp, ...mapProps },
  ref,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayoutProp?.(e);
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        setSize(prev =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }
    },
    [onLayoutProp],
  );

  return (
    <View style={[styles.container, containerStyle]} onLayout={onLayout} collapsable={false}>
      {size.height > 0 && (
        <MapView
          ref={ref}
          {...mapProps}
          style={[styles.map, { width: size.width, height: size.height }, style]}
        >
          {children}
        </MapView>
      )}
    </View>
  );
});

export default MapCanvas;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
