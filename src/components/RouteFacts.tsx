import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { City, cityHasMonsoon, resolveMonsoonSafe } from '../data/cities';
import { Route } from '../data/types';
import {
  routeLogisticsPreview,
  routeLocalPreview,
  routeSafetyPreview,
  routeSpecGrid,
} from '../utils/routeSummary';

const C = {
  surface:       '#181612',
  surfaceRaised: '#221F1A',
  amber:         '#F5A623',
  text:          'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.28)',
  border:        'rgba(255,255,255,0.09)',
  green:         '#4CAF50',
  red:           '#FF5252',
};

interface Props {
  route: Route;
  city: City;
}

function Accordion({
  title,
  preview,
  children,
  defaultOpen = false,
  accent = C.amber,
}: {
  title: string;
  preview?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.accordion}>
      <TouchableOpacity
        style={styles.accordionHead}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.75}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.accordionHeadText}>
          <Text style={[styles.accordionTitle, { color: accent }]}>{title}</Text>
          {!open && preview ? (
            <Text style={styles.accordionPreview} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.accordionChevron, { color: accent }]}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkMark, { color: ok ? C.green : C.red }]}>
        {ok ? '✓' : '✕'}
      </Text>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function DetailLine({ text }: { text: string }) {
  return <Text style={styles.detailLine}>{text}</Text>;
}

export default function RouteFacts({ route, city }: Props) {
  const specs = routeSpecGrid(route);
  const showMonsoon = cityHasMonsoon(city);
  const monsoonSafe = resolveMonsoonSafe(route, city);

  const safetyPreview = routeSafetyPreview(route, city);
  const logisticsPreview = routeLogisticsPreview(route);
  const localPreview = routeLocalPreview(route);

  const hasLogistics = !!(route.transitToStart || route.postRunFood);
  const hasLocal = !!(route.localTip || route.instagramMoment
    || route.historicalHook || route.neighbourhoodVibe);
  const hasCommunity = !!(route.communityRating
    || (route.runClubUsage && route.runClubUsage.length > 0)
    || route.eventAssociation);

  const terrainExtra = [
    route.surfaceQuality,
    route.width,
    route.obstacles,
    route.bestSeason,
  ].filter(Boolean);

  return (
    <View style={styles.root}>
      {specs.length > 0 && (
        <View style={styles.specGrid}>
          {specs.map(cell => (
            <View key={cell.label} style={styles.specCell}>
              <Text style={styles.specValue} numberOfLines={2}>{cell.value}</Text>
              <Text style={styles.specLabel}>{cell.label}</Text>
            </View>
          ))}
        </View>
      )}

      {route.landmarks && route.landmarks.length > 0 && (
        <View style={styles.landmarkBlock}>
          <Text style={styles.landmarkHeading}>Along the way</Text>
          <View style={styles.landmarkRow}>
            {route.landmarks.slice(0, 5).map((l, i) => (
              <View key={i} style={styles.landmarkChip}>
                <Text style={styles.landmarkText} numberOfLines={1}>{l}</Text>
              </View>
            ))}
            {route.landmarks.length > 5 && (
              <View style={styles.landmarkChip}>
                <Text style={styles.landmarkText}>+{route.landmarks.length - 5}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <Accordion title="About this route" preview={route.description.split('.')[0]} defaultOpen>
        <DetailLine text={route.description} />
        {terrainExtra.map(line => (
          <DetailLine key={line} text={line!} />
        ))}
      </Accordion>

      {safetyPreview.length > 0 && (
        <Accordion title="Safety & gear" preview={safetyPreview} accent="#5DBF72">
          {route.soloFemaleSafe !== undefined && (
            <Check
              ok={route.soloFemaleSafe}
              label={route.soloFemaleSafe ? 'Safe for solo runners' : 'Best with company'}
            />
          )}
          {route.headphonesSafe !== undefined && (
            <Check
              ok={route.headphonesSafe}
              label={route.headphonesSafe ? 'Headphones OK' : 'Stay aware of traffic'}
            />
          )}
          {route.waterOnRoute !== undefined && (
            <Check
              ok={route.waterOnRoute}
              label={route.waterOnRoute ? 'Water on route' : 'Bring your own water'}
            />
          )}
          {route.restroomsOnRoute !== undefined && (
            <Check
              ok={route.restroomsOnRoute}
              label={route.restroomsOnRoute ? 'Restrooms available' : 'No restrooms'}
            />
          )}
          {showMonsoon && monsoonSafe !== undefined && (
            <Check
              ok={monsoonSafe}
              label={monsoonSafe ? 'Good in monsoon' : 'Avoid in monsoon'}
            />
          )}
          {route.lighting && (
            <DetailLine text={`Lighting: ${capitalize(route.lighting)}`} />
          )}
          {route.heatWarning && route.heatWarning !== 'low' && (
            <DetailLine
              text={route.heatWarning === 'high'
                ? 'High heat — start early'
                : 'Moderate heat — go early or late'}
            />
          )}
        </Accordion>
      )}

      {hasLogistics && (
        <Accordion title="Getting there & after" preview={logisticsPreview} accent="#5AA9F5">
          {route.transitToStart && (
            <DetailLine text={`Getting there: ${route.transitToStart}`} />
          )}
          {route.postRunFood && (
            <DetailLine text={`After the run: ${route.postRunFood}`} />
          )}
        </Accordion>
      )}

      {hasLocal && (
        <Accordion title="Local tips" preview={localPreview} accent="#C08CEA">
          {route.localTip && <DetailLine text={route.localTip} />}
          {route.instagramMoment && (
            <DetailLine text={`Photo spot: ${route.instagramMoment}`} />
          )}
          {route.historicalHook && <DetailLine text={route.historicalHook} />}
          {route.neighbourhoodVibe && (
            <DetailLine text={`Vibe: ${route.neighbourhoodVibe}`} />
          )}
        </Accordion>
      )}

      {hasCommunity && (
        <Accordion
          title="Community"
          accent="#F08D6E"
          preview={route.communityRating
            ? `${route.communityRating.toFixed(1)} ★`
            : undefined}
        >
          {route.communityRating !== undefined && (
            <DetailLine text={`Runner rating: ${route.communityRating.toFixed(1)} / 5`} />
          )}
          {route.whoItsFor && <DetailLine text={`Who it's for: ${route.whoItsFor}`} />}
          {route.bestUse && <DetailLine text={`Best for: ${route.bestUse}`} />}
          {route.runClubUsage && route.runClubUsage.length > 0 && (
            <DetailLine text={`Popular with: ${route.runClubUsage.join(', ')}`} />
          )}
          {route.eventAssociation && (
            <DetailLine text={`Events: ${route.eventAssociation}`} />
          )}
        </Accordion>
      )}
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  root: { gap: 10 },

  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  specCell: {
    width: '33.33%',
    paddingRight: 12,
    gap: 2,
  },
  specValue: {
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  specLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },

  landmarkBlock: { gap: 8 },
  landmarkHeading: {
    color: 'rgba(245,166,35,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  landmarkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  landmarkChip: {
    backgroundColor: 'rgba(245,166,35,0.10)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.28)',
    maxWidth: '48%',
  },
  landmarkText: { color: '#F5C842', fontSize: 12, fontWeight: '600' },

  accordion: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  accordionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  accentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  accordionHeadText: { flex: 1, minWidth: 0, gap: 3 },
  accordionTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  accordionPreview: {
    color: C.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },
  accordionChevron: {
    color: C.textTertiary,
    fontSize: 11,
    flexShrink: 0,
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkMark: {
    fontSize: 14,
    fontWeight: '800',
    width: 16,
    textAlign: 'center',
  },
  checkLabel: {
    color: C.textSecondary,
    fontSize: 13,
    flex: 1,
  },

  detailLine: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
