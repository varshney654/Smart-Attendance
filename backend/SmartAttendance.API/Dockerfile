FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# project file copy
COPY backend/SmartAttendance.API/*.csproj ./SmartAttendance.API/
WORKDIR /app/SmartAttendance.API

RUN dotnet restore

# baaki files copy
COPY backend/SmartAttendance.API/. .

RUN dotnet publish -c Release -o /app/publish

# runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

ENTRYPOINT ["dotnet", "SmartAttendance.API.dll"]
