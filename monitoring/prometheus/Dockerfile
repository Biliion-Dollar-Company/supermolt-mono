FROM prom/prometheus:latest

# Copy Prometheus configuration
COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY alerts.yml /etc/prometheus/alerts.yml

# Copy Alertmanager configuration
COPY alertmanager.yml /etc/alertmanager/alertmanager.yml

# Expose Prometheus port
EXPOSE 9090

# Expose Alertmanager port
EXPOSE 9093

# Run Prometheus
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/etc/prometheus/console_libraries", \
     "--web.console.templates=/etc/prometheus/consoles", \
     "--web.enable-lifecycle"]
