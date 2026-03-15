import * as utils from "@iobroker/adapter-core";
import { VehicleManager } from "./services/vehicleManager";
import { TomTomService } from "./services/tomtomService";
import { StationService } from "./services/stationService";
import { buildVehicleWidgetData, buildVehicleCardsJson } from "./services/widgetDataService";

class CarCharging extends utils.Adapter {
    private refreshRunning = false;

    constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: "carcharging" });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async onReady(): Promise<void> {
        await this.ensureTools();
        await this.ensureCommonChannels();
        await this.subscribeStatesAsync("tools.refreshNow");
        await this.refreshAll("startup");
    }

    private async ensureTools(): Promise<void> {
        await this.setObjectNotExistsAsync("tools", { type: "channel", common: { name: "Tools" }, native: {} });
        await this.setObjectNotExistsAsync("tools.refreshNow", {
            type: "state",
            common: { name: "Refresh now", type: "boolean", role: "button", read: true, write: true, def: false },
            native: {},
        });
        await this.setObjectNotExistsAsync("tools.lastRefresh", {
            type: "state",
            common: { name: "Last refresh", type: "string", role: "value.time", read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync("tools.lastRefreshResult", {
            type: "state",
            common: { name: "Last refresh result", type: "string", role: "text", read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync("widgets", { type: "channel", common: { name: "Widgets" }, native: {} });
        await this.setObjectNotExistsAsync("widgets.vehicleCards", {
            type: "state",
            common: { name: "Vehicle cards JSON", type: "string", role: "json", read: true, write: false },
            native: {},
        });
        await this.setStateAsync("tools.refreshNow", { val: false, ack: true });
    }

    private async ensureCommonChannels(): Promise<void> {
        await this.setObjectNotExistsAsync("vehicles", { type: "channel", common: { name: "Vehicles" }, native: {} });
        await this.setObjectNotExistsAsync("car", { type: "channel", common: { name: "Primary vehicle (compat)" }, native: {} });
    }

    private async ensureVehicleObjects(v: { id: string; name: string }): Promise<void> {
        const base = `vehicles.${v.id}`;
        await this.setObjectNotExistsAsync(base, { type: "channel", common: { name: v.name || v.id }, native: {} });

        const defs: Array<[string, ioBroker.StateCommon]> = [
            ["name", { name: "Name", type: "string", role: "text", read: true, write: false }],
            ["soc", { name: "State of charge", type: "number", unit: "%", role: "value.battery", read: true, write: false }],
            ["lat", { name: "Latitude", type: "number", role: "value.gps.latitude", read: true, write: false }],
            ["lon", { name: "Longitude", type: "number", role: "value.gps.longitude", read: true, write: false }],
            ["connected", { name: "Connected", type: "boolean", role: "indicator.connected", read: true, write: false }],
            ["charging", { name: "Charging", type: "boolean", role: "indicator", read: true, write: false }],
            ["lastUpdate", { name: "Last update", type: "string", role: "value.time", read: true, write: false }],
        ];

        for (const [id, common] of defs) {
            await this.setObjectNotExistsAsync(`${base}.${id}`, { type: "state", common, native: {} });
        }

        await this.setObjectNotExistsAsync(`${base}.nearest`, { type: "channel", common: { name: "Nearest charging station" }, native: {} });
        const nearestDefs: Array<[string, ioBroker.StateCommon]> = [
            ["station", { name: "Nearest station", type: "string", role: "text", read: true, write: false }],
            ["distance", { name: "Distance", type: "number", role: "value.distance", unit: "m", read: true, write: false }],
            ["freePorts", { name: "Free ports", type: "number", role: "value", read: true, write: false }],
            ["distanceSource", { name: "Distance source", type: "string", role: "text", read: true, write: false }],
            ["lastUpdate", { name: "Last update", type: "string", role: "value.time", read: true, write: false }],
        ];

        for (const [id, common] of nearestDefs) {
            await this.setObjectNotExistsAsync(`${base}.nearest.${id}`, { type: "state", common, native: {} });
        }

        await this.setStateAsync(`${base}.name`, { val: v.name || v.id, ack: true });
    }

    private async mirrorPrimaryVehicle(base: string, now: string): Promise<void> {
        const ids = ["soc", "lat", "lon", "connected", "charging", "lastUpdate"];
        const defs: Record<string, ioBroker.StateCommon> = {
            soc: { name: "State of charge", type: "number", unit: "%", role: "value.battery", read: true, write: false },
            lat: { name: "Latitude", type: "number", role: "value.gps.latitude", read: true, write: false },
            lon: { name: "Longitude", type: "number", role: "value.gps.longitude", read: true, write: false },
            connected: { name: "Connected", type: "boolean", role: "indicator.connected", read: true, write: false },
            charging: { name: "Charging", type: "boolean", role: "indicator", read: true, write: false },
            lastUpdate: { name: "Last update", type: "string", role: "value.time", read: true, write: false },
        };

        for (const id of ids) {
            await this.setObjectNotExistsAsync(`car.${id}`, { type: "state", common: defs[id], native: {} });
            const st = await this.getStateAsync(`${base}.${id}`);
            if (st) await this.setStateAsync(`car.${id}`, { val: st.val as any, ack: true });
        }
        await this.setStateAsync("car.lastUpdate", { val: now, ack: true });
    }

    async refreshAll(source: string): Promise<void> {
        if (this.refreshRunning) return;
        this.refreshRunning = true;

        try {
            const vehicleManager = new VehicleManager(this);
            const tomtom = new TomTomService(String((this.config as any).tomtomApiKey || "").trim(), true);
            const stationService = new StationService(
                Array.isArray((this.config as any).stations) ? (this.config as any).stations : [],
                (lat1, lon1, lat2, lon2) => tomtom.getDistance(lat1, lon1, lat2, lon2)
            );

            const vehicles = vehicleManager.getConfiguredVehicles();
            const widgetItems = [];

            for (const v of vehicles) {
                const live = await vehicleManager.readVehicle(v);
                await this.ensureVehicleObjects({ id: live.id, name: live.name });

                if (live.soc !== null) await this.setStateAsync(`vehicles.${live.id}.soc`, { val: live.soc, ack: true });
                if (live.lat !== null) await this.setStateAsync(`vehicles.${live.id}.lat`, { val: live.lat, ack: true });
                if (live.lon !== null) await this.setStateAsync(`vehicles.${live.id}.lon`, { val: live.lon, ack: true });
                if (live.connected !== null) await this.setStateAsync(`vehicles.${live.id}.connected`, { val: live.connected, ack: true });
                if (live.charging !== null) await this.setStateAsync(`vehicles.${live.id}.charging`, { val: live.charging, ack: true });

                const now = new Date().toISOString();
                await this.setStateAsync(`vehicles.${live.id}.lastUpdate`, { val: now, ack: true });

                let nearest = null;
                if (live.lat !== null && live.lon !== null) {
                    nearest = await stationService.getNearestForVehicle(live.lat, live.lon);
                }

                const widget = buildVehicleWidgetData(live, nearest);
                widgetItems.push(widget);

                await this.setStateAsync(`vehicles.${live.id}.nearest.station`, { val: widget.nearest?.stationName || "", ack: true });
                await this.setStateAsync(`vehicles.${live.id}.nearest.distance`, { val: widget.nearest?.distanceM || 0, ack: true });
                await this.setStateAsync(`vehicles.${live.id}.nearest.freePorts`, { val: widget.nearest?.freePorts || 0, ack: true });
                await this.setStateAsync(`vehicles.${live.id}.nearest.distanceSource`, { val: widget.nearest?.source || "", ack: true });
                await this.setStateAsync(`vehicles.${live.id}.nearest.lastUpdate`, { val: now, ack: true });

                const firstEnabled = vehicles[0];
                if (firstEnabled && firstEnabled.id === live.id) {
                    await this.mirrorPrimaryVehicle(`vehicles.${live.id}`, now);
                }
            }

            await this.setStateAsync("widgets.vehicleCards", {
                val: buildVehicleCardsJson(widgetItems),
                ack: true,
            });

            await this.setStateAsync("tools.lastRefresh", { val: new Date().toISOString(), ack: true });
            await this.setStateAsync("tools.lastRefreshResult", { val: `${source}_ok`, ack: true });
        } catch (e: any) {
            await this.setStateAsync("tools.lastRefreshResult", { val: `${source}_error: ${e?.message || e}`, ack: true });
            throw e;
        } finally {
            this.refreshRunning = false;
        }
    }

    async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state) return;
        if (id === `${this.namespace}.tools.refreshNow` && state.val === true) {
            await this.refreshAll("manual");
            await this.setStateAsync("tools.refreshNow", { val: false, ack: true });
        }
    }

    onUnload(callback: () => void): void {
        try { callback(); } catch { callback(); }
    }
}

if (module.parent) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new CarCharging(options);
} else {
    (() => new CarCharging())();
}
