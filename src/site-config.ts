export const siteConfig = {
  author: 'Hidayat Taufiqur Rahmah Achmad',
  title: 'Hi!',
  subtitle: 'Hidayat Taufiqur\'s Personal Website. Built using Visette Theme for Astro.',
  description: 'Hidayat Taufiqur\'s Personal Website. Built using Visette Theme for Astro.',
  image: {
    src: '/hero.jpg',
    alt: 'Website Main Image',
  },
  email: 'hidayattaufiqur@gmail.com',
  socialLinks: [
    {
      text: 'GitHub',
      href: 'https://github.com/hidayattaufiqur',
      icon: 'i-simple-icons-github',
      header: 'i-ri-github-line',
    },
    {
      text: 'Twitter',
      href: 'https://twitter.com/hidayattaufiqur',
      icon: 'i-simple-icons-x',
      header: 'i-ri-twitter-x-line',
    },
    {
      text: 'Linkedin',
      href: 'https://linkedin.com/in/hidayattaufiqur',
      icon: 'i-simple-icons-linkedin',
    },
    {
      text: 'Instagram',
      href: 'https://instagram.com/hidayattaufiqur',
      icon: 'i-simple-icons-instagram',
    },
    {
      text: 'Discord',
      href: 'https://discord.com/users/384880233288957952',
      icon: 'simple-icons:discord',
      header: 'ic:baseline-discord',
    },
  ],
  header: {
    logo: {
      src: '/h.png',
      alt: 'Logo Image',
    },
    navLinks: [
      {
        text: 'About',
        href: '/about',
      },

      {
        text: 'Blog',
        href: '/blog',
      },
      {
        text: 'Notes',
        href: '/blog/notes',
      },
      {
        text: 'Projects',
        href: '/projects',
      },
    ],
  },
  page: {
    blogLinks: [
      {
        text: 'Index',
        href: '/',
      },
      {
        text: 'Blog',
        href: '/blog',
      },
      {
        text: 'Notes',
        href: '/blog/notes',
      },
      {
        text: 'Talks',
        href: '/blog/talks',
      },
    ],
  },
  footer: {
    navLinks: [
      {
        text: 'Posts Props',
        href: '/posts-props',
      },
      {
        text: 'Markdown Style',
        href: '/md-style',
      },
    ],
  },
}

export default siteConfig
