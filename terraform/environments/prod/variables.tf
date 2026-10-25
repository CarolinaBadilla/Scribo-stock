variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "cluster_name" {
  type    = string
  default = "stock-saas-prod-eks"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "github_repo" {
  description = "Repositorio de GitHub en formato org/repo o usuario/repo"
  type        = string
  default     = "TU_USUARIO/TU_REPO" # Reemplaza por tu usuario y repo real (ej. carolbadilla/scribo)
}