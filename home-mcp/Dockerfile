FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY home-mcp ./home-mcp
COPY scripts/lib/runtimeEnv.ts ./scripts/lib/runtimeEnv.ts

ENV NODE_ENV=production
ENV HOME_MCP_HOST=0.0.0.0
ENV HOME_MCP_PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const https=require('https');const http=require('http');const tls=Boolean(process.env.HOME_MCP_TLS_CERT);(tls?https:http).get({host:'127.0.0.1',port:8787,path:'/health',rejectUnauthorized:false},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

USER node
CMD ["node_modules/.bin/tsx", "home-mcp/server.ts"]
