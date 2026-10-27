# Política para conservar solo las últimas 10 imágenes etiquetadas y purgar no etiquetadas tras 1 día
locals {
  ecr_repositories = [
    "stock-saas/backend",
    "stock-saas/frontend"
  ]

  ecr_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Purgar imágenes huérfanas sin tag después de 1 día"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Conservar solo las últimas 10 imágenes por repositorio"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "scribo_ecr_policies" {
  for_each   = toset(local.ecr_repositories)
  repository = each.value
  policy     = local.ecr_policy
}