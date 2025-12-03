# Outputs for DynaClaimz Azure Deployment

# Resource Group
output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "location" {
  description = "Azure region"
  value       = azurerm_resource_group.main.location
}

# AKS Cluster
output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_kube_config" {
  description = "Kubernetes configuration for AKS"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

# ACR
output "acr_login_server" {
  description = "ACR login server URL"
  value       = var.create_acr ? azurerm_container_registry.main[0].login_server : "Not using ACR"
}

output "acr_admin_username" {
  description = "ACR admin username"
  value       = var.create_acr ? azurerm_container_registry.main[0].admin_username : null
  sensitive   = true
}

output "acr_admin_password" {
  description = "ACR admin password"
  value       = var.create_acr ? azurerm_container_registry.main[0].admin_password : null
  sensitive   = true
}

# PostgreSQL
output "postgres_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_admin_username" {
  description = "PostgreSQL admin username"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
  sensitive   = true
}

output "postgres_databases" {
  description = "List of PostgreSQL databases"
  value = {
    user_db   = azurerm_postgresql_flexible_server_database.user_db.name
    policy_db = azurerm_postgresql_flexible_server_database.policy_db.name
    claims_db = azurerm_postgresql_flexible_server_database.claims_db.name
    quotes_db = azurerm_postgresql_flexible_server_database.quotes_db.name
  }
}

# Key Vault
output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

# Convenience Commands
output "configure_kubectl" {
  description = "Command to configure kubectl for AKS"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

output "acr_login_command" {
  description = "Command to login to ACR"
  value       = var.create_acr ? "az acr login --name ${azurerm_container_registry.main[0].name}" : "Not using ACR"
}

output "get_db_password_command" {
  description = "Command to retrieve database password from Key Vault"
  value       = "az keyvault secret show --vault-name ${azurerm_key_vault.main.name} --name postgres-admin-password --query value -o tsv"
  sensitive   = true
}

# Connection Strings
output "database_connection_info" {
  description = "Database connection information"
  value = {
    host     = azurerm_postgresql_flexible_server.main.fqdn
    port     = 5432
    username = azurerm_postgresql_flexible_server.main.administrator_login
    ssl_mode = "require"
  }
  sensitive = true
}

# Summary
output "deployment_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment        = var.environment
    location           = var.location
    cluster_name       = azurerm_kubernetes_cluster.main.name
    kubernetes_version = azurerm_kubernetes_cluster.main.kubernetes_version
    node_count         = var.node_count
    node_vm_size       = var.node_vm_size
    postgres_version   = var.postgres_version
    postgres_sku       = var.postgres_sku_name
    services_count     = length(local.services)
  }
}
