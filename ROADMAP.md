# Roadmap

Better YGO prioritizes workflows that players repeat in practice. The roadmap
does not include accounts, community feeds, cloud sync, AI deck
recommendations, or a bundled full card database.

## Next

### Matchup lab

- Save opponent archetype profiles with going-first and going-second Side plans.
- Compare opening-hand success and dead-card rates before and after siding.
- Record best-of-three results and failure reasons against each matchup.

### Global physical inventory

- Reuse owned-card counts across deck projects.
- Import and export inventory as CSV.
- Add cards through image recognition and increment duplicate counts.
- Produce missing-card purchase and proxy-print lists.

### Continuous camera capture

- Detect a stable frame before capture.
- Scan multiple physical cards as a session.
- Merge duplicate detections and expose a fast confirmation queue.

### Tournament package

- Export card-name/count deck registration sheets.
- Record format, banlist revision, event, date, and deck snapshot.
- Include the registration sheet and Side plan in project delivery packages.

### Data-source resilience

- Report the specific failing provider and affected feature.
- Support on-demand provider fallback without bundling or maintaining a full
  local card database.

## Release policy

- `0.x`: public beta, project format migrations remain backward compatible.
- `1.0`: stable project format, documented browser support, reproducible CI,
  and no known release-blocking data-loss defects.
