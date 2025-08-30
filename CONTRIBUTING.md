# Contributing to Trade Marketing Platform

Thank you for your interest in contributing to the Trade Marketing Platform! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- Kubernetes (for local development)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/trade-marketing-platform.git
   cd trade-marketing-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development environment**
   ```bash
   docker-compose up -d
   ```

4. **Run services locally**
   ```bash
   # Start all services
   npm run dev

   # Or start individual services
   cd backend/api-gateway && npm run dev
   cd backend/company-service && npm run dev
   # ... etc
   ```

## 📋 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Use meaningful variable and function names
- Write comprehensive JSDoc comments for public APIs
- Follow the existing architectural patterns

### Git Workflow
1. Create a feature branch from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit with conventional commits
   ```bash
   git add .
   git commit -m "feat(service-name): add new feature"
   ```

3. Push your branch and create a Pull Request
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format
We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

### Testing
- Write unit tests for all new functionality
- Ensure all tests pass before submitting PR
- Aim for >80% code coverage
- Include integration tests for API endpoints
- Test error scenarios and edge cases

```bash
# Run tests for all services
npm test

# Run tests for specific service
cd backend/api-gateway && npm test

# Run tests with coverage
npm run test:coverage
```

### Documentation
- Update README files for any new features
- Document API changes in OpenAPI specs
- Update architecture diagrams if needed
- Include inline code documentation

## 🏗️ Architecture Guidelines

### Microservices
- Each service should be independently deployable
- Use event-driven communication between services
- Implement proper error handling and circuit breakers
- Follow the single responsibility principle

### Database
- Use migrations for schema changes
- Follow database naming conventions
- Implement proper indexing strategies
- Use transactions for data consistency

### API Design
- Follow RESTful principles
- Use consistent error response formats
- Implement proper pagination
- Version APIs appropriately
- Document all endpoints with OpenAPI

### Security
- Never commit secrets or credentials
- Use environment variables for configuration
- Implement proper input validation
- Follow OWASP security guidelines
- Use HTTPS for all communications

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, versions)
- Screenshots or logs if applicable

## 💡 Feature Requests

For new features:
- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider backward compatibility
- Discuss potential alternatives
- Provide use cases and examples

## 📦 Release Process

1. **Development**: Work happens on `develop` branch
2. **Feature Branches**: Create from `develop`, merge back via PR
3. **Release Candidates**: Create `release/x.y.z` branch from `develop`
4. **Production**: Merge release branch to `main`
5. **Hotfixes**: Create from `main`, merge to both `main` and `develop`

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

## 🔍 Code Review Process

All changes must go through code review:

1. **Self Review**: Review your own code before requesting review
2. **Automated Checks**: Ensure CI/CD pipeline passes
3. **Peer Review**: At least one team member must approve
4. **Testing**: Verify changes work as expected
5. **Documentation**: Ensure docs are updated

### Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Backward compatibility maintained

## 🚀 Deployment

### Staging
- Automatic deployment from `develop` branch
- Used for integration testing
- Accessible to internal team

### Production
- Manual deployment from `main` branch
- Requires approval from maintainers
- Blue-green deployment strategy
- Rollback capability available

## 📞 Getting Help

- **Documentation**: Check existing docs first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Chat**: Join our development chat (link in README)

## 🏆 Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Annual contributor highlights

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to the Trade Marketing Platform! 🎉