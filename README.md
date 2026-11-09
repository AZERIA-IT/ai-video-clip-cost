# AI video clip cost dataset

Cost of one AI video clip per model on [Twistavo](https://twistavo.com) AI Studio, in credits and US dollars. Each row is one model and one subscription plan: the price of a 5-second clip, and of a 10-second clip where the model offers one.

- Source page: https://twistavo.com/pricing/clip-cost
- Dataset page on the source site: https://twistavo.com/pricing/clip-cost/data
- Files here: [`data/clip-cost.csv`](data/clip-cost.csv) (the site's CSV file, unchanged) and [`data/clip-cost.json`](data/clip-cost.json) (the same rows as JSON)

## Columns

| Column | Meaning |
|---|---|
| `model_id`, `model_name`, `family` | Model identifier, display name and provider family |
| `resolution` | Default resolution of the quoted request (empty when the model has none) |
| `sound` | `on` when the model offers sound (quoted with sound on), else `none` |
| `plan`, `plan_price_usd_per_month`, `plan_credits_per_month` | The plan used for the dollar columns |
| `usd_per_credit` | Plan price divided by its monthly credits |
| `clip_5s_credits`, `clip_5s_usd` | Price of a 5-second clip |
| `clip_10s_credits`, `clip_10s_usd` | Price of a 10-second clip (empty when the model has no 10-second clip) |
| `price_date` | Date of the quotes, YYYY-MM-DD |

Rows come in pairs per model: the cheapest plan, then the best-value plan when it is a different plan. Rows are sorted by the cost of a 5-second clip.

## How the numbers are computed

In the source site's own words:

> Each price is the live AI Studio quote of that exact request: the model's default resolution, sound on when the model offers it, no reference media.

> Credits are the AI Studio quote of a 5-second clip, and of a 10-second clip where the model offers one.

> Dollars convert those credits at the plan's price per credit (plan price divided by its monthly credits), rounded to the cent (minimum $0.01).

> Every price is a Twistavo AI Studio quote. The dataset holds no third-party price.

> All prices carry the date of the table build; models the quote refuses have no row.

Prices change when model providers change theirs. Check `price_date` before you quote a number, and the source page for the current table.

## Update

`scripts/build.mjs` downloads https://twistavo.com/pricing/clip-cost/data.csv, checks its header against the site's column list, and writes `data/` and `index.html`. No value is typed by hand. Last update: see `price_date` in the data.

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: "Twistavo, https://twistavo.com/pricing/clip-cost".
