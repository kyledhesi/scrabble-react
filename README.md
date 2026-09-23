# Scrabble Webapp

A full browser Scrabble game - play a friend locally or against a computer opponent

## Purpose

The purpose of this project was to develop my skills with Jenkins and Terraform. This project implements a Jenkins CI/CD pipeline that builds, tests, and deploys a containerised application to an AWS environment via Terraform.

### CI/CD Pipeline

1. **Code push** — Developer pushes code to GitHub.
2. **CI/CD (Jenkins)** — A webhook triggers a Jenkins pipeline that:
   - Builds the application
   - Runs tests
   - Builds a Docker image
   - Pushes the image to Amazon ECR
   - Runs terraform commands
3. **IaC (Terraform)** - Jenkins executes command 'terraform apply' which creates:
   - VPC — custom VPC with configurable CIDR block
   - Networking — Internet Gateway, 2 public and 2 private subnets across two Availability Zones (for redundancy)
   - NAT Gateways — one per public subnet (with associated Elastic IPs), giving private subnets outbound internet access
   - Routing — default route table for public subnets (routes to IGW), separate route tables for each private subnet (routes to their respective NAT gateway)
   - Application Load Balancer (ALB) — public-facing, deployed across the public subnets, listening on HTTP with a security group allowing inbound/outbound traffic on the app port
   - Target Group — IP-based target group used by the ALB listener to forward traffic to ECS tasks
   - ECS Cluster — Fargate-based cluster with Container Insights enabled
   - ECS Task Definition — Fargate task pulling the app image from an existing ECR repository, with CloudWatch log configuration
   - ECS Service — runs the task in the private subnets (no public IP), registered behind the ALB target group, with its own security group only allowing traffic from the ALB

## Tech stack

- **Frontend:** HTML, CSS, React
- **Backend:** Node.js
- **CI/CD:** GitHub, Jenkins
- **Containerization:** Docker
- **IaC:** Terraform
- **Cloud:** AWS (VPC, ECS, ECR, ALB, Auto Scaling, CloudWatch, NAT Gateway)
- **Region:** eu-west-2 (London), multi-AZ

## Getting started

### Prerequisites

- Docker
- Terraform
- AWS CLI configured with appropriate credentials
- Node.js (if running the app locally without Docker)

### Run locally

```bash
git clone https://github.com/kyledhesi/scrabble-react.git
cd scrabble-react
npm install
npm run dev
```

The app runs on Vite's dev server (default `http://localhost:5173`). To build and preview the production bundle instead:

```bash
npm run build
npm run preview
```

### Run with Docker

```bash
docker build -t scrabble-webapp .
docker run -p 8080:80 scrabble-webapp
```

Go to `http://localhost:8080`.

### Deploy infrastructure

```bash
cd terraform
aws login
terraform init
terraform plan
terraform apply
```

Terraform outputs the ALB's public DNS name (`public_dns_name`) — use that to reach the deployed app.