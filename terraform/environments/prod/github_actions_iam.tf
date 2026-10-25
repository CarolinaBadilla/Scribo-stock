# 1. Obtener la identidad de la cuenta de AWS de forma dinámica
data "aws_caller_identity" "current" {}

# 2. Registrar el Proveedor OIDC de GitHub en IAM (si no existe)
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c5876bd52c07b4690c50d4eb07c570b24054a8a"
  ]

  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

# 3. Política de Confianza: Solo tu repositorio y sus workflows pueden asumir el rol
data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

# 4. Creación del IAM Role
resource "aws_iam_role" "github_actions" {
  name               = "github-actions-scribo-deploy-role"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
  description        = "Rol asumido por GitHub Actions para compilar imagenes y desplegar en EKS"

  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

# 5. Política de permisos mínimos: ECR y lectura del cluster EKS
resource "aws_iam_policy" "github_actions_permissions" {
  name        = "github-actions-deploy-policy"
  description = "Permisos para subir imagenes a ECR y describir cluster EKS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuthAndPush"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Sid    = "EKSDescribeCluster"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster"
        ]
        Resource = aws_eks_cluster.main.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_permissions.arn
}

# 6. EKS Access Entry: Autorizar al rol para ejecutar despliegues en scribo-prod
resource "aws_eks_access_entry" "github_actions" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = aws_iam_role.github_actions.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "github_actions" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = aws_iam_role.github_actions.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [
    aws_eks_access_entry.github_actions
  ]
}