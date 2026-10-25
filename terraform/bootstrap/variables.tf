variable "aws_region" {
  description = "Región de AWS para los recursos"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "ID de la cuenta de AWS de 12 dígitos"
  type        = string
}