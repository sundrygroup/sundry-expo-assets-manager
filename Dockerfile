# Use Node.js 20 for compatibility with dependencies
FROM node:20-bullseye

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-distutils \
    build-essential libvips-dev \
    libatk1.0-0 libatk-bridge2.0-0 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libasound2 libpangocairo-1.0-0 \
    libnss3 libxss1 libxcursor1 libxi6 libxtst6 \
    fonts-liberation libappindicator3-1 \
    && rm -rf /var/lib/apt/lists/*

# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3

# Install VSCE (Visual Studio Code Extension Manager)
RUN npm install -g @vscode/vsce

# Set work directory inside the container
WORKDIR /app

# Copy package.json, yarn.lock, and .yarnrc.yml first (for better caching)
COPY package.json .yarnrc.yml ./

# ⚠️ Remove any existing node_modules & package-lock.json (avoiding macOS binaries)
RUN rm -rf node_modules package-lock.json

# ✅ ENSURE CLEAN YARN INSTALL (Linux-specific dependencies)
RUN yarn set version stable
RUN yarn cache clean && yarn install

# ✅ REMOVE esbuild if it was installed for macOS and reinstall for Linux
RUN yarn remove esbuild && yarn add --dev esbuild@latest

# ✅ Ensure Sharp is installed and rebuilt correctly
RUN yarn add sharp && npm rebuild sharp

# Copy the rest of the project files
COPY . .

# Rebuild native modules for Electron
RUN npx electron-rebuild -f -w sharp || true

# Package the VS Code extension for all major platforms
CMD ["vsce", "package", "--target", "darwin-x64,win32-x64,linux-x64", "--no-yarn"]


# "postinstall": "npx sharp-cli install",