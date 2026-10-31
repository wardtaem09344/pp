FROM node:24-bookworm-slim
ENV CI=1
RUN npm install --global @deepseek-ai/dsh@0.2.2-alpha.2
WORKDIR /app
COPY dashboard/runtime/server.mjs ./server.mjs
ENV DSH_HOME=/tmp/dsh-home
EXPOSE 10000
CMD ["node", "/app/server.mjs"]
