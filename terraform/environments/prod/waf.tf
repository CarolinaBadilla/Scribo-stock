resource "aws_wafv2_web_acl" "scribo_alb_waf" {
  name        = "scribo-prod-alb-waf"
  description = "WAF para proteger el ALB de Scribo SaaS"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "scribo-prod-alb-waf"
    sampled_requests_enabled   = true
  }

  # Regla 1: Reglas comunes administradas por AWS (XSS, LFI, RFI, tamaños anómalos)
  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Regla 2: Reglas contra SQL Injection (SQLi)
  rule {
    name     = "AWS-AWSManagedRulesSQLiRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Regla 3: Mitigación de fuerza bruta / Rate Limiting por IP (máx 1000 requests en 5 min)
  rule {
    name     = "RateLimitPerIP"
    priority = 30

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitPerIPMetric"
      sampled_requests_enabled   = true
    }
  }
}

output "waf_acl_arn" {
  description = "ARN de la Web ACL para asociar al Ingress"
  value       = aws_wafv2_web_acl.scribo_alb_waf.arn
}