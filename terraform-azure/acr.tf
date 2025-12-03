# Azure Container Registry (ACR)
resource "azurerm_container_registry" "main" {
  count               = var.create_acr ? 1 : 0
  name                = "${var.project_name}${var.environment}acr" # Must be alphanumeric
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = true # Enable for easy Docker login

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-acr"
  })
}
