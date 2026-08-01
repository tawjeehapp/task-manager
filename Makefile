# Local control plane for remote Supabase dev/prod.
# Default: ENV=dev. Day-to-day: make use-dev && make db-push && make seed && make dev

.DEFAULT_GOAL := help

ENV ?= dev
PROJECTS_ENV := supabase/projects.env
ACTIVE_FILE := .env.active

-include $(PROJECTS_ENV)

.PHONY: help use-dev use-prod db-push seed seed-admin status dev _require-projects _activate _link

help:
	@echo "Targets:"
	@echo "  make use-dev      Activate .env.dev → .env.local and link Supabase dev"
	@echo "  make use-prod     Activate .env.prod → .env.local and link Supabase prod"
	@echo "  make db-push      Apply migrations to the currently linked project"
	@echo "  make seed         Run seed:dev (dev env only)"
	@echo "  make seed-admin   Run seed:admin (forces password change on first login)"
	@echo "  make status       Show active env and Supabase projects"
	@echo "  make dev          use-dev then npm run dev"

_require-projects:
	@test -f "$(PROJECTS_ENV)" || (echo "Missing $(PROJECTS_ENV)"; exit 1)
	@test -n "$(SUPABASE_PROD_PROJECT_REF)" || (echo "Set SUPABASE_PROD_PROJECT_REF in $(PROJECTS_ENV)"; exit 1)

use-dev: _require-projects
	@test -n "$(SUPABASE_DEV_PROJECT_REF)" || (echo "Set SUPABASE_DEV_PROJECT_REF in $(PROJECTS_ENV) after creating the remote dev project"; exit 1)
	@$(MAKE) _activate ENV=dev ENV_FILE=.env.dev PROJECT_REF=$(SUPABASE_DEV_PROJECT_REF)

use-prod: _require-projects
	@$(MAKE) _activate ENV=prod ENV_FILE=.env.prod PROJECT_REF=$(SUPABASE_PROD_PROJECT_REF)

_activate:
	@test -f "$(ENV_FILE)" || (echo "Missing $(ENV_FILE). Copy from $(ENV_FILE).example and fill values."; exit 1)
	@cp "$(ENV_FILE)" .env.local
	@echo "$(ENV)" > "$(ACTIVE_FILE)"
	@echo "Active env: $(ENV) ($(ENV_FILE) → .env.local)"
	@$(MAKE) _link PROJECT_REF=$(PROJECT_REF) ENV_FILE=$(ENV_FILE)

_link:
	@PW=$$(grep -E '^SUPABASE_DB_PASSWORD=' "$(ENV_FILE)" | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$$//'); \
	if [ -z "$$PW" ] && [ -n "$$SUPABASE_DB_PASSWORD" ]; then PW="$$SUPABASE_DB_PASSWORD"; fi; \
	if [ -z "$$PW" ]; then \
	  echo "Linking $(PROJECT_REF) (will prompt for DB password)..."; \
	  supabase link --project-ref "$(PROJECT_REF)"; \
	else \
	  echo "Linking $(PROJECT_REF)..."; \
	  supabase link --project-ref "$(PROJECT_REF)" --password "$$PW"; \
	fi

db-push:
	@test -f "$(ACTIVE_FILE)" || (echo "No active env. Run make use-dev or make use-prod first."; exit 1)
	@echo "Pushing migrations to $$(cat $(ACTIVE_FILE))..."
	supabase db push

seed:
	@test -f "$(ACTIVE_FILE)" || (echo "No active env. Run make use-dev first."; exit 1)
	@ACTIVE=$$(cat "$(ACTIVE_FILE)"); \
	if [ "$$ACTIVE" != "dev" ]; then \
	  echo "Refusing to run seed:dev against '$$ACTIVE'. Switch with: make use-dev"; \
	  exit 1; \
	fi
	npm run seed:dev

seed-admin:
	@test -f "$(ACTIVE_FILE)" || (echo "No active env. Run make use-dev or make use-prod first."; exit 1)
	@echo "Seeding admin on $$(cat $(ACTIVE_FILE)) (must_change_password=true)..."
	npm run seed:admin

status:
	@if [ -f "$(ACTIVE_FILE)" ]; then echo "Active env: $$(cat $(ACTIVE_FILE))"; else echo "Active env: (none — run make use-dev)"; fi
	@if [ -f .env.local ]; then \
	  URL=$$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | head -1 | cut -d= -f2-); \
	  echo "NEXT_PUBLIC_SUPABASE_URL=$$URL"; \
	fi
	@echo "Project refs (from $(PROJECTS_ENV)):"; \
	echo "  DEV  $(SUPABASE_DEV_PROJECT_REF)"; \
	echo "  PROD $(SUPABASE_PROD_PROJECT_REF)"
	-@supabase projects list

dev: use-dev
	npm run dev
