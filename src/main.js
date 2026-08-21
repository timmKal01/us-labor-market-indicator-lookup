import { Actor, log } from 'apify';
import { fetchIndicators } from './bls.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { indicators = ['unemploymentRate'], yearsBack = 3 } = input;

if (!Array.isArray(indicators) || indicators.length === 0) {
    throw new Error('Input "indicators" must be a non-empty array, e.g. ["unemploymentRate"].');
}

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const INDICATOR_LOOKUP_EVENT = 'indicator-lookup';

const results = await fetchIndicators({
    indicators,
    yearsBack: Math.min(yearsBack, 20),
});

for (const result of results) {
    await Actor.pushData(result);
}

await Actor.charge({ eventName: INDICATOR_LOOKUP_EVENT });

log.info(`Pushed ${results.length} indicator(s)`);

await Actor.exit();
