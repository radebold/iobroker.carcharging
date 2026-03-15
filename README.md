
# ioBroker CarCharging

Alpha TypeScript successor of the CPT adapter.

## Included in alpha.2
- Ported CPT runtime logic into a new `carcharging` adapter namespace
- TypeScript source in `src/main.ts`
- compiled runtime in `build/main.js`
- groundwork for multiple vehicles via `native.vehicles`
- existing CPT single-vehicle config still present for easier migration

## Notes
This alpha keeps the proven CPT logic and prepares the project for modular TypeScript refactoring.
The current runtime still operates on the primary vehicle flow. Multi-vehicle specific runtime logic is the next step.
