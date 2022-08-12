# ARGs used in FROM statements must appears at the top of the file.
# Default to node:gallium-buster-slim so we have a safe place to copy from in
# case we don't yet have a cache image
# Gallium is the codename for Node 16.x
ARG NODE_MODULES_CACHE_IMAGE=node:gallium-buster-slim
ARG BASE_IMAGE=node:gallium-buster-slim
# ------------------------------------------------------------------------------
# CI image
#
# This file configure the CI environment used to build this project. It does not
# go to production.
#
# Inspired, in part, by
# https://itnext.io/speeding-up-your-ci-cd-build-times-with-a-custom-docker-image-3bfaac4e0479
#
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# Chamber Image
# ------------------------------------------------------------------------------

FROM segment/chamber:2 AS chamber

# ------------------------------------------------------------------------------
# Cache Image
#
# Pull the main branch image from ECR and label it as a build stage so we can
# copy the npm cache from it later
#
# ------------------------------------------------------------------------------

FROM $NODE_MODULES_CACHE_IMAGE as node-modules-cache
# This should match the NPM_CACHE_FOLDER defined in the base stage. I'm not sure
# how to define it globally. Maybe a build arg whose default never gets
# overridden?
ENV NPM_CACHE_FOLDER=/root/.npm

# Make sure the cache folder exists if we're in the fallback case where we're
# using the base node image instead of an image from a previous build. Without
# this, the COPY command below will fail.
RUN mkdir --parents $NPM_CACHE_FOLDER

# ------------------------------------------------------------------------------
# Base Image
# ------------------------------------------------------------------------------

FROM $BASE_IMAGE as base

# Define the npm cache folder at its default location (I'm not sure why this
# matters, but the cache didn't seem to be used if we don't pass --cache to npm
# ci).
ENV NPM_CACHE_FOLDER=/root/.npm
# Quiet the install log
ENV NPM_CONFIG_LOGLEVEL warn

ENV MAKE_VERSION="4.3"

COPY --from=chamber /chamber /usr/local/bin/chamber

RUN apt-get update \
  # General Utilities
  && apt-get install --no-install-recommends -y \
  # && apt-get install --no-install-recommends -y \
  curl \
  git \
  jq \
  make \
  python-pip \
  time \
  zip \
  unzip \
  && pip install --upgrade setuptools \
  && pip install --upgrade pip \
  && pip install --upgrade awscli \
  # Node helpers
  && apt-get install --no-install-recommends -y \
  node-gyp \
  g++ \
  # Docker CLI \
  && apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  # Install an adequately recent make. At time of writing, node-gallium-slim
  # ships with make-4.2 which doesn't handle `dist/%.js &: src/%.tsx` correctly.
  && cd /tmp \
  && curl -o "make-$MAKE_VERSION.tar.gz" "http://ftp.gnu.org/gnu/make/make-$MAKE_VERSION.tar.gz" \
  && tar -xf "make-$MAKE_VERSION.tar.gz" \
  && rm "make-$MAKE_VERSION.tar.gz" \
  && cd "make-$MAKE_VERSION" \
  && ./configure prefix=/usr/local \
  && make \
  && make install \
  && cd .. \
  && rm -rf "make-$MAKE_VERSION" \
  # Cleanup
  && apt-get purge --auto-remove -y && \
  rm -rf /var/lib/apt/lists/*

# Install SAM
# https://github.com/aws/aws-sam-cli/releases/download/${SAM_VERSION}/aws-sam-cli-linux-x86_64.zip \

ENV SAM_VERSION=v1.53.0
ENV SAM_CHECKSUM=35261dc7fd9f54d4973fdcd56b7114546f9e27e2cb2d12744164bb7480d460dd
RUN curl -L -o aws-sam-cli.zip  https://github.com/aws/aws-sam-cli/releases/download/${SAM_VERSION}/aws-sam-cli-linux-x86_64.zip \
  && echo "${SAM_CHECKSUM} aws-sam-cli.zip" | sha256sum --check \
  && unzip aws-sam-cli.zip -d sam-installation \
  && ./sam-installation/install \
  && rm -rf aws-sam-cli.zip sam-installation

# Install Sentry CLI
RUN curl -sL https://sentry.io/get-cli/ | bash

# ------------------------------------------------------------------------------
# Early Package Files
#
# npm ci won't install workspace dependencies listed in package-lock.json if the
# source workspace package's package.json is not present.
#
# There's no easy way to copy by glob, so instead we can copy everything in
# packages to a temporary stage, then delete everything except each package.json
# in order to ensure that npm ci works correctly in the next stage.
# ------------------------------------------------------------------------------

FROM base as early-package-files

WORKDIR /app

COPY ./packages ./packages

RUN find ./packages -type f | grep -v package.json | xargs rm

# ------------------------------------------------------------------------------
# CI Image
#
# This target is mostly just here to break up the docker file. We expect the
# `base` target to be pretty stable, but everything from here down will probaly
# change daily thanks to dependabot.
# ------------------------------------------------------------------------------

FROM base as ci

WORKDIR /app

# Prime the global node modules cache with the last main branch build's cache
COPY --from=node-modules-cache ${NPM_CACHE_FOLDER} ${NPM_CACHE_FOLDER}

COPY package.json package.json
COPY package-lock.json package-lock.json

COPY --from=early-package-files /app/packages ./packages

# If this project uses patch-package, uncomment the following to copy patch
# files before running npm ci (this step fails if the source folder doesn't
# exist)
# COPY patches patches

RUN time npm ci --cache ${NPM_CACHE_FOLDER}

# Copy the rest of the code
COPY ./ ./

RUN make build
