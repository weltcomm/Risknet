# --- STAGE 1: Build & Dependencias ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./
RUN npm ci --only=production

# --- STAGE 2: Runtime Seguro ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Principio de Menor Privilegio: Crear usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar dependencias y código fuente desde la raíz hacia el contenedor
COPY --chown=appuser:appgroup --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup src/ ./src/

# Cambiar contexto al usuario seguro
USER appuser

EXPOSE 3000

CMD ["node", "src/index.js"]
