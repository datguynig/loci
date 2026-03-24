FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json ./
RUN bun install --frozen-lockfile
COPY index.ts ./
EXPOSE 3100
CMD ["bun", "run", "index.ts"]
