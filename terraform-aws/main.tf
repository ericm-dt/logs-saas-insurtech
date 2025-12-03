# DynaClaimz AWS EKS Infrastructure
# Main Terraform configuration for deploying microservices to AWS

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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
    "quotes-service"
  ]
}
