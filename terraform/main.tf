terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

data "aws_ecr_repository" "container_repository" {
  name = "scrabble-webapp"
}

# Create a VPC
resource "aws_vpc" "vpc" {
  cidr_block = "10.0.0.0/16"
  region     = "eu-west-2"
  tags = {
    Name = "Scrabble-VPC"
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
  cidr_block        = "10.0.1.0/24"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "scrabble-public-1A"
  }
}

resource "aws_subnet" "subnet_private_1b" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "scrabble-private-1B"
  }
}

resource "aws_subnet" "subnet_public_2a" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "eu-west-2b"

  tags = {
    Name = "scrabble-public-2A"
  }
}

resource "aws_subnet" "subnet_private_2b" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = "eu-west-2b"

  tags = {
    Name = "scrabble-private-2B"
  }
}

# Create the traffic routes for VPC route table 
resource "aws_route_table" "vpc_route_table" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
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
    Name = "gw NAT"
  }

  # To ensure proper ordering, it is recommended to add an explicit dependency
  # on the Internet Gateway for the VPC.
  depends_on = [aws_internet_gateway.igw]
}

resource "aws_nat_gateway" "public_subnet_2_nat" {
  allocation_id = aws_eip.public_subnet_2_eip.id
  subnet_id     = aws_subnet.subnet_public_2a.id

  tags = {
    Name = "gw NAT"
  }

  # To ensure proper ordering, it is recommended to add an explicit dependency
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
  name        = "scrabble-ip-tg"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.vpc.id
}

# Create public facing load balancer
resource "aws_lb" "scrabble_alb" {
  name               = "scrabble-alb"
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
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_sg_allow_http" {
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
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
  from_port                    = 80
  ip_protocol                  = "tcp"
  to_port                      = 80
}
resource "aws_vpc_security_group_egress_rule" "ecs_sg_outbound" {
  security_group_id = aws_security_group.ecs_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Create ECS cluster
resource "aws_ecs_cluster" "scrabble_cluster" {
  name = "scrabble-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Create ECS task definition 
resource "aws_ecs_task_definition" "scrabble_task_definition" {
  family                   = "scrabble-task-definition"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "3072"
  network_mode             = "awsvpc"
  execution_role_arn       = "arn:aws:iam::949705860149:role/ecsTaskExecutionRole"
  container_definitions = jsonencode([
    {
      name  = "scrabble-main"
      image = data.aws_ecr_repository.container_repository.repository_url

      portMappings = [
        {
          containerPort = 80
          protocol      = "TCP"
        }
      ]

      logConfiguration = { 
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/scrabble"
          awslogs-region        = "eu-west-2"
          awslogs-stream-prefix = "scrabble"
        }
      }
    }
  ])
}

# Create ECS service
resource "aws_ecs_service" "scrabble" {
  name                          = "scrabble"
  task_definition               = aws_ecs_task_definition.scrabble_task_definition.arn
  cluster                       = aws_ecs_cluster.scrabble_cluster.id
  desired_count                 = 2
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
    container_port   = 80
    target_group_arn = aws_lb_target_group.scrabble_ip_tg.arn
  }
}



