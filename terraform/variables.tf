# Variables for DynaClaimz EKS Deployment

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

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "create_ecr_repositories" {
  description = "Whether to create ECR repositories. Set to false if using external registry (DockerHub, GHCR, etc.)"
  type        = bool
  default     = true
}

# VPC Configuration
variable "create_vpc" {
  description = "Whether to create a new VPC. If false, uses default VPC"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "Existing VPC ID to use (leave empty to auto-detect default VPC)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Existing subnet IDs to use (leave empty to auto-detect default VPC subnets)"
  type        = list(string)
  default     = []
}

variable "vpc_cidr" {
  description = "CIDR block for VPC (only used if create_vpc is true)"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones_count" {
  description = "Number of availability zones to use (only used if create_vpc is true)"
  type        = number
  default     = 3
}

# EKS Configuration
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster (1.32 is current standard support as of Dec 2025)"
  type        = string
  default     = "1.32"
}

variable "node_instance_types" {
  description = "EC2 instance types for EKS worker nodes"
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 5
}

variable "node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 3
}

variable "node_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 10
}

variable "node_disk_size" {
  description = "Disk size for worker nodes (GB)"
  type        = number
  default     = 50
}

# RDS Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum storage for autoscaling (GB)"
  type        = number
  default     = 500
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "14.15"
}

variable "db_username" {
  description = "Master username for RDS"
  type        = string
  default     = "dynaclaimz_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Master password for RDS (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Enable HTTPS with ACM certificate"
  type        = bool
  default     = false
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (required if enable_https is true)"
  type        = string
  default     = ""
}

# Monitoring and Logging
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch container insights"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Use spot instances for worker nodes (not recommended for production)"
  type        = bool
  default     = false
}

variable "spot_instance_percentage" {
  description = "Percentage of spot instances (0-100)"
  type        = number
  default     = 50
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
