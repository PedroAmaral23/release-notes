# Release Notes Automation

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Azure DevOps](https://img.shields.io/badge/Azure_DevOps-0078D7?style=for-the-badge&logo=azuredevops&logoColor=white)

## About the Project

This project aims to automate the generation of release
notes, transforming commits and Azure DevOps work items
into structured and readable documentation.

The main goal is to reduce manual work and improve
communication between development teams and stakeholders.

## Project Goals

- Automated release notes generation
- Azure DevOps integration
- Slack notifications
- Google Docs integration
- Categorization of changes
- Integration with GitHub Actions

## Technologies

- JavaScript
- Node.js
- GitHub Actions
- Azure DevOps API
- Slack Webhooks
- Google Docs API

## Architecture

```mermaid
flowchart TD
    A[GitHub Push] --> B[GitHub Actions]
    B --> C[Node.js Script]
    D[Azure DevOps] --> C
    C --> E[Release Notes]
    E --> F[Slack]
    E --> G[Google Docs]
```

## Release Notes Format

- Features
- Bug Fixes
- Technical Debt

Each entry can include its work item ID, title
and a short description of the changes.

## Installation

Clone the repository:

```bash
git clone https://github.com/PedroAmaral23/release-notes.git
cd release-notes
npm ci
```

## Configuration

Configure the required GitHub Actions secrets
according to the workflow configuration:

- AZURE_TOKEN
- SLACK_WEBHOOK_URL
- GOOGLE_CREDENTIALS

Never commit credentials or access tokens.

## Project Status

Experimental automation project.

## Author

Pedro H. Teixeira Amaral

- [LinkedIn](https://www.linkedin.com/in/pedro-h-teixeira-amaral-8266923a7/)
- [Portfolio](https://portifolio-pedro-amaral.vercel.app/)
