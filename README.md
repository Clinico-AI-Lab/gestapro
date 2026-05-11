# gestapro

Project-management dashboard for the **clinicoailab** AI dev lab. Live at <https://clinicoailab.github.io/gestapro/>.

## What it does

Aggregates GitHub data from each tracked project repo and renders a static dashboard with:

- Index of all projects with status, recent activity, headline metric
- Per-project page: description, links, todos (from GH Issues), recent commits, contributors
- 52-week activity heatmap (calendar)
- File-path churn treemap (where coding effort is concentrated)
- Languages breakdown, open issues/PR counts

Data refreshes every 6h via GitHub Actions, snapshots are committed to `main`, site rebuilds and deploys to GitHub Pages.

## Tracked projects

Edit `projects/<slug>.yml` to add/remove/configure projects. Schema validated by zod on every run.

## Development

```sh
npm install                          # install deps
cp .env.example .env                 # add PROJECTS_PAT
npm run validate                     # check YAML schemas
npm run fetch                        # pull GH data → src/data/
npm run dev                          # localhost:4321
npm run build && npm run preview     # production preview
```

## Architecture

```
projects/*.yml  →  scripts/fetch.ts  →  src/data/*.json  →  Astro build  →  GitHub Pages
                          ↑
                  GitHub REST API + git clone (per-file churn)
```

See `/home/thomas/.claude/plans/i-run-an-ai-golden-shamir.md` for full plan.
