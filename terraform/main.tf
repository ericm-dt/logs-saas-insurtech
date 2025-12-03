# DynaClaimz AWS EKS Infrastructure
# Main Terraform configuration for deploying microservices to AWS

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.23"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  # Backend configuration is optional
  # By default, Terraform uses local backend (terraform.tfstate file)
  # To use S3 backend: copy backend.tf.example to backend.tf and customize
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Application = "DynaClaimz"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Default VPC data sources (used when create_vpc is false)
data "aws_vpc" "default" {
  count   = var.create_vpc ? 0 : 1
  default = true
}

data "aws_subnets" "default" {
  count = var.create_vpc ? 0 : 1
  
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
  
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# Local variables
locals {
  cluster_name = "${var.project_name}-${var.environment}-eks"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Microservices
  services = [
    "api-gateway",
    "user-service",
    "policy-service",
    "claims-service",
    "quotes-service",
    "locust"
  ]
  
  # VPC and subnet selection
  vpc_id = var.create_vpc ? module.vpc[0].vpc_id : (
    var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default[0].id
  )
  
  subnet_ids = var.create_vpc ? module.vpc[0].private_subnets : (
    length(var.subnet_ids) > 0 ? var.subnet_ids : data.aws_subnets.default[0].ids
  )
  
  # For RDS, use database subnets from VPC module or default subnets
  database_subnet_ids = var.create_vpc ? module.vpc[0].database_subnets : local.subnet_ids
}
