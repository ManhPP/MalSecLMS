# Stage 1: Build React SPA
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_DEV_HOST
ARG VITE_DEV_PORT
ARG VITE_API_PROXY_TARGET
ARG VITE_API_PROXY_SECURE

ENV VITE_DEV_HOST=${VITE_DEV_HOST}
ENV VITE_DEV_PORT=${VITE_DEV_PORT}
ENV VITE_API_PROXY_TARGET=${VITE_API_PROXY_TARGET}
ENV VITE_API_PROXY_SECURE=${VITE_API_PROXY_SECURE}

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Sao chép cấu hình Nginx tùy chỉnh để xử lý React Router SPA và proxy API
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Sao chép build tĩnh từ stage 1 vào Nginx webroot
COPY --from=build /app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
