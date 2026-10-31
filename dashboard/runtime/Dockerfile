FROM node:24-bookworm-slim
ENV CI=1
RUN npm install --global --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs @deepseek-ai/dsh@0.2.2-alpha.2
WORKDIR /app
COPY deepseek-harness-source ./deepseek-harness-source
COPY dashboard/runtime/server.mjs ./server.mjs
ENV DSH_HOME=/tmp/dsh-home
EXPOSE 10000
CMD ["node", "/app/server.mjs"]
