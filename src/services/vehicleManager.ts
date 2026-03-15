import type { AdapterInstance } from "@iobroker/adapter-core";

export interface VehicleConfig {
    enabled?: boolean;
    id: string;
    name: string;
    socState?: string;
    latState?: string;
    lonState?: string;
    connectedState?: string;
    chargingState?: string;
}

export interface VehicleLiveData {
    id: string;
    name: string;
    soc: number | null;
    lat: number | null;
    lon: number | null;
    connected: boolean | null;
    charging: boolean | null;
}

export class VehicleManager {
    constructor(private adapter: AdapterInstance) {}

    getConfiguredVehicles(): VehicleConfig[] {
        const raw = Array.isArray((this.adapter.config as any).vehicles)
            ? (this.adapter.config as any).vehicles
            : [];

        return raw
            .map((v: any) => ({
                enabled: v.enabled !== false,
                id: String(v.id || "").trim(),
                name: String(v.name || v.id || "").trim(),
                socState: String(v.socState || "").trim(),
                latState: String(v.latState || "").trim(),
                lonState: String(v.lonState || "").trim(),
                connectedState: String(v.connectedState || "").trim(),
                chargingState: String(v.chargingState || "").trim(),
            }))
            .filter((v: VehicleConfig) => !!v.id && v.enabled !== false);
    }

    async readVehicle(v: VehicleConfig): Promise<VehicleLiveData> {
        const readForeign = async (id?: string): Promise<any> => {
            if (!id) return null;
            try {
                const st = await this.adapter.getForeignStateAsync(id);
                return st ? st.val : null;
            } catch {
                return null;
            }
        };

        const soc = await readForeign(v.socState);
        const lat = await readForeign(v.latState);
        const lon = await readForeign(v.lonState);
        const connected = await readForeign(v.connectedState);
        const charging = await readForeign(v.chargingState);

        return {
            id: v.id,
            name: v.name,
            soc: soc !== null ? Number(soc) : null,
            lat: lat !== null ? Number(lat) : null,
            lon: lon !== null ? Number(lon) : null,
            connected: connected !== null ? !!connected : null,
            charging: charging !== null ? !!charging : null,
        };
    }
}
