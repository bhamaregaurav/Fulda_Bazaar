# GitHub Actions Deployment Pipeline

This guide explains how to set up the GitHub Actions deployment pipeline that automatically deploys to your GCP server.

## Required GitHub Secrets

You need to set up the following secrets in your GitHub repository settings:

1. `SSH_PRIVATE_KEY`: The content of your SSH private key file
2. `SSH_KNOWN_HOSTS`: The SSH known hosts entry for your GCP server
3. `GITHUB_USERNAME`: Your GitHub username
4. `GITHUB_PAT`: Your GitHub Personal Access Token with repo permissions

## How to Set Up Secrets

1. **SSH_PRIVATE_KEY**:
   - Get the content of your private key file:
     ```
     cat /home/faizi/Desktop/faizi_work/gdsd-summer-2025-team5/credentials/project_vm_key
     ```
   - Copy the entire output including the BEGIN and END lines
   - In GitHub, go to your repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: SSH_PRIVATE_KEY
   - Value: Paste the copied private key

2. **SSH_KNOWN_HOSTS**:
   - Generate the known_hosts entry:
     ```
     ssh-keyscan -t rsa 34.32.86.172
     ```
   - Copy the output
   - In GitHub, go to your repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: SSH_KNOWN_HOSTS
   - Value: Paste the copied known_hosts entry

3. **GITHUB_USERNAME**:
   - In GitHub, go to your repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: GITHUB_USERNAME
   - Value: Your GitHub username

4. **GITHUB_PAT**:
   - Create a Personal Access Token in GitHub:
     - Go to your GitHub account → Settings → Developer settings → Personal access tokens → Tokens (classic)
     - Click "Generate new token" → "Generate new token (classic)"
     - Give it a descriptive name like "GCP Deployment"
     - Select the "repo" scope
     - Click "Generate token"
   - In GitHub, go to your repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: GITHUB_PAT
   - Value: Paste your newly created token

## Security Notes

- Never commit your private key files or PAT directly to the repository
- The GitHub secrets are encrypted and only exposed during workflow execution
- Consider setting up a dedicated deployment SSH key with limited permissions
- Use a PAT with minimal required permissions (repo scope is sufficient for pulling) 