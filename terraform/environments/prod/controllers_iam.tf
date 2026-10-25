locals {
  oidc_issuer = replace(aws_iam_openid_connect_provider.eks.url, "https://", "")
}

# ==============================================================================
# 1. AWS LOAD BALANCER CONTROLLER (IRSA)
# ==============================================================================

# Descarga de la política oficial recomendada por AWS (incluye DescribeListenerAttributes)
data "http" "alb_controller_iam_policy" {
  url = "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.8.1/docs/install/iam_policy.json"
}

resource "aws_iam_policy" "load_balancer_controller" {
  name        = "stock-saas-alb-controller-policy"
  description = "Politica IAM para AWS Load Balancer Controller en EKS"
  policy      = data.http.alb_controller_iam_policy.response_body
}

resource "aws_iam_role" "load_balancer_controller" {
  name = "stock-saas-alb-controller-role"

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
            "${local.oidc_issuer}:aud" = "sts.amazonaws.com"
            "${local.oidc_issuer}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "load_balancer_controller" {
  policy_arn = aws_iam_policy.load_balancer_controller.arn
  role       = aws_iam_role.load_balancer_controller.name
}

# ==============================================================================
# 2. EXTERNAL SECRETS OPERATOR (IRSA)
# ==============================================================================

resource "aws_iam_policy" "external_secrets" {
  name        = "ExternalSecretsOperatorIAMPolicy"
  description = "Permisos de lectura restringida a Secrets Manager y KMS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSecretsManagerRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetResourcePolicy",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn
        ]
      },
      {
        Sid    = "AllowKmsDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.app_secrets_key.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "external_secrets" {
  name = "stock-saas-external-secrets-role"

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
            "${local.oidc_issuer}:aud" = "sts.amazonaws.com"
            "${local.oidc_issuer}:sub" = "system:serviceaccount:external-secrets:external-secrets-irsa"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  policy_arn = aws_iam_policy.external_secrets.arn
  role       = aws_iam_role.external_secrets.name
}