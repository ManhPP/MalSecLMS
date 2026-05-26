# Stage 1: Build React SPA
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Sao chép cấu hình Nginx tùy chỉnh để xử lý React Router SPA và proxy API
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Sao chép build tĩnh từ stage 1 vào Nginx webroot
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
