FROM node:20-slim

# build-essential provee gcc/g++/make para compilar better-sqlite3
# python3 + pip para generate_pdf.py
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY requirements.txt ./
RUN pip3 install --break-system-packages fpdf2 Pillow

COPY . .

ENV PORT=3000
CMD ["node", "server.js"]
