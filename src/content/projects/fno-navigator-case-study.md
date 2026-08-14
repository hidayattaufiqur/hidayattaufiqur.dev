---
title: "FnO Navigator — D365FO Process Navigator"
description: A static SvelteKit app for navigating Dynamics 365 Finance & Operations (D365FO) business processes, tracing table relationships, and exploring technical customisations.
tags: [D365FO, Svelte, SvelteKit, TypeScript, Side Project]
category: web-development
order: 1
date: 2026-04-26
links:
  - text: Live App
    href: https://fno.hidayattaufiqur.dev
  - text: Source on GitHub
    href: https://github.com/hidayattaufiqur/fno-interactor
---

### Problem

D365FO is a deep, interconnected ERP. When joining a project or debugging an unfamiliar module, it's hard to answer basic questions: what tables are involved in this process? how does a purchase order flow through the system? where does this customisation plug in?
The official documentation is sprawling and the AOT doesn't give you a high-level map.

I wanted a fast reference that answers these questions without opening Visual Studio or digging through wikis.

### Role

Solo author. Problem definition, data modelling, UI design, and implementation.

### Solution

The app has three sections:

- **Process Flows** — grouped by D365FO module (AP, AR, Inventory, etc.). Each flow maps the stages of a business process and links to the tables touched at each step.
- **Table Reference** — searchable list of key D365FO tables with descriptions, fields, and relationships.
- **Table Path Finder** — given two tables, find how they relate to each other through the data model. The table relationship dataset and the concept for this feature came from [Alex D. Meyer's work](https://alexdmeyer.com/): he published a table relation dataset in one of his GitHub repositories, and it proved invaluable here.

### Stack

- **Framework:** SvelteKit (static adapter, zero server cost, deployable anywhere)
- **Build tool:** Vite
- **Data:** Static TypeScript data files — curated from hands-on D365FO work
- **Table relations dataset:** `static/data/fk-map.json` (~2 MB JSON mapping parent tables to FK children with field-level join details, sourced from Microsoft's ax-2012-doc-tools HTML ERD files and Alex Meyer's MicrosoftDynamicsTableAssociations project)
- **Deployment:** Self-hosted behind nginx with Let's Encrypt cert

### Key decisions

- Static site — no backend to maintain, instant loads, deployable anywhere
- SvelteKit chosen for minimal boilerplate and fast interactivity without a heavy runtime
- Data as code (TypeScript) — type-safe, easy to extend, no database needed
- The FK graph covers 39,380 associations across 5,633 tables — the full Microsoft Dynamics schema graph

### Status

Live and in active use. Source is publicly available on [GitHub](https://github.com/hidayattaufiqur/fno-interactor).
