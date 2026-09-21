# Scrabble Webapp

A full browser Scrabble board - play a friend locally or against a computer opponent

## Architecture Overview

This project implements a CI/CD pipeline that builds, tests, and deploys a 
containerized application to an AWS environment.

### CI/CD Pipeline

1. **Code push** — Developer pushes code to GitHub.
2. **CI/CD (Jenkins)** — A webhook triggers a Jenkins pipeline that:
   - Builds the application
   - Runs tests
   - Builds a Docker image
   - Pushes the image to Amazon ECR
3. **Deploy (ECS)** — ECS pulls the new image from ECR and rolls out an updated task/service.
4. **Serve traffic** — Requests hit an Internet Gateway → Application Load Balancer, which routes traffic to containers running in private subnets across `eu-west-2a` and `eu-west-2b`.
5. **Scale & monitor** — CloudWatch metrics drive Auto Scaling, adding or removing containers based on load.

## Tech stack

- **CI/CD:** GitHub, Jenkins
- **Containerization:** Docker
- **IaC:** Terraform
- **Cloud:** AWS (VPC, ECS, ECR, ALB, Auto Scaling, CloudWatch, NAT Gateway)
- **Region:** eu-west-2 (London), multi-AZ