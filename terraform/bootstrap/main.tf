terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "stock-saas"
      Environment = "production"
      ManagedBy   = "Terraform"
      Layer       = "Bootstrap"
    }
  }
}

# KMS Key para cifrado en reposo del State
resource "aws_kms_key" "terraform_state_key" {
  description             = "KMS Key para el cifrado del Terraform State en S3"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "terraform_state_key_alias" {
  name          = "alias/stock-saas-tfstate-key"
  target_key_id = aws_kms_key.terraform_state_key.key_id
}

# S3 Bucket para Remote State
resource "aws_s3_bucket" "terraform_state" {
  bucket        = "stock-saas-tfstate-${var.aws_account_id}-${var.aws_region}"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

# Versionado obligatorio para auditoría y recuperación de estado
resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Cifrado server-side con la clave KMS creada
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_crypto" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.terraform_state_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Bloqueo total de accesos públicos (S3 Block Public Access)
resource "aws_s3_bucket_public_access_block" "terraform_state_block_public" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB para State Locking (previene ejecuciones concurrentes)
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "stock-saas-tfstate-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.terraform_state_key.arn
  }
}