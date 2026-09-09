# Multi-stage Dockerfile for APS (Aadhan Pradhan Services)
FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build the binaries
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/aps ./cmd/aps
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/apsctl ./cmd/apsctl

# Final runtime image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /app

COPY --from=builder /bin/aps /usr/local/bin/aps
COPY --from=builder /bin/apsctl /usr/local/bin/apsctl
COPY migrations /app/migrations

EXPOSE 8080 6001 8082

ENTRYPOINT ["/usr/local/bin/aps"]
CMD ["all-in-one"]
