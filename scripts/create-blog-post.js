#!/usr/bin/env node

// Script to create a blog post from command line arguments
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

// Get arguments
const args = process.argv.slice(2)
if (args.length < 6) {
  console.error('Usage: node create-blog-post.js <title> <slug> <category> <tags> <description> <content> [duration]')
  process.exit(1)
}

const [title, slug, category, tags, description, content, duration] = args

// Validate category
if (category !== 'tech' && category !== 'general') {
  console.error('Category must be either "tech" or "general"')
  process.exit(1)
}

// Create frontmatter
const frontmatter = `---
title: ${title}
description: ${description}
date: ${new Date().toISOString().split('T')[0]}
${duration ? `duration: ${duration}` : ''}
tag: ${tags}
---`

// Full content
const fullContent = `${frontmatter}\n\n${content}`

// Determine file path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const filePath = path.join(__dirname, '..', 'src', 'content', 'blog', category, `${slug}.md`)

// Create directory if it doesn't exist
const dirPath = path.dirname(filePath)
if (!fs.existsSync(dirPath))
  fs.mkdirSync(dirPath, { recursive: true })

// Write file
fs.writeFileSync(filePath, fullContent)

console.log(`Blog post created at: ${filePath}`)
