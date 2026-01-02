FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled dist folder
COPY dist/ ./dist/

# Set environment variables
ENV NODE_ENV=production
ENV TRANSPORT_MODE=http
ENV HTTP_PORT=3000

# Expose the HTTP port
EXPOSE 3000

# Run the server
CMD ["node", "dist/index.js"]
