FROM node:20-bookworm-slim

# Python is required for ML inference runner (ml_runner.py)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# Install Python ML runtime deps used by the serving artifact
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

# Do not depend on .env file inside container; envs come from compose/task def
CMD ["node", "src/index.js"]
