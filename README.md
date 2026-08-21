# US Labor Market Indicator Lookup — BLS Data

Look up national US labor market indicators — unemployment rate, CPI,
average hourly earnings, labor force participation, job openings rate
— over recent years, via the official [Bureau of Labor Statistics
public API](https://www.bls.gov/developers/).

Built for finance, macro, and policy research teams tracking the US
labor market trend without pulling BLS's own CSV/Excel releases by
hand.

## Input

```json
{
  "indicators": ["unemploymentRate", "cpi", "averageHourlyEarnings"],
  "yearsBack": 3
}
```

| Field | Type | Description |
|---|---|---|
| `indicators` | array of strings | Which indicators to fetch. One or more of `unemploymentRate`, `cpi`, `averageHourlyEarnings`, `laborForceParticipationRate`, `jobOpeningsRate`. Default `["unemploymentRate"]`. |
| `yearsBack` | number | How many years of monthly history to fetch per indicator. Default `3`, max `20`. |

## Output

One record per requested indicator, with its full monthly history and
a year-over-year comparison:

```json
{
  "indicator": "unemploymentRate",
  "label": "Unemployment rate",
  "unit": "percent",
  "seriesId": "LNS14000000",
  "latestValue": 4.1,
  "latestPeriod": "July 2026",
  "yearOverYearChange": -0.2,
  "yearOverYearPercentChange": -4.65,
  "history": [
    { "year": "2026", "period": "M07", "periodName": "July", "value": 4.1 }
  ]
}
```

An unrecognized indicator key is skipped with a warning rather than
failing the whole run.

## How it works

Direct calls to the official [BLS public API](https://www.bls.gov/developers/)
(`api.bls.gov/publicAPI/v2`) — no proxy, no scraping, no API key
required for this actor's usage level. BLS is a federal statistical
agency; its published data is US government work and in the public
domain. This actor covers a curated set of well-known national series
rather than arbitrary series-ID lookup, since BLS has no key-free
series search endpoint.

## Pricing note

Billed per **lookup** (one run), not per indicator returned — one
charge whether you request 1 indicator or all 5.

## Related products

- [Economic Indicator Lookup](https://github.com/timmKal01/economic-indicator-lookup) — the World Bank international-economics counterpart to this US-specific labor data
- [US National Debt Tracker](https://github.com/timmKal01/us-national-debt-tracker) — daily US fiscal data from the same government-data family
