FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS dependencies
WORKDIR /workspace
COPY app/package*.json ./
COPY docker/install-dependencies.mjs ./install-dependencies.mjs
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && node install-dependencies.mjs

FROM dependencies AS source
COPY app/ ./

FROM source AS test
CMD ["sh", "-c", "npm run format:check && npm test"]

FROM source AS build
RUN npm run build

FROM nginx:1.28-alpine AS runtime
COPY --from=build /workspace/dist/erbas-client/browser /usr/share/nginx/html
COPY --chmod=755 docker/40-demo-defaults.sh /docker-entrypoint.d/40-demo-defaults.sh
COPY docker/health-proxy.conf /etc/nginx/health-proxy.conf
COPY docker/resource-proxy.conf /etc/nginx/resource-proxy.conf
COPY docker/user-proxy.conf /etc/nginx/user-proxy.conf
COPY docker/auth-proxy.conf /etc/nginx/auth-proxy.conf
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
ENV ERBAS_JAVA_UPSTREAM=erbas-app-1:8080 ERBAS_DOTNET_UPSTREAM=alxarafe-dotnet-app-1:8080
EXPOSE 80
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
