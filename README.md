# HVE Work App

Dự án quản lý phê duyệt và công việc nội bộ HVE.

## Cấu trúc thư mục
- `hve-frontend`: React + Vite + TailwindCSS PWA
- `hve-backend`: NestJS + PostgreSQL
- `docker-compose.yml`: Chạy PostgreSQL + Redis cho môi trường phát triển cục bộ

## Hướng dẫn cài đặt
1. Khởi động Database: `docker-compose up -d`
2. Backend: `cd hve-backend && npm install && npm run start:dev`
3. Frontend: `cd hve-frontend && npm install && npm run dev`
