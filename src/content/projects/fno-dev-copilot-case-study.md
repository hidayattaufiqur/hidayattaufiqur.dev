---
title: "FnO Dev Copilot — D365FO MCP Server"
description: "MCP server giving AI coding agents factually validated D365FO metadata: 37,612 verified table relations across 5,633 tables, graph path tracing, and a zero-fabrication guarantee."
tags: [D365FO, MCP, Python, AI Tooling, Side Project]
category: backend
order: 1
date: 2026-08-14
---

### Problem

D365FO is a huge ERP with thousands of tables, fields, EDTs, enums, relations, classes, and forms. X++ developers have no good AI assistant. Generic copilots are weak on X++ and the D365FO object model, and answering basic questions means opening Visual Studio or digging through sprawling docs: which tables participate in this process, how do two tables relate, what fields does this table have.

There was also a question hanging over the dataset behind my FnO Navigator. Part of the table-relation graph was rumoured to come from an AI web crawl, which can hallucinate, misread, or omit. Before building more tooling on top of it, every relation had to be traced to a source and proven.

### Role

Solo author. Dataset forensics, the verification pipeline, the MCP server implementation, and the integration into my personal AI agent setup.

### Solution

**Verification first.** A pipeline traced every one of the 39,380 relations to a source and labeled it with a verdict, provenance, and reason. Ground truth: a local D365FO 10.0.2645.32 source mirror (12 models), Microsoft Learn, and the high-trust alexdmeyer AX2012 dataset. Nothing was deleted. 7,067 SUSPECT entries went to quarantine, then were resolved or re-reasoned. 39,380 in, 39,380 out.

The dataset turned out to contain zero AI-crawl relations. Every entry was restructured from the alexdmeyer tier. But the pipeline still caught 1,768 SUSPECT relations against real metadata: field sets that differ from actual relations, undocumented tables, even 22 cases where Microsoft's own docs contradicted the metadata. Those stay honestly labeled instead of being silently trusted.

**The MCP server.** Python with the official MCP SDK, stdio transport, four tools:

- `find_table` — search tables by name or field
- `trace_relation_path` — shortest relation path between two tables through the verified graph
- `explain_element` — everything known about a table: fields, relations, notes
- `stats` — dataset coverage and verdict counts

**Integration.** Registered in OpenCode as `/fno` slash commands (`/fno`, `/fno-explore`, `/fno-trace`, `/fno-explain`, `/fno-stats`) and wired into my D365FO architect agent as a mandatory pre-SQL verification step where table, field, and join claims must be checked against the verified dataset before any SQL or X++ is written. The SQL-first principle is enforced at the agent level.

### Stack

- **Language:** Python (official MCP SDK)
- **Tooling:** uv
- **Ground truth:** D365FO 10.0.2645.32 source mirror, Microsoft Learn, alexdmeyer MicrosoftDynamicsTableAssociations
- **Transport:** stdio — works with OpenCode, Claude Code, Cursor, and my Hermes agents
- **Deployment:** local server spawned by the agent tooling, with the verified subset also serving FnO Navigator's path finder

### Key decisions

- **Zero fabrication as a hard rule:** a relation that cannot be confirmed stays SUSPECT, never promoted to fact
- **Quarantine instead of delete:** nothing is silently dropped from the dataset
- **Version-anchored ground truth:** verified against real 10.0.2645.32 metadata rather than prose docs, which we caught contradicting the metadata in 22 cases
- **Local over remote:** a stdio server is instant, offline, and rate-limit-free compared to remote docs MCPs

### Status

Live in my personal setup since 2026-08-14: the `/fno` command set in OpenCode and the D365FO architect agent's verification flow. The VERIFIED-only graph (37,612 edges) powers FnO Navigator's table path finder today.
