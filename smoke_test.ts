/// <reference types="node" />
import SF_EMBARCADERO_ROUTE from './src/data/routes/sf_embarcadero';
import MUMBAI_BANDRA_WATERFRONT, { MUMBAI_COASTAL_PROMENADE } from './src/data/routes/mumbai_bandra_waterfront';
import { distanceMetres, paceAdjustedTriggerDistance, routeLengthMetres } from './src/utils/geo';
import { Route, POI } from './src/data/types';
import * as fs from 'fs';
import * as path from 'path';

const routes: Route[] = [SF_EMBARCADERO_ROUTE, MUMBAI_BANDRA_WATERFRONT, MUMBAI_COASTAL_PROMENADE];
let passed = 0, failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log('  ✅', label, detail ? `(${detail})` : ''); passed++; }
  else           { console.log('  ❌', label, detail ? `— ${detail}` : ''); failed++; }
}

routes.forEach(r => {
  console.log(`\n── ${r.name} (${r.city}) ──`);

  check('has id',          !!r.id);
  check('has city',        !!r.city);
  check('has coordinates', r.coordinates.length >= 2, `${r.coordinates.length} points`);
  check('has pois',        r.pois.length >= 1, `${r.pois.length} POIs`);
  check('start location valid',
    r.startLocation.lat !== 0 && r.startLocation.lng !== 0);

  const seg = distanceMetres(r.coordinates[0], r.coordinates[1]);
  check('distanceMetres > 0', seg > 0, `${seg.toFixed(1)}m`);

  const routeLen = routeLengthMetres(r.coordinates);
  check('route length 0.5–20km', routeLen > 500 && routeLen < 20000,
    `${(routeLen / 1000).toFixed(2)}km`);

  const baseTrigger = r.pois[0].triggerDistanceM;
  // args: baseTriggerM, clipDurationSec, paceSecPerM (5min/km = 300sec/km = 0.3sec/m)
  const adjusted = paceAdjustedTriggerDistance(baseTrigger, 35, 0.3);
  check('pace-adjusted trigger ≥ base', adjusted >= baseTrigger,
    `base=${baseTrigger}m → @5min/km=${adjusted}m`);

  r.pois.forEach((p: POI) => {
    const clipCount = Object.keys(p.clips).length;
    check(`POI "${p.id}" has clips`, clipCount > 0, `${clipCount} mode(s)`);

    Object.entries(p.clips).forEach(([mode, clip]) => {
      check(`  ${p.id}/${mode} script`, clip.script.length > 20,
        `${clip.script.length} chars`);
      check(`  ${p.id}/${mode} audioFile`, !!clip.audioFile);

      if (clip.audioFile) {
        const audioPath = path.join('assets', 'audio', clip.audioFile);
        const exists = fs.existsSync(audioPath);
        const size   = exists ? fs.statSync(audioPath).size : 0;
        check(`  ${p.id}/${mode} audio on disk`, exists && size > 0,
          exists ? `${(size / 1024).toFixed(0)}KB` : `MISSING: ${audioPath}`);
      }
    });
  });
});

console.log(`\n${'='.repeat(52)}`);
console.log(`Smoke test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
