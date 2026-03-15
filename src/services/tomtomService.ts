import axios from "axios";

export interface DistanceResult {
    source: "tomtom" | "airline";
    distanceM: number;
    travelTimeSec: number | null;
}

export class TomTomService {
    constructor(
        private apiKey: string,
        private traffic = true,
    ) {}

    private haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    async getDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<DistanceResult> {
        if (!this.apiKey) {
            return {
                source: "airline",
                distanceM: this.haversineM(lat1, lon1, lat2, lon2),
                travelTimeSec: null,
            };
        }

        try {
            const locs = `${lat1},${lon1}:${lat2},${lon2}`;
            const url = `https://api.tomtom.com/routing/1/calculateRoute/${locs}/json`;

            const resp = await axios.get(url, {
                timeout: 15000,
                params: {
                    key: this.apiKey,
                    traffic: this.traffic ? "true" : "false",
                    travelMode: "car",
                    routeType: "fastest",
                },
            });

            const summary = resp.data?.routes?.[0]?.summary;
            const dist = Number(summary?.lengthInMeters);

            if (Number.isFinite(dist)) {
                return {
                    source: "tomtom",
                    distanceM: Math.round(dist),
                    travelTimeSec: Number(summary?.travelTimeInSeconds) || null,
                };
            }
        } catch {
            // fallback
        }

        return {
            source: "airline",
            distanceM: this.haversineM(lat1, lon1, lat2, lon2),
            travelTimeSec: null,
        };
    }
}
