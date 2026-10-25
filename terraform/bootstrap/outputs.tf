output "s3_bucket_name" {
  description = "Nombre del bucket S3 para el backend"
  value       = aws_s3_bucket.terraform_state.id
}

output "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB para locking"
  value       = aws_dynamodb_table.terraform_locks.id
}

output "kms_key_arn" {
  description = "ARN de la clave KMS del state"
  value       = aws_kms_key.terraform_state_key.arn
}