#!/bin/bash
# get directory where this script resides
dir=$(cd -P -- "$(dirname -- "$0")" && pwd -P)
cd ${dir}/..
cp ops/envConfig/kokomo-dev.yaml .
gcloud app deploy --quiet kokomo-dev.yaml --project gcp-kokomo-dev --version=devdeployment
rm kokomo-dev.yaml
