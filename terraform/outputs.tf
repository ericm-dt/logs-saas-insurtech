# Outputs for DynaClaimz EKS Deployment

# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

# EKS Outputs
output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_node_security_group_id" {
  description = "Security group ID attached to the EKS nodes"
  value       = module.eks.node_security_group_id
}

output "eks_oidc_provider_arn" {
  description = "ARN of the OIDC Provider for EKS"
  value       = module.eks.oidc_provider_arn
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS instance address"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.postgres.db_name
}

output "rds_username" {
  description = "RDS master username"
  value       = aws_db_instance.postgres.username
  sensitive   = true
}

output "rds_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

# ECR Outputs
output "ecr_repositories" {
  description = "ECR repository URLs (empty if create_ecr_repositories = false)"
  value = var.create_ecr_repositories ? {
    for k, v in aws_ecr_repository.services : k => v.repository_url
  } : {}
}

output "ecr_repository_arns" {
  description = "ECR repository ARNs (empty if create_ecr_repositories = false)"
  value = var.create_ecr_repositories ? {
    for k, v in aws_ecr_repository.services : k => v.arn
  } : {}
}

# IAM Role Outputs
output "cluster_autoscaler_role_arn" {
  description = "ARN of the Cluster Autoscaler IAM role"
  value       = aws_iam_role.cluster_autoscaler.arn
}

output "aws_load_balancer_controller_role_arn" {
  description = "ARN of the AWS Load Balancer Controller IAM role"
  value       = aws_iam_role.aws_load_balancer_controller.arn
}

output "ebs_csi_driver_role_arn" {
  description = "ARN of the EBS CSI Driver IAM role"
  value       = aws_iam_role.ebs_csi_driver.arn
}

# Convenience Outputs
output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "ecr_login_command" {
  description = "Command to authenticate Docker with ECR (only if using ECR)"
  value = var.create_ecr_repositories ? "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com" : "Not using ECR - authenticate to your own registry"
}

output "database_connection_strings" {
  description = "Database connection strings for each service (retrieve from Secrets Manager)"
  value       = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.db_credentials.name} --query SecretString --output text | jq"
  sensitive   = true
}

# Environment Variables for K8s Deployment
output "k8s_environment_variables" {
  description = "Environment variables to use in Kubernetes deployments"
  value = {
    AWS_REGION         = var.aws_region
    RDS_ENDPOINT       = aws_db_instance.postgres.address
    RDS_PORT           = aws_db_instance.postgres.port
    DB_SECRET_ARN      = aws_secretsmanager_secret.db_credentials.arn
  }
  sensitive = true
}

# Summary
output "deployment_summary" {
  description = "Summary of the deployed infrastructure"
  value = {
    region              = var.aws_region
    environment         = var.environment
    cluster_name        = module.eks.cluster_name
    cluster_version     = var.eks_cluster_version
    node_instance_types = var.node_instance_types
    node_desired_size   = var.node_desired_size
    rds_instance_class  = var.db_instance_class
    rds_multi_az        = var.db_multi_az
    services_count      = length(local.services)
  }
}
