# ECR Repositories for Microservices
# Creates private ECR repositories for each service
# Set create_ecr_repositories = false to use external registry

resource "aws_ecr_repository" "services" {
  for_each = var.create_ecr_repositories ? toset(local.services) : []

  name                 = "${var.project_name}/${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-${each.value}"
      Service = each.value
    }
  )
}

# Lifecycle policy to manage image retention
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = var.create_ecr_repositories ? aws_ecr_repository.services : {}
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# IAM policy for EKS nodes to pull from ECR
resource "aws_iam_role_policy_attachment" "eks_ecr_policy" {
  count      = var.create_ecr_repositories ? 1 : 0
  role       = module.eks.eks_managed_node_groups["primary"].iam_role_name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
