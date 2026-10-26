# --- SECURITY GROUP PARA RDS POSTGRESQL ---
resource "aws_security_group" "rds" {
  name        = "stock-saas-prod-rds-sg"
  description = "Permitir trafico PostgreSQL solo desde el cluster y nodos de EKS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL desde EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "stock-saas-prod-rds-sg"
    Environment = "prod"
  }
}

# --- DB SUBNET GROUP (Subnets privadas) ---
resource "aws_db_subnet_group" "rds" {
  name       = "stock-saas-prod-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "stock-saas-prod-db-subnet-group"
    Environment = "prod"
  }
}

# --- INSTANCIA RDS POSTGRESQL ---
resource "aws_db_instance" "postgres" {
  identifier            = "stock-saas-prod-db"
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  engine                = "postgres"
  engine_version        = "15.7"
  instance_class        = "db.t4g.micro"

  db_name  = "scribo_db"
  username = "scribo_admin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible       = false
  skip_final_snapshot       = true
  deletion_protection       = false

  # Backups automatizados continuos (PITR)
  backup_retention_period   = 1
  backup_window             = "03:00-04:00"
  maintenance_window        = "Sun:04:30-Sun:05:30"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = true

  tags = {
    Name        = "stock-saas-prod-db"
    Environment = "prod"
  }
}

output "rds_endpoint" {
  description = "Endpoint de conexion de RDS PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "Host de conexion de RDS"
  value       = aws_db_instance.postgres.address
}