# EKS Cluster Configuration
# Creates an EKS cluster with managed node groups

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  name               = local.cluster_name
  kubernetes_version = var.eks_cluster_version

  # Explicitly set standard support to comply with corporate policy
  # This ensures no extended support charges are incurred
  upgrade_policy = {
    support_type = "STANDARD"
  }

  # Cluster endpoint configuration
  endpoint_public_access  = true
  endpoint_private_access = true

  # OIDC provider for IRSA (IAM Roles for Service Accounts)
  enable_irsa = true

  # Cluster addons
  addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent       = true
      before_compute    = true  # Install VPC CNI before nodes are created
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = aws_iam_role.ebs_csi_driver.arn
    }
  }

  vpc_id     = local.vpc_id
  subnet_ids = local.subnet_ids

  # Enable cluster creator admin permissions
  enable_cluster_creator_admin_permissions = true

  # EKS Managed Node Groups
  eks_managed_node_groups = merge(
    # Primary node group with on-demand instances
    {
      primary = {
        instance_types = var.node_instance_types
        
        min_size     = var.node_min_size
        max_size     = var.node_max_size
        desired_size = var.node_desired_size

        disk_size = var.node_disk_size
        # disk_type = "gp3"  # Commented out to avoid custom launch template

        # Use latest EKS optimized AMI
        ami_type = "AL2_x86_64"
        
        # Disable custom launch template to avoid IAM restrictions
        use_custom_launch_template = false

        # Enable IMDSv2
        # metadata_options = {
        #   http_endpoint               = "enabled"
        #   http_tokens                 = "required"
        #   http_put_response_hop_limit = 1
        # }

        labels = {
          Environment = var.environment
          NodeGroup   = "primary"
        }

        tags = merge(
          local.common_tags,
          {
            Name = "${var.project_name}-${var.environment}-primary-node"
          }
        )
      }
    },
    # Conditionally add spot instance node group
    var.enable_spot_instances ? {
      spot = {
        instance_types = var.node_instance_types
        
        min_size     = 0
        max_size     = var.node_max_size
        desired_size = floor(var.node_desired_size * var.spot_instance_percentage / 100)

        disk_size = var.node_disk_size
        # disk_type = "gp3"  # Commented out to avoid custom launch template
        
        capacity_type = "SPOT"
        
        # Disable custom launch template to avoid IAM restrictions
        use_custom_launch_template = false

        labels = {
          Environment  = var.environment
          NodeGroup    = "spot"
          CapacityType = "spot"
        }

        taints = [
          {
            key    = "spot"
            value  = "true"
            effect = "NoSchedule"
          }
        ]

        tags = merge(
          local.common_tags,
          {
            Name = "${var.project_name}-${var.environment}-spot-node"
          }
        )
      }
    } : {}
  )

  # Extend cluster security group rules
  security_group_additional_rules = {
    ingress_nodes_ephemeral_ports_tcp = {
      description                = "Nodes on ephemeral ports"
      protocol                   = "tcp"
      from_port                  = 1025
      to_port                    = 65535
      type                       = "ingress"
      source_node_security_group = true
    }
  }

  # Extend node security group rules
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
    
    ingress_cluster_all = {
      description                   = "Cluster to node all ports/protocols"
      protocol                      = "-1"
      from_port                     = 0
      to_port                       = 0
      type                          = "ingress"
      source_cluster_security_group = true
    }

    egress_all = {
      description = "Node all egress"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "egress"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # CloudWatch logging
  enabled_log_types = var.enable_cloudwatch_logs ? [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ] : []

  tags = merge(
    local.common_tags,
    {
      Name = local.cluster_name
    }
  )
}

# IAM role for EKS cluster autoscaler
resource "aws_iam_role" "cluster_autoscaler" {
  name = "${var.project_name}-${var.environment}-cluster-autoscaler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = module.eks.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(module.eks.oidc_provider, "https://", "")}:sub" = "system:serviceaccount:kube-system:cluster-autoscaler"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  name = "${var.project_name}-${var.environment}-cluster-autoscaler"
  role = aws_iam_role.cluster_autoscaler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeScalingActivities",
          "autoscaling:DescribeTags",
          "ec2:DescribeImages",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:GetInstanceTypesFromInstanceRequirements",
          "eks:DescribeNodegroup"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup"
        ]
        Resource = "*"
      }
    ]
  })
}

# EBS CSI Driver IAM role
resource "aws_iam_role" "ebs_csi_driver" {
  name = "${var.project_name}-${var.environment}-ebs-csi-driver"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = module.eks.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(module.eks.oidc_provider, "https://", "")}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi_driver" {
  role       = aws_iam_role.ebs_csi_driver.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}
