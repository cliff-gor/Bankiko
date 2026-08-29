#!/bin/bash
# Kill anything already on port 8080
lsof -ti :8080 | xargs kill -9 2>/dev/null && echo "Killed existing process on :8080"

# Load .env from repo root
set -a
source "$(dirname "$0")/../.env"
set +a

./mvnw spring-boot:run
