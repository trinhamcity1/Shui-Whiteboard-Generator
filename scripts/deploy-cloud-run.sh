#!/usr/bin/env bash
# Phase 2 deploy: builds the Docker image via Cloud Build, wires secrets
# through Secret Manager, deploys to Cloud Run, then sets up a real Cloud
# Tasks queue and re-points the service at itself for async render jobs.
#
# Run this from your machine (needs your own `gcloud auth login` +
# `gcloud auth application-default login`, already done for Firestore).
# Safe to re-run — every step here is idempotent.
set -euo pipefail

# ── Config — edit if your project/region differ ────────────────────────
PROJECT_ID="${PROJECT_ID:-shui-wg-prod}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-shui-wg-api}"
REPO_NAME="${REPO_NAME:-shui-wg}"
QUEUE_NAME="${QUEUE_NAME:-shui-wg-render-queue}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-shui-wg-runtime}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/api"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — this script reads ELEVENLABS_API_KEY, R2_* and TTS_VOICE_ID from it." >&2
  exit 1
fi
read_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

echo "== Project: $PROJECT_ID  Region: $REGION  Service: $SERVICE_NAME =="
gcloud config set project "$PROJECT_ID" >/dev/null

echo "== Enabling required APIs (safe to re-run) =="
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  firestore.googleapis.com

echo "== Artifact Registry repo =="
gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location="$REGION"

echo "== Building and pushing the image via Cloud Build =="
gcloud builds submit --tag "$IMAGE_URI" .

echo "== Runtime service account =="
RUNTIME_SA_EMAIL="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" --display-name="Shui WG Cloud Run runtime"

for role in roles/datastore.user roles/secretmanager.secretAccessor roles/cloudtasks.enqueuer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA_EMAIL}" --role="$role" --condition=None >/dev/null
done

echo "== Secrets (creating new versions each run — values are read from $ENV_FILE, never printed) =="
put_secret() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  WARNING: $name is empty in $ENV_FILE — skipping." >&2
    return
  fi
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- >/dev/null
  fi
  echo "  $name: ok"
}
put_secret "ELEVENLABS_API_KEY" "$(read_env ELEVENLABS_API_KEY)"
put_secret "R2_ACCESS_KEY_ID" "$(read_env R2_ACCESS_KEY_ID)"
put_secret "R2_SECRET_ACCESS_KEY" "$(read_env R2_SECRET_ACCESS_KEY)"

# Non-secret config, passed as plain env vars.
R2_ACCOUNT_ID="$(read_env R2_ACCOUNT_ID)"
R2_BUCKET_NAME="$(read_env R2_BUCKET_NAME)"
R2_ENDPOINT="$(read_env R2_ENDPOINT)"
TTS_VOICE_ID="$(read_env TTS_VOICE_ID)"

echo "== First deploy (no Cloud Tasks wiring yet — need the service URL first) =="
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
  --region="$REGION" \
  --service-account="$RUNTIME_SA_EMAIL" \
  --allow-unauthenticated \
  --memory=4Gi --cpu=2 --timeout=900 --port=8080 \
  --set-env-vars="FIRESTORE_PROJECT_ID=${PROJECT_ID},R2_ACCOUNT_ID=${R2_ACCOUNT_ID},R2_BUCKET_NAME=${R2_BUCKET_NAME},R2_ENDPOINT=${R2_ENDPOINT},TTS_VOICE_ID=${TTS_VOICE_ID}" \
  --set-secrets="ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')"
echo "  Service URL: $SERVICE_URL"

echo "== Cloud Tasks queue =="
gcloud tasks queues describe "$QUEUE_NAME" --location="$REGION" >/dev/null 2>&1 || \
  gcloud tasks queues create "$QUEUE_NAME" --location="$REGION"

echo "== Allowing the runtime SA to invoke the service (needed for Cloud Tasks' OIDC calls) =="
gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
  --region="$REGION" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/run.invoker" >/dev/null

echo "== Re-deploying with Cloud Tasks wired in (switches off DevQueue) =="
gcloud run services update "$SERVICE_NAME" \
  --region="$REGION" \
  --update-env-vars="CLOUD_TASKS_LOCATION=${REGION},CLOUD_TASKS_QUEUE=${QUEUE_NAME},INTERNAL_RENDER_URL=${SERVICE_URL}/internal/render,CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT=${RUNTIME_SA_EMAIL}"

echo ""
echo "== Done =="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test it:"
echo "  curl -X POST ${SERVICE_URL}/v1/videos/generate -H \"x-api-key: YOUR_KEY\" -H \"Content-Type: application/json\" -d '{...}'"
