---
title: "NFO — LLM Ontology Generator"
description: LLM-powered Flask backend using LangChain + OpenAI GPT to generate competency questions for ontology development. Improved generation time by 1.5×.
tags: [Python, Flask, LangChain, OpenAI, RAG, GCP]
category: backend
date: 2025-09-01
links:
  - text: Source on GitHub
    href: https://github.com/hidayattaufiqur/NFO
---

### Problem

Building a domain ontology starts with competency questions: structured queries that define what the ontology must be able to answer. Writing these questions is expert-intensive and time-consuming. The goal was to use LLMs to accelerate early-stage ontology development without sacrificing domain specificity.

### Role

Solo backend author. Responsible for LLM integration, prompt engineering, API design, authentication, and deployment.

### Approach

- Users specify a **domain and scope**; the system generates a candidate set of competency questions using OpenAI GPT via **LangChain**
- An iterative prompt design process (few-shot examples, chain-of-thought) reduced hallucinations and improved question quality
- A **validation layer** checks structural consistency before returning results
- Google OAuth2 authentication gates API access to authorised researchers

### Stack

- **Language:** Python 3.8+
- **Framework:** Flask
- **LLM orchestration:** LangChain + OpenAI GPT
- **Auth:** Google OAuth2
- **Dev environment:** Nix (reproducible)

### Key decisions

- LangChain abstracts the LLM provider — swapping models requires minimal code changes
- Interactive user inputs (domain + scope) kept prompts grounded and reduced generic outputs
- Separated question generation from validation so each step can be improved independently
