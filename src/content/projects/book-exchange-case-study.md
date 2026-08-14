---
title: "e-be-tc — Book Exchange API"
description: REST API built with TypeScript, CQRS, DDD, Jest unit tests, GitHub Actions CI/CD, and Swagger + Bruno docs.
tags: [TypeScript, Node.js, Express, PostgreSQL, CQRS, DDD, CI/CD]
category: backend
date: 2026-01-01
links:
  - text: Source on GitHub
    href: https://github.com/hidayattaufiqur/e-be-tc
---

### Problem

Design and implement a book borrowing and return system for library members, with proper domain logic, clear API contracts, and a codebase that is maintainable and testable from day one.

### Role

Solo author. Responsible for system design, implementation, testing, deployment, and documentation.

### Architecture

The project applies **Domain-Driven Design (DDD)** and **Command Query Responsibility Segregation (CQRS)**:

- Commands (borrow, return, create member/book) are separated from queries (list available books, member history)
- Domain logic is encapsulated in clear aggregates and value objects, not scattered across controllers
- Infrastructure (PostgreSQL, Express) is kept at the boundary — swappable without touching business logic

### Stack

- **Runtime:** TypeScript, Node.js, Express
- **Database:** PostgreSQL
- **Testing:** Jest (unit tests)
- **API Docs:** Swagger UI + Bruno collection
- **CI/CD:** GitHub Actions
- **Dev environment:** Nix + Direnv (reproducible, no "works on my machine")

### Key decisions

- CQRS keeps read paths cheap and write paths explicit — making business rules easy to audit
- Nix flake ensures every developer (and CI) works with the same tool versions
- Swagger + Bruno gives two ways to explore the API: browser UI and importable request collection
