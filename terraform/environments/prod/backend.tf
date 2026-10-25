terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }

  backend "s3" {
    bucket         = "stock-saas-tfstate-512902043510-us-east-1" # Reemplaza con tu Account ID
    key            = "prod/infrastructure.tfstate"
    region         = "us-east-1"
    dynamodb_table = "stock-saas-tfstate-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "stock-saas"
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}