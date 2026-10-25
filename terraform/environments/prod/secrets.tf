# Clave KMS dedicada para cifrar los secretos de la aplicación
resource "aws_kms_key" "app_secrets_key" {
  description             = "KMS Key para secretos de stock-saas en Secrets Manager"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "app_secrets_key_alias" {
  name          = "alias/stock-saas-app-secrets-key"
  target_key_id = aws_kms_key.app_secrets_key.key_id
}

# Secret en AWS Secrets Manager
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "prod/stock-saas/config"
  description             = "Credenciales de DB y entorno para la app de Stock"
  kms_key_id              = aws_kms_key.app_secrets_key.arn
  recovery_window_in_days = 0 # Permite recreación inmediata durante migraciones
}

# Inyección inicial del JSON extraído en la Fase 0
resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id     = aws_secretsmanager_secret.app_secrets.id
  secret_string = file("${path.module}/../../../secrets/secrets_payload.json")
}

# ==============================================================================
# PERMISOS PARA EXTERNAL SECRETS OPERATOR (ESO) VÍA IRSA
# ==============================================================================

# Política IAM que permite leer el secret y descifrarlo con la clave KMS
resource "aws_iam_policy" "external_secrets_policy" {
  name        = "ScriboExternalSecretsReaderPolicy"
  description = "Permite a ESO leer el secreto y usar la clave KMS dedicada"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetResourcePolicy",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.app_secrets_key.arn
      }
    ]
  })
}

# Rol IAM con Trust Policy hacia OIDC de EKS (IRSA) para la ServiceAccount de ESO
resource "aws_iam_role" "external_secrets_role" {
  name = "ScriboExternalSecretsRole"

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
            "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:external-secrets:external-secrets-sa",
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

# Asociar la política al rol IAM
resource "aws_iam_role_policy_attachment" "external_secrets_attach" {
  role       = aws_iam_role.external_secrets_role.name
  policy_arn = aws_iam_policy.external_secrets_policy.arn
}

