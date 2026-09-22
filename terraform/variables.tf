variable "region" {
  type        = string
  description = "The region for the VPC"
  default     = "eu-west-2"
}

variable "vpc_cidr_block" {
  type        = string
  description = "The CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "vpc_name" {
  type        = string
  description = "The name of the VPC"
  default     = "Scrabble-VPC"
}

variable "ecr_repository_name" {
  type        = string
  description = "The name of the ECR repository"
  default     = "scrabble-webapp"
}

variable "availability_zone_1" {
  description = "First Availability Zone - 2a"
  type        = string
  default     = "eu-west-2a"
}

variable "availability_zone_2" {
  description = "Second Availability Zone - 2b"
  type        = string
  default     = "eu-west-2b"
}

variable "public_subnet_1a_cidr" {
  description = "CIDR block for public subnet 1A"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_1b_cidr" {
  description = "CIDR block for private subnet 1B"
  type        = string
  default     = "10.0.2.0/24"
}

variable "public_subnet_2a_cidr" {
  description = "CIDR block for public subnet 2A"
  type        = string
  default     = "10.0.11.0/24"
}

variable "private_subnet_2b_cidr" {
  description = "CIDR block for private subnet 2B"
  type        = string
  default     = "10.0.12.0/24"
}

variable "alb_name" {
  description = "Name of the Application Load Balancer"
  type        = string
  default     = "scrabble-alb"
}

variable "target_group_name" {
  description = "Name of the ALB target group"
  type        = string
  default     = "scrabble-ip-tg"
}

variable "port_number" {
  type        = number
  description = "Port number"
  default     = 80
}

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "scrabble-cluster"
}

variable "ecs_service_name" {
  description = "Name of the ECS service"
  type        = string
  default     = "scrabble"
}

variable "aws_ecs_task_definition_family_name" {
  description = "Family name for the ECS task definition"
  type        = string
  default     = "scrabble-task-definition"
}

variable "ecs_container_name" {
  description = "Name of the ECS container"
  type        = string
  default     = "scrabble-main"
}

variable "ecs_cpu" {
  description = "CPU units allocated to the ECS task"
  type        = string
  default     = "1024"
}

variable "ecs_memory" {
  description = "Memory in MB allocated to the ECS task"
  type        = string
  default     = "3072"
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "log_group_name" {
  description = "CloudWatch log group used by ECS"
  type        = string
  default     = "/ecs/scrabble"
}

variable "log_stream_prefix" {
  description = "Prefix for ECS CloudWatch log streams"
  type        = string
  default     = "scrabble"
}