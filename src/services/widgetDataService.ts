import type { VehicleLiveData } from "./vehicleManager";
import type { NearestStationResult } from "./stationService";

export interface VehicleWidgetData {
    id: string;
    name: string;
    soc: number | null;
    connected: boolean | null;
    charging: boolean | null;
    nearest: NearestStationResult | null;
}

export function buildVehicleWidgetData(
    vehicle: VehicleLiveData,
    nearest: NearestStationResult | null
): VehicleWidgetData {
    return {
        id: vehicle.id,
        name: vehicle.name,
        soc: vehicle.soc,
        connected: vehicle.connected,
        charging: vehicle.charging,
        nearest,
    };
}

export function buildVehicleCardsJson(items: VehicleWidgetData[]): string {
    return JSON.stringify(items);
}
