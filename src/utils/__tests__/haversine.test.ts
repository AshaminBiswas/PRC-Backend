import { calculateDistance, encodeGeohash, isValidCoordinates } from '../haversine.utils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export const testHaversineUtils = () => {
  // isValidCoordinates
  assert(isValidCoordinates(28.6139, 77.2090) === true, 'Delhi coordinates valid');
  assert(isValidCoordinates(0, 0) === true, 'Origin valid');
  assert(isValidCoordinates(-90, -180) === true, 'Min bounds valid');
  assert(isValidCoordinates(90, 180) === true, 'Max bounds valid');
  assert(isValidCoordinates(91, 77.2090) === false, 'Latitude > 90 invalid');
  assert(isValidCoordinates(28.6139, 185) === false, 'Longitude > 180 invalid');

  // calculateDistance
  assert(calculateDistance(28.6139, 77.2090, 28.6139, 77.2090) === 0, 'Identical points 0 km');

  const delhiKolkata = calculateDistance(28.6139, 77.2090, 22.5726, 88.3639);
  assert(delhiKolkata > 1300 && delhiKolkata < 1315, 'Delhi-Kolkata distance ~1304 km');

  const delhiMumbai = calculateDistance(28.6139, 77.2090, 18.9388, 72.8353);
  assert(delhiMumbai > 1140 && delhiMumbai < 1180, 'Delhi-Mumbai distance ~1164 km');

  // encodeGeohash
  const hash = encodeGeohash(28.6139, 77.2090, 6);
  assert(hash.length === 6, 'Geohash length 6');
  assert(encodeGeohash(28.6139, 77.2090, 6) === hash, 'Geohash deterministic');
};

if (require.main === module) {
  testHaversineUtils();
  console.log('Haversine unit tests passed.');
}
