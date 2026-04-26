FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# copy csproj
COPY backend/SmartAttendance.API/SmartAttendance.API.csproj ./SmartAttendance.API/
RUN dotnet restore ./SmartAttendance.API/SmartAttendance.API.csproj

# copy full source
COPY backend/SmartAttendance.API/ ./SmartAttendance.API/

WORKDIR /src/SmartAttendance.API
RUN dotnet publish -c Release -o /app/publish

# runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

ENTRYPOINT ["dotnet", "SmartAttendance.API.dll"]
