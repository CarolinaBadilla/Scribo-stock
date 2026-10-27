resource "aws_budgets_budget" "scribo_monthly_budget" {
  name              = "scribo-prod-monthly-budget"
  budget_type       = "COST"
  limit_amount      = "100.0" # Ajusta el límite mensual en USD según tu objetivo
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"

  # Alerta 1: Consumo real alcanza el 80% del presupuesto
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["carolina.badilla@ejemplo.com"] # Reemplaza con tu email real
  }

  # Alerta 2: Pronóstico de AWS indica que el mes terminará superando el 100%
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["carolina.badilla@ejemplo.com"] # Reemplaza con tu email real
  }
}