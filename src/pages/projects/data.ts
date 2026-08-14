import type { ProjectData } from '@/types'

export const projectData: ProjectData = [
  {
    title: 'Backend & API Development',
    projects: [
      {
        text: 'FnO Dev Copilot — D365FO MCP Server',
        description: 'MCP server giving AI agents factually validated D365FO metadata: 37,612 table relations across 5,633 tables, graph path tracing, and zero fabricated entries.',
        icon: 'i-carbon-robot',
        href: '/projects/fno-dev-copilot-case-study',
      },
      {
        text: 'e-be-tc — Book Exchange API',
        description: 'REST API built with TypeScript, CQRS, DDD, Jest unit tests, GitHub Actions CI/CD, and Swagger + Bruno docs.',
        icon: 'i-carbon-api',
        href: '/projects/book-exchange-case-study',
      },
      {
        text: 'NFO — LLM Ontology Generator',
        description: 'LLM-powered Flask backend using LangChain + OpenAI GPT and RAG to generate competency questions for ontology development. Improved generation time by 1.5×.',
        icon: 'i-carbon-cognitive',
        href: '/projects/nfo-ontology-case-study',
      },
      {
        text: 'Telkom Indonesia — Digistar Internship',
        description: 'Backend APIs in TypeScript integrating BigQuery, SingleStore, and Google Cloud services. Migrated MySQL to SingleStore, improving query performance.',
        icon: 'i-carbon-cloud',
        href: '/projects/telkom-internship-case-study',
      },
      {
        text: 'Telkom Indonesia — DBT Program',
        description: 'Designed and deployed a Go-based API integrating with Camunda to streamline workflow processes as part of an eight-person cross-functional team.',
        icon: 'i-carbon-flow',
        href: '/',
      },
    ],
  },

  {
    title: 'Web Development',
    projects: [
      {
        text: 'FnO Navigator — D365FO Process Navigator',
        description: 'Static SvelteKit app for navigating D365FO business processes, tracing table relations, and exploring module customisations. Live · source on GitHub.',
        icon: 'i-carbon-enterprise',
        href: '/projects/fno-navigator-case-study',
      },
      {
        text: 'Teknofest Registration Portal',
        description: 'Led a team to build a web portal and Discord bot using Node.js and React, facilitating registration for over 1,000 participants.',
        icon: 'i-carbon-application',
        href: 'https://teknofest.proclub.tech',
      },
      {
        text: 'PaudAliyani Website',
        description: 'End-to-end digitalization for a school in Pangkep using Node.js and Express to increase community engagement.',
        icon: 'i-carbon-web',
        href: 'https://paudaliyani.sch.id/',
      },
      {
        text: 'BlogAblog',
        description: 'Blog app where users can post without accounts, built with Node/Express and HTML+Bootstrap.',
        href: 'https://blogablog.hidayattaufiqur.dev/',
      },
    ],
  },

  {
    title: 'Mobile Development',
    projects: [
      {
        text: 'Specifit — Fitness Tracking App',
        description: 'Fitness app with personalized workout recommendations built using React Native (mobile), React (web admin), and Laravel (backend).',
        icon: 'i-carbon-mobile',
        href: '/',
      },
      {
        text: 'Fix-it — Service Platform',
        description: 'Mobile app connecting customers and service providers, built with Node/Express backend and React Native frontend.',
        icon: 'i-carbon-mobile',
        href: '/',
      },
    ],
  },

  {
    title: 'Competitive Programming',
    projects: [
      {
        text: 'cp-archives',
        description: 'Archive of competitive programming solutions in C++ and Go — includes competition entries and practice problems.',
        icon: 'i-carbon-trophy',
        href: 'https://github.com/hidayattaufiqur/cp-archives',
      },
      {
        text: 'e-algo-tc — Algorithm Technical Test',
        description: 'Solutions to algorithm technical challenges, written in C++ and Python.',
        icon: 'i-carbon-code',
        href: 'https://github.com/hidayattaufiqur/e-algo-tc',
      },
    ],
  },

  {
    title: 'College Coursework',
    projects: [
      {
        text: 'Tubes-StrukDat — Data Structures',
        description: 'Final project for Data Structures course. Implemented core data structures and algorithms in C++.',
        icon: 'i-carbon-data-structured',
        href: 'https://github.com/hidayattaufiqur/Tubes-StrukDat',
      },
      {
        text: 'Tubes-AKA — Algorithm Analysis',
        description: 'Final project for Algorithm & Complexity Analysis course in C++.',
        icon: 'i-carbon-function',
        href: 'https://github.com/hidayattaufiqur/Tubes-AKA',
      },
      {
        text: 'Tugas-SISTER — Distributed Systems',
        description: 'Assignment implementing XML-RPC in Python for Distributed Systems (Sistem Terdistribusi) course.',
        icon: 'i-carbon-network-3',
        href: 'https://github.com/hidayattaufiqur/Tugas-SISTER-XMLRPC',
      },
      {
        text: 'Pengantar AI — Fuzzy Logic',
        description: 'Introduction to AI course assignment implementing a Fuzzy Logic system in Python.',
        icon: 'i-carbon-ai-status',
        href: 'https://github.com/hidayattaufiqur/Tugas-Pengantar-AI-Fuzzy-Logic_07',
      },
      {
        text: 'Pengantar AI — Genetic Algorithms',
        description: 'Introduction to AI course assignment implementing a Genetic Algorithm in Python.',
        icon: 'i-carbon-ai-status',
        href: 'https://github.com/hidayattaufiqur/Tugas-Pengantar-AI_Genetic-Algorithms_07',
      },
      {
        text: 'Pengantar AI — Machine Learning',
        description: 'Introduction to AI course assignment covering supervised learning concepts using Jupyter Notebook.',
        icon: 'i-carbon-machine-learning',
        href: 'https://github.com/hidayattaufiqur/Tugas-Pengantar-AI_Learning_07',
      },
      {
        text: 'Tubes-Statistika — Statistics',
        description: 'Final project for Statistics course using Python and Jupyter Notebook for data analysis.',
        icon: 'i-carbon-chart-line',
        href: 'https://github.com/hidayattaufiqur/Tubes-Statistika',
      },
      {
        text: 'Hospital-Finder',
        description: 'Java application for finding hospitals — built as a coursework project.',
        icon: 'i-carbon-hospital',
        href: 'https://github.com/hidayattaufiqur/Hospital-Finder',
      },
    ],
  },
]
