locals {
  repositories = ["stock-saas/frontend", "stock-saas/backend"]
}

resource "aws_ecr_repository" "apps" {
  for_each             = toset(local.repositories)
  name                 = each.key
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = {
    Name = each.key
  }
}

resource "aws_ecr_lifecycle_policy" "retention" {
  for_each   = toset(local.repositories)
  repository = aws_ecr_repository.apps[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Eliminar imagenes untagged luego de 7 dias"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}