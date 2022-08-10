# This Makefile has been written according to guidelines at
# https://tech.davis-hansson.com/p/make/

# I've turned off .RECIPEPREFIX because WebStorm can't parse it. See YouTrack
# https://youtrack.jetbrains.com/issue/CPP-23329/Support-RECIPEPREFIX-in-newer-Make-versions-to-avoid-TAB-charact
## Use ">" instead of "\t" for blocks to avoid surprising whitespace issues
#ifeq ($(origin .RECIPEPREFIX), undefined)
#  $(error "This Make does not support .RECIPEPREFIX. Please use GNU Make 4.0 or later. If you've installed an up-to-date Make with homebrew, you maye need to invoke 'gmake' instead of 'make'.")
#endif
#.RECIPEPREFIX = >

# Make sure we use actual bash instead of zsh or sh
SHELL := bash

# Enforce bash "strict mode"
# http://redsymbol.net/articles/unofficial-bash-strict-mode/
.SHELLFLAGS := -euo pipefail -c

# Use one shell session per rule instead of one shell session per line
.ONESHELL:

# Indicate this Makefile is portable
.POSIX:

# Delete the target of a Make rule if the rule fails
.DELETE_ON_ERROR:

# Warn on undefined variables
MAKEFLAGS += --warn-undefined-variables

# Disable all the magical-but-unreadable bits of Make
MAKEFLAGS += --no-builtin-rules

# Wrap npx so it only uses local dependencies
NPX := npx --no-install

# `npm run cli --` messes with stdout so it doesn't play nicely with `$(shell)`
CLI := node -r ./babel-register ./packages/@beacon/cli/src/index.ts

################################################################################
## Callables
################################################################################

#
# Give a fully-qualified package nane (e.g. @beacon/function-ping), returns the
# relative path from the repository root.
#
package_path = ./$(PACKAGES_DIR)/$(1)/src/index.ts
#
# Given a fully-qualified package name (e.g. @beacon/function-ping), returns the
# list of files that package depends on.
#
compute_deps_for_package = $(shell $(CLI) compute-deps-for-package $(1))

################################################################################
## Constants
################################################################################

PACKAGES_DIR             := packages
SENTINEL_DIR             := .tmp/sentinel
SAM_CONFIG_ENV           ?= default
STAGE_NAME							 ?= development

PACKAGES                  := $(subst $(PACKAGES_DIR)/,,$(wildcard $(PACKAGES_DIR)/*/*))

LAMBDA_FUNCTION_PACKAGES  := $(filter @beacon/function-%,$(PACKAGES))
LAMBDA_RESOURCE_NAMES     := $(shell echo '$(subst @beacon/function-,,$(LAMBDA_FUNCTION_PACKAGES))' | sed -r 's#(^|_)([a-z])#Fn\U\2#g')
LAMBDA_OUTPUT_PATHS       := $(addsuffix /index.mjs,$(addprefix .aws-sam/build/,$(LAMBDA_RESOURCE_NAMES)))
LAMBDA_INTERMEDIATE_PATHS := $(addsuffix /index.mjs,$(addprefix .tmp/functions/,$(LAMBDA_FUNCTION_PACKAGES)))

################################################################################
## Public Targets
################################################################################

build: $(LAMBDA_OUTPUT_PATHS)
.PHONY: build

clean:
	rm -rf .aws-sam .tmp/functions
.PHONY: clean

deploy: .tmp/sentinel/deploy
.PHONY: deploy

################################################################################
## Helpers
################################################################################

# Print any Makefile variable
# Usage: make print-USER
print-%:
	@echo $* = $($*)
.PHONY: print-%

$(SENTINEL_DIR):
	@mkdir -p $@

###############################################################################
## Rules
###############################################################################

# I have mixed feelings on this approach. It feels like a bit of a hack since
# we're not using pattern rules and, instead, we're generating a bunch of direct
# rules. On the other hand, it makes make -pq a lot more helpful and it's the
# only way to set up the proper dependency chain.
define GEN_INTERMEDIATE
.tmp/functions/$(PACKAGE)/index.mjs: PACKAGE_PATH=$(call package_path,$(PACKAGE))
.tmp/functions/$(PACKAGE)/index.mjs: $(call compute_deps_for_package,$(PACKAGE))
	$(NPX) esbuild --bundle --outfile=$$(@) --format=esm --platform=node --sourcemap '$$(PACKAGE_PATH)'
endef
$(foreach PACKAGE,$(LAMBDA_FUNCTION_PACKAGES),$(eval $(GEN_INTERMEDIATE)))

$(LAMBDA_OUTPUT_PATHS) &: $(LAMBDA_INTERMEDIATE_PATHS) $(wildcard cloudformation/*)
	 sam build \
	 --config-file $$(pwd)/cloudformation/config.toml \
	 --template-file $$(pwd)/cloudformation/template.yml

.tmp/sentinel/deploy: $(LAMBDA_OUTPUT_PATHS) | $(SENTINEL_DIR)
	sam deploy \
	 --config-file $$(pwd)/cloudformation/config.toml \
	 --template-file $$(pwd)/cloudformation/template.yml \
	 --parameter-overrides "SHA=$$(git rev-parse HEAD) StageName=$(STAGE_NAME)"
	@touch $@

###############################################################################
## Targets
###############################################################################

packages/@beacon/gateway-schema/src/__generated__/index.ts: cloudformation/api.yml
	$(NPX) openapi-typescript $< --prettier-config ./.prettierrc --output $@

README.md:
	$(NPX) markdown-toc -i --bullets='-' --maxdepth=3 README.md
	# TODO $(NPX) prettier --write README.md
.PHONY: README.md
