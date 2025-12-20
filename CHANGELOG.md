# Changelog

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
