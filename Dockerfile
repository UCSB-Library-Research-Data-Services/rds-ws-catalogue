# Datasette with editing plugins for workshop management
FROM datasetteproject/datasette:latest

# Install editing and utility plugins
RUN datasette install datasette-edit-schema \
    datasette-insert \
    datasette-write \
    datasette-json-html \
    datasette-pretty-json \
    datasette-copyable \
    datasette-export-notebook

# Set working directory
WORKDIR /data

# Expose Datasette port
EXPOSE 8001

# Default command (overridden in docker-compose.yml)
CMD ["datasette", "serve", "--host", "0.0.0.0", "--port", "8001"]
