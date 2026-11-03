FROM node:24-bookworm-slim

ENV CI=1
ENV COREPACK_HOME=/usr/local/share/.cache/node/corepack
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ pkg-config \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@11.28.5 --activate

WORKDIR /opt/deepseek-harness
ARG DSH_COMMIT=ce7073d51254c26cd63b22a60835b8f948deb447
RUN git init \
 && git remote add origin https://github.com/deepseek-ai/deepseek-harness.git \
 && git fetch --depth 1 origin "${DSH_COMMIT}" \
 && git checkout --detach FETCH_HEAD

RUN pnpm install --frozen-lockfile
RUN pnpm exec tsx scripts/build.ts --scope artifacts --serial

COPY entrypoint.sh /usr/local/bin/dsh-entrypoint
RUN chmod +x /usr/local/bin/dsh-entrypoint

ENV PORT=10000
EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/dsh-entrypoint"]
