# 1. Consultar el cluster EKS existente en AWS
data "aws_eks_cluster" "current" {
  name = "stock-saas-prod-eks"
}

# 2. Consultar el proveedor OpenID Connect (OIDC) de ese cluster
data "aws_iam_openid_connect_provider" "current" {
  url = data.aws_eks_cluster.current.identity[0].oidc[0].issuer
}

# 3. Bucket S3 y configuraciones de seguridad
resource "aws_s3_bucket" "scribo_media" {
  bucket        = "scribo-prod-media-assets-512902"
  force_destroy = false

  tags = {
    Environment = "prod"
    Project     = "Scribo"
  }
}

resource "aws_s3_bucket_public_access_block" "scribo_media_block" {
  bucket = aws_s3_bucket.scribo_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "scribo_media_crypto" {
  bucket = aws_s3_bucket.scribo_media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 4. Política IAM para el backend
resource "aws_iam_policy" "scribo_backend_s3_policy" {
  name        = "scribo-prod-backend-s3-access"
  description = "Permisos para que el backend de Scribo acceda al bucket de media"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.scribo_media.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.scribo_media.arn
      }
    ]
  })
}

# 5. Rol IAM con Trust Relationship dinámico hacia el OIDC
resource "aws_iam_role" "scribo_backend_irsa_role" {
  name = "scribo-prod-backend-s3-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.current.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(data.aws_eks_cluster.current.identity[0].oidc[0].issuer, "https://", "")}:sub" : "system:serviceaccount:scribo-prod:backend-serviceaccount",
            "${replace(data.aws_eks_cluster.current.identity[0].oidc[0].issuer, "https://", "")}:aud" : "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "scribo_backend_s3_attach" {
  role       = aws_iam_role.scribo_backend_irsa_role.name
  policy_arn = aws_iam_policy.scribo_backend_s3_policy.arn
}

output "backend_irsa_role_arn" {
  description = "ARN del rol IAM para asignar a la ServiceAccount de Kubernetes"
  value       = aws_iam_role.scribo_backend_irsa_role.arn
}

output "s3_media_bucket_name" {
  description = "Nombre del bucket S3 para media"
  value       = aws_s3_bucket.scribo_media.id
}