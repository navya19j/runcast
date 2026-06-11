import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { ElevationData } from '../hooks/useElevation';

interface ElevationProfileProps {
  elevation: ElevationData;
  distanceKm: number;      // current runner distance — drives the position marker
  totalDistanceKm: number; // full route length
}

const H = 56;
const PAD_X = 10;
const PAD_Y = 8;

export default function ElevationProfile({
  elevation,
  distanceKm,
  totalDistanceKm,
}: ElevationProfileProps) {
  // Width comes from the parent — use a fixed logical width, SVG scales via viewBox
  const W = 340;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const { points, gainM, maxM, minM } = elevation;
  const range = Math.max(maxM - minM, 5); // avoid division by zero on flat routes

  const toX = (km: number) =>
    PAD_X + (km / Math.max(totalDistanceKm, 0.001)) * innerW;
  const toY = (m: number) =>
    PAD_Y + innerH - ((m - minM) / range) * innerH;

  // Build SVG path strings
  const lineSegments = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(p.distanceKm).toFixed(1)},${toY(p.elevationM).toFixed(1)}`
  ).join(' ');

  const fillPath = [
    lineSegments,
    `L ${toX(points[points.length - 1].distanceKm).toFixed(1)},${H}`,
    `L ${toX(points[0].distanceKm).toFixed(1)},${H}`,
    'Z',
  ].join(' ');

  // Current position marker
  const posX = toX(Math.min(distanceKm, totalDistanceKm));
  // Interpolate elevation at current distance
  const nearestIdx = points.reduce((best, p, i) =>
    Math.abs(p.distanceKm - distanceKm) < Math.abs(points[best].distanceKm - distanceKm) ? i : best, 0
  );
  const posY = toY(points[nearestIdx]?.elevationM ?? minM);

  const isRunning = distanceKm > 0;

  return (
    <View style={styles.container}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* Filled area */}
        <Path d={fillPath} fill="rgba(245,166,35,0.15)" />
        {/* Elevation line */}
        <Path d={lineSegments} stroke="#F5A623" strokeWidth="2" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Current position */}
        {isRunning && (
          <>
            <Line x1={posX} y1={PAD_Y / 2} x2={posX} y2={H - 2}
              stroke="#F5A623" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.8" />
            <Circle cx={posX} cy={posY} r="3.5" fill="#F5A623" />
          </>
        )}
        {/* Gain label */}
        <SvgText x={W - PAD_X} y={13} textAnchor="end"
          fill="#F5A623" fontSize="9" fontWeight="700">
          {`↑ ${gainM}m gain`}
        </SvgText>
        {/* Elevation label */}
        <SvgText x={PAD_X} y={13} textAnchor="start"
          fill="rgba(255,255,255,0.28)" fontSize="9">
          Elevation
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141c28',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
});
