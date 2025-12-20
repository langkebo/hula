# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.7] - 2025-12-20

### Added
- **Comprehensive Deployment Guide**: Created `docs/COMPREHENSIVE_DEPLOYMENT_GUIDE.md` consolidating all deployment documentation
  - Quick start guide (5-minute deployment)
  - Detailed deployment steps for all infrastructure components
  - In-depth troubleshooting guide for common deployment failures
  - Production environment configuration recommendations
- **Project Status Report**: Created `docs/PROJECT_STATUS_REPORT.md` with complete project analysis
  - Feature completeness assessment
  - Technical debt inventory
  - TODO/FIXME status tracking
  - Optimization recommendations

### Changed
- **README.en.md Sync**: Updated English README to match Chinese version content
  - Added system architecture descriptions for all services
  - Added message execution flow diagram and steps
  - Added performance comparison table (WS service)
  - Added system scalability section
  - Updated technology badges (Spring Cloud 2024)
  - Added community section with QQ group
  - Added sponsors honor list

### Removed
- **AI Module References**: Removed all AI-related code and documentation (module not in use)
  - Removed `luohuo-ai` section from README.md and README.en.md
  - Removed `restart-luohuo-ai.sh` startup script
  - Removed AI references from `all-start.sh`, `all-stop.sh`, `run.sh`
  - Removed AI configuration from `deploy.sh`
  - Cleaned up AI-related comments in `MessageSendListener.java` and `AdminStatsServiceImpl.java`
  - Removed AI-related items from `PROJECT_STATUS_REPORT.md`
- **Redundant Documentation**: Cleaned up duplicate and outdated documentation files
  - `deployment_errors.md` (empty file)
  - `TEST_REPORT.md` (temporary test report)
  - `DEPLOY_GUIDE.md` (merged into comprehensive guide)
  - `DIAGNOSIS_AND_OPTIMIZATION.md` (merged into status report)
  - `scripts/final-cleanup-summary.md` (temporary report)
  - `scripts/project-optimization-report.md` (temporary report)
  - `scripts/todo-status-report.md` (temporary report)
  - `docs/DEPLOYMENT_ISSUES.md` (merged into comprehensive guide)
  - `docs/TECHNICAL_AUDIT_AND_OPTIMIZATION_2025.md` (merged into status report)
  - `docs/PROJECT_REQUIREMENTS_CHECKLIST.md` (merged into comprehensive guide)
  - `docs/PRODUCTION_DEPLOYMENT_ASSESSMENT.md` (merged into status report)
  - `docs/PRIORITY_ISSUES_LIST.md` (merged into status report)
  - `docs/DEPLOYMENT_CHECKLIST.md` (merged into comprehensive guide)
  - `docs/HuLa-Server-Ubuntu部署指南.md` (merged into comprehensive guide)
  - `docs/install/QUICK_START.md` (merged into comprehensive guide)
  - `docs/install/服务端部署文档.md` (merged into comprehensive guide)
- **Redundant Scripts**: Removed `one_click_deploy.sh` (duplicate of `deploy.sh`)

### Documentation
- Established clear documentation hierarchy: README → Quick Start → Detailed Guides
- Standardized documentation formatting and naming conventions
- Ensured all cross-references are valid

### Code Cleanup
- Cleaned up outdated TODO comments in:
  - `PerformanceMonitorServiceImpl.java` - Redis alerts and object conversion
  - `MessageSearchSyncListener.java` - Index mapping creation
  - `DefLoginLogServiceImpl.java` - base_employee replacement
- Updated `PROJECT_STATUS_REPORT.md` to reflect completed optimizations

---

## [Unreleased] - 2025-12-20

### Fixed
- **Permission Issues**: Resolved `EACCES: permission denied` errors for Nacos configuration files (`docs/install/docker/nacos/data`) by updating file ownership to the current user.
- **Documentation Links**: Fixed broken or outdated GitHub repository URLs in `README.md`, `README.en.md`, and `pom.xml` files.
- **Swagger Configuration**: Corrected `licenseUrl`, `termsOfServiceUrl`, and `contact.url` in Swagger/OpenAPI configuration files (`common.yml`, `doc.yml`, `application.yml`) to point to `https://github.com/langkebo/hula`.

### Changed
- **Rebranding**: Updated author references in Javadoc (e.g., `AbstractBuilder.java`) and configuration files to reflect the new project maintainer (`langkebo`).
- **Project Metadata**: Updated Maven `pom.xml` files to point to the new GitHub repository.

### Optimized
- **Configuration Management**: Standardized Swagger configuration across development and production profiles.
