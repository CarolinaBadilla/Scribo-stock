# 🏗️ Scribo SaaS — Enterprise Infrastructure Architecture

Documentación técnica y operativa de la infraestructura productiva desplegada en **Amazon Web Services (AWS)** bajo estándares de **Infraestructura como Código (IaC)**, **GitOps** y **DevSecOps**.

---

## 📐 Topología y Diagrama de Arquitectura

+-----------------------------------------------------------------------+
|                         Internet / Clientes                           |
+-----------------------------------------------------------------------+
                                   │
                                   ▼
+-----------------------------------------------------------------------+
|                            AWS WAF v2                                 |
|         (SQLi, XSS, Rate Limiting estricto por IP 1000 req/5min)       |
+-----------------------------------------------------------------------+
                                   │
                                   ▼
+-----------------------------------------------------------------------+
|                    Application Load Balancer (ALB)                    |
|        (Terminación HTTPS / TLS 1.2+ con Certificados AWS ACM)        |
+-----------------------------------------------------------------------+
                                   │
                                   ▼
+-----------------------------------------------------------------------+
|                       AWS EKS Cluster (Kubernetes)                     |
|                                                                       |
|  [ Namespace: scribo-prod ]                                           |
|  ├── Ingress (AWS Load Balancer Controller)                           |
|  ├── Frontend Service & Deployment (Next.js / React)                  |
|  ├── Backend Service & Deployment (NestJS)                            |
|  │    ├── Horizontal Pod Autoscaler (HPA)                             |
|  │    ├── Pod Disruption Budget (PDB)                                 |
|  │    └── IRSA (IAM Roles for Service Accounts vía OIDC)              |
|  └── app-secrets (Sincronizado vía External Secrets Operator)          |
|                                                                       |
|  [ Namespace: argocd ]                                                |
|  └── ArgoCD Controller (GitOps, Continuos Reconciliation, Auto-Heal)  |
|                                                                       |
|  [ Namespace: monitoring ]                                            |
|  ├── Prometheus (kube-prometheus-stack)                               |
|  ├── Grafana                                                          |
|  └── Alertmanager (Notificaciones de infraestructura a Discord)       |
+-----------------------------------------------------------------------+
             │                                              │
             ▼                                              ▼
+----------------------------------------+   +--------------------------+
|       Almacenamiento y Secretos        |   |      Base de Datos       |
| ├── AWS S3 (Media Assets con SSE-S3)   |   | ├── AWS RDS PostgreSQL   |
| ├── AWS Secrets Manager                |   | ├── Multi-AZ Deployment  |
| └── AWS ECR (Lifecycle & Trivy Scan)   |   | └── SSL/TLS Enforced     |
+----------------------------------------+   +--------------------------+

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| Cloud Provider | Amazon Web Services (AWS) |
| Infraestructura como Código (IaC) | Terraform (S3 Remote State, DynamoDB Locking) |
| Orquestación de Contenedores | AWS EKS (Kubernetes), Kustomize |
| Continuous Delivery (GitOps) | ArgoCD (Declarative Continuous Deployment, Drift Auto-Healing) |
| Base de Datos | AWS RDS PostgreSQL (Multi-AZ, Cifrado en reposo, CA Bundle SSL) |
| Seguridad Perimetral | AWS WAFv2 (CommonRuleSet, SQLiRuleSet, RateBasedStatement) |
| Identidad y Acceso | AWS IAM Roles for Service Accounts (IRSA vía OIDC) |
| Gestión de Secretos | External Secrets Operator (ESO) + AWS Secrets Manager |
| Observabilidad y Métricas | Prometheus, Grafana, Alertmanager (Discord Webhooks) |
| CI / CD Pipeline | GitHub Actions, Docker Buildx, Trivy Vulnerability Scanner |

---

## 🔐 Pilares de Seguridad (DevSecOps)

1. Cero Credenciales Estáticas (IRSA):
   - Ni los microservicios ni los controladores almacenan AWS_ACCESS_KEY_ID ni contraseñas.
   - La autenticación con AWS S3 y AWS Secrets Manager se realiza mediante tokens federados OIDC efímeros gestionados por AWS STS.

2. Seguridad Perimetral en Capa 7 (AWS WAFv2):
   - Inspección de tráfico entrante directamente en el Application Load Balancer.
   - Bloqueo en el borde (HTTP 403 Forbidden) contra SQL Injection, Cross-Site Scripting (XSS) y saturación por IP.

3. Gestión Desacoplada de Secretos (External Secrets Operator):
   - Eliminación de secretos en texto plano dentro del repositorio Git.
   - Sincronización automática de pares clave-valor desde AWS Secrets Manager hacia Secrets nativos de Kubernetes.

4. Shift-Left Security en CI/CD:
   - Análisis estático de seguridad en imágenes Docker mediante Trivy antes del push hacia AWS ECR.
   - Políticas de ciclo de vida (ECR Lifecycle Policies) para purga automática de imágenes huérfanas.

---

## 🔄 Flujo Operativo GitOps

El clúster no expone puertos administrativos ni acepta despliegues directos desde runners externos:

1. El desarrollador sube cambios a GitHub (git push origin main).
2. GitHub Actions ejecuta las pruebas, compila la imagen Docker, realiza el escaneo de vulnerabilidades con Trivy y sube la imagen a AWS ECR.
3. El pipeline actualiza el tag en kustomization.yaml y realiza un commit automático con [skip ci].
4. ArgoCD detecta la actualización en el repositorio Git y aplica el rolling update en el clúster sin downtime.
5. Si alguien realiza modificaciones manuales en el clúster (drift), ArgoCD restaura automáticamente el estado declarado en Git (Auto-Healing).

---

## 📊 Monitoreo y Reglas de Alerta

El stack de observabilidad supervisa el estado de salud del clúster con notificaciones dirigidas al canal de Discord #notis_aws:
- ScriboBackendPodCrashLooping: Se dispara si un pod de backend entra en ciclo persistente de reinicio.
- HighCPUUsage / HighMemoryUsage: Detecta sobrecargas sostenidas en pods y nodos antes de la saturación.
- RDSConnectionSaturation: Supervisa la disponibilidad de conexiones concurrentes hacia PostgreSQL.

## 💰 FinOps & Control de Costos

1. Presupuestos y Proyecciones Preventivas (AWS Budgets):
   - Presupuesto mensual controlado mediante Terraform con alertas escalonadas por correo al 80% (consumo real) y 100% (pronóstico fin de mes).

2. Auditoría Granular por Microservicio (Kubecost):
   - Monitoreo en tiempo real del gasto en dólares desglosado por namespace, deployment y pod, identificando costos ociosos (idle allocation).

3. Shift-Left Cost Analysis (Infracost):
   - Estimación predictiva de impacto financiero integrada al flujo de infraestructura como código antes de la aplicación de cambios en AWS.