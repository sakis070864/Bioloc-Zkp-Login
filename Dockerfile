# Secure-Login: OAuth Authentication Gateway with Biometric Verification
# Multi-stage build optimized for production Docker deployment

# Stage 1: Base Image & Dependencies
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Stage 2: Install Dependencies
FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci --only=production && \
    npm cache clean --force

# Stage 3: Build Application
FROM base AS builder

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Set environment variables for build
ARG AUTH_SECRET
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV AUTH_SECRET=${AUTH_SECRET}
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}

# Build Next.js application
RUN npm run build

# Stage 4: Production Runtime
FROM base AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder stage
COPY --from=builder /app/public ./public

# Create .next directory with proper permissions
RUN mkdir -p .next && \
    chown nextjs:nodejs .next

# Copy Next.js build output (uses output file tracing for smaller image)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy node_modules from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy package.json for reference
COPY --chown=nextjs:nodejs package.json ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Set hostname to 0.0.0.0 so container is accessible
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Start application in standalone mode
CMD ["node", "server.js"]
