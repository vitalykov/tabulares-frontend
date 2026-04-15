NPM := npm
BUILD_DIR := dist
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT_HASH := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

DOCKER_IMAGE := tabulares-frontend
DOCKER_TAG := $(VERSION)

.PHONY: build
build:
	@$(NPM) run build

.PHONY: docker-build
docker-build:
	docker build \
				 --build-arg VERSION=$(VERSION) \
				 --build-arg COMMIT_SHA=$(COMMIT_HASH) \
				 -t $(DOCKER_IMAGE):$(DOCKER_TAG) \
				 -t $(DOCKER_IMAGE):latest \
				 .

.PHONY: docker-run
docker-run:
	docker run -it --rm -p 7777:7777 $(DOCKER_IMAGE):$(DOCKER_TAG)
