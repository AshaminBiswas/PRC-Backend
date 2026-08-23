FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

# Cache dependencies layer
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build
RUN npm prune --production

# Minimal runtime stage (Zero re-downloading)
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/scripts ./src/scripts

EXPOSE 3000
CMD ["npm", "start"]

