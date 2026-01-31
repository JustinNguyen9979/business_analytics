# Stage 1: Build React App
FROM node:22-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Tăng giới hạn RAM cho Node.js lên 4GB để tránh lỗi Heap Out Of Memory khi build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine as production-stage

# Copy file cấu hình Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy kết quả build từ stage 1
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]