package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/khajumsanjog/aps/internal/api"
	"github.com/khajumsanjog/aps/internal/beams"
	"github.com/khajumsanjog/aps/internal/config"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
	"github.com/khajumsanjog/aps/internal/webhook"
	"github.com/khajumsanjog/aps/internal/ws"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	masterKey := crypto.DeriveKey(cfg.MasterKey)

	var st store.Store = store.NewMemoryStore()
	if cfg.DatabaseURL != "" {
		if pg, err := store.NewPostgresStore(context.Background(), cfg.DatabaseURL); err == nil {
			st = pg
		}
	}

	var ps pubsub.PubSub = pubsub.NewMemoryPubSub()
	if cfg.RedisURL != "" {
		if rps, err := pubsub.NewRedisPubSub(cfg.RedisURL); err == nil {
			ps = rps
		}
	}
	defer ps.Close()

	wh := webhook.NewDispatcher(st, masterKey)
	hub := ws.NewHub(st, ps, masterKey, wh)
	beamsSvc := beams.NewService(st, masterKey)
	beamsSvc.SetWebhook(wh)
	apiSvc := api.NewAPI(st, hub, ps, beamsSvc, masterKey, cfg.JWTSecret)
	apiSvc.SetWebhook(wh)

	addr := fmt.Sprintf(":%d", cfg.APIPort)
	srv := &http.Server{
		Addr:    addr,
		Handler: apiSvc.Routes(),
	}

	go func() {
		log.Info().Str("addr", addr).Msg("Starting APS REST Control Plane API")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("API server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
