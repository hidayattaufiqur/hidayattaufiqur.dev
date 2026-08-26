---
title: "I Gave D365FO a Map"
description: D365FO is enormous, interconnected, and doesn't come with a map. So I built one.
date: 2026-04-26
duration: 10 min
tag: D365FO, side-project
---

### A side project with a paper trail

Six months into a D365FO client project, I caught myself doing the same thing for the fourth time that week: opening three browser tabs, cross-referencing Microsoft docs, digging through the AOT in Visual Studio, and still not being completely sure which tables were touched when a purchase order got confirmed. The kind of thing that should take two minutes but consistently took forty-five.

That was the moment I started building [FnO Navigator](https://fno.hidayattaufiqur.dev).

It's a reference web app for Dynamics 365 Finance & Operations — a static site that answers the questions you'd otherwise spend half a workday hunting down. No backend, no database. Just the map that D365FO never ships with.

---

### What even is D365FO

If you haven't had the pleasure: Dynamics 365 Finance & Operations is Microsoft's enterprise ERP. Large organizations use it to run finance, procurement, inventory, supply chain, production, HR — basically every operational process that keeps a company from collapsing. It is enormous. Deliberately, architecturally enormous. The kind of system where you can spend a year working in one module and still run into tables you've never seen.

The Application Object Tree — the development environment's browser for the D365FO data model — shows you everything. That's actually part of the problem. It shows you *everything* at once, with no sense of flow, no "this is where you'd start," no indication of how processes connect across modules. Want to know what happens in the database when a vendor invoice gets posted? You'll need either a very experienced colleague or an afternoon of reading, probably both.

The official documentation covers a lot of ground. The issue is that it assumes you already know roughly where to look. If you're getting oriented in an unfamiliar module, or you've just joined a project with an existing D365FO implementation and need to understand the data model quickly, there's no start-here map. There's just the full territory, all at once. FnO Navigator is the start-here map.

---

### What it does

Three features, in order of how much I actually use them:

**Process Flows** — business processes organized by D365FO module, broken into named stages. Each stage shows the roles involved, the menu path to navigate there, documentation links, known pitfalls, prerequisites, and — the part that actually mattered — which D365FO tables get touched at that step. The modules covered include AP, AR, Inventory, Sales, Procurement, Production, Project, Finance, HR, and Service.

This is where most of the work in this project actually lives. The data comes from `flows.ts`, which is currently 4,135 lines of hand-curated TypeScript. Not a flex — I'll come back to that.

**Table Reference** — a searchable catalog of key D365FO tables with plain-English descriptions, their module, field-level definitions (with types and FK targets), and links to relevant docs. The kind of thing that half-exists in the official documentation but not in one place, not structured the way you need it when you're debugging something at 3pm and can't remember what `VendTable` vs `VendTransOpen` actually stores.

**Table Path Finder** — the `/find` route. Given any two D365FO table names, it tells you how they're related through the database schema. Type `PurchLine` and `InventTrans`, get a ranked list of FK relationship chains connecting them. The dataset covers **39,380 associations across 5,633 tables** — the full Microsoft Dynamics schema graph. This one was the fun part to build.

---

### The interesting bit: BFS across a foreign-key graph

The Table Path Finder is basically a graph search problem. Tables are nodes, foreign key relationships are edges, find the shortest path between two nodes. BFS is the right tool for this.

The FK dataset lives in `static/data/fk-map.json` — a ~2 MB JSON file mapping parent tables to their FK children with field-level join details. It comes from two MIT-licensed sources: Microsoft's `ax-2012-doc-tools` repo and Alex Meyer's `MicrosoftDynamicsTableAssociations` project. The file loads lazily on first use, because fetching 2 MB of JSON on every page visit would be pretty rude to anyone on a slow connection.

Once it's loaded, two traversal maps get built from it:

```js
function buildReverseMap() {
  reverseMap = {}
  for (const [parentTable, children] of Object.entries(forwardMap)) {
    for (const [childTable, parentField, childField] of children) {
      if (!reverseMap[childTable])
        reverseMap[childTable] = []
      reverseMap[childTable].push([parentTable, parentField, childField])
    }
  }
}
```

A forward map (`parent → children`) and a reverse map (`child → parents`). BFS then runs from the source table, following edges in both directions at each step:

```js
// At each BFS step, follow both directions in the FK graph
for (const [childTable, parentField, childField] of fkMapForward[currentTable] ?? []) {
  // forward: currentTable is the parent, childTable is the child
}
for (const [parentTable, parentField, childField] of fkMapReverse[currentTable] ?? []) {
  // reverse: currentTable is the child, parentTable is the parent
}
```

FK relationships in D365FO are directional — a child table references a parent — but when you're asking "how are these two tables *related*," the direction of the FK is a detail, not a constraint. A path between `PurchTable` and `VendTrans` might require traversal in both directions through the hierarchy. Following both edges from each node handles that without special casing.

The autocomplete for table names also comes out of the same map once it loads — a `Set` built from all keys in both maps, filtered client-side as you type. No separate lookup, no roundtrip.

---

### The honest parts

**The data is the real cost.** 4,135 lines of TypeScript in `flows.ts` isn't something I brag about — it's a maintenance liability. When a D365FO update renames a menu path or changes how a process flows, that's a manual find-and-update. The process flows are also opinionated in a specific way: I documented them as I encountered them on a particular project, with that project's configuration in mind. They're accurate enough to be useful as a reference, but I wouldn't call them authoritative for every D365FO implementation out there.

**The deployment is, charitably, informal.** The app is live at `fno.hidayattaufiqur.dev`, behind nginx with a proper Let's Encrypt cert — very professional from the outside. The process actually serving it is `npm run dev -- --port 5000 --host 0.0.0.0`. Not a built static export. Not a proper file server. The Vite development server. In production. It's been running without incident and I keep meaning to switch it to a proper build-and-serve setup and keep not doing it. At some point "intend to fix" becomes "committed to the bit."

**Svelte 5 mid-adoption.** I picked up Svelte 5 while it was still relatively new, partly out of curiosity and partly because rune-based reactivity sounded like the right mental model for this use case. It mostly was. There were also a few moments where I was reading the docs, the changelog, and a GitHub issue thread simultaneously trying to figure out why something that should work didn't. The usual price of being slightly early to a major version bump.

---

### TLDR

FnO Navigator is a static SvelteKit reference app for D365FO. It maps business process flows to the D365FO tables they touch, provides a searchable table reference, and can find relationship paths between any two tables through a 39,380-edge FK graph using BFS. No backend, no database — the entire data layer is static TypeScript. If you work in or around D365FO development and spend time hunting for the answers that the official docs don't surface cleanly, it's at [fno.hidayattaufiqur.dev](https://fno.hidayattaufiqur.dev) and the source is at [github.com/hidayattaufiqur/fno-navigator](https://github.com/hidayattaufiqur/fno-navigator).

It exists because I needed it while doing the actual work. That tends to be the best reason to build something.

---

### Resources

- [FnO Navigator (live)](https://fno.hidayattaufiqur.dev) — the app itself
- [fno-navigator on GitHub](https://github.com/hidayattaufiqur/fno-navigator) — source code
- [Alex D. Meyer's blog](https://alexdmeyer.com/) — credit for the FK dataset approach
- [MicrosoftDynamicsTableAssociations](https://github.com/ameyer505/MicrosoftDynamicsTableAssociations) — Alex's FK data project
- [ax-2012-doc-tools](https://github.com/Microsoft/ax-2012-doc-tools) — original Microsoft table relationship data
- [D365FO documentation](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/fin-ops/) — the official docs, useful once you know what you're looking for
- [SvelteKit](https://kit.svelte.dev/) — the framework
