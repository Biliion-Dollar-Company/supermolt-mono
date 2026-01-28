FROM oven/bun:1 AS base
WORKDIR /app

# Install OpenSSL 3 for Prisma
RUN apt-get update && apt-get install -y openssl libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json bun.lock* ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile || bun install

# Generate Prisma client
RUN bunx prisma generate

# Copy source
COPY . .

EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
