FROM node:24-bookworm-slim
ENV CI=1
RUN corepack enable && corepack prepare pnpm@11.28.5 --activate
WORKDIR /app
COPY deepseek-harness-source ./deepseek-harness-source
WORKDIR /app/deepseek-harness-source
RUN pnpm install --frozen-lockfile
RUN pnpm run build
WORKDIR /app
COPY dashboard/runtime/server.mjs ./server.mjs
ENV DSH_HOME=/tmp/dsh-home
EXPOSE 10000
CMD ["node", "/app/server.mjs"]
