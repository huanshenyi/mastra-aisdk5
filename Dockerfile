############################################################
# Multi-stage Dockerfile for Next.js app
# Runtime: Node.js 24 (Debian Slim)
# Optimized for 'standalone' output mode and build caching
# Includes LibreOffice + ImageMagick for PPTX image conversion
############################################################

# 1) Base image for dependency installation and building
FROM node:24-slim AS base
WORKDIR /app
ENV CI=true

# 2) Install all dependencies (deps stage)
FROM base AS deps
# Copy only package files to leverage cache
COPY package.json package-lock.json ./
RUN npm ci

# 3) Build stage
FROM base AS builder
ENV NEXT_PUBLIC_APP_ENV=production
# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the application code
COPY . .
# This will generate the standalone output in .next/standalone
RUN npm run build

# 4) Runtime image
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    TMPDIR=/tmp

# Install dependencies for PPTX image conversion and healthcheck
# - libreoffice: PPTX to PDF conversion
# - imagemagick: PDF to PNG conversion
# - ghostscript: Required by ImageMagick for PDF processing
# - curl: healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    imagemagick \
    ghostscript \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    # ImageMagickのPDFセキュリティポリシーを緩和（PPTX→PDF→PNG変換用）
    && sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml

# Use non-root user provided by the base image
USER node

# Copy standalone output
COPY --from=builder --chown=node:node /app/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Healthcheck (Next.js health endpointを想定: /api/health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:3000/api/health || exit 1

EXPOSE 3000

# Start the application using the standalone server.js
CMD ["node", "server.js"]
