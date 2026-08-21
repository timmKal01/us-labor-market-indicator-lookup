import { log } from 'apify';

const BASE_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

/** Well-known national BLS series IDs — BLS has no key-free series search API, so this is a
 *  curated set of standard indicators rather than an arbitrary series-ID lookup. */
export const INDICATORS = {
    unemploymentRate: {
        seriesId: 'LNS14000000',
        label: 'Unemployment rate',
        unit: 'percent',
    },
    cpi: {
        seriesId: 'CUUR0000SA0',
        label: 'Consumer Price Index, all items (US city average)',
        unit: 'index (1982-84=100)',
    },
    averageHourlyEarnings: {
        seriesId: 'CES0500000003',
        label: 'Average hourly earnings, all employees, total private',
        unit: 'dollars',
    },
    laborForceParticipationRate: {
        seriesId: 'LNS11300000',
        label: 'Labor force participation rate',
        unit: 'percent',
    },
    jobOpeningsRate: {
        seriesId: 'JTS000000000000000JOR',
        label: 'Job openings rate (JOLTS)',
        unit: 'percent',
    },
};

async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchSeries(seriesId, startYear, endYear) {
    const url = new URL(`${BASE_URL}/${seriesId}`);
    url.searchParams.set('startyear', String(startYear));
    url.searchParams.set('endyear', String(endYear));

    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const res = await fetchWithTimeout(url);
            const body = await res.json().catch(() => null);

            if (body && body.status === 'REQUEST_SUCCEEDED' && Array.isArray(body.Results?.series)) {
                return body.Results.series[0]?.data ?? [];
            }

            const message = Array.isArray(body?.message) ? body.message.join('; ') : '';
            const retryable = res.status === 429 || res.status >= 500 || body === null;
            lastErr = new Error(`BLS API request failed for series ${seriesId}: ${res.status} ${res.statusText}${message ? ` (${message})` : ''}`);
            if (!retryable) throw lastErr;
        } catch (err) {
            lastErr = err.name === 'AbortError'
                ? new Error(`BLS API request timed out for series ${seriesId} (attempt ${attempt}/${MAX_ATTEMPTS})`)
                : err;
        }

        if (attempt < MAX_ATTEMPTS) {
            const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
            log.warning(`Retrying BLS request for series ${seriesId} in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS}): ${lastErr.message}`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

function toNumber(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export async function fetchIndicators({ indicators, yearsBack }) {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - yearsBack;

    const results = [];
    for (const key of indicators) {
        const meta = INDICATORS[key];
        if (!meta) {
            log.warning(`Skipping unknown indicator "${key}".`);
            continue;
        }

        const rawData = await fetchSeries(meta.seriesId, startYear, currentYear);

        const points = [];
        for (const entry of rawData) {
            try {
                if (!entry || typeof entry !== 'object') continue;
                // BLS uses period "M13" for annual averages mixed into monthly series — skip those,
                // keep only real monthly observations (M01-M12), plus quarterly Qx just in case.
                if (typeof entry.period === 'string' && entry.period === 'M13') continue;
                const value = toNumber(entry.value);
                if (value === null) continue;
                points.push({
                    year: entry.year ?? null,
                    period: entry.period ?? null,
                    periodName: entry.periodName ?? null,
                    value,
                });
            } catch (err) {
                log.warning(`Skipping malformed data point for ${key}: ${err.message}`);
            }
        }

        const latest = points[0] ?? null;
        const yearAgo = points.find((p) => p.year === String(Number(latest?.year) - 1) && p.period === latest?.period) ?? null;
        const change = latest && yearAgo ? Number((latest.value - yearAgo.value).toFixed(3)) : null;
        const percentChange = latest && yearAgo && yearAgo.value !== 0
            ? Number((((latest.value - yearAgo.value) / Math.abs(yearAgo.value)) * 100).toFixed(2))
            : null;

        results.push({
            indicator: key,
            label: meta.label,
            unit: meta.unit,
            seriesId: meta.seriesId,
            latestValue: latest?.value ?? null,
            latestPeriod: latest ? `${latest.periodName} ${latest.year}` : null,
            yearOverYearChange: change,
            yearOverYearPercentChange: percentChange,
            history: points,
        });
    }

    return results;
}
