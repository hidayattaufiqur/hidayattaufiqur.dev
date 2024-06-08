import type { ProjectData } from '@/types'

export const projectData: ProjectData = [
  {
    title: 'Featured Projects',
    projects: [
      {
        text: 'NFO',
        description: 'Currently developing an LLM-aided ontology generation system that leverages Langchain using Python, Flask, and PostgreSQL.',
        icon: 'i-carbon-cognitive',
        href: '/projects',
      },
      {
        text: 'BlogAblog',
        description: 'Built my first web with a fellow Proclub Teknofest member. This was a blog app where every user has access to post without the hassles of creating an account and having to be logged in. This was built using Node and Express for the Backend as well as HTML+Bootstrap for the Frontend.',
        icon: 'i-carbon-cognitive',
        href: 'https://blogablog.hidayattaufiqur.dev/',
      },
    ],
  },
  {
    title: 'Professional Experience',
    projects: [
      {
        text: 'Telkom Indonesia / Digistar Internship',
        description: 'Developed backend server APIs for internal projects using Typescript that interacted with MySQL, SingleStore, BigQuery, and other Google Cloud services.',
        icon: 'i-carbon-enterprise',
        href: '/projects',
      },
      {
        text: 'DBT Telkom Indonesia / Sustainable Talent Nurturing Program',
        description: 'Worked on an API built using Go and deployed the backend on a virtual server as part of a real-world project from Telkom.',
        icon: 'i-carbon-cloud-service-management',
        href: '/projects',
      },
    ],
  },
  {
    title: 'Web Development',
    projects: [
      {
        text: 'PaudAliyani',
        description: 'Built a website as the step to digitize and introduce PaudAliyani in Pangkep, Sulawesi Selatan, to more people. This project was built using Node and Express.',
        icon: 'i-carbon-web-builder',
        href: 'https://paudaliyani.sch.id/',
      },
      {
        text: 'Teknofest',
        description: 'Led a team to build a web for Proclub’s registration. This project was built using Node and Express for the Backend and React for the Frontend.',
        icon: 'i-carbon-application-web',
        href: 'https://teknofest.proclub.tech',
      },
    ],
  },
  {
    title: 'Mobile Development',
    projects: [
      {
        text: 'Specifit',
        description: 'Built a fitness app that tracks and recommends personal programs for each user based on their respective conditions. This project was rebuilt using Flutter for the Mobile App, React for the web admin panel, and Laravel for the Backend.',
        icon: 'i-carbon-mobile',
        href: '/',
      },
      {
        text: 'Fix-it',
        description: 'Built a mobile application that serves as a bridge connecting customers and service providers in home-related services. This project was built on Node and Express for the Backend, and React Native for the Frontend.',
        icon: 'i-carbon-mobile',
        href: '/',
      },
    ],
  },
]
