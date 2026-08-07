/**
 * Haversine Formula & Geohash Utilities for Intelligent Warehouse Allocation Engine
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371.0088; // WGS84 mean earth radius in km

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Validates whether latitude and longitude are within standard geographical bounds.
 */
export const isValidCoordinates = (lat: number, lon: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

/**
 * Converts degrees to radians.
 */
export const toRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in kilometers rounded to 3 decimal places (meters precision)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (!isValidCoordinates(lat1, lon1)) {
    throw new Error(`Invalid origin coordinates: lat=${lat1}, lon=${lon1}`);
  }
  if (!isValidCoordinates(lat2, lon2)) {
    throw new Error(`Invalid destination coordinates: lat=${lat2}, lon=${lon2}`);
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_KM * c;
  return Number(distance.toFixed(3));
};

/**
 * Encodes latitude and longitude into a geohash string.
 *
 * @param lat Latitude in degrees (-90 to 90)
 * @param lon Longitude in degrees (-180 to 180)
 * @param precision Length of geohash string (default 6 ~ 1.2km precision)
 */
export const encodeGeohash = (
  lat: number,
  lon: number,
  precision = 6
): string => {
  if (!isValidCoordinates(lat, lon)) {
    throw new Error(`Invalid coordinates for geohash encoding: lat=${lat}, lon=${lon}`);
  }

  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let geohash = '';
  let isEvenBit = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (isEvenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) {
        ch |= 1 << (4 - bit);
        lonMin = lonMid;
      } else {
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        ch |= 1 << (4 - bit);
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    isEvenBit = !isEvenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
};
