# DynaClaimz Azure AKS Infrastructure
# Main Terraform configuration for deploying microservices to Azure

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
  }

  # Backend configuration is optional
  # By default, Terraform uses local backend (terraform.tfstate file)
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}

# Data sources
data "azurerm_client_config" "current" {}

# Local variables
locals {
  cluster_name = "${var.project_name}-${var.environment}-aks"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Application = "DynaClaimz"
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
