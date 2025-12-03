# Variables for DynaClaimz Azure Infrastructure

# Project Configuration
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "dynaclaimz"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

# AKS Configuration
variable "aks_version" {
  description = "Kubernetes version for AKS"
  type        = string
  default     = "1.28"
}

variable "node_count" {
  description = "Number of nodes in the AKS cluster"
  type        = number
  default     = 3
}

variable "node_vm_size" {
  description = "VM size for AKS nodes"
  type        = string
  default     = "Standard_D2s_v3" # 2 vCPU, 8GB RAM (similar to t3.medium)
}

variable "node_disk_size_gb" {
  description = "OS disk size in GB for AKS nodes"
  type        = number
  default     = 50
}

# PostgreSQL Configuration
variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "14"
}

variable "postgres_sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
  default     = "B_Standard_B2s" # Burstable, 2 vCores, 4GB RAM
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 102400 # 100 GB
}

variable "postgres_backup_retention_days" {
  description = "PostgreSQL backup retention in days"
  type        = number
  default     = 7
}

# ACR Configuration
variable "create_acr" {
  description = "Whether to create Azure Container Registry"
  type        = bool
  default     = true
}

variable "acr_sku" {
  description = "SKU for Azure Container Registry"
  type        = string
  default     = "Basic" # Basic, Standard, or Premium
}

# Network Configuration
variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "aks_subnet_address_prefix" {
  description = "Address prefix for AKS subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "db_subnet_address_prefix" {
  description = "Address prefix for database subnet"
  type        = string
  default     = "10.0.16.0/24"
}
