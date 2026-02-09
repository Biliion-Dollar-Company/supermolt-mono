FROM grafana/grafana:latest

# Install plugins
RUN grafana-cli plugins install grafana-clock-panel && \
    grafana-cli plugins install grafana-piechart-panel

# Copy datasource configuration
COPY datasources.yml /etc/grafana/provisioning/datasources/datasources.yml

# Copy dashboard configuration
COPY dashboards.yml /etc/grafana/provisioning/dashboards/dashboards.yml
COPY dashboards/ /var/lib/grafana/dashboards/

# Expose Grafana port
EXPOSE 3000

# Environment variables will be set via Railway
# GF_SECURITY_ADMIN_PASSWORD
# GF_SERVER_ROOT_URL
