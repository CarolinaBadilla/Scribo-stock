output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "ecr_frontend_url" {
  value = aws_ecr_repository.apps["stock-saas/frontend"].repository_url
}

output "ecr_backend_url" {
  value = aws_ecr_repository.apps["stock-saas/backend"].repository_url
}

output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.eks.arn
}

output "secrets_manager_arn" {
  value = aws_secretsmanager_secret.app_secrets.arn
}

output "alb_controller_role_arn" {
  description = "ARN del rol IAM para AWS Load Balancer Controller"
  value       = aws_iam_role.load_balancer_controller.arn
}

output "external_secrets_role_arn" {
  description = "ARN del rol IAM para External Secrets Operator"
  value       = aws_iam_role.external_secrets.arn
}

output "github_actions_role_arn" {
  description = "ARN del rol OIDC para configurar en los secrets de GitHub Actions"
  value       = aws_iam_role.github_actions.arn
}