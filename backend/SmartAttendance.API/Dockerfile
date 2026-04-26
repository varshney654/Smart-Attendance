FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy everything
COPY . .

# Restore dependencies
RUN dotnet restore SmartAttendance.API.csproj

# Build project
RUN dotnet publish SmartAttendance.API.csproj -c Release -o out

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy build output
COPY --from=build /app/out .

# Run app
ENTRYPOINT ["dotnet", "SmartAttendance.API.dll"]
