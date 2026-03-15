
import * as utils from "@iobroker/adapter-core";

interface VehicleConfig {
    id: string;
    name: string;
    socState: string;
    latState: string;
    lonState: string;
    connectedState?: string;
    chargingState?: string;
}

class CarCharging extends utils.Adapter {

    private vehicles: VehicleConfig[] = [];

    constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "carcharging",
        });

        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
    }

    async onReady() {

        this.log.info("CarCharging adapter starting");

        await this.setObjectNotExistsAsync("tools.refreshNow", {
            type: "state",
            common: {
                name: "Refresh now",
                type: "boolean",
                role: "button",
                read: true,
                write: true,
                def: false
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("tools.lastRefresh", {
            type: "state",
            common: {
                name: "Last refresh",
                type: "string",
                role: "value.time",
                read: true,
                write: false
            },
            native: {}
        });

        this.subscribeStates("tools.refreshNow");

        this.vehicles = (this.config as any).vehicles || [];

        for (const v of this.vehicles) {
            const base = `vehicles.${v.id}`;

            await this.setObjectNotExistsAsync(`${base}.soc`, {
                type: "state",
                common: { name: "State of charge", type: "number", role: "value.battery", read: true, write: false },
                native: {}
            });

            await this.setObjectNotExistsAsync(`${base}.lat`, {
                type: "state",
                common: { name: "Latitude", type: "number", role: "value.gps.latitude", read: true, write: false },
                native: {}
            });

            await this.setObjectNotExistsAsync(`${base}.lon`, {
                type: "state",
                common: { name: "Longitude", type: "number", role: "value.gps.longitude", read: true, write: false },
                native: {}
            });

            await this.setObjectNotExistsAsync(`${base}.nearest.station`, {
                type: "state",
                common: { name: "Nearest station", type: "string", role: "value", read: true, write: false },
                native: {}
            });

            await this.setObjectNotExistsAsync(`${base}.nearest.distance`, {
                type: "state",
                common: { name: "Distance to nearest station", type: "number", role: "value.distance", read: true, write: false },
                native: {}
            });
        }

        this.log.info("CarCharging ready");
    }

    async onStateChange(id: string, state: ioBroker.State | null | undefined) {
        if (!state) return;

        if (id === `${this.namespace}.tools.refreshNow` && state.val === true) {

            const now = new Date().toISOString();

            await this.setStateAsync("tools.lastRefresh", {
                val: now,
                ack: true
            });

            await this.setStateAsync("tools.refreshNow", {
                val: false,
                ack: true
            });

            this.log.info("manual refresh triggered");
        }
    }
}

if (module.parent) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new CarCharging(options);
} else {
    (() => new CarCharging())();
}
