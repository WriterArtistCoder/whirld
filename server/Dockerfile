# Use the official Bun Docker image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy Bun files and install dependencies
COPY bun.lock package.json ./
RUN bun install

# Copy the rest of the code
COPY . .

# Expose your app port (adjust if needed)
EXPOSE 3193

# Start your app
CMD ["bun", "run", "start"]