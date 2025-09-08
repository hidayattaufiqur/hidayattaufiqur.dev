#!/bin/bash

# Script to build and deploy the blog after new content is added
cd /home/nixos-server/Fun/Projects/hidayattaufiqur.dev

# Build the project
npm run build

# Restart the service
systemctl restart hidayattaufiqurDev.service

echo "Blog deployed successfully!"