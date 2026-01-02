# Helm Deployment for Metadata Quality Platform

This directory contains Helm values files for deploying the Metadata Quality Platform on Atlan App Framework.

## Files

- `values-projectred.yaml` - Production deployment for projectred.atlan.com
- `values-dev.yaml` - Development environment overrides

## Deployment

### Prerequisites

1. Access to Atlan Kubernetes cluster
2. `atlan-app` Helm chart (base chart from Atlan)
3. Docker image pushed to registry
4. Atlan Apps team coordination for:
   - Tenant ID confirmation
   - S3 bucket name and region
   - OAuth client creation in Keycloak
   - Secret creation in AWS Secrets Manager

### Deploy to projectred

```bash
# Pull base atlan-app chart
helm pull oci://registry.atlan.com/local-development/atlan-app --version 0.1.0
tar -xzf atlan-app-0.1.0.tgz

# Deploy with projectred overrides
helm upgrade --install metadata-quality-app ./atlan-app \
  -n metadata-quality-app \
  --create-namespace \
  -f helm/values-projectred.yaml \
  --wait

# Verify deployment
kubectl get pods -n metadata-quality-app
kubectl logs -f deployment/metadata-quality-app -n metadata-quality-app
```

### Register with Atlan

After Helm deployment, Atlan Apps team needs to:

1. **Run manage-atlan-app Argo workflow**:
   - App name: `metadata-quality-app`
   - Tenant: `projectred`
   - This creates OAuth client in Keycloak
   - Stores credentials in AWS Secrets Manager

2. **Configure UI iframe**:
   - Nav item: "Metadata Quality" under "Apps"
   - Iframe URL: `http://metadata-quality-app.metadata-quality-app.svc.cluster.local:8080`
   - SSO preserved automatically (Direct Mode)

### Configuration Required from Atlan Team

Update `values-projectred.yaml` with actual values:

```yaml
# Confirm/update these with Atlan Apps team:
global:
  tenantId: "projectred"  # Exact tenant ID

dapr:
  components:
    - name: objectstore
      metadata:
        - name: bucket
          value: "projectred-metadata-quality"  # Actual S3 bucket
        - name: region
          value: "us-east-1"  # Actual AWS region
```

### Monitoring

After deployment, check:
- **Logs**: Grafana at `observability.atlan.com`
  - Dashboard: "Filelog Receiver" or app-specific view
- **Metrics**: VictoriaMetrics dashboards
  - CPU, memory, request rates
- **Temporal**: Workflow execution in Temporal UI

### Troubleshooting

```bash
# Check pod status
kubectl describe pod -n metadata-quality-app

# View logs
kubectl logs -f -n metadata-quality-app deployment/metadata-quality-app

# Check Dapr sidecar
kubectl logs -f -n metadata-quality-app deployment/metadata-quality-app -c daprd

# Test health endpoint
kubectl port-forward -n metadata-quality-app deployment/metadata-quality-app 8080:8080
curl http://localhost:8080/health
```

### Rollback

```bash
# Rollback to previous release
helm rollback metadata-quality-app -n metadata-quality-app

# Delete deployment
helm uninstall metadata-quality-app -n metadata-quality-app
```
