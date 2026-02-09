FROM grafana/alloy:latest

# Copy Alloy configuration
COPY config.alloy /etc/alloy/config.alloy

# Expose Alloy UI port (optional, for debugging)
EXPOSE 12345

# Run Alloy
ENTRYPOINT ["/bin/alloy"]
CMD ["run", "/etc/alloy/config.alloy", "--server.http.listen-addr=0.0.0.0:12345"]
