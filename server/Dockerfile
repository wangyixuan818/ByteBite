FROM node:20-alpine

WORKDIR /app

# Copy manifests first, this layer is cached unless dependencies change,
# so rebuilds after a code edit skip the slow npm install
COPY package*.json ./
RUN npm ci --omit=dev

# now the application source
COPY . .

# the app listens on PORT, defaulting to 5001
EXPOSE 5001

CMD ["node", "server.js"]