# Smart Attendance System - Dockerfile
# This Dockerfile is optimized for production deployment on Render

# Stage 1: Build
# Use .NET 10 SDK for building the application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Copy project file and restore dependencies
COPY SmartAttendance.API.csproj ./SmartAttendance.API/
RUN dotnet restore SmartAttendance.API/SmartAttendance.API.csproj

# Copy all source files and build
COPY . ./SmartAttendance.API/
WORKDIR /src/SmartAttendance.API
RUN dotnet build SmartAttendance.API.csproj -c Release -o /app/build
RUN dotnet publish SmartAttendance.API.csproj -c Release -o /app/publish

# Stage 2: Runtime
# Use ASP.NET Core runtime for running the application
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

WORKDIR /app

# Install curl for health checks (optional, can be removed for smaller image)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy published files from build stage
COPY --from=build /app/publish .

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port 5000 (Render's expected port)
EXPOSE 5000

# Set environment variables
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/auth/health || exit 1

# Entry point
ENTRYPOINT ["dotnet", "SmartAttendance.API.dll"]
