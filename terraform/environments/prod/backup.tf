# 1. Bucket S3 para almacenar los volcados de PostgreSQL
resource "aws_s3_bucket" "postgres_backups" {
  bucket = "scribo-db-backups-512902043510"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "Scribo"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# Bloquear todo acceso público al bucket
resource "aws_s3_bucket_public_access_block" "postgres_backups_block" {
  bucket = aws_s3_bucket.postgres_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Encriptación server-side por defecto
resource "aws_s3_bucket_server_side_encryption_configuration" "postgres_backups_crypto" {
  bucket = aws_s3_bucket.postgres_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Ciclo de vida: borrar copias que superen los 30 días
resource "aws_s3_bucket_lifecycle_configuration" "postgres_backups_lifecycle" {
  bucket = aws_s3_bucket.postgres_backups.id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

# 2. Política IAM de mínimo privilegio para escribir en el bucket
resource "aws_iam_policy" "postgres_backup_s3" {
  name        = "ScriboPostgresBackupS3Policy"
  description = "Permite escribir volcados de DB al bucket de backups de Scribo"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = "${aws_s3_bucket.postgres_backups.arn}/*"
      }
    ]
  })
}

# 3. Rol IAM con Trust Policy hacia OIDC de EKS (IRSA) referenciando recursos locales
resource "aws_iam_role" "postgres_backup_role" {
  name = "ScriboPostgresBackupRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:scribo-prod:postgres-backup-sa",
            "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project     = "Scribo"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# Asociar la política al rol
resource "aws_iam_role_policy_attachment" "postgres_backup_attach" {
  role       = aws_iam_role.postgres_backup_role.name
  policy_arn = aws_iam_policy.postgres_backup_s3.arn
}

# Output del ARN del rol para la ServiceAccount de Kubernetes
output "postgres_backup_role_arn" {
  description = "ARN del rol IAM para la ServiceAccount de Kubernetes"
  value       = aws_iam_role.postgres_backup_role.arn
}