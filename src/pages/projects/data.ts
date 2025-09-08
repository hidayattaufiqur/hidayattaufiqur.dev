import type { ProjectData } from '@/types'

export const projectData: ProjectData = [
  {
    title: 'Current D365FO Work',
    projects: [
      {
        text: 'ERP Customization Projects',
        description: 'Developing custom modules and extensions for Dynamics 365 Finance and Operations using X++ to meet specific business requirements.',
        icon: 'i-carbon-enterprise',
        href: '/',
      },
      {
        text: 'Process Automation',
        description: 'Creating automated workflows within D365FO to streamline business operations and improve efficiency.',
        icon: 'i-carbon-automation',
        href: '/',
      },
    ],
  },
  {
    title: 'Backend & API Development',
    projects: [
      {
        text: 'Telkom Indonesia / Digistar Internship',
        description: 'Developed backend server APIs using Typescript that interacted with MySQL, SingleStore, BigQuery, and other Google Cloud services.',
        icon: 'i-carbon-api',
        href: '/',
      },
      {
        text: 'DBT Telkom Indonesia',
        description: 'Worked on an API built using Go and deployed the backend on a virtual server as part of a real-world project.',
        icon: 'i-carbon-cloud',
        href: '/',
      },
      {
        text: 'NFO - LLM Ontology Generator',
        description: 'Currently developing an LLM-aided ontology generation system using Python, Flask, and PostgreSQL.',
        icon: 'i-carbon-cognitive',
        href: '/projects',
      },
    ],
  },
  {
    title: 'Web Development',
    projects: [
      {
        text: 'PaudAliyani Website',
        description: 'Built a website using Node and Express to digitize and introduce PaudAliyani in Pangkep, Sulawesi Selatan.',
        icon: 'i-carbon-web',
        href: 'https://paudaliyani.sch.id/',
      },
      {
        text: 'Teknofest Registration Portal',
        description: 'Led a team to build a web portal for Proclub\'s registration using Node/Express backend and React frontend.',
        icon: 'i-carbon-application',
        href: 'https://teknofest.proclub.tech',
      },
      {
        text: 'BlogAblog',
        description: 'Built a blog app where users can post without creating accounts, using Node/Express backend and HTML+Bootstrap frontend.',
        icon: 'i-carbon-blog',
        href: 'https://blogablog.hidayattaufiqur.dev/',
      },
    ],
  },
  {
    title: 'Mobile Development',
    projects: [
      {
        text: 'Specifit Fitness App',
        description: 'Built a fitness app using Flutter for mobile, React for web admin, and Laravel for backend.',
        icon: 'i-carbon-mobile',
        href: '/',
      },
      {
        text: 'Fix-it Service Platform',
        description: 'Mobile application connecting customers and service providers, built with Node/Express backend and React Native frontend.',
        icon: 'i-carbon-mobile',
        href: '/',
      },
    ],
  },
]
