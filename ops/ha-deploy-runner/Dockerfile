ARG NODE_IMAGE=node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9

FROM ${NODE_IMAGE} AS deploy-tool
WORKDIR /source
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY scripts/deploy-dashboard-ci.ts ./scripts/deploy-dashboard-ci.ts
COPY scripts/sync-dashboard-deployment.ts ./scripts/sync-dashboard-deployment.ts
COPY scripts/lib/dashboardDeployment.ts ./scripts/lib/dashboardDeployment.ts
COPY scripts/lib/runtimeEnv.ts ./scripts/lib/runtimeEnv.ts
COPY scripts/release-machine/production.ts ./scripts/release-machine/production.ts
COPY scripts/release-machine/productionHomeAssistant.ts ./scripts/release-machine/productionHomeAssistant.ts
COPY src/constants/dashboardHosts.ts ./src/constants/dashboardHosts.ts
RUN mkdir -p /output \
  && ./node_modules/.bin/esbuild scripts/deploy-dashboard-ci.ts \
    --bundle \
    --format=esm \
    --platform=node \
    --target=node22 \
    --external:dotenv \
    --external:home-assistant-js-websocket \
    --external:node-scp \
    --outfile=/output/deploy-dashboard-ci.mjs

FROM ${NODE_IMAGE}

ARG RUNNER_VERSION=2.337.0
ARG RUNNER_SHA256=70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    libicu72 \
    libkrb5-3 \
    libssl3 \
    openssh-client \
    socat \
    squid \
    zlib1g \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1001 --shell /bin/bash runner \
  && mkdir -p /home/runner/actions-runner /opt/ha-dashboard/bin \
  && curl --fail --location --silent --show-error \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    --output /tmp/actions-runner.tar.gz \
  && printf '%s  %s\n' "${RUNNER_SHA256}" /tmp/actions-runner.tar.gz \
    | sha256sum --check --strict \
  && tar --extract --gzip \
    --file /tmp/actions-runner.tar.gz \
    --directory /home/runner/actions-runner \
  && rm /tmp/actions-runner.tar.gz \
  && chown -R runner:runner /home/runner /opt/ha-dashboard

WORKDIR /opt/ha-dashboard
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && rm -rf /root/.npm

COPY --from=deploy-tool /output/deploy-dashboard-ci.mjs /opt/ha-dashboard/bin/deploy-dashboard-ci.mjs
COPY ops/ha-deploy-runner/runner-entrypoint.sh /opt/ha-dashboard/bin/runner-entrypoint
COPY ops/ha-deploy-runner/start-github-proxy.sh /opt/ha-dashboard/bin/start-github-proxy
COPY ops/ha-deploy-runner/squid.conf /opt/ha-dashboard/squid.conf

RUN chmod 0555 \
    /opt/ha-dashboard/bin/deploy-dashboard-ci.mjs \
    /opt/ha-dashboard/bin/runner-entrypoint \
    /opt/ha-dashboard/bin/start-github-proxy \
  && mkdir -p /var/log/squid /var/spool/squid \
  && chown -R runner:runner /var/log/squid /var/spool/squid

USER runner
WORKDIR /home/runner/actions-runner
