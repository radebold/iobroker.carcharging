export interface StationConfig {
    enabled?: boolean;
    id: string;
    name: string;
    lat: number;
    lon: number;
    freePorts?: number;
}

export interface NearestStationResult {
    stationId: string;
    stationName: string;
    distanceM: number;
    freePorts: number;
    source: "tomtom" | "airline";
}

export class StationService {
    constructor(
        private stations: StationConfig[],
        private getDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => Promise<{
            source: "tomtom" | "airline";
            distanceM: number;
        }>
    ) {}

    getConfiguredStations(): StationConfig[] {
        return this.stations.filter(s => s && s.enabled !== false);
    }

    async getNearestForVehicle(lat: number, lon: number): Promise<NearestStationResult | null> {
        let best: NearestStationResult | null = null;

        for (const st of this.getConfiguredStations()) {
            const dist = await this.getDistance(lat, lon, st.lat, st.lon);

            const candidate: NearestStationResult = {
                stationId: st.id,
                stationName: st.name,
                distanceM: dist.distanceM,
                freePorts: Number(st.freePorts || 0),
                source: dist.source,
            };

            if (!best || candidate.distanceM < best.distanceM) {
                best = candidate;
            }
        }

        return best;
    }
}
