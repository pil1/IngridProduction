# Stage 1: Build the React application
FROM node:20-alpine AS builder

# Install security updates and build dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user for building
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files with proper ownership
COPY --chown=nextjs:nodejs package.json yarn.lock ./

# Install dependencies as non-root user
USER nextjs
RUN yarn install --frozen-lockfile --production=false

# Copy source code with proper ownership
COPY --chown=nextjs:nodejs . .

# Pass build arguments
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG NODE_ENV=production
ARG BUILD_VERSION=latest

# Set environment variables for build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    NODE_ENV=$NODE_ENV \
    VITE_BUILD_VERSION=$BUILD_VERSION

# Build the application with optimization
RUN yarn build && \
    yarn cache clean

# Stage 2: Production runtime with enhanced security
FROM nginx:1.25-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    tzdata && \
    rm -rf /var/cache/apk/*

# Create non-root user for nginx
RUN addgroup -g 101 -S nginx && \
    adduser -S nginx -u 101 -G nginx

# Copy enhanced nginx configuration
COPY nginx/nginx.prod.conf /etc/nginx/nginx.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf

# Copy built application with proper ownership
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Create necessary directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Add health check endpoint
RUN echo '<!DOCTYPE html><html><head><title>Health Check</title></head><body><h1>OK</h1><p>Service is healthy</p></body></html>' > /usr/share/nginx/html/health

# Security hardening
RUN rm -rf /etc/nginx/conf.d/default.conf && \
    nginx -t

# Add build information
ARG BUILD_VERSION=latest
ARG BUILD_DATE
ARG GIT_COMMIT

LABEL maintainer="INFOtrac Development Team" \
      version="$BUILD_VERSION" \
      build-date="$BUILD_DATE" \
      git-commit="$GIT_COMMIT" \
      description="INFOtrac Frontend Application"

# Switch to non-root user
USER nginx

# Expose port 8080 instead of 80 for security
EXPOSE 8080

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["nginx", "-g", "daemon off;"]