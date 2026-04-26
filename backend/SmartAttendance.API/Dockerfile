FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy everything
COPY . .

# Go inside backend folder
WORKDIR /app/backend/SmartAttendance.API

# Restore + build
RUN dotnet restore
RUN dotnet publish -c Release -o out

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/backend/SmartAttendance.API/out .

ENTRYPOINT ["dotnet", "SmartAttendance.API.dll"]
