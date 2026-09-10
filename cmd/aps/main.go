package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/khajumsanjog/aps/internal/api"
	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/beams"
	"github.com/khajumsanjog/aps/internal/config"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
	"github.com/khajumsanjog/aps/internal/webhook"
	"github.com/khajumsanjog/aps/internal/ws"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	mode := "all-in-one"
	if len(os.Args) > 1 && !stringsHasPrefix(os.Args[1], "-") {
		mode = os.Args[1]
	}

	flag.StringVar(&mode, "mode", mode, "Server mode: all-in-one, ws, api, beams")
	flag.Parse()

	masterKey := crypto.DeriveKey(cfg.MasterKey)

	// Initialize Storage
	var st store.Store
	if cfg.DatabaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pgStore, err := store.NewPostgresStore(ctx, cfg.DatabaseURL)
		cancel()
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to PostgreSQL, falling back to in-memory store")
			st = store.NewMemoryStore()
		} else {
			log.Info().Msg("Connected to PostgreSQL database")
			st = pgStore
		}
	} else {
		log.Info().Msg("Using high-performance in-memory database store")
		st = store.NewMemoryStore()
	}

	// Seed default developer account and demo app
	seedDefaultData(st, masterKey)

	// Initialize PubSub
	var ps pubsub.PubSub
	if cfg.RedisURL != "" {
		redisPS, err := pubsub.NewRedisPubSub(cfg.RedisURL)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to Redis, falling back to in-memory pubsub")
			ps = pubsub.NewMemoryPubSub()
		} else {
			log.Info().Msg("Connected to Redis Pub/Sub cluster")
			ps = redisPS
		}
	} else {
		log.Info().Msg("Using in-memory Pub/Sub broker")
		ps = pubsub.NewMemoryPubSub()
	}
	defer ps.Close()

	// Initialize Webhook Dispatcher
	whDispatcher := webhook.NewDispatcher(st, masterKey)

	// Initialize Hub
	hub := ws.NewHub(st, ps, masterKey, whDispatcher)

	// Initialize Beams Push Service
	beamsSvc := beams.NewService(st, masterKey)
	beamsSvc.SetWebhook(whDispatcher)

	// Initialize REST Control Plane API
	apiSvc := api.NewAPI(st, hub, ps, beamsSvc, masterKey, cfg.JWTSecret)
	apiSvc.SetWebhook(whDispatcher)

	// Initialize WS Server
	wsServer := ws.NewServer(hub, st, cfg.ActivityTimeout)

	switch mode {
	case "ws":
		runServer(fmt.Sprintf(":%d", cfg.WSPort), wsServer.Routes(), "APS Channels WebSocket Server")
	case "api":
		runServer(fmt.Sprintf(":%d", cfg.APIPort), apiSvc.Routes(), "APS Control Plane REST API")
	case "beams":
		runServer(fmt.Sprintf(":%d", cfg.BeamsPort), beamsSvc.Routes(), "APS Beams Push Server")
	default:
		// All-in-one multiplexer: serves WS, API, and Beams on configured port
		mux := chi.NewRouter()
		mux.Use(middleware.Logger)
		mux.Use(middleware.Recoverer)
		mux.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"*"},
			AllowCredentials: true,
		}))

		mux.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"ok","service":"aps-all-in-one","version":"1.0.0"}`))
		})

		// Mount WebSocket endpoints
		mux.Mount("/app", wsServer.Routes())
		mux.Mount("/ws", wsServer.Routes())

		// Mount Beams endpoints
		mux.Mount("/beams", beamsSvc.Routes())

		// Mount REST API endpoints
		mux.Mount("/", apiSvc.Routes())

		runServer(fmt.Sprintf(":%d", cfg.Port), mux, "APS All-In-One Unified Service")
	}
}

func runServer(addr string, handler http.Handler, name string) {
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		log.Info().Str("addr", addr).Msg(fmt.Sprintf("Starting %s", name))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func stringsHasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func seedDefaultData(st store.Store, masterKey []byte) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := st.GetUserByEmail(ctx, "developer@khajumsanjog.com")
	if err == nil {
		return // already exists
	}

	hash, _ := auth.HashPassword("password123")
	user := &models.User{
		ID:           "usr_default_admin",
		Email:        "developer@khajumsanjog.com",
		PasswordHash: hash,
		Role:         "admin",
	}
	_ = st.CreateUser(ctx, user)

	encSecret, _ := crypto.Encrypt([]byte("aps_secret_demo_67890"), masterKey)
	app := &models.App{
		ID:                    "100001",
		Name:                  "Khajum Sanjog Realtime",
		AppKey:                "aps_key_demo_12345",
		SecretCiphertext:      encSecret,
		OwnerID:               user.ID,
		Cluster:               "mt1",
		RateLimitRPS:          1000,
		MaxConnections:        10000,
		MessageHistoryEnabled: true,
		WebhooksEnabled:       true,
	}
	_ = st.CreateApp(ctx, app)

	encSecret2, _ := crypto.Encrypt([]byte("c1ea8e9dd1954f6ab461"), masterKey)
	app2 := &models.App{
		ID:                    "8886000",
		Name:                  "Khajum Sanjog Custom App",
		AppKey:                "4f4e63ace80446d2ba91",
		SecretCiphertext:      encSecret2,
		OwnerID:               user.ID,
		Cluster:               "mt1",
		RateLimitRPS:          1000,
		MaxConnections:        10000,
		MessageHistoryEnabled: true,
		WebhooksEnabled:       true,
	}
	_ = st.CreateApp(ctx, app2)

	_ = st.CreateBeamsInstance(ctx, &models.BeamsInstance{
		InstanceID: "beams_demo_instance",
		AppID:      app.ID,
	})
	_ = st.CreateBeamsInstance(ctx, &models.BeamsInstance{
		InstanceID: "beams_custom_instance",
		AppID:      app2.ID,
	})

	log.Info().Str("email", "developer@khajumsanjog.com").Msg("Seeded default developer account and apps (password: password123)")
}
