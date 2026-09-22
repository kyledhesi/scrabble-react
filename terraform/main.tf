terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

data "aws_ecr_repository" "container_repository" {
  name = var.ecr_repository_name
}

data "aws_caller_identity" "current" {
}

# Create a VPC
resource "aws_vpc" "vpc" {
  cidr_block = var.vpc_cidr_block
  region     = var.region
  tags = {
    Name = var.vpc_name
  }
}

# Create an Internet Gateway 
# Attach to VPC
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id

  tags = {
    Name = "Scrabble-VPC-IGW"
  }
}

# Create 4 subnets 
# 2 public and 2 private in different Availability Zones for redundancy
resource "aws_subnet" "subnet_public_1a" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = var.public_subnet_1a_cidr
  availability_zone = var.availability_zone_1

  tags = {
    Name = "scrabble-public-1A"
  }
}

resource "aws_subnet" "subnet_private_1b" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = var.private_subnet_1b_cidr
  availability_zone = var.availability_zone_1

  tags = {
    Name = "scrabble-private-1B"
  }
}

resource "aws_subnet" "subnet_public_2a" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = var.public_subnet_2a_cidr
  availability_zone = var.availability_zone_2

  tags = {
    Name = "scrabble-public-2A"
  }
}

resource "aws_subnet" "subnet_private_2b" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = var.private_subnet_2b_cidr
  availability_zone = var.availability_zone_2

  tags = {
    Name = "scrabble-private-2B"
  }
}

# Create elastic IP
resource "aws_eip" "public_subnet_1_eip" {
  domain = "vpc"
}

resource "aws_eip" "public_subnet_2_eip" {
  domain = "vpc"
}

# Create NAT gateways
resource "aws_nat_gateway" "public_subnet_1_nat" {
  allocation_id = aws_eip.public_subnet_1_eip.id
  subnet_id     = aws_subnet.subnet_public_1a.id

  tags = {
    Name = "Public Subnet 1 NAT Gateway"
  }

  # To ensure proper ordering add an explicit dependency
  # on the Internet Gateway for the VPC.
  depends_on = [aws_internet_gateway.igw]
}

resource "aws_nat_gateway" "public_subnet_2_nat" {
  allocation_id = aws_eip.public_subnet_2_eip.id
  subnet_id     = aws_subnet.subnet_public_2a.id

  tags = {
    Name = "Public Subnet 2 NAT Gateway"
  }

  # To ensure proper ordering add an explicit dependency
  # on the Internet Gateway for the VPC.
  depends_on = [aws_internet_gateway.igw]
}

# Update default route table to make the public subnets send traffic to the igw
resource "aws_default_route_table" "default_route_table" {
  default_route_table_id = aws_vpc.vpc.default_route_table_id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

# Associate main route table with public subnets
resource "aws_route_table_association" "public_1a_subnet_association" {
  subnet_id      = aws_subnet.subnet_public_1a.id
  route_table_id = aws_default_route_table.default_route_table.id
}

resource "aws_route_table_association" "public_2a_subnet_association" {
  subnet_id      = aws_subnet.subnet_public_2a.id
  route_table_id = aws_default_route_table.default_route_table.id
}

# Create route tables for private subnets - route traffic to the NAT gateways
resource "aws_route_table" "subnet_private_1b_rt" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.public_subnet_1_nat.id
  }

  tags = {
    Name = "subnet_private_1b_rt"
  }
}

resource "aws_route_table" "subnet_private_2b_rt" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.public_subnet_2_nat.id
  }

  tags = {
    Name = "subnet_private_2b_rt"
  }
}

# Associate route tables with private subnets
resource "aws_route_table_association" "subnet_private_1b_association" {
  subnet_id      = aws_subnet.subnet_private_1b.id
  route_table_id = aws_route_table.subnet_private_1b_rt.id
}

resource "aws_route_table_association" "subnet_private_2b_association" {
  subnet_id      = aws_subnet.subnet_private_2b.id
  route_table_id = aws_route_table.subnet_private_2b_rt.id
}

# Create new security group for alb
resource "aws_security_group" "alb_sg" {
  name   = "alb-sg"
  vpc_id = aws_vpc.vpc.id
}

# Create IP target group for alb
resource "aws_lb_target_group" "scrabble_ip_tg" {
  name        = var.target_group_name
  port        = var.port_number
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.vpc.id
}

# Create public facing load balancer
resource "aws_lb" "scrabble_alb" {
  name               = var.alb_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets = [
    aws_subnet.subnet_public_1a.id,
    aws_subnet.subnet_public_2a.id
  ]
}

# Attatch IP target group to ALB listener
resource "aws_lb_listener" "scrabble_alb_listener" {
  load_balancer_arn = aws_lb.scrabble_alb.arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.scrabble_ip_tg.arn
  }
}

# Editing secuirty rules for ALB SG - allowing all traffic from the internet to access the load balancer and send traffic back to the internet
resource "aws_vpc_security_group_ingress_rule" "alb_sg_allow_http" {
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = var.port_number
  ip_protocol       = "tcp"
  to_port           = var.port_number
}

resource "aws_vpc_security_group_egress_rule" "alb_sg_allow_http" {
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = var.port_number
  to_port           = var.port_number
}

# Create new security group for ecs
resource "aws_security_group" "ecs_sg" {
  name   = "ecs-sg"
  vpc_id = aws_vpc.vpc.id
}

# Editing secuirty rules for ecs SG 
resource "aws_vpc_security_group_ingress_rule" "ecs_sg_inbound" {
  security_group_id            = aws_security_group.ecs_sg.id
  referenced_security_group_id = aws_security_group.alb_sg.id
  from_port                    = var.port_number
  ip_protocol                  = "tcp"
  to_port                      = var.port_number
}
resource "aws_vpc_security_group_egress_rule" "ecs_sg_outbound" {
  security_group_id = aws_security_group.ecs_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Create ECS cluster
resource "aws_ecs_cluster" "scrabble_cluster" {
  name = var.ecs_cluster_name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Create ECS task definition 
resource "aws_ecs_task_definition" "scrabble_task_definition" {
  family                   = var.aws_ecs_task_definition_family_name
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  network_mode             = "awsvpc"
  execution_role_arn       = local.execution_role_arn
  container_definitions = jsonencode([
    {
      name  = var.ecs_container_name
      image = data.aws_ecr_repository.container_repository.repository_url

      portMappings = [
        {
          containerPort = var.port_number
          protocol      = "TCP"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.log_group_name
          awslogs-region        = var.region
          awslogs-stream-prefix = var.log_stream_prefix
        }
      }
    }
  ])
}

# Create ECS service
resource "aws_ecs_service" "scrabble" {
  name                          = var.ecs_service_name
  task_definition               = aws_ecs_task_definition.scrabble_task_definition.arn
  cluster                       = aws_ecs_cluster.scrabble_cluster.id
  desired_count                 = var.ecs_desired_count
  launch_type                   = "FARGATE"
  platform_version              = "LATEST"
  availability_zone_rebalancing = "ENABLED"

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.ecs_sg.id]
    subnets = [
      aws_subnet.subnet_private_1b.id,
    aws_subnet.subnet_private_2b.id]
  }

  load_balancer {
    container_name   = "scrabble-main"
    container_port   = var.port_number
    target_group_arn = aws_lb_target_group.scrabble_ip_tg.arn
  }
}
